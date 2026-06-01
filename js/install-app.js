/** Add-to-home-screen prompt — phones only, until installed as PWA. */

export function isMobilePhone() {
  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone/i.test(ua);
  const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  return isIPhone || isAndroidPhone;
}

export function isAppInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

export function shouldAutoShowInstallBanner() {
  return isMobilePhone() && !isAppInstalled();
}

const IOS_STEPS = [
  { num: '1', label: 'Tap the Share button', desc: 'The ⬆ box-with-arrow icon at the bottom of Safari.' },
  { num: '2', label: 'Tap "Add to Home Screen"', desc: 'Scroll down in the share sheet to find it.' },
  { num: '3', label: 'Tap Add', desc: 'Rensé will appear on your home screen like an app.' },
];

const ANDROID_STEPS = [
  { num: '1', label: 'Tap the menu ⋮', desc: 'Three dots in the top right of Chrome.' },
  { num: '2', label: '"Add to Home screen"', desc: 'Find it in the dropdown menu.' },
  { num: '3', label: 'Tap Add', desc: 'Rensé will appear on your home screen.' },
];

const INSTALL_TITLE = 'add rense.se to homescreen';

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

let bannerDismissedThisVisit = false;

function visitDismissed() {
  return bannerDismissedThisVisit;
}

function setVisitDismissed() {
  bannerDismissedThisVisit = true;
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function updateDownloadAppPage() {
  const statusTitle = document.getElementById('download-app-status-title');
  const statusSub = document.getElementById('download-app-status-sub');
  const statusIcon = document.getElementById('download-app-status-icon');
  const statusCard = document.getElementById('download-app-status-card');
  const cta = document.getElementById('download-app-cta');
  if (!statusTitle) return;

  const installed = isAppInstalled();
  const isIOS = /iPhone/i.test(navigator.userAgent);
  const platform = isIOS ? 'iPhone' : isAndroid() ? 'Android' : 'phone';
  const browser = isIOS ? 'Safari' : 'Chrome';

  if (installed) {
    statusTitle.textContent = 'Already installed';
    statusSub.textContent = 'Rensé is running as an installed app.';
    statusIcon.textContent = '✓';
    statusCard?.classList.add('installed');
    if (cta) {
      cta.textContent = 'View instructions again';
      cta.classList.add('muted');
    }
  } else {
    statusTitle.textContent = 'Not yet installed';
    statusSub.textContent = `Add to your ${platform} home screen via ${browser}.`;
    statusIcon.textContent = '📲';
    statusCard?.classList.remove('installed');
    if (cta) {
      cta.textContent = 'Add to Home Screen';
      cta.classList.remove('muted');
    }
  }
}

export function showInstallBanner({ forceShow = false, onDismiss } = {}) {
  const root = document.getElementById('install-banner-root');
  if (!root) return;

  const installed = isAppInstalled();
  const canShow = forceShow || (shouldAutoShowInstallBanner() && !visitDismissed());
  if (!canShow || (installed && !forceShow)) {
    root.innerHTML = '';
    root.setAttribute('aria-hidden', 'true');
    return;
  }

  let visible = false;
  let closed = false;
  const steps = isAndroid() ? ANDROID_STEPS : IOS_STEPS;

  function render() {
    if (closed) {
      root.innerHTML = '';
      root.setAttribute('aria-hidden', 'true');
      return;
    }

    root.setAttribute('aria-hidden', 'false');

    root.innerHTML = `
      <div class="install-backdrop${visible ? ' visible' : ''}" data-install-close="visit"></div>
      <div class="install-sheet${visible ? ' visible' : ''}" role="dialog" aria-labelledby="install-sheet-title">
        <div class="install-handle"></div>
        <button type="button" class="install-close" data-install-close="temp" aria-label="Close">✕</button>
        <div class="install-body">
          <h2 id="install-sheet-title" class="install-title">${INSTALL_TITLE}</h2>
          <div class="install-steps">
            ${steps.map((s, i) => `
              <div class="install-step${i < steps.length - 1 ? ' bordered' : ''}">
                <div class="install-step-num">${s.num}</div>
                <div>
                  <div class="install-step-label">${esc(s.label)}</div>
                  <div class="install-step-desc">${esc(s.desc)}</div>
                </div>
              </div>
            `).join('')}
          </div>
          ${!isAndroid() ? `
            <div class="install-tip">
              <span class="install-tip-icon">⬆️</span>
              <span>The <strong>Share</strong> button is at the bottom centre of your Safari browser.</span>
            </div>
          ` : ''}
          <button type="button" class="btn-primary install-primary" data-install-close="${forceShow ? 'temp' : 'visit'}">Got it</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-install-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-install-close');
        close(mode === 'visit' && !forceShow);
      });
    });
    root.querySelector('.install-backdrop')?.addEventListener('click', () => close(false));
  }

  function close(persistVisit = false) {
    visible = false;
    render();
    if (persistVisit && !forceShow) setVisitDismissed();
    setTimeout(() => {
      closed = true;
      render();
      onDismiss?.();
    }, 360);
  }

  render();
  requestAnimationFrame(() => {
    setTimeout(() => {
      visible = true;
      render();
    }, forceShow ? 50 : 400);
  });
}

export function initInstallApp() {
  updateDownloadAppPage();
  if (shouldAutoShowInstallBanner() && !visitDismissed()) {
    showInstallBanner();
  }

  document.getElementById('download-app-cta')?.addEventListener('click', () => {
    if (!isMobilePhone() && !isAppInstalled()) {
      window.showToast?.('Open rense.se on your iPhone or Android phone to install.');
      return;
    }
    showInstallBanner({ forceShow: true });
  });
}

export function maybeShowInstallBannerOnOverview() {
  if (!shouldAutoShowInstallBanner()) return;
  bannerDismissedThisVisit = false;
  showInstallBanner();
}
