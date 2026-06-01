require('./load-env');

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const Stripe = require('stripe');
const { CALLABLE_CORS, corsAllowAll } = require('./cors-config');
const { readStripeSecretKey, readStripeWebhookSecret } = require('./get-secret');
const {
  DEFAULT_STRIPE_PRICE_ID,
  ALLOWED_PRICE_IDS,
  getPlanById,
  getPlanByPriceId,
} = require('./stripe-plans');

const REGION = 'europe-west1';
const ADMIN_EMAILS = ['admin@rense.se', 'velvetfasion@gmail.com'];

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    try {
      stripeClient = new Stripe(readStripeSecretKey());
    } catch (error) {
      console.error('getStripe error:', error.message || error);
      throw error;
    }
  }
  return stripeClient;
}

function handleCallableError(name, error) {
  console.error(`${name} error:`, error);
  if (error instanceof HttpsError) throw error;
  const message = error?.message || 'Internal error';
  if (/Missing STRIPE_SECRET_KEY|must start with sk_/i.test(message)) {
    throw new HttpsError('failed-precondition', message);
  }
  throw new HttpsError('internal', message);
}

async function assertAdmin(db, uid, email) {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return;
  const snap = await db.collection('users').doc(uid).get();
  if (snap.exists && snap.data()?.role === 'admin') return;
  throw new HttpsError('permission-denied', 'Admin only');
}

function pickPriceId(planId, explicitPriceId) {
  if (explicitPriceId) return explicitPriceId;
  const plan = getPlanById(planId);
  if (plan?.stripePriceId) return plan.stripePriceId;
  return DEFAULT_STRIPE_PRICE_ID;
}

function assertAllowedPriceId(resolvedPriceId) {
  if (!ALLOWED_PRICE_IDS.has(resolvedPriceId)) {
    throw new HttpsError('invalid-argument', 'Price ID is not allowed for this site');
  }
}

async function resolvePriceId(stripe, priceId) {
  if (!priceId) throw new HttpsError('invalid-argument', 'priceId is required');
  if (String(priceId).startsWith('price_')) return priceId;
  if (String(priceId).startsWith('prod_')) {
    const product = await stripe.products.retrieve(priceId, { expand: ['default_price'] });
    const defaultPrice = product.default_price;
    if (typeof defaultPrice === 'string') return defaultPrice;
    if (defaultPrice?.id) return defaultPrice.id;
    const prices = await stripe.prices.list({ product: priceId, active: true, limit: 1 });
    if (prices.data[0]?.id) return prices.data[0].id;
  }
  throw new HttpsError('invalid-argument', 'Could not resolve Stripe price ID');
}

async function findUserByStripeRefs(db, { customerId, subscriptionId }) {
  if (subscriptionId) {
    const q = await db.collection('users').where('stripeSubscriptionId', '==', subscriptionId).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  if (customerId) {
    const q = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  return null;
}

async function findBestSubscriptionForUser(stripe, user) {
  const expand = { expand: ['latest_invoice.payment_intent'] };

  if (user.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(String(user.stripeSubscriptionId), expand);
      if (sub.status === 'active' || sub.status === 'trialing') return sub;
    } catch (_) {
      /* stored id may be stale */
    }
  }

  const customerIds = [];
  if (user.stripeCustomerId) customerIds.push(user.stripeCustomerId);
  if (user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 5 });
    for (const c of customers.data) {
      if (!customerIds.includes(c.id)) customerIds.push(c.id);
    }
  }

  for (const customerId of customerIds) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    const active = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (active) {
      return stripe.subscriptions.retrieve(active.id, expand);
    }
  }

  if (user.stripeSubscriptionId) {
    return stripe.subscriptions.retrieve(String(user.stripeSubscriptionId), expand);
  }
  return null;
}

async function applySubscriptionSync(userRef, user, subscription) {
  let sub = subscription;
  if (sub.status !== 'active' && sub.status !== 'trialing') {
    const invoice = sub.latest_invoice;
    const paymentIntent = invoice && typeof invoice === 'object' ? invoice.payment_intent : null;
    if (
      paymentIntent
      && typeof paymentIntent === 'object'
      && ['succeeded', 'processing', 'requires_capture'].includes(paymentIntent.status)
    ) {
      sub = { ...sub, status: 'active' };
    }
  }

  const planId = sub.metadata?.planId || user.subscriptionPlan;
  const plan = getPlanById(planId)
    || getPlanByPriceId(sub.metadata?.priceId || user.stripePriceId);

  await syncSubscriptionToUser(userRef, sub, {
    planId: plan?.id || planId,
    amount: plan?.amount ?? user.subscriptionAmount,
    currency: plan?.currency ?? user.subscriptionCurrency,
  });

  const paid = sub.status === 'active' || sub.status === 'trialing';
  return { status: sub.status, paid, subscriptionId: sub.id };
}

