import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'discogs';
const BASE_URL = 'https://api.discogs.com/';
const PAGE_SIZE = 50;
const STATE_DOC = 'import-state/discogs';

// Discogs searches to rotate through
const SEARCHES = [
  'genre:rock year:[2010 TO 2026] type:release',
  'genre:electronic year:[2010 TO 2026] type:release',
  'genre:hip-hop year:[2010 TO 2026] type:release',
  'genre:pop year:[2010 TO 2026] type:release',
  'genre:metal year:[2010 TO 2026] type:release',
];

interface DiscogsRelease {
  id: string;
  title: string;
  artists?: Array<{ name: string; id: string }>;
  year?: number;
  genres?: string[];
  styles?: string[];
  thumb?: string;
  resource_url?: string;
}

interface DiscogsState {
  searchIndex: number;
  offsetBySearch: Record<string, number>;
  lastRun: string;
}

export async function fetchDiscogs(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const discogsToken = process.env.DISCOGS_TOKEN;
  if (!discogsToken) {
    return {
      sourceName: SOURCE,
      tracks: [],
      errors: ['DISCOGS_TOKEN not set'],
    };
  }

  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  let state: DiscogsState = {
    searchIndex: 0,
    offsetBySearch: {},
    lastRun: '',
  };

  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) {
        state = stateDoc.data() as DiscogsState;
      }
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Rotate through searches, 2 per run
  const searchesToFetch = 2;
  for (let s = 0; s < searchesToFetch; s++) {
    const searchIdx = (state.searchIndex + s) % SEARCHES.length;
    const search = SEARCHES[searchIdx];
    const offset = state.offsetBySearch[search] || 0;
    const page = Math.floor(offset / PAGE_SIZE) + 1;

    try {
      const url =
        `${BASE_URL}database/search?q=${encodeURIComponent(search)}` +
        `&per_page=${PAGE_SIZE}&page=${page}` +
        `&token=${discogsToken}&format=json`;

      log(SOURCE, `[${searchIdx}] "${search}" page ${page}...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OpenTune/1.0 (contact: admin@example.com)',
        },
      });

      if (!response.ok) {
        errors.push(`HTTP ${response.status} on search "${search}"`);
        continue;
      }

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        state.offsetBySearch[search] = 0;
        continue;
      }

      for (const result of data.results) {
        if (!result.title || !result.thumb) continue;

        // Parse artist info
        const artist = result.artists?.[0]?.name || 'Unknown Artist';
        const artistId = result.artists?.[0]?.id || '';

        // Extract genre
        const genre = result.genres?.[0] || result.styles?.[0] || 'Miscellaneous';

        const id = `discogs-${result.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        tracks.push(
          sanitizeTrack({
            id,
            title: result.title,
            artist,
            artistId: `discogs-${artistId}`,
            album: result.title, // Discogs item IS the album
            albumId: `discogs-${result.id}`,
            duration: 0, // Discogs API doesn't provide track duration
            artwork: result.thumb, // Use thumbnail from Discogs
            audioUrl: '', // Discogs doesn't provide audio
            genre: genre,
            license: 'Various (Discogs Metadata)',
          })
        );
      }

      // Update offset
      state.offsetBySearch[search] = offset + PAGE_SIZE;
      await sleep(600); // Discogs has rate limits
    } catch (err) {
      errors.push(`Search "${search}": ${(err as Error).message}`);
    }
  }

  // Save state
  if (db) {
    try {
      const newState: DiscogsState = {
        searchIndex: (state.searchIndex + searchesToFetch) % SEARCHES.length,
        offsetBySearch: state.offsetBySearch,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: searchIdx=${newState.searchIndex}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
