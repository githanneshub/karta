// Terrain wind from WindNinja (scripts/wind_model.py): 16 directions of near-ground wind on a 20 m grid,
// stored as wind relative to the incoming wind. Blends the two nearest directions, traces scent plumes
// along the real airflow and animates wind lines over the map.
(function (root) {
  "use strict";
  const rad = Math.PI / 180;

  function decode(img, meta) {
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, img.width, img.height).data;
    const { nx, ny, scale } = meta, W = img.width;
    return meta.dirs.map((_, i) => {
      const r0 = Math.floor(i / 4) * ny, c0 = (i % 4) * nx;
      const u = new Float32Array(nx * ny), v = new Float32Array(nx * ny);
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const k = ((r0 + y) * W + c0 + x) * 4;
        u[y * nx + x] = (px[k] - 128) / scale; v[y * nx + x] = (px[k + 1] - 128) / scale;
      }
      return { u, v };
    });
  }

  function boxBlur(src, W, H, r) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let acc = 0, n = 0;
      for (let x = -r; x < W + r; x++) {
        if (x + r < W) { acc += src[y * W + x + r]; n++; }
        if (x - r - 1 >= 0) { acc -= src[y * W + x - r - 1]; n--; }
        if (x >= 0 && x < W) tmp[y * W + x] = acc / n; } }
    for (let x = 0; x < W; x++) { let acc = 0, n = 0;
      for (let y = -r; y < H + r; y++) {
        if (y + r < H) { acc += tmp[(y + r) * W + x]; n++; }
        if (y - r - 1 >= 0) { acc -= tmp[(y - r - 1) * W + x]; n--; }
        if (y >= 0 && y < H) out[y * W + x] = acc / n; } }
    return out;
  }

  // A field for one incoming direction ("from", degrees): the two nearest model runs blended.
  function makeField(area, from) {
    const { meta, layers } = area, n = meta.dirs.length, step = 360 / n;
    const f = (((from % 360) + 360) % 360) / step, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, t = f - Math.floor(f);
    const A = layers[i0], B = layers[i1], { nx, ny, res, x0, y1 } = meta;
    // ratio u,v at SWEREF metres (E, N); null outside the grid
    function at(E, N) {
      const gx = (E - x0) / res - 0.5, gy = (y1 - N) / res - 0.5;
      if (gx < 0 || gy < 0 || gx > nx - 1.001 || gy > ny - 1.001) return null;
      const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy, k = iy * nx + ix;
      const bl = (arr) => (arr[k] * (1 - fx) + arr[k + 1] * fx) * (1 - fy) + (arr[k + nx] * (1 - fx) + arr[k + nx + 1] * fx) * fy;
      return [bl(A.u) * (1 - t) + bl(B.u) * t, bl(A.v) * (1 - t) + bl(B.v) * t];
    }
    return { at, from };
  }

  const TW = {
    areas: [],
    async load(urlFor, ids) {
      for (const id of ids) {
        try {
          const meta = await (await fetch(urlFor(`data/${id}/wind.json`))).json();
          const img = new Image(); img.crossOrigin = "anonymous";
          img.src = urlFor(`data/${id}/wind.png`);
          await img.decode();
          this.areas.push({ id, meta, layers: decode(img, meta) });
        } catch { /* this area has no terrain wind */ }
      }
      return this.areas.length > 0;
    },
    // the area grid that contains this point
    areaAt(E, N) {
      return this.areas.find((a) => { const m = a.meta; return E > m.x0 && E < m.x0 + m.nx * m.res && N < m.y1 && N > m.y1 - m.ny * m.res; });
    },
    field(area, from) {
      area._f = area._f && area._f.from === from ? area._f : makeField(area, from);
      const F = area._f, k = this.thermalK;
      if (!k || !this.slopes.length) return F;
      // thermals on top of the wind: + = cold air running downhill, - = warm air rising uphill (in wind-ratio units)
      return { from, at: (E, N) => { const w = F.at(E, N); if (!w) return w; const d = this.downhill(E, N); return d ? [w[0] + k * d[0], w[1] + k * d[1]] : w; } };
    },

    // ---- thermals: which way is downhill, from the terrain grid (terrain.png, 5 m) ----
    slopes: [], thermalK: 0,
    async loadTerrain(urlFor, grids) {
      for (const g of grids) {
        try {
          const img = new Image(); img.crossOrigin = "anonymous"; img.src = urlFor(g.url); await img.decode();
          const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
          const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
          const px = ctx.getImageData(0, 0, img.width, img.height).data, W = g.width, H = g.height;
          const z = new Float32Array(W * H), slope = new Float32Array(W * H);
          for (let i = 0; i < W * H; i++) { z[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 10; slope[i] = px[i * 4 + 2] / 4; }
          // smooth over ~30 m so the flow follows slopes and hollows, not every little bump
          let s = z; for (let p = 0; p < 2; p++) s = boxBlur(s, W, H, 6);
          const dE = new Float32Array(W * H), dN = new Float32Array(W * H);
          for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const i = y * W + x, gx = (s[i + 1] - s[i - 1]) / (2 * g.cell), gn = (s[i - W] - s[i + W]) / (2 * g.cell);   // rows run north to south
            const m = Math.hypot(gx, gn); if (m < 1e-6) continue;
            const w = Math.min(1, Math.atan(m) / rad / 6);   // full strength from about 6 degrees
            dE[i] = -gx / m * w; dN[i] = -gn / m * w;
          }
          this.slopes.push({ ...g, z, slope, dE, dN });
        } catch { /* no terrain grid for this area */ }
      }
      return this.slopes.length > 0;
    },
    // unit-ish vector pointing downhill (E, N), weighted by how steep it is; null outside the grids
    downhill(E, N) {
      for (const g of this.slopes) {
        const c = Math.floor((E - g.origin[0]) / g.cell), r = Math.floor((g.origin[1] - N) / g.cell);
        if (c < 0 || r < 0 || c >= g.width || r >= g.height) continue;
        const i = r * g.width + c; return [g.dE[i], g.dN[i]];
      }
      return null;
    },
    setThermal(k) { if (k !== this.thermalK) { this.thermalK = k; for (const a of this.areas) a._f = null; } },
    // Local wind at a point: { from (deg), ratio } or null outside the model.
    local(lon, lat, from) {
      const [E, N] = Geo.toSweref(lon, lat), a = this.areaAt(E, N);
      if (!a) return null;
      const w = this.field(a, from).at(E, N);
      if (!w) return null;
      return { from: (Math.atan2(-w[0], -w[1]) / rad + 360) % 360, ratio: Math.hypot(w[0], w[1]) };
    },
    // Scent plume: follow the airflow downwind from a point and widen it by `half` degrees. `len` is how far scent
    // carries in average wind; where the model has slower air (hollows, lee of hills) it spreads wider and
    // reaches less far, where air is faster (ridges, gaps) it carries further in a narrower band.
    // Returns a closed lon/lat ring, or null when the point is outside the model.
    plume(lon, lat, from, len, half) {
      const [E0, N0] = Geo.toSweref(lon, lat), a = this.areaAt(E0, N0);
      if (!a) return null;
      const F = this.field(a, from), STEP = 6, med = a.meta.median || 0.72;
      const path = [[E0, N0]], spread = [0];
      let E = E0, N = N0, d = 0, dir = null, wide = 0;
      while (d < len && path.length < 400) {
        let w = F.at(E, N);
        if (!w) break;
        let m = Math.hypot(w[0], w[1]) || 1e-6;
        // midpoint step (RK2) for a smooth line through curving flow
        const w2 = F.at(E + (w[0] / m) * STEP / 2, N + (w[1] / m) * STEP / 2) || w;
        m = Math.hypot(w2[0], w2[1]) || 1e-6;
        dir = [w2[0] / m, w2[1] / m];
        const slow = Math.min(1.8, Math.max(0.6, med / m));   // >1 where the air is slower than usual here
        E += dir[0] * STEP; N += dir[1] * STEP; d += STEP * slow; wide += STEP * slow;
        path.push([E, N]); spread.push(wide);
      }
      if (path.length < 3) return null;
      const tan = Math.tan(half * rad), left = [], right = [];
      for (let i = 0; i < path.length; i++) {
        const p = path[i], q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)];
        let tx = q[0] - o[0], ty = q[1] - o[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const wdt = Math.max(4, spread[i] * tan);
        left.push([p[0] - ty * wdt, p[1] + tx * wdt]); right.push([p[0] + ty * wdt, p[1] - tx * wdt]);
      }
      // rounded far end
      const end = path[path.length - 1], last = left[left.length - 1], wEnd = Math.hypot(last[0] - end[0], last[1] - end[1]);
      const ang = Math.atan2(last[1] - end[1], last[0] - end[0]), cap = [];
      for (let k = 1; k < 8; k++) { const t = ang - (k / 8) * Math.PI; cap.push([end[0] + Math.cos(t) * wEnd, end[1] + Math.sin(t) * wEnd]); }
      const ring = [...left, ...cap, ...right.reverse()].map(([e, n]) => Geo.fromSweref(e, n));
      ring.unshift([lon, lat]); ring.push([lon, lat]);
      return ring;
    },
  };

  // ---- moving wind lines drawn on a canvas over the map ----
  function Flow(map) {
    const cv = document.createElement("canvas");
    cv.className = "wind-flow";
    map.getCanvasContainer().parentNode.appendChild(cv);
    const g = cv.getContext("2d");
    let parts = [], raf = 0, on = false, from = 0, speed = 0, lastT = 0, dpr = 1, moving = false, odd = false;
    const phone = matchMedia("(max-width: 860px)").matches;
    const N = phone ? 220 : 450;
    // on 3D terrain every dot needs a height lookup (about 0.1 ms each), so there fewer dots, drawn every other frame,
    // and none while the map is being dragged: the map gets all the time it needs to move smoothly
    const N3D = phone ? 80 : 160;
    // lines are coloured by how fast the air moves here compared with the area as a whole: sheltered = blue, exposed = white
    const COLORS = ["rgba(150,200,255,0.35)", "rgba(235,240,230,0.42)", "rgba(255,255,255,0.75)"];

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = map.getCanvas().getBoundingClientRect();
      cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    }
    function seed(p) {
      const b = map.getBounds(), sw = Geo.toSweref(b.getWest(), b.getSouth()), ne = Geo.toSweref(b.getEast(), b.getNorth());
      for (let k = 0; k < 6; k++) {
        const E = sw[0] + Math.random() * (ne[0] - sw[0]), Nn = sw[1] + Math.random() * (ne[1] - sw[1]);
        const a = TW.areaAt(E, Nn);
        if (a) { p.E = E; p.N = Nn; p.a = a; p.age = Math.random() * 120 | 0; p.px = null; return p; }
      }
      p.a = null; p.age = 999; return p;
    }
    function clear() { g.clearRect(0, 0, cv.width, cv.height); for (const p of parts) p.px = null; }
    function frame(t) {
      raf = 0;
      if (!on || moving) return;
      const t3d = !!map.getTerrain();
      if (t3d && (odd = !odd)) { raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016); lastT = t;
      // fade old trails
      g.globalCompositeOperation = "destination-in"; g.fillStyle = "rgba(0,0,0,0.93)"; g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = "source-over";
      const mpp = 40075016 * Math.cos(map.getCenter().lat * rad) / (512 * 2 ** map.getZoom());   // metres per CSS pixel
      const k = 24 * mpp * Math.max(speed, 1.5) / 4;   // screen speed grows with the wind
      g.lineWidth = 1.1 * dpr; g.lineCap = "round";
      const paths = COLORS.map(() => new Path2D());
      for (const p of t3d ? parts.slice(0, N3D) : parts) {
        if (!p.a || p.age > 160) { seed(p); continue; }
        const w = TW.field(p.a, from).at(p.E, p.N);
        if (!w) { seed(p); continue; }
        p.E += w[0] * k * dt / 0.72; p.N += w[1] * k * dt / 0.72;
        p.age++;
        const ll = Geo.fromSweref(p.E, p.N), s = map.project(ll), x = s.x * dpr, y = s.y * dpr;
        if (p.px) {
          const rel = Math.hypot(w[0], w[1]) / (p.a.meta.median || 0.72);
          const path = paths[rel < 0.92 ? 0 : rel < 1.08 ? 1 : 2];
          path.moveTo(p.px[0], p.px[1]); path.lineTo(x, y);
        }
        p.px = [x, y];
      }
      paths.forEach((path, i) => { g.strokeStyle = COLORS[i]; g.stroke(path); });
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf && on && document.visibilityState === "visible") { lastT = 0; raf = requestAnimationFrame(frame); } }
    map.on("movestart", () => { moving = true; clear(); }); map.on("move", clear);
    map.on("moveend", () => { moving = false; start(); }); map.on("resize", () => { size(); clear(); });
    document.addEventListener("visibilitychange", start);
    size();
    return {
      set(o) {
        from = o.from; speed = o.speed;
        const want = !!o.on && speed >= 0.5;
        if (want && !on) { on = true; parts = Array.from({ length: N }, () => seed({})); cv.hidden = false; start(); }
        else if (!want && on) { on = false; cv.hidden = true; clear(); }
      },
    };
  }
  TW.Flow = Flow;
  root.TerrainWind = TW;
})(window);
