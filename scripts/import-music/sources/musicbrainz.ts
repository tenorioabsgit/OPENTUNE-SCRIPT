import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'musicbrainz';
const BASE_URL = 'https://musicbrainz.org/ws/2/';
const PAGE_SIZE = 100;
const STATE_DOC = 'import-state/musicbrainz';

// MusicBrainz primary tags
const TAG_FILTERS = [
  'rock', 'metal', 'electronic', 'hip-hop', 'experimental',
  'indie', 'pop', 'jazz', 'folk', 'ambient',
];

interface MBRecording {
  id: string;
  title: string;
  'artist-credit'?: Array<{ artist: { id: string; name: string } }>;
  releases?: Array<{
    id: string;
    title: string;
    'release-group'?: { id: string };
    images?: Array<{ image: string }>;
  }>;
}

interface MBState {
  tagIndex: number;
  offsetByTag: Record<string, number>;
  lastRun: string;
}

export async function fetchMusicBrainz(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  let state: MBState = {
    tagIndex: 0,
    offsetByTag: {},
    lastRun: '',
  };

  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) {
        state = stateDoc.data() as MBState;
      }
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Rotate through tags, 2 tags per run
  const tagsToFetch = 2;
  for (let t = 0; t < tagsToFetch; t++) {
    const tagIdx = (state.tagIndex + t) % TAG_FILTERS.length;
    const tag = TAG_FILTERS[tagIdx];
    const offset = state.offsetByTag[tag] || 0;

    try {
      const url =
        `${BASE_URL}recordings?query=tag:${encodeURIComponent(tag)} AND status:official` +
        `&limit=${PAGE_SIZE}&offset=${offset}&fmt=json&inc=releases+recordings+artists`;

      log(SOURCE, `[${tag}] offset ${offset}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OpenTune/1.0 (contact: admin@example.com)',
        },
      });

      if (!response.ok) {
        errors.push(`HTTP ${response.status} on tag ${tag}`);
        continue;
      }

      const data = await response.json();
      if (!data.recordings || data.recordings.length === 0) {
        state.offsetByTag[tag] = 0; // Reset offset
        continue;
      }

      for (const recording of data.recordings) {
        if (!recording.title || !recording['artist-credit']) continue;

        const artistName = recording['artist-credit']
          .map((ac: any) => ac.artist.name)
          .join(', ');

        // Try to get artwork from releases
        let artwork = '';
        if (recording.releases && recording.releases.length > 0) {
          const release = recording.releases[0];
          if (release.images && release.images.length > 0) {
            artwork = release.images[0].image;
          }
        }

        if (!artwork) continue; // Require artwork

        const id = `musicbrainz-${recording.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        tracks.push(
          sanitizeTrack({
            id,
            title: recording.title,
            artist: artistName,
            artistId: `musicbrainz-${recording['artist-credit'][0].artist.id}`,
            album: recording.releases?.[0]?.title || 'Unknown Album',
            albumId: `musicbrainz-${recording.releases?.[0]?.id || ''}`,
            duration: recording.length ? Math.round(recording.length / 1000) : 0,
            artwork,
            audioUrl: '', // MusicBrainz doesn't provide audio URLs
            genre: tag,
            license: 'Various (MusicBrainz Open Data)',
          })
        );
      }

      // Update offset for next run
      state.offsetByTag[tag] = offset + PAGE_SIZE;
      await sleep(500); // MusicBrainz rate limit: 1 req/sec
    } catch (err) {
      errors.push(`${tag}: ${(err as Error).message}`);
    }
  }

  // Save updated state
  if (db) {
    try {
      const newState: MBState = {
        tagIndex: (state.tagIndex + tagsToFetch) % TAG_FILTERS.length,
        offsetByTag: state.offsetByTag,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: tagIdx=${newState.tagIndex}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
