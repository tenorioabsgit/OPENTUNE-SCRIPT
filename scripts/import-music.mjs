/**
 * Spotfly - Copyleft Music Importer
 *
 * Fetches Creative Commons music from ccMixter and Jamendo APIs
 * and saves track metadata to Firebase Firestore.
 *
 * Usage:
 *   node scripts/import-music.mjs                          # ccMixter only (no auth needed)
 *   JAMENDO_CLIENT_ID=xxx node scripts/import-music.mjs    # ccMixter + Jamendo
 *
 * ccMixter: No authentication required
 * Jamendo:  Requires free client_id from https://developer.jamendo.com/v3.0
 */

import https from 'node:https';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, getDocs, query, where
} from 'firebase/firestore';

// ============================================================
// Configuration
// ============================================================
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '';

const firebaseConfig = {
  apiKey: 'AIzaSyAlcChuWLkw9-zuf_GAkvU3drg6Hz1NQhc',
  authDomain: 'spotfly-app.firebaseapp.com',
  projectId: 'spotfly-app',
  storageBucket: 'spotfly-app.firebasestorage.app',
  messagingSenderId: '215760117220',
  appId: '1:215760117220:web:62871c1c1fc7f651503bf1',
};

// ============================================================
// Firebase
// ============================================================
function initFirebase() {
  const app = initializeApp(firebaseConfig);
  return getFirestore(app);
}

async function saveTrack(db, track) {
  const docRef = doc(db, 'tracks', track.id);
  const existing = await getDoc(docRef);
  if (existing.exists()) return false;

  await setDoc(docRef, {
    ...track,
    addedAt: serverTimestamp(),
  });
  return true;
}

// ============================================================
// ccMixter API (no auth required)
// ============================================================
const CCMIXTER_TAGS = [
  'instrumental', 'electronic', 'ambient', 'hip_hop', 'rock',
  'jazz', 'classical', 'folk', 'blues', 'world',
  'pop', 'soul', 'funk', 'reggae', 'metal',
  'lounge', 'chill', 'dance', 'acoustic', 'experimental',
];

function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function fetchCcMixterTracks(tag, limit = 20, offset = 0) {
  const url = `https://ccmixter.org/api/query?f=json&limit=${limit}&offset=${offset}&sort=rank&ord=desc&tags=${tag}&reqtags=audio,mp3`;

  try {
    const raw = await fetchHttps(url);
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`  ccMixter fetch error (${tag}):`, e.message);
    return [];
  }
}

function parseDuration(psString) {
  // Parse "4:35" format to seconds
  if (!psString) return 0;
  const parts = psString.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

function transformCcMixterTrack(item, tag) {
  const mp3File = item.files?.find(f => f.file_nicname === 'mp3');
  if (!mp3File) return null;

  const audioUrl = mp3File.download_url;
  if (!audioUrl) return null;

  const duration = parseDuration(mp3File.file_format_info?.ps);
  const tags = (item.upload_extra?.usertags || tag).split(',').filter(Boolean);
  const genre = tags[0] || tag;

  return {
    id: `ccmixter-${item.upload_id}`,
    title: item.upload_name || 'Sem título',
    artist: item.user_real_name || item.user_name || 'Artista CC',
    artistId: `ccmixter-${item.user_name}`,
    album: 'ccMixter',
    albumId: '',
    duration,
    artwork: `https://picsum.photos/seed/ccm${item.upload_id}/300/300`,
    audioUrl,
    isLocal: false,
    genre: genre.replace(/_/g, ' '),
    license: `${item.license_name || 'Creative Commons'} - ${item.license_url || ''}`,
    uploadedBy: 'ccmixter-import',
    uploadedByName: 'ccMixter Community',
    titleLower: (item.upload_name || '').toLowerCase(),
    source: 'ccmixter',
    sourceUrl: item.file_page_url || '',
  };
}

async function importCcMixter(db) {
  console.log('\n🎧 Importando do ccMixter (sem autenticação)...');
  console.log(`  Tags: ${CCMIXTER_TAGS.join(', ')}\n`);

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const tag of CCMIXTER_TAGS) {
    process.stdout.write(`  🏷️  ${tag.padEnd(15)}`);

    const items = await fetchCcMixterTracks(tag, 25);
    totalFetched += items.length;

    let saved = 0;
    let skipped = 0;

    for (const item of items) {
      const track = transformCcMixterTrack(item, tag);
      if (!track) continue;

      try {
        const wasSaved = await saveTrack(db, track);
        if (wasSaved) {
          saved++;
          totalSaved++;
        } else {
          skipped++;
          totalSkipped++;
        }
      } catch (e) {
        // Silently skip errors
      }
    }

    console.log(`${items.length} encontradas, ${saved} novas, ${skipped} existentes`);

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  return { totalFetched, totalSaved, totalSkipped };
}

// ============================================================
// Jamendo API (requires client_id)
// ============================================================
const JAMENDO_GENRES = [
  'rock', 'pop', 'electronic', 'hiphop', 'jazz',
  'classical', 'ambient', 'metal', 'folk', 'reggae',
  'blues', 'latin', 'country', 'soul', 'punk',
  'indie', 'lounge', 'world', 'soundtrack', 'funk',
];

async function fetchJamendoTracks(tag, limit = 25) {
  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: String(limit),
    include: 'musicinfo',
    tags: tag,
    order: 'popularity_total',
    audioformat: 'mp32',
  });

  try {
    const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.headers?.status !== 'success') return [];
    return data.results || [];
  } catch (e) {
    return [];
  }
}

