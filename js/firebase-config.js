import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBr5Za7TxFaTGojgPMtT8nuelsw7WWbLjs',
  authDomain: 'rense-da4f9.firebaseapp.com',
  projectId: 'rense-da4f9',
  storageBucket: 'rense-da4f9.firebasestorage.app',
  messagingSenderId: '371409472255',
  appId: '1:371409472255:web:0982c9d4527c0178e71aca',
  measurementId: 'G-9FE0E66J9P'
};

const app = initializeApp(firebaseConfig);

export { firebaseConfig, app };

/** Keep users signed in across browser and home-screen app sessions. */
let auth;
try {
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  });
} catch (err) {
  if (err?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw err;
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);

export let analytics = null;
isSupported().then((supported) => {
  if (supported) analytics = getAnalytics(app);
});
