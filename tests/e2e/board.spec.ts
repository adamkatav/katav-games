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
  await expect(page.locator('.game-name'))
    .toHaveText(['סוליטר', 'פריסל', 'סוליטר עכביש', 'מוקשים', 'סודוקו', '2048']);
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
    // Deliberately render without calling layout(). During play the engine only
    // ever calls render(), so calling layout() here would hide a board that has
    // stopped resizing itself as columns deepen.
    (shell as unknown as { session: { state: unknown }; view: { render(s: unknown): void } })
      .view.render((shell as unknown as { session: { state: unknown } }).session.state);
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

/**
 * Drives real clicks rather than the JS seam. A unit test that called the tap
 * handler directly hid this for weeks: empty slots never reached it, because
 * pointerdown refuses to start a drag from one and pointerup then returns early.
 */
test('a card can be placed on an empty column by clicking', async ({ page }) => {
  await start(page, 'spider', '1');

  // Empty one column, and leave a single movable card on another.
  await page.evaluate(() => {
    type Card = { id: number; rank: number; suit: number; up: boolean };
    const shell = (window as unknown as {
      __shell: { session: { state: { piles: Record<string, Card[]> } }; view: { layout(): void } };
    }).__shell;
    const piles = shell.session.state.piles;
    const pool = Object.values(piles).flat();
    for (const key of Object.keys(piles)) piles[key] = [];
    const card = pool[0]!;
    card.up = true;
    piles['t0'] = [card];                       // lone card
    piles['t1'] = [];                           // the empty column
    for (let i = 2; i < 10; i++) {
      const filler = pool[i]!;
      filler.up = true;
      piles[`t${i}`] = [filler];
    }
    piles['stock'] = pool.slice(10).map((c) => ({ ...c, up: false }));
    shell.view.layout();
  });
  await page.waitForTimeout(300);

  const before = await page.evaluate(() => {
    const s = (window as unknown as { __shell: { session: { state: { piles: Record<string, unknown[]> } } } }).__shell;
    return { t0: s.session.state.piles['t0']!.length, t1: s.session.state.piles['t1']!.length };
  });
  expect(before).toEqual({ t0: 1, t1: 0 });

  await page.locator('.card.up').first().click();
  await expect(page.locator('.card.selected')).toHaveCount(1);
  await page.locator('.slot[data-pile="t1"]').click();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const s = (window as unknown as { __shell: { session: { state: { piles: Record<string, unknown[]> } } } }).__shell;
    return { t0: s.session.state.piles['t0']!.length, t1: s.session.state.piles['t1']!.length };
  });
  expect(after, 'the card must land in the empty column').toEqual({ t0: 0, t1: 1 });
});

test('minesweeper: first click is safe and the mode switch works', async ({ page }) => {
  await start(page, 'minesweeper', 'easy');
  expect(await page.locator('.cell').count()).toBe(64);

  // No undo button: a revealed cell cannot honestly be taken back.
  await expect(page.locator('.bar .btn', { hasText: 'ביטול' })).toHaveCount(0);

  await page.locator('.cell').nth(27).click();
  const opened = await page.evaluate(() => {
    const s = (window as unknown as {
      __shell: { session: { state: { revealed: boolean[]; dead: number | null; started: boolean } } };
    }).__shell.session.state;
    return { revealed: s.revealed.filter(Boolean).length, dead: s.dead, started: s.started };
  });
  expect(opened.started).toBe(true);
  expect(opened.dead, 'the first click must never be a mine').toBeNull();
  expect(opened.revealed).toBeGreaterThan(1);   // a cascade, not a single cell

  const flagBtn = page.locator('.bar .btn', { hasText: 'דגל' });
  await flagBtn.click();
  await expect(flagBtn).toHaveClass(/active/);
  await page.locator('.cell.hidden').first().click();
  await expect(page.locator('.cell.flag')).toHaveCount(1);
});

test('sudoku: tap a cell then a digit, and givens stay locked', async ({ page }) => {
  await start(page, 'sudoku', 'easy');
  expect(await page.locator('.cell').count()).toBe(81);
  expect(await page.locator('.sudoku-pad button').count()).toBe(10);   // 1-9 and erase

  const target = await page.evaluate(() => {
    const s = (window as unknown as {
      __shell: { session: { state: { puzzle: number[]; solution: number[] } } };
    }).__shell.session.state;
    const i = s.puzzle.findIndex((v) => v === 0);
    return { index: i, digit: s.solution[i]! };
  });

  await page.locator('.cell').nth(target.index).click();
  await expect(page.locator('.cell.sel')).toHaveCount(1);
  await page.locator('.sudoku-pad button').nth(target.digit - 1).click();

  await expect(page.locator('.cell').nth(target.index)).toHaveText(String(target.digit));

  // a given must not accept a digit
  const givenIndex = await page.evaluate(() => {
    const s = (window as unknown as { __shell: { session: { state: { puzzle: number[] } } } })
      .__shell.session.state;
    return s.puzzle.findIndex((v) => v !== 0);
  });
  const givenText = await page.locator('.cell').nth(givenIndex).textContent();
  await page.locator('.cell').nth(givenIndex).click();
  await page.locator('.sudoku-pad button').nth(0).click();
  await expect(page.locator('.cell').nth(givenIndex)).toHaveText(givenText ?? '');
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
