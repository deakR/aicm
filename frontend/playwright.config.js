import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:7200',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'go run ./cmd/api',
      cwd: '../backend',
      url: 'http://127.0.0.1:8900/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@127.0.0.1:5432/aicm_ci?sslmode=disable',
        PORT: process.env.PORT || '8900',
        JWT_SECRET: process.env.JWT_SECRET || 'ci-secret',
        FRONTEND_ORIGIN:
          process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:7200',
        GROQ_API_KEY: process.env.GROQ_API_KEY || 'ci-placeholder-key',
        GROQ_MODEL:
          process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 7200',
      cwd: '.',
      url: 'http://127.0.0.1:7200',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_URL: process.env.VITE_API_URL || 'http://127.0.0.1:8900',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
