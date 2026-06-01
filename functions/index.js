require('./load-env');

// deploy-rev: 3 — Stripe env from functions/.env

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const {
  createAssignStripeSubscription,
  createCreateSubscription,
  createConfirmSubscriptionPayment,
  createStripeWebhook,
} = require('./stripe-subscription');

initializeApp();
const db = getFirestore();

exports.assignStripeSubscription = createAssignStripeSubscription(db);
exports.createSubscription = createCreateSubscription(db);
exports.confirmSubscriptionPayment = createConfirmSubscriptionPayment(db);
exports.stripeWebhook = createStripeWebhook(db);
