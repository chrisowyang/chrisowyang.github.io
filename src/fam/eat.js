import { h } from './dom.js';
import { formatDate, formatTime } from './time.js';
import { directionsLink } from './rows.js';

export function renderEat(ctx) {
  const rows = new Map();
  const days = new Map();
  for (const r of ctx.eatSorted) {
    if (!days.has(r.date)) days.set(r.date, []);
    days.get(r.date).push(r);
  }

  const sections = [...days].map(([date, list]) =>
    h(
      'section',
      { class: 'day', 'aria-labelledby': `day-${date}` },
      h('h2', { class: 'sec-title', id: `day-${date}` }, formatDate(date)),
      h(
        'ul',
        { class: 'rows' },
        list.map((r) => {
          const row = h(
            'li',
            { class: 'row res', 'data-id': r.id },
            h('p', { class: 'res__time' }, h('time', { datetime: `${r.date}T${r.time}` }, formatTime(r.time))),
            h(
              'div',
              { class: 'res__body' },
              h('p', { class: 'res__flag', hidden: true }, 'Up next'),
              h('h3', { class: 'res__name' }, r.name),
              h('p', { class: 'res__meta' }, r.neighborhood),
              r.party && h('p', { class: 'res__meta' }, `Party of ${r.party}`),
              h('div', { class: 'actions' }, directionsLink(r))
            )
          );
          rows.set(r.id, row);
          return row;
        })
      )
    )
  );

  ctx.live.add((now) => {
    const next = ctx.upNext(now);
    for (const r of ctx.eatSorted) {
      const row = rows.get(r.id);
      const isNext = next?.id === r.id;
      row.classList.toggle('is-next', isNext);
      row.classList.toggle('is-past', ctx.isPast(r, now));
      row.querySelector('.res__flag').hidden = !isNext;
    }
  });

  return {
    el: h('div', { class: 'col' }, sections),
    scrollToNext() {
      const next = ctx.upNext(ctx.now());
      rows.get(next?.id)?.scrollIntoView({ block: 'center' });
    },
  };
}
