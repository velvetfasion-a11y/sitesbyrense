require('./load-env');

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
