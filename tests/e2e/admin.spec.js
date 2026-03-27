import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Admin login
    await login(page, 'admin@example.com', 'adminpass');
  });

  test('should update site settings and verify on home', async ({ page }) => {
    await page.goto('/admin/settings');
    
    // Change site name
    const siteNameInput = page.locator('input[name="siteName"]');
    await siteNameInput.fill('Tripoli Explorer Automated');
    await page.click('button:has-text("Save Settings")');
    
    // Wait for success
    await expect(page.locator('text=Settings saved successfully')).toBeVisible();
    
    // Verify on public home
    await page.goto('/');
    await expect(page.locator('h1.vd-bento-hero-title')).toHaveText('Tripoli Explorer Automated');
    
    // Revert change
    await page.goto('/admin/settings');
    await siteNameInput.fill('Tripoli Explorer');
    await page.click('button:has-text("Save Settings")');
  });
});
