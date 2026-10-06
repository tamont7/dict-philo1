import { test, expect } from '@playwright/test';

test('Browse, search, read, save and return with filters preserved', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dictionnaire de philosophie' })).toBeVisible();
  await expect(page.locator('#du-jour h2')).not.toBeEmpty();
  await expect(page.locator('.entry-card')).toHaveCount(24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png` });
  await page.locator('#search').fill('liberte');
  await expect(page.locator('.entry-card').first().getByRole('heading')).toHaveText('liberté');
  await page.locator('.entry-card').first().getByRole('heading').getByRole('link').click();
  await expect(page).toHaveURL(/\/entree\/liberte$/);
  await expect(page.locator('.reader h1')).toHaveText('liberté');
  await expect(page.locator('.reader-text')).toContainText('Liberté et contrainte');
  await page.screenshot({ path: `test-results/reader-${test.info().project.name}.png` });
  await page.locator('.reader-title [data-save]').click();
  await expect(page.locator('#saved-count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('.reader-title [data-save]')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Mes favoris/ }).click();
  await expect(page.locator('.entry-card')).toHaveCount(1);
  await expect(page.locator('.entry-card h3')).toHaveText('liberté');
  await page.locator('.entry-card [data-save]').click();
  await expect(page.locator('.empty-state')).toContainText('Aucun favori enregistré');
  expect(errors).toEqual([]);
});

test('Letters, pagination, history and empty results', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Lettre E', exact: true }).click();
  await expect(page.locator('#results-count')).toContainText('Lettre E');
  await expect(page).toHaveURL(/lettre=E/);
  await page.locator('[data-kind="philosophe"]').click();
  await expect(page.locator('.entry-card .entry-kind').first()).toHaveText('Auteur');
  await page.locator('#reset-filters').click();
  await page.getByRole('button', { name: 'Page suivante', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  const title = await page.locator('.entry-card h3').first().textContent();
  await page.locator('.entry-card h3 a').first().click();
  await page.goBack();
  await expect(page.locator('.entry-card h3').first()).toHaveText(title);
  await page.locator('#search').fill('zzzzunknown');
  await expect(page.locator('.empty-state')).toContainText('Aucune entrée trouvée');
});

test('Deep links, cross-references, theme and responsive width', async ({ page }) => {
  await page.goto('/entree/absolu');
  await expect(page.locator('.reader h1')).toHaveText('absolu');
  await page.locator('.reference-link').first().click();
  await expect(page).not.toHaveURL(/absolu$/);
  await expect(page.locator('.reader h1')).toBeVisible();
  await page.getByRole('button', { name: 'Activer le thème sombre' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

});

test('Daily card updates across Paris midnight without a deployment', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-06T21:59:58Z') });
  await page.goto('/');
  const before = await page.locator('#du-jour h2').innerText();
  await page.clock.runFor(3000);
  await expect(page.locator('#du-jour h2')).not.toHaveText(before);
  await expect(page.locator('.daily-date')).toHaveText('7 octobre 2026');
});

test('Reading uses book-inspired typography and needs no original images or fonts', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/entree/croyance');
  await expect(page.locator('.reader h1')).toHaveText('croyance');
  await expect(page.getByRole('region', { name: 'Définition', exact: true })).toBeVisible();
  await expect(page.locator('.definition-panel .sense-label').first()).toHaveText('Sens ordinaire.');
  await expect(page.locator('a[href*="ouvrage"], a[href*="/livre/"]')).toHaveCount(0);
  expect(requests.some(url => url.includes('/livre/') || url.includes('/OPS/') || /\.otf($|\?)/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/croyance-${test.info().project.name}.png`, fullPage: true });
  await page.goto('/entree/liberte');
  await expect(page.locator('.reader-text h2').first()).toHaveText('Liberté et contrainte');
  await page.locator('.reference-link').first().click();
  await expect(page.locator('.reader h1')).toBeVisible();
  await page.goto('/entree/acquis');
  await expect(page.locator('.block-related .reference-link')).toHaveAttribute('href', '/entree/inne-acquis');
  await page.locator('.block-related .reference-link').click();
  await expect(page.locator('.reader h1')).toHaveText('inné/acquis');
});
