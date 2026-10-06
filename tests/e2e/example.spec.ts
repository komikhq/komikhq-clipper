import { test, expect } from '@playwright/test';

test.describe('Chromium Headless Smoke Test', () => {
  test('harus membuka halaman web dan memeriksa title', async ({ page }) => {
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);
  });
});
