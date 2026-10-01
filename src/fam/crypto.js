// Decrypts the trip data in the browser. Same scheme as scripts/fam/lib/crypto.mjs:
// PBKDF2-SHA256 -> AES-256-GCM. After a correct password the derived key (never
// the password) is kept on this device for 30 days.
const STORE = 'fam:key';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

// Must match normalizePassword in scripts/fam/lib/crypto.mjs.
const normalize = (pw) => pw.trim().toLowerCase();

async function decryptWith(key, payload) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

export function forget() {
  try {
    localStorage.removeItem(STORE);
  } catch {
    // Storage blocked. Nothing to forget.
  }
}

export async function unlockWithPassword(payload, password) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(password)), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(payload.salt), iterations: payload.iter },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );
  const data = await decryptWith(key, payload); // Throws on a wrong password.
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(STORE, JSON.stringify({ salt: payload.salt, k: b64(raw), exp: Date.now() + REMEMBER_MS }));
  } catch {
    // Private mode or storage blocked: works for this visit only.
  }
  return data;
}

export async function unlockWithStoredKey(payload) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORE));
  } catch {
    return null;
  }
  if (!saved) return null;
  if (saved.salt !== payload.salt || !(saved.exp > Date.now())) {
    forget();
    return null;
  }
  try {
    const key = await crypto.subtle.importKey('raw', unb64(saved.k), 'AES-GCM', false, ['decrypt']);
    return await decryptWith(key, payload);
  } catch {
    forget();
    return null;
  }
}