async function syncSubscriptionToUser(userRef, subscription, planMeta = {}) {
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
}

async function extractSubscriptionClientSecret(stripe, subscription) {
  let invoice = subscription.latest_invoice;
  if (typeof invoice === 'string') {
    invoice = await stripe.invoices.retrieve(invoice, {
      expand: ['payment_intent', 'confirmation_secret'],
    });
  }

  if (invoice?.confirmation_secret?.client_secret) {
    return invoice.confirmation_secret.client_secret;
  }

  let paymentIntent = invoice?.payment_intent;
  if (typeof paymentIntent === 'string') {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
  }
  if (paymentIntent?.client_secret) return paymentIntent.client_secret;

  let setupIntent = subscription.pending_setup_intent;
  if (typeof setupIntent === 'string') {
    setupIntent = await stripe.setupIntents.retrieve(setupIntent);
  }
  if (setupIntent?.client_secret) return setupIntent.client_secret;

  return null;
}

async function createSubscriptionForUser(db, uid, { planId, priceId }) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
  const user = userSnap.data();

  const stripe = getStripe();
  const resolvedPriceId = await resolvePriceId(stripe, pickPriceId(planId, priceId));
  assertAllowedPriceId(resolvedPriceId);

  const plan = getPlanByPriceId(resolvedPriceId) || getPlanById(planId);
  const effectivePlanId = plan?.id || planId || user.subscriptionPlan || '';

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.name || undefined,
      metadata: { firebaseUid: uid },
    });
    customerId = customer.id;
  }

  if (user.stripeSubscriptionId) {
    try {
      const existing = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      if (existing.status !== 'canceled' && existing.status !== 'incomplete_expired') {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      }
    } catch (err) {
      console.warn('Could not cancel previous subscription:', err.message);
    }
  }

  let subscription;
  try {
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: resolvedPriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: [
        'latest_invoice.payment_intent',
        'latest_invoice.confirmation_secret',
        'pending_setup_intent',
      ],
      metadata: {
        firebaseUid: uid,
        planId: effectivePlanId,
        priceId: resolvedPriceId,
      },
    });
  } catch (err) {
    console.error('Stripe subscription create failed:', err);
    throw new HttpsError('internal', err.message || 'Stripe could not create the subscription');
  }

  const clientSecret = await extractSubscriptionClientSecret(stripe, subscription);
  if (!clientSecret) {
    throw new HttpsError(
      'internal',
      'Stripe did not return a payment client secret. Check the price is active in Stripe Dashboard.'
    );
  }

  await userRef.update({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePaymentIntentClientSecret: clientSecret,
    stripeSubscriptionStatus: subscription.status,
    stripePriceId: resolvedPriceId,
    isClient: true,
    subscriptionPlan: effectivePlanId,
    subscriptionAmount: plan?.amount ?? user.subscriptionAmount ?? null,
    subscriptionCurrency: plan?.currency ?? user.subscriptionCurrency ?? null,
    subscriptionCancelled: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    subscriptionId: subscription.id,
    clientSecret,
    status: subscription.status,
    priceId: resolvedPriceId,
    planId: effectivePlanId,
  };
}

function createAssignStripeSubscription(db) {
  return onCall(
    { region: REGION, cors: CALLABLE_CORS, invoker: 'public' },
    async (request) => {
      try {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
        await assertAdmin(db, request.auth.uid, request.auth.token.email || '');

        const { uid, planId, priceId } = request.data || {};
        if (!uid) throw new HttpsError('invalid-argument', 'uid is required');
        if (!planId && !priceId) {
          throw new HttpsError('invalid-argument', 'planId or priceId is required');
        }

        const userSnap = await db.collection('users').doc(uid).get();
        if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');
        if (userSnap.data()?.isClient !== true) {
          throw new HttpsError('failed-precondition', 'Enable client status before changing billing');
        }

        return await createSubscriptionForUser(db, uid, { planId, priceId });
      } catch (error) {
        handleCallableError('assignStripeSubscription', error);
      }
    }
  );
}

