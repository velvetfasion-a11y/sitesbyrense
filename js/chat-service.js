import { db } from '../firebase-config.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, getDoc,
  onSnapshot, query, orderBy, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Today ${time}` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + time;
}

export async function ensureConversation(clientUid, { name, email }) {
  const ref = doc(db, 'conversations', clientUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      clientUid,
      clientName: name || 'Client',
      clientEmail: email || '',
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      unreadByAdmin: 0,
      unreadByClient: 0
    });
  } else {
    await updateDoc(ref, {
      clientName: name || snap.data().clientName || 'Client',
      clientEmail: email || snap.data().clientEmail || ''
    });
  }
}

export async function sendChatMessage(clientUid, { text, senderId, senderRole, senderName, clientName, clientEmail }) {
  const trimmed = text.trim();
  if (!trimmed) return;

  await ensureConversation(clientUid, { name: clientName || senderName, email: clientEmail });

  await addDoc(collection(db, 'conversations', clientUid, 'messages'), {
    text: trimmed,
    senderId,
    senderRole,
    senderName,
    createdAt: serverTimestamp()
  });

  const updates = {
    lastMessage: trimmed,
    lastMessageAt: serverTimestamp(),
    clientName: clientName || senderName || 'Client',
    clientEmail: clientEmail || ''
  };
  updates[senderRole === 'client' ? 'unreadByAdmin' : 'unreadByClient'] = increment(1);
  await updateDoc(doc(db, 'conversations', clientUid), updates);
}

export function subscribeToMessages(clientUid, callback) {
  const q = query(
    collection(db, 'conversations', clientUid, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, callback, (err) => {
    console.error('Chat messages error:', err);
    callback({ docs: [], empty: true, error: err });
  });
}

export function subscribeToConversation(clientUid, callback) {
  return onSnapshot(doc(db, 'conversations', clientUid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function subscribeToConversations(callback) {
  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, callback, (err) => {
    console.error('Conversations error:', err);
    callback({ docs: [], empty: true, error: err });
  });
}

export async function markConversationRead(clientUid, role) {
  const field = role === 'admin' ? 'unreadByAdmin' : 'unreadByClient';
  const ref = doc(db, 'conversations', clientUid);
  const snap = await getDoc(ref);
  if (snap.exists()) await updateDoc(ref, { [field]: 0 });
}

export function renderClientMessages(container, messages, clientName) {
  if (!messages.length) {
    container.innerHTML = '<div class="chat-empty" style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--gray);font-style:italic;font-size:0.85rem;padding:2rem;">No messages yet. Send a message to get started.</div>';
    return;
  }
  container.innerHTML = messages.map((m) => {
    const isMe = m.senderRole === 'client';
    const sender = isMe ? '' : `<div class="msg-sender">${escapeHtml(m.senderName || 'Rensé')}</div>`;
    const time = formatMessageTime(m.createdAt);
    if (isMe) {
      return `<div class="msg-wrap me"><div class="msg-bubble me">${escapeHtml(m.text)}</div><div class="msg-time" style="text-align:right;">${time}</div></div>`;
    }
    return `<div class="msg-wrap">${sender}<div class="msg-bubble them">${escapeHtml(m.text)}</div><div class="msg-time">${time}</div></div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

export function renderAdminMessages(container, messages) {
  if (!messages.length) {
    container.innerHTML = '<div class="chat-empty">No messages yet. Say hello to start the conversation.</div>';
    return;
  }
  container.innerHTML = messages.map((m) => {
    const isAdmin = m.senderRole === 'admin';
    const time = formatMessageTime(m.createdAt);
    const sender = `<div class="msg-sender" style="${isAdmin ? 'text-align:right;' : ''}">${escapeHtml(m.senderName || (isAdmin ? 'Rensé' : 'Client'))}</div>`;
    if (isAdmin) {
      return `<div style="align-self:flex-end;"><div class="msg-bubble me">${sender}${escapeHtml(m.text)}</div><div class="msg-time" style="text-align:right;">${time}</div></div>`;
    }
    return `<div><div class="msg-bubble them">${sender}${escapeHtml(m.text)}</div><div class="msg-time">${time}</div></div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}
