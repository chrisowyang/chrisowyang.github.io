// npm run fam:geocode -- "<address>" ["<another address>" ...]
// Looks up lat/lng with OpenStreetMap Nominatim. No API key. Follows the
// Nominatim usage policy: an identifying User-Agent and at most 1 request per
// second, enforced across back-to-back runs with a timestamp file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NYC_BOUNDS as B } from './lib/schema.mjs';

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set, so re-run
// with it when a proxy is configured (as in cloud sessions).
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const ENDPOINT = process.env.FAM_GEOCODE_ENDPOINT || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'owyang.xyz-fam-geocoder/1.0 (+https://owyang.xyz; occasional manual lookups)';
const MIN_INTERVAL_MS = 1100;
const STAMP = path.join(os.tmpdir(), 'fam-geocode-last-request');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  let last = 0;
  try {
    last = Number(fs.readFileSync(STAMP, 'utf8')) || 0;
  } catch {
    // First request.
  }
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  fs.writeFileSync(STAMP, String(Date.now()));
}

// Nominatim often misses on unit numbers ("#6W", "Suite 200", "Fl 3").
const simplify = (address) =>
  address
    .replace(/,?\s*(?:#|(?:suite|ste|unit|fl|floor|apt)\.?\s+)[\w-]+/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .trim();

async function search(q) {
  await throttle();
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '3',
    countrycodes: 'us',
    viewbox: `${B.minLng},${B.maxLat},${B.maxLng},${B.minLat}`,
    bounded: '1',
  });
  let res;
  try {
    res = await fetch(`${ENDPOINT}?${params}`, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } });
  } catch (e) {
    throw new Error(
      `Could not reach ${new URL(ENDPOINT).host} (${e.cause?.code || e.message}). ` +
        'In a cloud session, nominatim.openstreetmap.org may need to be added to the allowed domains.'
    );
  }
  if (res.status === 429) throw new Error('Nominatim is rate limiting us. Wait a minute and try again.');
  if (!res.ok) throw new Error(`Nominatim answered ${res.status} ${res.statusText}`);
  return res.json();
}

const round = (n) => Math.round(Number(n) * 1e7) / 1e7;

async function geocode(address) {
  let results = await search(address);
  let query = address;
  const simpler = simplify(address);
  if (!results.length && simpler !== address) {
    query = simpler;
    results = await search(simpler);
  }
  if (!results.length) return { address, found: false };
  const [top, ...others] = results;
  return {
    address,
    query,
    found: true,
    lat: round(top.lat),
    lng: round(top.lon),
    match: top.display_name,
    others: others.map((r) => ({ lat: round(r.lat), lng: round(r.lon), match: r.display_name })),
  };
}

async function main() {
  const addresses = process.argv.slice(2).filter((a) => a.trim());
  if (!addresses.length) {
    console.error('Usage: npm run fam:geocode -- "1 Centre St, New York, NY 10007"');
    process.exit(2);
  }
  let missed = 0;
  for (const address of addresses) {
    const r = await geocode(address);
    if (!r.found) {
      missed++;
      console.log(`No match for "${address}". Leave lat/lng out (the place is listed but not mapped), or try a simpler address.`);
      continue;
    }
    console.log(JSON.stringify({ lat: r.lat, lng: r.lng }));
    console.log(`  matched: ${r.match}${r.query !== address ? `  (searched as "${r.query}")` : ''}`);
    for (const o of r.others) console.log(`  also:    ${o.match}  ${o.lat}, ${o.lng}`);
  }
  process.exit(missed ? 1 : 0);
}

main().catch((e) => {
  console.error(`fam:geocode failed: ${e.message}`);
  process.exit(1);
});
