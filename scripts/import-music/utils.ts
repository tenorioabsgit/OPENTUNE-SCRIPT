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

/** Returns true if the license URL/string contains a Non-Commercial clause. */
export function isNonCommercialLicense(license: string): boolean {
  const lower = license.toLowerCase();
  return lower.includes('-nc') || lower.includes('/nc') ||
    lower.includes('non-commercial') || lower.includes('noncommercial');
}

export function validateTrack(track: TrackRecord): boolean {
  if (!track.id || track.id.length > 128) return false;
  if (!track.audioUrl || (!track.audioUrl.startsWith('http') && !track.audioUrl.startsWith('gs://'))) return false;
  if (!track.title) return false;
  if (!track.artwork || (!track.artwork.startsWith('http') && !track.artwork.startsWith('gs://'))) return false;
  if (isNonCommercialLicense(track.license)) return false;
  if (isSfxTrack(track)) return false;
  return true;
}

// ── SFX / production music detection ────────────────────────────────────────

const SFX_GENRES = new Set([
  'logo', 'stinger', 'jingle', 'intro', 'trailer',
  'production', 'loop', 'musicbed', 'kidsquirky', 'corporate',
]);

const SFX_TITLE_PATTERNS = [
  /\bsfx\b/i,
  /\bsound\s*effect/i,
  /\bsound\s*fx\b/i,
  /\blogo\b/i,
  /\bident\b/i,
  /\bstinger\b/i,
  /\btrailer\b/i,
  /\b\d+\s*sec(ond)?s?\b/i,
  /\bshort\s*(version|edit|mix)\b/i,
  /\bfoley\b/i,
  /\bcorporate\b/i,
  /\badvertising\b/i,
  /\bcommercial\b/i,
  /\bbackground\s*(music|piano)?\b/i,
];

const SFX_ARTIST_PATTERNS = [
  /\bsound\s*effect/i,
  /\bsfx\b/i,
  /\bsound\s*library/i,
  /\baudio\s*library/i,
  /\bfree\s*sound/i,
  /\bzapsplat/i,
  /\bpixabay/i,
  /\bsound\s*design/i,
  /\bfoley\b/i,
  /\bstock\s*audio/i,
];

const LIBRARY_ARTISTS = new Set([
  'megis', 'tina ambient', 'vibedepot', 'waveloom',
  'zenharmonix', 'zenharmonics', 'muza production',
]);

export function isSfxTrack(track: TrackRecord): boolean {
  const genre = (track.genre || '').toLowerCase().replace(/[\s-]/g, '');
  const artist = (track.artist || '').toLowerCase();
  const duration = track.duration || 0;

  if (SFX_GENRES.has(genre)) return true;
  if (LIBRARY_ARTISTS.has(artist)) return true;
  for (const pat of SFX_ARTIST_PATTERNS) { if (pat.test(artist)) return true; }
  for (const pat of SFX_TITLE_PATTERNS) { if (pat.test(track.title || '')) return true; }
  if (duration > 0 && duration <= 15) return true;
  if (duration > 0 && duration <= 30) {
    const album = (track.album || '').toLowerCase();
    if (/\b(loop|bed|background|vlog|reel|tiktok|podcast|corporate)\b/i.test(album)) return true;
    if (/\b(loop|bed|background|vlog|reel|tiktok|podcast|corporate)\b/i.test(track.title || '')) return true;
  }

  return false;
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
