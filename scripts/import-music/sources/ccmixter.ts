import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'ccmixter';
const BASE_URL = 'https://dig.ccmixter.org/api/records/';
const PAGE_SIZE = 50;
const STATE_DOC = 'import-state/ccmixter';

// Creative Commons licenses filter
const LICENSE_FILTER = 'cc'; // Only CC licensed content

// Content types to search
const CONTENT_TYPES = [
  'opsample', // Original music sample
  'remix', // Remixed tracks
  'cover', // Covers of songs
];

interface CCMixterTrack {
  id: string;
  upload_id: string;
  name: string;
  artist: string;
  artist_id: string;
  upload_user: string;
  ccnc_url: string;
  file_extension: string;
  images?: { large?: string; medium?: string };
  duration?: number;
}

interface CCMixterState {
  contentTypeIndex: number;
  offsetByType: Record<string, number>;
  lastRun: string;
}

export async function fetchCCMixter(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  let state: CCMixterState = {
    contentTypeIndex: 0,
    offsetByType: {},
    lastRun: '',
  };

  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) {
        state = stateDoc.data() as CCMixterState;
      }
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Rotate through content types, 2 per run
  const typesToFetch = 2;
  for (let ct = 0; ct < typesToFetch; ct++) {
    const typeIdx = (state.contentTypeIndex + ct) % CONTENT_TYPES.length;
    const contentType = CONTENT_TYPES[typeIdx];
    const offset = state.offsetByType[contentType] || 0;

    try {
      const url =
        `${BASE_URL}?q=${contentType}` +
        `&license=${LICENSE_FILTER}` +
        `&limit=${PAGE_SIZE}&offset=${offset}&fmt=json`;

      log(SOURCE, `[${contentType}] offset ${offset}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OpenTune/1.0 (contact: admin@example.com)',
        },
      });

      if (!response.ok) {
        errors.push(`HTTP ${response.status} on type ${contentType}`);
        continue;
      }

      const data = await response.json();
      if (!data.records || data.records.length === 0) {
        state.offsetByType[contentType] = 0; // Reset
        continue;
      }

      for (const record of data.records) {
        if (!record.name || !record.artist) continue;

        // ccMixter provides direct download links
        const audioUrl = `https://ccmixter.org/4download/file/${record.upload_id}`;

        // Images are available
        let artwork = '';
        if (record.images) {
          artwork = record.images.large || record.images.medium || '';
        }

        if (!artwork) continue; // Require artwork

        const id = `ccmixter-${record.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        tracks.push(
          sanitizeTrack({
            id,
            title: record.name,
            artist: record.artist,
            artistId: `ccmixter-${record.artist_id}`,
            album: `${contentType} Collection`,
            albumId: `ccmixter-${contentType}`,
            duration: record.duration || 0,
            artwork,
            audioUrl,
            genre: contentType === 'opsample' ? 'Sample' : contentType,
            license: 'Creative Commons',
          })
        );
      }

      // Update offset
      state.offsetByType[contentType] = offset + PAGE_SIZE;
      await sleep(400); // Respectful rate limiting
    } catch (err) {
      errors.push(`${contentType}: ${(err as Error).message}`);
    }
  }

  // Save state
  if (db) {
    try {
      const newState: CCMixterState = {
        contentTypeIndex: (state.contentTypeIndex + typesToFetch) % CONTENT_TYPES.length,
        offsetByType: state.offsetByType,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: typeIdx=${newState.contentTypeIndex}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
