import * as admin from 'firebase-admin';
import { TrackRecord } from './types';
import { log, sleep } from './utils';

type Bucket = admin.storage.Bucket;

const CONCURRENCY = 5;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Extract source prefix from track ID (e.g. "jamendo" from "jamendo-12345")
 */
function getSource(trackId: string): string {
  const dash = trackId.indexOf('-');
  return dash > 0 ? trackId.substring(0, dash) : 'unknown';
}

/**
 * Download a file from a URL and return the buffer
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OpenTune/1.0' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload a buffer to Firebase Storage and return the gs:// path
 */
async function uploadToStorage(
  bucket: Bucket,
  storagePath: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const file = bucket.file(storagePath);
  await file.save(data, {
    metadata: { contentType },
    resumable: false,
  });
  return `gs://${bucket.name}/${storagePath}`;
}

/**
 * Download and upload a single file with retries
 * Returns gs:// path on success, or original URL on failure
 */
async function downloadAndUpload(
  bucket: Bucket,
  sourceUrl: string,
  storagePath: string,
  contentType: string
): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await downloadFile(sourceUrl);
      return await uploadToStorage(bucket, storagePath, data, contentType);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      } else {
        log('storage', `Failed after ${MAX_RETRIES + 1} attempts: ${storagePath} - ${(err as Error).message}`);
        return sourceUrl; // Fallback to original URL
      }
    }
  }
  return sourceUrl;
}

/**
 * Process a single track: download audio + artwork, upload to Storage
 */
async function processTrack(
  bucket: Bucket,
  track: TrackRecord
): Promise<TrackRecord> {
  const source = getSource(track.id);
  const trackId = track.id;

  // Upload audio
  let audioUrl = track.audioUrl;
  if (audioUrl.startsWith('http')) {
    const audioPath = `imports/${source}/${trackId}.mp3`;
    audioUrl = await downloadAndUpload(bucket, audioUrl, audioPath, 'audio/mpeg');
  }

  // Upload artwork
  let artwork = track.artwork;
  if (artwork.startsWith('http')) {
    const artworkPath = `imports/${source}/${trackId}_cover.jpg`;
    artwork = await downloadAndUpload(bucket, artwork, artworkPath, 'image/jpeg');
  }

  return { ...track, audioUrl, artwork };
}

/**
 * Process all tracks with limited concurrency
 * Downloads audio + artwork and uploads to Firebase Storage
 */
export async function uploadAllTrackAssets(
  bucket: Bucket,
  tracks: TrackRecord[]
): Promise<TrackRecord[]> {
  if (tracks.length === 0) return tracks;

  log('storage', `Starting upload of ${tracks.length} tracks (concurrency: ${CONCURRENCY})...`);
  const results: TrackRecord[] = [];
  let completed = 0;
  let storedCount = 0;

  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const chunk = tracks.slice(i, i + CONCURRENCY);
    const processed = await Promise.all(
      chunk.map(track => processTrack(bucket, track))
    );

    for (const track of processed) {
      results.push(track);
      completed++;
      if (track.audioUrl.startsWith('gs://')) storedCount++;
    }

    if (completed % 20 === 0 || completed === tracks.length) {
      log('storage', `Progress: ${completed}/${tracks.length} (${storedCount} stored in Storage)`);
    }
  }

  log('storage', `Upload complete: ${storedCount}/${tracks.length} tracks stored in Firebase Storage`);
  return results;
}
