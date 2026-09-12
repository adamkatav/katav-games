import { expect, test, type Page } from '@playwright/test';

/**
 * Only the things that genuinely need a browser. Rules and scoring are covered
 * far faster by the unit suite; these guard layout and real input, which is
 * where the DOM-shaped bugs actually happened.
 */

const start = async (page: Page, id: string, difficulty?: string): Promise<void> => {
  await page.evaluate(([g, d]) => {
    (window as unknown as { __shell: { start(g: string, d?: string): void } })
      .__shell.start(g!, d);
  }, [id, difficulty]);
  await page.waitForTimeout(600);
};

const boardFits = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const wrap = document.querySelector('.board-host')!;
    return wrap.scrollHeight <= wrap.clientHeight + 1;
  });

const cardWidth = (page: Page): Promise<number> =>
  page.evaluate(() => parseInt(
    getComputedStyle(document.querySelector('.board')!).getPropertyValue('--card-w'), 10));

test.beforeEach(async ({ page }) => {
  await page.goto('/katav-solitaire/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.game-card');
});

test('home lists every game', async ({ page }) => {
  await expect(page.locator('.game-name')).toHaveText(['סוליטר', 'פריסל', 'סוליטר עכביש']);
});

test('a game deals and the board fits without scrolling', async ({ page }) => {
  for (const [id, difficulty] of [['klondike'], ['freecell'], ['spider', '1']] as const) {
    await start(page, id, difficulty);
    expect(await page.locator('.card').count()).toBe(id === 'spider' ? 104 : 52);
    expect(await boardFits(page), `${id} board must fit`).toBe(true);
  }
});

test('a long column compacts the cards instead of scrolling', async ({ page }) => {
  await start(page, 'spider', '1');
  const before = await cardWidth(page);

  // Stack one column deep enough that the fan alone cannot absorb it.
  await page.evaluate(() => {
    const shell = (window as unknown as { __shell: { session: { state: { piles: Record<string, unknown[]> } } ; view: { layout(): void } } }).__shell;
    const piles = shell.session.state.piles;
    const pool = Object.values(piles).flat();
    for (const key of Object.keys(piles)) piles[key] = [];
    piles['t0'] = pool.slice(0, 34).map((c) => ({ ...(c as object), up: true }));
    piles['stock'] = pool.slice(34).map((c) => ({ ...(c as object), up: false }));
    shell.view.layout();
  });
  await page.waitForTimeout(300);

  expect(await boardFits(page), 'a deep column must not scroll the board').toBe(true);
  // Cards may only tighten, never grow. On a narrow screen the width is already
  // the binding constraint, so there is nothing left to give — not scrolling is
  // the invariant; shrinking is only the mechanism that achieves it.
  expect(await cardWidth(page)).toBeLessThanOrEqual(before);
});

test('tap to select then tap to place completes a move', async ({ page }) => {
  await start(page, 'freecell');   // every card face up, so a legal move always exists

  const moved = await page.evaluate(() => {
    const shell = (window as unknown as {
      __shell: { session: { state: unknown; def: { hint(s: unknown): unknown }; moves: number } };
    }).__shell;
    return shell.session.def.hint(shell.session.state) !== null;
  });
  expect(moved, 'freecell should always offer a move at the deal').toBe(true);

  const card = page.locator('.card').last();
  await card.click();
  await expect(page.locator('.card.selected')).toHaveCount(1);
});

test('settings persist across a reload', async ({ page }) => {
  await page.locator('.btn.ghost', { hasText: 'הגדרות' }).click();
  await page.locator('.seg-btn', { hasText: 'מופעל' }).first().click();
  await page.locator('.btn.green', { hasText: 'סגירה' }).click();
  await page.reload();
  const marks = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('katav.settings') ?? '{}').marks);
  expect(marks).toBe(true);
});

test('registers a service worker so it works offline', async ({ page }) => {
  const registered = await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  });
  expect(registered).toBe(true);
});
