import { h, reducedMotion } from './dom.js';
import { byText, displayLines } from './format.js';
import { createClock, formatTime, hoursKey, shortDay, wallMinutes } from './time.js';
import { canPulse, pulse } from './transition.js';
import { renderEat } from './eat.js';
import { renderShop } from './shop.js';
import { renderArt } from './art.js';

const MODES = { eat: 'Eat', shop: 'Shop', art: 'Art' };
const RENDER = { eat: renderEat, shop: renderShop, art: renderArt };
// A reservation stays "Up next" until 30 minutes after its start, so it still
// shows while people are on their way.
const GRACE_MIN = 30;

const modeFromHash = () => {
  const m = location.hash.slice(1).toLowerCase();
  return m in MODES ? m : null;
};
const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function startApp(data, root) {
  const now = createClock(data.config.timezone);
  const eatSorted = [...data.eat].sort((a, b) => byText(a.date + a.time, b.date + b.time) || byText(a.name, b.name));
  const tripDates = [...data.eat.map((e) => e.date), ...data.art.events.flatMap((e) => e.dates.map((d) => d.date))].sort();
  const trip = tripDates.length ? { start: tripDates[0], end: tripDates[tripDates.length - 1] } : null;

  const liveFns = [];
  const ctx = {
    data,
    now,
    eatSorted,
    live: {
      add(fn) {
        liveFns.push(fn);
        fn(now());
      },
    },
    tripDay: (n) => (trip && n.date >= trip.start && n.date <= trip.end ? hoursKey(n.date) : null),
    isPast: (r, n) => wallMinutes(r.date, r.time) + GRACE_MIN < n.minutes,
    upNext: (n) => eatSorted.find((r) => wallMinutes(r.date, r.time) + GRACE_MIN >= n.minutes) || null,
  };

  const navLinks = Object.entries(MODES).map(([id, label]) =>
    h('a', { class: 'pill mode-btn', href: `#${id}`, 'data-mode': id, 'aria-label': `${label}, ${data.config.taglines[id]}` }, label)
  );
  const nextLink = h('a', { class: 'next link', href: '#eat' });
  const main = h('main', { class: 'view', id: 'main' });
  root.append(
    h(
      'header',
      { class: 'top' },
      h('span', { class: 'mark' }, '/fam'),
      h('nav', { class: 'modes', 'aria-label': 'Lists' }, navLinks),
      h('p', { class: 'top__title' }, data.config.title),
      nextLink
    ),
    main
  );

  ctx.live.add((n) => {
    const next = ctx.upNext(n);
    nextLink.hidden = !next;
    if (next) nextLink.textContent = `Next: ${next.name}, ${shortDay(next.date)} ${formatTime(next.time)}`;
  });

  const views = {};
  function ensure(id) {
    if (!views[id]) {
      const r = RENDER[id](ctx);
      const hero = h(
        'div',
        { class: 'hero' },
        h('h1', { class: 'hero__title display-xl', id: `hero-${id}`, tabindex: '-1' }, MODES[id]),
        h('p', { class: 'hero__tagline' }, displayLines(data.config.taglines[id]).flatMap((line, i) => (i ? [h('br'), line] : [line])))
      );
      const section = h('section', { class: `mode mode--${id}`, 'aria-labelledby': `hero-${id}` }, hero, r.el);
      main.append(section);
      views[id] = { section, hero: hero.firstChild, ...r };
    }
    return views[id];
  }

  let current = null;
  let busy = false;
  function show(id) {
    const v = ensure(id);
    for (const [k, other] of Object.entries(views)) other.section.hidden = k !== id;
    for (const a of navLinks) {
      if (a.dataset.mode === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    current = id;
    window.scrollTo(0, 0);
    v.onShow?.();
  }

  function go(id, { origin, push = true, after } = {}) {
    if (busy) return;
    if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    if (id === current) return after?.();
    const finish = () => {
      views[id].hero.focus({ preventScroll: true });
      after?.();
    };
    if (current === null || reducedMotion() || !canPulse()) {
      show(id);
      return finish();
    }
    busy = true;
    const r = views[current].hero.getBoundingClientRect();
    pulse({
      origin: origin || { x: innerWidth / 2, y: innerHeight / 2 },
      word: MODES[id].toLowerCase(),
      at: { top: r.top + window.scrollY, left: r.left },
      onCovered: () => show(id),
    }).then(() => {
      busy = false;
      finish();
    });
  }

  for (const a of navLinks) {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      go(a.dataset.mode, { origin: centerOf(a) });
    });
  }
  nextLink.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go('eat', { origin: centerOf(nextLink), after: () => views.eat.scrollToNext() });
  });
  const onHistory = () => go(modeFromHash() || 'eat', { push: false });
  window.addEventListener('hashchange', onHistory);
  window.addEventListener('popstate', onHistory);

  const tick = () => {
    const n = now();
    for (const fn of liveFns) fn(n);
  };
  setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });

  const initial = modeFromHash();
  if (!initial) history.replaceState(null, '', '#eat');
  go(initial || 'eat', { push: false });
}
