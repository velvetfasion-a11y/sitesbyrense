import { app } from '../firebase-config.js';
import { getFunctions, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const REGION = 'europe-west1';
export const functions = getFunctions(app, REGION);

function useFunctionsEmulator() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('functions') === 'local') return true;
  // Default to deployed Cloud Functions (works on localhost without running emulators)
  return false;
}

if (useFunctionsEmulator()) {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.info('[Rensé] Functions → emulator http://127.0.0.1:5001');
  } catch (err) {
    console.warn('[Rensé] Functions emulator not connected:', err?.message || err);
  }
} else {
  console.info('[Rensé] Functions → production (europe-west1)');
}

export const functionsReady = Promise.resolve(functions);
