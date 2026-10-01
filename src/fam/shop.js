import { h } from './dom.js';
import { byText } from './format.js';
import { createMap } from './map.js';
import { hoursBlock, nudge, placeRow, selector, statusLabel } from './rows.js';

const PIN_ORDER = ['solid', 'outline', 'square-outline', 'diamond', 'square'];

export function renderShop(ctx) {
  const { config, shop } = ctx.data;
  const groups = config.shopGroups.map((g, i) => ({ ...g, pin: g.pin || PIN_ORDER[i % PIN_ORDER.length] }));
  const rows = new Map();
  const select = selector(rows);
  let map = null;
  let filter = 'all';

  const pick = async (id, row) => {
    await nudge(row);
    select(id);
    map?.focus(id);
  };

  const sections = groups.map((g) => {
    const items = shop
      .filter((p) => p.group === g.id)
      .sort((a, b) => byText(a.neighborhood, b.neighborhood) || byText(a.name, b.name));
    const section = h(
      'section',
      { class: 'group', 'data-group': g.id, 'aria-labelledby': `group-${g.id}` },
      h('h2', { class: 'sec-title', id: `group-${g.id}` }, g.label),
      h(
        'ul',
        { class: 'rows' },
        items.map((p) => {
          const row = placeRow(p, {
            status: statusLabel(p, ctx),
            body: [
              p.note && h('p', { class: 'place__note' }, p.note),
              p.tags?.length && h('p', { class: 'tags' }, p.tags.map((t) => h('span', { class: 'tag' }, t))),
              h('p', { class: 'place__hood' }, p.neighborhood),
            ],
            hours: hoursBlock(p, ctx),
            links: p.website ? [h('a', { class: 'link', href: p.website, target: '_blank', rel: 'noopener' }, 'Website')] : [],
            onPick: pick,
          });
          rows.set(p.id, row);
          return row;
        })
      )
    );
    return { g, items, section };
  });

  const chips = [{ id: 'all', label: 'All' }, ...groups].map((g) =>
    h('button', { type: 'button', class: 'pill chip', 'aria-pressed': String(g.id === filter), 'data-filter': g.id }, g.label)
  );
  const chipBar = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter shops' }, chips);

  const visibleIds = () =>
    sections.filter((s) => filter === 'all' || s.g.id === filter).flatMap((s) => s.items.map((p) => p.id));

  const apply = () => {
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === filter));
    for (const s of sections) s.section.hidden = !(filter === 'all' || s.g.id === filter);
    select(null);
    map?.show(visibleIds());
  };
  chipBar.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip || chip.dataset.filter === filter) return;
    filter = chip.dataset.filter;
    apply();
  });

  const mapEl = h('div', { class: 'map', role: 'region', 'aria-label': 'Map of shops' });
  const shell = h('div', { class: 'map-shell map-shell--shop' }, h('p', { class: 'map__loading' }, 'Loading map'), mapEl);

  return {
    el: h('div', { class: 'shop' }, chipBar, shell, h('div', { class: 'shop__list' }, sections.map((s) => s.section))),
    async onShow() {
      if (map) return map.resize();
      const pinOf = new Map(groups.map((g) => [g.id, g.pin]));
      map = await createMap(mapEl, {
        label: 'Map of shops',
        wheelZoom: true,
        places: shop.map((p) => ({ ...p, pin: pinOf.get(p.group), sub: p.neighborhood })),
        onSelect: (id) => select(id, { scroll: true }),
      });
      map.show(visibleIds());
    },
  };
}
