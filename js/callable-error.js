/** Extract a readable message from Firebase httpsCallable errors. */
export function formatCallableError(err) {
  const code = err?.code || '';
  let msg = err?.message || String(err || '');
  msg = msg.replace(/^Firebase:\s*/i, '').replace(/^functions\/[\w-]+:\s*/i, '').trim();

  if (err?.details && typeof err.details === 'string') return err.details;
  if (/unauthenticated|Sign in required/i.test(code + msg)) return 'Please sign in again and retry.';
  if (msg && !/^internal$/i.test(msg)) return msg;
  return 'Could not start checkout. Please try again or contact hello@rense.se';
}
