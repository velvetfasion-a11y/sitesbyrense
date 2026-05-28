import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase-config.js';

/** Emails that automatically get admin access. Add yours here or set role: 'admin' in Firestore. */
export const ADMIN_EMAILS = ['admin@rense.se'];

export async function isAdminUser(user) {
  if (!user) return false;
  if (ADMIN_EMAILS.includes(user.email)) return true;

  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() && snap.data().role === 'admin';
}
