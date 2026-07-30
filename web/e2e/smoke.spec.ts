import { expect, test } from '@playwright/test';

import {
  APP_PATH,
  expectReadmeSolution,
  gotoApp,
  loadExample,
  solveCurrentProblem,
} from './helpers/app.ts';

test.describe('solver UI smoke', () => {
  test('boots with title, identity, English LTR, and form controls', async ({ page }) => {
    await gotoApp(page);
    await expect(page).toHaveTitle(/Simplex Method Solver/);
    await expect(page.locator('h1')).toHaveText('Simplex Method Solver');
    await expect(page.locator('.identity')).toContainText('Masoud Vosoughi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#objective-grid')).toBeVisible();
    await expect(page.locator('#constraint-grid')).toBeVisible();
    await expect(page.locator('#problem-preview')).toBeVisible();
  });

  test('has no language selector or global iteration controls', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#lang-switch')).toHaveCount(0);
    await expect(page.locator('#expand-all-btn')).toHaveCount(0);
    await expect(page.locator('#collapse-all-btn')).toHaveCount(0);
    await expect(page.getByText('Expand All')).toHaveCount(0);
    await expect(page.getByText('Collapse All')).toHaveCount(0);
  });

  test('loads readme example and solves to Z=7 with decision variables', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await expect(page.locator('#problem-preview')).toContainText('Max Z = x1 + 2x2');
    await solveCurrentProblem(page);
    await expectReadmeSolution(page);
  });

  test('renders iteration panels after solve', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await expect(page.locator('details.step-panel')).toHaveCount(3);
    await expect(page.locator('details.step-panel summary').first()).toContainText('Step');
  });

  test('mixed example shows Two-Phase method line', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'mixed');
    await solveCurrentProblem(page);
    await expect(page.locator('#result-summary')).toContainText('Method: Two-Phase Simplex');
  });

  test('infeasible and unbounded examples render errors and restore Solve button', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await expect(page.locator('#status-box')).toHaveClass(/ok/);

    await loadExample(page, 'infeasible');
    await page.locator('#solve-btn').click();
    await expect(page.locator('#status-box')).toHaveClass(/error/);
    await expect(page.locator('#result-summary')).toContainText('infeasible');
    await expect(page.locator('#solve-btn')).toBeEnabled();

    await loadExample(page, 'unbounded');
    await page.locator('#solve-btn').click();
    await expect(page.locator('#status-box')).toHaveClass(/error/);
    await expect(page.locator('#result-summary')).toContainText('unbounded');
    await expect(page.locator('#result-summary')).not.toContainText('Objective (Z): 7');
    await expect(page.locator('#solve-btn')).toBeEnabled();
  });

  test('New Problem clears prior results', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    await page.locator('#new-problem-btn').click();
    await expect(page.locator('#result-summary')).toContainText('No results yet.');
    await expect(page.locator('#steps-container')).toBeEmpty();
    await expect(page.locator('#num-constraints')).toHaveValue('2');
  });

  test('three-variable example shows visualization unavailable message', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'ge');
    await solveCurrentProblem(page);
    await expect(page.locator('#feasible-region-viz')).toContainText(
      'Two-dimensional visualization is available only',
    );
  });

  test('invalid numeric input renders validation error', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#objective-grid input[data-objective-index="0"]').fill('');
    await page.locator('#solve-btn').click();
    await expect(page.locator('#status-box')).toHaveClass(/error/);
    await expect(page.locator('#solve-btn')).toBeEnabled();
  });

  test('Solve can be triggered from keyboard', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await page.locator('#solve-btn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#status-box')).toHaveClass(/ok/, { timeout: 15_000 });
  });

  test('primary controls expose accessible names', async ({ page }) => {
    await gotoApp(page);
    await expect(page.getByRole('button', { name: 'Solve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Problem' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load Example' })).toBeVisible();
    await expect(page.getByLabel('Decision variables')).toBeVisible();
    await expect(page.getByLabel('Constraints')).toBeVisible();
    await expect(page.locator('#status-box')).toHaveAttribute('aria-live', 'polite');
  });

  test('iteration panels use native details/summary', async ({ page }) => {
    await gotoApp(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);
    const panel = page.locator('details.step-panel').first();
    await expect(panel.locator('summary')).toBeVisible();
    await panel.locator('summary').click();
    await expect(panel).toHaveAttribute('open', '');
  });
});

test.describe('network safety during solve', () => {
  test('does not call solver API or external origins', async ({ page }) => {
    const apiLikeRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/solve') || url.includes('/api/')) {
        apiLikeRequests.push(url);
      }
      if (url.startsWith('http')) {
        const parsed = new URL(url);
        if (parsed.hostname !== '127.0.0.1') {
          apiLikeRequests.push(url);
        }
      }
    });

    await gotoApp(page);
    await loadExample(page, 'readme');
    await solveCurrentProblem(page);

    expect(apiLikeRequests).toEqual([]);
  });

  test('loads production assets beneath /sapro/', async ({ page }) => {
    const assetUrls: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/assets/') || url.endsWith('.webmanifest') || url.includes('/icons/')) {
        assetUrls.push(url);
      }
    });

    await gotoApp(page);
    expect(assetUrls.length).toBeGreaterThan(0);
    for (const url of assetUrls) {
      expect(url).toContain('/sapro/');
      expect(url).not.toMatch(/^https?:\/\/127\.0\.0\.1:\d+\/assets\//);
    }
  });
});

test('base path index responds at /sapro/', async ({ page }) => {
  const response = await page.goto(APP_PATH);
  expect(response?.status()).toBe(200);
  await expect(page.locator('#solve-btn')).toBeVisible();
});
