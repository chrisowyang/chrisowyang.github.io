// Same scheme as src/fam/crypto.js: PBKDF2-SHA256 -> AES-256-GCM.
// The salt is kept stable across builds so a device that already unlocked
// the page stays unlocked after the data changes.
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
export const ITERATIONS = 600_000;

const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

// Mirrors the browser: surrounding spaces are ignored and case doesn't matter,
// so "NYC" typed on a phone still works.
export const normalizePassword = (pw) => pw.trim().toLowerCase();

export function readPassword({ required = true } = {}) {
  const pw = process.env.FAM_PAGE_PASSWORD;
  if (pw && pw.trim()) return normalizePassword(pw);
  if (!required) return null;
  throw new Error(
    'FAM_PAGE_PASSWORD is not set. Set it in the environment (it is the /fam page password) and run again.'
  );
}

export async function deriveKey(password, saltB64, iterations = ITERATIONS) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export const newSalt = () => b64(webcrypto.getRandomValues(new Uint8Array(16)));

export async function encrypt(text, key, { salt, iterations = ITERATIONS }) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt, iv: b64(iv), ct: b64(ct) };
}

export async function decrypt(envelope, key) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv) }, key, unb64(envelope.ct));
  return new TextDecoder().decode(pt);
}

export function parseEnvelope(text) {
  const env = JSON.parse(text);
  if (env?.v !== 1 || !env.salt || !env.iv || !env.ct || !env.iter) throw new Error('Not a /fam encrypted file');
  return env;
}

export const serializeEnvelope = (env) => JSON.stringify(env, null, 2) + '\n';
