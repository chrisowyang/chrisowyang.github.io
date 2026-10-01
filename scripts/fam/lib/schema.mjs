// Schema and content rules for content/fam.json. Used by fam:check and fam:build,
// so the build fails on anything fam:check would reject.
import { z } from 'zod';

export const PIN_STYLES = ['solid', 'outline', 'square', 'square-outline', 'diamond'];

// Roughly the five boroughs, with a little margin.
export const NYC_BOUNDS = { minLat: 40.47, maxLat: 40.93, minLng: -74.27, maxLng: -73.68 };

export const BANNED = [
  ['hidden gem', /\bhidden gems?\b/i],
  ['must-see', /\bmust[\s-]see\b/i],
  ['must-visit', /\bmust[\s-]visit\b/i],
  ['iconic', /\biconic\b/i],
  ['curated', /\bcurat(?:ed|ion)\b/i],
  ['vibes', /\bvibes?\b/i],
  ['perfect', /\bperfect(?:ly)?\b/i],
  ["don't miss", /\b(?:don['’]?t|do not) miss\b/i],
  ['exclamation mark', /!/],
];
const EM_DASH = /[—―]/;
export const NOTE_MAX_WORDS = 6;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug, like "blue-in-green"');
const text = z.string().trim().min(1, 'must not be empty');
const isRealDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must look like 2026-10-03').refine(isRealDate, 'is not a real date');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'must be 24h, like "19:30"');
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const range = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/, 'must be 24h, like "12:00-19:00"')
  .refine((r) => toMin(r.slice(0, 5)) < toMin(r.slice(6)), 'must close after it opens');
// A missing day means "unknown" and renders as "Check hours". null means closed.
const hours = z.object({ fri: range.nullable(), sat: range.nullable(), sun: range.nullable() }).partial().strict();
const url = z.string().url().startsWith('https://', 'must start with https://');
const lat = z.number().gte(-90).lte(90);
const lng = z.number().gte(-180).lte(180);

const place = {
  id: slug,
  name: text,
  address: text,
  lat: lat.optional(),
  lng: lng.optional(),
  placeId: text.optional(),
};

const eat = z.object({ ...place, date, time, neighborhood: text, party: z.number().int().positive().optional() }).strict();

const shop = z
  .object({
    ...place,
    group: slug,
    neighborhood: text,
    note: text.optional(),
    tags: z.array(text).optional(),
    hours: hours.optional(),
    hoursNote: text.optional(),
    website: url.optional(),
  })
  .strict();

const show = z.object({ artist: text, title: text.optional(), through: date }).strict();

const gallery = z
  .object({
    ...place,
    area: slug,
    neighborhood: text.optional(),
    note: text.optional(),
    website: url.optional(),
    shows: z.array(show).optional(),
    hours: hours.optional(),
    hoursNote: text.optional(),
  })
  .strict();

const event = z
  .object({
    ...place,
    neighborhood: text.optional(),
    note: text.optional(),
    dates: z.array(z.object({ date, hours: range.optional() }).strict()).min(1),
    url: url.optional(),
    ticketUrl: url.optional(),
    mapPdf: url.optional(),
  })
  .strict();

const config = z
  .object({
    title: text,
    timezone: text.refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'is not a valid IANA time zone'),
    shopGroups: z.array(z.object({ id: slug, label: text, pin: z.enum(PIN_STYLES).optional() }).strict()).min(1),
    artAreas: z.array(z.object({ id: slug, label: text }).strict()).min(1),
    taglines: z.object({ eat: text, shop: text, art: text }).strict(),
  })
  .strict();

export const famSchema = z
  .object({
    $schema: z.string().optional(),
    config,
    eat: z.array(eat),
    shop: z.array(shop),
    art: z.object({ events: z.array(event), galleries: z.array(gallery) }).strict(),
  })
  .strict();

const fmtPath = (p) => p.reduce((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${k}` : k), '');

// Fields that are our own copy. Names, artists, show titles and addresses are
// proper nouns and are exempt from the banned-word list ("Beautiful, Perfect
// Things" is a real show title).
const COPY_KEYS = new Set(['label', 'note', 'hoursNote', 'tags']);

function walkStrings(node, pathArr, visit) {
  if (typeof node === 'string') return visit(node, pathArr);
  if (Array.isArray(node)) return node.forEach((v, i) => walkStrings(v, [...pathArr, i], visit));
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walkStrings(v, [...pathArr, k], visit);
}

function isCopyPath(p) {
  const keys = p.filter((k) => typeof k === 'string');
  const last = keys[keys.length - 1];
  if (keys[0] === 'config' && keys[1] === 'title') return true;
  if (keys[0] === 'config' && keys[1] === 'taglines') return true;
  if (keys.includes('shows')) return false; // artist and show title
  return COPY_KEYS.has(last);
}

const list = (x) => (Array.isArray(x) ? x : []);

export function validate(data, { today } = {}) {
  const errors = [];
  const warnings = [];

  const parsed = famSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${fmtPath(issue.path) || '(root)'}: ${issue.message}`);
  }
  // The checks below run on the raw data too, so one run reports every problem.
  const d = data && typeof data === 'object' ? data : {};
  const config = d.config || {};
  const eat = list(d.eat);
  const shop = list(d.shop);
  const events = list(d.art?.events);
  const galleries = list(d.art?.galleries);

  // Unique ids across the whole file.
  const seen = new Map();
  const ids = [
    ...list(config.shopGroups).map((g, i) => [g?.id, `config.shopGroups[${i}]`]),
    ...list(config.artAreas).map((a, i) => [a?.id, `config.artAreas[${i}]`]),
    ...eat.map((p, i) => [p?.id, `eat[${i}]`]),
    ...shop.map((p, i) => [p?.id, `shop[${i}]`]),
    ...events.map((p, i) => [p?.id, `art.events[${i}]`]),
    ...galleries.map((p, i) => [p?.id, `art.galleries[${i}]`]),
  ];
  for (const [id, where] of ids) {
    if (typeof id !== 'string') continue;
    if (seen.has(id)) errors.push(`${where}.id: "${id}" is already used at ${seen.get(id)}`);
    else seen.set(id, where);
  }

  const groups = new Set(list(config.shopGroups).map((g) => g?.id));
  const areas = new Set(list(config.artAreas).map((a) => a?.id));
  shop.forEach((p, i) => {
    if (!groups.has(p?.group)) errors.push(`shop[${i}].group: "${p?.group}" is not in config.shopGroups (${[...groups].join(', ')})`);
  });
  galleries.forEach((p, i) => {
    if (!areas.has(p?.area)) errors.push(`art.galleries[${i}].area: "${p?.area}" is not in config.artAreas (${[...areas].join(', ')})`);
  });

  const places = [
    ...eat.map((p, i) => [p, `eat[${i}]`]),
    ...shop.map((p, i) => [p, `shop[${i}]`]),
    ...events.map((p, i) => [p, `art.events[${i}]`]),
    ...galleries.map((p, i) => [p, `art.galleries[${i}]`]),
  ];
  const B = NYC_BOUNDS;
  for (const [p, where] of places) {
    if (!p || typeof p !== 'object') continue;
    const hasLat = p.lat !== undefined;
    const hasLng = p.lng !== undefined;
    if (hasLat !== hasLng) errors.push(`${where}: needs both lat and lng, or neither`);
    else if (hasLat && (p.lat < B.minLat || p.lat > B.maxLat || p.lng < B.minLng || p.lng > B.maxLng)) {
      errors.push(`${where}: ${p.lat}, ${p.lng} is outside New York City. Check that lat and lng aren't swapped.`);
    }
  }

  walkStrings(data, [], (s, p) => {
    const where = fmtPath(p);
    if (EM_DASH.test(s)) errors.push(`${where}: contains an em dash. Use a comma, period, or "to" instead.`);
    if (isCopyPath(p)) {
      for (const [word, re] of BANNED) if (re.test(s)) errors.push(`${where}: "${s}" uses banned copy (${word})`);
    }
  });

  // Copy rule, reported as a warning so existing data can still build.
  const noteWords = (s) => s.split(/\s+/).filter(Boolean).length;
  for (const [p, where] of [...shop.map((p, i) => [p, `shop[${i}]`]), ...galleries.map((p, i) => [p, `art.galleries[${i}]`])]) {
    if (typeof p?.note === 'string' && noteWords(p.note) > NOTE_MAX_WORDS) {
      warnings.push(`${where}.note: "${p.note}" is ${noteWords(p.note)} words (aim for ${NOTE_MAX_WORDS} or fewer)`);
    }
  }
  if (today) {
    galleries.forEach((g, i) =>
      list(g?.shows).forEach((s, j) => {
        if (typeof s?.through === 'string' && s.through < today) {
          warnings.push(`art.galleries[${i}].shows[${j}]: closed ${s.through}, so it is hidden`);
        }
      })
    );
  }

  return { errors, warnings, data: errors.length ? null : parsed.data };
}
