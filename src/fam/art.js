import { h } from './dom.js';
import { byText, hasCoords } from './format.js';
import { formatDate, formatMonthDay, formatRange } from './time.js';
import { createMap } from './map.js';
import { hoursBlock, nudge, placeRow, selector, statusLabel, textLink } from './rows.js';

const GALLERY_NOTE =
  "Most galleries are closed Sunday and Monday. Hours can change, so check the gallery's site before heading over.";

// A section with a "Show on map" toggle and its own map, created on first open.
function mapSection({ id, title, label, places, rowsFor, extraClass = '' }) {
  const rows = new Map();
  const select = selector(rows);
  const mapped = places.filter(hasCoords);
  let map = null;
  let opening = null;

  const mapEl = h('div', { class: 'map', role: 'region', 'aria-label': label });
  const shell = h('div', { class: 'map-shell map-shell--inline', id: `map-${id}`, hidden: true }, h('p', { class: 'map__loading' }, 'Loading map'), mapEl);
  const toggle =
    mapped.length > 0 &&
    h('button', { type: 'button', class: 'pill pill--small', 'aria-expanded': 'false', 'aria-controls': `map-${id}` }, 'Show on map');

  async function open() {
    shell.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.textContent = 'Hide map';
    if (map) return map.resize();
    opening ||= createMap(mapEl, { label, places, onSelect: (pid) => select(pid, { scroll: true }) }).then((m) => (map = m));
    await opening;
  }
  function close() {
    shell.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'Show on map';
    select(null);
  }
  toggle?.addEventListener('click', () => (shell.hidden ? open() : close()));

  const pick = async (pid, row) => {
    await nudge(row);
    if (shell.hidden) await open();
    select(pid);
    map?.focus(pid);
  };

  const list = h('ul', { class: 'rows' }, rowsFor(pick, rows));
  return h(
    'section',
    { class: `area ${extraClass}`, 'aria-labelledby': `area-${id}` },
    h('div', { class: 'sec-head' }, h('h2', { class: 'sec-title', id: `area-${id}` }, title), toggle),
    shell,
    list
  );
}

function showLine(s) {
  return h('p', { class: 'show' }, s.artist, s.title ? [', ', h('i', null, s.title)] : null, `, through ${formatMonthDay(s.through)}`);
}

export function renderArt(ctx) {
  const { config, art } = ctx.data;
  const today = ctx.now().date;
  const parts = [];

  if (art.events.length) {
    const events = [...art.events].sort((a, b) => byText(a.dates[0].date, b.dates[0].date) || byText(a.name, b.name));
    parts.push(
      mapSection({
        id: 'weekend',
        title: 'This weekend only',
        label: 'Map of this weekend’s events',
        extraClass: 'weekend',
        places: events.map((e) => ({ ...e, pin: 'diamond', sub: e.neighborhood })),
        rowsFor: (pick, rows) =>
          events.map((e) => {
            const row = placeRow(e, {
              body: [
                h(
                  'dl',
                  { class: 'dates' },
                  e.dates.map((d) =>
                    h('div', { class: 'dates__day' }, h('dt', null, formatDate(d.date)), h('dd', null, d.hours ? formatRange(d.hours) : 'Check hours'))
                  )
                ),
                e.note && h('p', { class: 'place__note' }, e.note),
                e.neighborhood && h('p', { class: 'place__hood' }, e.neighborhood),
              ],
              links: [
                e.url && textLink(e.url, 'Website', e.name),
                e.ticketUrl && textLink(e.ticketUrl, 'Tickets', e.name),
                e.mapPdf && textLink(e.mapPdf, 'Map (PDF)', e.name),
              ],
              onPick: pick,
            });
            rows.set(e.id, row);
            return row;
          }),
      })
    );
  }

  parts.push(h('p', { class: 'art-note' }, GALLERY_NOTE));

  for (const area of config.artAreas) {
    const galleries = art.galleries.filter((g) => g.area === area.id).sort((a, b) => byText(a.name, b.name));
    if (!galleries.length) continue;
    parts.push(
      mapSection({
        id: area.id,
        title: area.label,
        label: `Map of ${area.label} galleries`,
        places: galleries.map((g) => ({ ...g, pin: 'square', sub: g.neighborhood || area.label })),
        rowsFor: (pick, rows) =>
          galleries.map((g) => {
            const shows = (g.shows || []).filter((s) => s.through >= today);
            const row = placeRow(g, {
              status: statusLabel(g, ctx),
              body: [
                shows.length ? shows.map(showLine) : g.note && h('p', { class: 'place__note' }, g.note),
                g.neighborhood && h('p', { class: 'place__hood' }, g.neighborhood),
              ],
              hours: hoursBlock(g, ctx),
              links: [g.website && textLink(g.website, 'Website', g.name)],
              onPick: pick,
            });
            rows.set(g.id, row);
            return row;
          }),
      })
    );
  }

  return { el: h('div', { class: 'col' }, parts) };
}
