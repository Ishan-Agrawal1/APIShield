import { test, expect } from '@playwright/test';

test('dashboard loads, shows authorized-use notice, and does not store operator tokens', async ({ page }) => {
  const consoleText = [];
  page.on('console', (message) => consoleText.push(message.text()));
  await page.goto('/');
  await expect(page.getByText('Authorized use only')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Upload spec' })).toBeVisible();
  await page.getByRole('link', { name: 'Upload spec' }).click();
  await expect(page.getByRole('heading', { name: 'Upload OpenAPI' })).toBeVisible();
  await page.getByRole('link', { name: 'New scan' }).click();
  await expect(page.getByRole('heading', { name: 'Configure scan' })).toBeVisible();
  const local = await page.evaluate(() => JSON.stringify(localStorage));
  const session = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(local.toLowerCase().includes('bearer')).toBeFalsy();
  expect(session.toLowerCase().includes('token')).toBeFalsy();
  expect(consoleText.join('\n').toLowerCase()).not.toMatch(/bearer [a-z0-9]/i);
});

test('connected upload → discovery → scan → findings → report', async ({ page }) => {
  test.skip(!process.env.E2E_FULL, 'Requires a running local stack (set E2E_FULL=1).');
  await page.goto('/specifications/new');
  const spec = process.env.E2E_OPENAPI;
  test.skip(!spec, 'E2E_OPENAPI document is required for the connected browser flow.');
  await page.getByLabel('Document').fill(spec);
  await page.getByRole('button', { name: 'Parse and discover' }).click();
  await expect(page.getByText(/operations/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('link', { name: 'Configure scan' }).click();
  await page.getByRole('button', { name: 'Preview cases' }).click();
  await expect(page.getByText(/Generated/)).toBeVisible();
  await page.getByRole('button', { name: 'Start scan' }).click();
  await expect(page.getByText(/Status:/)).toBeVisible();
  await expect(page.getByText(/No findings in tested scope|BOLA_READ_CROSS_USER|AUTH_BYPASS/)).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole('link', { name: 'Open report' }).click();
  await expect(page.getByRole('heading', { name: 'Report' })).toBeVisible();
  const local = await page.evaluate(() => JSON.stringify(localStorage));
  expect(local.toLowerCase().includes('password')).toBeFalsy();
});
