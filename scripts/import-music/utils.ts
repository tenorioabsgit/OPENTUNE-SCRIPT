import { TrackRecord } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizeTrack(
  partial: Partial<TrackRecord> & { id: string; audioUrl: string }
): TrackRecord {
  return {
    id: partial.id,
    title: partial.title || 'Unknown Title',
    artist: partial.artist || 'Unknown Artist',
    artistId: partial.artistId || '',
    album: partial.album || 'Singles',
    albumId: partial.albumId || '',
    duration: partial.duration || 0,
    artwork: partial.artwork || '',
    audioUrl: partial.audioUrl,
    isLocal: false,
    genre: partial.genre || 'Other',
    license: partial.license || 'Creative Commons',
    uploadedBy: 'system-import',
    uploadedByName: 'OpenTune Bot',
    titleLower: (partial.title || 'unknown title').toLowerCase(),
  };
}

export function validateTrack(track: TrackRecord): boolean {
  if (!track.id || track.id.length > 128) return false;
  if (!track.audioUrl || (!track.audioUrl.startsWith('http') && !track.audioUrl.startsWith('gs://'))) return false;
  if (!track.title) return false;
  if (!track.artwork || (!track.artwork.startsWith('http') && !track.artwork.startsWith('gs://'))) return false;
  return true;
}

const ROCK_GENRES = new Set([
  'rock', 'metal', 'punk', 'hardcore', 'hardrock', 'hard rock',
  'progressive', 'progressive rock', 'grunge', 'alternative',
  'alternative rock', 'indie', 'indie rock', 'post-punk', 'postpunk',
  'stoner rock', 'stonerrock', 'numetal', 'nu-metal', 'nu metal',
  'metalcore', 'deathcore', 'thrash', 'thrash metal', 'death metal',
  'doom', 'doom metal', 'sludge', 'black metal', 'power metal',
  'symphonic metal', 'folk metal', 'gothic metal', 'gothic rock',
  'psychedelic rock', 'garage rock', 'blues rock', 'southern rock',
  'classic rock', 'art rock', 'math rock', 'noise rock', 'emo',
  'screamo', 'pop punk', 'skate punk', 'crust punk', 'post-rock',
  'shoegaze', 'new wave', 'industrial', 'industrial metal',
]);

export function isRockGenre(genre: string): boolean {
  if (!genre) return false;
  const lower = genre.toLowerCase().trim();
  if (ROCK_GENRES.has(lower)) return true;
  // Partial match for compound genres like "progressive metal"
  return [...ROCK_GENRES].some(rg => lower.includes(rg) || rg.includes(lower));
}

export function log(source: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${source}] ${message}`);
}
