require('./load-env');

function readEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

function readStripeSecretKey() {
  const key = readEnv('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error(
      'Missing STRIPE_SECRET_KEY. Add it to functions/.env and run firebase deploy --only functions.'
    );
  }
  if (!key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY must start with sk_');
  }
  return key;
}

function readStripeWebhookSecret() {
  return readEnv('STRIPE_WEBHOOK_SECRET') || '';
}

module.exports = { readStripeSecretKey, readStripeWebhookSecret };
