import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export let analytics = null;
isSupported().then((supported) => {
  if (supported) analytics = getAnalytics(app);
});
