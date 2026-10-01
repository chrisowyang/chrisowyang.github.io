import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DATA_PATH = path.join(ROOT, 'content/fam.json');
export const ENC_PATH = path.join(ROOT, 'content/fam.json.enc');
// Records which ciphertext content/fam.json was unlocked from, so a build never
// overwrites a newer committed version with a stale local copy.
export const BASE_PATH = path.join(ROOT, 'content/.fam-unlocked-from');
export const PAGE_PATH = path.join(ROOT, 'fam.html');
export const ASSET_DIR = path.join(ROOT, 'assets/fam');
export const SRC_DIR = path.join(ROOT, 'src/fam');

export const rel = (p) => path.relative(ROOT, p);
