/**
 * E2E Helpers for Playwright
 */

export async function login(page, email, password) {
  await page.goto('/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  // Wait for redirect to home or profile
  await page.waitForURL(url => url.pathname === '/' || url.pathname === '/profile');
}

export async function logout(page) {
  await page.goto('/profile');
  await page.click('button:has-text("Sign out")');
  await page.waitForURL('/login');
}
