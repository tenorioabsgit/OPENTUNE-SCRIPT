import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { initFirebaseAdmin } from './firebaseAdmin';
import { log } from './utils';

const PAGE_SIZE = 100;
const CONCURRENCY = 5;

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  failedIds: string[];
}

/**
 * Converts a gs:// URL to an HTTPS Firebase Storage download URL.
 * Re-uploads the file metadata with a download token to make it publicly accessible.
 */
async function gsToHttps(
  bucket: admin.storage.Bucket,
  gsUrl: string
): Promise<string | null> {
  try {
    // Extract path from gs://bucket-name/path
    const match = gsUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
    if (!match) return null;

    const storagePath = match[1];
    const file = bucket.file(storagePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      log('migrate', `File not found in Storage: ${storagePath}`);
      return null;
    }

    // Get existing metadata or set a new download token
    const [metadata] = await file.getMetadata();
    let token = metadata.metadata?.firebaseStorageDownloadTokens;

    if (!token) {
      // Set a new download token
      token = randomUUID();
      await file.setMetadata({
        metadata: { firebaseStorageDownloadTokens: token },
      });
    }

    const encodedPath = encodeURIComponent(storagePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
  } catch (err) {
    log('migrate', `Error converting ${gsUrl}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const isDryRun = process.env.DRY_RUN === '1';
  const limitCount = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

  log('migrate', '=== OpenTune gs:// to HTTPS Migration ===');
  log('migrate', `Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limitCount < Infinity) log('migrate', `Limit: ${limitCount}`);

  const { db, bucket } = initFirebaseAdmin();
  const startTime = Date.now();

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
  };

  let query: admin.firestore.Query = db
    .collection('tracks')
    .orderBy('__name__')
    .limit(PAGE_SIZE);

  let hasMore = true;
  let lastDoc: admin.firestore.DocumentSnapshot | null = null;

  while (hasMore && stats.total < limitCount) {
    if (lastDoc) {
      query = db
        .collection('tracks')
        .orderBy('__name__')
        .startAfter(lastDoc)
        .limit(PAGE_SIZE);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const docs = snapshot.docs;
    lastDoc = docs[docs.length - 1];

    for (let i = 0; i < docs.length && stats.total < limitCount; i += CONCURRENCY) {
      const chunk = docs.slice(i, Math.min(i + CONCURRENCY, docs.length));

      await Promise.allSettled(
        chunk.map(async (doc) => {
          const data = doc.data();
          stats.total++;

          const artworkUrl = (data.artwork as string) || '';
          const audioUrl = (data.audioUrl as string) || '';

          const artworkNeedsFix = artworkUrl.startsWith('gs://');
          const audioNeedsFix = audioUrl.startsWith('gs://');

          if (!artworkNeedsFix && !audioNeedsFix) {
            stats.skipped++;
            return;
          }

          if (isDryRun) {
            log('migrate', `[DRY RUN] Would fix: ${doc.id} - "${data.title}" (artwork: ${artworkNeedsFix}, audio: ${audioNeedsFix})`);
            stats.migrated++;
            return;
          }

          const updates: Record<string, string> = {};

          if (artworkNeedsFix) {
            const httpsUrl = await gsToHttps(bucket, artworkUrl);
            if (httpsUrl) {
              updates.artwork = httpsUrl;
            } else {
              stats.failed++;
              stats.failedIds.push(doc.id);
              return;
            }
          }

          if (audioNeedsFix) {
            const httpsUrl = await gsToHttps(bucket, audioUrl);
            if (httpsUrl) {
              updates.audioUrl = httpsUrl;
            } else {
              stats.failed++;
              stats.failedIds.push(doc.id);
              return;
            }
          }

          await doc.ref.update(updates);
          stats.migrated++;

          if (stats.migrated % 50 === 0) {
            log('migrate', `Progress: ${stats.migrated} migrated, ${stats.total} scanned`);
          }
        })
      );
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('migrate', '=== Migration Summary ===');
  log('migrate', `  Total scanned: ${stats.total}`);
  log('migrate', `  Migrated: ${stats.migrated}`);
  log('migrate', `  Skipped (already HTTPS): ${stats.skipped}`);
  log('migrate', `  Failed: ${stats.failed}`);
  log('migrate', `  Completed in ${elapsed}s`);

  if (stats.failedIds.length > 0) {
    log('migrate', `  Failed IDs: ${stats.failedIds.slice(0, 20).join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
