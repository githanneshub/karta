// Line of sight from a stand over the laser-scanned ground, with an estimate of how much vegetation hides.
// Rays every 0.5°, samples every 2 m. Per target cell: hidden by terrain, hidden by vegetation, or visible,
// and if visible whether a shot that misses meets the ground within 50 m behind the target (backstop).
(function (root) {
  "use strict";
  const STEP = 2, RAYS = 720, BACKSTOP = 25; // 25 steps = 50 m
  const VISIBLE_STOP = 1, VISIBLE_OPEN = 2, DEAD_GROUND = 3, VEG_HIDDEN = 4;

  // sample(lon, lat) -> { z: ground metres, veg: vegetation height, rate: sight loss per metre below the canopy }
  function compute({ lon, lat, eye, target, radius, range, facing, width, sample }) {
    const rad = Math.PI / 180, R = 6371008.8;
    const mx = R * rad * Math.cos(lat * rad), my = R * rad;
    const n = Math.ceil(radius / STEP);
    const eyeZ = sample(lon, lat).z + eye;
    const state = new Uint8Array(RAYS * (n + 1));
    const G = new Float32Array(n + BACKSTOP + 1), V = new Float32Array(n + BACKSTOP + 1), K = new Float32Array(n + BACKSTOP + 1);
    for (let r = 0; r < RAYS; r++) {
      const b = (r / RAYS) * 360 * rad, sx = Math.sin(b), sy = Math.cos(b);
      for (let i = 1; i <= n + BACKSTOP; i++) {
        const s = sample(lon + sx * i * STEP / mx, lat + sy * i * STEP / my);
        G[i] = s.z; V[i] = s.veg; K[i] = s.rate;
      }
      let horizon = -Infinity; // steepest ground slope seen so far along the ray
      for (let j = 1; j <= n; j++) {
        const slope = (G[j] + target - eyeZ) / (j * STEP);
        let st;
        if (slope < horizon) st = DEAD_GROUND;
        else {
          let obs = 0;
          for (let i = 1; i < j && obs < 1; i++) {
            if (eyeZ + slope * i * STEP - G[i] < V[i]) obs += K[i] * STEP;
          }
          if (obs >= 1) st = VEG_HIDDEN;
          else {
            st = VISIBLE_OPEN;
            for (let k = j + 1; k <= j + BACKSTOP; k++) if (eyeZ + slope * k * STEP <= G[k]) { st = VISIBLE_STOP; break; }
          }
        }
        state[r * (n + 1) + j] = st;
        horizon = Math.max(horizon, (G[j] - eyeZ) / (j * STEP));
      }
    }

    // rasterise to a north-up image, 2 m pixels
    const px = STEP, W = Math.ceil((2 * radius) / px);
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = W;
    const g = canvas.getContext("2d"), img = g.createImageData(W, W), d = img.data;
    // visible ground with a backstop stays clear; everything else is marked
    const COL = { 4: [120, 90, 160, 70] };   // hidden by thick forest: a light grey-purple
    const stats = { cells: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const half = width / 2;
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5) * px - radius, dy = radius - (y + 0.5) * px, dist = Math.hypot(dx, dy);
        if (dist > radius || dist < STEP) continue;
        const brg = (Math.atan2(dx, dy) / rad + 360) % 360;
        const st = state[(Math.round(brg / (360 / RAYS)) % RAYS) * (n + 1) + Math.min(n, Math.round(dist / STEP))];
        const o = (y * W + x) * 4;
        if (st === DEAD_GROUND) {   // hidden behind a hill or in a hollow: a soft purple, no stripes
          d[o] = 130; d[o + 1] = 60; d[o + 2] = 200; d[o + 3] = 85;
        } else if (st === VISIBLE_OPEN) {   // seen, but a miss flies on: thin yellow lines
          if ((x - y + 600) % 7 < 1) { d[o] = 255; d[o + 1] = 196; d[o + 2] = 0; d[o + 3] = 170; }
        } else if (st === VEG_HIDDEN) {
          const c = COL[4]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3];
        }
        if (st && dist <= range && Math.abs(((brg - facing) % 360 + 540) % 360 - 180) <= half) { stats.cells++; stats[st]++; }
      }
    }
    g.putImageData(img, 0, 0);
    const dLon = radius / mx, dLat = radius / my;
    return {
      url: canvas.toDataURL("image/png"),
      coordinates: [[lon - dLon, lat + dLat], [lon + dLon, lat + dLat], [lon + dLon, lat - dLat], [lon - dLon, lat - dLat]],
      stats,
    };
  }

  root.Viewshed = { compute };
})(typeof window !== "undefined" ? window : globalThis);
