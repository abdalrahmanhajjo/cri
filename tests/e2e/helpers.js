/**
 * E2E Helpers for Playwright
 */

export async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect to home or profile
  await page.waitForURL(url => url.pathname === '/' || url.pathname === '/profile');
}

export async function logout(page) {
  await page.goto('/profile');
  await page.click('button:has-text("Logout")');
  await page.waitForURL('/login');
}
