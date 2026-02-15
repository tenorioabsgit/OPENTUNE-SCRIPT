/**
 * Spotfly - Jamendo Music Importer
 *
 * Fetches copyleft/Creative Commons music from Jamendo API
 * and saves track metadata to Firebase Firestore.
 *
 * Usage:
 *   node scripts/import-jamendo.mjs
 *
 * Environment:
 *   JAMENDO_CLIENT_ID - Your Jamendo API client_id (required)
 *                       Register free at https://developer.jamendo.com/v3.0
 *
 * The script fetches popular tracks across multiple genres
 * and saves them to the 'tracks' Firestore collection.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// ============================================================
// Configuration
// ============================================================
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '';
const JAMENDO_API = 'https://api.jamendo.com/v3.0';

const firebaseConfig = {
  apiKey: 'AIzaSyAlcChuWLkw9-zuf_GAkvU3drg6Hz1NQhc',
  authDomain: 'spotfly-app.firebaseapp.com',
  projectId: 'spotfly-app',
  storageBucket: 'spotfly-app.firebasestorage.app',
  messagingSenderId: '215760117220',
  appId: '1:215760117220:web:62871c1c1fc7f651503bf1',
};

// Genres to fetch (Jamendo tags)
const GENRES = [
  'rock', 'pop', 'electronic', 'hiphop', 'jazz',
  'classical', 'ambient', 'metal', 'folk', 'reggae',
  'blues', 'latin', 'country', 'soul', 'punk',
  'indie', 'lounge', 'world', 'soundtrack', 'funk',
];

const TRACKS_PER_GENRE = 25; // 25 tracks × 20 genres = 500 tracks max

// ============================================================
// Jamendo API
// ============================================================
async function fetchJamendoTracks(tag, limit = TRACKS_PER_GENRE, offset = 0) {
  const params = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    limit: String(limit),
    offset: String(offset),
    include: 'musicinfo',
    tags: tag,
    order: 'popularity_total',
    audioformat: 'mp32',
  });

  const url = `${JAMENDO_API}/tracks/?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`  API error for "${tag}": ${res.status} - ${text.substring(0, 200)}`);
      return [];
    }
    const data = await res.json();

    if (data.headers?.status === 'error') {
      console.error(`  Jamendo error: ${data.headers.error_message}`);
      return [];
    }

    return data.results || [];
  } catch (e) {
    console.error(`  Fetch error for "${tag}":`, e.message);
    return [];
  }
}

// ============================================================
// Firebase
// ============================================================
function initFirebase() {
  const app = initializeApp(firebaseConfig);
  return getFirestore(app);
}

async function saveTrack(db, track) {
  const docRef = doc(db, 'tracks', track.id);

  // Skip if already exists
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    return false;
  }

  await setDoc(docRef, {
    ...track,
    addedAt: serverTimestamp(),
  });
  return true;
}

// ============================================================
// Transform Jamendo track → Spotfly track
// ============================================================
function transformTrack(jamTrack, genre) {
  const musicinfo = jamTrack.musicinfo || {};
  const tags = musicinfo.tags || {};
  const genres = tags.genres || [genre];

  return {
    id: `jamendo-${jamTrack.id}`,
    title: jamTrack.name || 'Sem título',
    artist: jamTrack.artist_name || 'Artista Desconhecido',
    artistId: `jamendo-artist-${jamTrack.artist_id}`,
    album: jamTrack.album_name || 'Single',
    albumId: jamTrack.album_id ? `jamendo-album-${jamTrack.album_id}` : '',
    duration: jamTrack.duration || 0,
    artwork: jamTrack.album_image || jamTrack.image || `https://picsum.photos/seed/${jamTrack.id}/300/300`,
    audioUrl: jamTrack.audio || '',
    isLocal: false,
    genre: genres[0] || genre,
    license: `Creative Commons - ${jamTrack.license_ccurl || 'CC BY'}`,
    uploadedBy: 'jamendo-import',
    uploadedByName: 'Jamendo Community',
    titleLower: (jamTrack.name || '').toLowerCase(),
    source: 'jamendo',
    jamendoId: String(jamTrack.id),
    jamendoUrl: jamTrack.shareurl || '',
  };
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🎵 Spotfly - Jamendo Music Importer');
  console.log('====================================\n');

  if (!JAMENDO_CLIENT_ID) {
    console.error('❌ JAMENDO_CLIENT_ID não definido!\n');
    console.log('Para obter um client_id gratuito:');
    console.log('1. Acesse https://developer.jamendo.com/v3.0');
    console.log('2. Crie uma conta gratuita');
    console.log('3. Registre um app para obter o client_id');
    console.log('4. Execute: JAMENDO_CLIENT_ID=seu_id node scripts/import-jamendo.mjs\n');
    process.exit(1);
  }

  // Test API connection first
  console.log('🔍 Testando conexão com Jamendo API...');
  const testTracks = await fetchJamendoTracks('rock', 1);
  if (testTracks.length === 0) {
    console.error('❌ Não foi possível conectar à Jamendo API. Verifique seu client_id.');
    process.exit(1);
  }
  console.log('✅ Conexão OK!\n');

  const db = initFirebase();
  console.log('✅ Firebase inicializado\n');

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const genre of GENRES) {
    console.log(`\n🎸 Buscando "${genre}"...`);

    const tracks = await fetchJamendoTracks(genre, TRACKS_PER_GENRE);
    console.log(`  Encontradas: ${tracks.length} faixas`);
    totalFetched += tracks.length;

    for (const jamTrack of tracks) {
      // Skip tracks without audio URL
      if (!jamTrack.audio) {
        continue;
      }

      const track = transformTrack(jamTrack, genre);

      try {
        const saved = await saveTrack(db, track);
        if (saved) {
          totalSaved++;
          process.stdout.write('  ✅');
        } else {
          totalSkipped++;
          process.stdout.write('  ⏭️');
        }
      } catch (e) {
        process.stdout.write('  ❌');
        console.error(`\n  Error saving "${track.title}":`, e.message);
      }
    }
    console.log('');

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n====================================');
  console.log(`📊 Resultado:`);
  console.log(`  Total buscadas:  ${totalFetched}`);
  console.log(`  Novas salvas:    ${totalSaved}`);
  console.log(`  Já existentes:   ${totalSkipped}`);
  console.log(`  Gêneros:         ${GENRES.length}`);
  console.log('====================================');
  console.log('\n🎉 Importação concluída! As músicas já estão disponíveis no Spotfly.');

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
