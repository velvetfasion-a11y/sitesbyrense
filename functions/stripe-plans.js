/** Server-side plan definitions — keep in sync with js/stripe-config.js */
const STRIPE_PLANS = [
  { id: 'type-a', label: 'Yearly Type A', amount: 699, currency: 'SEK', stripePriceId: 'price_1TcW7T4CnYstVm6mqdZC3gmk' },
  { id: 'type-b', label: 'Yearly Type B', amount: 799, currency: 'SEK', stripePriceId: 'price_1TcWBY4CnYstVm6m4xswDgr3' },
  { id: 'type-i', label: 'Yearly Type I', amount: 1020, currency: 'SEK', stripePriceId: 'price_1TcW8Y4CnYstVm6mV1rNLIiz' },
  { id: 'type-ii', label: 'Yearly Type II', amount: 14720, currency: 'SEK', stripePriceId: 'price_1TcW9e4CnYstVm6mCeOEBEs6' },
  { id: 'family', label: 'Yearly Family', amount: 0, currency: 'SEK', stripePriceId: 'price_1Tcm2i4CnYstVm6mysQF5WaX' },
];

const LEGACY_PLAN_ALIASES = {
  basic: 'type-a',
  plus: 'type-b',
  standard: 'type-i',
  premium: 'type-ii',
};

const DEFAULT_STRIPE_PRICE_ID = STRIPE_PLANS[0].stripePriceId;

const ALLOWED_PRICE_IDS = new Set(STRIPE_PLANS.map((p) => p.stripePriceId));

function getPlanById(id) {
  if (!id) return null;
  const resolved = LEGACY_PLAN_ALIASES[id] || id;
  return STRIPE_PLANS.find((p) => p.id === resolved) || null;
}

function getPlanByPriceId(priceId) {
  if (!priceId) return null;
  return STRIPE_PLANS.find((p) => p.stripePriceId === priceId) || null;
}

module.exports = {
  STRIPE_PLANS,
  DEFAULT_STRIPE_PRICE_ID,
  ALLOWED_PRICE_IDS,
  getPlanById,
  getPlanByPriceId,
};
