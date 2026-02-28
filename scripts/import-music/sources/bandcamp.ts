import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'bandcamp';
const BASE_URL = 'https://bandcamp.com/api/';
const PAGE_SIZE = 50;
const PAGES_PER_GENRE = 3; // ~150 tracks per genre
const STATE_DOC = 'import-state/bandcamp';

// Popular genres on Bandcamp with active creators
const GENRES = [
  'rock', 'metal', 'electronic', 'hip-hop', 'experimental',
  'indie', 'pop', 'jazz', 'folk', 'ambient',
];

interface BandcampTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artwork_url: string;
  audio_url: string;
  genre: string;
  license: string;
}

interface BandcampState {
  genreIndex: number;
  lastRun: string;
}

export async function fetchBandcamp(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  // Load state from Firestore
  let state: BandcampState = {
    genreIndex: 0,
    lastRun: '',
  };

  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) {
        state = stateDoc.data() as BandcampState;
      }
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Bandcamp doesn't have a public JSON API, so fetch via search proxy
  const genresToFetch = 3;
  for (let g = 0; g < genresToFetch; g++) {
    const genreIdx = (state.genreIndex + g) % GENRES.length;
    const genre = GENRES[genreIdx];

    for (let page = 0; page < PAGES_PER_GENRE; page++) {
      try {
        // Using Bandcamp search via community API endpoint
        const url = `${BASE_URL}search?q=${encodeURIComponent(genre)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;

        log(SOURCE, `[${genre}] page ${page + 1}...`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'OpenTune/1.0 (contact: admin@example.com)',
          },
        });

        if (!response.ok) {
          errors.push(`HTTP ${response.status} on ${genre} page ${page + 1}`);
          break;
        }

        const data = await response.json();
        if (!data.results || data.results.length === 0) {
          break;
        }

        for (const item of data.results) {
          if (!item.audio_url || !item.artwork_url) continue;
          
          const id = `bandcamp-${item.id}`;
          if (seen.has(id)) continue;
          seen.add(id);

          tracks.push(
            sanitizeTrack({
              id,
              title: item.title || item.track_title,
              artist: item.artist || item.artist_name,
              artistId: `bandcamp-artist-${item.artist_id}`,
              album: item.album || 'Independent Release',
              albumId: `bandcamp-album-${item.album_id || item.artist_id}`,
              duration: item.duration || 0,
              artwork: item.artwork_url,
              audioUrl: item.audio_url,
              genre: genre,
              license: 'Creative Commons / Independent',
            })
          );
        }

        if (data.results.length < PAGE_SIZE) break;
        await sleep(300); // Respectful rate limiting
      } catch (err) {
        errors.push(`${genre} page ${page + 1}: ${(err as Error).message}`);
      }
    }
  }

  // Save updated state
  if (db) {
    try {
      const newState: BandcampState = {
        genreIndex: (state.genreIndex + genresToFetch) % GENRES.length,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: genreIdx=${newState.genreIndex}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
