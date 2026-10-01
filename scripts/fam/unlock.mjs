// npm run fam:unlock [-- --force]
// Decrypts content/fam.json.enc into content/fam.json (gitignored) for editing.
import { unlock } from './lib/store.mjs';
import { DATA_PATH, rel } from './lib/paths.mjs';

unlock({ force: process.argv.includes('--force') })
  .then(() => console.log(`Unlocked ${rel(DATA_PATH)}. Edit it, then run npm run fam:check.`))
  .catch((e) => {
    console.error(`fam:unlock failed: ${e.message}`);
    process.exit(1);
  });
