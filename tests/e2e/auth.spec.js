import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';

test.describe('Authentication Flow', () => {
  test('should login successfully', async ({ page }) => {
    // Note: These tests assume a seeded database or a test account on the server.
    // In a real environment, we'd use environment variables for these.
    await login(page, 'test@example.com', 'password123');
    await expect(page).toHaveURL('/');
    
    // Check if profile link exists
    const profileLink = page.locator('a[href="/profile"]');
    await expect(profileLink).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
    await logout(page);
    await expect(page).toHaveURL('/login');
  });
});
