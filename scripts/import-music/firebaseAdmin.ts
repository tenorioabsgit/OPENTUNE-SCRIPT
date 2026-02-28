import * as admin from 'firebase-admin';
import * as path from 'path';

const STORAGE_BUCKET = 'opentune-sbs.firebasestorage.app';

export interface FirebaseServices {
  db: admin.firestore.Firestore;
  bucket: admin.storage.Bucket;
}

export function initFirebaseAdmin(): FirebaseServices {
  if (admin.apps.length > 0) {
    return { db: admin.firestore(), bucket: admin.storage().bucket() };
  }

  // In dry run mode, don't require valid credentials
  if (process.env.DRY_RUN === '1') {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'opentune-sbs',
        storageBucket: STORAGE_BUCKET,
      });
    } catch {
      // Firebase in dry mode (no-op)
    }
    return {
      db: {} as admin.firestore.Firestore,
      bucket: {} as admin.storage.Bucket,
    };
  }

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountEnv) {
    // Decode from base64 if needed
    let serviceAccountJson = serviceAccountEnv;
    try {
      // Check if it's base64 encoded
      if (!/[{}"]/.test(serviceAccountJson)) {
        serviceAccountJson = Buffer.from(serviceAccountEnv, 'base64').toString('utf-8');
      }
    } catch (e) {
      // If decode fails, assume it's already JSON
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    });
  } else {
    const serviceAccount = require(
      path.resolve(__dirname, '..', 'serviceAccountKey.json')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    });
  }

  return { db: admin.firestore(), bucket: admin.storage().bucket() };
}
