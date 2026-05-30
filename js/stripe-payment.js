import { STRIPE_PUBLISHABLE_KEY } from './stripe-config.js';

let stripePromise = null;
let stripeKeyUsed = null;

export function getStripeJs() {
  if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes('REPLACE_ME')) {
    return null;
  }
  if (stripePromise && stripeKeyUsed !== STRIPE_PUBLISHABLE_KEY) {
    stripePromise = null;
  }
  if (!stripePromise) {
    stripeKeyUsed = STRIPE_PUBLISHABLE_KEY;
    stripePromise = loadStripeScript().then(() => {
      const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
      if (!stripe) throw new Error('Stripe.js failed to initialize');
      return stripe;
    });
  }
  return stripePromise;
}

function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Stripe.js'));
    document.head.appendChild(script);
  });
}

function waitForPaymentElementReady(paymentElement, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Payment form timed out. Please refresh and try again.'));
    }, timeoutMs);

    paymentElement.on('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    paymentElement.on('loaderror', (event) => {
      clearTimeout(timer);
      reject(new Error(event?.error?.message || 'Payment form failed to load'));
    });
  });
}

/**
 * Mount Stripe Payment Element and wire submit — waits until mounted + ready
 * before enabling the pay button or allowing confirmPayment.
 * @returns {Promise<{ destroy: () => void, submit: () => Promise<void>, isReady: () => boolean }>}
 */
export async function mountSubscriptionPayment({
  clientSecret,
  mountEl,
  submitBtn,
  onError,
  onSuccess,
  onReady,
}) {
  if (!clientSecret) throw new Error('Missing payment client secret');
  if (!mountEl) throw new Error('Missing payment mount element (#payment-element)');

  const stripe = await getStripeJs();
  if (!stripe) throw new Error('Stripe publishable key is not configured');

  const defaultLabel = submitBtn?.dataset?.defaultLabel || submitBtn?.textContent || 'Pay & activate subscription';
  if (submitBtn) {
    submitBtn.dataset.defaultLabel = defaultLabel;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Loading payment form…';
  }

  mountEl.innerHTML = '';
  mountEl.setAttribute('aria-busy', 'true');

  const elements = stripe.elements({
    clientSecret,
    appearance: {
      theme: 'night',
      variables: { colorPrimary: '#c9a84c', borderRadius: '12px' },
    },
  });

  const paymentElement = elements.create('payment', { layout: { type: 'tabs' } });
  const readyPromise = waitForPaymentElementReady(paymentElement);

  paymentElement.mount(mountEl);
  await readyPromise;

  mountEl.removeAttribute('aria-busy');

  let ready = true;
  let submitting = false;

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = defaultLabel;
  }
  onReady?.();

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!ready || submitting) return;

    submitting = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const returnParams = new URLSearchParams(window.location.search);
      returnParams.set('payment', 'success');
      const { error, paymentIntent, setupIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}?${returnParams.toString()}`,
        },
      });

      if (error) {
        onError?.(error.message || 'Payment failed');
        if (submitBtn) submitBtn.disabled = false;
        submitting = false;
        return;
      }

      const intent = paymentIntent || setupIntent;
      if (
        intent?.status === 'succeeded'
        || intent?.status === 'processing'
        || intent?.status === 'requires_capture'
      ) {
        onSuccess?.(intent);
      }
    } catch (err) {
      onError?.(err.message || 'Payment failed');
      if (submitBtn) submitBtn.disabled = false;
    } finally {
      submitting = false;
    }
  }

  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);

  return {
    destroy() {
      ready = false;
      paymentElement.destroy();
      if (submitBtn) submitBtn.removeEventListener('click', handleSubmit);
      mountEl.innerHTML = '';
    },
    submit: handleSubmit,
    isReady: () => ready,
  };
}
