/* Alnaryd hunting map: layers, stands, wind, stalk routes, sightings. */
(function () {
  "use strict";

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
  const FAMILY = !!window.FIREBASE_CONFIG;  // hosted family site with Firebase login
  const START = { center: [15.4339, 56.3532], zoom: 14.7 };

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
  const KINDS = { seen: "Seen", shot: "Shot", tracks: "Tracks / sign", bed: "Bed / daybed", rub: "Rub / wallow" };
  const STAND_TYPES = { tower: "Tower / high seat", ladder: "Ladder stand", ground: "Ground blind", pass: "Drive post" };
  const WIND8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const dir8 = (deg) => WIND8[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  const STATUS_COLORS = { good: "#2b8a3e", warn: "#d39b00", bad: "#d0332b" };

  // ---------- preferences (this device only) ----------
  const prefs = (() => {
    const defaults = { base: "forest", ov: { trails: true, contours: true, roads: true, reserve: true, boundary: true, wet: false, drainage: false, steep: false },
      wind: { from: 225, speed: 4 }, cones: true, exag: 1.6, tab: "map", view: true, target: 1.2, share: false };
    if (location.search.includes("shot=")) return defaults;
    try { const p = JSON.parse(localStorage.getItem("alnaryd-prefs") || "null"); return p ? { ...defaults, ...p, ov: { ...defaults.ov, ...p.ov }, wind: { ...defaults.wind, ...p.wind } } : defaults; }
    catch { return defaults; }
  })();
  let prefsTimer = 0;
  function savePrefs() { if (location.search.includes("shot=")) return; clearTimeout(prefsTimer); prefsTimer = setTimeout(() => { try { localStorage.setItem("alnaryd-prefs", JSON.stringify(prefs)); } catch { /* storage unavailable */ } }, 300); }

  // ---------- storage: shared db when hosted on claude.ai, otherwise this browser ----------
  const Store = {
    db: null,
    data: { stands: [], sightings: [], routes: [], boundary: null, trails: [], places: [] },
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
      this.data = { stands: [], sightings: [], routes: [], boundary: null, trails: [], places: [] };
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
  function setSheet(state) { $("#app").dataset.sheet = state; }
  function showTab(name, expand) {
    prefs.tab = name; savePrefs();
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
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#d8d3c3" } }],
    },
    center: START.center, zoom: START.zoom, minZoom: 12, maxZoom: 19.5,
    maxPitch: 75,
    attributionControl: { compact: true, customAttribution: "Lantmäteriet (CC0) via Mapterhorn · Naturvårdsverket NMD · Meta/WRI canopy height · © OpenStreetMap" },
  });
  if (location.search.includes("shot=")) window.__map = map;  // test hook for screenshot mode
  map.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }), "bottom-left");

  let manifest = null;
  const loadedImageSets = new Set();
  const FC = (features = []) => ({ type: "FeatureCollection", features });
  // Outside-the-boundary mask: a counter-clockwise frame around the area with the boundary as a clockwise hole
  function maskOuter() {
    const [w, s, e, n] = manifest ? manifest.bounds : [15.35, 56.3, 15.5, 56.4];
    return [[w - .3, s - .3], [e + .3, s - .3], [e + .3, n + .3], [w - .3, n + .3], [w - .3, s - .3]];
  }
  function clockwise(ring) {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    return area > 0 ? ring : ring.slice().reverse();
  }

  function addImageSet(name, beforeId) {
    if (loadedImageSets.has(name) || !manifest) return;
    loadedImageSets.add(name);
    manifest.layers[name].forEach((chunk, i) => {
      const sid = `${name}-${i}`;
      map.addSource(sid, { type: "image", url: abs(chunk.url), coordinates: chunk.coordinates });
      map.addLayer({ id: sid, type: "raster", source: sid, paint: { "raster-fade-duration": 0, "raster-resampling": "linear" } }, beforeId);
    });
  }
  function setImageSetVisible(name, on) {
    if (on) addImageSet(name, name === "wet" || name === "steep" ? "anchor-overlays" : "anchor-base");
    if (!manifest) return;
    manifest.layers[name].forEach((_, i) => { const id = `${name}-${i}`; if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none"); });
  }

  function arrowImage(color) {
    const s = 32, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    g.strokeStyle = color; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(10, 8); g.lineTo(22, 16); g.lineTo(10, 24); g.stroke();
    return g.getImageData(0, 0, s, s);
  }

  async function getJSON(p) { const r = await fetch(abs(p)); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); }

  map.on("load", async () => {
    try { manifest = await getJSON("data/manifest.json"); }
    catch { $("#loading").textContent = "Map data didn't load. Reload the page."; return; }

    map.addSource("dem", { type: "raster-dem", tiles: [abs("terrain/") + "{z}/{x}/{y}.webp"], tileSize: 512, encoding: "terrarium", minzoom: 10, maxzoom: 15, bounds: manifest.bounds });
    map.addImage("arrow-blue", arrowImage("#1f6fb5"), { pixelRatio: 2 });

    // invisible anchors keep layer groups in order however late images are added
    for (const id of ["anchor-base", "anchor-overlays", "anchor-vectors"]) map.addLayer({ id, type: "background", layout: { visibility: "none" }, paint: { "background-opacity": 0 } });

    for (const id of ["osm", "contours", "reserves", "drainage", "trails", "places", "boundary", "mask", "sectors", "cones", "routes", "draft", "edit", "sightings", "me"]) {
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
    map.addLayer({ id: "contour-label", type: "symbol", source: "contours", minzoom: 14.5, filter: [">=", ["get", "k"], 2],
      layout: { "symbol-placement": "line", "text-field": ["to-string", ["get", "e"]], "text-font": ["Open Sans Semibold"], "text-size": 11,
        "symbol-spacing": 320, "text-max-angle": 30, "text-padding": 10 },
      paint: { "text-color": "#6a3f18", "text-halo-color": "rgba(246,243,232,.9)", "text-halo-width": 1.6 } });
    // drainage / cold air
    map.addLayer({ id: "drainage", type: "line", source: "drainage", layout: { "line-cap": "round" },
      paint: { "line-color": "#1f6fb5", "line-opacity": .8, "line-width": ["interpolate", ["linear"], ["get", "ha"], 1.5, .8, 20, 2.2, 200, 3.4] } });
    map.addLayer({ id: "drainage-arrows", type: "symbol", source: "drainage", minzoom: 14.5,
      layout: { "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "arrow-blue", "icon-size": .55, "icon-allow-overlap": true, "icon-ignore-placement": true } });
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
    map.addLayer({ id: "sectors", type: "fill", source: "sectors", paint: { "fill-color": ["get", "color"], "fill-opacity": .2 } });
    map.addLayer({ id: "sectors-line", type: "line", source: "sectors", paint: { "line-color": ["get", "color"], "line-width": 1.6 } });
    // routes
    map.addLayer({ id: "routes-case", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 6.5 } });
    map.addLayer({ id: "routes", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
    // sightings
    map.addLayer({ id: "sightings", type: "circle", source: "sightings",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 5, 17, 10], "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
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
    getJSON("data/osm.geojson").then((d) => map.getSource("osm").setData(d)).catch(() => toast("Roads didn't load."));
    getJSON("data/reserves.geojson").then((d) => map.getSource("reserves").setData(d)).catch(() => {});
    getJSON("data/drainage.geojson").then((d) => map.getSource("drainage").setData(d)).catch(() => {});
    getJSON("data/contours.geojson").then((d) => map.getSource("contours").setData(d)).catch(() => toast("Contours didn't load."));
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
    contours: ["contour-1", "contour-5", "contour-label"],
    roads: ["road-case", "road", "track", "path", "power", "buildings", "road-label"],
    reserve: ["reserve-fill", "reserve-line-halo", "reserve-line"],
    boundary: ["mask", "boundary-line"],
    drainage: ["drainage", "drainage-arrows"],
    trails: ["trails-case", "trails", "trails-label", "places-dot", "places-label"],
  };
  function applyLayers() {
    if (!manifest) return;
    for (const b of ["forest", "relief", "height"]) setImageSetVisible(b, prefs.base === b);
    for (const [k, ids] of Object.entries(OV_LAYERS)) ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, "visibility", prefs.ov[k] ? "visible" : "none"));
    setImageSetVisible("wet", prefs.ov.wet);
    setImageSetVisible("steep", prefs.ov.steep);
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
  function set3D(on, animate = true) {
    $("#threeD").checked = on;
    $("#tilt").setAttribute("aria-pressed", String(on));
    if (on) { map.setTerrain({ source: "dem", exaggeration: prefs.exag }); if (animate) map.easeTo({ pitch: 62, duration: 900 }); }
    else { map.setTerrain(null); if (animate) map.easeTo({ pitch: 0, duration: 600 }); }
  }
  map.on("rotate", () => { $("#northIcon").style.transform = `rotate(${-map.getBearing()}deg)`; });

  // ---------- stands ----------
  let draftStand = null;   // stand being edited (new or existing copy)
  const markers = new Map();

  function standStatus(s) {
    const w = prefs.wind;
    if (s.winds && s.winds.length) {
      return s.winds.includes(dir8(w.from)) ? { cls: "good", text: "Its wind" } : { cls: "bad", text: "Not its wind" };
    }
    if (w.speed < 1) return { cls: "warn", text: "Calm, swirling" };
    const down = (w.from + 180) % 360;
    const d = Geo.angleDiff(down, s.facing);
    if (d <= s.width / 2 + 15) return { cls: "bad", text: "Scent into sector" };
    if (d <= 100) return { cls: "warn", text: "Side wind" };
    return { cls: "good", text: "Good wind" };
  }
  function coneGeom(s) {
    const w = prefs.wind;
    const half = clamp(40 - w.speed * 2.5, 12, 40);
    const len = clamp(120 + w.speed * 70, 120, 700);
    return Geo.wedge([s.lon, s.lat], (w.from + 180) % 360, half, len);
  }
  const STAND_ICON = {
    tower: '<svg viewBox="0 0 24 24"><path d="M7 21 10 9h4l3 12M8.5 15h7M6 9h12l-2-5H8z"/></svg>',
    ladder: '<svg viewBox="0 0 24 24"><path d="M8 21 11 4M16 21 13 4M9 16h6M10 11h4"/></svg>',
    ground: '<svg viewBox="0 0 24 24"><path d="M3 19 12 6l9 13zM10 19v-4h4v4"/></svg>',
    pass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
  };

  function allStands() {
    const list = Store.data.stands.filter((s) => !draftStand || s.id !== draftStand.id);
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
        el.innerHTML = `<div class="disc"></div><div class="stand-label"></div>`;
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
    $$("#sf-winds input").forEach((i) => { i.checked = s.winds.includes(i.value); });
    $("#sf-delete").hidden = s.isNew;
    viewKey = ""; $("#sf-viewStats").textContent = prefs.view ? "Working out the view…" : "";
    updateStandOutputs();
    renderAll();
    setTimeout(() => $("#sf-name").focus({ preventScroll: true }), 50);
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
      winds: $$("#sf-winds input").filter((i) => i.checked).map((i) => i.value),
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
  function renderAll() {
    if (!map.getSource("sectors")) { renderLists(); renderWind(); return; }
    syncMarkers();
    renderStandGeometry();
    // routes
    const feats = [];
    for (const r of Store.data.routes) {
      const pts = pairs(r.pts);
      for (let i = 1; i < pts.length; i++) feats.push({ type: "Feature", properties: { color: segColor(pts[i - 1], pts[i]), id: r.id }, geometry: { type: "LineString", coordinates: [pts[i - 1], pts[i]] } });
    }
    map.getSource("routes").setData(FC(feats));
    renderLayout();
    // sightings
    const filter = $("#logFilter").value;
    map.getSource("sightings").setData(FC(Store.data.sightings.filter((x) => !filter || x.species === filter).map((x) => ({
      type: "Feature", properties: { id: x.id, color: (speciesById[x.species] || speciesById.other).color, label: `${(speciesById[x.species] || speciesById.other).name}${x.count > 1 ? " ×" + x.count : ""}` },
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
    const sl = $("#standList");
    const stands = Store.data.stands.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));
    sl.innerHTML = stands.length ? stands.map((s) => {
      const st = standStatus(s);
      return `<li data-id="${esc(s.id)}"><span class="dot" style="background:${STATUS_COLORS[st.cls]}"></span>
        <span class="it-main"><div class="it-name">${esc(s.name || "Unnamed stand")}</div>
        <div class="it-sub">${esc(STAND_TYPES[s.type] || "")} · faces ${Geo.compassName(s.facing)} · ${s.range} m</div></span>
        <span class="pill ${st.cls}">${st.text}</span></li>`;
    }).join("") : `<li class="empty">No stands yet. Tap <b>Place a stand</b>, then tap the map where it is.</li>`;

    const rl = $("#routeList");
    rl.innerHTML = Store.data.routes.length ? Store.data.routes.map((r) => {
      const st = routeStats(pairs(r.pts));
      return `<li data-id="${esc(r.id)}"><span class="it-main"><div class="it-name">${esc(r.name || "Stalk route")}</div>
        <div class="it-sub">${Math.round(st.len)} m · ${st.intoPct}% into the wind now</div></span>
        <button class="btn small ghost" data-del-route="${esc(r.id)}" type="button">Delete</button></li>`;
    }).join("") : `<li class="empty">Draw a stalking route to check each leg against the wind. Green legs head into the wind.</li>`;

    const filter = $("#logFilter").value;
    const logs = Store.data.sightings.filter((x) => !filter || x.species === filter).sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    $("#logList").innerHTML = logs.length ? logs.map((x) => {
      const sp = speciesById[x.species] || speciesById.other;
      const when = x.when ? new Date(x.when).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "";
      return `<li data-id="${esc(x.id)}"><span class="dot" style="background:${sp.color}"></span>
        <span class="it-main"><div class="it-name">${esc(sp.name)}${x.count > 1 ? " ×" + x.count : ""} · ${esc(KINDS[x.kind] || "Seen")}</div>
        <div class="it-sub">${esc(when)}${x.wind ? " · wind " + esc(x.wind) : ""}${x.notes ? " · " + esc(x.notes) : ""}</div></span></li>`;
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
  function setWind(from) { prefs.wind.from = Math.round(from) % 360; savePrefs(); renderAll(); }

  function renderWind() {
    const w = prefs.wind;
    $("#dialG").setAttribute("transform", `rotate(${w.from})`);
    $("#dial").setAttribute("aria-valuenow", String(w.from));
    $("#windBig").textContent = Geo.compassName(w.from);
    $("#windSub").textContent = `From ${w.from}° at ${w.speed} m/s`;
    $("#windScent").textContent = w.speed < 1 ? "Calm: scent pools and swirls" : `Scent drifts toward ${Geo.compassName((w.from + 180) % 360)}`;
    $("#windSpeedOut").textContent = `${w.speed} m/s`;
    const stands = Store.data.stands.map((s) => ({ s, st: standStatus(s) }));
    const order = { good: 0, warn: 1, bad: 2 };
    stands.sort((a, b) => order[a.st.cls] - order[b.st.cls]);
    $("#windStands").innerHTML = stands.length ? stands.map(({ s, st }) =>
      `<li data-id="${esc(s.id)}"><span>${esc(s.name || "Unnamed stand")}</span><span class="pill ${st.cls}">${st.text}</span></li>`).join("")
      : `<li class="note small">Place stands to see which ones work in this wind.</li>`;
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
    tool = t; pts = [];
    edit = null;
    if (t === "editBoundary") edit = { kind: "boundary", closed: true, pts: pairs(Store.data.boundary), sel: -1, history: [] };
    if (t === "editTrail") {
      const tr = Store.data.trails.find((x) => x.id === trailId);
      if (!tr) tool = t = "layout";
      else edit = { kind: "trail", id: tr.id, closed: false, pts: pairs(tr.pts), sel: -1, history: [] };
    }
    $$(".tool[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t || (b.dataset.tool === "boundary" && t === "editBoundary"))));
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
    let text = { stand: "Tap the map where the stand is", sighting: "Tap where you saw it", route: "Tap to add points along your stalk", measure: "Tap points to measure", boundary: "Tap the corners of your hunting area",
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
    if (tool) { pts.push([e.lngLat.lng, e.lngLat.lat]); updateHint(); updateDraft(); return; }
    if (isPhone() && $("#app").dataset.sheet === "open") { setSheet("peek"); return; }
    const hit = map.queryRenderedFeatures(e.point, { layers: ["sightings"] })[0];
    if (hit) { sightingPopup(hit.properties.id, e.lngLat); return; }
    infoPopup(e.lngLat);
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
    showTab("map", type === "place");
    $("#featForm").hidden = false;
    $("#featTitle").textContent = type === "place" ? "Place name" : "Trail";
    $("#ff-name").value = item.name || "";
    $("#ff-name").placeholder = type === "place" ? "e.g. Ingång Syd" : "e.g. Mittenvägen";
    $("#ff-kindRow").hidden = type !== "place";
    if (type === "place") $("#ff-kind").value = item.kind || "other";
    $("#ff-help").textContent = type === "place" ? "Drag the name on the map to move it." : "Drag the points on the map to reshape it, then Save.";
    $("#featForm").scrollIntoView({ block: "nearest" });
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
  let info = null;
  async function loadInfoGrid() {
    try {
      const img = new Image(); img.decoding = "async"; img.src = abs(manifest.info.url);
      await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
      info = { ...manifest.info, px: g.getImageData(0, 0, img.width, img.height).data };
    } catch { info = null; }
  }
  function lookupInfo(lon, lat) {
    if (!info) return null;
    const [E, N] = Geo.toSweref(lon, lat);
    const col = Math.floor((E - info.origin[0]) / info.cell), row = Math.floor((info.origin[1] - N) / info.cell);
    if (col < 0 || row < 0 || col >= info.width || row >= info.height) return null;
    const i = (row * info.width + col) * 4;
    const code = info.codes[info.px[i] - 1];
    return { code, tree: info.px[i + 1] / 8, twi: info.px[i + 2] / 20 };
  }
  const demCache = new Map();
  async function demTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!demCache.has(key)) {
      demCache.set(key, (async () => {
        const img = new Image(); img.src = abs(`terrain/${key}.webp`); await img.decode();
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
    if (inf.tree < 1.5) return { veg: 0, rate: 0 };
    if (inf.tree < 8) return { veg: inf.tree, rate: .07 };
    return { veg: inf.tree, rate: MATURE_RATE[inf.code] || .015 };
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
  }
  async function updateView() {
    const s = draftStand;
    if (!s || !prefs.view || !info || !map.getSource("sectors")) { hideView(); return; }
    const radius = clamp(Math.round(s.range * 1.6), 150, 320), target = prefs.target;
    const key = [s.lon, s.lat, s.height, s.range, s.facing, s.width, target].join("|");
    if (key === viewKey) return;
    viewKey = key;
    const seq = ++viewSeq;
    $("#sf-viewStats").textContent = "Working out the view…";
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
    const st = res.stats, pct = (k) => st.cells ? Math.round((st[k] / st.cells) * 100) : 0;
    const seen = pct(1) + pct(2);
    $("#sf-viewStats").textContent = st.cells
      ? `In the shooting sector: ${seen}% visible, ${pct(3)}% dead ground, ${pct(4)}% hidden by thick forest. ` +
        `${seen ? Math.round((st[1] / (st[1] + st[2])) * 100) : 0}% of the visible ground has a natural backstop within 50 m.`
      : "No ground inside the shooting sector.";
  }

  function wetLabel(twi) { return twi < 5.5 ? "Dry" : twi < 7 ? "Fresh" : twi < 8.5 ? "Moist" : "Wet"; }
  function nearestStand(lon, lat) {
    let best = null;
    for (const s of Store.data.stands) { const d = Geo.distance([s.lon, s.lat], [lon, lat]); if (!best || d < best.d) best = { s, d }; }
    return best;
  }
  async function infoPopup(ll) {
    const { lng, lat } = ll;
    const [E, N] = Geo.toSweref(lng, lat);
    const inf = lookupInfo(lng, lat);
    const el = await elevationAt(lng, lat);
    const near = nearestStand(lng, lat);
    const rows = [];
    if (el) rows.push(["Elevation", `${el.z.toFixed(1)} m`], ["Slope", `${Math.round(el.slope)}°`]);
    if (inf && inf.code) rows.push(["Ground", esc(landLabel(inf.code))]);
    if (inf) {
      const felled = (inf.code === 118 || inf.code === 128) && inf.tree > 8;
      rows.push(["Trees", felled ? `Felled recently (about ${Math.round(inf.tree)} m trees around 2019)` : inf.tree < 2 ? "Open, under 2 m" : `about ${Math.round(inf.tree)} m tall`],
        ["Moisture", wetLabel(inf.twi)]);
    }
    if (near && near.d < 3000) rows.push(["Nearest stand", `${esc(near.s.name || "Stand")}, ${Math.round(near.d)} m ${Geo.compassName(Geo.bearing([near.s.lon, near.s.lat], [lng, lat]))}`]);
    const aerial = `https://minkarta.lantmateriet.se/plats/3006/v2.0/?e=${Math.round(E)}&n=${Math.round(N)}&z=12&mapprofile=karta&layers=`;
    const html = `<div class="pop"><dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      <div class="coords">N ${Math.round(N)} · E ${Math.round(E)} (SWEREF 99 TM)<br>${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      <div style="margin-top:6px"><a href="${aerial}" target="_blank" rel="noopener">Open at Lantmäteriet ↗</a> <span class="note small">(Flygbild in its layer menu shows aerial photos, 1960 and 1975 too)</span></div></div>`;
    new maplibregl.Popup({ maxWidth: "300px" }).setLngLat(ll).setHTML(html).addTo(map);
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
  let watchId = null, meMarker = null, firstFix = true, myFix = null;
  function startGPS() {
    if (watchId !== null) return true;
    if (!("geolocation" in navigator)) { toast("This browser can't share your position."); return false; }
    firstFix = true;
    $("#locate").setAttribute("aria-pressed", "true");
    watchId = navigator.geolocation.watchPosition((p) => {
      const ll = [p.coords.longitude, p.coords.latitude];
      myFix = { ll, acc: p.coords.accuracy, t: Date.now() };
      if (!meMarker) { const el = document.createElement("div"); el.className = "me-dot"; meMarker = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map); }
      meMarker.setLngLat(ll);
      map.getSource("me").setData(FC([{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [Geo.circle(ll, p.coords.accuracy)] } }]));
      if (firstFix) { firstFix = false; map.easeTo({ center: ll, zoom: Math.max(map.getZoom(), 16) }); }
      if (FAMILY) Family.onFix(p);
    }, (err) => {
      if (err.code !== 1) return;  // timeouts and weak signal: keep listening
      toast(FAMILY ? "Location is blocked. On iPhone: Settings → Privacy → Location Services → Safari Websites → While Using."
        : "Your position isn't available here. On a phone, open the map from its web address and allow location.", 7000);
      stopGPS();
      if (FAMILY) Family.setSharing(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    return true;
  }
  function stopGPS() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; myFix = null; $("#locate").setAttribute("aria-pressed", "false");
    if (meMarker) { meMarker.remove(); meMarker = null; }
    if (map.getSource("me")) map.getSource("me").setData(FC());
  }
  function toggleLocate() {
    if (FAMILY && Family.ready) { Family.setSharing(!Family.sharing); return; }
    if (watchId !== null) stopGPS(); else startGPS();
  }

  // ---------- export ----------
  function buildGeoJSON() {
    const f = [];
    for (const s of Store.data.stands) f.push({ type: "Feature", properties: { kind: "stand", name: s.name, type: s.type, facing: s.facing, sector: s.width, range: s.range, notes: s.notes }, geometry: { type: "Point", coordinates: [s.lon, s.lat] } });
    for (const x of Store.data.sightings) f.push({ type: "Feature", properties: { kind: "sighting", species: x.species, count: x.count, what: x.kind, when: x.when, wind: x.wind, notes: x.notes }, geometry: { type: "Point", coordinates: [x.lon, x.lat] } });
    for (const r of Store.data.routes) f.push({ type: "Feature", properties: { kind: "route", name: r.name }, geometry: { type: "LineString", coordinates: pairs(r.pts) } });
    if (Store.data.boundary) { const b = pairs(Store.data.boundary); f.push({ type: "Feature", properties: { kind: "boundary" }, geometry: { type: "Polygon", coordinates: [[...b, b[0]]] } }); }
    return JSON.stringify(FC(f), null, 1);
  }
  function buildGPX() {
    const x = (s) => esc(s);
    const wpt = (lon, lat, name, desc, sym) => `<wpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><name>${x(name)}</name>${desc ? `<desc>${x(desc)}</desc>` : ""}<sym>${sym}</sym></wpt>`;
    const trk = (name, ptsArr) => `<trk><name>${x(name)}</name><trkseg>${ptsArr.map(([lo, la]) => `<trkpt lat="${la.toFixed(7)}" lon="${lo.toFixed(7)}"/>`).join("")}</trkseg></trk>`;
    let body = "";
    for (const s of Store.data.stands) body += wpt(s.lon, s.lat, s.name || "Stand", `${STAND_TYPES[s.type] || ""}, faces ${Geo.compassName(s.facing)}. ${s.notes || ""}`, "Hunting Area");
    for (const s of Store.data.sightings) { const sp = speciesById[s.species] || speciesById.other; body += wpt(s.lon, s.lat, `${sp.name}${s.count > 1 ? " x" + s.count : ""}`, `${KINDS[s.kind] || ""} ${s.when || ""} ${s.notes || ""}`, "Animal Tracks"); }
    for (const r of Store.data.routes) body += trk(r.name || "Stalk route", pairs(r.pts));
    if (Store.data.boundary) { const b = pairs(Store.data.boundary); body += trk("Hunting boundary", [...b, b[0]]); }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Alnaryd hunting map" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
  }
  async function saveFile(name, text, mime) {
    const c = window.claude;
    let dl = null;
    if (c && typeof c.use === "function") { try { dl = await c.use("downloads"); } catch { dl = null; } }
    if (dl) {
      const fname = name.endsWith(".gpx") ? name + ".txt" : name;
      try { await dl.save({ filename: fname, data: text }); if (fname !== name) toast("Saved as .txt. Rename it to .gpx before importing.", 5000); }
      catch (e) { if (e && e.code !== "declined") toast("The file couldn't be saved here."); }
      return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function fitBoundary(animate = true) {
    const b = Store.data.boundary ? pairs(Store.data.boundary) : null; if (!b || b.length < 3) return;
    const xs = b.map((p) => p[0]), ys = b.map((p) => p[1]);
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 60, animate });
  }

  // ---------- wire up UI ----------
  function initUI() {
    // tabs & sheet
    $$(".tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab, true)));
    $("#sheetHandle").addEventListener("click", () => setSheet($("#app").dataset.sheet === "open" ? "peek" : "open"));
    showTab(prefs.tab, false);

    // base & overlays
    $$('input[name="base"]').forEach((r) => {
      r.checked = r.value === prefs.base;
      r.addEventListener("change", () => { prefs.base = r.value; savePrefs(); applyLayers(); renderLegend(); });
    });
    $$("[data-ov]").forEach((c) => {
      c.checked = !!prefs.ov[c.dataset.ov];
      c.addEventListener("change", () => { prefs.ov[c.dataset.ov] = c.checked; savePrefs(); applyLayers(); });
    });
    $("#threeD").addEventListener("change", (e) => set3D(e.target.checked));
    $("#tilt").addEventListener("click", () => set3D(!$("#threeD").checked));
    $("#exag").value = prefs.exag; $("#exagOut").textContent = prefs.exag + "×";
    $("#exag").addEventListener("input", (e) => {
      prefs.exag = +e.target.value; $("#exagOut").textContent = prefs.exag.toFixed(1) + "×"; savePrefs();
      if ($("#threeD").checked) map.setTerrain({ source: "dem", exaggeration: prefs.exag });
    });
    $("#north").addEventListener("click", () => map.easeTo({ bearing: 0, pitch: $("#threeD").checked ? map.getPitch() : 0 }));
    $("#locate").addEventListener("click", toggleLocate);

    // boundary
    $("#drawBoundary").addEventListener("click", () => { setTool("boundary", { draw: true }); });
    $("#editBoundary").addEventListener("click", () => { setTool("editBoundary"); });
    $("#clearBoundary").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Tap again to remove"; setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Remove"; }, 3000); return; }
      btn.dataset.confirm = ""; btn.textContent = "Remove"; await Store.setBoundary(null);
    });

    // tools
    $$(".tool[data-tool]").forEach((b) => b.addEventListener("click", () => {
      const active = tool === b.dataset.tool || (b.dataset.tool === "boundary" && tool === "editBoundary");
      setTool(active ? null : b.dataset.tool);
    }));
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
    $("#addStand").addEventListener("click", () => setTool("stand"));
    $("#addRoute").addEventListener("click", () => setTool("route"));
    $("#addSighting").addEventListener("click", () => setTool("sighting"));

    // stand form
    $("#sf-winds").innerHTML = WIND8.map((d) => `<label><input type="checkbox" value="${d}" id="sfw-${d}"><span>${d}</span></label>`).join("");
    for (const id of ["sf-facing", "sf-width", "sf-range"]) $("#" + id).addEventListener("input", () => { updateStandOutputs(); if (draftStand) { readStandForm(); renderAll(); } });
    for (const id of ["sf-type", "sf-name"]) $("#" + id).addEventListener("change", () => { if (draftStand) { readStandForm(); renderAll(); } });
    $("#sf-showView").checked = prefs.view;
    $("#sf-target").value = String(prefs.target);
    $("#sf-viewLegend").hidden = !prefs.view;
    $("#sf-showView").addEventListener("change", (e) => {
      prefs.view = e.target.checked; savePrefs(); $("#sf-viewLegend").hidden = !prefs.view;
      $("#sf-viewStats").textContent = prefs.view ? "Working out the view…" : "";
      viewKey = ""; renderStandGeometry();
    });
    $("#sf-target").addEventListener("change", (e) => { prefs.target = +e.target.value; savePrefs(); renderStandGeometry(); });
    $("#sf-winds").addEventListener("change", () => { if (draftStand) { readStandForm(); renderAll(); } });
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
    $("#windStands").addEventListener("click", (e) => {
      const li = e.target.closest("li[data-id]"); if (!li) return;
      const s = Store.data.stands.find((x) => x.id === li.dataset.id); if (s) map.easeTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), 15.5) });
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

    // wind
    buildDial();
    $("#windSpeed").value = prefs.wind.speed;
    $("#windSpeed").addEventListener("input", (e) => { prefs.wind.speed = +e.target.value; savePrefs(); renderAll(); });
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
    $("#exportGpx").addEventListener("click", () => saveFile("alnaryd.gpx", buildGPX(), "application/gpx+xml"));
    $("#exportJson").addEventListener("click", () => saveFile("alnaryd.json", buildGeoJSON(), "application/geo+json"));
  }

  // ---------- family mode: sign-in, members and live positions (hosted site with Firebase) ----------
  const FAMILY_COLORS = ["#1d7cf2", "#d6336c", "#2b8a3e", "#f08c00", "#7048e8", "#0c8599", "#c2255c", "#5c940d"];
  const Family = {
    ready: false, user: null, member: null, members: [], positions: new Map(), sharing: false, lastWrite: null,
    markers: new Map(), wakeLock: null,

    colorFor(email) {  // distinct colours in a stable order (by email) for everyone on the list
      const i = this.members.map((m) => m.email).sort().indexOf(email);
      if (i >= 0) return FAMILY_COLORS[i % FAMILY_COLORS.length];
      let h = 0; for (const c of email || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return FAMILY_COLORS[h % FAMILY_COLORS.length];
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
        this.positions = new Map(snap.docs.map((d) => [d.id, d.data()]));
        this.render();
      }, () => {});
      setInterval(() => this.render(), 30000);
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
    },
    ageMin(pos) {
      const t = pos.t && pos.t.toMillis ? pos.t.toMillis() : pos.tc;
      return t ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
    },
    statusFor(email) {
      const pos = [...this.positions.entries()].find(([, v]) => v.email === email);
      const mine = this.user && email === this.user.email.toLowerCase();
      if (mine) return this.sharing ? (myFix ? "You · sharing now" : "You · waiting for GPS…") : "You · not sharing";
      if (!pos) return "Hasn't shared yet";
      const [, v] = pos, age = this.ageMin(v);
      const where = myFix ? ` · ${Math.round(Geo.distance(myFix.ll, [v.lon, v.lat]))} m ${Geo.compassName(Geo.bearing(myFix.ll, [v.lon, v.lat]))}` : "";
      if (v.sharing && age !== null && age < 10) return `Sharing · ${age ? age + " min ago" : "now"}${where}`;
      return `Last seen ${age === null ? "" : age < 1 ? "just now" : age < 60 ? age + " min ago" : Math.round(age / 60) + " h ago"}${where}`;
    },
    render() {
      if (!FAMILY || !this.user) return;
      const owner = this.member && this.member.role === "owner";
      $("#syncState").textContent = (this.member && this.member.name) || "Signed in";
      $("#syncState").dataset.state = "shared";
      $("#meInfo").textContent = `Signed in as ${this.user.email}.`;
      $("#memberForm").hidden = !owner; $("#ownerTools").hidden = !owner;
      $("#shareState").textContent = this.sharing
        ? (myFix ? "On. Your family sees you while this map is open. Keep the screen on." : "On. Waiting for GPS…")
        : "Off. Your family can't see you.";
      const list = this.members.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "sv"));
      $("#familyList").innerHTML = list.length ? list.map((m) => `<li data-email="${esc(m.email)}">
          <span class="dot" style="background:${this.colorFor(m.email)}"></span>
          <span class="it-main"><div class="it-name">${esc(m.name || m.email)}${m.role === "owner" ? " · owner" : ""}</div>
          <div class="it-sub">${esc(this.statusFor(m.email))}</div></span>
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
          el.innerHTML = `<b></b><span></span>`;
          el.addEventListener("click", (e) => { e.stopPropagation(); map.easeTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 16) }); });
          m = new maplibregl.Marker({ element: el }).setLngLat([v.lon, v.lat]).addTo(map);
          this.markers.set(uid, m);
        }
        m.setLngLat([v.lon, v.lat]);
        const el = m.getElement(), live = v.sharing && age < 10;
        el.style.setProperty("--c", this.colorFor(v.email));
        el.classList.toggle("stale", !live);
        el.querySelector("b").textContent = (v.name || "?").trim().charAt(0).toUpperCase();
        el.querySelector("span").textContent = `${v.name || ""}${live ? (age ? ` · ${age} min` : "") : ` · ${age < 60 ? age + " min" : Math.round(age / 60) + " h"} ago`}`;
      }
      for (const [uid, m] of this.markers) if (!keep.has(uid)) { m.remove(); this.markers.delete(uid); }
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
    $("#familyList").addEventListener("click", async (e) => {
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
    $("#importFile").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) Family.importFile(f); e.target.value = ""; });
    setMode("signin");
  }

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
  if (FAMILY) { initFamilyUI(); Family.init(); } else Store.connect();
})();