function createCreateSubscription(db) {
  return onCall(
    { region: REGION, cors: CALLABLE_CORS, invoker: 'public' },
    async (request) => {
      try {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

        const { planId, priceId } = request.data || {};
        if (!priceId && !planId) {
          throw new HttpsError('invalid-argument', 'priceId is required');
        }

        return await createSubscriptionForUser(db, request.auth.uid, { planId, priceId });
      } catch (error) {
        handleCallableError('createSubscription', error);
      }
    }
  );
}

async function confirmSubscriptionForUser(db, uid) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');

  const user = userSnap.data();
  const stripe = getStripe();
  const subscription = await findBestSubscriptionForUser(stripe, user);
  if (!subscription) {
    throw new HttpsError('failed-precondition', 'No subscription to confirm');
  }

  return applySubscriptionSync(userRef, user, subscription);
}

function createConfirmSubscriptionPayment(db) {
  return onCall(
    { region: REGION, cors: CALLABLE_CORS, invoker: 'public' },
    async (request) => {
      try {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
        return await confirmSubscriptionForUser(db, request.auth.uid);
      } catch (error) {
        handleCallableError('confirmSubscriptionPayment', error);
      }
    }
  );
}

function createSyncUserSubscriptionFromStripe(db) {
  return onCall(
    { region: REGION, cors: CALLABLE_CORS, invoker: 'public' },
    async (request) => {
      try {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
        await assertAdmin(db, request.auth.uid, request.auth.token.email || '');

        const { uid } = request.data || {};
        if (!uid) throw new HttpsError('invalid-argument', 'uid is required');

        return await confirmSubscriptionForUser(db, uid);
      } catch (error) {
        handleCallableError('syncUserSubscriptionFromStripe', error);
      }
    }
  );
}

function createStripeWebhook(db) {
  return onRequest(
    { region: REGION },
    (req, res) => {
      corsAllowAll(req, res, async () => {
        if (req.method === 'OPTIONS') {
          res.status(204).send('');
          return;
        }
        if (req.method !== 'POST') {
          res.status(405).send('Method not allowed');
          return;
        }

        let stripe;
        try {
          stripe = getStripe();
        } catch (error) {
          console.error('stripeWebhook error (Stripe init):', error);
          res.status(500).send('Stripe is not configured');
          return;
        }

        const webhookSecret = readStripeWebhookSecret();
        const sig = req.headers['stripe-signature'];
        let event;

        try {
          if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
          } else {
            event = JSON.parse(req.rawBody.toString('utf8'));
            console.warn('stripeWebhook: STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
          }
        } catch (err) {
          console.error('Webhook signature verification failed:', err);
          res.status(400).send(`Webhook Error: ${err.message}`);
          return;
        }

        try {
          switch (event.type) {
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            if (!subscriptionId) break;
            const subscription = await stripe.subscriptions.retrieve(String(subscriptionId));
            const userDoc = await findUserByStripeRefs(db, {
              customerId: invoice.customer,
              subscriptionId: subscription.id,
            });
            if (!userDoc) break;
            const planId = subscription.metadata?.planId;
            const plan = getPlanById(planId) || getPlanByPriceId(subscription.metadata?.priceId);
            await syncSubscriptionToUser(userDoc.ref, subscription, {
              planId: plan?.id || planId,
              amount: plan?.amount,
              currency: plan?.currency,
            });
            break;
          }
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const userDoc = await findUserByStripeRefs(db, {
              customerId: subscription.customer,
              subscriptionId: subscription.id,
            });
            if (!userDoc) break;
            if (subscription.status === 'canceled') {
              await userDoc.ref.update({
                stripeSubscriptionStatus: subscription.status,
                subscriptionCancelled: true,
                updatedAt: FieldValue.serverTimestamp(),
              });
            } else {
              const planId = subscription.metadata?.planId;
              const plan = getPlanById(planId) || getPlanByPriceId(subscription.metadata?.priceId);
              await syncSubscriptionToUser(userDoc.ref, subscription, {
                planId: plan?.id || planId,
                amount: plan?.amount,
                currency: plan?.currency,
              });
            }
            break;
          }
          default:
            break;
          }
          res.json({ received: true });
        } catch (err) {
          console.error('stripeWebhook handler error:', err);
          res.status(500).send('Webhook handler failed');
        }
      });
    }
  );
}

module.exports = {
  createAssignStripeSubscription,
  createCreateSubscription,
  createConfirmSubscriptionPayment,
  createSyncUserSubscriptionFromStripe,
  createStripeWebhook,
};
