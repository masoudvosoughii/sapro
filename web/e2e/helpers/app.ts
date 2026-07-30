import { expect, type Page } from '@playwright/test';

export const APP_PATH = '/sapro/';

export async function gotoApp(page: Page): Promise<void> {
  const response = await page.goto(APP_PATH);
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#solve-btn')).toBeVisible();
  await expect(page.locator('#objective-grid input').first()).toBeVisible();
}

export async function loadExample(page: Page, exampleKey: string): Promise<void> {
  await page.locator('#example-select').selectOption(exampleKey);
  await page.locator('#load-example-btn').click();
}

export async function solveCurrentProblem(page: Page): Promise<void> {
  await page.locator('#solve-btn').click();
  await expect(page.locator('#status-box')).toHaveClass(/ok/, { timeout: 15_000 });
}

export async function expectReadmeSolution(page: Page): Promise<void> {
  const summary = page.locator('#result-summary');
  await expect(summary).toContainText('Objective (Z):');
  await expect(summary).toContainText('7');
  await expect(summary).toContainText('x1 = 1');
  await expect(summary).toContainText('x2 = 3');
}

export async function waitForControllingServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    await navigator.serviceWorker.ready;
    return navigator.serviceWorker.controller !== null;
  }, { timeout: 30_000 });

  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  if (!controlled) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 30_000 });
  }
}
