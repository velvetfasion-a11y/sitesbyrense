/** Build checkout URL with Stripe Price ID (and optional plan id). */
export function buildCheckoutUrl(planId, priceId) {
  const params = new URLSearchParams();
  params.set('priceId', priceId);
  if (planId) params.set('planId', planId);
  return `checkout.html?${params.toString()}`;
}

export function goToCheckout(planId, priceId) {
  if (!priceId || !String(priceId).startsWith('price_')) {
    console.error('Invalid Stripe price ID:', priceId);
    return;
  }
  window.location.href = buildCheckoutUrl(planId, priceId);
}

export function parseCheckoutParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    priceId: params.get('priceId') || '',
    planId: params.get('planId') || '',
    paymentSuccess: params.get('payment') === 'success',
  };
}
