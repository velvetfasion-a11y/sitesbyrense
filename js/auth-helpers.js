import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { sendEmailVerification, applyActionCode } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { db, auth } from '../firebase-config.js';

/** Emails that automatically get admin access. Add yours here or set role: 'admin' in Firestore. */
export const ADMIN_EMAILS = ['admin@rense.se'];

export const VERIFICATION_SENDER = 'verification@rense.se';

export function getAuthContinueUrl() {
  return new URL('login.html', window.location.href).href;
}

export async function reloadCurrentUser() {
  const user = auth.currentUser;
  if (user) await user.reload();
  return auth.currentUser;
}

export async function sendUserVerificationEmail(user) {
  const settings = {
    url: getAuthContinueUrl(),
    handleCodeInApp: false
  };

  try {
    await sendEmailVerification(user, settings);
  } catch (err) {
    if (err.code === 'auth/invalid-continue-uri' || err.code === 'auth/unauthorized-continue-uri') {
      await sendEmailVerification(user);
      return;
    }
    throw err;
  }
}

export async function completeEmailVerificationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (mode !== 'verifyEmail' || !oobCode) return null;

  await applyActionCode(auth, oobCode);
  window.history.replaceState({}, '', window.location.pathname);
  return reloadCurrentUser();
}

export async function isEmailVerified(user) {
  if (!user) return false;
  if (await isAdminUser(user)) return true;
  await user.reload();
  return !!auth.currentUser?.emailVerified;
}

export async function isAdminUser(user) {
  if (!user) return false;
  if (ADMIN_EMAILS.includes(user.email)) return true;

  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() && snap.data().role === 'admin';
}
