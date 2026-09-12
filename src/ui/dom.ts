/** Tiny DOM helpers. Enough structure to stay readable without a framework. */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key === 'html') {
      el.innerHTML = String(value);
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export const clear = (el: HTMLElement): void => { el.innerHTML = ''; };

/** Append, skipping the nulls that conditional children produce. */
export function append(parent: HTMLElement, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function button(
  label: string, icon: string, onClick: () => void,
  tone: 'blue' | 'green' | 'red' | 'ghost' = 'blue',
): HTMLButtonElement {
  return h('button', { class: `btn ${tone}`, onclick: onClick },
    h('span', { class: 'icon' }, icon),
    label ? h('span', {}, label) : null);
}

/** Non-blocking message. One at a time; a new one replaces the old. */
let toastTimer: number | undefined;
export function toast(message: string): void {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = h('div', { class: 'toast' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('on'), 2400);
}

export function confetti(durationMs = 4200): void {
  const canvas = h('canvas', { class: 'confetti' });
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colours = ['#ffc531', '#ff6b6b', '#4ecdc4', '#5b9bd5', '#a888ff', '#7ed957'];
  const parts = Array.from({ length: 170 }, (_, i) => ({
    x: Math.random() * canvas.width,
    y: -Math.random() * canvas.height * 0.6,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 2 + Math.random() * 3.6,
    w: 7 + Math.random() * 9,
    hh: 9 + Math.random() * 11,
    a: Math.random() * 6.3,
    va: (Math.random() - 0.5) * 0.28,
    c: colours[i % colours.length]!,
  }));

  const end = Date.now() + durationMs;
  const frame = (): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.a += p.va;
      if (p.y > canvas.height + 24) { p.y = -20; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.hh / 2, p.w, p.hh);
      ctx.restore();
    }
    if (Date.now() < end) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
