// Four questions, asked of the same app with the headers off and on.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startAll, PORTS } from './server.mjs';

const run = promisify(execFile);
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const servers = await startAll();
const line = (q, a) => console.log(`      ${q.padEnd(44)}${a}`);

// `--headless=new`, and asynchronously: execSync would block the event loop of
// the same process that is serving these pages.
async function dom(url) {
  const profile = mkdtempSync(join(tmpdir(), 'headers-lab-'));
  const { stdout } = await run(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=10000', '--dump-dom', `--user-data-dir=${profile}`, url],
    { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 120_000 });
  return stdout;
}
const text = (d, id) => d.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1] ?? '(not found)';

// 1. which headers the app actually sends
const res = await fetch(`http://127.0.0.1:${PORTS.app}/`);
const WANTED = ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy'];
const present = WANTED.filter((h) => res.headers.get(h));
line('security headers the app sends:', `${present.length} of ${WANTED.length}${present.length ? ` — ${present.join(', ')}` : ''}`);

// 2. what a stored comment does on that page
const appDom = await dom(`http://127.0.0.1:${PORTS.app}/`);
line('a stored comment on the page:', text(appDom, 'ran'));

// 3. what another origin can read from the API
const attackerDom = await dom(`http://127.0.0.1:${PORTS.attacker}/`);
line("another origin reading your API:", text(attackerDom, 'read'));

// 4. whether another page can frame yours
line('another page framing your app:', text(attackerDom, 'framed'));

console.log('');
for (const s of servers) s.close();
