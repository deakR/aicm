import { expect, test } from '@playwright/test';

test('public landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /explore help center/i })).toBeVisible();
});

test('help center route is reachable', async ({ page }) => {
  await page.goto('/help');
  await expect(page.locator('body')).toContainText(/help/i);
});
