import { expect, test } from '@playwright/test';

import {
  expectReadmeSolution,
  loadExample,
  solveCurrentProblem,
  waitForControllingServiceWorker,
} from './helpers/app.ts';

test.describe.configure({ mode: 'serial' });

test.describe('deployed GitHub Pages smoke', () => {
  test('loads the hosted application', async ({ page }) => {
    const response = await page.goto('./');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('#solve-btn')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Simplex Method Solver');
  });

  test('readme example solves online to Z=7', async ({ page }) => {
    await page.goto('./');
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await expectReadmeSolution(page);
  });

  test('manifest is reachable and service worker scope is under /simplex-solver/', async ({ page, baseURL }) => {
    await page.goto('./');
    const manifestUrl = new URL('manifest.webmanifest', baseURL ?? './').toString();
    const manifestResponse = await page.request.get(manifestUrl);
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = (await manifestResponse.json()) as {
      start_url?: string;
      scope?: string;
    };
    expect(manifest.start_url ?? '').toContain('/simplex-solver/');
    expect(manifest.scope ?? '').toContain('/simplex-solver/');

    await waitForControllingServiceWorker(page);
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.scope ?? '';
    });
    expect(scope).toContain('/simplex-solver/');
  });

  test('readme example solves offline after precache', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('./');
      await waitForControllingServiceWorker(page);
      await loadExample(page, 'readme');
      await solveCurrentProblem(page);
      await expectReadmeSolution(page);

      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#solve-btn')).toBeVisible();

      await loadExample(page, 'readme');
      await solveCurrentProblem(page);
      await expectReadmeSolution(page);
    } finally {
      await context.setOffline(false);
      await context.close();
    }
  });
});
