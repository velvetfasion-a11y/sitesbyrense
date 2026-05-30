/** Fixed subscription tiers — map to Stripe Price IDs in stripe-config.js */
import { STRIPE_PLAN_PRICE_IDS } from './stripe-config.js';
import { buildCheckoutUrl } from './checkout-nav.js';

export const SUBSCRIPTION_PLANS = [
  { id: 'type-a', label: 'Yearly Type A', amount: 699, currency: 'SEK', displayAmount: '699 kr', stripePriceId: STRIPE_PLAN_PRICE_IDS['type-a'] },
  { id: 'type-b', label: 'Yearly Type B', amount: 799, currency: 'SEK', displayAmount: '799 kr', stripePriceId: STRIPE_PLAN_PRICE_IDS['type-b'] },
  { id: 'type-i', label: 'Yearly Type I', amount: 1020, currency: 'SEK', displayAmount: '1 020 kr', stripePriceId: STRIPE_PLAN_PRICE_IDS['type-i'] },
  { id: 'type-ii', label: 'Yearly Type II', amount: 14720, currency: 'SEK', displayAmount: '14 720 kr', stripePriceId: STRIPE_PLAN_PRICE_IDS['type-ii'] },
  { id: 'family', label: 'Yearly Family', amount: 299, currency: 'SEK', displayAmount: '299 kr', stripePriceId: STRIPE_PLAN_PRICE_IDS.family },
];

/** Old plan ids stored in Firestore before Stripe names were synced. */
const LEGACY_PLAN_ALIASES = {
  basic: 'type-a',
  plus: 'type-b',
  standard: 'type-i',
  premium: 'type-ii',
};

export function getPlanById(id) {
  if (!id) return null;
  const resolved = LEGACY_PLAN_ALIASES[id] || id;
  return SUBSCRIPTION_PLANS.find((p) => p.id === resolved) || null;
}

export function getPlanByPriceId(priceId) {
  if (!priceId) return null;
  return SUBSCRIPTION_PLANS.find((p) => p.stripePriceId === priceId) || null;
}

export function getDisplayAmount(user) {
  const plan = getPlanById(user?.subscriptionPlan);
  if (plan) return plan.displayAmount;
  if (user?.subscriptionAmount != null && user?.subscriptionCurrency) {
    const cur = user.subscriptionCurrency;
    const amt = user.subscriptionAmount;
    if (cur === 'EUR') return `€${Number(amt).toLocaleString('en-US')}`;
    if (cur === 'SEK') return `${Number(amt).toLocaleString('sv-SE')} kr`;
    return `${amt} ${cur}`;
  }
  return null;
}

export function getPlanLabels(user) {
  const active = user?.isClient === true && user?.deleted !== true;
  const plan = getPlanById(user?.subscriptionPlan);
  const amountLabel = getDisplayAmount(user) || '—';
  if (!active || !user?.subscriptionPlan) {
    return { planLabel: plan?.label || '—', amountLabel, active: false, plan };
  }
  return { planLabel: plan?.label || 'Yearly', amountLabel, active: true, plan };
}

export function formatNextBilling(user) {
  const raw = user?.subscriptionRenewAt || user?.renewDate || user?.createdAt;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function planSelectOptions(selectedId) {
  return SUBSCRIPTION_PLANS.map((p) => {
    const sel = p.id === selectedId || LEGACY_PLAN_ALIASES[selectedId] === p.id ? ' selected' : '';
    return `<option value="${p.id}"${sel}>${p.label} — ${p.displayAmount}/yr</option>`;
  }).join('');
}

/** Client-facing subscription state derived from admin-assigned Firestore fields. */
export function getClientSubscriptionState(user) {
  const plan = getPlanById(user?.subscriptionPlan);
  const amountLabel = getDisplayAmount(user);
  const planLabel = plan?.label || (user?.subscriptionPlan ? 'Yearly' : null);
  const stripeStatus = user?.stripeSubscriptionStatus;
  const stripeActive = stripeStatus === 'active' || stripeStatus === 'trialing';
  const isActive = stripeActive || (user?.isClient === true && user?.deleted !== true && !user?.stripePaymentIntentClientSecret);
  const hasAssignedPlan = !!user?.subscriptionPlan || amountLabel != null;
  const cancelled = user?.subscriptionCancelled === true || stripeStatus === 'canceled';
  const needsPayment = hasAssignedPlan && !stripeActive && !cancelled;
  const nextBilling = formatNextBilling(user);

  return {
    isActive,
    needsPayment,
    cancelled,
    hasAssignedPlan,
    plan,
    planLabel,
    amountLabel: amountLabel || '—',
    amountPerYear: amountLabel ? `${amountLabel} / year` : '—',
    nextBilling,
    renewLabel: nextBilling !== '—' ? nextBilling : null,
    settingsSub: isActive && !cancelled
      ? `${planLabel || 'Yearly'} · Active`
      : needsPayment
      ? `${planLabel || 'Yearly'} · Payment required`
      : hasAssignedPlan
      ? `${planLabel || 'Yearly'} · Pending payment`
      : 'No active plan',
  };
}

/** Redirect URL to on-site checkout with the assigned plan's Stripe Price ID. */
export function getStripeCheckoutUrl(planId) {
  const plan = getPlanById(planId);
  if (!plan?.stripePriceId) return null;
  return buildCheckoutUrl(plan.id, plan.stripePriceId);
}
