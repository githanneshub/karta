// Geodesy helpers: SWEREF 99 TM (Lantmäteriet's Gauss conformal formulas), bearings,
// destination points and areas on a local flat approximation (fine at hunting-ground scale).
(function (root) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, lon0 = 15, FE = 500000;
  const e2 = f * (2 - f), n = f / (2 - f);
  const aRoof = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const A = e2, B = (5 * e2 ** 2 - e2 ** 3) / 6, C = (104 * e2 ** 3 - 45 * e2 ** 4) / 120, D = 1237 * e2 ** 4 / 1260;
  const b1 = n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16 + 41 * n ** 4 / 180;
  const b2 = 13 * n * n / 48 - 3 * n ** 3 / 5 + 557 * n ** 4 / 1440;
  const b3 = 61 * n ** 3 / 240 - 103 * n ** 4 / 140;
  const b4 = 49561 * n ** 4 / 161280;
  const d1 = n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96 - n ** 4 / 360;
  const d2 = n * n / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440;
  const d3 = 17 * n ** 3 / 480 - 37 * n ** 4 / 840;
  const d4 = 4397 * n ** 4 / 161280;
  const As = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
  const Bs = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
  const Cs = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
  const Ds = -(4279 * e2 ** 4) / 1260;
  const rad = Math.PI / 180;

  function toSweref(lon, lat) {
    const phi = lat * rad, dl = (lon - lon0) * rad;
    const s = Math.sin(phi), c = Math.cos(phi);
    const phiS = phi - s * c * (A + B * s ** 2 + C * s ** 4 + D * s ** 6);
    const xi = Math.atan(Math.tan(phiS) / Math.cos(dl));
    const eta = Math.atanh(Math.cos(phiS) * Math.sin(dl));
    const N = k0 * aRoof * (xi + b1 * Math.sin(2 * xi) * Math.cosh(2 * eta) + b2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
      + b3 * Math.sin(6 * xi) * Math.cosh(6 * eta) + b4 * Math.sin(8 * xi) * Math.cosh(8 * eta));
    const E = k0 * aRoof * (eta + b1 * Math.cos(2 * xi) * Math.sinh(2 * eta) + b2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
      + b3 * Math.cos(6 * xi) * Math.sinh(6 * eta) + b4 * Math.cos(8 * xi) * Math.sinh(8 * eta)) + FE;
    return [E, N];
  }

  function fromSweref(E, N) {
    const xi = N / (k0 * aRoof), eta = (E - FE) / (k0 * aRoof);
    const xiP = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
      - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
    const etaP = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
      - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
    const phiS = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
    const dl = Math.atan(Math.sinh(etaP) / Math.cos(xiP));
    const s = Math.sin(phiS), c = Math.cos(phiS);
    const phi = phiS + s * c * (As + Bs * s ** 2 + Cs * s ** 4 + Ds * s ** 6);
    return [lon0 + dl / rad, phi / rad];
  }

  // Local planar metres around a reference latitude
  const R = 6371008.8;
  function metersPerDeg(lat) { return [R * rad * Math.cos(lat * rad), R * rad]; }

  function bearing(p, q) {
    const [mx, my] = metersPerDeg((p[1] + q[1]) / 2);
    const dx = (q[0] - p[0]) * mx, dy = (q[1] - p[1]) * my;
    return (Math.atan2(dx, dy) / rad + 360) % 360;
  }

  function distance(p, q) {
    const [mx, my] = metersPerDeg((p[1] + q[1]) / 2);
    return Math.hypot((q[0] - p[0]) * mx, (q[1] - p[1]) * my);
  }

  function destination(p, brg, dist) {
    const [mx, my] = metersPerDeg(p[1]);
    return [p[0] + Math.sin(brg * rad) * dist / mx, p[1] + Math.cos(brg * rad) * dist / my];
  }

  function wedge(p, centerBrg, halfAngle, radius, steps = 24) {
    const ring = [p];
    for (let i = 0; i <= steps; i++) {
      ring.push(destination(p, centerBrg - halfAngle + (2 * halfAngle * i) / steps, radius));
    }
    ring.push(p);
    return ring;
  }

  function circle(p, radius, steps = 48) {
    const ring = [];
    for (let i = 0; i <= steps; i++) ring.push(destination(p, (360 * i) / steps, radius));
    return ring;
  }

  function areaHa(ring) {
    if (ring.length < 3) return 0;
    const lat0 = ring.reduce((s, q) => s + q[1], 0) / ring.length;
    const [mx, my] = metersPerDeg(lat0);
    let s = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
      s += x1 * mx * y2 * my - x2 * mx * y1 * my;
    }
    return Math.abs(s) / 2 / 10000;
  }

  // Smallest angle between two bearings, 0..180
  function angleDiff(a1, a2) {
    const d = Math.abs(((a1 - a2) % 360 + 540) % 360 - 180);
    return d;
  }

  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  function compassName(brg) { return COMPASS[Math.round(((brg % 360) + 360) % 360 / 22.5) % 16]; }

  root.Geo = { toSweref, fromSweref, bearing, distance, destination, wedge, circle, areaHa, angleDiff, compassName };
})(typeof window !== "undefined" ? window : globalThis);
