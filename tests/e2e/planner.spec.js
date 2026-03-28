import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Planner Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });

  test('should create and delete a trip', async ({ page }) => {
    await page.goto('/plan');
    
    // Click create new trip
    await page.click('button:has-text("Create new trip")');
    await page.fill('input[placeholder*="Trip name"]', 'My Automated Trip');
    await page.click('button:has-text("Save")');
    
    // Verify trip exists in list
    await page.goto('/trips');
    await expect(page.locator('text=My Automated Trip')).toBeVisible();
    
    // Delete trip
    await page.click('text=My Automated Trip');
    page.once('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Delete trip")');
    
    // Verify deleted
    await expect(page.locator('text=My Automated Trip')).not.toBeVisible();
  });
});
