// npm run fam:build
// Validates content/fam.json, encrypts it with FAM_PAGE_PASSWORD, and writes
// fam.html (served at /fam). The site is static, so the password gate is the
// encryption itself: fam.html holds only ciphertext, never the trip data.
//
// Also writes content/fam.json.enc, the committed (encrypted) copy of the data,
// and copies Leaflet and the font into assets/fam/.
//
// Flags:
//   --rekey        Change the password. Re-encrypts with a new salt, which signs
//                  every device out.
//   --data <file>  Build from another data file (for testing). Implies --out
//                  and never touches content/.
//   --out <file>   Write the page somewhere other than fam.html.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { validate } from './lib/schema.mjs';
import { readPassword, deriveKey, encrypt, newSalt, serializeEnvelope, ITERATIONS } from './lib/crypto.mjs';
import { readDataText, readEnvelope, decryptEnvelope, readBaseIv } from './lib/store.mjs';
import { ROOT, ENC_PATH, BASE_PATH, PAGE_PATH, ASSET_DIR, SRC_DIR, rel } from './lib/paths.mjs';
import { parseJson, nyToday } from './lib/json.mjs';

const require = createRequire(import.meta.url);
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), Buffer.from(content)) === 0) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

async function encryptFresh(text, password) {
  const salt = newSalt();
  const key = await deriveKey(password, salt, ITERATIONS);
  return encrypt(text, key, { salt, iterations: ITERATIONS });
}

// Reuses the committed ciphertext when the data hasn't changed, so rebuilding
// doesn't churn the repo, and keeps the salt so devices stay signed in.
async function envelopeFor(text, password, { rekey }) {
  const existing = readEnvelope();
  if (!existing) return { env: await encryptFresh(text, password), status: 'encrypted (new)' };
  if (rekey) return { env: await encryptFresh(text, password), status: 'encrypted with the new password' };

  let committed;
  try {
    committed = await decryptEnvelope(existing, password);
  } catch {
    throw new Error(
      `FAM_PAGE_PASSWORD doesn't match the password ${rel(ENC_PATH)} was built with. ` +
        'If you meant to change the password, run: npm run fam:build -- --rekey'
    );
  }
  if (committed.text === text) return { env: existing, status: 'unchanged' };
  const base = readBaseIv();
  if (base && base !== existing.iv) {
    throw new Error(
      `${rel(ENC_PATH)} changed since content/fam.json was unlocked (someone else committed an edit). ` +
        'Save your edits elsewhere, run npm run fam:unlock -- --force, and redo them.'
    );
  }
  return {
    env: await encrypt(text, committed.key, { salt: existing.salt, iterations: existing.iter }),
    status: 'encrypted (updated)',
  };
}

async function bundle() {
  const js = await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020', 'safari15', 'ios15', 'chrome90', 'firefox90'],
    write: false,
    legalComments: 'none',
  });
  const css = await esbuild.transform(fs.readFileSync(path.join(SRC_DIR, 'fam.css'), 'utf8'), {
    loader: 'css',
    minify: true,
    target: ['safari15', 'ios15', 'chrome90', 'firefox90'],
  });
  return { js: js.outputFiles[0].text.trim(), css: css.code.trim() };
}

function copyAssets() {
  const leaflet = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
  const font = path.dirname(require.resolve('@fontsource-variable/instrument-sans/package.json'));
  const copies = [
    [path.join(leaflet, 'leaflet.js'), 'leaflet.js'],
    [path.join(leaflet, 'leaflet.css'), 'leaflet.css'],
    [path.join(leaflet, '../LICENSE'), 'LEAFLET-LICENSE.txt'],
    [path.join(font, 'files/instrument-sans-latin-wght-normal.woff2'), 'fonts/instrument-sans-latin-wght-normal.woff2'],
    [path.join(font, 'LICENSE'), 'fonts/OFL.txt'],
  ];
  for (const [from, to] of copies) writeIfChanged(path.join(ASSET_DIR, to), fs.readFileSync(from));
}

// The whole point of the page: none of the trip data may appear in plaintext.
function assertNoLeaks(html, data) {
  const secrets = [
    ...data.eat,
    ...data.shop,
    ...data.art.events,
    ...data.art.galleries,
  ].flatMap((p) => [p.placeId, p.address, p.name.length >= 5 ? p.name : null]);
  const leaked = [...new Set(secrets.filter((s) => s && html.includes(s)))];
  if (leaked.length) throw new Error(`Refusing to write the page: plaintext trip data found in it: ${leaked.join(', ')}`);
}

async function main() {
  const password = readPassword();
  const dataArg = arg('--data');
  const outPath = path.resolve(arg('--out') || (dataArg ? path.join(ROOT, 'fam.test.html') : PAGE_PATH));
  const text = dataArg ? fs.readFileSync(path.resolve(dataArg), 'utf8') : await readDataText();
  const data = parseJson(text, dataArg || 'content/fam.json');

  const { errors, warnings } = validate(data, { today: nyToday(data?.config?.timezone) });
  for (const w of warnings) console.log(`warning  ${w}`);
  if (errors.length) {
    for (const e of errors) console.log(`error    ${e}`);
    throw new Error(`content has ${errors.length} error${errors.length === 1 ? '' : 's'}. Nothing was built.`);
  }

  const { env, status } = dataArg
    ? { env: await encryptFresh(text, password), status: 'encrypted (test build)' }
    : await envelopeFor(text, password, { rekey: process.argv.includes('--rekey') });

  const { js, css } = await bundle();
  const template = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
  const html = template
    .replace('/*FAM_CSS*/', () => css)
    .replace('/*FAM_PAYLOAD*/', () => JSON.stringify(env))
    .replace('/*FAM_JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
  assertNoLeaks(html, data);

  if (!dataArg) {
    writeIfChanged(ENC_PATH, serializeEnvelope(env));
    fs.writeFileSync(BASE_PATH, env.iv + '\n');
    copyAssets();
  }
  const changed = writeIfChanged(outPath, html);
  console.log(`Data: ${status}.`);
  console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${rel(outPath)} (${Math.round(html.length / 1024)} KB).`);
}

main().catch((e) => {
  console.error(`fam:build failed: ${e.message}`);
  process.exit(1);
});
