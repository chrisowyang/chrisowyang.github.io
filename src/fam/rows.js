// Pieces shared by Shop and Art rows.
import { h, reducedMotion } from './dom.js';
import { directionsUrl, hasCoords } from './format.js';
import { formatRange, isOpenAt } from './time.js';

const DAYS = [
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
];

export const directionsLink = (place) =>
  h(
    'a',
    { class: 'pill', href: directionsUrl(place), target: '_blank', rel: 'noopener', 'aria-label': `Directions to ${place.name}` },
    'Directions'
  );

export const textLink = (href, label, name) =>
  h('a', { class: 'link', href, target: '_blank', rel: 'noopener', 'aria-label': name ? `${label} for ${name}` : null }, label);

// Fri / Sat / Sun hours. null is "Closed", a missing day is "Check hours".
export function hoursBlock(place, ctx) {
  if (!place.hours) return h('p', { class: 'hours-missing' }, 'Check hours');
  const cells = DAYS.map(([key, label]) => {
    const v = place.hours[key];
    const text = v === undefined ? 'Check hours' : v === null ? 'Closed' : formatRange(v);
    return h('div', { class: 'hours__day', 'data-day': key }, h('dt', null, label), h('dd', null, text));
  });
  ctx.live.add((now) => {
    const key = ctx.tripDay(now);
    for (const c of cells) c.classList.toggle('is-today', c.dataset.day === key);
  });
  return h('dl', { class: 'hours' }, cells);
}

// "Open now" or "Closed now", only on trip days and only when we know the hours.
export function statusLabel(place, ctx) {
  const el = h('span', { class: 'status', hidden: true });
  ctx.live.add((now) => {
    const key = ctx.tripDay(now);
    const open = key ? isOpenAt(place.hours, key, now.time) : null;
    el.hidden = open === null;
    el.textContent = open ? 'Open now' : 'Closed now';
    el.classList.toggle('status--open', open === true);
  });
  return el;
}

export function nudge(el) {
  if (reducedMotion()) return Promise.resolve();
  el.classList.remove('is-nudging');
  void el.offsetWidth; // Restart the animation on repeat taps.
  el.classList.add('is-nudging');
  return new Promise((r) => setTimeout(r, 140));
}

// A list row for a place that can sit on a map. Tapping the row (anywhere but a
// link) calls onPick(id, row).
export function placeRow(place, { body = [], hours = null, status = null, links = [], onPick }) {
  const mapped = hasCoords(place) && onPick;
  const name = mapped
    ? h('button', { type: 'button', class: 'place__btn', 'aria-label': `${place.name}, show on map` }, place.name)
    : place.name;
  const row = h(
    'li',
    { class: 'row place', 'data-id': place.id },
    h('div', { class: 'place__head' }, h('h3', { class: 'place__name' }, name), status),
    body,
    hours,
    place.hoursNote && h('p', { class: 'hours-note' }, place.hoursNote),
    h('div', { class: 'actions' }, links, directionsLink(place))
  );
  if (mapped) {
    row.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      onPick(place.id, row);
    });
  }
  return row;
}

// Highlights one row in a list and keeps it in view.
export function selector(rows) {
  let current = null;
  return function select(id, { scroll = false } = {}) {
    current?.classList.remove('is-selected');
    current = rows.get(id) || null;
    if (!current) return;
    current.classList.add('is-selected');
    if (scroll) current.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };
}
