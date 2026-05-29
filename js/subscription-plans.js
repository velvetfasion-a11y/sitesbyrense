/** Fixed subscription tiers — amounts map to Stripe Payment Links. */
export const SUBSCRIPTION_PLANS = [
  { id: 'basic', label: 'Basic', amount: 699, currency: 'SEK', displayAmount: '699 kr' },
  { id: 'standard', label: 'Standard', amount: 1200, currency: 'EUR', displayAmount: '€1,200' },
  { id: 'premium', label: 'Premium', amount: 2499, currency: 'SEK', displayAmount: '2 499 kr' },
];

/**
 * Stripe Payment Links — one per plan. Replace with your live links from Stripe Dashboard.
 * Use client_reference_id (uid) + prefilled_email in checkout URL for webhook matching.
 */
export const STRIPE_PAYMENT_LINKS = {
  basic: 'https://buy.stripe.com/test_PLACEHOLDER_BASIC',
  standard: 'https://buy.stripe.com/test_PLACEHOLDER_STANDARD',
  premium: 'https://buy.stripe.com/test_PLACEHOLDER_PREMIUM',
};

export function getPlanById(id) {
  if (!id) return null;
  return SUBSCRIPTION_PLANS.find((p) => p.id === id) || null;
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
    const sel = p.id === selectedId ? ' selected' : '';
    return `<option value="${p.id}"${sel}>${p.label} — ${p.displayAmount}/yr</option>`;
  }).join('');
}

/** Client-facing subscription state derived from admin-assigned Firestore fields. */
export function getClientSubscriptionState(user) {
  const plan = getPlanById(user?.subscriptionPlan);
  const amountLabel = getDisplayAmount(user);
  const planLabel = plan?.label || (user?.subscriptionPlan ? 'Yearly' : null);
  const isActive = user?.isClient === true && user?.deleted !== true;
  const hasAssignedPlan = !!user?.subscriptionPlan || amountLabel != null;
  const cancelled = user?.subscriptionCancelled === true;
  const nextBilling = formatNextBilling(user);

  return {
    isActive,
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
      : hasAssignedPlan
      ? `${planLabel || 'Yearly'} · Pending payment`
      : 'No active plan',
  };
}

export function getStripeCheckoutUrl(planId, { email, uid } = {}) {
  const base = STRIPE_PAYMENT_LINKS[planId];
  if (!base || base.includes('PLACEHOLDER')) return null;
  try {
    const url = new URL(base);
    if (email) url.searchParams.set('prefilled_email', email);
    if (uid) url.searchParams.set('client_reference_id', uid);
    return url.toString();
  } catch {
    return null;
  }
}
