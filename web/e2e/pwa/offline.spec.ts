import { expect, test } from '@playwright/test';

import {
  APP_PATH,
  expectReadmeSolution,
  gotoApp,
  loadExample,
  solveCurrentProblem,
  waitForControllingServiceWorker,
} from '../helpers/app.ts';

test.describe.configure({ mode: 'serial' });

test('registers service worker with /sapro/ scope', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoApp(page);
    await waitForControllingServiceWorker(page);

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg
        ? {
            scope: reg.scope,
            scriptUrl: reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? '',
          }
        : null;
    });

    expect(registration).not.toBeNull();
    expect(registration?.scope).toContain('/sapro/');
    expect(registration?.scriptUrl).toContain('/sapro/');
  } finally {
    await context.close();
  }
});

test('manifest link resolves with required installability fields', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoApp(page);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    expect(manifestHref).toContain('/sapro/');

    const manifestResponse = await page.request.get(String(manifestHref));
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = (await manifestResponse.json()) as Record<string, unknown>;

    expect(manifest['name']).toBe('Sapro Simplex Solver');
    expect(manifest['short_name']).toBe('Sapro');
    expect(manifest['display']).toBe('standalone');
    expect(manifest['theme_color']).toBe('#245bdb');
    expect(manifest['background_color']).toBe('#f4f5f7');
    expect(manifest['start_url']).toContain('/sapro/');
    expect(manifest['scope']).toContain('/sapro/');

    const icons = manifest['icons'] as Array<{ sizes?: string; type?: string; purpose?: string }>;
    expect(icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose !== 'maskable')).toBe(true);
    expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);

    for (const icon of icons) {
      const iconPath = (icon as { src?: string }).src;
      expect(iconPath).toBeTruthy();
      const iconUrl = iconPath?.startsWith('http')
        ? iconPath
        : new URL(String(iconPath), `${String(page.url().split('/sapro/')[0])}/sapro/`).toString();
      const iconResponse = await page.request.get(iconUrl);
      expect(iconResponse.ok()).toBeTruthy();
      expect(iconResponse.headers()['content-type']).toContain('image/png');
    }
  } finally {
    await context.close();
  }
});

test('works offline after precache and solves readme example', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoApp(page);
    await waitForControllingServiceWorker(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await expectReadmeSolution(page);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#solve-btn')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Simplex Method Solver');

    await loadExample(page, 'minimization');
    await solveCurrentProblem(page);
    await expect(page.locator('#result-summary')).toContainText('Objective (Z):');
    await expect(page.locator('#result-summary')).toContainText('4');

    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await expectReadmeSolution(page);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});

test('production bundle contains no developer-machine absolute paths', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const responses: string[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/sapro/assets/') && url.endsWith('.js')) {
        responses.push(await response.text());
      }
    });

    await gotoApp(page);
    expect(responses.length).toBeGreaterThan(0);
    for (const source of responses) {
      expect(source).not.toMatch(/\/Users\//);
      expect(source).not.toContain('http://localhost');
      expect(source).not.toContain('http://127.0.0.1');
    }
  } finally {
    await context.close();
  }
});

test('service worker and manifest URLs stay under /sapro/', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const urls: string[] = [];

  page.on('request', (request) => {
    urls.push(request.url());
  });

  try {
    await page.goto(APP_PATH);
    await waitForControllingServiceWorker(page);

    const relevant = urls.filter(
      (url) =>
        url.includes('manifest') ||
        url.includes('sw') ||
        url.includes('workbox') ||
        url.includes('/sapro/assets/') ||
        url.includes('/sapro/icons/'),
    );
    expect(relevant.length).toBeGreaterThan(0);
    for (const url of relevant) {
      expect(url).toContain('/sapro/');
    }
    expect(urls.some((url) => url.match(/\/assets\//) && !url.includes('/sapro/'))).toBe(false);
  } finally {
    await context.close();
  }
});
