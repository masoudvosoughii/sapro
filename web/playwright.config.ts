import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const HOST = '127.0.0.1';
const PORT = 4173;
const PREVIEW_BASE_URL = `http://${HOST}:${String(PORT)}`;
const DEPLOYED_BASE_URL = process.env['E2E_BASE_URL'];

const chromiumLocal = process.env['CI']
  ? devices['Desktop Chrome']
  : { ...devices['Desktop Chrome'], channel: 'chrome' as const };

function createConfig(): PlaywrightTestConfig {
  if (DEPLOYED_BASE_URL) {
    const deployedBase = DEPLOYED_BASE_URL.endsWith('/') ? DEPLOYED_BASE_URL : `${DEPLOYED_BASE_URL}/`;

    return {
      testDir: './e2e',
      fullyParallel: false,
      workers: 1,
      forbidOnly: Boolean(process.env['CI']),
      retries: process.env['CI'] ? 1 : 0,
      reporter: [['list']],
      use: {
        baseURL: deployedBase,
        trace: 'on-first-retry',
        serviceWorkers: 'allow',
      },
      projects: [
        {
          name: 'chromium-deployed',
          testMatch: /deployed\.spec\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
      ],
    };
  }

  return {
    testDir: './e2e',
    fullyParallel: true,
    ...(process.env['CI'] ? { workers: 1 } : {}),
    forbidOnly: Boolean(process.env['CI']),
    retries: process.env['CI'] ? 1 : 0,
    reporter: [['list']],
    use: {
      baseURL: PREVIEW_BASE_URL,
      trace: 'on-first-retry',
      serviceWorkers: 'allow',
    },
    projects: [
      {
        name: 'chromium',
        use: chromiumLocal,
        testIgnore: [/pwa\//, /deployed\.spec\.ts/],
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
        testIgnore: [/pwa\//, /deployed\.spec\.ts/],
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
        testIgnore: [/pwa\//, /deployed\.spec\.ts/],
      },
      {
        name: 'chromium-pwa',
        testMatch: /pwa\//,
        use: chromiumLocal,
      },
    ],
    webServer: {
      command: `npm run build && npm run preview -- --host ${HOST} --port ${String(PORT)}`,
      url: `${PREVIEW_BASE_URL}/sapro/`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  };
}

export default defineConfig(createConfig());
