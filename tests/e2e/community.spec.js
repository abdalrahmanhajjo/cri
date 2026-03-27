import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Community Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'test@example.com', 'password123');
  });

  test('should add a comment to a feed post', async ({ page }) => {
    await page.goto('/community');
    
    // Find first post card
    const firstPost = page.locator('.ig-feed-post').first();
    await firstPost.scrollIntoViewIfNeeded();
    
    // In Discover.jsx, we might not need to click it if it's already visible, 
    // but the test expects to go to a detail page.
    // Actually, FeedPostCard might have a link to the venue hub.
    // Let's see if we can just interact with it on the community page.
    
    // If the test wants to go to /community/place/:id:
    const venueLink = firstPost.locator('a.ig-feed-author').first();
    await venueLink.click();
    
    // Wait for post detail or venue hub
    await expect(page).toHaveURL(/\/community\/place\//);
    
    // Add comment
    const commentInput = page.locator('.ig-feed-comment-input');
    await commentInput.fill('Automated Test Comment');
    await page.click('.ig-feed-comment-submit');
    
    // Verify comment visible
    await expect(page.locator('text=Automated Test Comment')).toBeVisible();
    
    // Like post
    const likeBtn = page.locator('button[aria-label*="like"]').first();
    await likeBtn.click();
    // (Assuming UI updates to reflect like)
  });
});