function transformJamendoTrack(item, genre) {
  if (!item.audio) return null;

  const musicinfo = item.musicinfo || {};
  const tags = musicinfo.tags?.genres || [genre];

  return {
    id: `jamendo-${item.id}`,
    title: item.name || 'Sem título',
    artist: item.artist_name || 'Artista Desconhecido',
    artistId: `jamendo-artist-${item.artist_id}`,
    album: item.album_name || 'Single',
    albumId: item.album_id ? `jamendo-album-${item.album_id}` : '',
    duration: item.duration || 0,
    artwork: item.album_image || `https://picsum.photos/seed/jam${item.id}/300/300`,
    audioUrl: item.audio,
    isLocal: false,
    genre: tags[0] || genre,
    license: `Creative Commons - ${item.license_ccurl || 'CC BY'}`,
    uploadedBy: 'jamendo-import',
    uploadedByName: 'Jamendo Community',
    titleLower: (item.name || '').toLowerCase(),
    source: 'jamendo',
    sourceUrl: item.shareurl || '',
  };
}

async function importJamendo(db) {
  if (!JAMENDO_CLIENT_ID) {
    console.log('\n⏭️  Jamendo: pulando (JAMENDO_CLIENT_ID não definido)');
    console.log('   Para usar: JAMENDO_CLIENT_ID=xxx node scripts/import-music.mjs');
    return { totalFetched: 0, totalSaved: 0, totalSkipped: 0 };
  }

  console.log('\n🎵 Importando do Jamendo...');

  // Test connection
  const test = await fetchJamendoTracks('rock', 1);
  if (test.length === 0) {
    console.log('  ❌ Não foi possível conectar. Verifique seu client_id.');
    return { totalFetched: 0, totalSaved: 0, totalSkipped: 0 };
  }
  console.log('  ✅ Conexão OK!\n');

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const genre of JAMENDO_GENRES) {
    process.stdout.write(`  🏷️  ${genre.padEnd(15)}`);

    const items = await fetchJamendoTracks(genre, 25);
    totalFetched += items.length;

    let saved = 0;
    let skipped = 0;

    for (const item of items) {
      const track = transformJamendoTrack(item, genre);
      if (!track) continue;

      try {
        const wasSaved = await saveTrack(db, track);
        if (wasSaved) {
          saved++;
          totalSaved++;
        } else {
          skipped++;
          totalSkipped++;
        }
      } catch (e) {
        // Silently skip
      }
    }

    console.log(`${items.length} encontradas, ${saved} novas, ${skipped} existentes`);
    await new Promise(r => setTimeout(r, 500));
  }

  return { totalFetched, totalSaved, totalSkipped };
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🎵 ════════════════════════════════════════');
  console.log('   Spotfly - Copyleft Music Importer');
  console.log('   ════════════════════════════════════════\n');

  const db = initFirebase();
  console.log('✅ Firebase inicializado (projeto: spotfly-app)');

  // Import from ccMixter (no auth needed)
  const ccResults = await importCcMixter(db);

  // Import from Jamendo (optional, needs client_id)
  const jamResults = await importJamendo(db);

  // Summary
  const totalSaved = ccResults.totalSaved + jamResults.totalSaved;
  const totalFetched = ccResults.totalFetched + jamResults.totalFetched;
  const totalSkipped = ccResults.totalSkipped + jamResults.totalSkipped;

  console.log('\n════════════════════════════════════════');
  console.log('📊 Resultado Final:');
  console.log(`   Total buscadas:    ${totalFetched}`);
  console.log(`   Novas importadas:  ${totalSaved}`);
  console.log(`   Já existentes:     ${totalSkipped}`);
  console.log('════════════════════════════════════════');

  if (totalSaved > 0) {
    console.log(`\n🎉 ${totalSaved} novas músicas copyleft adicionadas ao Spotfly!`);
  } else if (totalSkipped > 0) {
    console.log('\n✅ Todas as músicas já estavam importadas.');
  } else {
    console.log('\n⚠️  Nenhuma música foi importada.');
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
