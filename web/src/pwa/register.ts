import { registerSW } from 'virtual:pwa-register';

let updateWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

function ensureUpdateBanner(onUpdate: () => void): HTMLElement {
  let banner = document.getElementById('pwa-update-banner');
  if (banner) {
    return banner;
  }

  banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.className = 'pwa-update-banner';
  banner.hidden = true;
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const message = document.createElement('p');
  message.textContent = 'A new version of Sapro is available.';
  banner.appendChild(message);

  const actions = document.createElement('div');
  actions.className = 'pwa-update-actions';

  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.className = 'primary';
  updateButton.textContent = 'Update';
  updateButton.addEventListener('click', () => {
    onUpdate();
  });

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'secondary';
  dismissButton.textContent = 'Later';
  dismissButton.addEventListener('click', () => {
    banner.hidden = true;
  });

  actions.appendChild(updateButton);
  actions.appendChild(dismissButton);
  banner.appendChild(actions);
  document.body.appendChild(banner);
  return banner;
}

export function registerPwa(): void {
  updateWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      const banner = ensureUpdateBanner(() => {
        void updateWorker?.(true);
      });
      banner.hidden = false;
    },
    onOfflineReady() {
      // Precache complete; no automatic reload.
    },
  });
}
