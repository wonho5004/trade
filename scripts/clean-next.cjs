// Safe Next.js cache cleaner for dev/build issues
// Removes .next directories to resolve stale bundle artifacts after upgrades
const fs = require('fs');
const path = require('path');

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`[clean] removed ${p}`);
  } catch (e) {
    console.warn(`[clean] failed to remove ${p}:`, e?.message || e);
  }
}

const cwd = process.cwd();
rmrf(path.join(cwd, '.next'));
rmrf(path.join(cwd, '.next-app'));
rmrf(path.join(cwd, '.next15'));
console.log('[clean] done');

