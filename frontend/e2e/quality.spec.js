import { expect, test } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL || 'http://localhost:8900';

test('protected endpoint rejects anonymous access', async ({ request }) => {
  const response = await request.get(`${API_BASE}/api/protected/me`);
  expect(response.status()).toBe(401);
});

test('public settings endpoint exposes safe branding payload', async ({ request }) => {
  const response = await request.get(`${API_BASE}/api/settings/public`);
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload).toHaveProperty('assistant_name');
  expect(payload).toHaveProperty('brand_name');
  expect(payload).toHaveProperty('accent_color');
  expect(payload).not.toHaveProperty('api_key');
  expect(payload).not.toHaveProperty('token');
  expect(payload).not.toHaveProperty('secret');
});

test('public route keeps navigation timing within prototype budget', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const landingDcl = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? nav.domContentLoadedEventEnd : 0;
  });

  await page.goto('/help', { waitUntil: 'networkidle' });
  const helpDcl = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? nav.domContentLoadedEventEnd : 0;
  });

  expect(landingDcl).toBeLessThan(5000);
  expect(helpDcl).toBeLessThan(5000);
});
