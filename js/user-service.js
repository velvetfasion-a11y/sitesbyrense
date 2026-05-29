import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, updateDoc, deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function ensureUserProfile(uid, { name, email, phone } = {}) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const payload = {};
  if (name) payload.name = name;
  if (email) payload.email = email;
  if (phone != null) payload.phone = phone;
  if (!snap.exists()) {
    payload.createdAt = new Date().toISOString();
  } else if (snap.data().deleted === true) {
    payload.deleted = deleteField();
    payload.deletedAt = deleteField();
  }
  if (!Object.keys(payload).length) return;
  await setDoc(ref, payload, { merge: true });
}

export async function deleteConversationData(uid) {
  const messagesRef = collection(db, 'conversations', uid, 'messages');
  const messagesSnap = await getDocs(messagesRef);

  let batch = writeBatch(db);
  let ops = 0;

  async function commitBatch() {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  }

  for (const d of messagesSnap.docs) {
    batch.delete(d.ref);
    ops++;
    if (ops >= 450) await commitBatch();
  }

  batch.delete(doc(db, 'conversations', uid));
  ops++;
  await commitBatch();
}

export async function deleteUserData(uid) {
  try {
    await updateDoc(doc(db, 'conversations', uid), { accountDeleted: true });
  } catch (_) {
    // conversation may not exist
  }
  await deleteConversationData(uid);
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (err) {
    console.warn('Could not delete user profile:', err);
  }
}
