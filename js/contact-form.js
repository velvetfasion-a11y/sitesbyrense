import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function validateContactFields(fields) {
  if (!fields.name || !fields.email) {
    return 'Please enter your name and email.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return 'Please enter a valid email address.';
  }
  if (!fields.message) {
    return 'Please tell us about your website.';
  }
  return null;
}

export async function saveContactInquiry(fields) {
  await addDoc(collection(db, 'inquiries'), {
    name: fields.name.slice(0, 100),
    email: fields.email.slice(0, 200),
    phone: (fields.phone || '').slice(0, 30),
    message: fields.message.slice(0, 5000),
    status: 'new',
    createdAt: serverTimestamp()
  });
}
