require('./load-env');

// deploy-rev: 2 — force env reload (Stripe keys)

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  createAssignStripeSubscription,
  createCreateSubscription,
  createStripeWebhook,
} = require('./stripe-subscription');

initializeApp();
const db = getFirestore();

exports.assignStripeSubscription = createAssignStripeSubscription(db);
exports.createSubscription = createCreateSubscription(db);
exports.stripeWebhook = createStripeWebhook(db);
