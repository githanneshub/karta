/* Alnaryd hunting map: layers, stands, wind, stalk routes, sightings. */
(function () {
  "use strict";
  // iPhone: pinching anywhere but the map would zoom the whole page and leave the menus too big (the map
  // handles its own pinch through touch events, which this doesn't touch)
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const BASE_URL = new URL(".", document.baseURI).href;
  const abs = (p) => new URL(p, BASE_URL).href;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const flat = (pts) => pts.flat();
  const pairs = (arr) => { const out = []; for (let i = 0; i + 1 < (arr || []).length; i += 2) out.push([arr[i], arr[i + 1]]); return out; };

  const HOME = [15.43379, 56.35514]; // the point you gave
  const BLEKINGE = [14.40, 55.95, 16.20, 56.65];
  const LIVE_DEM = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";
  const FAMILY = !!window.FIREBASE_CONFIG;  // hosted family site with Firebase login
  if (FAMILY) document.documentElement.classList.add("family");
  // offline: the family site keeps the app and the hunting-ground map on the phone (see sw.js)
  if (FAMILY && "serviceWorker" in navigator && !location.search.includes("shot=")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  const PLAN_KINDS = ["stands", "routes", "sightings", "tracks"];  // things each person plans; tagged with who made them
  const tr = (t) => (window.I18N ? window.I18N.tr(t) : t);  // for text drawn into the map canvas (the page text is translated automatically)
  const START = { center: [15.4339, 56.3532], zoom: 14.7 };
  // Areas with map data (Alnaryd, Bergåsa…), loaded from data/areas.json. GPS jumps only go to places near one,
  // so nobody ends up over an empty map.
  let AREAS = [{ id: "alnaryd", name: "Alnaryd", bounds: [15.4180, 56.3405, 15.4462, 56.3576] }];
  const inBox = ([lon, lat], b, pad) => lon > b[0] - pad * 1.8 && lon < b[2] + pad * 1.8 && lat > b[1] - pad && lat < b[3] + pad;
  const nearArea = (ll, pad = 0.02) => AREAS.some((a) => inBox(ll, a.bounds, pad));
  const areaCenter = (a) => [(a.bounds[0] + a.bounds[2]) / 2, (a.bounds[1] + a.bounds[3]) / 2];
  const kmToNearestArea = (ll) => Math.min(...AREAS.map((a) => Geo.distance(ll, areaCenter(a)))) / 1000;
  function unionBounds() {
    return AREAS.reduce((u, a) => [Math.min(u[0], a.bounds[0]), Math.min(u[1], a.bounds[1]), Math.max(u[2], a.bounds[2]), Math.max(u[3], a.bounds[3])],
      [180, 90, -180, -90]);
  }

  // ---------- reference data ----------
  const LAND = {
    3: "Arable land", 51: "Building", 52: "Developed ground", 53: "Road or railway", 54: "Peat cutting", 61: "Lake or stream", 62: "Sea",
    111: "Pine forest", 112: "Spruce forest", 113: "Mixed conifer", 114: "Conifer with broadleaf", 115: "Birch, aspen, alder",
    116: "Beech and oak", 117: "Broadleaf with beech/oak", 118: "Clearcut or young regrowth",
    200: "Open wetland", 211: "Shrub mire", 212: "Dwarf-shrub bog", 213: "Poor fen", 214: "Rich fen", 215: "Marsh", 216: "Soft mire",
    217: "Bare wetland", 218: "Open mire", 221: "Wetland with shrubs", 222: "Heathy wetland", 223: "Grassy wetland", 224: "Lush grassy wetland",
    225: "Tall-grass wetland", 226: "Moss wetland", 227: "Mud-bottom wetland", 228: "Open wetland", 411: "Bare rock or open ground",
    4211: "Scrub, dry", 4212: "Scrub", 4213: "Scrub, moist", 4221: "Heath, dry", 4222: "Heath", 4223: "Heath, moist",
    4231: "Grassland, dry", 4232: "Grassland", 4233: "Grassland, moist",
  };
  const landLabel = (c) => c >= 121 && c <= 128 ? LAND[c - 10] + " on wet ground" : (LAND[c] || "Unclassified");

  const FOREST_LEGEND = [
    ["#2f5a40", "Spruce"], ["#93a052", "Pine"], ["#4c6e45", "Mixed conifer"], ["#6b9254", "Conifer + broadleaf"],
    ["#a3c76c", "Birch, aspen, alder"], ["#d1a443", "Beech & oak (mast)"], ["#bdb35a", "Broadleaf mix"],
    ["#e0b39c", "Clearcut, regrowth"], ["#bba7cc", "Open mire"], ["#e3d6a6", "Grass, heath"], ["#efe4a4", "Arable"], ["#76a7cc", "Water"],
  ];
  const HEIGHT_RAMP = "linear-gradient(90deg,#efe9d6 0%,#e3dca0 7%,#b9cf7a 17%,#73a85a 33%,#3d7a4a 53%,#1f5240 73%,#123630 100%)";

  const SPECIES = [
    { id: "moose", name: "Moose", sv: "älg", color: "#7a4a22" },
    { id: "roe", name: "Roe deer", sv: "rådjur", color: "#d27a1c" },
    { id: "fallow", name: "Fallow deer", sv: "dovhjort", color: "#b99421" },
    { id: "red", name: "Red deer", sv: "kronhjort", color: "#9c2f25" },
    { id: "boar", name: "Wild boar", sv: "vildsvin", color: "#2e2e2e" },
    { id: "fox", name: "Fox", sv: "räv", color: "#e8590c" },
    { id: "bird", name: "Bird", sv: "fågel", color: "#5f3dc4" },
    { id: "other", name: "Other", sv: "annat", color: "#6c757d" },
  ];
  const speciesById = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
  const KINDS = { seen: "Seen", heard: "Heard", shot: "Shot", tracks: "Tracks / sign", bed: "Bed / daybed", rub: "Rub / wallow" };
  const STAND_TYPES = { tower: "Tower / high seat", ladder: "Ladder stand", ground: "Ground blind", pass: "Drive post" };
  const WIND8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir8 = (deg) => WIND8[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  const STATUS_COLORS = { good: "#2b8a3e", warn: "#d39b00", bad: "#d0332b" };

  // ---------- preferences (this device only) ----------
  const prefs = (() => {
    const defaults = { v: 3, windFlow: true, base: "forest", ov: { trails: true, contours: true, roads: true, reserve: false, boundary: true, sightings: true, wet: false, drainage: false, steep: false, game: false, quiet: false }, quietMode: "auto",
      wind: { from: 225, speed: 4 }, cones: true, exag: 1.6, tab: "map", view: true, target: 1.2, share: false, myCone: true };
    if (location.search.includes("shot=")) return defaults;
    try {
      const p = JSON.parse(localStorage.getItem("alnaryd-prefs") || "null");
      if (!p) return defaults;
      const merged = { ...defaults, ...p, ov: { ...defaults.ov, ...p.ov }, wind: { ...defaults.wind, ...p.wind } };
      if (!(p.v >= 2)) { merged.ov.reserve = false; merged.v = 2; }   // one-time: the reserve layer is now off by default
      // one-time: the position button used to switch on sharing as well; sharing is now a separate choice (OwnTracks does it)
      if (!(p.v >= 3)) { merged.share = false; merged.v = 3; }
      return merged;
    }
    catch { return defaults; }
  })();
  let prefsTimer = 0;
  function savePrefs() { if (location.search.includes("shot=")) return; clearTimeout(prefsTimer); prefsTimer = setTimeout(() => { try { localStorage.setItem("alnaryd-prefs", JSON.stringify(prefs)); } catch { /* storage unavailable */ } }, 300); }

  // ---------- storage: shared db when hosted on claude.ai, otherwise this browser ----------
  const Store = {
    db: null,
    data: { stands: [], sightings: [], routes: [], boundary: null, trails: [], places: [], tracks: [] },
    hasLayout: false,       // trails/places have been saved at least once in this store
    onChange: () => {},
    loadLocal() {
      try {
        const raw = localStorage.getItem("alnaryd-data");
        if (raw) { const d = JSON.parse(raw); Object.assign(this.data, d); this.hasLayout = Array.isArray(d.trails); }
      } catch { /* ignore */ }
    },
    // Trails and place names traced from the team's own map; used until edited copies are saved
    async loadDefaultLayout() {
      try {
        const [t, pl] = await Promise.all([getJSON("data/trails.geojson"), getJSON("data/places.geojson")]);
        if (this.db) return;  // the shared copy wins once it is connected
        this.data.trails = t.features.map((f, i) => ({ id: "tr-" + i, name: f.properties.name || "", pts: flat(f.geometry.coordinates) }));
        this.data.places = pl.features.map((f, i) => ({ id: "pl-" + i, name: f.properties.name, kind: f.properties.kind, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
        this.onChange();
      } catch { /* layer stays empty */ }
    },
    saveLocal() {
      try {
        const d = { ...this.data };
        if (!this.hasLayout) { delete d.trails; delete d.places; }
        localStorage.setItem("alnaryd-data", JSON.stringify(d));
      } catch { /* ignore */ }
    },
    async connect(given) {
      let db = given || null;
      if (!db) {
        const c = window.claude;
        if (!c || typeof c.use !== "function") return;
        try { db = await c.use("db"); } catch { db = null; }
      }
      if (!db) return;
      this.db = db;
      this.data = { stands: [], sightings: [], routes: [], boundary: null, trails: [], places: [], tracks: [] };
      // recorded tracks: their own list, so a site whose rules don't allow them yet still syncs the rest
      db.collection("tracks").onSnapshot((snap) => { this.data.tracks = snap.docs.map((d) => ({ ...d.data(), id: d.id })); this.onChange(); }, () => {});
      setSync("loading");
      const waiting = new Set(["stands", "sightings", "routes", "trails", "places", "boundary"]);
      const timer = setTimeout(() => { if (waiting.size) setSync("slow"); }, 10000);
      const settle = (k, meta) => { if (!meta.fromCache) { waiting.delete(k); if (!waiting.size) { clearTimeout(timer); setSync("shared"); } } };
      for (const k of ["stands", "sightings", "routes", "trails", "places"]) {
        db.collection(k).onSnapshot((snap) => {
          this.data[k] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          settle(k, snap.metadata); this.onChange();
        }, () => { clearTimeout(timer); setSync("error"); });
      }
      db.doc("map/boundary").onSnapshot((snap) => {
        this.data.boundary = snap.exists ? snap.data().pts || null : null;
        settle("boundary", snap.metadata); this.onChange();
      }, () => { clearTimeout(timer); setSync("error"); });
    },
    async put(kind, item) {
      const { id, ...body } = item;
      if (FAMILY && PLAN_KINDS.includes(kind) && !body.by && Family.user && !this.data[kind].some((x) => x.id === id)) body.by = Family.user.email.toLowerCase();
      if (this.db && FAMILY) {
        this.db.collection(kind).doc(id).set(body).catch(() => toast("Couldn't save. Check your connection."));
        return;
      }
      if (this.db) {
        try { await this.db.collection(kind).doc(id).set(body); }
        catch (e) { toast(e && e.code === "quota_exceeded" ? "Storage is full. Delete old sightings to make room." : "Couldn't save. Check your connection and try again."); }
        return;
      }
      const arr = this.data[kind]; const i = arr.findIndex((x) => x.id === id);
      if (i >= 0) arr[i] = { ...item }; else arr.push({ ...item });
      if (kind === "trails" || kind === "places") this.hasLayout = true;
      this.saveLocal(); this.onChange();
    },
    async remove(kind, id) {
      if (this.db && FAMILY) { this.db.collection(kind).doc(id).delete().catch(() => toast("Couldn't delete. Try again.")); return; }
      if (this.db) { try { await this.db.collection(kind).doc(id).delete(); } catch { toast("Couldn't delete. Try again."); } return; }
      this.data[kind] = this.data[kind].filter((x) => x.id !== id);
      if (kind === "trails" || kind === "places") this.hasLayout = true;
      this.saveLocal(); this.onChange();
    },
    async setBoundary(pts) {
      if (this.db) {
        try { if (pts) await this.db.doc("map/boundary").set({ pts }); else await this.db.doc("map/boundary").delete(); }
        catch { toast("Couldn't save the boundary. Try again."); }
        return;
      }
      this.data.boundary = pts; this.saveLocal(); this.onChange();
    },
  };

  function setSync(state) {
    const el = $("#syncState");
    el.dataset.state = state;
    el.textContent = { shared: "Synced to your account", loading: "Loading saved data…", slow: "Can't reach saved data yet", error: "Saved data unavailable" }[state] || "Saved on this device";
  }

  // ---------- UI helpers ----------
  let toastTimer = 0;
  function toast(msg, ms = 3200) {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }
  const isPhone = () => window.matchMedia("(max-width: 860px)").matches;
  function setSheet(state) {
    $("#app").dataset.sheet = state;
    if (state === "open" && isPhone()) closePopups();   // the panel and a menu would cover each other
  }
  // the + and 📢 menus: only one open at a time
  function closePopups() {
    for (const [m, b] of [["#addMenu", "#addBtn"], ["#huntMenu", "#huntBtn"]]) {
      const el = $(m); if (el) el.hidden = true;
      const btn = $(b); if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }
  // Phone: a tab bar at the bottom; the content above it follows your finger. Drag the tab bar or the handle up or
  // down, or pull the content down when it is scrolled to the top; let go and it settles open or closed depending
  // on how far and how fast.
  let sheetDragged = false;
  function sheetSwipe() {
    const app = $("#app"), panes = $(".panes");
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--panes-h)";
    app.appendChild(probe);
    let d = null;
    $("#panel").addEventListener("touchstart", (e) => {
      if (!isPhone() || e.touches.length !== 1) return;
      const top = e.target.closest(".sheet-handle, .tabs"), pane = e.target.closest(".panes");
      if (!top && !(pane && app.dataset.sheet === "open")) return;
      d = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), base: panes.offsetHeight, full: probe.offsetHeight, fromPane: !top, on: false, dy: 0, hist: [] };
    }, { passive: true });
    $("#panel").addEventListener("touchmove", (e) => {
      if (!d) return;
      const dy = e.touches[0].clientY - d.y, dx = e.touches[0].clientX - d.x;
      if (!d.on) {
        // sideways (the forecast strip, tabs): always a normal scroll
        if (Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy)) { d = null; return; }
        // in the content only a pull-down from the very top moves the panel; anything else scrolls as usual
        if (d.fromPane && (dy < 0 || panes.scrollTop > 0)) { d = null; return; }
        if (d.fromPane && dy > 2) e.preventDefault();   // a clear pull-down: claim it before the iPhone's rubber-band
        if (Math.abs(dy) < 8) return;
        d.on = true; panes.style.transition = "none";
      }
      d.dy = dy;
      const now = Date.now(); d.hist.push({ dy, t: now }); while (d.hist.length > 2 && now - d.hist[0].t > 150) d.hist.shift();
      panes.style.height = Math.min(d.full, Math.max(0, d.base - dy)) + "px";
      e.preventDefault();
    }, { passive: false });
    const end = () => {
      if (!d) return;
      const was = d; d = null;
      if (!was.on) return;
      // speed over the last moment (px per ms): a short flick counts as much as a long drag
      const ref = was.hist.length > 1 ? was.hist[0] : { dy: 0, t: was.t };
      const v = (was.dy - ref.dy) / Math.max(1, Date.now() - ref.t);
      const h = Math.min(was.full, Math.max(0, was.base - was.dy));
      const open = v < -0.3 ? true : v > 0.3 ? false : h > was.full / 2;
      panes.style.transition = ""; panes.style.height = "";
      setSheet(open ? "open" : "peek");
      sheetDragged = true; setTimeout(() => { sheetDragged = false; }, 350);   // the finger lifting isn't also a tap
    };
    $("#panel").addEventListener("touchend", end); $("#panel").addEventListener("touchcancel", end);
  }
  function showTab(name, expand) {
    prefs.tab = name; savePrefs();
    if (name === "seasons") renderSeasons();
    $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
    $$(".pane").forEach((p) => { p.hidden = p.id !== "pane-" + name; });
    if (expand && isPhone()) setSheet("open");
  }

  // ---------- map ----------
  // One bundled label font, stored as base64 text (the host serves no .pbf); decoded on request.
  maplibregl.addProtocol("glyph", async (params) => {
    const range = params.url.match(/(\d+-\d+)$/);
    if (!range) throw new Error("Unknown glyph range");
    const r = await fetch(abs(`glyphs/${range[1]}.txt`));
    if (!r.ok) throw new Error("Glyph range not bundled");
    const bin = atob((await r.text()).trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { data: bytes.buffer };
  });
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      glyphs: "glyph://{fontstack}/{range}",
      sources: {},
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#dcd7c8" } }],
    },
    center: START.center, zoom: START.zoom, minZoom: 12, maxZoom: 19.5,
    maxPitch: 75,
    attributionControl: false,   // sources are listed under Settings → Sources
  });
  if (/[?&](shot|test)=/.test(location.search)) window.__map = map;  // test hook for screenshot mode and tests

  let manifests = [];   // one per area
  const loadedImageSets = new Set();
  const FC = (features = []) => ({ type: "FeatureCollection", features });
  // Outside-the-boundary mask: a counter-clockwise frame around the area with the boundary as a clockwise hole
  function maskOuter() {
    const [w, s, e, n] = unionBounds();
    return [[w - .3, s - .3], [e + .3, s - .3], [e + .3, n + .3], [w - .3, n + .3], [w - .3, s - .3]];
  }
  function clockwise(ring) {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    return area > 0 ? ring : ring.slice().reverse();
  }

  const imageIds = (name) => manifests.flatMap((m) => (m.layers[name] || []).map((_, i) => `${name}-${m.id}-${i}`));
  function addImageSet(name, beforeId) {
    if (loadedImageSets.has(name) || !manifests.length) return;
    loadedImageSets.add(name);
    for (const m of manifests) {
      (m.layers[name] || []).forEach((chunk, i) => {
        const sid = `${name}-${m.id}-${i}`;
        map.addSource(sid, { type: "image", url: abs(chunk.url), coordinates: chunk.coordinates });
        map.addLayer({ id: sid, type: "raster", source: sid, paint: { "raster-fade-duration": 0, "raster-resampling": "linear" } }, beforeId);
      });
    }
  }
  function setImageSetVisible(name, on) {
    if (on) addImageSet(name, ["wet", "steep", "game", "quiet_dry", "quiet_wet"].includes(name) ? "anchor-overlays" : "anchor-base");
    for (const id of imageIds(name)) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
  }

  function arrowImage(color) {
    const s = 32, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    g.strokeStyle = color; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(10, 8); g.lineTo(22, 16); g.lineTo(10, 24); g.stroke();
    return g.getImageData(0, 0, s, s);
  }

  async function getJSON(p) { const r = await fetch(abs(p), { cache: "no-cache" }); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); }
  // the lists of areas and layers: tagged with the app version so an older offline cache can't hand back an old list
  // (which would leave new layers blank); the plain address is the fallback offline
  async function getFresh(p) {
    if (window.APP_VERSION) { try { return await getJSON(`${p}?v=${window.APP_VERSION}`); } catch { /* offline */ } }
    return getJSON(p);
  }

  map.on("load", async () => {
    try {
      const list = await getFresh("data/areas.json");
      manifests = await Promise.all(list.map((a) => getFresh(`data/${a.id}/manifest.json`)));
    } catch { $("#loading").textContent = "Map data didn't load. Reload the page."; return; }
    AREAS = manifests.map((m) => ({ id: m.id, name: m.name, bounds: m.bounds }));
    const U = unionBounds();
    // terrain wind (WindNinja) where it has been modelled; straight cones elsewhere
    window.TerrainWind.load(abs, AREAS.map((a) => a.id)).then(async (ok) => {
      if (!ok) return;
      terrainWind = true; flow = window.TerrainWind.Flow(map);
      await window.TerrainWind.loadTerrain(abs, manifests.filter((m) => m.terrain).map((m) => m.terrain));
      renderAll(); renderFlow();
    });

    // Elevation for all of Blekinge, loaded live for the part on screen (Lantmäteriet 1 m via Mapterhorn):
    // relief shading under our detailed areas and 3D terrain everywhere in the county.
    map.addSource("dem", { type: "raster-dem", tiles: [LIVE_DEM], tileSize: 512, encoding: "terrarium", minzoom: 6, maxzoom: 15, bounds: BLEKINGE });
    map.addImage("arrow-blue", arrowImage("#1f6fb5"), { pixelRatio: 2 });

    // relief shading from the live elevation; our own images draw on top of it inside the areas
    map.addLayer({ id: "relief-live", type: "hillshade", source: "dem", paint: {
      "hillshade-method": "multidirectional", "hillshade-illumination-direction": [315, 270, 0, 225], "hillshade-illumination-altitude": [40, 40, 40, 40],
      "hillshade-shadow-color": ["#2c3024", "#2c3024", "#3b3f30", "#3b3f30"], "hillshade-highlight-color": ["#fbf8ef", "#f3efe4", "#f3efe4", "#ebe6d8"],
      "hillshade-accent-color": "#4a4c3e", "hillshade-exaggeration": 0.55 } });
    // invisible anchors keep layer groups in order however late images are added
    for (const id of ["anchor-base", "anchor-overlays", "anchor-vectors"]) map.addLayer({ id, type: "background", layout: { visibility: "none" }, paint: { "background-opacity": 0 } });

    for (const id of ["osm", "contours", "reserves", "drainage", "gamezones", "routeopts", "dayroutes", "trails", "places", "boundary", "mask", "sectors", "cones", "mycone", "routes", "tracks", "goto", "draft", "edit", "sightings", "me"]) {
      map.addSource(id, { type: "geojson", data: FC() });
    }

    // water & wetland
    map.addLayer({ id: "water", type: "fill", source: "osm", filter: ["==", ["get", "kind"], "water"], paint: { "fill-color": "#76a7cc", "fill-opacity": .55 } });
    // reserve fill
    map.addLayer({ id: "reserve-fill", type: "fill", source: "reserves", paint: { "fill-color": "#3f9a3f", "fill-opacity": .07 } });
    // contours
    map.addLayer({ id: "contour-1", type: "line", source: "contours", minzoom: 15, filter: ["==", ["get", "k"], 1],
      paint: { "line-color": "#4a2a0e", "line-opacity": ["interpolate", ["linear"], ["zoom"], 15, .25, 17, .45], "line-width": ["interpolate", ["linear"], ["zoom"], 15, .5, 18, 1] } });
    map.addLayer({ id: "contour-5", type: "line", source: "contours", filter: [">=", ["get", "k"], 2],
      paint: { "line-color": "#4a2a0e", "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, .5, 16, .75],
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, ["case", ["==", ["get", "k"], 3], 1.3, .7], 16, ["case", ["==", ["get", "k"], 3], 2.2, 1.3]] } });
    // drainage / cold air
    map.addLayer({ id: "drainage", type: "line", source: "drainage", layout: { "line-cap": "round" },
      paint: { "line-color": "#1f6fb5", "line-opacity": .8, "line-width": ["interpolate", ["linear"], ["get", "ha"], 1.5, .8, 20, 2.2, 200, 3.4] } });
    map.addLayer({ id: "drainage-arrows", type: "symbol", source: "drainage", minzoom: 14.5,
      layout: { "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "arrow-blue", "icon-size": .55, "icon-allow-overlap": true, "icon-ignore-placement": true } });
    // game model: bedding (solid blue) and feeding (dashed yellow) outlines with a faint tint
    const ZONE = ["match", ["get", "k"], "bed", "#5ec8ff", "#ffe14d"];
    map.addLayer({ id: "gamezones-fill", type: "fill", source: "gamezones", paint: { "fill-color": ZONE, "fill-opacity": .1 } });
    map.addLayer({ id: "gamezones-case", type: "line", source: "gamezones", layout: { "line-join": "round" },
      paint: { "line-color": "#0d1b26", "line-opacity": .45, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 2.6, 17, 4.6] } });
    map.addLayer({ id: "gamezones-bed", type: "line", source: "gamezones", filter: ["==", ["get", "k"], "bed"], layout: { "line-join": "round" },
      paint: { "line-color": ZONE, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.4, 17, 2.6] } });
    map.addLayer({ id: "gamezones-food", type: "line", source: "gamezones", filter: ["==", ["get", "k"], "food"], layout: { "line-join": "round" },
      paint: { "line-color": ZONE, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.4, 17, 2.6], "line-dasharray": [2.5, 1.5] } });
    // streams and roads
    map.addLayer({ id: "streams", type: "line", source: "osm", filter: ["==", ["get", "kind"], "stream"], paint: { "line-color": "#2f78c0", "line-width": 1.6 } });
    map.addLayer({ id: "road-case", type: "line", source: "osm", filter: ["in", ["get", "kind"], ["literal", ["road_major", "road", "road_minor"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fbf8ef", "line-width": ["match", ["get", "kind"], "road_major", 6, "road", 4.2, 3] } });
    map.addLayer({ id: "road", type: "line", source: "osm", filter: ["in", ["get", "kind"], ["literal", ["road_major", "road", "road_minor"]]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["match", ["get", "kind"], "road_major", "#d9662b", "#6b625a"], "line-width": ["match", ["get", "kind"], "road_major", 3.6, "road", 2.2, 1.6] } });
    map.addLayer({ id: "track", type: "line", source: "osm", filter: ["==", ["get", "kind"], "track"],
      paint: { "line-color": "#5b5048", "line-width": 1.8, "line-dasharray": [3, 1.5] } });
    map.addLayer({ id: "path", type: "line", source: "osm", filter: ["in", ["get", "kind"], ["literal", ["path", "rail"]]],
      paint: { "line-color": "#5b5048", "line-width": 1.4, "line-dasharray": [1, 1.6] } });
    map.addLayer({ id: "power", type: "line", source: "osm", filter: ["==", ["get", "kind"], "power"], paint: { "line-color": "#444", "line-width": 1, "line-dasharray": [6, 2] } });
    map.addLayer({ id: "buildings", type: "fill", source: "osm", filter: ["==", ["get", "kind"], "building"], paint: { "fill-color": "#4b423c" } });
    map.addLayer({ id: "road-label", type: "symbol", source: "osm", minzoom: 14, filter: ["all", ["in", ["get", "kind"], ["literal", ["road_major", "road", "path"]]], ["!=", ["get", "name"], ""]],
      layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"], "text-size": 11, "symbol-spacing": 400 },
      paint: { "text-color": "#3a332e", "text-halo-color": "rgba(251,248,239,.9)", "text-halo-width": 1.5 } });
    map.addLayer({ id: "place-label", type: "symbol", source: "osm", filter: ["==", ["get", "kind"], "place"],
      layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"], "text-size": 13, "text-letter-spacing": .05 },
      paint: { "text-color": "#2b2622", "text-halo-color": "rgba(251,248,239,.95)", "text-halo-width": 1.8 } });
    // the team's own trails and place names (traced from their map)
    map.addLayer({ id: "trails-case", type: "line", source: "trails", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "rgba(251,248,239,.85)", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 6] } });
    map.addLayer({ id: "trails", type: "line", source: "trails", layout: { "line-join": "round" },
      paint: { "line-color": "#3b3530", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.6, 17, 3.2], "line-dasharray": [2, 1.2] } });
    map.addLayer({ id: "trails-label", type: "symbol", source: "trails", minzoom: 14.5, filter: ["!=", ["get", "name"], ""],
      layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"], "text-size": 12, "symbol-spacing": 260, "text-max-angle": 35 },
      paint: { "text-color": "#2b2622", "text-halo-color": "rgba(251,248,239,.95)", "text-halo-width": 2 } });
    map.addLayer({ id: "places-dot", type: "circle", source: "places", filter: ["in", ["get", "kind"], ["literal", ["entry", "parking"]]],
      paint: { "circle-radius": 5.5, "circle-color": ["match", ["get", "kind"], "parking", "#1d4ed8", "#df5a12"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    map.addLayer({ id: "places-label", type: "symbol", source: "places",
      layout: { "text-field": ["get", "name"], "text-font": ["Open Sans Semibold"],
        "text-size": ["match", ["get", "kind"], ["entry", "parking"], 11.5, 14],
        "text-letter-spacing": ["match", ["get", "kind"], ["entry", "parking"], 0, .04],
        "text-anchor": ["match", ["get", "kind"], ["entry", "parking"], "top", "center"],
        "text-offset": ["match", ["get", "kind"], ["entry", "parking"], ["literal", [0, .7]], ["literal", [0, 0]]],
        "text-max-width": 8 },
      paint: { "text-color": ["match", ["get", "kind"], "water", "#24618f", ["moose", "deer", "boar", "wallow"], "#6b2a10", "#2b2622"],
        "text-halo-color": "rgba(251,248,239,.92)", "text-halo-width": 2 } });
    // reserve outline
    map.addLayer({ id: "reserve-line-halo", type: "line", source: "reserves", paint: { "line-color": "#3f9a3f", "line-opacity": .25, "line-width": 7 } });
    map.addLayer({ id: "reserve-line", type: "line", source: "reserves", paint: { "line-color": "#2f8a2f", "line-width": 2 } });
    // boundary
    map.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": "#141a14", "fill-opacity": .32 } });
    map.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#df5a12", "line-width": 3.2 } });
    // stands: sectors and scent cones
    map.addLayer({ id: "cones", type: "fill", source: "cones", paint: { "fill-color": "#df5a12", "fill-opacity": .13 } });
    map.addLayer({ id: "cones-line", type: "line", source: "cones", paint: { "line-color": "#df5a12", "line-opacity": .55, "line-width": 1.2, "line-dasharray": [2, 2] } });
    map.addLayer({ id: "mycone", type: "fill", source: "mycone", paint: { "fill-color": "#ff7a2e", "fill-opacity": .22 } });
    map.addLayer({ id: "mycone-line", type: "line", source: "mycone", paint: { "line-color": "#ff7a2e", "line-width": 2, "line-dasharray": [1.5, 1.5] } });
    map.addLayer({ id: "sectors", type: "fill", source: "sectors", paint: { "fill-color": ["get", "color"], "fill-opacity": .2 } });
    map.addLayer({ id: "sectors-line", type: "line", source: "sectors", paint: { "line-color": ["get", "color"], "line-width": 1.6 } });
    // routes
    const notLabel = ["!", ["has", "label"]];
    map.addLayer({ id: "routes-case", type: "line", source: "routes", filter: notLabel, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 6.5 } });
    map.addLayer({ id: "routes", type: "line", source: "routes", filter: notLabel, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
    map.addLayer({ id: "routes-label", type: "symbol", source: "routes", filter: ["has", "label"], minzoom: 14,
      layout: { "symbol-placement": "line", "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 12, "symbol-spacing": 300, "text-max-angle": 35, "text-offset": [0, -1.1] },
      paint: { "text-color": "#1b1f18", "text-halo-color": "#fff", "text-halo-width": 1.6 } });
    map.addLayer({ id: "goto", type: "line", source: "goto", layout: { "line-cap": "round" },
      paint: { "line-color": "#ff7a2e", "line-width": 3, "line-dasharray": [1.5, 1.5] } });
    // hunt day: the way each person walks to their stand (their colour), and the suggestions while choosing one
    map.addLayer({ id: "dayroutes", type: "line", source: "dayroutes", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-opacity": .85, "line-dasharray": [2, 1.2] } });
    map.addLayer({ id: "dayspots", type: "circle", source: "dayroutes", filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 9, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
    map.addLayer({ id: "dayspots-label", type: "symbol", source: "dayroutes", filter: ["==", ["geometry-type"], "Point"],
      layout: { "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 12, "text-offset": [0, 1.4], "text-anchor": "top" },
      paint: { "text-color": "#1b1f18", "text-halo-color": "#fff", "text-halo-width": 1.6 } });
    map.addLayer({ id: "routeopts-case", type: "line", source: "routeopts", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#10160f", "line-width": ["case", ["get", "sel"], 9, 6], "line-opacity": .55 } });
    map.addLayer({ id: "routeopts", type: "line", source: "routeopts", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "sel"], 5.5, 3.5] } });
    map.addLayer({ id: "routeopts-label", type: "symbol", source: "routeopts",
      layout: { "symbol-placement": "line-center", "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 13, "text-allow-overlap": true },
      paint: { "text-color": "#fff", "text-halo-color": ["get", "color"], "text-halo-width": 2.2 } });
    // recorded tracks and blood-tracking marks
    map.addLayer({ id: "tracks-case", type: "line", source: "tracks", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fff", "line-width": 5, "line-opacity": .7 } });
    map.addLayer({ id: "tracks", type: "line", source: "tracks", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 3 } });
    map.addLayer({ id: "track-marks", type: "circle", source: "tracks", filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 6, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    map.addLayer({ id: "track-marks-label", type: "symbol", source: "tracks", filter: ["==", ["geometry-type"], "Point"], minzoom: 15.5,
      layout: { "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-offset": [0, 1.2], "text-anchor": "top" },
      paint: { "text-color": "#1b1f18", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
    // sightings
    map.addLayer({ id: "sightings", type: "circle", source: "sightings",
      // heard (not seen): a hollow ring in the species colour
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 5, 17, 10],
        "circle-color": ["case", ["get", "heard"], "rgba(255,255,255,.85)", ["get", "color"]],
        "circle-stroke-color": ["case", ["get", "heard"], ["get", "color"], "#fff"], "circle-stroke-width": ["case", ["get", "heard"], 3.5, 2.5] } });
    map.addLayer({ id: "sightings-label", type: "symbol", source: "sightings", minzoom: 15.5,
      layout: { "text-field": ["get", "label"], "text-font": ["Open Sans Semibold"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top" },
      paint: { "text-color": "#1c231b", "text-halo-color": "rgba(255,255,255,.9)", "text-halo-width": 1.5 } });
    // draft geometry while drawing
    map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#df5a12", "fill-opacity": .12 } });
    map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#df5a12", "line-width": 2.5, "line-dasharray": [2, 1] } });
    map.addLayer({ id: "draft-pts", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#df5a12", "circle-stroke-width": 2.5 } });
    // boundary editing handles
    map.addLayer({ id: "edit-line", type: "line", source: "edit", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "#df5a12", "line-width": 3 } });
    map.addLayer({ id: "edit-mid", type: "circle", source: "edit", minzoom: 15.5, filter: ["==", ["get", "role"], "mid"],
      paint: { "circle-radius": 5, "circle-color": "rgba(255,255,255,.7)", "circle-stroke-color": "#df5a12", "circle-stroke-width": 1.5 } });
    map.addLayer({ id: "edit-vtx", type: "circle", source: "edit", filter: ["==", ["get", "role"], "vtx"],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, ["case", ["get", "sel"], 7, 3.5], 17, ["case", ["get", "sel"], 10, 7]],
        "circle-color": ["case", ["get", "sel"], "#df5a12", "#fff"], "circle-stroke-color": "#df5a12", "circle-stroke-width": 2.5 } });
    // my position
    map.addLayer({ id: "me-acc", type: "fill", source: "me", paint: { "fill-color": "#1d7cf2", "fill-opacity": .12 } });

    // data
    addImageSet(prefs.base, "anchor-base");
    // vector layers: one file per area, merged into one map source each
    for (const k of ["osm", "reserves", "drainage", "contours", "gamezones"]) {
      Promise.all(manifests.map((m) => getFresh(`data/${m.id}/${k}.geojson`).catch(() => FC())))
        .then((parts) => { vectors[k] = parts.flatMap((d) => d.features); map.getSource(k).setData(FC(vectors[k])); if (k === "osm") Router.base = null; });
    }
    loadInfoGrid();

    applyLayers();
    renderLegend();
    renderAll();
    if (Store.data.boundary) fitBoundary(false);
    const attrib = document.querySelector(".maplibregl-ctrl-attrib");
    if (attrib) { attrib.classList.remove("maplibregl-compact-show"); attrib.removeAttribute("open"); }
    map.once("idle", () => $("#loading").classList.add("done"));
    setTimeout(() => $("#loading").classList.add("done"), 6000);
  });

  // ---------- layer state ----------
  const OV_LAYERS = {
    contours: ["contour-1", "contour-5"],
    roads: ["road-case", "road", "track", "path", "power", "buildings", "road-label"],
    reserve: ["reserve-fill", "reserve-line-halo", "reserve-line"],
    sightings: ["sightings", "sightings-label"],
    boundary: ["mask", "boundary-line"],
    drainage: ["drainage", "drainage-arrows"],
    game: ["gamezones-fill", "gamezones-case", "gamezones-bed", "gamezones-food"],
    trails: ["trails-case", "trails", "trails-label", "places-dot", "places-label"],
  };
  function applyLayers() {
    if (!manifests.length) return;
    for (const b of ["forest", "relief", "height"]) setImageSetVisible(b, prefs.base === b);
    for (const [k, ids] of Object.entries(OV_LAYERS)) ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", prefs.ov[k] ? "visible" : "none"));
    setImageSetVisible("wet", prefs.ov.wet);
    setImageSetVisible("steep", prefs.ov.steep);
    setImageSetVisible("game", prefs.ov.game);
    $("#gameLegend").hidden = !prefs.ov.game;
    const wet = Ground.wet().wet;
    setImageSetVisible("quiet_dry", prefs.ov.quiet && !wet);
    setImageSetVisible("quiet_wet", prefs.ov.quiet && wet);
    $("#quietLegend").hidden = !prefs.ov.quiet;
    Ground.render();
    for (const id of ["cones", "cones-line"]) map.setLayoutProperty(id, "visibility", prefs.cones ? "visible" : "none");
  }

  function renderLegend() {
    const el = $("#legend");
    if (prefs.base === "forest") {
      el.innerHTML = FOREST_LEGEND.map(([c, t]) => `<div><i style="background:${c}"></i><span>${t}</span></div>`).join("") +
        `<div class="note small" style="grid-column:1/-1">Bluer shades of the same colour grow on wet ground.</div>`;
    } else if (prefs.base === "height") {
      el.innerHTML = `<i class="ramp" style="background:${HEIGHT_RAMP}"></i><div class="ramp-labels"><span>0 m</span><span>5</span><span>10</span><span>16</span><span>22</span><span>30 m</span></div>
        <div class="note small" style="grid-column:1/-1">Pale patches are open ground or young plantings; dark is tall, old forest.</div>`;
    } else {
      el.innerHTML = `<div class="note small" style="grid-column:1/-1">Laser-scanned ground with the trees removed, lit from the northwest. Ditches, stone walls, boulders and old tracks stand out.</div>`;
    }
  }

  // ---------- 3D ----------
  let is3D = false;
  function set3D(on, animate = true) {
    is3D = on;
    $("#tilt").setAttribute("aria-pressed", String(on));
    if (on) { map.setTerrain({ source: "dem", exaggeration: prefs.exag }); if (animate) map.easeTo({ pitch: 62, duration: 900 }); }
    else { map.setTerrain(null); if (animate) map.easeTo({ pitch: 0, duration: 600 }); }
    renderFlow();
  }


  // ---------- stands ----------
  let draftStand = null;   // stand being edited (new or existing copy)
  const markers = new Map();

  function standStatus(s, w = prefs.wind) {
    if (w.speed < 1 && !thermal.kind) return { cls: "warn", text: "Calm, swirling" };   // with thermals the air still has a direction
    const down = (localFrom(s.lon, s.lat, w.from) + 180) % 360;
    const d = Geo.angleDiff(down, s.facing);
    if (d <= s.width / 2 + 15) return { cls: "bad", text: "Scent into sector" };
    if (d <= 100) return { cls: "warn", text: "Side wind" };
    return { cls: "good", text: "Good wind" };
  }
  // Scent from a point: follows the modelled airflow through the terrain where we have it, otherwise a straight wedge.
  let terrainWind = false, flow = null;
  function coneGeom(s) {
    const w = prefs.wind;
    const half = clamp(40 - w.speed * 2.5, 12, 40);
    const len = clamp(120 + w.speed * 70, 120, 700);
    const curved = terrainWind && window.TerrainWind.plume(s.lon, s.lat, w.from, len, half);
    return curved || Geo.wedge([s.lon, s.lat], (w.from + 180) % 360, half, len);
  }
  // The wind where you stand: turned by hills and valleys when the terrain model covers the spot.
  function localFrom(lon, lat, from = prefs.wind.from) {
    const l = terrainWind && window.TerrainWind.local(lon, lat, from);
    return l ? l.from : from;
  }

  // ---------- best stands: forecast wind at each stand plus what you have seen there before ----------
  // Score = wind (good 3, side 1, scent into the sector -3) + sightings within 300 m that were logged
  // in a similar wind (same or neighbouring direction) and at a similar time of day (±2 h).
  function bestStands(h) {
    const w = { from: h.from, speed: h.speed }, hour = new Date(h.t).getHours(), d8 = dir8(h.from), i8 = WIND8.indexOf(d8);
    const near8 = new Set([d8, WIND8[(i8 + 1) % 8], WIND8[(i8 + 7) % 8]]);
    return plans("stands").map((st) => {
      const ws = standStatus(st, w);
      let seen = 0, similar = 0;
      for (const x of Store.data.sightings) {
        if (Geo.distance([st.lon, st.lat], [x.lon, x.lat]) > 300) continue;
        seen++;
        const xh = x.when ? new Date(x.when).getHours() : null, xw = (x.wind || "").split(" ")[0];
        const timeOk = xh === null || Math.min(Math.abs(xh - hour), 24 - Math.abs(xh - hour)) <= 2;
        if (timeOk && (!xw || near8.has(xw))) similar += x.count || 1;
      }
      const score = (ws.cls === "good" ? 3 : ws.cls === "warn" ? 1 : -3) + Math.min(similar, 10) * 0.6 + Math.min(seen, 10) * 0.1;
      return { st, ws, seen, similar, score };
    }).sort((a, b) => b.score - a.score);
  }
  function renderBest() {
    const box = $("#bestStands");
    if (!Forecast.hours.length || !plans("stands").length) { box.hidden = true; return; }
    box.hidden = false;
    const now = Date.now(), tm = new Date(); tm.setDate(tm.getDate() + 1); tm.setMinutes(0, 0, 0);
    const at = (hr) => { const t = new Date(tm); t.setHours(hr); return Forecast.hours.find((x) => Math.abs(x.t - t.getTime()) < 3600e3); };
    const slots = [
      { name: "Now", h: Forecast.hours.find((x) => x.t > now - 3600e3) },
      { name: "Tomorrow morning", h: at(7) },
      { name: "Tomorrow evening", h: at(16) },
    ].filter((x) => x.h);
    $("#bestList").innerHTML = slots.map(({ name, h }) => {
      const top = bestStands(h).filter((r) => r.ws.cls !== "bad").slice(0, 3);
      return `<div class="best-slot"><div class="best-head"><b>${name}</b><span>${Geo.compassName(h.from)} ${Math.round(h.speed)} m/s</span></div>` +
        (top.length ? top.map((r, i) => `<div class="best-row" data-id="${esc(r.st.id)}"><span class="best-n">${i + 1}</span>
          <span class="best-name">${esc(r.st.name || "Stand")}</span>
          <span class="best-why">${r.similar ? `<span>${r.similar} seen in similar wind</span>` : r.seen ? `<span>${r.seen} seen here</span>` : ""}</span>
          <span class="pill ${r.ws.cls}">${r.ws.text}</span></div>`).join("")
          : `<div class="note small">No stand has good wind then.</div>`) + `</div>`;
    }).join("");
  }
  function renderFlow() {
    if (flow) flow.set({ on: prefs.windFlow && is3D, from: prefs.wind.from, speed: prefs.wind.speed });   // only in 3D: flat they look like snow
  }
  const STAND_ICON = {
    tower: '<svg viewBox="0 0 24 24"><path d="M7 21 10 9h4l3 12M8.5 15h7M6 9h12l-2-5H8z"/></svg>',
    ladder: '<svg viewBox="0 0 24 24"><path d="M8 21 11 4M16 21 13 4M9 16h6M10 11h4"/></svg>',
    ground: '<svg viewBox="0 0 24 24"><path d="M3 19 12 6l9 13zM10 19v-4h4v4"/></svg>',
    pass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
  };

  // Plans (stands, routes, sightings) belong to whoever made them; each person can hide others' plans on their own phone.
  function planShown(x) { return !(prefs.hideBy || {})[x.by || "?"]; }
  function plans(kind) { return Store.data[kind].filter(planShown); }
  function whoName(by) {
    if (!by) return "Unknown";
    return FAMILY ? Family.nameFor(by) : by.split("@")[0];
  }
  function whoTag(x) { return FAMILY && x.by ? ` · ${esc(whoName(x.by))}` : ""; }
  function renderWho() {
    const box = $("#whoBox");
    if (!FAMILY || !Family.user) { box.hidden = true; return; }
    const people = Family.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv")).map((m) => ({ key: m.email, name: m.name || m.email, color: Family.colorFor(m.email) }));
    const known = new Set(people.map((p) => p.key));
    const extra = new Set();
    for (const k of PLAN_KINDS) for (const x of Store.data[k]) if (!known.has(x.by || "?")) extra.add(x.by || "?");
    for (const k of extra) people.push({ key: k, name: k === "?" ? "Made before names were saved" : k.split("@")[0], color: "#8a9384" });
    const me = Family.user.email.toLowerCase(), hide = prefs.hideBy || {};
    const count = (key) => PLAN_KINDS.reduce((n, k) => n + Store.data[k].filter((x) => (x.by || "?") === key).length, 0);
    box.hidden = people.length < 2;
    $("#whoList").innerHTML = people.map((p) => `<li><label><input type="checkbox" data-who="${esc(p.key)}"${hide[p.key] ? "" : " checked"}>
      <span class="sw" style="background:${p.color};border-radius:50%;width:12px;height:12px;margin:0 5px"></span>${esc(p.name)}${p.key === me ? " <span>(you)</span>" : ""} <small>${count(p.key)}</small></label></li>`).join("");
  }

  function allStands() {
    const list = plans("stands").filter((s) => !draftStand || s.id !== draftStand.id);
    return draftStand ? [...list, draftStand] : list;
  }

  function syncMarkers() {
    const stands = allStands();
    const keep = new Set(stands.map((s) => s.id));
    for (const [id, m] of markers) if (!keep.has(id)) { m.remove(); markers.delete(id); }
    for (const s of stands) {
      const st = standStatus(s);
      let m = markers.get(s.id);
      if (!m) {
        const el = document.createElement("div");
        el.className = "stand-marker";
        el.innerHTML = `<div class="disc"></div><div class="stand-label"></div><b class="stand-who" hidden translate="no"></b>`;
        el.addEventListener("click", (e) => { e.stopPropagation(); if (!tool) editStand(s.id); });
        m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([s.lon, s.lat]).addTo(map);
        m.on("drag", () => {
          const ll = m.getLngLat(); const cur = draftStand && draftStand.id === s.id ? draftStand : Store.data.stands.find((x) => x.id === s.id);
          if (cur) { cur.lon = ll.lng; cur.lat = ll.lat; renderStandGeometry(); }
        });
        m.on("dragend", () => {
          const ll = m.getLngLat();
          if (draftStand && draftStand.id === s.id) { draftStand.lon = ll.lng; draftStand.lat = ll.lat; return; }
          const cur = Store.data.stands.find((x) => x.id === s.id);
          if (cur) Store.put("stands", { ...cur, lon: ll.lng, lat: ll.lat });
        });
        markers.set(s.id, m);
      }
      m.setLngLat([s.lon, s.lat]);
      const el = m.getElement();
      el.classList.toggle("sel", !!draftStand && draftStand.id === s.id);
      el.style.setProperty("--ring", STATUS_COLORS[st.cls]);
      el.querySelector(".disc").innerHTML = STAND_ICON[s.type] || STAND_ICON.tower;
      el.querySelector(".stand-label").textContent = s.name || "New stand";
      const who = FAMILY ? Hunt.onStand(s.id) : null, badge = el.querySelector(".stand-who");
      badge.hidden = !who;
      if (who) { badge.textContent = Family.letterFor(who.email, who.name); badge.style.background = Family.colorFor(who.email); }
      el.title = `${s.name || "Stand"} · ${st.text}`;
    }
  }

  function renderStandGeometry() {
    if (!map.getSource("sectors")) return;
    const stands = allStands();
    map.getSource("sectors").setData(FC(stands.map((s) => ({
      type: "Feature", properties: { color: STATUS_COLORS[standStatus(s).cls] },
      geometry: { type: "Polygon", coordinates: [Geo.wedge([s.lon, s.lat], s.facing, s.width / 2, s.range)] },
    }))));
    map.getSource("cones").setData(FC(prefs.wind.speed >= 0 ? stands.map((s) => ({
      type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coneGeom(s)] },
    })) : []));
    if (draftStand && prefs.view) scheduleView(); else hideView();
    renderMyCone();
  }
  // Scent from your own GPS position, shaped by the wind you have set (SMHI or by hand). Calm air: a circle of swirl.
  function renderMyCone() {
    const src = map.getSource("mycone");
    if (!src) return;
    const pos = myPos();
    if (!prefs.myCone || !pos) { src.setData(FC()); return; }
    const w = prefs.wind;
    const ring = w.speed < 1 ? Geo.circle(pos.ll, 60) : coneGeom({ lon: pos.ll[0], lat: pos.ll[1] });
    src.setData(FC([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }]));
  }

  function editStand(id) {
    const s = Store.data.stands.find((x) => x.id === id);
    if (!s) return;
    draftStand = { ...s, winds: [...(s.winds || [])], isNew: false };
    openStandForm();
  }

  function newStandAt(lngLat) {
    draftStand = { id: newId("st"), name: "", type: "tower", height: 3, facing: Math.round(prefs.wind.from / 5) * 5 % 360, width: 90, range: 120, winds: [], notes: "",
      lon: lngLat.lng, lat: lngLat.lat, isNew: true };
    openStandForm();
  }

  function openStandForm() {
    const s = draftStand;
    showTab("stands", true);
    $("#standForm").hidden = false;
    $("#standFormTitle").textContent = s.isNew ? "New stand" : "Edit stand";
    $("#sf-name").value = s.name; $("#sf-type").value = s.type; $("#sf-height").value = s.height;
    $("#sf-facing").value = s.facing; $("#sf-width").value = s.width; $("#sf-range").value = s.range; $("#sf-notes").value = s.notes || "";
    $("#sf-delete").hidden = s.isNew;
    viewKey = ""; $("#sf-viewStats").textContent = "";
    updateStandOutputs();
    renderAll();
    showForm("#standForm", [s.lon, s.lat]);
    if (!isPhone()) setTimeout(() => $("#sf-name").focus({ preventScroll: true }), 50);   // on a phone the keyboard would cover it all
  }
  // A form opened from the map: show it from its first field, and on a phone keep the spot visible above the panel
  function showForm(sel, ll) {
    const panes = $(".panes"), f = $(sel);
    panes.scrollTop = Math.max(0, f.offsetTop - panes.offsetTop - 8);
    if (!isPhone() || !ll) return;
    setTimeout(() => {
      const top = $("#panel").getBoundingClientRect().top, p = map.project(ll);
      if (p.y > top - 50) map.easeTo({ center: ll, offset: [0, top / 2 - map.getContainer().clientHeight / 2], duration: 400 });
    }, 300);   // after the panel has opened
  }
  function updateStandOutputs() {
    $("#sf-facingOut").textContent = `${Geo.compassName(+$("#sf-facing").value)} · ${$("#sf-facing").value}°`;
    $("#sf-widthOut").textContent = $("#sf-width").value + "°";
    $("#sf-rangeOut").textContent = $("#sf-range").value + " m";
  }
  function readStandForm() {
    Object.assign(draftStand, {
      name: $("#sf-name").value.trim(), type: $("#sf-type").value, height: +$("#sf-height").value || 0,
      facing: +$("#sf-facing").value, width: +$("#sf-width").value, range: +$("#sf-range").value, notes: $("#sf-notes").value.trim(),
    });
  }
  function closeStandForm() { draftStand = null; $("#standForm").hidden = true; renderAll(); }

  // ---------- routes ----------
  function segColor(a, b) {
    const d = Geo.angleDiff(Geo.bearing(a, b), prefs.wind.from);
    return d <= 60 ? STATUS_COLORS.good : d <= 120 ? STATUS_COLORS.warn : STATUS_COLORS.bad;
  }
  function routeStats(pts) {
    let len = 0, into = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Geo.distance(pts[i - 1], pts[i]); len += d;
      if (Geo.angleDiff(Geo.bearing(pts[i - 1], pts[i]), prefs.wind.from) <= 60) into += d;
    }
    return { len, intoPct: len ? Math.round((into / len) * 100) : 0 };
  }

  // ---------- render ----------
  // Thermals: with little wind, air follows the terrain. After sunset and at night (and the first hour or so after
  // sunrise) cold air runs downhill and along hollows; once the sun is up and warming the slopes, air rises uphill.
  // Clouds and rain weaken it, and wind of a few m/s mixes it away. K in m/s; + = downhill, - = uphill.
  let thermal = { K: 0, k: 0, kind: "" };
  function updateThermal() {
    const t = (prefs.windMode !== "manual" && Forecast.selT) || Date.now();
    const alt = sunAlt(t, HOME[0], HOME[1]), rising = sunAlt(t + 30 * 60e3, HOME[0], HOME[1]) > alt;
    let K = alt < 0 ? 0.9 : alt < 8 ? (rising ? 0.4 : 0.7) : alt < 15 ? 0 : -0.6;
    const wx = wxHour(), kind = wx ? wxKind(wx) : "partly";
    K *= { clear: 1, partly: 0.85, cloud: 0.6, fog: 0.7 }[kind] || 0.35;   // rain, snow, showers: weak
    K *= clamp(1 - (prefs.wind.speed - 1) / 5, 0, 1);                       // wind mixes it away
    const k = K / Math.max(prefs.wind.speed, 0.8);
    thermal = { K, k, kind: Math.abs(K) < 0.15 ? "" : K > 0 ? "down" : "up" };
    if (window.TerrainWind) window.TerrainWind.setThermal(Math.abs(K) < 0.15 ? 0 : k);
    const el = $("#thermalNote");
    if (el) el.textContent = thermal.kind === "down" ? "Thermals now: cold air is running downhill and along the hollows. Scent follows it down."
      : thermal.kind === "up" ? "Thermals now: the sun warms the slopes and the air rises uphill. Scent drifts up."
      : "Thermals now: hardly any (too windy, cloudy or the air is turning).";
  }

  function renderAll() {
    updateThermal();
    if (!map.getSource("sectors")) { renderLists(); renderWind(); return; }
    syncMarkers();
    renderStandGeometry();
    // routes
    const feats = [];
    for (const r of plans("routes")) {
      const pts = pairs(r.pts);
      for (let i = 1; i < pts.length; i++) feats.push({ type: "Feature", properties: { color: segColor(pts[i - 1], pts[i]), id: r.id }, geometry: { type: "LineString", coordinates: [pts[i - 1], pts[i]] } });
      if (FAMILY && pts.length >= 2) feats.push({ type: "Feature", properties: { label: tr(`${r.name || "Stalk route"} · ${whoName(r.by)}`) }, geometry: { type: "LineString", coordinates: pts } });
    }
    map.getSource("routes").setData(FC(feats));
    renderTracks();
    renderLayout();
    // sightings
    const filter = $("#logFilter").value;
    map.getSource("sightings").setData(FC(plans("sightings").filter((x) => !filter || x.species === filter).map((x) => ({
      type: "Feature", properties: { id: x.id, color: (speciesById[x.species] || speciesById.other).color, heard: x.kind === "heard",
        label: tr(`${(speciesById[x.species] || speciesById.other).name}${x.count > 1 ? " ×" + x.count : ""}${x.kind === "heard" ? " · Heard" : ""}`) },
      geometry: { type: "Point", coordinates: [x.lon, x.lat] },
    }))));
    // boundary
    const b = Store.data.boundary ? pairs(Store.data.boundary) : null;
    if (b && b.length >= 3) {
      const ring = [...b, b[0]];
      map.getSource("boundary").setData(FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } }]));
      map.getSource("mask").setData(FC([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [maskOuter(), clockwise(ring)] } }]));
    } else {
      map.getSource("boundary").setData(FC()); map.getSource("mask").setData(FC());
    }
    renderLists();
    renderWind();
  }

  function renderLists() {
    renderWho();
    const sl = $("#standList");
    const stands = plans("stands").sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));
    sl.innerHTML = stands.length ? stands.map((s) => {
      const st = standStatus(s);
      return `<li data-id="${esc(s.id)}"><span class="dot" style="background:${STATUS_COLORS[st.cls]}"></span>
        <span class="it-main"><div class="it-name">${esc(s.name || "Unnamed stand")}</div>
        <div class="it-sub">${esc(STAND_TYPES[s.type] || "")} · faces ${Geo.compassName(s.facing)} · ${s.range} m${whoTag(s)}</div></span>
        <span class="pill ${st.cls}">${st.text}</span></li>`;
    }).join("") : `<li class="empty">No stands yet. Add one with +.</li>`;

    const rl = $("#routeList");
    const routes = plans("routes");
    rl.innerHTML = routes.length ? routes.map((r) => {
      const st = routeStats(pairs(r.pts));
      return `<li data-id="${esc(r.id)}"><span class="it-main"><div class="it-name">${esc(r.name || "Stalk route")}</div>
        <div class="it-sub">${Math.round(st.len)} m · ${st.intoPct}% into the wind now${whoTag(r)}</div></span>
        <button class="btn small ghost" data-del-route="${esc(r.id)}" type="button">Delete</button></li>`;
    }).join("") : `<li class="empty">No stalk routes yet.</li>`;

    const filter = $("#logFilter").value;
    const logs = plans("sightings").filter((x) => !filter || x.species === filter).sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    $("#logList").innerHTML = logs.length ? logs.map((x) => {
      const sp = speciesById[x.species] || speciesById.other;
      const when = x.when ? new Date(x.when).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "";
      return `<li data-id="${esc(x.id)}"><span class="dot" style="background:${sp.color}"></span>
        <span class="it-main"><div class="it-name">${esc(sp.name)}${x.count > 1 ? " ×" + x.count : ""} · ${esc(KINDS[x.kind] || "Seen")}</div>
        <div class="it-sub">${esc(when)}${x.wind ? " · wind " + esc(x.wind) : ""}${whoTag(x)}${x.notes ? " · " + esc(x.notes) : ""}</div></span></li>`;
    }).join("") : `<li class="empty">${filter ? "No sightings of this species yet." : "No sightings yet. Log what you see, where and in which wind, and patterns show up over a season."}</li>`;

    const b = Store.data.boundary ? pairs(Store.data.boundary) : null;
    if (b && b.length >= 3) {
      $("#boundaryInfo").textContent = `Hunting boundary: ${Geo.areaHa(b).toFixed(1)} ha, ${b.length} points.`;
      $("#clearBoundary").hidden = false; $("#editBoundary").hidden = false; $("#drawBoundary").textContent = "Draw new";
    } else {
      $("#boundaryInfo").textContent = "No hunting boundary drawn yet. Use the boundary tool to trace it on the map.";
      $("#clearBoundary").hidden = true; $("#editBoundary").hidden = true; $("#drawBoundary").textContent = "Draw boundary";
    }
  }

  // ---------- wind ----------
  function buildDial() {
    const svg = $("#dial");
    let h = `<circle class="ring" r="100"/>`;
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5 * Math.PI / 180, major = i % 4 === 0, r1 = major ? 84 : 90;
      h += `<line class="tick${major ? " major" : ""}" x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * 98}" y2="${-Math.cos(a) * 98}"/>`;
    }
    ["N", "E", "S", "W"].forEach((t, i) => { const a = i * Math.PI / 2; h += `<text x="${Math.sin(a) * 70}" y="${-Math.cos(a) * 70}">${t}</text>`; });
    h += `<g id="dialG"><path class="scent" d="M0 0 L-34 92 A98 98 0 0 0 34 92 Z"/><path class="arrow" d="M-11 -96 L11 -96 L5 -30 L16 -30 L0 6 L-16 -30 L-5 -30 Z"/></g>`;
    svg.innerHTML = h;
    const setFromPointer = (e) => {
      const r = svg.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      setWind((Math.round((Math.atan2(x, -y) * 180 / Math.PI + 360) % 360 / 5) * 5) % 360);
    };
    let dragging = false;
    svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); setFromPointer(e); });
    svg.addEventListener("pointermove", (e) => { if (dragging) setFromPointer(e); });
    svg.addEventListener("pointerup", () => { dragging = false; });
    svg.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 22.5 : 5;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { setWind((prefs.wind.from + step) % 360); e.preventDefault(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setWind((prefs.wind.from - step + 360) % 360); e.preventDefault(); }
    });
  }
  function setWind(from) { prefs.wind.from = Math.round(from) % 360; prefs.windMode = "manual"; savePrefs(); renderAll(); renderForecast(); }

  // ---------- SMHI wind forecast (snow1g point forecast, free, no key) ----------
  // On claude.ai the page may not fetch outside data; the map then falls back to the last saved forecast or the dial.
  const SMHI_URL = "https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/"
    + HOME[0].toFixed(4) + "/lat/" + HOME[1].toFixed(4) + "/data.json";
  const Forecast = { hours: [], fetched: 0, selT: null, failed: false };
  async function loadForecast() {
    try {
      const r = await fetch(SMHI_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      Forecast.hours = d.timeSeries
        .filter((t) => t.data && typeof t.data.wind_speed === "number" && typeof t.data.wind_from_direction === "number")
        .map((t) => ({ t: Date.parse(t.time), from: Math.round(t.data.wind_from_direction) % 360, speed: t.data.wind_speed, gust: t.data.wind_speed_of_gust,
          sym: t.data.symbol_code, temp: t.data.air_temperature, vis: t.data.visibility_in_air,
          rain: t.data.precipitation_amount_mean_deterministic, pop: t.data.probability_of_precipitation }));
      Forecast.fetched = Date.now(); Forecast.failed = false;
      try { localStorage.setItem("alnaryd-forecast", JSON.stringify({ hours: Forecast.hours, fetched: Forecast.fetched })); } catch { /* ignore */ }
    } catch {
      Forecast.failed = true;
      try {
        const c = JSON.parse(localStorage.getItem("alnaryd-forecast") || "null");
        if (c && c.hours) { Forecast.hours = c.hours; Forecast.fetched = c.fetched; }
      } catch { /* ignore */ }
    }
    const now = Date.now();
    Forecast.hours = Forecast.hours.filter((h) => h.t > now - 3600e3).slice(0, 72);
    if (!Forecast.selT || Forecast.selT < now - 3600e3) Forecast.selT = Forecast.hours.length ? Forecast.hours[0].t : null;
    if (prefs.windMode !== "manual" && Forecast.selT) applyForecastHour(Forecast.selT, false);
    renderForecast();
  }
  // Tyst mark: the dry or the after-rain version, from the rain SMHI measured the last day at Ronneby-Bredåkra
  // (14 km away) and the forecast for this hour. Frost makes leaves crunch, so it counts as dry.
  const Ground = {
    rain24: null, rain6: null, fetched: 0,
    async load() {
      if (Date.now() - this.fetched < 30 * 60e3) return;
      try {
        const r = await fetch("https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/7/station/65160/period/latest-day/data.json", { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        const now = Date.now(), v = ((await r.json()).value || []).map((x) => ({ t: x.date, mm: parseFloat(x.value) || 0 }));
        this.rain24 = v.filter((x) => x.t > now - 24 * 3600e3).reduce((a, x) => a + x.mm, 0);
        this.rain6 = v.filter((x) => x.t > now - 6 * 3600e3).reduce((a, x) => a + x.mm, 0);
        this.fetched = now;
      } catch { /* no rain data: decide from the forecast only */ }
      applyLayers();
    },
    wet() {
      if (prefs.quietMode === "dry") return { wet: false, why: "Showing dry ground (chosen)" };
      if (prefs.quietMode === "wet") return { wet: true, why: "Showing wet ground (chosen)" };
      const now = Date.now(), h = Forecast.hours.find((x) => x.t <= now && x.t > now - 3600e3) || Forecast.hours[0];
      const mm = this.rain24 === null ? "" : ` · ${this.rain24.toFixed(1)} mm in 24 h`;
      if (h && typeof h.temp === "number" && h.temp <= -1) return { wet: false, why: "Frost: frozen leaves crunch" + mm };
      if (h && ["rain", "showers", "sleet", "thunder"].includes(wxKind(h)) && h.rain >= 0.1) return { wet: true, why: "Raining: wet ground" + mm };
      if (this.rain6 >= 0.5 || this.rain24 >= 2) return { wet: true, why: "Wet after rain" + mm };
      return { wet: false, why: (this.rain24 === null ? "Dry ground (no rain data)" : "Dry ground") + mm };
    },
    render() {
      const el = $("#quietNow"); if (!el) return;
      el.textContent = this.wet().why;
      $$("[data-quiet]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.quiet === prefs.quietMode)));
    },
  };
  function applyForecastHour(t, scroll = true) {
    const h = Forecast.hours.find((x) => x.t === t);
    if (!h) return;
    Forecast.selT = t;
    prefs.wind.from = h.from; prefs.wind.speed = Math.round(h.speed * 2) / 2; prefs.windMode = "forecast";
    savePrefs(); renderAll(); renderForecast(scroll);
  }
  const fcDay = (t) => new Date(t).toLocaleDateString("en-GB", { weekday: "short" });
  const fcClock = (t) => new Date(t).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  function fcLabel(t) {
    const d = new Date(t), today = new Date(), tomorrow = new Date(Date.now() + 864e5);
    const day = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === tomorrow.toDateString() ? "Tomorrow" : fcDay(t);
    return `${day} ${fcClock(t)}`;
  }
  // SMHI symbol codes 1-27 → what we draw. Fog also when visibility drops under 1 km.
  const WX_NAMES = { 1: "Clear", 2: "Nearly clear", 3: "Variable cloud", 4: "Half clear", 5: "Cloudy", 6: "Overcast", 7: "Fog",
    8: "Light rain showers", 9: "Rain showers", 10: "Heavy rain showers", 11: "Thunderstorm", 12: "Light sleet showers", 13: "Sleet showers",
    14: "Heavy sleet showers", 15: "Light snow showers", 16: "Snow showers", 17: "Heavy snow showers", 18: "Light rain", 19: "Rain", 20: "Heavy rain",
    21: "Thunder", 22: "Light sleet", 23: "Sleet", 24: "Heavy sleet", 25: "Light snow", 26: "Snow", 27: "Heavy snow" };
  function wxKind(h) {
    const c = h.sym;
    if (!c) return null;
    if (c === 11 || c === 21) return "thunder";
    if (c >= 8 && c <= 10) return "showers";
    if (c >= 18 && c <= 20) return "rain";
    if ((c >= 12 && c <= 14) || (c >= 22 && c <= 24)) return "sleet";
    if ((c >= 15 && c <= 17) || c >= 25) return "snow";
    if (c === 7 || (typeof h.vis === "number" && h.vis < 1)) return "fog";
    return c <= 2 ? "clear" : c <= 4 ? "partly" : "cloud";
  }
  function wxName(h) { return wxKind(h) === "fog" ? "Fog" : WX_NAMES[h.sym] || ""; }
  // Sun height above the horizon in degrees (good to a fraction of a degree, plenty for day/night and sunrise).
  function sunAlt(t, lon, lat) {
    const n = t / 864e5 - 10957.5, rad = Math.PI / 180;
    const g = (357.528 + 0.9856003 * n) * rad, L = 280.46 + 0.9856474 * n;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * n) * rad;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    const H = ((18.697374558 + 24.06570982441908 * n) * 15 + lon) * rad - ra;
    return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(H)) / rad;
  }
  function sunTimes(t) {
    const d = new Date(t); d.setHours(0, 0, 0, 0);
    // sunrise/sunset = sun's upper edge on the horizon (-0.833° with refraction); find the 10-minute step
    // where it crosses, then narrow it down to the second
    const h = (t) => sunAlt(t, HOME[0], HOME[1]) + 0.833;
    const exact = (a, b) => { for (let i = 0; i < 20; i++) { const m = (a + b) / 2; if ((h(a) < 0) === (h(m) < 0)) a = m; else b = m; } return (a + b) / 2; };
    let up = null, down = null, t0 = d.getTime();
    for (let m = 10; m <= 1440; m += 10) {
      const t1 = d.getTime() + m * 6e4;
      if (h(t0) < 0 && h(t1) >= 0) up = exact(t0, t1);
      if (h(t0) >= 0 && h(t1) < 0) down = exact(t0, t1);
      t0 = t1;
    }
    const min = (t) => (t === null ? null : Math.round(t / 6e4) * 6e4);   // nearest minute, like almanacs show it
    return { up: min(up), down: min(down) };
  }
  const SUN = '<circle cx="16" cy="16" r="6" fill="#f5b82e"/><g stroke="#f5b82e" stroke-width="2" stroke-linecap="round"><path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.8 6.8l2.1 2.1M23.1 23.1l2.1 2.1M6.8 25.2l2.1-2.1M23.1 8.9l2.1-2.1"/></g>';
  const MOON = '<path d="M20 5a11 11 0 1 0 7 19A9 9 0 0 1 20 5z" fill="#e6dfb8"/>';
  const CLOUD = (dy = 0, c = "#c9d0c3") => `<path transform="translate(0 ${dy})" d="M9 26h15a5.5 5.5 0 0 0 .4-11 7.5 7.5 0 0 0-14.3 2A4.6 4.6 0 0 0 9 26z" fill="${c}"/>`;
  const DROPS = '<g stroke="#4dabf7" stroke-width="2.2" stroke-linecap="round"><path d="M11 25l-1.5 4M17 25l-1.5 4M23 25l-1.5 4"/></g>';
  const FLAKES = '<g fill="#fff"><circle cx="10" cy="27" r="1.7"/><circle cx="16.5" cy="29" r="1.7"/><circle cx="23" cy="27" r="1.7"/></g>';
  function wxSvg(h) {
    const k = wxKind(h);
    if (!k) return "";
    const night = sunAlt(h.t, HOME[0], HOME[1]) < -3;
    const sky = night ? MOON : SUN, small = `<g transform="translate(-3 -4) scale(.68)">${sky}</g>`;
    const body = {
      clear: sky,
      partly: small + CLOUD(2),
      cloud: CLOUD(-1, "#b7bfb0"),
      fog: '<g stroke="#c9d0c3" stroke-width="2.4" stroke-linecap="round"><path d="M5 11h22M8 16h19M5 21h22M9 26h15"/></g>',
      showers: small + CLOUD(-3) + DROPS,
      rain: CLOUD(-4, "#a9b2a2") + DROPS,
      sleet: CLOUD(-4, "#a9b2a2") + '<g stroke="#4dabf7" stroke-width="2.2" stroke-linecap="round"><path d="M11 25l-1.5 4M21 25l-1.5 4"/></g><circle cx="16" cy="28" r="1.7" fill="#fff"/>',
      snow: CLOUD(-4, "#b7bfb0") + FLAKES,
      thunder: CLOUD(-4, "#8f988a") + '<path d="M17 21l-4 6h3.5l-2 5 6-7.5h-3.6l2-3.5z" fill="#fcc419"/>',
    }[k];
    return `<svg class="wx" viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
  }
  // The forecast hour the map is planned for (or the coming hour when the wind is set by hand).
  function wxHour() {
    if (!Forecast.hours.length) return null;
    return (prefs.windMode !== "manual" && Forecast.hours.find((x) => x.t === Forecast.selT)) || Forecast.hours[0];
  }

  function renderForecast(scroll = false) {
    const has = Forecast.hours.length > 0, manual = prefs.windMode === "manual";
    $("#fcStrip").hidden = !has;
    $("#fcUse").hidden = !(has && manual);
    if (!has) {
      $("#fcSource").textContent = "Set by hand";
      $("#fcNote").textContent = "The SMHI forecast can't be loaded here. Set the wind with the dial.";
      return;
    }
    const age = Math.round((Date.now() - Forecast.fetched) / 60000);
    $("#fcSource").textContent = manual ? "Set by hand" : `SMHI forecast · ${fcLabel(Forecast.selT)}`;
    $("#fcNote").textContent = Forecast.failed ? `Offline: showing the forecast from ${age < 60 ? age + " min" : Math.round(age / 60) + " h"} ago. ` : "";
    let lastDay = "";
    $("#fcStrip").innerHTML = Forecast.hours.map((h) => {
      const day = fcDay(h.t), newDay = day !== lastDay; lastDay = day;
      const sel = !manual && h.t === Forecast.selT;
      const calm = h.speed < 1;
      return `<button type="button" class="fc-h${sel ? " sel" : ""}${newDay ? " day" : ""}" data-t="${h.t}" role="option" aria-selected="${sel}"
        aria-label="${fcLabel(h.t)}, wind from ${Geo.compassName(h.from)} ${h.speed.toFixed(1)} metres per second">
        <span class="fc-day">${newDay ? day : ""}</span><span class="fc-time">${fcClock(h.t).slice(0, 2)}</span>
        ${wxSvg(h) || "<span></span>"}<span class="fc-temp">${typeof h.temp === "number" ? Math.round(h.temp) + "°" : ""}</span>
        <svg class="fc-arrow" viewBox="-10 -10 20 20" style="transform:rotate(${h.from}deg)"${calm ? ' data-calm=""' : ""}><path d="M0 7 L-5 -3 L0 -1 L5 -3 Z"/></svg>
        <span class="fc-ms">${Math.round(h.speed)}</span><span class="fc-gust">${h.gust ? Math.round(h.gust) : ""}</span></button>`;
    }).join("");
    if (scroll || !renderForecast.done) {
      const el = $("#fcStrip .fc-h.sel"), strip = $("#fcStrip");
      // scroll only the strip itself; scrollIntoView would also shift the whole page on phones
      if (el) strip.scrollLeft = el.offsetLeft - strip.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2;
      renderForecast.done = true;
    }
  }

  function renderWind() {
    renderBest();
    const w = prefs.wind;
    $("#dialG").setAttribute("transform", `rotate(${w.from})`);
    $("#dial").setAttribute("aria-valuenow", String(w.from));
    $("#windBig").textContent = w.speed < 1 ? "Calm" : Geo.compassName(w.from);
    const fh = prefs.windMode !== "manual" && Forecast.hours.find((x) => x.t === Forecast.selT);
    $("#windSpeedNow").textContent = `${w.speed} m/s` + (fh && fh.gust ? ` (${Math.round(fh.gust)})` : "");   // gusts in brackets, like the compass
    const wx = wxHour();
    $("#wxIcon").innerHTML = wx ? wxSvg(wx) : "";
    $("#wxTemp").textContent = wx && typeof wx.temp === "number" ? `${Math.round(wx.temp)}°` : "";
    $("#wxLine").textContent = wx ? wxName(wx) : "";
    const sun = sunTimes(wx ? wx.t : Date.now());
    $("#sunLine").textContent = sun.up && sun.down ? `Sunrise ${fcClock(sun.up)} · Sunset ${fcClock(sun.down)}` : "";
    $("#windSpeedOut").textContent = `${w.speed} m/s`;
    renderFlow();
    $("#windSpeed").value = w.speed;
    renderHud();
  }

  // ---------- drawing tools ----------
  let tool = null;          // "stand" | "sighting" | "route" | "measure" | "boundary" | "editBoundary" | "layout" | "editTrail" | "newTrail" | "newPlace"
  let pts = [];
  // shape editing (boundary or a trail): every point can be dragged; dragging a small mid-segment dot inserts a point
  let edit = null;          // { kind: "boundary" | "trail", id, closed, pts, sel, history }
  let dragIdx = null;
  const LAYOUT_TOOLS = ["layout", "editTrail", "newTrail", "newPlace"];
  function setTool(t, { draw = false, trailId = null } = {}) {
    if (t === "boundary" && !draw && Store.data.boundary && pairs(Store.data.boundary).length >= 3) t = "editBoundary";
    // starting something new puts away a stand or sighting you were filling in (and its preview on the map)
    if (t) { if (draftStand) closeStandForm(); if (draftSighting) closeSightForm(); }
    tool = t; pts = [];
    edit = null;
    if (t === "editBoundary") edit = { kind: "boundary", closed: true, pts: pairs(Store.data.boundary), sel: -1, history: [] };
    if (t === "editTrail") {
      const tr = Store.data.trails.find((x) => x.id === trailId);
      if (!tr) tool = t = "layout";
      else edit = { kind: "trail", id: tr.id, closed: false, pts: pairs(tr.pts), sel: -1, history: [] };
    }
    $("#addBtn").setAttribute("aria-pressed", String(!!t));
    map.getCanvas().style.cursor = t && !["editBoundary", "editTrail", "layout"].includes(t) ? "crosshair" : "";
    if (map.getLayer("boundary-line")) map.setLayoutProperty("boundary-line", "visibility", t === "editBoundary" || !prefs.ov.boundary ? "none" : "visible");
    if (LAYOUT_TOOLS.includes(t) && !prefs.ov.trails) { prefs.ov.trails = true; $("#ov-trails").checked = true; applyLayers(); }
    $("#editLayout").textContent = LAYOUT_TOOLS.includes(t) ? "Stop editing" : "Edit trails & places";
    const hint = $("#toolbar-hint");
    hint.hidden = !t;
    updateHint();
    updateDraft();
    renderEdit();
    renderLayout();
    if (t && isPhone()) setSheet("peek");
  }
  function renderEdit() {
    if (!map.getSource("edit")) return;
    if (!edit) { map.getSource("edit").setData(FC()); return; }
    const p = edit.pts, f = [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: edit.closed ? [...p, p[0]] : p } }];
    p.forEach((q, i) => {
      if (!edit.closed && i === p.length - 1) return;
      const n = p[(i + 1) % p.length];
      f.push({ type: "Feature", properties: { role: "mid", i }, geometry: { type: "Point", coordinates: [(q[0] + n[0]) / 2, (q[1] + n[1]) / 2] } });
    });
    p.forEach((q, i) => f.push({ type: "Feature", properties: { role: "vtx", i, sel: i === edit.sel }, geometry: { type: "Point", coordinates: q } }));
    map.getSource("edit").setData(FC(f));
  }
  function handleAt(point) {
    const r = isPhone() ? 16 : 9;
    const hits = map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], { layers: ["edit-vtx", "edit-mid"] });
    if (!hits.length) return null;
    const best = (role) => hits.filter((h) => h.properties.role === role).sort((a, b) => {
      const pa = map.project(a.geometry.coordinates), pb = map.project(b.geometry.coordinates);
      return Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y);
    })[0];
    return best("vtx") || best("mid");
  }
  function editDown(e) {
    if (!edit || (e.points && e.points.length > 1)) return;
    const h = handleAt(e.point);
    if (!h) return;
    e.preventDefault();
    edit.history.push(edit.pts.map((q) => q.slice()));
    if (h.properties.role === "mid") { edit.pts.splice(h.properties.i + 1, 0, [e.lngLat.lng, e.lngLat.lat]); dragIdx = h.properties.i + 1; }
    else dragIdx = h.properties.i;
    edit.sel = dragIdx;
    renderEdit(); updateHint();
  }
  function editMove(e) {
    if (dragIdx === null) return;
    edit.pts[dragIdx] = [e.lngLat.lng, e.lngLat.lat];
    renderEdit(); updateHint();
  }
  function editUp() { if (dragIdx !== null) { dragIdx = null; updateHint(); } }
  map.on("mousedown", editDown); map.on("touchstart", editDown);
  map.on("mousemove", editMove); map.on("touchmove", editMove);
  map.on("mouseup", editUp); map.on("touchend", editUp);
  map.on("mousemove", (e) => {
    if (edit && dragIdx === null) map.getCanvas().style.cursor = handleAt(e.point) ? "grab" : "";
    else if (tool === "layout") map.getCanvas().style.cursor = trailAt(e.point) ? "pointer" : "";
  });

  function updateHint() {
    if (!tool) return;
    $("#hintAddTrail").hidden = $("#hintAddPlace").hidden = tool !== "layout";
    if (tool === "layout") {
      $("#hintUndo").hidden = $("#hintDelete").hidden = $("#hintCancel").hidden = true;
      $("#hintDone").hidden = false; $("#hintDone").textContent = "Done";
      $("#hintText").textContent = "Drag a name to move it, tap it to rename. Tap a trail to reshape it.";
      return;
    }
    $("#hintCancel").hidden = false;
    if (edit) {
      const min = edit.closed ? 3 : 2;
      $("#hintUndo").hidden = !edit.history.length;
      $("#hintDelete").hidden = edit.sel < 0 || edit.pts.length <= min;
      $("#hintDone").hidden = false; $("#hintDone").textContent = "Save";
      let len = 0; for (let i = 1; i < edit.pts.length; i++) len += Geo.distance(edit.pts[i - 1], edit.pts[i]);
      $("#hintText").textContent = "Drag points to adjust. Zoom in to drag the small dots and add points. " +
        (edit.closed ? `${Geo.areaHa(edit.pts).toFixed(1)} ha` : `${Math.round(len)} m`);
      return;
    }
    $("#hintDelete").hidden = true;
    const multi = tool === "route" || tool === "measure" || tool === "boundary" || tool === "newTrail";
    $("#hintUndo").hidden = !multi || !pts.length;
    $("#hintDone").hidden = !multi || pts.length < (tool === "boundary" ? 3 : 2);
    $("#hintDone").textContent = tool === "measure" ? "Clear" : "Finish";
    let text = { daySpot: "Tap the map where they will sit", routeVia: "Tap the road, track or spot they will walk via", routeFrom: "Tap where they start walking",
      stand: "Tap the map where the stand is", sighting: "Tap where you saw it", animal: "Tap the map where the animal is", sound: "Tap roughly where the sound came from", route: "Tap to add points along your stalk", measure: "Tap points to measure", boundary: "Tap the corners of your hunting area",
      newTrail: "Tap points along the new trail", newPlace: "Tap where the name should go" }[tool];
    if (pts.length >= 2 && tool !== "boundary") {
      let d = 0; for (let i = 1; i < pts.length; i++) d += Geo.distance(pts[i - 1], pts[i]);
      text = `${d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(2) + " km"}` + (tool === "measure" ? ` · bearing ${Math.round(Geo.bearing(pts[pts.length - 2], pts[pts.length - 1]))}°` : "");
    }
    if (tool === "boundary" && pts.length >= 3) text = `${Geo.areaHa(pts).toFixed(1)} ha · ${pts.length} corners`;
    $("#hintText").textContent = text;
  }
  function updateDraft() {
    if (!map.getSource("draft")) return;
    const f = pts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (pts.length >= 2) {
      if (tool === "boundary" && pts.length >= 3) f.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
      else f.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } });
    }
    map.getSource("draft").setData(FC(f));
  }
  async function finishTool() {
    if (tool === "route" && pts.length >= 2) {
      const n = Store.data.routes.length + 1;
      await Store.put("routes", { id: newId("rt"), name: `Stalk route ${n}`, pts: flat(pts), created: new Date().toISOString() });
      toast("Route saved. Its colours follow the wind you set.");
      showTab("stands", false);
    } else if (tool === "boundary" && pts.length >= 3) {
      await Store.setBoundary(flat(pts));
      toast(`Boundary saved: ${Geo.areaHa(pts).toFixed(1)} ha`);
    } else if (tool === "editBoundary" && edit && edit.pts.length >= 3) {
      await Store.setBoundary(flat(edit.pts));
      toast(`Boundary saved: ${Geo.areaHa(edit.pts).toFixed(1)} ha`);
    } else if (tool === "editTrail" && edit && edit.pts.length >= 2) {
      const tr = Store.data.trails.find((x) => x.id === edit.id) || { id: edit.id, name: "" };
      const name = featDraft && featDraft.id === edit.id ? $("#ff-name").value.trim() : tr.name;
      const shape = flat(edit.pts);
      closeFeatForm(); setTool("layout");
      await Store.put("trails", { ...tr, name, pts: shape }); toast("Trail saved"); return;
    } else if (tool === "newTrail" && pts.length >= 2) {
      const id = newId("tr"), shape = flat(pts);
      setTool("layout");
      await Store.put("trails", { id, name: "", pts: shape });
      toast("Trail added. Give it a name if you like."); openFeatForm("trail", id); return;
    } else if (tool === "layout") {
      closeFeatForm();
    }
    setTool(null);
  }

  map.on("click", (e) => {
    if (tool === "daySpot") { const email = Day.spotFor; setTool(null); if (email) Day.setSpot(email, [e.lngLat.lng, e.lngLat.lat]); return; }
    if (tool === "routeVia") { setTool(null); RoutePick.via([e.lngLat.lng, e.lngLat.lat]); return; }
    if (tool === "routeFrom") { setTool(null); RoutePick.fromPoint([e.lngLat.lng, e.lngLat.lat]); return; }
    if (!tool && RoutePick.email && map.getLayer("routeopts")) {   // tap a suggested way on the map to choose it
      const f = map.queryRenderedFeatures([[e.point.x - 10, e.point.y - 10], [e.point.x + 10, e.point.y + 10]], { layers: ["routeopts"] })[0];
      if (f) { RoutePick.choose(+f.properties.i); return; }
    }
    if (tool === "layout") {
      const id = trailAt(e.point);
      if (id) { setTool("editTrail", { trailId: id }); openFeatForm("trail", id); }
      return;
    }
    if (tool === "newPlace") {
      const id = newId("pl");
      setTool("layout");
      Store.put("places", { id, name: "New place", kind: "other", lon: e.lngLat.lng, lat: e.lngLat.lat }).then(() => openFeatForm("place", id));
      return;
    }
    if (tool === "editBoundary" || tool === "editTrail") {
      const h = handleAt(e.point);
      edit.sel = h && h.properties.role === "vtx" ? h.properties.i : -1;
      renderEdit(); updateHint(); return;
    }
    if (tool === "stand") { newStandAt(e.lngLat); setTool(null); return; }
    if (tool === "sighting") { newSightingAt(e.lngLat); setTool(null); return; }
    if (tool === "animal" || tool === "sound") { const t = tool; setTool(null); Hunt.send(t, [e.lngLat.lng, e.lngLat.lat]); return; }
    if (tool) { pts.push([e.lngLat.lng, e.lngLat.lat]); updateHint(); updateDraft(); return; }
    if (isPhone() && $("#app").dataset.sheet === "open") { setSheet("peek"); return; }
    const hit = map.queryRenderedFeatures(e.point, { layers: ["sightings"] })[0];
    if (hit) sightingPopup(hit.properties.id, e.lngLat);
  });

  // ---------- trails & place names (editable) ----------
  let featDraft = null;     // { type: "place" | "trail", id } open in the form
  const placeMarkers = new Map();
  function renderLayout() {
    if (!map.getSource("trails")) return;
    const editingId = edit && edit.kind === "trail" ? edit.id : null;
    map.getSource("trails").setData(FC(Store.data.trails.filter((t) => t.id !== editingId).map((t) => ({
      type: "Feature", properties: { id: t.id, name: t.name || "" }, geometry: { type: "LineString", coordinates: pairs(t.pts) },
    }))));
    const layoutOn = LAYOUT_TOOLS.includes(tool);
    map.getSource("places").setData(FC(layoutOn ? [] : Store.data.places.map((p) => ({
      type: "Feature", properties: { id: p.id, name: p.name, kind: p.kind }, geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    }))));
    syncPlaceMarkers(layoutOn);
  }
  // In edit mode every place name becomes a draggable marker
  function syncPlaceMarkers(on) {
    const keep = new Set(on ? Store.data.places.map((p) => p.id) : []);
    for (const [id, m] of placeMarkers) if (!keep.has(id)) { m.remove(); placeMarkers.delete(id); }
    if (!on) return;
    for (const p of Store.data.places) {
      let m = placeMarkers.get(p.id);
      if (!m) {
        const el = document.createElement("div");
        el.className = "place-marker"; el.innerHTML = "<span></span><i></i>";
        m = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map);
        m.on("dragstart", () => { m.dragging = true; });
        m.on("dragend", () => {
          const ll = m.getLngLat(), cur = Store.data.places.find((x) => x.id === p.id);
          setTimeout(() => { m.dragging = false; }, 50);
          if (cur) Store.put("places", { ...cur, lon: ll.lng, lat: ll.lat });
        });
        el.addEventListener("click", (e) => { e.stopPropagation(); if (!m.dragging) openFeatForm("place", p.id); });
        placeMarkers.set(p.id, m);
      }
      if (!m.dragging) m.setLngLat([p.lon, p.lat]);
      const el = m.getElement();
      el.querySelector("span").textContent = p.name || "Unnamed";
      el.classList.toggle("sel", !!featDraft && featDraft.id === p.id);
    }
  }
  function trailAt(point) {
    const r = isPhone() ? 14 : 8;
    const f = map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]], { layers: ["trails", "trails-case"] })[0];
    return f ? f.properties.id : null;
  }
  function openFeatForm(type, id) {
    const item = (type === "place" ? Store.data.places : Store.data.trails).find((x) => x.id === id);
    if (!item) return;
    featDraft = { type, id };
    $("#editSect").open = true;
    showTab("map", type === "place");
    $("#featForm").hidden = false;
    $("#featTitle").textContent = type === "place" ? "Place name" : "Trail";
    $("#ff-name").value = item.name || "";
    $("#ff-name").placeholder = type === "place" ? "e.g. Ingång Syd" : "e.g. Mittenvägen";
    $("#ff-kindRow").hidden = type !== "place";
    if (type === "place") $("#ff-kind").value = item.kind || "other";
    $("#ff-help").textContent = type === "place" ? "Drag the name on the map to move it." : "Drag the points on the map to reshape it, then Save.";
    const panes = $(".panes"), form = $("#featForm");
    panes.scrollTop = Math.max(0, form.offsetTop - panes.offsetTop - 12);
    renderLayout();
  }
  function closeFeatForm() { featDraft = null; $("#featForm").hidden = true; renderLayout(); }

  // ---------- sightings ----------
  let draftSighting = null;
  function newSightingAt(ll) {
    const now = new Date(); now.setSeconds(0, 0);
    draftSighting = { id: newId("sg"), species: $("#lf-species").value || "moose", count: 1, kind: "seen", when: now.toISOString(), notes: "", lon: ll.lng, lat: ll.lat, isNew: true };
    openSightForm();
  }
  function localInput(iso) { const d = iso ? new Date(iso) : new Date(); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); }
  function openSightForm() {
    const s = draftSighting;
    showTab("log", true);
    $("#sightForm").hidden = false;
    $("#lf-species").value = s.species; $("#lf-count").value = s.count; $("#lf-kind").value = s.kind;
    $("#lf-when").value = localInput(s.when); $("#lf-notes").value = s.notes || "";
    $("#lf-delete").hidden = s.isNew;
    $("#lf-wind").textContent = s.isNew ? `Saved with the wind you have set: ${dir8(prefs.wind.from)} ${prefs.wind.speed} m/s.` : (s.wind ? `Wind at the time: ${s.wind}` : "");
    updateDraftPin();
    showForm("#sightForm", [s.lon, s.lat]);
  }
  let draftPin = null;
  function updateDraftPin() {
    if (draftPin) { draftPin.remove(); draftPin = null; }
    if (!draftSighting) return;
    const el = document.createElement("div"); el.className = "me-dot"; el.style.background = (speciesById[$("#lf-species").value] || speciesById.other).color;
    draftPin = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([draftSighting.lon, draftSighting.lat]).addTo(map);
    draftPin.on("dragend", () => { const ll = draftPin.getLngLat(); draftSighting.lon = ll.lng; draftSighting.lat = ll.lat; });
  }
  function closeSightForm() { draftSighting = null; $("#sightForm").hidden = true; updateDraftPin(); }
  function sightingPopup(id, ll) {
    const x = Store.data.sightings.find((s) => s.id === id); if (!x) return;
    const sp = speciesById[x.species] || speciesById.other;
    const when = x.when ? new Date(x.when).toLocaleString("sv-SE", { dateStyle: "medium", timeStyle: "short" }) : "";
    const html = `<div class="pop"><h3>${esc(sp.name)}${x.count > 1 ? " ×" + x.count : ""}</h3><dl>
      <dt>What</dt><dd>${esc(KINDS[x.kind] || "Seen")}</dd><dt>When</dt><dd>${esc(when)}</dd>${x.wind ? `<dt>Wind</dt><dd>${esc(x.wind)}</dd>` : ""}
      ${x.notes ? `<dt>Notes</dt><dd>${esc(x.notes)}</dd>` : ""}</dl>
      <div class="row gap" style="margin-top:8px"><button class="btn small" type="button" id="popEdit">Edit</button></div></div>`;
    const p = new maplibregl.Popup({ maxWidth: "280px" }).setLngLat([x.lon, x.lat]).setHTML(html).addTo(map);
    p.getElement().querySelector("#popEdit").addEventListener("click", () => { p.remove(); draftSighting = { ...x, isNew: false }; openSightForm(); });
  }

  // ---------- tap-to-inspect ----------
  let info = null;   // forest and wetness lookup grids, one per area
  const vectors = {};   // the map's own line data (OSM roads, tracks and paths), kept for the route planner
  async function loadInfoGrid() {
    const grids = await Promise.all(manifests.map(async (m) => {
      try {
        const img = new Image(); img.decoding = "async"; img.src = abs(m.info.url);
        await img.decode();
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
        return { ...m.info, px: g.getImageData(0, 0, img.width, img.height).data };
      } catch { return null; }
    }));
    info = grids.filter(Boolean);
    if (!info.length) info = null;
  }
  function lookupInfo(lon, lat) {
    if (!info) return null;
    const [E, N] = Geo.toSweref(lon, lat);
    for (const g of info) {
      const col = Math.floor((E - g.origin[0]) / g.cell), row = Math.floor((g.origin[1] - N) / g.cell);
      if (col < 0 || row < 0 || col >= g.width || row >= g.height) continue;
      const i = (row * g.width + col) * 4;
      return { code: g.codes[g.px[i] - 1], tree: g.px[i + 1] / 8, thicket: g.px[i + 2] / 2.5 };   // thicket: % cover of 0.5-5 m vegetation
    }
    return null;
  }
  const demCache = new Map();
  async function demTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!demCache.has(key)) {
      demCache.set(key, (async () => {
        let img = new Image(); img.src = abs(`terrain/${key}.webp`);
        try { await img.decode(); }
        catch { img = new Image(); img.crossOrigin = "anonymous"; img.src = LIVE_DEM.replace("{z}/{x}/{y}", key); await img.decode(); }
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
        return { w: img.width, data: g.getImageData(0, 0, img.width, img.height).data };
      })().catch(() => null));
    }
    return demCache.get(key);
  }
  async function elevationAt(lon, lat) {
    const z = 15, n = 2 ** z;
    const fx = (lon + 180) / 360 * n;
    const fy = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    const t = await demTile(z, Math.floor(fx), Math.floor(fy));
    if (!t) return null;
    const sample = (px, py) => {
      px = clamp(px, 0, t.w - 1); py = clamp(py, 0, t.w - 1);
      const i = (py * t.w + px) * 4; return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
    };
    const px = Math.floor((fx % 1) * t.w), py = Math.floor((fy % 1) * t.w);
    const pxm = 40075016.686 * Math.cos(lat * Math.PI / 180) / (n * t.w); // ground metres per pixel
    const dzdx = (sample(px + 2, py) - sample(px - 2, py)) / (4 * pxm), dzdy = (sample(px, py + 2) - sample(px, py - 2)) / (4 * pxm);
    return { z: sample(px, py), slope: Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI };
  }
  // ---------- line of sight for the stand being edited ----------
  // Sight loss per metre of sightline below the canopy: young thicket blocks fast, open pine and beech much slower.
  const MATURE_RATE = { 111: .009, 121: .009, 112: .025, 122: .025, 113: .018, 123: .018, 114: .015, 124: .015,
    115: .014, 125: .014, 116: .011, 126: .011, 117: .012, 127: .012 };
  function vegetation(lon, lat) {
    const inf = lookupInfo(lon, lat);
    if (!inf) return { veg: 0, rate: 0 };
    if ((inf.code === 118 || inf.code === 128) && inf.tree > 8) return { veg: 2.5, rate: .05 };  // felled since the tree data
    // dense undergrowth (laser: cover of 0.5-5 m vegetation) blocks the view at eye level, even under tall trees
    const under = (inf.thicket || 0) / 100;
    if (inf.tree < 1.5) return under > .2 ? { veg: 2, rate: .03 + under * .06 } : { veg: 0, rate: 0 };
    if (inf.tree < 8) return { veg: inf.tree, rate: .07 };
    return { veg: inf.tree, rate: (MATURE_RATE[inf.code] || .015) + under * .05 };
  }
  async function groundSampler(lon, lat, radius) {
    const z = 15, n = 2 ** z, rad = Math.PI / 180;
    const dLat = (radius + 60) / 111195, dLon = dLat / Math.cos(lat * rad);
    const tx = (lo) => (lo + 180) / 360 * n, ty = (la) => (1 - Math.asinh(Math.tan(la * rad)) / Math.PI) / 2 * n;
    const tiles = new Map();
    for (let x = Math.floor(tx(lon - dLon)); x <= Math.floor(tx(lon + dLon)); x++)
      for (let y = Math.floor(ty(lat + dLat)); y <= Math.floor(ty(lat - dLat)); y++) tiles.set(`${x}/${y}`, await demTile(z, x, y));
    return (lo, la) => {
      const fx = tx(lo), fy = ty(la), t = tiles.get(`${Math.floor(fx)}/${Math.floor(fy)}`);
      if (!t) return NaN;
      const px = Math.min(t.w - 1, Math.floor((fx % 1) * t.w)), py = Math.min(t.w - 1, Math.floor((fy % 1) * t.w));
      const i = (py * t.w + px) * 4;
      return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
    };
  }
  let viewTimer = 0, viewSeq = 0, viewKey = "";
  function scheduleView() {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(updateView, 180);
  }
  function hideView() {
    viewKey = "";
    if (map.getLayer("view")) map.setLayoutProperty("view", "visibility", "none");
    $("#mapLegend").hidden = true;
  }
  async function updateView() {
    const s = draftStand;
    if (!s || !prefs.view || !info || !map.getSource("sectors")) { hideView(); return; }
    const radius = clamp(Math.round(s.range * 1.6), 150, 320), target = prefs.target;
    const key = [s.lon, s.lat, s.height, s.range, s.facing, s.width, target].join("|");
    if (key === viewKey) return;
    viewKey = key;
    const seq = ++viewSeq;
    $("#sf-viewStats").textContent = "";
    const ground = await groundSampler(s.lon, s.lat, radius);
    if (seq !== viewSeq || draftStand !== s) return;
    const res = Viewshed.compute({
      lon: s.lon, lat: s.lat, eye: (+s.height || 0) + 1.1, target, radius, range: s.range, facing: s.facing, width: s.width,
      sample: (lo, la) => { const v = vegetation(lo, la); return { z: ground(lo, la), veg: v.veg, rate: v.rate }; },
    });
    if (seq !== viewSeq) return;
    if (!map.getSource("view")) {
      map.addSource("view", { type: "image", url: res.url, coordinates: res.coordinates });
      map.addLayer({ id: "view", type: "raster", source: "view", paint: { "raster-fade-duration": 0, "raster-resampling": "nearest" } }, "cones");
    } else map.getSource("view").updateImage({ url: res.url, coordinates: res.coordinates });
    map.setLayoutProperty("view", "visibility", "visible");
    $("#mapLegend").hidden = false;
    $("#mapLegendTitle").textContent = `What you can see from ${s.name || "the stand"}`;
    const st = res.stats, pct = (k) => st.cells ? Math.round((st[k] / st.cells) * 100) : 0;
    const seen = pct(1) + pct(2);
    $("#sf-viewStats").textContent = st.cells ? `${seen}% visible · ${pct(3)}% behind terrain · ${pct(4)}% thick forest` : "";
  }

  let moveRaf = 0;
  map.on("mousemove", (e) => {
    if (isPhone() || moveRaf) return;
    moveRaf = requestAnimationFrame(async () => {
      moveRaf = 0;
      const [E, N] = Geo.toSweref(e.lngLat.lng, e.lngLat.lat);
      const el = await elevationAt(e.lngLat.lng, e.lngLat.lat);
      $("#readout").textContent = `N ${Math.round(N)}  E ${Math.round(E)}${el ? `  ·  ${el.z.toFixed(1)} m` : ""}`;
    });
  });
  map.on("mouseout", () => { $("#readout").textContent = ""; });

  // ---------- GPS ----------
  let watchId = null, meMarker = null, firstFix = true, myFix = null, firstFixDone = null;
  function startGPS() {
    if (watchId !== null) return true;
    if (!("geolocation" in navigator)) { toast("This browser can't share your position."); return false; }
    firstFix = true;
    prefs.gpsOn = true; savePrefs();
    clearTimeout(startGPS.slow);
    startGPS.slow = setTimeout(() => {
      if (watchId !== null && !myFix) toast("Still no GPS position. If no question about location appeared, location is blocked for Safari. See Family → Position not working?", 9000);
    }, 20000);
    watchId = navigator.geolocation.watchPosition((p) => {
      const ll = [p.coords.longitude, p.coords.latitude];
      myFix = { ll, acc: p.coords.accuracy, t: Date.now() };
      if (!meMarker) {
        const el = document.createElement("div"); el.className = "me"; el.innerHTML = '<i class="me-beam"></i><i class="me-dot"></i>';
        meMarker = new maplibregl.Marker({ element: el, rotationAlignment: "map" }).setLngLat(ll).addTo(map);
        renderHud();
      }
      meMarker.setLngLat(ll);
      map.getSource("me").setData(FC([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [Geo.circle(ll, p.coords.accuracy)] } }]));
      if (firstFix) {
        firstFix = false;
        clearTimeout(startGPS.slow);
        armHeading();   // location works; the compass is asked for on the next tap
        // always go to the person, wherever they are; outside the map areas only the dot is drawn
        map.easeTo({ center: ll, zoom: Math.max(map.getZoom(), 16) });
        if (!nearArea(ll)) toast(`You're outside the detailed map areas (${kmToNearestArea(ll).toFixed(1)} km away), so only the terrain shows here.`, 6000);
      }
      if (FAMILY) Family.onFix(p);
      if (firstFixDone !== watchId) { firstFixDone = watchId; renderPosBtn(); }
      followTick();
      renderMyCone();
      Rec.onFix(ll, p.coords.accuracy);
      if (FAMILY) renderGoto();
    }, (err) => {
      if (err.code !== 1) return;  // timeouts and weak signal: keep listening
      clearTimeout(startGPS.slow);
      toast("Location is blocked for this site. See Family → Position not working?", 9000);
      if (FAMILY) { showTab("family"); $("#gpsHelp").open = true; }
      stopGPS();
      if (FAMILY) Family.setSharing(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    renderPosBtn();
    return true;
  }
  function stopGPS() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; myFix = null;
    prefs.gpsOn = false; savePrefs();
    if (Heading.on) disableHeading(false);
    if (Follow.on) setFollow(false);
    if (typeof renderHud === "function" && map.getSource("me")) renderHud();
    renderMyCone();
    if (meMarker) { meMarker.remove(); meMarker = null; }
    if (map.getSource("me")) map.getSource("me").setData(FC());
    renderPosBtn();
  }
  const POS_TITLES = { off: "Show my position", on: "Follow me (the map turns with you)", follow: "Turn off my position" };
  function posState() { return Follow.on ? "follow" : watchId !== null ? "on" : "off"; }
  function renderPosBtn() {
    const st = posState(), b = $("#locate");
    b.dataset.state = st; b.setAttribute("aria-pressed", String(st !== "off"));
    b.title = POS_TITLES[st]; b.setAttribute("aria-label", POS_TITLES[st]);
  }
  function cyclePosition() {
    const st = posState();
    if (st === "off") startGPS();
    else if (st === "on") setFollow(true);
    else { setFollow(false); stopGPS(); if (FAMILY && Family.sharing) Family.setSharing(false); }
    renderPosBtn();
  }

  // ---------- compass (top left): north, wind, and which way the phone faces ----------
  const Heading = { on: false, deg: null, raf: 0, seen: false };
  // Compass bezel: fine ticks every 5°, longer every 30°, cardinal letters kept upright as the ring turns.
  const HUD_LETTERS = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
  function buildHud() {
    let h = "";
    for (let d = 0; d < 360; d += 5) {
      if (d % 90 === 0) continue;
      const len = d % 30 === 0 ? 7 : d % 10 === 0 ? 4.5 : 3, cls = d % 30 === 0 ? "t30" : d % 10 === 0 ? "t10" : "t5";
      const col = d % 30 === 0 ? "#f1f4ec" : "#b9c2b0", sw = d % 30 === 0 ? 1.6 : d % 10 === 0 ? 1.1 : .8;
      h += `<line class="${cls}" x1="0" y1="${-47 + len}" x2="0" y2="-47" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" style="stroke:${col}" transform="rotate(${d})"/>`;
    }
    h += `<path class="hud-north" fill="#ff4d4d" style="fill:#ff4d4d" d="M0 -48 L4.5 -38 L-4.5 -38 Z"/>`;
    for (const d of [90, 180, 270]) h += `<line class="t90" x1="0" y1="-38" x2="0" y2="-47" stroke="#f1f4ec" stroke-width="2.2" style="stroke:#f1f4ec" transform="rotate(${d})"/>`;
    for (const [t, d] of HUD_LETTERS) {
      const x = Math.sin(d * Math.PI / 180) * 29, y = -Math.cos(d * Math.PI / 180) * 29;
      const fc = t === "N" ? "#ff4d4d" : "#f1f4ec";
      h += `<text class="${t === "N" ? "hud-n" : ""}" fill="${fc}" style="fill:${fc}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" data-x="${x}" data-y="${y}">${t}</text>`;
    }
    $("#hudRing").innerHTML = h;
  }
  function renderHud() {
    const b = map.getBearing(), w = prefs.wind;
    $("#hudRing").setAttribute("transform", `rotate(${-b})`);
    for (const t of $$("#hudRing text")) t.setAttribute("transform", `rotate(${b} ${t.dataset.x} ${t.dataset.y})`);
    $("#hudWind").setAttribute("transform", `rotate(${w.from - b})`);
    $("#hudWind").classList.toggle("calm", w.speed < 1);
    const wx = wxHour(), hudKey = `${w.from}|${w.speed}|${wx ? wx.t : ""}`;
    if (renderHud.key !== hudKey) {   // the compass redraws on every map turn; only rebuild the text when the weather changes
      renderHud.key = hudKey;
      // gusts from the SMHI forecast in brackets, like the SMHI app: "N 1.5 m/s (3)"
      const gust = wx && prefs.windMode !== "manual" && typeof wx.gust === "number" ? ` (${Math.round(wx.gust)})` : "";
      $("#hudWindText").innerHTML = (wx ? wxSvg(wx) : "") + `<span>${w.speed < 1 ? "Calm" : `${Geo.compassName(w.from)} ${w.speed} m/s${gust}`}</span>`
        + (wx && typeof wx.temp === "number" ? `<span class="hud-temp">${Math.round(wx.temp)}°</span>` : "");
    }
    const hasHead = Heading.on && Heading.deg !== null;
    if (hasHead) $("#hudHead").removeAttribute("hidden"); else $("#hudHead").setAttribute("hidden", "");
    if (hasHead) $("#hudHead").setAttribute("transform", `rotate(${Heading.deg - b})`);
    if (meMarker) {
      meMarker.getElement().classList.toggle("has-heading", hasHead);
      if (hasHead) meMarker.setRotation(Heading.deg);
    }
  }
  function onOrientation(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;  // iPhone
    else if (e.absolute && typeof e.alpha === "number") h = 360 - e.alpha;                                          // Android
    if (h === null) return;
    const turn = (screen.orientation && screen.orientation.angle) || 0;
    h = (h + turn + 360) % 360;
    Heading.seen = true;
    if (Heading.deg === null) Heading.deg = h;
    else { const d = ((h - Heading.deg + 540) % 360) - 180; Heading.deg = (Heading.deg + d * 0.3 + 360) % 360; }  // smooth the jitter
    if (!Heading.raf) Heading.raf = requestAnimationFrame(() => { Heading.raf = 0; followTick(); renderHud(); });
  }
  // quiet: no "no compass" message (a PC simply shows no facing arrow)
  async function enableHeading(quiet = false) {
    if (Heading.on || Heading.pending) return;
    const D = window.DeviceOrientationEvent;
    if (!D) { if (!quiet) toast("This device has no compass."); return; }
    Heading.pending = true;
    if (typeof D.requestPermission === "function") {
      let r = "denied";
      try { r = await D.requestPermission(); } catch { r = "denied"; }
      if (r !== "granted") { Heading.pending = false; if (!quiet) toast("Compass access was refused. Close the app and open it again to be asked again.", 6000); return; }
    }
    Heading.pending = false;
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    Heading.on = true; Heading.seen = false; renderHud();
    setTimeout(() => { if (Heading.on && !Heading.seen) { if (!quiet) toast("This device has no compass."); disableHeading(false); } }, 3000);
  }
  // Position turned on without a tap (app reopened): the iPhone only asks for the compass from a tap, so use the next one.
  function armHeading() {
    if (Heading.on || Heading.pending) return;
    const D = window.DeviceOrientationEvent;
    if (!D) return;
    if (typeof D.requestPermission !== "function") { enableHeading(true); return; }
    const go = () => { if (watchId !== null) enableHeading(true); };
    document.addEventListener("touchend", go, { once: true, capture: true });
  }
  const Follow = { on: false, warnedFar: false, touches: 0 };
  for (const ev of ["touchstart", "touchend", "touchcancel"]) {
    map.getCanvasContainer().addEventListener(ev, (e) => {
      Follow.touches = e.touches.length;
      if (!Follow.touches) setTimeout(followTick, 60);   // catch up as soon as the fingers lift
    }, { passive: true, capture: true });
  }
  map.on("zoomend", () => followTick());
  // While following, zooming (pinch, double tap, two-finger tap, wheel) stays free and keeps you in the centre;
  // panning and turning by hand are off because the map follows your position and the way you face.
  function followGestures(on) {
    if (on) {
      map.dragPan.disable(); map.dragRotate.disable(); map.keyboard.disableRotation();
      map.touchZoomRotate.disable(); map.touchZoomRotate.enable({ around: "center" }); map.touchZoomRotate.disableRotation();
      map.scrollZoom.disable(); map.scrollZoom.enable({ around: "center" });
      map.touchPitch.disable();
    } else {
      map.dragPan.enable(); map.dragRotate.enable(); map.keyboard.enableRotation();
      map.touchZoomRotate.disable(); map.touchZoomRotate.enable(); map.touchZoomRotate.enableRotation();
      map.scrollZoom.disable(); map.scrollZoom.enable();
      map.touchPitch.enable();
    }
  }
  function setFollow(on) {
    if (on) {
      if (!Heading.on) enableHeading();   // first: the iPhone asks for compass access only from a tap
      if (!startGPS()) return;
      Follow.on = true; Follow.warnedFar = false; Follow.zoomed = false;
      followGestures(true);
      if (myFix) map.jumpTo({ center: myFix.ll, zoom: Math.max(map.getZoom(), 17) });
    } else {
      if (Follow.on) followGestures(false);
      Follow.on = false;
      if (Heading.on && watchId === null) disableHeading(false);
      map.easeTo({ bearing: 0, duration: 500 });
    }
    renderHud(); renderPosBtn();
  }
  function followTick() {
    if (!Follow.on || Follow.touches > 0 || map.isZooming()) return;
    const cam = {};
    if (Heading.deg !== null) cam.bearing = Heading.deg;
    if (myFix) {
      cam.center = myFix.ll;
      if (!Follow.zoomed) { Follow.zoomed = true; if (map.getZoom() < 16.5) cam.zoom = 17; }
    }
    if (cam.bearing !== undefined || cam.center) map.jumpTo(cam);
  }
  function disableHeading(stopFollow = true) {   // without a compass, follow mode keeps following north-up
    if (Follow.on && stopFollow) setFollow(false);
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
    Heading.on = false; Heading.deg = null; renderHud();
  }

  function goHome() {
    if (Store.data.boundary && pairs(Store.data.boundary).length >= 3) fitBoundary(true);
    else map.easeTo({ center: START.center, zoom: START.zoom, bearing: 0 });
  }
  function fitBoundary(animate = true) {
    const b = Store.data.boundary ? pairs(Store.data.boundary) : null; if (!b || b.length < 3) return;
    const xs = b.map((p) => p[0]), ys = b.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, animate });
  }

  // ---------- wire up UI ----------
  function initUI() {
    // tabs & sheet
    $$(".tabs button").forEach((b) => b.addEventListener("click", () => {
      if (sheetDragged) return;
      // phone: tapping the open tab again closes it, like an ordinary app
      if (isPhone() && $("#app").dataset.sheet === "open" && prefs.tab === b.dataset.tab) { setSheet("peek"); return; }
      showTab(b.dataset.tab, true);
    }));
    $("#sheetHandle").addEventListener("click", () => { if (!sheetDragged) setSheet($("#app").dataset.sheet === "open" ? "peek" : "open"); });
    sheetSwipe();
    showTab(prefs.tab, false);

    // base & overlays
    $$('input[name="base"]').forEach((r) => {
      r.checked = r.value === prefs.base;
      r.addEventListener("change", () => { prefs.base = r.value; savePrefs(); applyLayers(); renderLegend(); });
    });
    $$("[data-ov]").forEach((c) => {
      c.checked = !!prefs.ov[c.dataset.ov];
      c.addEventListener("change", () => { prefs.ov[c.dataset.ov] = c.checked; savePrefs(); applyLayers(); if (prefs.ov.quiet) Ground.load(); });
    });
    $$("[data-quiet]").forEach((b) => b.addEventListener("click", () => { prefs.quietMode = b.dataset.quiet; savePrefs(); applyLayers(); }));
    $("#tilt").addEventListener("click", () => set3D(!is3D));
    $("#exag").value = prefs.exag; $("#exagOut").textContent = prefs.exag + "×";
    $("#exag").addEventListener("input", (e) => {
      prefs.exag = +e.target.value; $("#exagOut").textContent = prefs.exag.toFixed(1) + "×"; savePrefs();
      if (is3D) map.setTerrain({ source: "dem", exaggeration: prefs.exag });
    });
    buildHud();
    $("#hudRose").addEventListener("click", () => map.easeTo({ bearing: 0, pitch: is3D ? map.getPitch() : 0 }));
    $("#hudWindText").addEventListener("click", () => showTab("wind", true));
    // moving the map by hand ends follow mode
    map.on("rotate", renderHud);
    $("#home").addEventListener("click", goHome);
    $("#locate").addEventListener("click", cyclePosition);

    // boundary
    $("#drawBoundary").addEventListener("click", () => { setTool("boundary", { draw: true }); });
    $("#editBoundary").addEventListener("click", () => { setTool("editBoundary"); });
    $("#clearBoundary").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to remove"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Remove"; }, 3000); return; }
      btn.dataset.confirm = ""; btn.textContent = "Remove"; await Store.setBoundary(null);
    });

    // tools
    const hmenu = $("#huntMenu");
    const closeHunt = () => { hmenu.hidden = true; $("#huntBtn").setAttribute("aria-expanded", "false"); };
    $("#huntBtn").addEventListener("click", (e) => {
      e.stopPropagation(); const open = hmenu.hidden;
      closePopups(); hmenu.hidden = !open; $("#huntBtn").setAttribute("aria-expanded", String(open));
      if (open && isPhone()) setSheet("peek");   // one thing at a time on a small screen
    });
    $("#pushBox").addEventListener("click", (e) => {
      const b = e.target.closest("[data-push]"); if (!b) return;
      if (b.dataset.push === "copy") Ntfy.copy(); else Ntfy.test();
    });
    $("#otBox").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-ot]"); if (!b) return;
      if (b.dataset.ot === "save") {
        const u = $("#otUrlIn").value.trim();
        // the Cloudflare forwarder (OwnTracks can't follow the redirect Apps Script answers with)
        if (!/^https:\/\/[a-z0-9.-]+\.workers\.dev\/?$/i.test(u)) { toast("Paste the forwarder address, the one ending in workers.dev."); return; }
        await window.FB.db.doc("map/config").update({ otUrl: u }).catch(() => toast("Couldn't save. Check your connection."));
      }
      if (b.dataset.ot === "reset") await window.FB.db.doc("map/config").update({ otUrl: "" }).catch(() => {});
      if (b.dataset.ot === "copy") {
        try { await navigator.clipboard.writeText(OT.personalUrl()); toast("Copied"); } catch { prompt("Your OwnTracks address:", OT.personalUrl()); }
      }
    });
    $("#dayCard").addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]"); if (!b) return;
      if (b.dataset.day === "start") Day.begin();
      if (b.dataset.day === "end") {
        if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = tr("Tap again to end"); setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ""; b.textContent = tr("End the hunt day"); } }, 3000); return; }
        Day.end();
      }
    });
    $("#dayCard").addEventListener("change", (e) => {
      const s = e.target.closest("[data-assign]");
      if (s) { if (s.value === "__place") Day.startSpot(s.dataset.assign); else if (s.value !== "__spot") Day.assign(s.dataset.assign, s.value); }
      const f = e.target.closest("[data-route-from]");
      if (f) { if (f.value === "__pick") RoutePick.pickStart(); else RoutePick.open(f.dataset.routeFrom, f.value); }
    });
    $("#dayCard").addEventListener("click", async (e) => {
      const sp = e.target.closest("[data-spot]"); if (sp) { Day.startSpot(sp.dataset.spot); return; }
      if (e.target.closest("[data-route-via]")) { RoutePick.pickVia(); return; }
      const r = e.target.closest("[data-route]"); if (r) { RoutePick.email === r.dataset.route ? RoutePick.close() : RoutePick.open(r.dataset.route); return; }
      const p = e.target.closest("[data-route-pick]"); if (p) { RoutePick.choose(+p.dataset.routePick); return; }
      const n = e.target.closest("[data-route-none]");
      if (n) { await window.FB.db.doc("map/huntday").update({ routes: { [n.dataset.routeNone]: null } }).catch(() => {}); RoutePick.close(); return; }
      if (e.target.closest("[data-route-close]")) RoutePick.close();
    });
    $("#myStandChip").addEventListener("click", () => {
      const st = Day.myPlace(); if (!st) return;
      const pos = myPos();
      if (pos) map.fitBounds([[Math.min(pos.ll[0], st.lon), Math.min(pos.ll[1], st.lat)], [Math.max(pos.ll[0], st.lon), Math.max(pos.ll[1], st.lat)]], { padding: 90, maxZoom: 17 });
      else map.easeTo({ center: [st.lon, st.lat], zoom: Math.max(map.getZoom(), 16) });
    });
    hmenu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ev]"); if (!b) return;
      closeHunt();
      if (b.dataset.ev === "animal" || b.dataset.ev === "sound") { setTool(b.dataset.ev); return; }   // first tap where the animal (or the sound) is
      Hunt.send(b.dataset.ev);
    });
    document.addEventListener("click", (e) => { if (!hmenu.hidden && !e.target.closest("#huntMenu")) closeHunt(); });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-search-from]"); if (!b) return;
      const ev = Hunt.events.find((x) => x.id === b.dataset.searchFrom); if (!ev) return;
      document.querySelectorAll(".maplibregl-popup").forEach((p) => p.remove());
      Rec.start("search", { lon: ev.lon, lat: ev.lat, label: tr(EVENT_TEXT.shot(ev)) });
    });
    // delete a message: tap Delete, then again within 3 s to confirm (in the list or on its map pin)
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-del-ev]"); if (!b) return;
      e.stopPropagation();
      if (b.dataset.confirm !== "1") {
        b.dataset.confirm = "1"; b.textContent = tr("Confirm");
        setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ""; b.textContent = tr("Delete"); } }, 3000);
        return;
      }
      Hunt.remove(b.dataset.delEv);
    }, true);
    $("#eventList").addEventListener("click", (e) => {
      if (e.target.closest("[data-del-ev]")) return;
      const li = e.target.closest("li[data-lon]"); if (!li) return;
      map.easeTo({ center: [+li.dataset.lon, +li.dataset.lat], zoom: Math.max(map.getZoom(), 16) });
    });
    const menu = $("#addMenu");
    const closeMenu = () => { menu.hidden = true; $("#addBtn").setAttribute("aria-expanded", "false"); };
    $("#addBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (tool) { if (LAYOUT_TOOLS.includes(tool)) closeFeatForm(); setTool(null); closeMenu(); return; }   // + also cancels what you're doing
      const open = menu.hidden;
      closePopups(); menu.hidden = !open; $("#addBtn").setAttribute("aria-expanded", String(open));
      if (open && isPhone()) setSheet("peek");
    });
    menu.addEventListener("click", (e) => {
      const r = e.target.closest("[data-rec]");
      if (r) { closeMenu(); Rec.start(r.dataset.rec); return; }
      const b = e.target.closest("[data-tool]"); if (!b) return;
      closeMenu(); setTool(b.dataset.tool);
    });
    $("#recStop").addEventListener("click", () => Rec.stop());
    $("#bestList").addEventListener("click", (e) => {
      const r = e.target.closest("[data-id]"); if (!r) return;
      const st = Store.data.stands.find((x) => x.id === r.dataset.id);
      if (st) { map.easeTo({ center: [st.lon, st.lat], zoom: Math.max(map.getZoom(), 15.5) }); if (isPhone()) setSheet("peek"); }
    });
    $("#recMarks").addEventListener("click", (e) => { const b = e.target.closest("[data-mark]"); if (b) Rec.mark(b.dataset.mark); });
    $("#trackList").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-del-track]");
      if (del) {
        if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Confirm"; setTimeout(() => { del.dataset.confirm = ""; del.textContent = "Delete"; }, 3000); return; }
        if (Rec.on && Rec.on.id === del.dataset.delTrack) Rec.stop();
        await Store.remove("tracks", del.dataset.delTrack); return;
      }
      const li = e.target.closest("li[data-id]"); if (!li) return;
      const t = Store.data.tracks.find((x) => x.id === li.dataset.id); if (!t || !(t.pts || []).length) return;
      const p = pairs(t.pts), b = p.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [180, 90, -180, -90]);
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, maxZoom: 17 });
    });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#addMenu")) closeMenu(); });
    map.on("movestart", closeMenu);
    $("#hintCancel").addEventListener("click", () => {
      if (["editTrail", "newTrail", "newPlace"].includes(tool)) { closeFeatForm(); setTool("layout"); } else setTool(null);
    });
    $("#hintAddTrail").addEventListener("click", () => { closeFeatForm(); setTool("newTrail"); });
    $("#hintAddPlace").addEventListener("click", () => { closeFeatForm(); setTool("newPlace"); });
    $("#editLayout").addEventListener("click", () => { if (LAYOUT_TOOLS.includes(tool)) { closeFeatForm(); setTool(null); } else setTool("layout"); });
    $("#featForm").addEventListener("submit", async (e) => {
      e.preventDefault(); if (!featDraft) return;
      const name = $("#ff-name").value.trim();
      if (featDraft.type === "place") {
        const p = Store.data.places.find((x) => x.id === featDraft.id);
        closeFeatForm();
        if (p) { await Store.put("places", { ...p, name: name || p.name, kind: $("#ff-kind").value }); toast("Place saved"); }
      } else if (tool === "editTrail" && edit && edit.id === featDraft.id) {
        finishTool();
      } else {
        const t = Store.data.trails.find((x) => x.id === featDraft.id);
        closeFeatForm();
        if (t) { await Store.put("trails", { ...t, name }); toast("Trail saved"); }
      }
    });
    $("#ff-cancel").addEventListener("click", closeFeatForm);
    $("#ff-delete").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to delete"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete"; }, 3000); return; }
      btn.dataset.confirm = ""; btn.textContent = "Delete";
      if (!featDraft) return;
      const { type, id } = featDraft; closeFeatForm();
      if (type === "trail" && tool === "editTrail") setTool("layout");
      await Store.remove(type === "place" ? "places" : "trails", id);
      toast(type === "place" ? "Place deleted" : "Trail deleted");
    });
    $("#hintUndo").addEventListener("click", () => {
      if (edit) { if (edit.history.length) { edit.pts = edit.history.pop(); edit.sel = -1; renderEdit(); updateHint(); } return; }
      pts.pop(); updateHint(); updateDraft();
    });
    $("#hintDelete").addEventListener("click", () => {
      if (!edit || edit.sel < 0 || edit.pts.length <= (edit.closed ? 3 : 2)) return;
      edit.history.push(edit.pts.map((q) => q.slice())); edit.pts.splice(edit.sel, 1); edit.sel = -1; renderEdit(); updateHint();
    });
    $("#hintDone").addEventListener("click", () => { if (tool === "measure") { pts = []; updateHint(); updateDraft(); } else finishTool(); });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && tool) $("#hintCancel").hidden ? $("#hintDone").click() : $("#hintCancel").click();
      if (e.key === "Enter" && tool && ["route", "boundary"].includes(tool) && document.activeElement === document.body) finishTool();
    });
    $("#addSighting").addEventListener("click", () => setTool("sighting"));

    // stand form
    for (const id of ["sf-facing", "sf-width", "sf-range"]) $("#" + id).addEventListener("input", () => { updateStandOutputs(); if (draftStand) { readStandForm(); renderAll(); } });
    for (const id of ["sf-type", "sf-name"]) $("#" + id).addEventListener("change", () => { if (draftStand) { readStandForm(); renderAll(); } });
    $("#sf-showView").checked = prefs.view;
    $("#sf-target").value = String(prefs.target);
    $("#sf-viewLegend").hidden = !prefs.view;
    $("#sf-showView").addEventListener("change", (e) => {
      prefs.view = e.target.checked; savePrefs(); $("#sf-viewLegend").hidden = !prefs.view;
      $("#sf-viewStats").textContent = "";
      viewKey = ""; renderStandGeometry();
    });
    $("#sf-target").addEventListener("change", (e) => { prefs.target = +e.target.value; savePrefs(); renderStandGeometry(); });
    $("#standForm").addEventListener("submit", async (e) => {
      e.preventDefault(); if (!draftStand) return;
      readStandForm();
      if (!draftStand.name) draftStand.name = `Stand ${Store.data.stands.length + 1}`;
      const { isNew, ...s } = draftStand;
      draftStand = null; $("#standForm").hidden = true;
      await Store.put("stands", s); renderAll(); toast(isNew ? "Stand saved" : "Stand updated");
    });
    $("#sf-cancel").addEventListener("click", closeStandForm);
    $("#sf-delete").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to delete"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete"; }, 3000); return; }
      btn.dataset.confirm = ""; btn.textContent = "Delete";
      const id = draftStand && draftStand.id; closeStandForm(); if (id) await Store.remove("stands", id);
    });
    $("#standList").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-id]"); if (!li) return;
      const s = Store.data.stands.find((x) => x.id === li.dataset.id); if (!s) return;
      map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 16) }); editStand(s.id);
    });
    $("#routeList").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-del-route]");
      if (del) {
        if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Confirm"; setTimeout(() => { del.dataset.confirm = ""; del.textContent = "Delete"; }, 3000); return; }
        await Store.remove("routes", del.dataset.delRoute); return;
      }
      const li = e.target.closest("li[data-id]"); if (!li) return;
      const r = Store.data.routes.find((x) => x.id === li.dataset.id); if (!r) return;
      const p = pairs(r.pts); const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, maxZoom: 17 });
    });

    $("#whoList").addEventListener("change", (e) => {
      const k = e.target.dataset.who; if (!k) return;
      prefs.hideBy = { ...(prefs.hideBy || {}) };
      if (e.target.checked) delete prefs.hideBy[k]; else prefs.hideBy[k] = true;
      savePrefs(); renderAll();
    });

    // language (Swedish by default); switching reloads so every text is redrawn in the new language
    const lang = (window.I18N && window.I18N.lang) || "en";
    $$('input[name="lang"]').forEach((r) => {
      r.checked = r.value === lang;
      r.addEventListener("change", () => {
        prefs.lang = r.value;
        try { localStorage.setItem("alnaryd-prefs", JSON.stringify(prefs)); } catch { /* ignore */ }
        location.reload();
      });
    });

    // wind
    buildDial();
    $("#windSpeed").value = prefs.wind.speed;
    $("#windSpeed").addEventListener("input", (e) => { prefs.wind.speed = +e.target.value; prefs.windMode = "manual"; savePrefs(); renderAll(); renderForecast(); });
    $("#fcStrip").addEventListener("click", (e) => { const b = e.target.closest(".fc-h"); if (b) applyForecastHour(+b.dataset.t); });
    $("#fcUse").addEventListener("click", () => {
      const now = Date.now(), first = Forecast.hours.find((h) => h.t > now - 3600e3);
      applyForecastHour(Forecast.selT && Forecast.selT > now - 3600e3 ? Forecast.selT : first && first.t);
    });
    loadForecast();
    if (prefs.ov.quiet) Ground.load();
    setInterval(loadForecast, 30 * 60e3);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - Forecast.fetched > 30 * 60e3) loadForecast(); if (document.visibilityState === "visible" && prefs.ov.quiet) Ground.load(); });
    $("#showMyCone").checked = prefs.myCone;
    $("#showMyCone").addEventListener("change", (e) => { prefs.myCone = e.target.checked; savePrefs(); if (prefs.myCone) startGPS(); renderMyCone(); renderHud(); });
    $("#seasonSearch").addEventListener("input", renderSeasons);
    $("#seasonOpen").addEventListener("change", renderSeasons);
    $("#showFlow").checked = prefs.windFlow;
    $("#showFlow").addEventListener("change", (e) => { prefs.windFlow = e.target.checked; savePrefs(); renderFlow(); });
    $("#showCones").checked = prefs.cones;
    $("#showCones").addEventListener("change", (e) => { prefs.cones = e.target.checked; savePrefs(); applyLayers(); });

    // sightings
    $("#lf-species").innerHTML = SPECIES.map((s) => `<option value="${s.id}">${s.name} (${s.sv})</option>`).join("");
    $("#logFilter").innerHTML = `<option value="">All species</option>` + SPECIES.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
    $("#logFilter").addEventListener("change", renderAll);
    $("#lf-species").addEventListener("change", updateDraftPin);
    $("#sightForm").addEventListener("submit", async (e) => {
      e.preventDefault(); if (!draftSighting) return;
      const { isNew, ...s } = draftSighting;
      Object.assign(s, { species: $("#lf-species").value, count: clamp(+$("#lf-count").value || 1, 1, 99), kind: $("#lf-kind").value,
        when: $("#lf-when").value ? new Date($("#lf-when").value).toISOString() : new Date().toISOString(), notes: $("#lf-notes").value.trim() });
      if (isNew) s.wind = `${dir8(prefs.wind.from)} ${prefs.wind.speed} m/s`;
      closeSightForm(); await Store.put("sightings", s); toast("Sighting saved");
    });
    $("#lf-cancel").addEventListener("click", closeSightForm);
    $("#lf-delete").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to delete"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete"; }, 3000); return; }
      btn.dataset.confirm = ""; btn.textContent = "Delete";
      const id = draftSighting && draftSighting.id; closeSightForm(); if (id) await Store.remove("sightings", id);
    });
    $("#logList").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-id]"); if (!li) return;
      const x = Store.data.sightings.find((s) => s.id === li.dataset.id); if (!x) return;
      map.easeTo({ center: [x.lon, x.lat], zoom: Math.max(map.getZoom(), 16) });
      draftSighting = { ...x, isNew: false }; openSightForm();
    });
  }

  // ---------- recorded tracks and eftersök (blood tracking) ----------
  const MARKS = { blood: { n: "Blood", c: "#e03131" }, sign: { n: "Tracks", c: "#f08c00" }, bed: { n: "Bed", c: "#7048e8" },
    hair: { n: "Hair", c: "#adb5bd" }, found: { n: "Animal found", c: "#2b8a3e" } };
  const Rec = {
    on: null, lastSave: 0, timer: 0,
    start(kind, from) {
      if (this.on) { toast("Already recording."); return; }
      if (watchId === null) startGPS();
      const here = myPos(), pts = from ? [from.lon, from.lat] : here ? [...here.ll] : [];
      this.on = { id: newId("tk"), kind, pts, ts: pts.length ? [Date.now()] : [], marks: [], start: Date.now(), from: from ? from.label || "" : "" };
      // no screen wake lock: the phone may lock in the pocket (the screen is the biggest battery drain);
      // OwnTracks keeps sending and the gaps are filled from it when the map is opened again
      this.timer = setInterval(() => this.renderBar(), 15000);
      this.renderBar(); renderTracks(); this.save();
      toast(kind === "search" ? "Blood tracking started. Mark what you find as you go." : "Recording your track. You can lock the phone; OwnTracks fills in the gaps.");
    },
    onFix(ll, acc) {
      const r = this.on; if (!r || acc > 40) return;
      const n = r.pts.length;
      if (n >= 2 && Geo.distance([r.pts[n - 2], r.pts[n - 1]], ll) < 4) return;
      r.pts.push(ll[0], ll[1]); r.ts.push(Date.now());
      renderTracks(); this.renderBar();
      if (Date.now() - this.lastSave > 20000) this.save();
    },
    // While the phone was locked the map had no GPS, but OwnTracks kept sending: put those points into the
    // track in time order instead of a straight line across the gap.
    backfill() {
      const r = this.on, v = FAMILY && Family.otMine;
      if (!r || !v || !Array.isArray(v.hist)) return;
      const have = new Set(r.ts.map((t) => Math.round(t / 1000))), all = [];
      for (let i = 0; i < r.ts.length; i++) all.push([r.pts[2 * i], r.pts[2 * i + 1], r.ts[i]]);
      let added = 0;
      for (let i = 0; i + 2 < v.hist.length; i += 3) {
        const t = v.hist[i + 2] * 1000;
        if (t >= r.start && t <= Date.now() && !have.has(Math.round(t / 1000))) { all.push([v.hist[i], v.hist[i + 1], t]); added++; }
      }
      if (!added) return;
      all.sort((a, b) => a[2] - b[2]);
      const pts = [], ts = [];
      for (const [lo, la, t] of all) {
        const n = pts.length;
        if (n >= 2 && Geo.distance([pts[n - 2], pts[n - 1]], [lo, la]) < 4) continue;
        pts.push(lo, la); ts.push(t);
      }
      r.pts = pts; r.ts = ts;
      renderTracks(); this.renderBar(); this.save();
    },
    mark(kind) {
      if (!this.on) return;
      const pos = myPos();
      if (!pos) { toast("Waiting for your position. Try again in a moment."); return; }
      this.on.marks.push({ kind, lon: pos.ll[0], lat: pos.ll[1], t: Date.now() });
      renderTracks(); this.save();
      toast(`${MARKS[kind].n} ✓`);
      try { navigator.vibrate && navigator.vibrate(60); } catch { /* none */ }
    },
    save() {
      const r = this.on; if (!r) return;
      this.lastSave = Date.now();
      const old = Store.data.tracks.find((x) => x.id === r.id);
      Store.put("tracks", { ...(old || {}), id: r.id, kind: r.kind, pts: r.pts, ts: r.ts, marks: r.marks, start: r.start, end: Date.now(), from: r.from, live: true });
    },
    stop() {
      const r = this.on; if (!r) return;
      this.save();
      const old = Store.data.tracks.find((x) => x.id === r.id) || {};
      Store.put("tracks", { ...old, id: r.id, kind: r.kind, pts: r.pts, ts: r.ts, marks: r.marks, start: r.start, end: Date.now(), from: r.from, live: false });
      this.on = null; clearInterval(this.timer);
      this.renderBar(); renderTracks();
      toast(`Saved: ${trackLen(r.pts)}`);
    },
    renderBar() {
      const r = this.on, bar = $("#recBar");
      bar.hidden = !r; document.documentElement.classList.toggle("recording", !!r);
      if (!r) return;
      const min = Math.round((Date.now() - r.start) / 60000);
      $("#recInfo").textContent = `${r.kind === "search" ? "Blood tracking" : "Recording"} · ${trackLen(r.pts)} · ${min} min`;
      $("#recMarks").hidden = r.kind !== "search";
    },
  };
  function trackLen(pts) {
    const p = pairs(pts); let d = 0;
    for (let i = 1; i < p.length; i++) d += Geo.distance(p[i - 1], p[i]);
    return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
  }
  function renderTracks() {
    const src = map.getSource("tracks"); if (!src) return;
    const list = plans("tracks").filter((t) => !Rec.on || t.id !== Rec.on.id);
    if (Rec.on) list.push({ ...Rec.on, by: FAMILY && Family.user ? Family.user.email.toLowerCase() : "" });
    const feats = [];
    for (const t of list) {
      const color = t.kind === "search" ? "#e03131" : FAMILY && t.by ? Family.colorFor(t.by) : "#ff7a2e";
      const p = pairs(t.pts || []);
      if (p.length >= 2) feats.push({ type: "Feature", properties: { color, id: t.id }, geometry: { type: "LineString", coordinates: p } });
      for (const m of t.marks || []) feats.push({ type: "Feature", properties: { color: (MARKS[m.kind] || MARKS.sign).c, label: tr((MARKS[m.kind] || MARKS.sign).n) },
        geometry: { type: "Point", coordinates: [m.lon, m.lat] } });
    }
    src.setData(FC(feats));
    const tl = $("#trackList");
    const saved = plans("tracks").slice().sort((a, b) => (b.start || 0) - (a.start || 0));
    tl.innerHTML = saved.length ? saved.map((t) => {
      const d = new Date(t.start || 0).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
      return `<li data-id="${esc(t.id)}"><span class="dot" style="background:${t.kind === "search" ? "#e03131" : FAMILY && t.by ? Family.colorFor(t.by) : "#ff7a2e"}"></span>
        <span class="it-main"><div class="it-name"><span>${t.kind === "search" ? "Blood tracking" : "Track"}</span> ${esc(d)}${t.live && Date.now() - (t.end || 0) < 10 * 60e3 ? " <span>· live</span>" : ""}</div>
        <div class="it-sub">${trackLen(t.pts || [])}${(t.marks || []).length ? ` · ${(t.marks || []).length} marks` : ""}${whoTag(t)}</div></span>
        ${!FAMILY || !t.by || (Family.user && t.by === Family.user.email.toLowerCase()) || (Family.member && Family.member.role === "owner")
          ? `<button class="btn small ghost" data-del-track="${esc(t.id)}" type="button">Delete</button>` : ""}</li>`;
    }).join("") : `<li class="empty">No recorded tracks yet. Start one with +.</li>`;
  }

  function myPos() {
    if (myFix) return { ll: myFix.ll, acc: myFix.acc };
    const v = FAMILY && Family.otMine;
    if (v && typeof v.lon === "number" && Family.isCurrent(v, 0) && Family.goodFix(v)) return { ll: [v.lon, v.lat], acc: v.acc || 20 };
    return null;
  }

  // ---------- hunting seasons and shooting light (Blekinge län) ----------
  function renderSeasons() {
    const J = window.Jakttider; if (!J) return;
    const now = new Date(), sun = sunTimes(now.getTime());
    const hm = (t) => fcClock(t);
    if (sun.up && sun.down) {
      const a = sun.up - 3600e3, b = sun.down + 3600e3;
      $("#lightCard").innerHTML = `<h2 class="eyebrow">Skjutljus i dag</h2>
        <div class="lc-row"><b>${hm(a)} – ${hm(b)}</b><span>Älg, hjort, rådjur. Sista timmen bara smyg- eller vaktjakt.</span></div>
        <div class="lc-row"><b>${hm(a)} – ${hm(b)}</b><span>Änder och gäss.</span></div>
        <div class="lc-row"><b>Ingen gräns</b><span>Övrigt vilt, t.ex. vildsvin och räv.</span></div>
        <div class="lc-sun">Sol upp ${hm(sun.up)} · ned ${hm(sun.down)}</div>`;
    }
    const q = $("#seasonSearch").value.trim().toLowerCase(), onlyOpen = $("#seasonOpen").checked;
    const rows = J.SPECIES.map((sp) => ({ sp, st: J.status(sp, now) }))
      // match the start of any word in the name, English name or group ("råd" finds rådjur, not "område")
      .filter(({ sp, st }) => (!onlyOpen || st.open) && (!q || [sp.n, sp.en, sp.g].join(" ").toLowerCase().split(/[\s,()-]+/).some((w) => w.startsWith(q))));
    const groups = [...new Set(rows.map((r) => r.sp.g))];
    const per = (list) => list.map((p) => `${J.periodText(p)}${p[2] ? " <em>smyg/vakt</em>" : ""}`).join(", ");
    $("#seasonList").innerHTML = rows.length ? groups.map((g) => `<h2 class="eyebrow">${esc(g)}</h2><ul class="seasons">` +
      rows.filter((r) => r.sp.g === g).sort((a, b) => (b.st.open - a.st.open) || a.sp.n.localeCompare(b.sp.n, "sv")).map(({ sp, st }) => {
        const pill = st.open ? `<span class="pill good">${st.partial ? "Delvis jakt i dag" : "Jakt i dag"}</span>`
          : st.never ? `<span class="pill bad">Ingen allmän jakt</span>` : `<span class="pill">Öppnar ${esc(J.label(st.next))}</span>`;
        return `<li class="${st.open ? "open" : ""}"><div class="ss-head"><b>${esc(sp.n)}</b>${pill}</div>
          ${sp.p.length ? `<div class="ss-p">${per(sp.p)}</div>` : ""}
          ${(sp.sub || []).map((x) => `<div class="ss-p"><span class="ss-sub">${esc(x.n)}:</span> ${per(x.p)}</div>`).join("")}
          ${sp.none ? `<div class="ss-n">${esc(sp.none)}</div>` : ""}${sp.note ? `<div class="ss-n">${esc(sp.note)}</div>` : ""}</li>`;
      }).join("") + "</ul>").join("") : `<p class="note">Ingen art matchar.</p>`;
    $("#seasonSource").textContent = J.source + " Länsstyrelsen kan besluta annat. Kontrollera alltid innan jakt.";
  }

  // ---------- hunt day: quick messages, shot marker, who is on which stand, shooting-sector warning ----------
  const SAFETY_RANGE = 600;   // m: a bullet carries far past the stand's own range, so warn well beyond it
  const who = (e) => (FAMILY ? Family.nameFor(e.email, e.name) : e.name);
  const EVENT_TEXT = {
    onstand: (e) => `${who(e)} is on stand ${e.standName || ""}`.trim(),
    daystart: (e) => `${who(e)} started the hunt day`,
    dayend: (e) => `${who(e)}: the hunt is over`,
    offstand: (e) => `${who(e)} left the stand`,
    shot: (e) => `${who(e)}: shot fired` + (typeof e.heading === "number" ? ` toward ${Geo.compassName(e.heading)}` : ""),
    down: (e) => `${who(e)}: animal down`,
    help: (e) => `${who(e)} needs help`,
    animal: (e) => Array.isArray(e.from)
      ? `${who(e)}: animal ${Math.round(Geo.distance(e.from, [e.lon, e.lat]) / 10) * 10} m ${Geo.compassName(Geo.bearing(e.from, [e.lon, e.lat]))} of me`
      : `${who(e)}: animal near me` + (typeof e.heading === "number" ? ` toward ${Geo.compassName(e.heading)}` : ""),
    sound: (e) => Array.isArray(e.from)
      ? `${who(e)}: heard a sound ${Math.round(Geo.distance(e.from, [e.lon, e.lat]) / 10) * 10} m ${Geo.compassName(Geo.bearing(e.from, [e.lon, e.lat]))} of me`
      : `${who(e)}: heard a sound`,
  };
  const EVENT_ICON = { onstand: "◉", offstand: "○", shot: "✛", down: "✔", help: "!", animal: "◎", sound: "♪" };
  const PIN_HOURS = { shot: 12, down: 12, help: 12, animal: 2, sound: 2 };   // how long each kind stays on the map
  const BLINK_MIN = { help: Infinity, animal: Infinity, shot: 15, down: 15, sound: 15 };   // how long a pin blinks
  const Hunt = {
    events: [], stand: null, checkins: {}, seen: null, markers: new Map(), last: new Map(), blocked: false,
    start(db) {
      db.doc("map/onstand").onSnapshot((snap) => {
        this.checkins = snap.exists ? snap.data() : {};
        const me = Family.user.email.toLowerCase(), c = this.checkins[me];
        this.stand = c && c.stand && Date.now() - (c.t || 0) < 14 * 3600e3 ? c.stand : null;
        this.render();
        syncMarkers(); this.checkSafety();
      }, () => {});
      db.collection("events").onSnapshot((snap) => {
        const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (this.showId && all.some((e) => e.id === this.showId)) setTimeout(() => this.show(this.showId), 0);
        const fresh = this.seen ? all.filter((e) => !this.seen.has(e.id)) : [];
        this.seen = new Set(all.map((e) => e.id));
        this.events = all.filter((e) => Date.now() - (e.tc || 0) < 12 * 3600e3).sort((a, b) => b.tc - a.tc);
        const me = Family.user && Family.user.email.toLowerCase();
        for (const e of fresh) if (e.email !== me && Date.now() - e.tc < 10 * 60e3) this.notify(e);
        this.render();
        // tidy: my own messages older than two days
        for (const e of all) if (e.email === me && Date.now() - (e.tc || 0) > 48 * 3600e3) db.doc(`events/${e.id}`).delete().catch(() => {});
      }, () => { this.blocked = true; });
    },
    // who has checked in where (a check-in lasts until they leave the stand, at most 14 hours)
    sitting() {
      const out = new Map();
      for (const [email, c] of Object.entries(this.checkins || {})) if (c && c.stand && Date.now() - (c.t || 0) < 14 * 3600e3) out.set(c.stand, email);
      return out;
    },
    onStand(standId) {
      const who = this.sitting().get(standId);
      if (who) { const m = Family.members.find((x) => x.email === who); return { email: who, name: m ? m.name : who.split("@")[0] }; }
      if (this.stand === standId && Family.user) return { email: Family.user.email.toLowerCase(), name: Family.member && Family.member.name };
      const planned = Day.whoOn(standId);
      if (planned) { const m = Family.members.find((x) => x.email === planned); return { email: planned, name: m ? m.name : planned.split("@")[0], planned: true }; }
      return null;
    },
    // post a message that needs no position (hunt day start and end)
    async post(type, extra = {}) {
      const e = { type, email: Family.user.email.toLowerCase(), name: (Family.member && Family.member.name) || Family.user.email.split("@")[0], tc: Date.now(), ...extra };
      const pos = myPos(); if (pos) { e.lon = pos.ll[0]; e.lat = pos.ll[1]; }
      const id = newId("ev");
      try { await window.FB.db.doc(`events/${id}`).set(e); Ntfy.announce(id, e); } catch { /* rules not published yet */ }
    },
    // at: a spot tapped on the map (where the animal is); otherwise the message is placed where I am
    async send(type, at = null) {
      const pos = myPos();
      if (!pos && !at) { startGPS(); toast("Waiting for your position. Try again in a moment."); return; }
      const e = { type, email: Family.user.email.toLowerCase(), name: (Family.member && Family.member.name) || Family.user.email.split("@")[0],
        lon: at ? at[0] : pos.ll[0], lat: at ? at[1] : pos.ll[1], tc: Date.now() };
      if (at && pos) e.from = pos.ll;   // where I was, so others see how far the animal is from me
      if (!at && Heading.on && Heading.deg !== null) e.heading = Math.round(Heading.deg);
      if (type === "onstand") {
        let best = null, bd = 150;
        for (const st of Store.data.stands) { const d = Geo.distance(pos.ll, [st.lon, st.lat]); if (d < bd) { bd = d; best = st; } }
        if (!best) { toast("No stand within 150 m of you."); return; }
        this.stand = best.id; e.standId = best.id; e.standName = best.name || "";
      }
      if (type === "offstand") { if (!this.stand) return; this.stand = null; }
      if (type === "onstand" || type === "offstand")
        window.FB.db.doc("map/onstand").update({ [e.email]: { stand: this.stand || "", t: Date.now() } }).catch(() => {});
      const st = Store.data.stands.find((x) => x.id === (this.stand || Day.myStand()));
      if (st && !e.standName) e.standName = st.name || "";
      const id = newId("ev");
      try { await window.FB.db.doc(`events/${id}`).set(e); toast(tr(EVENT_TEXT[type](e)) + " ✓"); Ntfy.announce(id, e); }
      catch { toast("Couldn't send. The owner needs to publish the new Firebase rules.", 7000); }
      syncMarkers(); this.render();
    },
    show(id) {
      const e = this.events.find((x) => x.id === id);
      if (!e) { this.showId = id; return; }   // not loaded yet: shown when it arrives
      this.showId = null;
      if (typeof e.lon === "number") map.flyTo({ center: [e.lon, e.lat], zoom: Math.max(map.getZoom(), 16) });
      if (isPhone()) setSheet("peek");
    },
    notify(e) {
      toast(tr(EVENT_TEXT[e.type](e)), e.type === "help" ? 15000 : 7000);
      try { navigator.vibrate && navigator.vibrate(e.type === "help" ? [300, 120, 300, 120, 300] : [200, 100, 200]); } catch { /* no vibration */ }
    },
    render() {
      if (!map.getSource("me")) return;
      const keep = new Set();
      for (const e of this.events) {
        if (!PIN_HOURS[e.type] || Date.now() - e.tc > PIN_HOURS[e.type] * 3600e3) continue;
        keep.add(e.id);
        let m = this.markers.get(e.id);
        if (!m) {
          const el = document.createElement("div"); el.className = `ev-marker ev-${e.type}`;
          el.innerHTML = `<i></i><b>${EVENT_ICON[e.type]}</b>`;
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const t = new Date(e.tc).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
            new maplibregl.Popup({ closeButton: false, offset: 14 }).setLngLat([e.lon, e.lat])
              .setHTML(`<div class="pop"><b>${esc(tr(EVENT_TEXT[e.type](e)))}</b><br>${t}` +
                (e.type === "shot" ? `<br><button class="btn small primary" type="button" data-search-from="${esc(e.id)}">${esc(tr("Start blood tracking here"))}</button>` : "") +
                (Hunt.canDelete(e) ? `<br><button class="btn small ghost" type="button" data-del-ev="${esc(e.id)}">${esc(tr("Delete"))}</button>` : "") + `</div>`).addTo(map);
          });
          m = new maplibregl.Marker({ element: el, rotationAlignment: "map" }).setLngLat([e.lon, e.lat]).addTo(map);
          this.markers.set(e.id, m);
        }
        const arrow = m.getElement().querySelector("i");
        arrow.hidden = typeof e.heading !== "number";
        if (typeof e.heading === "number") arrow.style.transform = `rotate(${e.heading}deg)`;
        m.getElement().style.setProperty("--c", Family.colorFor(e.email));
        m.getElement().classList.toggle("blink", Date.now() - e.tc < (BLINK_MIN[e.type] || 0) * 60e3);
      }
      for (const [id, m] of this.markers) if (!keep.has(id)) { m.remove(); this.markers.delete(id); }
      $("#huntOff").hidden = !this.stand;
      $("#huntOn").hidden = !!this.stand;
      $("#eventList").innerHTML = this.events.length ? this.events.slice(0, 30).map((e) => `<li${typeof e.lon === "number" ? ` data-lon="${e.lon}" data-lat="${e.lat}"` : ""}>
          <span class="fam-dot" style="background:${Family.colorFor(e.email)}" translate="no">${esc(Family.letterFor(e.email, e.name))}</span>
          <span class="it-main"><div class="it-name">${esc(EVENT_TEXT[e.type] ? EVENT_TEXT[e.type](e) : e.type)}</div>
          <div class="it-sub">${new Date(e.tc).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</div></span>
          ${this.canDelete(e) ? `<button class="btn small ghost" type="button" data-del-ev="${esc(e.id)}">Delete</button>` : ""}</li>`).join("")
        : `<li class="empty">No messages today.</li>`;
    },
    canDelete(e) {
      return !!Family.user && (e.email === Family.user.email.toLowerCase() || (Family.member && Family.member.role === "owner"));
    },
    async remove(id) {
      document.querySelectorAll(".maplibregl-popup").forEach((p) => p.remove());
      await window.FB.db.doc(`events/${id}`).delete().catch(() => toast("Couldn't delete. Try again."));
    },
    // A person inside a shooting sector (stand facing ± half the width, out to SAFETY_RANGE): warn both sides.
    inSector(stand, ll) {
      const d = Geo.distance([stand.lon, stand.lat], ll);
      return d > 8 && d < SAFETY_RANGE && Geo.angleDiff(Geo.bearing([stand.lon, stand.lat], ll), stand.facing) <= (stand.width || 90) / 2;
    },
    checkSafety() {
      if (!FAMILY || !Family.user) return;
      const msgs = [], uid = Family.user.uid;
      const live = [...Family.positions].filter(([id, v]) => id !== uid && typeof v.lon === "number" && Family.isCurrent(v, 5) && Family.goodFix(v));
      const me = Family.user.email.toLowerCase();
      // my stand counts once I've checked in, or once I'm at the stand I was given today
      const plannedId = Day.myStand(), planned = plannedId && Store.data.stands.find((x) => x.id === plannedId);
      const pos = myPos();
      const mine = (this.stand && Store.data.stands.find((x) => x.id === this.stand)) || (planned && pos && Geo.distance(pos.ll, [planned.lon, planned.lat]) < 50 ? planned : null);
      if (mine) for (const [, v] of live) if (this.inSector(mine, [v.lon, v.lat])) msgs.push({ key: "in:" + v.email, text: `${Family.nameFor(v.email, v.name)} is in your shooting sector` });
      if (pos) {
        const others = new Map(), nameOf = (e) => Family.nameFor(e);
        for (const [sid, email] of this.sitting()) if (email !== me) others.set(sid, nameOf(email));   // checked in now
        if (Day.active()) for (const [email, sid] of Object.entries(Day.doc.assign || {})) {
          if (!sid || email === me || others.has(sid)) continue;
          others.set(sid, nameOf(email));
        }
        for (const [sid, name] of others) {
          const st = Store.data.stands.find((x) => x.id === sid);
          if (st && st.id !== (mine && mine.id) && this.inSector(st, pos.ll)) msgs.push({ key: "me:" + sid, text: `You're in ${name}'s shooting sector` });
        }
      }
      const banner = $("#safety");
      banner.hidden = !msgs.length;
      banner.textContent = msgs.map((m) => tr(m.text)).join(" · ");
      for (const m of msgs) {
        const t = this.last.get(m.key) || 0;
        if (Date.now() - t > 60000) { this.last.set(m.key, Date.now()); try { navigator.vibrate && navigator.vibrate([500, 200, 500]); } catch { /* none */ } }
      }
    },
  };

  // ---------- background tracking with OwnTracks (positions while the phone is locked) ----------
  // OwnTracks posts to the family's Apps Script receiver (tools/owntracks), which writes positions/ot_<email>.
  // The receiver's address lives in map/config (the owner sets it); each person's code in ottokens/<email>,
  // which only they can read (made here on first use, never replaced: OwnTracks keeps the address it was given).
  const OT = {
    url: "", code: "", codeLoaded: false,
    start(db) {
      db.doc("map/config").onSnapshot((snap) => { this.url = (snap.exists && snap.data().otUrl) || ""; this.render(); }, () => {});
      db.doc(`ottokens/${this.me()}`).onSnapshot((snap) => {
        if (snap.metadata && snap.metadata.fromCache && !snap.exists) return;   // wait for the server before deciding there's no code
        this.code = (snap.exists && snap.data().code) || ""; this.codeLoaded = true; this.render();
      }, () => {});
    },
    me() { return Family.user ? Family.user.email.toLowerCase() : ""; },
    async ensureToken() {
      if (!this.url || !this.me() || !this.codeLoaded || this.code || this.making) return;
      this.making = true;
      // an older version kept everyone's codes in one shared record: carry mine over so OwnTracks keeps working
      const old = await window.FB.db.doc("map/ot_tokens").get().catch(() => null);
      let tok = old && old.exists ? old.data()[this.me()] || "" : "";
      if (!tok) {
        const a = new Uint8Array(15); crypto.getRandomValues(a);
        tok = btoa(String.fromCharCode(...a)).replace(/[^A-Za-z0-9]/g, "").slice(0, 18);
      }
      // re-read first: another of my devices may have made one a moment ago
      const cur = await window.FB.db.doc(`ottokens/${this.me()}`).get().catch(() => null);
      if (!(cur && cur.exists && cur.data().code)) await window.FB.db.doc(`ottokens/${this.me()}`).set({ code: tok }).catch(() => {});
      this.making = false;
    },
    personalUrl() {
      const t = this.code; if (!this.url || !t) return "";
      return `${this.url}${this.url.includes("?") ? "&" : "?"}u=${encodeURIComponent(this.me())}&k=${t}`;
    },
    render() {
      const box = $("#otBox"); if (!box || !Family.user) return;
      const owner = Family.member && Family.member.role === "owner";
      if (!this.url) {
        box.innerHTML = owner
          ? `<p class="note small">Set up the receiver and the forwarder once (see tools/owntracks/SETUP.md), then paste the forwarder address here.</p>
             <div class="row gap"><input id="otUrlIn" placeholder="https://alnaryd-owntracks.….workers.dev" autocomplete="off"><button class="btn" type="button" data-ot="save">Save</button></div>`
          : `<p class="note small">The map owner needs to set up the receiver first.</p>`;
        return;
      }
      this.ensureToken();
      const url = this.personalUrl();
      // what has actually arrived from my phone's OwnTracks (shown whether or not the map itself is sharing)
      const v = Family.otMine, age = v ? Family.ageMin(v) : null;
      const last = v && age !== null
        ? `<p class="ot-last ok"><span>Last position from your OwnTracks:</span> ${new Date(Family.posTime(v)).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} <span>(${age < 1 ? "now" : age < 60 ? age + " min ago" : Math.round(age / 60) + " h ago"})</span>${typeof v.batt === "number" ? ` · 🔋${v.batt}%` : ""}${OT_MODES[v.mode] ? ` · <b translate="no">${OT_MODES[v.mode]}</b>` : ""}</p>`
        : `<p class="ot-last"><span>Nothing has arrived from your OwnTracks yet.</span></p>`;
      box.innerHTML = url ? last + `<ol class="ot-steps">
          <li><span>Install</span> <b translate="no">OwnTracks</b> <span>from the App Store (free).</span></li>
          <li><button class="btn primary small" type="button" data-ot="copy">Copy my address</button> <span>Your own address with your personal code. Don't share it.</span></li>
          <li><span>In OwnTracks, tap Settings:</span><ul>
            <li><b translate="no">Mode</b>: <b translate="no">HTTP</b></li>
            <li><b translate="no">URL</b>: <span>paste your address</span></li></ul></li>
          <li><span>Further down in Settings, under Expert Mode:</span><ul>
            <li><b translate="no">locatorDisplacement</b>: 15</li>
            <li><b translate="no">locatorInterval</b>: 60</li></ul></li>
          <li><span>Settings → Remote Control: turn on</span> <b translate="no">cmd</b> <span>and</span> <b translate="no">remote configuration</b>. <span>Then OwnTracks switches between Move and battery-saving by itself.</span></li>
          <li><span>iPhone settings → OwnTracks → Location:</span> <b>Always</b>, <span>and Precise Location on. Also: General → Background App Refresh → OwnTracks on.</span></li>
          <li><span>Within a minute the line above turns green. Done.</span></li>
        </ol>
        <h3 class="ot-h">Every hunt</h3>
        <p class="note small"><span>When you leave for the hunt: set OwnTracks to</span> <b translate="no">Significant</b>. <span>It switches to</span> <b translate="no">Move</b> <span>by itself at the hunting ground or when a hunt day starts.</span><br>
          <span>When you're home again: set it to</span> <b translate="no">Quiet</b> <span>(nothing is shared). Switch at home, not at the hunting ground, or you'll look like you're still there.</span><br>
          <span>Don't swipe OwnTracks away, and avoid Low Power Mode during the hunt.</span></p>
        ${owner ? `<p class="note small"><button class="btn small ghost" type="button" data-ot="reset">Change receiver address</button></p>` : ""}`
        : `<p class="note small">Making your personal code…</p>`;
    },
  };

  // ---------- phone notifications (the free ntfy app) ----------
  // Each person subscribes in the ntfy app to their own secret channel (kept in map/ntfy, readable only by
  // members). A hunt message is sent straight from the map to everyone else's channel, so your own phone stays
  // quiet. ntfy.sh is a free outside service: only the short message text passes through it.
  const PUSH_TYPES = ["shot", "down", "help", "animal", "sound"];   // starting and ending a hunt day only show in the map, no notification
  const NTFY = "https://ntfy.sh/";
  const NTFY_LOOK = { shot: [4, "boom"], down: [4, "white_check_mark"], help: [5, "rotating_light"], animal: [4, "deer"], sound: [3, "ear"],
    daystart: [3, "evergreen_tree"], dayend: [3, "checkered_flag"] };
  const Ntfy = {
    topics: {}, loaded: false,
    start(db) {
      db.doc("map/ntfy").onSnapshot((snap) => {
        if (snap.metadata && snap.metadata.fromCache && !snap.exists) return;
        this.topics = (snap.exists && snap.data()) || {}; this.loaded = true;
        if (!this.mine()) this.make();
        this.render();
      }, () => {});
    },
    me() { return Family.user ? Family.user.email.toLowerCase() : ""; },
    mine() { return this.topics[this.me()] || ""; },
    async make() {   // my own channel, made once: a long random name nobody can guess
      if (this.making || !this.me()) return;
      this.making = true;
      const a = new Uint8Array(15); crypto.getRandomValues(a);
      const topic = "alnaryd-" + [...a].map((x) => (x % 36).toString(36)).join("");
      await window.FB.db.doc("map/ntfy").update({ [this.me()]: topic }).catch(() => {});
      this.making = false;
    },
    async publish(topic, msg) {
      for (let i = 0; i < 4; i++) {   // weak signal in the forest: try again a few times
        try { const r = await fetch(NTFY, { method: "POST", body: JSON.stringify({ topic, ...msg }) }); if (r.ok) return true; }
        catch { /* offline */ }
        await new Promise((r) => setTimeout(r, 20000));
      }
      return false;
    },
    // Short enough to read on a locked phone: the name in bold, then what happened, where, and how far from you.
    //   Pappa
    //   Skott mot NO · vid Järntornet · 350 m SV om dig · 05:25
    announce(id, e) {
      if (!PUSH_TYPES.includes(e.type)) return;
      const t = new Date(e.tc).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      const [priority, tag] = NTFY_LOOK[e.type];
      const dir = typeof e.heading === "number" ? Geo.compassName(e.heading) : "";
      const what = { shot: dir ? `Shot fired toward ${dir}` : "Shot fired", down: "Animal down", help: "Need help!",
        animal: Array.isArray(e.from) ? `Animal ${Math.round(Geo.distance(e.from, [e.lon, e.lat]) / 10) * 10} m ${Geo.compassName(Geo.bearing(e.from, [e.lon, e.lat]))} of me`
          : dir ? `Animal near me toward ${dir}` : "Animal near me",
        sound: Array.isArray(e.from) ? `Heard a sound ${Math.round(Geo.distance(e.from, [e.lon, e.lat]) / 10) * 10} m ${Geo.compassName(Geo.bearing(e.from, [e.lon, e.lat]))} of me` : "Heard a sound",
        daystart: "Started the hunt day", dayend: "The hunt is over" }[e.type];
      const at = e.standName ? `at ${e.standName}` : "";
      for (const [email, topic] of Object.entries(this.topics)) {
        if (email === this.me() || !topic) continue;
        // how far and which way from the person reading it, when we know where they are
        let far = "";
        const w = typeof e.lon === "number" && Family.whereIs(email);
        if (w && w.ll) {
          const d = Geo.distance(w.ll, [e.lon, e.lat]), b = Geo.compassName(Geo.bearing(w.ll, [e.lon, e.lat]));
          far = d < 1000 ? `${Math.round(d / 10) * 10} m ${b} of you` : `${(d / 1000).toFixed(1)} km ${b} of you`;
        }
        const message = [what, at, far, t].filter(Boolean).map((x) => tr(x)).join(" · ");
        this.publish(topic, { title: Family.nameFor(e.email, e.name), message, priority, tags: [tag],
          click: `${location.origin}${location.pathname}?ev=${encodeURIComponent(id)}` });
      }
    },
    async test() {
      const ok = await this.publish(this.mine(), { title: tr("Test from the hunting map"), message: tr("Notifications work on this phone."), tags: ["evergreen_tree"] });
      toast(ok ? "Test sent. It should arrive in a few seconds." : "Couldn't reach ntfy. Check your connection.");
    },
    render() {
      const box = $("#pushBox"); if (!box || !Family.user) return;
      const topic = this.mine();
      if (!topic) { box.innerHTML = `<p class="note small">Making your channel…</p>`; return; }
      const others = Family.members.filter((m) => m.email !== this.me()).map((m) => `${esc(m.name || m.email.split("@")[0])} ${this.topics[m.email] ? "✓" : "–"}`).join(" · ");
      box.innerHTML = `<ol class="ot-steps">
          <li>Install the free app <b>ntfy</b>: <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">App Store</a> (Android: Google Play).</li>
          <li><button class="btn primary small" type="button" data-push="copy">Copy my channel</button> In ntfy tap <b>+</b>, paste it as the topic and tap Subscribe. Allow notifications when asked.</li>
          <li><button class="btn small" type="button" data-push="test">Send a test</button> It should buzz within a few seconds.</li>
        </ol>
        <p class="note small">Your channel: <code translate="no">${esc(topic)}</code></p>
        <p class="note small">Only for you; you won't get your own messages.</p>
        ${others ? `<p class="note small">${esc(tr("Has a channel:"))} ${others}</p>` : ""}`;
    },
    async copy() {
      try { await navigator.clipboard.writeText(this.mine()); toast("Copied. Paste it in ntfy."); }
      catch { prompt(tr("Your channel:"), this.mine()); }
    },
  };

  // ---------- route planner: suggested ways to walk to a stand ----------
  // Least-cost paths on the 5 m terrain grid. Walking cost per cell comes from the slope, the land (fields,
  // mires, regrowth, thickets, water) and gets much cheaper on our own trails and on tracks and paths. Three kinds:
  //   fast   the easiest way: least climbing and rough ground, trails and tracks where they help
  //   quiet  avoids loud ground: dry broadleaf litter, regrowth and dense undergrowth
  //   wind   keeps your scent out of the stand's sector in the current wind, and doesn't cross the sector itself
  // A suggestion that comes out almost the same as an earlier one is replaced by a clearly different way.
  const Router = {
    base: null, quiet: null, grid: null,
    build() {
      const g = window.TerrainWind && window.TerrainWind.slopes[0];
      if (!g) return false;
      const inf = info && info.find((x) => x.origin[0] === g.origin[0] && x.origin[1] === g.origin[1] && x.cell === g.cell);
      const W = g.width, H = g.height, n = W * H, base = new Float32Array(n), quiet = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const sl = g.slope[i];
        let c = 1 + (sl / 12) ** 2 + (sl > 35 ? 25 : 0), q = 0;
        if (inf) {
          const code = inf.codes[inf.px[i * 4] - 1], th = inf.px[i * 4 + 2] / 2.5;
          if (code === 61 || code === 62) c = 1e4;
          else if (code === 51 || code === 52) c += 30;
          else if (code === 3) c *= 1.15;
          else if (code >= 200 && code < 300) c *= 2.2;
          else if (code === 118 || code === 128) { c *= 2; q += 0.7; }
          if (code >= 121 && code <= 128) c += 0.3;
          if ([115, 116, 117, 125, 126, 127].includes(code)) q += 0.6;
          else if (code === 111 || code === 121) q += 0.2;
          c *= 1 + th / 60; q += th / 120;
        }
        base[i] = c; quiet[i] = q;
      }
      // trails and tracks: cheap, and quiet underfoot
      const burn = (coords, cost) => {
        for (let k = 1; k < coords.length; k++) {
          const a = Geo.toSweref(...coords[k - 1]), b = Geo.toSweref(...coords[k]), L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.ceil(L / 2.5) + 1;
          for (let t = 0; t <= steps; t++) {
            const E = a[0] + (b[0] - a[0]) * t / steps, N = a[1] + (b[1] - a[1]) * t / steps;
            const c = Math.floor((E - g.origin[0]) / g.cell), r = Math.floor((g.origin[1] - N) / g.cell);
            if (c < 0 || r < 0 || c >= W || r >= H) continue;
            const i = r * W + c; if (base[i] < 1e3) { base[i] = Math.min(base[i], cost); quiet[i] = 0; }
          }
        }
      };
      for (const f of vectors.osm || []) {
        const kind = f.properties && f.properties.kind;
        if (f.geometry.type !== "LineString" || !["track", "path", "road", "road_minor", "road_major"].includes(kind)) continue;
        burn(f.geometry.coordinates, kind === "track" || kind === "path" ? 0.4 : 0.5);
      }
      for (const t of Store.data.trails) burn(pairs(t.pts), 0.35);
      this.grid = g; this.base = base; this.quiet = quiet;
      return true;
    },
    cell(ll) {
      const g = this.grid, [E, N] = Geo.toSweref(ll[0], ll[1]);
      const c = Math.floor((E - g.origin[0]) / g.cell), r = Math.floor((g.origin[1] - N) / g.cell);
      return c < 0 || r < 0 || c >= g.width || r >= g.height ? -1 : r * g.width + c;
    },
    // extra cost for the scent-safe kind: cells whose scent drifts into the stand's sector, and the sector itself
    windCost(st) {
      const g = this.grid, W = g.width, H = g.height, out = new Float32Array(W * H);
      if (typeof st.facing !== "number") return out;   // a spot placed on the map has no shooting direction
      const [sE, sN] = Geo.toSweref(st.lon, st.lat), down = ((localFrom(st.lon, st.lat) + 180) % 360) * Math.PI / 180;
      const dx = Math.sin(down), dy = Math.cos(down), face = (st.facing || 0) * Math.PI / 180, half = ((st.width || 90) / 2 + 10) * Math.PI / 180;
      const inSec = (E, N) => {
        const ex = E - sE, ny = N - sN, d = Math.hypot(ex, ny); if (d < 25 || d > 250) return false;
        let a = Math.atan2(ex, ny) - face; a = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(a) <= half;
      };
      for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
        const E = g.origin[0] + (c + 0.5) * g.cell, N = g.origin[1] - (r + 0.5) * g.cell;
        let x = 0;
        if (inSec(E, N)) x += 4;
        for (const t of [40, 90, 150]) if (inSec(E + dx * t, N + dy * t)) { x += 3; break; }
        out[r * W + c] = x;
      }
      return out;
    },
    // Dijkstra on 8 neighbours from cell a to cell b with cost per cell cost(i)
    path(a, b, cost) {
      const g = this.grid, W = g.width, H = g.height, n = W * H;
      const dist = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
      const heap = [[0, a]]; dist[a] = 0;
      const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0;
        for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
      const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
      while (heap.length) {
        const [d, i] = pop(); if (done[i]) continue; done[i] = 1; if (i === b) break;
        const x = i % W, y = (i - x) / W, ci = cost(i);
        for (const [ox, oy, f] of NB) {
          const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx; if (done[j]) continue;
          const nd = d + (ci + cost(j)) / 2 * f * g.cell;
          if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); }
        }
      }
      if (prev[b] < 0 && a !== b) return null;
      const cells = []; for (let i = b; i >= 0; i = prev[i]) { cells.push(i); if (i === a) break; }
      return cells.reverse();
    },
    toCoords(cells, from, to) {
      const g = this.grid, W = g.width;
      const pts = cells.map((i) => { const c = i % W, r = (i - c) / W; return Geo.fromSweref(g.origin[0] + (c + 0.5) * g.cell, g.origin[1] - (r + 0.5) * g.cell); });
      pts[0] = from; pts[pts.length - 1] = to;
      // smooth the staircase a little and drop points that add nothing
      const sm = pts.map((p, i) => i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4]);
      return simplifyLine(sm, 2.5);
    },
    // up to three suggestions from `from` to stand `st`: [{ kind, coords, len, overlap }]
    suggest(from, st) {
      if (!this.base && !this.build()) return null;
      const a = this.cell(from), b = this.cell([st.lon, st.lat]);
      if (a < 0 || b < 0) return null;
      const base = this.base, quiet = this.quiet, wind = this.windCost(st), used = new Float32Array(base.length);
      const kinds = [["fast", (i) => base[i]], ["quiet", (i) => base[i] + 1.6 * quiet[i]], ["wind", (i) => base[i] + wind[i]]];
      const out = [];
      for (const [kind, cost] of kinds) {
        let cells = this.path(a, b, (i) => cost(i) + used[i]);
        if (!cells) continue;
        const same = (cs) => out.some((o) => { const set = new Set(o.cells); return cs.filter((i) => set.has(i)).length / cs.length > 0.8; });
        let label = kind;
        if (same(cells)) {   // nearly the same way: look for a clearly different one instead
          for (const o of out) for (const i of o.cells) for (const d of [0, 1, -1, this.grid.width, -this.grid.width]) if (used[i + d] !== undefined) used[i + d] += 4;
          const alt = this.path(a, b, (i) => cost(i) + used[i]);
          if (!alt || same(alt)) continue;
          cells = alt; label = "other";
        }
        const coords = this.toCoords(cells, from, [st.lon, st.lat]);
        let len = 0; for (let k = 1; k < coords.length; k++) len += Geo.distance(coords[k - 1], coords[k]);
        out.push({ kind: label, cells, coords, len });
      }
      return out;
    },
  };
  function simplifyLine(pts, tol) {   // Douglas-Peucker in metres
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const xy = pts.map((p) => Geo.toSweref(p[0], p[1]));
    const rec = (i, j) => {
      let best = -1, bd = tol; const [ax, ay] = xy[i], [bx, by] = xy[j], L = Math.hypot(bx - ax, by - ay) || 1;
      for (let k = i + 1; k < j; k++) { const d = Math.abs((bx - ax) * (ay - xy[k][1]) - (ax - xy[k][0]) * (by - ay)) / L; if (d > bd) { bd = d; best = k; } }
      if (best > 0) { keep[best] = 1; rec(i, best); rec(best, j); }
    };
    rec(0, pts.length - 1);
    return pts.filter((_, i) => keep[i]).map((p) => [+p[0].toFixed(6), +p[1].toFixed(6)]);
  }
  const ROUTE_LOOK = { fast: ["A", "#4dabf7", "Easiest"], quiet: ["B", "#51cf66", "Quietest"], wind: ["C", "#b197fc", "Scent-safe"], other: ["D", "#ffa94d", "Another way"],
    via: ["V", "#ffd43b", "Via the chosen road"] };
  // where a walk to a stand starts: the parking or an entrance nearest the stand, or any named place, or where they are
  function routeStarts(email, st) {
    const out = [];
    const places = Store.data.places.slice().sort((p, q) => Geo.distance([p.lon, p.lat], [st.lon, st.lat]) - Geo.distance([q.lon, q.lat], [st.lon, st.lat]));
    const entry = places.filter((p) => /parker|ingång|grind|bil|start|väg/i.test(p.name || ""));
    for (const p of [...entry, ...places.filter((p) => !entry.includes(p))]) out.push({ id: "p:" + p.id, name: p.name || "Place", ll: [p.lon, p.lat] });
    const w = Family.whereIs(email);
    if (w && w.ll) out.unshift({ id: "here", name: tr(`Where ${Family.nameFor(email)} is now`), ll: w.ll });
    return out;
  }
  // the chooser in the hunt-day card: one person at a time
  const RoutePick = {
    email: null, start: null, opts: [], sel: -1,
    custom: null,
    open(email, startId) {
      const st = Day.placeOf(email);
      if (!st) return;
      if (this.custom && this.custom.email !== email) this.custom = null;
      const starts = routeStarts(email, st);
      if (this.custom) starts.unshift(this.custom);
      if (!starts.length) { toast("Add a place first (e.g. Parkering) to start the walk from."); return; }
      this.email = email; this.start = starts.find((x) => x.id === startId) || (startId === undefined && starts.find((x) => x.id !== "here")) || starts[0];
      this.opts = Router.suggest(this.start.ll, st) || [];
      this.sel = -1;
      if (!this.opts.length) toast("Couldn't find a way there from that start.");
      this.draw();
      const all = this.opts.flatMap((o) => o.coords);
      if (all.length) {
        const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
        const bottom = isPhone() ? Math.round(innerHeight - $("#panel").getBoundingClientRect().top) + 20 : 60;
        map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 90, left: 40, right: 70, bottom }, maxZoom: 17 });
      }
      Day.render();
    },
    draw() {
      const src = map.getSource("routeopts"); if (!src) return;
      src.setData(FC(this.opts.map((o, i) => { const [l, color] = ROUTE_LOOK[o.kind];
        return { type: "Feature", properties: { i, color, sel: i === this.sel, label: `${l} · ${Math.round(o.len)} m` }, geometry: { type: "LineString", coordinates: o.coords } }; })));
    },
    close(quiet) { this.email = null; this.opts = []; const src = map.getSource("routeopts"); if (src) src.setData(FC()); if (!quiet) Day.render(); },
    // the person will walk via a certain road or track: one tap on it, the way through there is saved
    pickVia() { this.pending = this.email; setTool("routeVia"); if (isPhone()) setSheet("peek"); },
    pickStart() { this.pending = this.email; setTool("routeFrom"); if (isPhone()) setSheet("peek"); },
    fromPoint(ll) {
      const email = this.pending || this.email; if (!email) return;
      this.custom = { id: "custom", name: tr("Chosen start"), ll, email };
      showTab("family", true); this.open(email, "custom");
    },
    via(ll) {
      const email = this.pending || this.email, st = email && Day.placeOf(email);
      if (!st || !this.start || (!Router.base && !Router.build())) return;
      // snap to the nearest trail, track or road within ~30 m (that's what they meant to walk on)
      const g = Router.grid, W = g.width;
      let v = Router.cell(ll), best = Infinity;
      if (v >= 0) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const c = (v % W) + dx, r = Math.floor(v / W) + dy, i = r * W + c;
        if (c < 0 || r < 0 || c >= W || r >= g.height || Router.base[i] > 0.5) continue;
        const d = dx * dx + dy * dy; if (d < best) { best = d; v = i; }
      }
      const a = Router.cell(this.start.ll), b = Router.cell([st.lon, st.lat]);
      if (a < 0 || b < 0 || v < 0) return;
      const cost = (i) => Router.base[i], p1 = Router.path(a, v, cost), p2 = Router.path(v, b, cost);
      if (!p1 || !p2) { toast("Couldn't find a way there from that start."); return; }
      const cells = [...p1, ...p2.slice(1)], coords = Router.toCoords(cells, this.start.ll, [st.lon, st.lat]);
      let len = 0; for (let k = 1; k < coords.length; k++) len += Geo.distance(coords[k - 1], coords[k]);
      this.email = email; this.opts.push({ kind: "via", cells, coords, len });
      showTab("family", true);
      this.choose(this.opts.length - 1);
    },
    async choose(i) {
      const o = this.opts[i], email = this.email; if (!o) return;
      this.sel = i; this.draw();
      // not awaited: offline the save waits for signal, but shows on this phone right away
      const pl = Day.placeOf(email) || {};
      window.FB.db.doc("map/huntday").update({ routes: { [email]: { pts: o.coords.flat(), len: Math.round(o.len), kind: o.kind, from: this.start.name, stand: (Day.doc.assign || {})[email] || "", at: [pl.lon, pl.lat] } } })
        .catch(() => toast("Couldn't save. Check your connection."));
      toast(tr(`Route saved for ${Family.nameFor(email)}`));
      this.close();
    },
    html(email) {
      if (this.email !== email) return "";
      const starts = routeStarts(email, Day.placeOf(email) || {}); if (this.custom && this.custom.email === email) starts.unshift(this.custom);
      const startOpts = starts.map((s) => `<option value="${esc(s.id)}"${s.id === this.start.id ? " selected" : ""}>${esc(s.name)}</option>`).join("")
        + `<option value="__pick">📍 ${esc(tr("Tap the start on the map…"))}</option>`;
      return `<div class="route-pick">
          <label class="route-from"><span>From</span> <select data-route-from="${esc(email)}">${startOpts}</select></label>
          <div class="route-opts">${this.opts.map((o, i) => { const [l, color, name] = ROUTE_LOOK[o.kind];
            return `<button type="button" class="btn small route-opt" data-route-pick="${i}" style="--rc:${color}"><b>${l}</b> <span>${esc(tr(name))}</span> · ${Math.round(o.len)} m</button>`; }).join("")}</div>
          <button type="button" class="btn small route-via" data-route-via>↪ ${esc(tr("Via a road or track…"))}</button>
          <p class="note small">Tap the way ${esc(Family.nameFor(email))} says they will walk. The lines are on the map.</p>
          <div class="row gap"><button type="button" class="btn small ghost" data-route-none="${esc(email)}">No route</button><button type="button" class="btn small ghost" data-route-close>Close</button></div>
        </div>`;
    },
  };
  // everyone's chosen way on a hunt day, in their colour
  function renderDayRoutes() {
    const src = map.getSource("dayroutes"); if (!src) return;
    const r = FAMILY && Day.active() && Day.doc.routes ? Day.doc.routes : {};
    const me = Family.user && Family.user.email.toLowerCase(), act = FAMILY && Day.active();
    const lines = Object.entries(r).filter(([email, v]) => v && v.pts && v.pts.length >= 4 && Day.placeOf(email) && email !== me)
      .map(([email, v]) => ({ type: "Feature", properties: { color: Family.colorFor(email) }, geometry: { type: "LineString", coordinates: pairs(v.pts) } }));
    const spots = act ? Object.entries(Day.doc.spots || {}).filter(([email, sp]) => sp && sp.length === 2 && !(Day.doc.assign || {})[email])
      .map(([email, sp]) => ({ type: "Feature", properties: { color: Family.colorFor(email), label: Family.nameFor(email) }, geometry: { type: "Point", coordinates: sp } })) : [];
    src.setData(FC([...lines, ...spots]));
  }

  // ---------- hunt day: leader, who sits where, start and end, summary ----------
  // Stored in map/huntday (the map collection is open to every member, so no new rules are needed);
  // finished days are kept as summaries in days/<start time>.
  const Day = {
    doc: null, past: [],
    start(db) {
      db.doc("map/huntday").onSnapshot((snap) => {
        const was = this.active();
        this.doc = snap.exists ? snap.data() : null;
        this.render(); syncMarkers(); Hunt.checkSafety(); renderGoto(); renderDayRoutes();
        if (!was && this.active() && this.myStand() && this.doc.leader !== Family.user.email.toLowerCase()) {
          const st = Store.data.stands.find((x) => x.id === this.myStand());
          if (st) toast(tr(`Your stand today: ${st.name || "Stand"}`), 7000);
        }
      }, () => {});
      db.collection("days").onSnapshot((snap) => {
        this.past = snap.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => b.started - a.started);
        this.render();
      }, () => {});
    },
    active() { return !!(this.doc && this.doc.active && Date.now() - (this.doc.started || 0) < 14 * 3600e3); },
    me() { return Family.user ? Family.user.email.toLowerCase() : ""; },
    myStand() { return this.active() ? (this.doc.assign || {})[this.me()] || null : null; },
    // a saved stand, or a spot the leader tapped on the map: { lon, lat, name, (facing, width) }
    placeOf(email) {
      if (!this.doc) return null;
      const sid = (this.doc.assign || {})[email], st = sid && Store.data.stands.find((x) => x.id === sid);
      if (st) return st;
      const sp = (this.doc.spots || {})[email];
      return sp && sp.length === 2 ? { id: "", lon: sp[0], lat: sp[1], name: tr(`${Family.nameFor(email)}'s stand`) } : null;
    },
    myPlace() { return this.active() ? this.placeOf(this.me()) : null; },
    spotFor: null,
    startSpot(email) {
      this.spotFor = email; RoutePick.close(true);
      setTool("daySpot");
      if (isPhone()) setSheet("peek");
    },
    setSpot(email, ll) {
      const at = [+ll[0].toFixed(6), +ll[1].toFixed(6)];
      window.FB.db.doc("map/huntday").update({ spots: { [email]: at }, assign: { [email]: "" }, routes: { [email]: null } }).catch(() => toast("Couldn't save. Check your connection."));
      setTimeout(() => { showTab("family", true); RoutePick.open(email); }, 250);   // straight on to the way there
    },
    whoOn(standId) {
      if (!this.active()) return null;
      for (const [email, sid] of Object.entries(this.doc.assign || {})) if (sid === standId) return email;
      return null;
    },
    canLead() { return this.active() && (this.doc.leader === this.me() || (Family.member && Family.member.role === "owner")); },
    // Start from last time's stands and routes (the same people usually sit the same stands), then whoever is
    // already checked in; the leader only changes what differs today.
    async begin() {
      const prev = this.doc || {}, members = new Set(Family.members.map((m) => m.email)), stands = new Set(Store.data.stands.map((s) => s.id));
      let last = prev.lastAssign || {};
      if (!Object.keys(last).length && this.past.length) {   // older days kept only names: match them back
        last = {};
        for (const x of this.past[0].sat || []) {
          const m = Family.members.find((mm) => [mm.name, Family.nameFor(mm.email), mm.email.split("@")[0]].includes(x.name));
          const st = Store.data.stands.find((s) => (s.name || "?") === x.stand);
          if (m && st) last[m.email] = st.id;
        }
      }
      const assign = {}, routes = {}, spots = {};
      for (const [email, sid] of Object.entries(last)) if (sid && members.has(email) && stands.has(sid)) {
        assign[email] = sid;
        const r = (prev.lastRoutes || {})[email]; if (r && r.stand === sid) routes[email] = r;
      }
      for (const [email, sp] of Object.entries(prev.lastSpots || {})) if (sp && sp.length === 2 && members.has(email) && !assign[email]) {
        spots[email] = sp;
        const r = (prev.lastRoutes || {})[email]; if (r && !r.stand && r.at && Geo.distance(r.at, sp) < 5) routes[email] = r;
      }
      for (const [sid, email] of Hunt.sitting()) { if (assign[email] !== sid) delete routes[email]; assign[email] = sid; }   // already sitting
      window.FB.db.doc("map/huntday").set({ active: true, started: Date.now(), leader: this.me(),
        leaderName: (Family.member && Family.member.name) || this.me().split("@")[0], assign, spots, routes, wind: `${dir8(prefs.wind.from)} ${prefs.wind.speed} m/s` })
        .catch(() => toast("Couldn't save. Check your connection."));
      if (Object.keys(assign).length || Object.keys(spots).length) toast("Stands from last time are filled in. Change what differs today.", 6000);
      Hunt.post("daystart");
      showTab("family", true);
    },
    async assign(email, standId) {
      // a new stand means the old route no longer fits
      window.FB.db.doc("map/huntday").update({ assign: { [email]: standId || "" }, spots: { [email]: null }, routes: { [email]: null } }).catch(() => toast("Couldn't save. Check your connection."));
      if (standId && this.canLead()) setTimeout(() => RoutePick.open(email), 200);   // straight on to choosing the way there
    },
    async end() {
      const d = this.doc; if (!d) return;
      const since = d.started || 0, name = (e) => { const m = Family.members.find((x) => x.email === e); return (m && m.name) || e.split("@")[0]; };
      const ev = Hunt.events.filter((e) => e.tc >= since);
      const summary = {
        started: since, ended: Date.now(), leaderName: d.leaderName || "", wind: d.wind || "",
        sat: Family.members.map((m) => [m.email, this.placeOf(m.email)]).filter(([, pl]) => pl).map(([e, pl]) => ({ name: name(e), stand: pl.name || "?" })),
        shots: ev.filter((e) => e.type === "shot").map((e) => ({ name: e.name, t: e.tc, dir: typeof e.heading === "number" ? Geo.compassName(e.heading) : "" })),
        downs: ev.filter((e) => e.type === "down").map((e) => ({ name: e.name, t: e.tc })),
        tracks: Store.data.tracks.filter((t) => (t.start || 0) >= since).map((t) => ({ name: name(t.by || ""), kind: t.kind, len: trackLen(t.pts || []) })),
      };
      await window.FB.db.doc(`days/${since}`).set(summary).catch(() => {});
      // keep who sat where (and their routes) for next time
      const lastRoutes = {};
      for (const [email, r] of Object.entries(d.routes || {})) if (r && this.placeOf(email)) lastRoutes[email] = { ...r, stand: (d.assign || {})[email] || "" };
      await window.FB.db.doc("map/huntday").set({ active: false, ended: Date.now(), lastAssign: d.assign || {}, lastSpots: d.spots || {}, lastRoutes }).catch(() => toast("Couldn't save. Check your connection."));
      Hunt.post("dayend");
    },
    render() {
      const card = $("#dayCard"); if (!card) return;
      const hm = (t) => new Date(t).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      const stands = Store.data.stands.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));
      let h = "";
      if (this.active()) {
        const d = this.doc, lead = this.canLead();
        h += `<h2 class="eyebrow">Hunt day in progress</h2><p class="note small"><span>Since</span> ${hm(d.started)} · <span>leader</span> ${esc(d.leaderName || "")}</p>`;
        h += `<ul class="items day-assign">` + Family.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv")).map((m) => {
          const cur = (d.assign || {})[m.email] || "", spot = !cur && (d.spots || {})[m.email], place = this.placeOf(m.email);
          const opts = `<option value="">${esc(tr("Choose stand"))}</option>` + stands.map((st) => `<option value="${esc(st.id)}"${st.id === cur ? " selected" : ""}>${esc(st.name || "Stand")}</option>`).join("")
            + (spot ? `<option value="__spot" selected>📍 ${esc(tr("Placed on the map"))}</option>` : "") + `<option value="__place">📍 ${esc(tr("Place on the map…"))}</option>`;
          const rt = (d.routes || {})[m.email], hasRoute = place && rt && rt.pts;
          return `<li><span class="fam-dot" style="background:${Family.colorFor(m.email)}" translate="no">${esc(Family.letterFor(m.email, m.name))}</span>
            <span class="it-main"><div class="it-name">${esc(Family.nameFor(m.email, m.name))}</div>
              <div class="it-sub">${place ? (hasRoute ? esc(tr(`Walks from ${rt.from || "?"}, ${rt.len} m`)) : esc(tr("No route yet"))) : esc(tr("No stand yet"))}</div></span>
            ${lead ? (stands.length ? `<select data-assign="${esc(m.email)}" aria-label="Stand">${opts}</select>` : "")
                + `<button type="button" class="btn small${place ? " ghost" : " primary"}" data-spot="${esc(m.email)}">📍 <span>${place ? "Move" : "Place stand"}</span></button>`
                + (place ? `<button type="button" class="btn small ghost" data-route="${esc(m.email)}">${hasRoute ? "Change route" : "Route"}</button>` : "")
              : (place ? `<span class="day-place">${esc(place.name || "Stand")}</span>` : "")}
            ${RoutePick.html(m.email)}</li>`;
        }).join("") + `</ul>`;
        if (lead) h += `<button class="btn danger" type="button" data-day="end">End the hunt day</button>`;
      } else {
        h += `<h2 class="eyebrow">Hunt day</h2><p class="note small">Start a hunt day to give everyone a stand. Given stands count for the shooting-sector warning right away.</p>
          <button class="btn primary" type="button" data-day="start">Start hunt day</button>`;
      }
      if (this.past.length) {
        h += `<h2 class="eyebrow">Earlier hunt days</h2><ul class="items day-past">` + this.past.slice(0, 10).map((p) => {
          const day = new Date(p.started).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
          const lines = [
            p.sat && p.sat.length ? p.sat.map((x) => `${esc(x.name)}: ${esc(x.stand)}`).join(", ") : "",
            (p.shots || []).map((x) => `<span>Shot</span> ${hm(x.t)} ${esc(x.name)}${x.dir ? " → " + x.dir : ""}`).join("<br>"),
            (p.downs || []).map((x) => `<span>Animal down</span> ${hm(x.t)} ${esc(x.name)}`).join("<br>"),
            (p.tracks || []).map((x) => `<span>${x.kind === "search" ? "Blood tracking" : "Track"}</span> ${esc(x.name)} ${esc(x.len)}`).join("<br>"),
          ].filter(Boolean).join("<br>");
          return `<li><details><summary><b>${esc(day)}</b> ${hm(p.started)}–${hm(p.ended)} · ${(p.shots || []).length} <span>shots</span> · ${(p.downs || []).length} <span>down</span></summary>
            <div class="it-sub">${p.wind ? `<span>Wind</span> ${esc(p.wind)}<br>` : ""}${lines || ""}</div></details></li>`;
        }).join("") + `</ul>`;
      }
      card.innerHTML = h;
    },
  };
  // the stand you were given today: a chip on the map and a line from you to it
  function renderGoto() {
    const src = map.getSource("goto"), chip = $("#myStandChip");
    const st = FAMILY ? Day.myPlace() : null;
    if (!st) { chip.hidden = true; if (src) src.setData(FC()); return; }
    chip.hidden = false;
    const pos = myPos(), near = pos && Geo.distance(pos.ll, [st.lon, st.lat]);
    chip.textContent = tr(`Your stand: ${st.name || "Stand"}`) + (pos ? ` · ${Math.round(near)} m ${Geo.compassName(Geo.bearing(pos.ll, [st.lon, st.lat]))}` : "");
    chip.dataset.id = st.id;
    const rt = Day.doc && Day.doc.routes && Day.doc.routes[Family.user.email.toLowerCase()];
    if (rt && rt.pts && rt.pts.length >= 4) { if (src) src.setData(FC([{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pairs(rt.pts) } }])); return; }   // the agreed way
    if (src) src.setData(FC(pos && near > 30 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [pos.ll, [st.lon, st.lat]] } }] : []));
  }

  // ---------- family mode: sign-in, members and live positions (hosted site with Firebase) ----------
  const LOOK_COLORS = ["#1d7cf2", "#d6336c", "#2b8a3e", "#f08c00", "#7048e8", "#0c8599", "#c2255c", "#5c940d", "#e03131", "#495057", "#f5c518", "#ffffff"];
  // the mode OwnTracks reported (saved by the receiver): Move = a position every minute
  const OT_MODES = { 2: "Move", 1: "Significant", 0: "Manual", "-1": "Quiet" };
  const otMode = (v) => (v && typeof v.mode === "number" && OT_MODES[v.mode] ? ` (${OT_MODES[v.mode]})` : "");
  const FAMILY_COLORS = ["#1d7cf2", "#d6336c", "#2b8a3e", "#f08c00", "#7048e8", "#0c8599", "#c2255c", "#5c940d"];
  const Family = {
    ready: false, user: null, member: null, members: [], positions: new Map(), sharing: false, lastWrite: null,
    markers: new Map(), wakeLock: null, looks: {}, editing: null,

    colorFor(email) {  // chosen colour, else distinct colours in a stable order (by email) for everyone on the list
      const look = this.looks[email];
      if (look && /^#[0-9a-f]{6}$/i.test(look.color || "")) return look.color;
      const i = this.members.map((m) => m.email).sort().indexOf(email);
      if (i >= 0) return FAMILY_COLORS[i % FAMILY_COLORS.length];
      let h = 0; for (const c of email || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return FAMILY_COLORS[h % FAMILY_COLORS.length];
    },
    letterFor(email, name) {
      const look = this.looks[email];
      return (look && look.letter) || (this.nameFor(email, name) || "?").trim().charAt(0).toUpperCase();
    },
    // the name shown on the map: a short name anyone can set (e.g. just the first name), else the member's name
    nameFor(email, name) {
      const look = this.looks[email], m = this.members.find((x) => x.email === email);
      return (look && look.name) || (m && m.name) || name || (email || "").split("@")[0];
    },
    openLook(email) {
      const m = this.members.find((x) => x.email === email); if (!m) return;
      this.editing = email;
      const f = $("#lookForm");
      $("#lookName").textContent = m.name || email;
      $("#lookShort").value = (this.looks[email] && this.looks[email].name) || "";
      $("#lookShort").placeholder = m.name || email.split("@")[0];
      $("#lookLetter").value = (this.looks[email] && this.looks[email].letter) || "";
      $("#lookLetter").placeholder = this.letterFor(email, m.name);
      const cur = this.colorFor(email);
      $("#lookColors").innerHTML = LOOK_COLORS.map((c) => `<button type="button" class="swatch${c === cur ? " on" : ""}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join("");
      f.hidden = false; f.scrollIntoView({ block: "nearest" });
    },
    async saveLook() {
      const email = this.editing; if (!email) return;
      const letter = $("#lookLetter").value.trim().toUpperCase().slice(0, 2);
      const name = $("#lookShort").value.trim().slice(0, 20);
      const on = $("#lookColors .swatch.on"), color = on ? on.dataset.color : this.colorFor(email);
      $("#lookForm").hidden = true; this.editing = null;
      try { await window.FB.db.doc("map/looks").update({ [email]: { letter, color, name } }); }
      catch { toast("Couldn't save. Check your connection."); }
    },
    async init() {
      $("#gate").hidden = false; this.gate("loading");
      $("#tab-family").hidden = false; $(".tabs").classList.add("with-family");
      const FB = window.FB || await new Promise((r) => window.addEventListener("fb-ready", () => r(window.FB), { once: true }));
      FB.onAuth((user) => this.onUser(user));
    },
    async onUser(user) {
      this.user = user;
      if (!user) { this.ready = false; this.gate("signin"); return; }
      if (!user.emailVerified) { this.gate("verify"); return; }
      const email = user.email.toLowerCase(), ref = window.FB.db.doc(`members/${email}`);
      let m = null;
      try { const d = await ref.get(); m = d.exists ? d.data() : null; } catch { m = null; }
      if (!m) {
        // The owner (named in the security rules) creates their own entry on first sign-in; anyone else is refused.
        try { await ref.set({ name: user.displayName || email.split("@")[0], role: "owner", added: window.FB.serverTimestamp() }); m = (await ref.get()).data(); }
        catch { m = null; }
      }
      if (!m) { this.gate("noaccess"); return; }
      this.member = m;
      $("#gate").hidden = true;
      if (!this.ready) this.start();
      this.ready = true;
      this.render();
    },
    gate(view) {
      $("#gate").hidden = false;
      for (const v of ["loading", "signin", "verify", "noaccess"]) $("#gate-" + v).hidden = v !== view;
      $("#gate-msg").textContent = "";
      if (view === "verify") $("#gate-verifyEmail").textContent = this.user.email;
      if (view === "noaccess") $("#gate-noaccessEmail").textContent = this.user.email;
    },
    start() {
      const db = window.FB.db;
      Store.connect(db);
      db.collection("members").onSnapshot((snap) => {
        this.members = snap.docs.map((d) => ({ email: d.id, ...d.data() }));
        const me = this.members.find((x) => x.email === this.user.email.toLowerCase());
        if (me) this.member = me;
        this.render();
      }, () => {});
      db.collection("positions").onSnapshot((snap) => {
        const best = new Map(), me = this.user.email.toLowerCase();
        this.otMine = null;
        for (const d of snap.docs) {
          const v = d.data(), k = v.email || d.id, t = this.posTime(v), cur = best.get(k);
          if (v.src === "owntracks" && v.email === me) this.otMine = v;
          if (!cur || t > cur.t) best.set(k, { id: d.id, v, t });
        }
        // my own entry is keyed by my uid so the map never draws me as someone else
        this.positions = new Map([...best.values()].map(({ id, v }) => [v.email === me ? this.user.uid : id, v]));
        this.render();
        syncMarkers(); Hunt.checkSafety(); Rec.backfill(); OT.render(); renderMyCone(); renderGoto();
      }, () => {});
      Hunt.start(db); Day.start(db); OT.start(db);
      Hunt.showId = QS.get("ev") || null;   // opened from a notification
      Ntfy.start(db);
      db.doc("map/looks").onSnapshot((snap) => {
        this.looks = snap.exists ? snap.data() : {};
        this.render(); renderAll();
      }, () => {});
      setInterval(() => { this.render(); Hunt.render(); }, 30000);   // ages, fading dots and blinking pins
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible" || !this.sharing) return;
        this.requestWake();
        stopGPS(); startGPS();   // iPhones can pause GPS while the app is in the background
        this.lastWrite = null;
      });
      if (prefs.share) this.setSharing(true);
    },
    setSharing(on) {
      this.sharing = on; prefs.share = on; savePrefs();
      $("#shareMe").checked = on;
      if (on) {
        if (!startGPS()) { this.sharing = false; $("#shareMe").checked = false; return; }
        this.requestWake();
      } else {
        stopGPS();
        if (this.user) window.FB.db.doc(`positions/${this.user.uid}`).update({ sharing: false }).catch(() => {});
        if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
      }
      this.render();
    },
    async requestWake() {
      try { this.wakeLock = await navigator.wakeLock.request("screen"); } catch { this.wakeLock = null; }
    },
    onFix(p) {
      if (!this.sharing || !this.user) return;
      const now = Date.now(), ll = [p.coords.longitude, p.coords.latitude], L = this.lastWrite;
      if (L && now - L.t < 30000 && Geo.distance(L.ll, ll) < 10) return;
      this.lastWrite = { t: now, ll };
      window.FB.db.doc(`positions/${this.user.uid}`).set({
        name: (this.member && this.member.name) || this.user.displayName || this.user.email, email: this.user.email.toLowerCase(),
        lon: ll[0], lat: ll[1], acc: Math.round(p.coords.accuracy), t: window.FB.serverTimestamp(), tc: now, sharing: true,
      }).catch(() => {});
      this.render();
      Hunt.checkSafety();
    },
    posTime(v) { return (v.t && v.t.toMillis ? v.t.toMillis() : 0) || v.tc || 0; },
    // Is this person's position current? The map sends every few seconds while open, so a few minutes of silence
    // means it's closed. OwnTracks only sends after 15 m of movement, so silence means "sitting still": its
    // positions count as current for 2 hours (unless the battery is about to die).
    isCurrent(v, mapMinutes) {
      const age = this.ageMin(v);
      if (!v || !v.sharing || age === null) return false;
      if (v.src === "owntracks") return age < 120 && !(typeof v.batt === "number" && v.batt <= 3);
      return age < mapMinutes;
    },
    // a bad fix (inside a car, under thick canopy) can be 100 m off: don't let it raise safety alarms
    goodFix(v) { return !(typeof v.acc === "number" && v.acc > 50); },
    ageMin(pos) {
      const t = pos.t && pos.t.toMillis ? pos.t.toMillis() : pos.tc;
      return t ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
    },
    statusFor(email) {
      const pos = [...this.positions.entries()].find(([, v]) => v.email === email);
      const mine = this.user && email === this.user.email.toLowerCase();
      if (mine) {
        if (this.sharing) return myFix ? "You · sharing now" : "You · waiting for GPS…";
        const ot = this.positions.get(this.user.uid), oa = ot && ot.src === "owntracks" ? this.ageMin(ot) : null;
        const ob = (ot ? otMode(ot) : "") + (ot && typeof ot.batt === "number" ? ` · 🔋${ot.batt}%` : "");
        return oa === null ? "You · not sharing" : `You · OwnTracks · ${oa < 1 ? "now" : oa < 60 ? oa + " min ago" : Math.round(oa / 60) + " h ago"}${ob}`;
      }
      if (!pos) return "Hasn't shared yet";
      const [, v] = pos, age = this.ageMin(v);
      const here = myPos();
      const where = here ? ` · ${Math.round(Geo.distance(here.ll, [v.lon, v.lat]))} m ${Geo.compassName(Geo.bearing(here.ll, [v.lon, v.lat]))}` : "";
      const via = v.src === "owntracks" ? ` · OwnTracks${otMode(v)}` : "";
      const batt = typeof v.batt === "number" ? ` · 🔋${v.batt}%` : "";
      if (this.isCurrent(v, 10)) {
        const still = v.src === "owntracks" && age >= 3 ? `Still for ${age} min` : `Sharing · ${age ? age + " min ago" : "now"}`;
        return `${still}${where}${via}${batt}`;
      }
      return `Last seen ${age === null ? "" : age < 1 ? "just now" : age < 60 ? age + " min ago" : Math.round(age / 60) + " h ago"}${where}${batt}`;
    },
    render() {
      renderWho();
      if (!FAMILY || !this.user) return;
      const owner = this.member && this.member.role === "owner";
      $("#syncState").textContent = (this.member && this.member.name) || "Signed in";
      $("#syncState").dataset.state = "shared";
      $("#meInfo").textContent = `Signed in as ${this.user.email}.`;
      $("#memberForm").hidden = !owner; $("#ownerTools").hidden = !owner; $("#boundaryTools").hidden = !owner;
      $("#shareState").textContent = this.sharing
        ? (myFix ? "On. Your family sees you while this map is open. Keep the screen on." : "On. Waiting for GPS…")
        : "Off. Your family can't see you.";
      const list = this.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));
      $("#familyList").innerHTML = list.length ? list.map((m) => `<li data-email="${esc(m.email)}">
          <span class="fam-dot" style="background:${this.colorFor(m.email)}" translate="no">${esc(this.letterFor(m.email, m.name))}</span>
          <span class="it-main"><div class="it-name">${esc(this.nameFor(m.email, m.name))}${m.role === "owner" ? " · owner" : ""}</div>
          <div class="it-sub">${esc(this.statusFor(m.email))}</div></span>
          ${this.whereIs(m.email) ? `<button class="btn small ghost" type="button" data-coords="${esc(m.email)}">Coordinates</button>` : ""}
          <button class="btn small ghost" type="button" data-look="${esc(m.email)}">Edit</button>
          ${owner && m.role !== "owner" ? `<button class="btn small ghost" type="button" data-remove="${esc(m.email)}">Remove</button>` : ""}</li>`).join("")
        : `<li class="empty">Nobody added yet.</li>`;
      // markers for everyone else who has shared
      const keep = new Set();
      for (const [uid, v] of this.positions) {
        if (uid === this.user.uid || typeof v.lon !== "number") continue;
        const age = this.ageMin(v);
        if (age === null || age > 24 * 60) continue;
        keep.add(uid);
        let m = this.markers.get(uid);
        if (!m) {
          const el = document.createElement("div"); el.className = "fam-marker";
          el.innerHTML = `<b translate="no"></b><span></span>`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const cur = this.positions.get(uid) || v;
            map.easeTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 16) });
            new maplibregl.Popup({ closeButton: false, offset: 18 }).setLngLat(m.getLngLat())
              .setHTML(`<div class="pop"><b>${esc(this.nameFor(cur.email, cur.name))}</b><br>${cur.lat.toFixed(5)}, ${cur.lon.toFixed(5)}<br>` +
                `<button class="btn small primary" type="button" data-coords="${esc(cur.email)}">${esc(tr("Copy coordinates"))}</button></div>`).addTo(map);
          });
          m = new maplibregl.Marker({ element: el }).setLngLat([v.lon, v.lat]).addTo(map);
          this.markers.set(uid, m);
        }
        m.setLngLat([v.lon, v.lat]);
        const el = m.getElement(), live = this.isCurrent(v, 10);
        const low = typeof v.batt === "number" && v.batt <= 15;
        el.style.setProperty("--c", this.colorFor(v.email));
        el.classList.toggle("stale", !live);
        el.classList.toggle("batt-low", low);
        el.querySelector("b").textContent = this.letterFor(v.email, v.name);
        el.querySelector("span").textContent = `${this.nameFor(v.email, v.name)}${live ? (age && v.src !== "owntracks" ? ` · ${age} min` : "") : ` · ${age < 60 ? age + " min" : Math.round(age / 60) + " h"} ago`}${typeof v.batt === "number" ? ` · 🔋${v.batt}%` : ""}`;
        // warn once per person and day when their phone is about to die in the forest
        if (low && live) {
          const key = `${v.email}|${new Date().toDateString()}`;
          if (!this.battWarned) this.battWarned = new Set();
          if (!this.battWarned.has(key)) { this.battWarned.add(key); toast(tr(`${v.name || v.email}'s phone battery is low (${v.batt}%)`), 8000); }
        }
      }
      for (const [uid, m] of this.markers) if (!keep.has(uid)) { m.remove(); this.markers.delete(uid); }
      const ot = !myFix && this.otMine && this.isCurrent(this.otMine, 0) ? this.otMine : null;
      if (ot) {
        if (!this.meOt) {
          const el = document.createElement("div"); el.className = "fam-marker me-ot";
          el.innerHTML = `<b translate="no"></b><span></span>`;
          this.meOt = new maplibregl.Marker({ element: el }).setLngLat([ot.lon, ot.lat]).addTo(map);
        }
        this.meOt.setLngLat([ot.lon, ot.lat]);
        const el = this.meOt.getElement(), me = this.user.email.toLowerCase();
        el.style.setProperty("--c", this.colorFor(me));
        el.querySelector("b").textContent = this.letterFor(me, this.member && this.member.name);
        el.querySelector("span").textContent = tr("You (OwnTracks)") + (typeof ot.batt === "number" ? ` · 🔋${ot.batt}%` : "");
        el.classList.toggle("batt-low", typeof ot.batt === "number" && ot.batt <= 15);
      } else if (this.meOt) { this.meOt.remove(); this.meOt = null; }
    },
    // where someone is: their latest position (my own: the map's GPS or my OwnTracks)
    whereIs(email) {
      const me = this.user && email === this.user.email.toLowerCase();
      if (me) { const p = myPos(); return p ? { ll: p.ll, acc: p.acc, age: myFix ? 0 : this.ageMin(this.otMine) } : null; }
      const v = [...this.positions.values()].find((x) => x.email === email);
      return v && typeof v.lon === "number" ? { ll: [v.lon, v.lat], acc: v.acc, age: this.ageMin(v) } : null;
    },
    async copyCoords(email) {
      const w = this.whereIs(email);
      if (!w) { toast("No position for them yet."); return; }
      const m = this.members.find((x) => x.email === email), name = (m && m.name) || email.split("@")[0];
      const [lon, lat] = w.ll, [E, N] = Geo.toSweref(lon, lat);
      const age = w.age ? (w.age < 60 ? `${w.age} min` : `${Math.round(w.age / 60)} h`) : "";
      const text = `${name}: ${lat.toFixed(5)}, ${lon.toFixed(5)} (WGS84)\n` +
        `SWEREF 99 TM: N ${Math.round(N)} E ${Math.round(E)}${w.acc ? ` (±${Math.round(w.acc)} m)` : ""}\n` +
        `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}` + (age ? `\n${tr(`Position from ${age} ago`)}` : "");
      try { await navigator.clipboard.writeText(text); toast(tr(`Copied ${name}'s coordinates`)); }
      catch { prompt(tr("Coordinates:"), text.replace(/\n/g, " · ")); }
    },
    async addMember(name, email) {
      email = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("That email address doesn't look right."); return false; }
      try { await window.FB.db.doc(`members/${email}`).set({ name: name.trim() || email.split("@")[0], role: "member", added: window.FB.serverTimestamp() }); }
      catch { toast("Couldn't add them. Check your connection."); return false; }
      toast(`${name || email} can now sign in with ${email}.`, 5000);
      return true;
    },
    async importFile(file) {
      let d;
      try { d = JSON.parse(await file.text()); } catch { toast("That file isn't a map export."); return; }
      const items = [];
      for (const k of ["stands", "sightings", "routes", "trails", "places"]) {
        for (const it of d[k] || []) { const { id, ...body } = it; if (id) items.push({ path: `${k}/${id}`, body }); }
      }
      if (Array.isArray(d.boundary) && d.boundary.length >= 6) items.push({ path: "map/boundary", body: { pts: d.boundary } });
      try { await window.FB.db.batchSet(items); toast(`Imported ${items.length} items.`); }
      catch { toast("Import failed. Only the owner can import."); }
    },
  };

  function initFamilyUI() {
    if (!FAMILY) return;
    let mode = "signin";
    const setMode = (m) => {
      mode = m;
      $("#gate-nameRow").hidden = m !== "signup";
      $("#gate-submit").textContent = m === "signup" ? "Create account" : "Sign in";
      $("#gate-toggle").textContent = m === "signup" ? "I already have a password" : "First time? Create your password";
      $("#gate-pw").autocomplete = m === "signup" ? "new-password" : "current-password";
    };
    const msg = (t) => { $("#gate-msg").textContent = t; };
    const friendly = (e) => ({
      "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.",
      "auth/user-not-found": "No account with that email yet. Tap “First time?” to create one.",
      "auth/email-already-in-use": "That email already has an account. Sign in instead.",
      "auth/weak-password": "Use at least 6 characters.", "auth/invalid-email": "That email address doesn't look right.",
      "auth/too-many-requests": "Too many tries. Wait a minute and try again.", "auth/network-request-failed": "No connection. Try again when you have signal.",
    }[e && e.code] || "Something went wrong. Try again.");
    $("#gate-toggle").addEventListener("click", () => setMode(mode === "signup" ? "signin" : "signup"));
    $("#gate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#gate-email").value.trim(), pw = $("#gate-pw").value;
      $("#gate-submit").disabled = true; msg("");
      try {
        if (mode === "signup") await window.FB.signUp(email, pw, $("#gate-name").value.trim());
        else await window.FB.signIn(email, pw);
      } catch (err) { msg(friendly(err)); }
      $("#gate-submit").disabled = false;
    });
    $("#gate-forgot").addEventListener("click", async () => {
      const email = $("#gate-email").value.trim();
      if (!email) { msg("Type your email first, then tap “Forgot password?”."); return; }
      try { await window.FB.resetPassword(email); msg(`If ${email} has an account, a reset link is on its way.`); } catch (err) { msg(friendly(err)); }
    });
    $("#gate-verified").addEventListener("click", async () => {
      const u = await window.FB.reloadUser().catch(() => null);
      if (u && u.emailVerified) Family.onUser(u); else msg("Not verified yet. Open the link in the email, then tap Continue.");
    });
    $("#gate-resend").addEventListener("click", async () => { try { await window.FB.resendVerification(); msg("Sent again. Check spam too."); } catch (err) { msg(friendly(err)); } });
    $("#gate-retry").addEventListener("click", () => Family.onUser(window.FB.currentUser()));
    for (const b of $$(".gate-signout")) b.addEventListener("click", () => window.FB.signOut());
    $("#signOut").addEventListener("click", () => { Family.setSharing(false); window.FB.signOut(); });
    $("#shareMe").addEventListener("change", (e) => Family.setSharing(e.target.checked));
    $("#memberForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await Family.addMember($("#mf-name").value, $("#mf-email").value)) { $("#mf-name").value = ""; $("#mf-email").value = ""; }
    });
    document.addEventListener("click", (e) => {
      const c = e.target.closest("[data-coords]"); if (!c) return;
      e.stopPropagation(); Family.copyCoords(c.dataset.coords);
    }, true);
    $("#familyList").addEventListener("click", async (e) => {
      if (e.target.closest("[data-coords]")) return;
      const lk = e.target.closest("[data-look]");
      if (lk) { Family.openLook(lk.dataset.look); return; }
      const rm = e.target.closest("[data-remove]");
      if (rm) {
        if (rm.dataset.confirm !== "1") { rm.dataset.confirm = "1"; rm.textContent = "Confirm"; setTimeout(() => { rm.dataset.confirm = ""; rm.textContent = "Remove"; }, 3000); return; }
        await window.FB.db.doc(`members/${rm.dataset.remove}`).delete().catch(() => toast("Couldn't remove. Try again."));
        return;
      }
      const li = e.target.closest("li[data-email]"); if (!li) return;
      const pos = [...Family.positions.values()].find((v) => v.email === li.dataset.email);
      if (pos && typeof pos.lon === "number") map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 16) });
    });
    $("#lookColors").addEventListener("click", (e) => {
      const b = e.target.closest(".swatch"); if (!b) return;
      $$("#lookColors .swatch").forEach((x) => x.classList.toggle("on", x === b));
    });
    $("#lookForm").addEventListener("submit", (e) => { e.preventDefault(); Family.saveLook(); });
    $("#lookCancel").addEventListener("click", () => { $("#lookForm").hidden = true; Family.editing = null; });
    $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) Family.importFile(f); e.target.value = ""; });
    setMode("signin");
  }

  renderPosBtn();

  // back from a locked screen while recording: fill the gap from OwnTracks once its latest points have arrived
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Rec.on) setTimeout(() => Rec.backfill(), 2500); });
  window.addEventListener("offline", () => toast("No coverage. The map still works; positions and messages are sent when you're back online.", 6000));
  window.addEventListener("online", () => toast("Back online."));

  // ---------- boot ----------
  // ?shot=1 is a development switch for headless screenshots: in-memory sample data, no saving.
  const QS = new URLSearchParams(location.search);
  if (QS.has("shot")) {
    document.documentElement.classList.add("shot");
    Store.saveLocal = () => {};
    Store.connect = async () => {};
    if (QS.get("base")) prefs.base = QS.get("base");
    if (QS.get("tab")) prefs.tab = QS.get("tab");
    for (const k of (QS.get("ov") || "").split(",").filter(Boolean)) prefs.ov[k] = true;
    if (QS.has("demo")) {
      Store.data.stands = [
        { id: "d1", name: "Hyggestornet", type: "tower", height: 4, facing: 200, width: 100, range: 150, winds: [], notes: "", lon: 15.4352, lat: 56.3527 },
        { id: "d2", name: "Bäckpasset", type: "ground", height: 0, facing: 90, width: 120, range: 80, winds: [], notes: "", lon: 15.4318, lat: 56.3548 },
      ];
      Store.data.routes = [{ id: "r1", name: "Stalk route 1", pts: [15.4300, 56.3505, 15.4322, 56.3517, 15.4345, 56.3512, 15.4362, 56.3534] }];
      Store.data.sightings = [{ id: "g1", species: "moose", count: 2, kind: "seen", when: "2026-10-28T06:40:00Z", wind: "SW 3 m/s", notes: "", lon: 15.4335, lat: 56.3540 }];
      Store.data.boundary = [15.4290, 56.3500, 15.4385, 56.3498, 15.4392, 56.3560, 15.4335, 56.3575, 15.4288, 56.3545];
    }
    if (QS.has("seed")) {  // local-only copy of the team's real stands and boundary
      fetch(abs("data/_seed.json")).then((r) => r.json()).then((d) => { Store.data.stands = d.stands; Store.data.boundary = d.boundary; Store.onChange(); });
      Store.loadDefaultLayout();
    }
  } else if (!FAMILY) {
    Store.loadLocal();
    if (!Store.hasLayout) Store.loadDefaultLayout();
  }
  let fitted = !!Store.data.boundary;
  Store.onChange = () => {
    renderAll();
    if (!fitted && Store.data.boundary && map.loaded()) { fitted = true; fitBoundary(true); }
  };
  initUI();
  renderAll();
  if (QS.get("sheet")) setSheet(QS.get("sheet"));
  if (QS.has("3d")) map.once("load", () => setTimeout(() => set3D(true, false) || map.jumpTo({ pitch: 62, bearing: -20 }), 200));
  // Hosted site: if a newer release is out, reload into it (versioned URL so no stale cache is used).
  async function checkForUpdate() {
    if (!window.APP_VERSION) return;
    try {
      const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      const { v } = await r.json();
      if (!v || v === window.APP_VERSION) return;
      // Right after a release the server can still hand out the old page, so retry every couple of minutes
      // instead of giving up for the session (iPhone home-screen apps can stay open for days).
      let last = 0;
      try { last = +(localStorage.getItem("alnaryd-update-try") || 0); localStorage.setItem("alnaryd-update-try", String(Date.now())); } catch { /* ignore */ }
      if (Date.now() - last < 120000) return;
      location.replace(location.pathname + "?v=" + v + "&r=" + Date.now());
    } catch { /* offline: keep running this version */ }
  }
  checkForUpdate();
  setInterval(() => { if (document.visibilityState === "visible") checkForUpdate(); }, 5 * 60000);
  $("#appVersion").textContent = window.APP_VERSION || "dev";
  if (prefs.gpsOn && !location.search.includes("shot=")) map.once("load", () => startGPS());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
  if (FAMILY) { initFamilyUI(); Family.init(); } else Store.connect();
})();
