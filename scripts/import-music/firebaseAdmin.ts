import * as admin from 'firebase-admin';
import * as path from 'path';

export function initFirebaseAdmin(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  // In dry run mode, don't require valid credentials
  if (process.env.DRY_RUN === '1') {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'spotfly-app-test',
      });
    } catch {
      // Firestore in dry mode (no-op)
    }
    // Return a mock Firestore for dry-run
    return {} as admin.firestore.Firestore;
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
    });
  } else {
    const serviceAccount = require(
      path.resolve(__dirname, '..', 'serviceAccountKey.json')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
}
