import { test, expect } from '@playwright/test';

test.describe('Discovery Flow', () => {
  test('should search and view place details', async ({ page }) => {
    await page.goto('/');
    
    // Find search bar
    const searchBar = page.locator('input[placeholder*="Search"]');
    await searchBar.fill('Souk');
    
    // Wait for results
    await page.waitForSelector('.vd-card--place');
    
    // Click first result
    const firstPlace = page.locator('.vd-card--place').first();
    const placeName = await firstPlace.locator('.vd-card-title').innerText();
    await firstPlace.click();
    
    // Verify detail page
    await expect(page).toHaveURL(/\/place\//);
    const detailTitle = page.locator('.vd-place-detail-title');
    await expect(detailTitle).toContainText(placeName);
  });
});
