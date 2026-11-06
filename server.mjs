// Three servers, so the questions have somewhere to be asked.
//
//   app      — your app, serving a page that renders a stored comment
//   api      — your API, deciding which origins may read authenticated answers
//   attacker — a page on a different origin, doing what a malicious page does
//
// HARDENED=true switches on the headers. Nothing else changes.
import { createServer } from 'node:http';

const HARD = process.env.HARDENED === 'true';
export const PORTS = { app: 1350, api: 1352, attacker: 1351 };

// A comment somebody stored. The same shape as the one in injection-lab.
const STORED_COMMENT =
  `<img src=x onerror="document.getElementById('ran').textContent='the comment ran'">`;

const appPage = () => `<!doctype html><html><head><meta charset="utf-8"><title>app</title></head>
<body>
  <div id="comments"></div>
  <p id="ran">the comment did not run</p>
  <script>
    document.getElementById('comments').innerHTML = ${JSON.stringify(`<div>${STORED_COMMENT}</div>`)};
    // If this page is inside a frame, say so. A frame the headers refused never
    // runs this line, which is the only reliable way to tell: the iframe's load
    // event fires either way, because the browser loads an error page instead.
    if (window.parent !== window) window.parent.postMessage('app-loaded-in-a-frame', '*');
  </script>
</body></html>`;

const attackerPage = () => `<!doctype html><html><head><meta charset="utf-8"><title>attacker</title></head>
<body>
  <p id="read">nothing read</p>
  <p id="framed">not framed</p>
  <iframe id="f" src="http://127.0.0.1:${PORTS.app}/" width="300" height="120"></iframe>
  <script>
    fetch('http://127.0.0.1:${PORTS.api}/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { document.getElementById('read').textContent = 'read: ' + JSON.stringify(d); })
      .catch((e) => { document.getElementById('read').textContent = 'blocked by the browser'; });
    window.addEventListener('message', (e) => {
      if (e.data === 'app-loaded-in-a-frame') {
        document.getElementById('framed').textContent = 'the app loaded inside this page';
      }
    });
  </script>
</body></html>`;

export function startAll() {
  const servers = [];

  const app = createServer((req, res) => {
    const h = { 'content-type': 'text/html' };
    if (HARD) {
      h['content-security-policy'] = "default-src 'self'; script-src 'self'; frame-ancestors 'none'";
      h['x-frame-options'] = 'DENY';
      h['x-content-type-options'] = 'nosniff';
      h['referrer-policy'] = 'no-referrer';
    }
    res.writeHead(200, h);
    res.end(appPage());
  });

  const api = createServer((req, res) => {
    const origin = req.headers.origin ?? '';
    const h = { 'content-type': 'application/json' };
    if (HARD) {
      // only our own origin may read an authenticated answer
      if (origin === `http://127.0.0.1:${PORTS.app}`) {
        h['access-control-allow-origin'] = origin;
        h['access-control-allow-credentials'] = 'true';
      }
    } else {
      // what a generated config does: reflect whatever asked, and allow credentials
      h['access-control-allow-origin'] = origin || '*';
      h['access-control-allow-credentials'] = 'true';
    }
    res.writeHead(200, h);
    res.end(JSON.stringify({ email: 'ana@example.com', plan: 'pro', balanceCents: 128400 }));
  });

  const attacker = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(attackerPage());
  });

  return Promise.all([
    new Promise((r) => servers.push(app.listen(PORTS.app, '127.0.0.1', r))),
    new Promise((r) => servers.push(api.listen(PORTS.api, '127.0.0.1', r))),
    new Promise((r) => servers.push(attacker.listen(PORTS.attacker, '127.0.0.1', r))),
  ]).then(() => servers);
}
