// npm run fam:diff [-- <git ref>]
// Shows the plaintext diff between the committed data (default: HEAD) and the
// working copy in content/fam.json. The committed file is encrypted, so plain
// git diff can't show this.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseEnvelope } from './lib/crypto.mjs';
import { decryptEnvelope, readDataText } from './lib/store.mjs';
import { ROOT, DATA_PATH, ENC_PATH, rel } from './lib/paths.mjs';

async function main() {
  const ref = process.argv.slice(2).find((a) => !a.startsWith('-')) || 'HEAD';
  const current = await readDataText();
  let encText = null;
  let base = ref;
  try {
    encText = execFileSync('git', ['show', `${ref}:${rel(ENC_PATH)}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    // Not committed yet: compare against the last build instead.
    if (fs.existsSync(ENC_PATH)) {
      encText = fs.readFileSync(ENC_PATH, 'utf8');
      base = 'the last build';
    }
  }
  const before = encText ? (await decryptEnvelope(parseEnvelope(encText))).text : '';
  if (base !== ref) console.log(`(${rel(ENC_PATH)} is not in ${ref} yet, so this compares against ${base}.)\n`);
  if (before === current) {
    console.log(`No changes to ${rel(DATA_PATH)} since ${base}.`);
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fam-diff-'));
  const name = rel(DATA_PATH);
  for (const [side, body] of [['a', before], ['b', current]]) {
    fs.mkdirSync(path.join(dir, side, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(dir, side, name), body);
  }
  const out = spawnSync('git', ['diff', '--no-index', '--no-color', '--no-prefix', '--', `a/${name}`, `b/${name}`], {
    cwd: dir,
    encoding: 'utf8',
  }).stdout;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(out.replace(/^index .*\n/m, ''));
}

main().catch((e) => {
  console.error(`fam:diff failed: ${e.message}`);
  process.exit(1);
});
