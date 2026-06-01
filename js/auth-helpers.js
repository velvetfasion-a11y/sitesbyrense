import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  sendEmailVerification,
  applyActionCode,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { db, auth } from '../firebase-config.js';

/** Emails that automatically get admin access. Add yours here or set role: 'admin' in Firestore. */
export const ADMIN_EMAILS = ['admin@rense.se'];

export const VERIFICATION_SENDER = 'verification@rense.se';

const PENDING_SIGNUP_KEY = 'rense_pending_signup';
const PENDING_VERIFY_KEY = 'pendingSignupVerification';
const PENDING_SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;

export function getAuthContinueUrl() {
  const url = new URL('login.html', window.location.href);
  url.searchParams.set('tab', 'signup');
  return url.href;
}

export function savePendingSignup({ name, email, phone, password }) {
  sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
    name: name || '',
    email: email || '',
    phone: phone || '',
    password: password || '',
    savedAt: Date.now(),
  }));
  setPendingSignupVerification(true);
}

export function getPendingSignup() {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - (data.savedAt || 0) > PENDING_SIGNUP_TTL_MS) {
      clearPendingSignup();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingSignup() {
  sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  sessionStorage.removeItem(PENDING_VERIFY_KEY);
}

export function setPendingSignupVerification(on) {
  if (on) sessionStorage.setItem(PENDING_VERIFY_KEY, 'true');
  else sessionStorage.removeItem(PENDING_VERIFY_KEY);
}

export function isPendingSignupVerification() {
  return sessionStorage.getItem(PENDING_VERIFY_KEY) === 'true';
}

export async function reloadCurrentUser() {
  const user = auth.currentUser;
  if (user) await user.reload();
  return auth.currentUser;
}

export async function sendUserVerificationEmail(user) {
  const settings = {
    url: getAuthContinueUrl(),
    handleCodeInApp: true,
  };

  try {
    await sendEmailVerification(user, settings);
  } catch (err) {
    if (err.code === 'auth/invalid-continue-uri' || err.code === 'auth/unauthorized-continue-uri') {
      await sendEmailVerification(user, { handleCodeInApp: true });
      return;
    }
    throw err;
  }
}

async function signInPendingUserAfterVerification() {
  const pending = getPendingSignup();
  if (!pending?.email || !pending?.password) return null;
  const cred = await signInWithEmailAndPassword(auth, pending.email, pending.password);
  await cred.user.reload();
  return auth.currentUser;
}

export async function completeEmailVerificationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const oobCode = params.get('oobCode');
  if (mode !== 'verifyEmail' || !oobCode) return null;

  await applyActionCode(auth, oobCode);
  window.history.replaceState({}, '', `${window.location.pathname}?tab=signup`);

  let user = auth.currentUser;
  if (user) {
    await user.reload();
    user = auth.currentUser;
  }

  if (!user?.emailVerified) {
    user = await signInPendingUserAfterVerification();
  }

  return user;
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
