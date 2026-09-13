import { devices, expect, test, type Page } from '@playwright/test';

/**
 * A Pixel 7, held both ways up, installed and in a tab.
 *
 * The installed app has no browser chrome, so it is *taller* than a tab —
 * which is why a bug can hide in one and not the other, and why all four sizes
 * are here rather than the one the phone project already covers.
 */

const SIZES = [
  { name: 'installed, upright', width: 412, height: 915 },
  { name: 'in a tab, upright', width: 412, height: 839 },
  { name: 'installed, sideways', width: 915, height: 412 },
  { name: 'in a tab, sideways', width: 863, height: 360 },
] as const;

const GAMES = [
  ['klondike', undefined],
  ['freecell', undefined],
  ['spider', '4'],
  ['sudoku', 'hard'],
  ['g2048', undefined],
] as const;

/** Board, toolbar and controls all inside the space the board host has. */
const boardFits = (page: Page): Promise<{ over: string } | null> => page.evaluate(() => {
  const host = document.querySelector('.board-host');
  if (!host) return { over: 'no board at all' };
  const dx = host.scrollWidth - host.clientWidth;
  const dy = host.scrollHeight - host.clientHeight;
  return dx > 1 || dy > 1 ? { over: `${dx}px across, ${dy}px down` } : null;
});

/** Nothing inside the live screen may sit outside the viewport. */
const offScreen = (page: Page): Promise<string[]> => page.evaluate(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const out: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('.screen:not([hidden]) *')) {
    if (el.closest('.board-host')) continue;          // the board scrolls on its own
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right < -1 || r.left > vw + 1 || r.bottom < -1 || r.top > vh + 1
      || r.left < -1 || r.right > vw + 1) {
      out.push(`${el.className || el.tagName} at ${Math.round(r.left)}…${Math.round(r.right)}`);
    }
  }
  return out;
});

const start = (page: Page, id: string, difficulty?: string): Promise<void> =>
  page.evaluate(([g, d]) => {
    (window as unknown as { __shell: { start(g: string, d?: string): void } }).__shell.start(g!, d);
  }, [id, difficulty]);

/** Force the combo chip on — it only shows from streak 2, mid-round. */
const showCombo = (page: Page): Promise<void> => page.evaluate(() => {
  const s = (window as unknown as {
    __shell: { session: { score: { streak: number }; commit(f: () => void, o: unknown): void } };
  }).__shell.session;
  s.score.streak = 4;
  s.commit(() => { /* nothing changes; this just redraws the bar */ },
    { free: true, undoable: false });
});

for (const size of SIZES) {
  test(`pixel 7 ${size.name}: nothing runs off the screen`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'this spec brings its own viewports');

    const context = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: size.width, height: size.height },
    });
    const page = await context.newPage();
    await page.goto('/katav-games/');
    await page.waitForSelector('.game-card');
    await page.waitForTimeout(350);

    expect(await offScreen(page), 'the home screen').toEqual([]);

    for (const [id, difficulty] of GAMES) {
      await start(page, id, difficulty);
      await page.waitForTimeout(650);
      expect(await boardFits(page), `${id} at the deal`).toBeNull();

      // The combo chip is a sixth item in a row that was already full: on one
      // nowrap line it pushed itself off the left edge of an RTL screen, and
      // the taller toolbar it wraps into has to come out of the board.
      await showCombo(page);
      await page.waitForTimeout(350);
      await expect(page.locator('.stat.streak')).toBeVisible();
      expect(await offScreen(page), `${id} with the combo chip showing`).toEqual([]);
      expect(await boardFits(page), `${id} with the combo chip showing`).toBeNull();
    }

    await context.close();
  });
}

/**
 * Minesweeper keeps the real Windows board sizes, and on a phone only the 9x9
 * fits. 16 columns at a cell this player can read and hit is 510px across and
 * 30 columns is 958; a 412px phone has neither. Shrinking to fit would mean a
 * 23px target, well under what a finger can hit — so the bigger boards scroll
 * instead, deliberately. Pinned here so it stays a decision rather than a
 * surprise, and so the 9x9 can never quietly join them.
 */
test('minesweeper: beginner fits a phone, the classic bigger boards scroll',
  async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'this spec brings its own viewports');

    const context = await browser.newContext({
      ...devices['Pixel 7'], viewport: { width: 412, height: 915 },
    });
    const page = await context.newPage();
    await page.goto('/katav-games/');
    await page.waitForSelector('.game-card');

    await start(page, 'minesweeper', 'easy');
    await page.waitForTimeout(650);
    expect(await boardFits(page), 'the 9x9 board must fit a phone').toBeNull();
    expect(await offScreen(page), 'and its toolbar with it').toEqual([]);

    for (const big of ['medium', 'hard']) {
      await start(page, 'minesweeper', big);
      await page.waitForTimeout(650);
      expect(await boardFits(page), `${big} is expected to scroll sideways`).not.toBeNull();
    }

    await context.close();
  });
