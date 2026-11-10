// ScrapScan service worker: lets the collector pages open with no signal.
//
// It handles only two kinds of GET request; everything else (APIs, other pages, other sites) goes
// straight to the network untouched:
//   1. Navigations to the collector pages below: network first, falling back to the last copy saved
//      on this phone. Redirects (signed out) and errors are never saved.
//   2. /_next/static/* build files: cache first. Their names change with every build, so a saved copy
//      is never stale.
// Saved pages are per-user, so the app deletes them on logout (see clearOnLogout in src/lib/offline/queue.ts).

const VERSION = "v1";
const PAGES = `scrapscan-pages-${VERSION}`;
const ASSETS = `scrapscan-assets-${VERSION}`;
const OFFLINE_PAGES = ["/collector", "/collector/scan", "/collector/queue"];
const NETWORK_TIMEOUT_MS = 4000; // weak signal: show the saved copy instead of a blank wait
const MAX_ASSETS = 300;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("scrapscan-") && key !== PAGES && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

// The app asks for the collector pages to be saved as soon as the worker is ready, so they work
// offline even if the collector never opened them with signal.
self.addEventListener("message", (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.data?.type !== "warm") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      for (const path of OFFLINE_PAGES) {
        try {
          const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
          if (res.ok && !res.redirected) {
            await cache.put(path, res.clone());
            await saveAssetsFrom(await res.text());
          }
        } catch {
          /* offline: try again next time */
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    event.respondWith(networkFirstPage(event, url.pathname));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    await cache.put(req, res.clone());
    trimAssets(cache);
  }
  return res;
}

async function trimAssets(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k);
}

async function networkFirstPage(event, path) {
  const cache = await caches.open(PAGES);
  const network = fetch(event.request).then(async (res) => {
    if (res.ok && !res.redirected && res.type === "basic") {
      const html = await res.clone().text();
      await cache.put(path, res.clone());
      event.waitUntil(saveAssetsFrom(html));
    } else if (res.redirected) {
      // Signed out (redirected to /login): this saved page no longer belongs to anyone signed in.
      await cache.delete(path);
    }
    return res;
  });

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    const saved = await cache.match(path);
    if (saved) {
      event.waitUntil(network.catch(() => {})); // still refresh the copy in the background
      return saved;
    }
    return await network;
  } catch {
    const saved = await cache.match(path);
    return saved ?? offlinePage();
  }
}

/** Save the build files a page needs, so it can start offline. */
async function saveAssetsFrom(html) {
  const cache = await caches.open(ASSETS);
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? []);
  await Promise.all(
    [...urls].map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      } catch {
        /* next visit will retry */
      }
    }),
  );
}

function offlinePage() {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · ScrapScan</title>
<body style="font-family:system-ui,sans-serif;background:#fbfff2;color:#252502;padding:24px;max-width:32rem;margin:auto">
<h1 style="font-size:1.5rem">You're offline</h1>
<p>This page hasn't been saved on this phone yet. Open ScrapScan once with signal, then it will work offline.</p>
<p>Scans you already saved are safe on this phone and will send when you're back online.</p>
<p><a href="/collector" style="color:#245900;font-weight:700">Try again</a></p></body>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
