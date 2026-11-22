// Architecture guard: fails when a domain reaches into another domain's code.
// Rules: a file in domains/<A>/ may require only (1) its own domain, (2) platform/, (3) node core / npm packages.
// Other domains are reachable only through the APIs injected in server.js.   Run: npm run check:boundaries
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAINS = path.join(ROOT, 'domains');
const violations = [];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}

for (const domain of fs.readdirSync(DOMAINS)) {
  for (const file of files(path.join(DOMAINS, domain))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!spec.startsWith('.')) continue; // node core / npm package
      const target = path.resolve(path.dirname(file), spec);
      const rel = path.relative(ROOT, target).replace(/\\/g, '/');
      const ok = rel.startsWith(`domains/${domain}/`) || rel === `domains/${domain}` || rel.startsWith('platform/') || rel === 'platform';
      if (!ok) violations.push(`${path.relative(ROOT, file).replace(/\\/g, '/')} requires ${rel}`);
    }
  }
}

if (violations.length) {
  console.error('Domain boundary violations:\n  ' + violations.join('\n  '));
  process.exit(1);
}
console.log('OK - every domain depends only on itself and platform/');
