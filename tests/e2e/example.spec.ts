import { test, expect } from '@playwright/test';

test.describe('Chromium Headless Smoke Test', () => {
  test('should load example page and verify title', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);
  });
});
