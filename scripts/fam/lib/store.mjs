// Reading and writing the data file. content/fam.json is the plaintext working
// copy (gitignored). content/fam.json.enc is what gets committed.
import fs from 'node:fs';
import { DATA_PATH, ENC_PATH, BASE_PATH, rel } from './paths.mjs';
import { readPassword, deriveKey, decrypt, parseEnvelope } from './crypto.mjs';

export const readEnvelope = () => (fs.existsSync(ENC_PATH) ? parseEnvelope(fs.readFileSync(ENC_PATH, 'utf8')) : null);

export async function decryptEnvelope(env, password = readPassword()) {
  const key = await deriveKey(password, env.salt, env.iter);
  try {
    return { text: await decrypt(env, key), key };
  } catch {
    throw new Error(`Could not decrypt ${rel(ENC_PATH)}. FAM_PAGE_PASSWORD does not match the password it was built with.`);
  }
}

export async function unlock({ force = false } = {}) {
  const env = readEnvelope();
  if (!env) throw new Error(`${rel(ENC_PATH)} does not exist yet.`);
  if (fs.existsSync(DATA_PATH) && !force) {
    const current = fs.readFileSync(DATA_PATH, 'utf8');
    const { text } = await decryptEnvelope(env);
    if (current !== text) {
      throw new Error(`${rel(DATA_PATH)} has local changes. Build them first, or run "npm run fam:unlock -- --force" to discard them.`);
    }
  }
  const { text } = await decryptEnvelope(env);
  fs.writeFileSync(DATA_PATH, text);
  fs.writeFileSync(BASE_PATH, env.iv + '\n');
  return text;
}

// Returns the plaintext JSON text, unlocking the committed file first if this
// checkout doesn't have a working copy yet.
export async function readDataText() {
  if (fs.existsSync(DATA_PATH)) return fs.readFileSync(DATA_PATH, 'utf8');
  if (!readEnvelope()) throw new Error(`Neither ${rel(DATA_PATH)} nor ${rel(ENC_PATH)} exists.`);
  console.log(`${rel(DATA_PATH)} not found. Unlocking it from ${rel(ENC_PATH)}.`);
  return unlock();
}

export const readBaseIv = () => (fs.existsSync(BASE_PATH) ? fs.readFileSync(BASE_PATH, 'utf8').trim() : null);
