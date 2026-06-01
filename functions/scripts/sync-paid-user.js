/**
 * One-off: sync a user's Stripe subscription → Firestore (active / Client).
 * Usage: node scripts/sync-paid-user.js milan
 */
require('../load-env');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const Stripe = require('stripe');
const { readStripeSecretKey } = require('../get-secret');
const { getPlanById, getPlanByPriceId } = require('../stripe-plans');

const search = (process.argv[2] || '').toLowerCase().trim();
if (!search) {
  console.error('Usage: node scripts/sync-paid-user.js <name-or-email-fragment>');
  process.exit(1);
}

try {
  initializeApp({ credential: applicationDefault() });
} catch (_) {
  initializeApp();
}

const db = getFirestore();
const stripe = new Stripe(readStripeSecretKey());

async function syncSubscriptionToUser(userRef, subscription, planMeta = {}) {
  const { FieldValue } = require('firebase-admin/firestore');
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  const payload = {
    stripeSubscriptionId: subscription.id,
    stripeSubscriptionStatus: subscription.status,
    stripeCustomerId: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (isActive) {
    payload.isClient = true;
    payload.stripePaymentIntentClientSecret = FieldValue.delete();
    payload.subscriptionCancelled = false;
    if (periodEnd) payload.subscriptionRenewAt = periodEnd;
    if (planMeta.planId) payload.subscriptionPlan = planMeta.planId;
    if (planMeta.amount != null) payload.subscriptionAmount = planMeta.amount;
    if (planMeta.currency) payload.subscriptionCurrency = planMeta.currency;
  } else if (subscription.status === 'incomplete' || subscription.status === 'past_due') {
    payload.isClient = true;
  }
  await userRef.update(payload);
  return payload;
}

async function findStripeSubscriptionForUser(user) {
  if (user.stripeSubscriptionId) {
    return stripe.subscriptions.retrieve(String(user.stripeSubscriptionId), {
      expand: ['latest_invoice.payment_intent'],
    });
  }
  if (user.stripeCustomerId) {
    const subs = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'all',
      limit: 10,
    });
    const paid = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (paid) return paid;
    const incomplete = subs.data.find((s) => s.status === 'incomplete');
    if (incomplete) {
      return stripe.subscriptions.retrieve(incomplete.id, {
        expand: ['latest_invoice.payment_intent'],
      });
    }
  }
  if (user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 5 });
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 10 });
      const paid = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');
      if (paid) return paid;
    }
  }
  return null;
}

async function main() {
  const snap = await db.collection('users').get();
  const matches = snap.docs.filter((d) => {
    const u = d.data();
    const hay = `${u.name || ''} ${u.email || ''}`.toLowerCase();
    return hay.includes(search);
  });

  if (!matches.length) {
    console.error('No user found matching:', search);
    process.exit(1);
  }

  for (const doc of matches) {
    const user = doc.data();
    console.log('\n---', doc.id, user.name, user.email, '---');
    console.log('Before:', {
      isClient: user.isClient,
      stripeSubscriptionStatus: user.stripeSubscriptionStatus,
      stripeSubscriptionId: user.stripeSubscriptionId,
    });

    let subscription = await findStripeSubscriptionForUser(user);
    if (!subscription) {
      console.error('No Stripe subscription found for this user.');
      continue;
    }

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      const invoice = subscription.latest_invoice;
      const pi = invoice && typeof invoice === 'object' ? invoice.payment_intent : null;
      if (
        pi
        && typeof pi === 'object'
        && ['succeeded', 'processing', 'requires_capture'].includes(pi.status)
      ) {
        subscription = { ...subscription, status: 'active' };
      }
    }

    const planId = subscription.metadata?.planId || user.subscriptionPlan;
    const plan = getPlanById(planId)
      || getPlanByPriceId(subscription.metadata?.priceId || user.stripePriceId);

    const payload = await syncSubscriptionToUser(doc.ref, subscription, {
      planId: plan?.id || planId,
      amount: plan?.amount ?? user.subscriptionAmount,
      currency: plan?.currency ?? user.subscriptionCurrency,
    });

    console.log('After:', {
      isClient: payload.isClient,
      stripeSubscriptionStatus: payload.stripeSubscriptionStatus,
      stripeSubscriptionId: payload.stripeSubscriptionId,
    });
    console.log('Synced ✓');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
