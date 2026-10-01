// npm run fam:check
// Validates content/fam.json. Exits non-zero on any error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate } from './lib/schema.mjs';
import { readDataText, readEnvelope, decryptEnvelope } from './lib/store.mjs';
import { readPassword } from './lib/crypto.mjs';
import { ROOT, DATA_PATH, PAGE_PATH, rel } from './lib/paths.mjs';
import { parseJson, nyToday } from './lib/json.mjs';

async function main() {
  const i = process.argv.indexOf('--data');
  const dataPath = i > -1 ? path.resolve(process.argv[i + 1]) : DATA_PATH;
  const text = i > -1 ? fs.readFileSync(dataPath, 'utf8') : await readDataText();
  const data = parseJson(text, rel(dataPath));
  const { errors, warnings, data: d } = validate(data, { today: nyToday(data?.config?.timezone) });

  try {
    execFileSync('git', ['ls-files', '--error-unmatch', rel(DATA_PATH)], { cwd: ROOT, stdio: 'ignore' });
    errors.push(`${rel(DATA_PATH)} is tracked by git. It must stay out of the public repo: git rm --cached ${rel(DATA_PATH)}`);
  } catch {
    // Not tracked, as intended.
  }

  if (i === -1 && errors.length === 0) {
    const env = readEnvelope();
    const password = readPassword({ required: false });
    if (env && password) {
      const { text: committed } = await decryptEnvelope(env, password);
      if (committed !== text) warnings.push(`${rel(DATA_PATH)} has changes that aren't built yet. Run npm run fam:build.`);
      else if (!fs.existsSync(PAGE_PATH) || !fs.readFileSync(PAGE_PATH, 'utf8').includes(env.ct)) {
        warnings.push(`${rel(PAGE_PATH)} is out of date. Run npm run fam:build.`);
      }
    }
  }

  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  if (errors.length) {
    console.log(`\nfam:check failed with ${errors.length} error${errors.length === 1 ? '' : 's'}.`);
    process.exit(1);
  }
  console.log(
    `fam:check passed: ${d.eat.length} eat, ${d.shop.length} shop, ${d.art.events.length} events, ${d.art.galleries.length} galleries.`
  );
}

main().catch((e) => {
  console.error(`fam:check failed: ${e.message}`);
  process.exit(1);
});
