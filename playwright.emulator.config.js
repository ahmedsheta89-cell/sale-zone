const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e-emulator',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 75000,
  expect: {
    timeout: 12000
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/phase3/playwright-emulator-results.json' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:8181',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo'
  },
  projects: [
    {
      name: 'chromium-emulator',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node tools/local-test-server.js --port 8181',
    port: 8181,
    reuseExistingServer: !process.env.CI,
    timeout: 15000
  }
});
