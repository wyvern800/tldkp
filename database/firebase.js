// firebase.js
import admin from 'firebase-admin';
import { config } from 'dotenv';

config();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_NAME
});

const db = admin.firestore();

export { db, admin };
