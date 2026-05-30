/** Stripe publishable key (safe for frontend). Single source of truth — import this everywhere. */
export const STRIPE_PUBLISHABLE_KEY =
  'pk_live_51TcRT54CnYstVm6mIUUDNNP3WgzgsoHBTYZp8t0JYTHjU4oD0klUL7o1R3gyp3yQCmzHruGxV8lpsRHJMyx3Texm00fk6hPvOQ';

export const STRIPE_PLAN_PRICE_IDS = {
  'type-a': 'price_1TcW7T4CnYstVm6mqdZC3gmk',
  'type-b': 'price_1TcWBY4CnYstVm6m4xswDgr3',
  'type-i': 'price_1TcW8Y4CnYstVm6mV1rNLIiz',
  'type-ii': 'price_1TcW9e4CnYstVm6mCeOEBEs6',
  family: 'price_1Tcm2i4CnYstVm6mysQF5WaX',
  basic: 'price_1TcW7T4CnYstVm6mqdZC3gmk',
  plus: 'price_1TcWBY4CnYstVm6m4xswDgr3',
  standard: 'price_1TcW8Y4CnYstVm6mV1rNLIiz',
  premium: 'price_1TcW9e4CnYstVm6mCeOEBEs6',
};

export const ALLOWED_STRIPE_PRICE_IDS = new Set(Object.values(STRIPE_PLAN_PRICE_IDS));

export function getPlanIdForPriceId(priceId) {
  return Object.entries(STRIPE_PLAN_PRICE_IDS).find(([, id]) => id === priceId)?.[0] || '';
}
