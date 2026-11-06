# headers-lab

[![Deploy on Back4app](https://img.shields.io/badge/Deploy%20on-Back4app-1568B8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3eiIvPjwvc3ZnPg==)](https://www.back4app.com/signup?utm_source=github&utm_medium=repo&utm_campaign=headers-lab)

One app with a real vulnerability left in place, served twice: once as a default
server serves it, once with four security headers set. Three local origins —
your app, your API, and a page belonging to somebody else — opened in a real
browser, with every answer read back out of the DOM.

**Measured with Node 22 and headless Chrome on macOS, 29 October 2026.
Identical across two consecutive clean runs.**

> **Read the article:** [Security Headers and CORS: What the Least Dangerous Item on the List Actually Stops](https://www.back4app.com/blog/security-headers-and-cors-for-a-web-app?utm_source=github&utm_medium=repo&utm_campaign=headers-lab)

## Run it

```
./run.sh
```

Needs Node 22 and Google Chrome. No Docker and no backend.

## What it found

| what somebody tried | no headers | four headers set |
| --- | --- | --- |
| a stored comment containing markup | **it ran** | it did not run |
| another origin reading your API | **e-mail, plan, balance** | blocked by the browser |
| another page embedding your app | **it loaded** | refused |

```
security headers the app sends:   0 of 4   →   4 of 4
```

**No application code changed between the two columns.** The page still renders a
stored comment with `innerHTML`; the policy is what stops it executing.

### The CORS line that leaks

```js
h['access-control-allow-origin'] = origin || '*';   // whatever asked
h['access-control-allow-credentials'] = 'true';
```

A wildcard cannot carry credentials, so it is noisy but limited. Reflecting the
request's origin **alongside** allow-credentials is what turns any website into a
reader of your authenticated API.

### How not to test framing

An iframe fires its `load` event even when the headers refused the embed — the
browser loads an error page into it. Our first version reported "framed" in both
columns because of this. The reliable check is whether the embedded page's own
script runs:

```js
if (window.parent !== window) window.parent.postMessage('app-loaded-in-a-frame', '*');
```

## The pieces

| file | what it does |
| --- | --- |
| `server.mjs` | the three origins; `HARDENED=true` switches on the headers |
| `run.mjs` | opens the pages in Chrome and reads the four answers back |
