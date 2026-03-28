import { test, expect } from '@playwright/test';

test.describe('Discovery Flow', () => {
  test('should search and view place details', async ({ page }) => {
    await page.goto('/');
    
    // Find search bar
    const searchBar = page.locator('input[placeholder*="Search"]');
    await searchBar.fill('Souk');
    await searchBar.press('Enter');
    
    // Wait for results
    await page.waitForSelector('.pd-card');
    
    // Click first result
    const firstPlace = page.locator('.pd-card').first();
    const placeName = await firstPlace.locator('.pd-card-title').innerText();
    await firstPlace.click();
    
    // Verify detail page
    await expect(page).toHaveURL(/\/place\//);
    const detailTitle = page.locator('.place-detail-title');
    await expect(detailTitle).toContainText(placeName);
  });
});
