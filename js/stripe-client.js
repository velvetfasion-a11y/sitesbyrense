import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { functions, functionsReady } from './firebase-functions.js';

export async function createSubscription({ planId, priceId } = {}) {
  await functionsReady;
  const callable = httpsCallable(functions, 'createSubscription');
  const { data } = await callable({ planId, priceId });
  return data;
}

export async function assignStripeSubscription(uid, planId, priceId = null) {
  await functionsReady;
  const callable = httpsCallable(functions, 'assignStripeSubscription');
  const { data } = await callable({ uid, planId, priceId });
  return data;
}
