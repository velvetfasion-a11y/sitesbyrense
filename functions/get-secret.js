require('./load-env');

const { defineString } = require('firebase-functions/params');

const stripeSecretKeyParam = defineString('STRIPE_SECRET_KEY');
const stripeWebhookSecretParam = defineString('STRIPE_WEBHOOK_SECRET');

function readEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

function readParam(getter) {
  try {
    const value = getter();
    if (value && String(value).trim() && !String(value).includes('your_key')) {
      return String(value).trim();
    }
  } catch (_) {
    /* param not available in this runtime */
  }
  return null;
}

function readStripeSecretKey() {
  const key = readParam(() => stripeSecretKeyParam.value()) || readEnv('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY. Add it to functions/.env and redeploy.');
  }
  if (!key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY must start with sk_');
  }
  return key;
}

function readStripeWebhookSecret() {
  return readParam(() => stripeWebhookSecretParam.value()) || readEnv('STRIPE_WEBHOOK_SECRET') || '';
}

module.exports = { readStripeSecretKey, readStripeWebhookSecret };
