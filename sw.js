// Offline support for the family map (filled in by scripts/build_site.py: c35fa59665, 48f0289178, {"app": ["./", "version.json", "manifest.webmanifest", "firebase-config.js", "icon-180.png", "icon-192.png", "icon-512.png", "app.css?v=c35fa59665", "app.js?v=c35fa59665", "geo.js?v=c35fa59665", "i18n.js?v=c35fa59665", "jakt.js?v=c35fa59665", "maplibre-gl.css?v=c35fa59665", "view.js?v=c35fa59665", "wind.js?v=c35fa59665", "fb.js?v=c35fa59665"], "ext": ["https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.0/maplibre-gl.js", "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow+Semi+Condensed:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap", "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js", "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js", "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"], "data": ["data/areas.json", "data/alnaryd/contours.geojson", "data/alnaryd/drainage.geojson", "data/alnaryd/forest_0_0.webp", "data/alnaryd/game.geojson", "data/alnaryd/game_0_0.png", "data/alnaryd/height_0_0.webp", "data/alnaryd/info.png", "data/alnaryd/manifest.json", "data/alnaryd/osm.geojson", "data/alnaryd/relief_0_0.webp", "data/alnaryd/reserves.geojson", "data/alnaryd/steep_0_0.png", "data/alnaryd/wet_0_0.png", "data/alnaryd/wind.json", "data/alnaryd/wind.png", "glyphs/0-255.txt", "glyphs/256-511.txt"]}, [[15.398225, 56.334191, 15.465921999999999, 56.374908, 8, 15]]).
// The app, the map data for the hunting ground and the elevation tiles around it are stored on the phone,
// so the map, compass, wind and your own position work without coverage. Firebase queues writes by itself.
const VER = "c35fa59665";
const APP = "app-" + VER, DATA = "data-48f0289178", DEM = "dem-v1", EXT = "ext-v1";
const EXT_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const PRECACHE = {"app": ["./", "version.json", "manifest.webmanifest", "firebase-config.js", "icon-180.png", "icon-192.png", "icon-512.png", "app.css?v=c35fa59665", "app.js?v=c35fa59665", "geo.js?v=c35fa59665", "i18n.js?v=c35fa59665", "jakt.js?v=c35fa59665", "maplibre-gl.css?v=c35fa59665", "view.js?v=c35fa59665", "wind.js?v=c35fa59665", "fb.js?v=c35fa59665"], "ext": ["https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.0/maplibre-gl.js", "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow+Semi+Condensed:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap", "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js", "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js", "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"], "data": ["data/areas.json", "data/alnaryd/contours.geojson", "data/alnaryd/drainage.geojson", "data/alnaryd/forest_0_0.webp", "data/alnaryd/game.geojson", "data/alnaryd/game_0_0.png", "data/alnaryd/height_0_0.webp", "data/alnaryd/info.png", "data/alnaryd/manifest.json", "data/alnaryd/osm.geojson", "data/alnaryd/relief_0_0.webp", "data/alnaryd/reserves.geojson", "data/alnaryd/steep_0_0.png", "data/alnaryd/wet_0_0.png", "data/alnaryd/wind.json", "data/alnaryd/wind.png", "glyphs/0-255.txt", "glyphs/256-511.txt"]};
const DEM_BOXES = [[15.398225, 56.334191, 15.465921999999999, 56.374908, 8, 15]];   // [west, south, east, north, minZoom, maxZoom] around each hunting ground
const DEM_URL = "https://tiles.mapterhorn.com/";

function tilesFor([w, s, e, n, z0, z1]) {
  const out = [];
  for (let z = z0; z <= z1; z++) {
    const N = 2 ** z, x = (lon) => Math.floor((lon + 180) / 360 * N);
    const y = (lat) => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * N);
    for (let tx = x(w); tx <= x(e); tx++) for (let ty = y(n); ty <= y(s); ty++) out.push(`${DEM_URL}${z}/${tx}/${ty}.webp`);
  }
  return out;
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const app = await caches.open(APP);
    await app.addAll(PRECACHE.app);
    const ext = await caches.open(EXT);
    for (const u of PRECACHE.ext) if (!(await ext.match(u))) await ext.add(new Request(u, { mode: "cors" })).catch(() => {});
    const data = await caches.open(DATA);
    for (const u of PRECACHE.data) if (!(await data.match(u))) await data.add(u).catch(() => {});
    // elevation for 3D and relief around the hunting ground: best effort, never blocks the update
    const dem = await caches.open(DEM);
    for (const u of DEM_BOXES.flatMap(tilesFor)) if (!(await dem.match(u))) await dem.add(u).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith("app-") && k !== APP) || (k.startsWith("data-") && k !== DATA)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(req, name) {
  const c = await caches.open(name), hit = await c.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") c.put(req, res.clone());
  return res;
}
async function networkFirst(req, name) {
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    return (await c.match(req, { ignoreSearch: true })) || (await caches.match("./")) || Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate" || url.pathname.endsWith("/version.json") || url.pathname.endsWith("/index.html")) {
      e.respondWith(networkFirst(req, APP)); return;
    }
    if (url.pathname.includes("/data/") || url.pathname.includes("/glyphs/")) { e.respondWith(cacheFirst(req, DATA)); return; }
    e.respondWith(cacheFirst(req, APP)); return;
  }
  if (url.href.startsWith(DEM_URL)) { e.respondWith(cacheFirst(req, DEM)); return; }
  if (EXT_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req, EXT)); return;
  }
  // everything else (Firestore, sign-in, SMHI) goes to the network as usual
});
