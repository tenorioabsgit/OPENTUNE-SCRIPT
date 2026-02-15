/**
 * Spotfly - ccMixter Copyleft Music Importer
 *
 * Fetches CC-licensed music from ccMixter and saves to Firestore
 * using Firebase Admin SDK (service account).
 *
 * Usage: node scripts/import-ccmixter.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(
  readFileSync(new URL('./serviceAccountKey.json', import.meta.url), 'utf-8')
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const TAGS = [
  'instrumental', 'electronic', 'ambient', 'hip_hop', 'rock',
  'jazz', 'classical', 'folk', 'blues', 'world',
  'pop', 'soul', 'funk', 'reggae', 'chill',
  'dance', 'acoustic', 'experimental', 'techno', 'trance',
];

const PER_TAG = 20;

function fetchWithCurl(url) {
  try {
    const result = execSync(`curl -sk "${url}"`, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
    return JSON.parse(result.toString());
  } catch (e) {
    return null;
  }
}

function parseDuration(ps) {
  if (!ps) return 0;
  const parts = ps.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

async function main() {
  console.log('🎵 Spotfly - ccMixter Importer (Admin SDK)\n');
  console.log('✅ Firebase Admin OK\n');

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const tag of TAGS) {
    process.stdout.write(`🏷️  ${tag.padEnd(15)} `);

    const url = `https://ccmixter.org/api/query?f=json&limit=${PER_TAG}&sort=rank&ord=desc&tags=${tag}&reqtags=audio,mp3`;
    const data = fetchWithCurl(url);

    if (!data || !Array.isArray(data)) {
      console.log('❌ erro');
      continue;
    }

    let saved = 0;
    let skipped = 0;

    for (const item of data) {
      const mp3File = item.files?.find(f => f.file_nicname === 'mp3');
      if (!mp3File?.download_url) continue;

      const id = `ccmixter-${item.upload_id}`;
      const docRef = db.collection('tracks').doc(id);

      // Skip existing
      const existing = await docRef.get();
      if (existing.exists) {
        skipped++;
        totalSkipped++;
        continue;
      }

      const userTags = (item.upload_extra?.usertags || tag).split(',').filter(Boolean);
      const genre = userTags[0]?.replace(/_/g, ' ') || tag;
      const duration = parseDuration(mp3File.file_format_info?.ps);

      const track = {
        id,
        title: item.upload_name || 'Sem título',
        artist: item.user_real_name || item.user_name || 'Artista CC',
        artistId: `ccmixter-${item.user_name}`,
        album: 'ccMixter',
        albumId: '',
        duration,
        artwork: `https://picsum.photos/seed/ccm${item.upload_id}/300/300`,
        audioUrl: mp3File.download_url,
        isLocal: false,
        genre,
        license: `${item.license_name || 'Creative Commons'}`,
        uploadedBy: 'ccmixter-import',
        uploadedByName: 'ccMixter Community',
        titleLower: (item.upload_name || '').toLowerCase(),
        source: 'ccmixter',
        sourceUrl: item.file_page_url || '',
        addedAt: FieldValue.serverTimestamp(),
      };

      try {
        await docRef.set(track);
        saved++;
        totalSaved++;
      } catch (e) {
        // skip
      }
    }

    console.log(`${data.length} encontradas → ${saved} novas, ${skipped} existentes`);
  }

  console.log(`\n════════════════════════════════`);
  console.log(`📊 Novas: ${totalSaved} | Existentes: ${totalSkipped}`);
  console.log(`════════════════════════════════`);

  if (totalSaved > 0) {
    console.log(`\n🎉 ${totalSaved} músicas copyleft adicionadas ao Spotfly!`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
