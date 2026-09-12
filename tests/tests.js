/* Test suite for the game box.
   Runs against a game page loaded with ?test=1, which exposes window.__GAME.
   Every case here corresponds to a bug that actually shipped at some point. */
(function (global) {
  'use strict';

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  function eq(a, b, msg) {
    if (a !== b) throw new Error(`${msg || 'expected'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
  }
  function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

  // ---------- helpers -------------------------------------------------------
  function G() { return global.__GAME; }
  function S() { return G().S; }
  function allCards() { return Object.values(S().piles).flat(); }
  function find(r, s) { return allCards().find(c => c.r === r && c.s === s); }

  /** Wipe the board and place exactly what a test needs. */
  function setup(game, suits, place) {
    G().startGame(game, suits);
    const s = S();
    const all = Object.values(s.piles).flat();
    Object.keys(s.piles).forEach(k => (s.piles[k].length = 0));
    const used = place(s, (r, su) => all.find(c => c.r === r && c.s === su), all) || [];

    // Park everything the test doesn't use. FreeCell has no stock pile, so make
    // one, and hide the parked elements so they can't skew a layout measurement.
    if (!s.piles.stock) s.piles.stock = [];
    const parked = all.filter(c => !used.includes(c));
    parked.forEach(c => { c.u = false; s.piles.stock.push(c); });
    const E = G().els();
    parked.forEach(c => { if (E[c.i]) E[c.i].style.display = 'none'; });
    used.forEach(c => { if (E[c.i]) E[c.i].style.display = ''; });
    s.hidden0 = s.hidden0 ?? 0;
    Object.assign(s, { bonus: 0, peak: 0, score: 0, combo: 0, fanCap: 0 });
    s.score = G().boardScore();
    s.peak = s.score;
    G().layout(); G().render(); G().syncEmpties(false);
    return s;
  }

  // ---------- deck integrity ------------------------------------------------
  test('klondike deals 52 distinct cards, 7 face up', () => {
    G().startGame('klondike');
    const cards = allCards();
    eq(cards.length, 52, 'deck size');
    eq(new Set(cards.map(c => c.i)).size, 52, 'distinct ids');
    eq(G().tabs().filter(p => S().piles[p].some(c => c.u)).length, 7, 'columns with a face-up card');
  });

  [1, 2, 4].forEach(suits => {
    test(`spider ${suits}-suit deals 104 cards from ${suits} suit(s)`, () => {
      G().startGame('spider', suits);
      const cards = allCards();
      eq(cards.length, 104, 'deck size');
      eq(new Set(cards.map(c => c.i)).size, 104, 'distinct ids');
      eq(new Set(cards.map(c => c.s)).size, suits, 'suits in play');
    });
  });

  // ---------- klondike rules ------------------------------------------------
  test('klondike: empty column takes a king only', () => {
    setup('klondike', 1, (s, f) => {
      const k = f(13, 0), t = f(10, 2);
      k.u = t.u = true; s.piles.t1.push(k); s.piles.t2.push(t);
      return [k, t];
    });
    ok(G().canDrop([find(13, 0)], 't0', 't1'), 'king into empty');
    ok(!G().canDrop([find(10, 2)], 't0', 't2'), 'ten into empty must be refused');
  });

  test('klondike: tableau needs descending rank and alternating colour', () => {
    setup('klondike', 1, (s, f) => {
      const j = f(11, 2), t1 = f(10, 0), t2 = f(10, 1), n = f(9, 0);
      [j, t1, t2, n].forEach(c => (c.u = true));
      s.piles.t0.push(j); s.piles.t1.push(t1); s.piles.t2.push(t2); s.piles.t3.push(n);
      return [j, t1, t2, n];
    });
    ok(G().canDrop([find(10, 0)], 't0', 't1'), 'black 10 on red J');
    ok(!G().canDrop([find(10, 1)], 't0', 't2'), 'red 10 on red J must be refused');
    ok(!G().canDrop([find(9, 0)], 't0', 't3'), 'wrong rank must be refused');
  });

  test('klondike: foundation starts at ace and follows suit', () => {
    setup('klondike', 1, (s, f) => {
      const a = f(1, 0), two = f(2, 0), twoOther = f(2, 1);
      [a, two, twoOther].forEach(c => (c.u = true));
      s.piles.t0.push(a); s.piles.t1.push(two); s.piles.t2.push(twoOther);
      return [a, two, twoOther];
    });
    ok(!G().canDrop([find(2, 0)], 'f0', 't1'), 'non-ace cannot open a foundation');
    ok(G().canDrop([find(1, 0)], 'f0', 't0'), 'ace opens a foundation');
    G().doMove('t0', 0, 'f0');
    ok(G().canDrop([find(2, 0)], 'f0', 't1'), 'same suit continues');
    ok(!G().canDrop([find(2, 1)], 'f0', 't2'), 'other suit must be refused');
  });

  // ---------- freecell rules ------------------------------------------------
  test('freecell deals 52 face-up cards as 7/7/7/7/6/6/6/6', () => {
    G().startGame('freecell');
    const cards = allCards();
    eq(cards.length, 52, 'deck size');
    eq(new Set(cards.map(c => c.i)).size, 52, 'distinct ids');
    ok(cards.every(c => c.u), 'every card is face up');
    eq(G().tabs().map(p => S().piles[p].length).join(','), '7,7,7,7,6,6,6,6', 'column sizes');
  });

  test('freecell: an empty column takes any card, unlike klondike', () => {
    setup('freecell', 1, (s, f) => {
      const t = f(10, 2); t.u = true; s.piles.t1.push(t); return [t];
    });
    ok(G().canDrop([find(10, 2)], 't0', 't1'), 'a ten may enter an empty column');
  });

  test('freecell: a free cell holds exactly one card', () => {
    setup('freecell', 1, (s, f) => {
      const a = f(10, 2), b = f(4, 0);
      [a, b].forEach(c => (c.u = true));
      s.piles.t0.push(a); s.piles.t1.push(b);
      return [a, b];
    });
    ok(G().canDrop([find(10, 2)], 'e0', 't0'), 'empty cell accepts a card');
    G().doMove('t0', 0, 'e0');
    ok(!G().canDrop([find(4, 0)], 'e0', 't1'), 'occupied cell must refuse');
    ok(G().canDrop([find(4, 0)], 'e1', 't1'), 'another empty cell still accepts');
  });

  test('freecell: run size is limited by free cells and empty columns', () => {
    // 3 cards stacked, all four cells full -> only one card may move
    setup('freecell', 1, (s, f) => {
      const run = [f(8, 0), f(7, 1), f(6, 0)];
      run.forEach(c => (c.u = true));
      s.piles.t0.push(...run);
      const nine = f(9, 1); nine.u = true; s.piles.t1.push(nine);
      const fillers = [f(2, 0), f(3, 0), f(4, 0), f(5, 0)];
      fillers.forEach((c, i) => { c.u = true; s.piles['e' + i].push(c); });
      // every other column occupied so there are no empty columns either
      const pad = [f(13, 0), f(13, 1), f(13, 2), f(13, 3), f(12, 0), f(12, 1)];
      pad.forEach((c, i) => { c.u = true; s.piles['t' + (i + 2)].push(c); });
      return [...run, nine, ...fillers, ...pad];
    });
    eq(G().canDrop([find(8, 0), find(7, 1), find(6, 0)], 't1', 't0'), false,
      'three cards with no free cells must be refused');
    ok(/תאים פנויים/.test(G().whyNot([find(8, 0), find(7, 1), find(6, 0)], 't1')),
      'refusal explains the free-cell limit');
    ok(G().canDrop([find(6, 0)], 't1', 't0') === false, 'six does not fit on nine');
  });

  test('freecell: foundations still run ace to king by suit', () => {
    setup('freecell', 1, (s, f) => {
      const a = f(1, 0), two = f(2, 0);
      [a, two].forEach(c => (c.u = true));
      s.piles.t0.push(a); s.piles.t1.push(two);
      return [a, two];
    });
    ok(G().canDrop([find(1, 0)], 'f0', 't0'), 'ace opens');
    G().doMove('t0', 0, 'f0');
    ok(G().canDrop([find(2, 0)], 'f0', 't1'), 'two follows');
  });

  // ---------- spider rules --------------------------------------------------
  test('spider: any suit may stack, only same-suit runs may move together', () => {
    setup('spider', 2, (s, f) => {
      const a = f(8, 0), b = f(7, 1), c = f(6, 1);
      [a, b, c].forEach(x => (x.u = true));
      s.piles.t0.push(a); s.piles.t1.push(b, c);
      return [a, b, c];
    });
    ok(G().canDrop([find(7, 1)], 't0', 't1'), 'mixed suit may stack');
    ok(G().canGrab('t1', 0), 'same-suit descending run is grabbable');
    setup('spider', 2, (s, f) => {
      const b = f(7, 1), c = f(6, 0);
      [b, c].forEach(x => (x.u = true));
      s.piles.t1.push(b, c);
      return [b, c];
    });
    ok(!G().canGrab('t1', 0), 'mixed-suit run must not be grabbable as a unit');
  });

  test('spider: a full K-to-A run completes and leaves the tableau', () => {
    setup('spider', 1, (s, f, all) => {
      const used = [];
      for (let r = 13; r >= 1; r--) {
        const c = all.find(x => x.r === r && !used.includes(x));
        c.u = true; s.piles.t0.push(c); used.push(c);
      }
      return used;
    });
    G().checkSets();
    eq(S().piles.t0.length, 0, 'column emptied');
    eq(G().founds().filter(p => S().piles[p].length === 13).length, 1, 'one completed set');
  });

  // ---------- scoring: the exploits -----------------------------------------
  test('klondike: foundation round trips cannot farm points', () => {
    setup('klondike', 1, (s, f) => {
      const a = f(1, 0); a.u = true; s.piles.t0.push(a); return [a];
    });
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      G().pushUndo(); G().doMove('t0', 0, 'f0'); seen.add(S().score);
      G().pushUndo(); G().doMove('f0', 0, 't0'); seen.add(S().score);
    }
    eq(seen.size, 2, 'score must only ever oscillate between two values');
    eq(S().bonus, 0, 'no bonus may accrue from a round trip');
  });

  test('spider: join/unjoin cannot farm points', () => {
    setup('spider', 1, (s, f, all) => {
      const a = all.find(c => c.r === 8), b = all.find(c => c.r === 7);
      a.u = b.u = true; s.piles.t0.push(a); s.piles.t1.push(b);
      return [a, b];
    });
    const seen = new Set();
    for (let i = 0; i < 5; i++) {
      G().pushUndo(); G().doMove('t1', 0, 't0'); seen.add(S().score);
      G().pushUndo(); G().doMove('t0', 1, 't1'); seen.add(S().score);
    }
    eq(seen.size, 2, 'score must only ever oscillate between two values');
    eq(S().bonus, 0, 'no bonus may accrue from a round trip');
  });

  test('score always equals boardScore plus banked bonus', () => {
    G().startGame('klondike');
    for (let i = 0; i < 60; i++) {
      const h = G().findHint();
      if (!h) break;
      if (h.stock) { G().clickStock(); continue; }
      G().pushUndo(); G().doMove(h.from, h.idx, h.to);
      eq(S().score, G().boardScore() + S().bonus, `invariant broke at move ${i}`);
    }
  });

  // ---------- combo ---------------------------------------------------------
  test('combo builds on progress and survives a neutral setup move', () => {
    const s = setup('klondike', 1, (s, f) => {
      const aces = [0, 1, 2, 3].map(su => f(1, su));
      aces.forEach((c, i) => { c.u = true; s.piles['t' + i].push(c); });
      const ten = f(10, 0), jack = f(11, 2);
      ten.u = jack.u = true; s.piles.t4.push(ten); s.piles.t5.push(jack);
      return [...aces, ten, jack];
    });
    for (let i = 0; i < 3; i++) { G().pushUndo(); G().doMove('t' + i, 0, 'f' + i); }
    eq(s.combo, 3, 'three scoring moves build a streak of three');
    G().pushUndo(); G().doMove('t4', 0, 't5');       // empties a column, scores nothing
    eq(s.combo, 3, 'a neutral setup move must not break the streak');
  });

  test('combo breaks when a move undoes progress', () => {
    const s = setup('klondike', 1, (s, f) => {
      const a = f(1, 0); a.u = true; s.piles.t0.push(a); return [a];
    });
    G().pushUndo(); G().doMove('t0', 0, 'f0');
    ok(s.combo >= 1, 'streak started');
    G().pushUndo(); G().doMove('f0', 0, 't0');
    eq(s.combo, 0, 'pulling off a foundation must break the streak');
  });

  test('undo restores the streak', () => {
    const s = setup('klondike', 1, (s, f) => {
      const aces = [0, 1, 2, 3].map(su => f(1, su));
      aces.forEach((c, i) => { c.u = true; s.piles['t' + i].push(c); });
      return aces;
    });
    for (let i = 0; i < 4; i++) { G().pushUndo(); G().doMove('t' + i, 0, 'f' + i); }
    const before = { combo: s.combo, score: s.score };
    eq(before.combo, 4, 'streak of four');
    G().pushUndo(); G().doMove('f0', 0, 't0');
    eq(S().combo, 0, 'streak broken');
    G().undo();
    eq(S().combo, before.combo, 'undo must hand the streak back');
    eq(S().score, before.score, 'undo must restore the score');
  });

  test('asking for a hint breaks the streak, but not when there is none to give', () => {
    const s = setup('klondike', 1, (s, f) => {
      const aces = [0, 1, 2, 3].map(su => f(1, su));
      aces.forEach((c, i) => { c.u = true; s.piles['t' + i].push(c); });
      return aces;
    });
    for (let i = 0; i < 3; i++) { G().pushUndo(); G().doMove('t' + i, 0, 'f' + i); }
    ok(S().combo >= 2, 'streak running');
    G().hint();
    eq(S().combo, 0, 'a hint must break the streak');

    setup('klondike', 1, (s, f) => {
      const five = f(5, 0); five.u = true; s.piles.t0.push(five); return [five];
    });
    S().piles.stock.length = 0;
    S().combo = 4;
    G().hint();
    eq(S().combo, 4, 'no hint available must not cost the streak');
  });

  // ---------- refusal messages ---------------------------------------------
  test('a refused move explains itself', () => {
    setup('klondike', 1, (s, f) => {
      const t = f(10, 2); t.u = true; s.piles.t1.push(t); return [t];
    });
    ok(/מלך/.test(G().whyNot([find(10, 2)], 't0')), 'empty column mentions the king rule');
    ok(/אס/.test(G().whyNot([find(10, 2)], 'f0')), 'empty foundation mentions the ace rule');
    setup('spider', 1, (s, f, all) => {
      const c = all[0]; c.u = true; s.piles.t1.push(c); return [c];
    });
    eq(G().whyNot([S().piles.t1[0]], 't0'), '', 'spider empty column needs no explanation');
  });

  // ---------- layout --------------------------------------------------------
  [
    ['klondike', 1, [8, 13, 19, 24]],
    ['spider', 1, [13, 20, 30, 40]],
    ['freecell', 1, [12, 20, 28]]
  ].forEach(([game, suits, lengths]) => {
    lengths.forEach(n => {
      test(`${game}: a ${n}-card column compacts instead of scrolling`, () => {
        setup(game, suits, (s, f, all) => {
          const used = all.slice(0, n);
          used.forEach(c => { c.u = true; s.piles.t0.push(c); });
          return used;
        });
        const w = G().wrap();
        ok(w.scrollHeight <= w.clientHeight + 1,
          `board ${w.scrollHeight}px must fit wrap ${w.clientHeight}px`);
        ok(G().dims().CW >= 20, 'cards must stay above the minimum size');
      });
    });
  });

  test('card size shrinks monotonically as a column grows', () => {
    const widths = [6, 12, 20].map(n => {
      setup('klondike', 1, (s, f, all) => {
        const used = all.slice(0, n);
        used.forEach(c => { c.u = true; s.piles.t0.push(c); });
        return used;
      });
      return G().dims().CW;
    });
    ok(widths[0] >= widths[1] && widths[1] >= widths[2],
      `expected non-increasing widths, got ${widths}`);
  });

  // ---------- runner --------------------------------------------------------
  global.runTests = function () {
    const results = [];
    for (const t of tests) {
      try { t.fn(); results.push({ name: t.name, pass: true }); }
      catch (e) { results.push({ name: t.name, pass: false, error: e.message }); }
    }
    return { total: results.length, failed: results.filter(r => !r.pass).length, results };
  };
})(window);
