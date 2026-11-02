// 3D view from a stand: the ground from the 1 m elevation model, every tree from scripts/trees.py at its height,
// the shooting sector drawn on the ground, other stands as poles. Look around by dragging or by turning the phone.
(function (root) {
  "use strict";
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
  const R = 350, STEP = 2.5, rad = Math.PI / 180;
  let THREE = null, treeData = new Map(), ui = null;

  async function loadTrees(abs, info) {
    if (treeData.has(info.url)) return treeData.get(info.url);
    const buf = await (await fetch(abs(info.url))).arrayBuffer(), dv = new DataView(buf), n = buf.byteLength / 6;
    const t = { x: new Float32Array(n), y: new Float32Array(n), h: new Float32Array(n), k: new Uint8Array(n), origin: info.origin };
    for (let i = 0; i < n; i++) {
      t.x[i] = dv.getUint16(i * 6, true) / 10; t.y[i] = dv.getUint16(i * 6 + 2, true) / 10;
      t.h[i] = dv.getUint8(i * 6 + 4) / 6; t.k[i] = dv.getUint8(i * 6 + 5);
    }
    treeData.set(info.url, t);
    return t;
  }

  // sun direction (azimuth from north, altitude) for lighting
  function sunPos(t, lon, lat) {
    const n = t / 864e5 - 10957.5;
    const g = (357.528 + 0.9856003 * n) * rad, L = 280.46 + 0.9856474 * n;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * n) * rad;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    const H = ((18.697374558 + 24.06570982441908 * n) * 15 + lon) * rad - ra, phi = lat * rad;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
    return { az, alt };
  }

  function label(text, color = "#fff", size = 64) {
    const c = document.createElement("canvas"), g = c.getContext("2d");
    g.font = `700 ${size}px "Barlow Semi Condensed", system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 24;
    c.width = w; c.height = size + 20;
    g.font = `700 ${size}px "Barlow Semi Condensed", system-ui, sans-serif`;
    g.fillStyle = "rgba(20,26,20,.35)"; g.fillRect(0, 0, w, c.height);
    g.fillStyle = color; g.textBaseline = "middle"; g.fillText(text, 12, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(w / c.height * 6, 6, 1); sp.renderOrder = 10;
    return sp;
  }

  async function open(o) {
    // o: { lon, lat, facing, width, range, eye, name, ground: async sampler factory, info(lon,lat), trees: manifest info, abs, stands, heading(), compassName }
    if (!THREE) THREE = await import(THREE_URL);
    const [E0, N0] = Geo.toSweref(o.lon, o.lat);
    const ground = await o.ground(o.lon, o.lat, R + 20);
    const gz = (E, N) => { const [lo, la] = Geo.fromSweref(E, N); const z = ground(lo, la); return Number.isFinite(z) ? z : NaN; };
    let z0 = gz(E0, N0); if (!Number.isFinite(z0)) z0 = 0;

    // ---- DOM ----
    const box = document.createElement("div");
    box.className = "v3d";
    box.innerHTML = `<canvas></canvas>
      <div class="v3d-top"><b class="v3d-name"></b><button type="button" class="btn small" data-a="close">Close</button></div>
      <div class="v3d-bottom">
        <label class="v3d-h">Eye height <output></output><input type="range" min="0.5" max="12" step="0.5"></label>
        <div class="v3d-btns"><button type="button" class="btn small" data-a="compass">Turn with phone</button><span class="v3d-dir"></span></div>
        <p class="v3d-note">Trees from satellite data about 2018–2020, felled areas shown as regrowth. Deciduous trees are bare in winter.</p>
      </div>`;
    document.body.appendChild(box);
    const canvas = box.querySelector("canvas");
    box.querySelector(".v3d-name").textContent = o.name || "";

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const sky = new THREE.Color("#b9c8d4");
    scene.background = sky; scene.fog = new THREE.Fog(sky, 60, R * 0.95);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.3, R * 1.5);
    const now = new Date(), month = now.getMonth() + 1, leafless = month >= 11 || month <= 4;
    const sun = sunPos(now.getTime(), o.lon, o.lat);
    scene.add(new THREE.HemisphereLight("#e8eef2", "#4b4a35", 1.1));
    const dl = new THREE.DirectionalLight("#fff4df", Math.max(0.25, Math.sin(Math.max(sun.alt, 0.05)) * 2.2));
    const sa = Math.max(sun.alt, 0.12);
    dl.position.set(Math.sin(sun.az) * Math.cos(sa) * 100, Math.sin(sa) * 100, -Math.cos(sun.az) * Math.cos(sa) * 100);
    scene.add(dl);

    // ---- ground ----
    const segs = Math.round((2 * R) / STEP);
    const geo = new THREE.PlaneGeometry(2 * R, 2 * R, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const cGround = { forest: [0.30, 0.31, 0.20], open: [0.55, 0.52, 0.32], bog: [0.62, 0.58, 0.36], water: [0.24, 0.34, 0.40], road: [0.48, 0.45, 0.40] };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), zz = pos.getZ(i), E = E0 + x, N = N0 - zz;
      const z = gz(E, N);
      pos.setY(i, Number.isFinite(z) ? z - z0 : 0);
      const [lo, la] = Geo.fromSweref(E, N), inf = o.info(lo, la);
      const code = inf ? inf.code : 0;
      let c = code >= 111 && code <= 128 ? cGround.forest : code === 61 || code === 62 ? cGround.water : code >= 200 && code < 300 ? cGround.bog : code === 53 ? cGround.road : cGround.open;
      const shade = inf && inf.tree > 3 ? 0.78 : 1;
      col[i * 3] = c[0] * shade; col[i * 3 + 1] = c[1] * shade; col[i * 3 + 2] = c[2] * shade;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

    // ---- trees ----
    const T = o.trees ? await loadTrees(o.abs, o.trees) : null;
    if (T) {
      const pick = [];
      const ox = T.origin[0], oy = T.origin[1];
      for (let i = 0; i < T.x.length; i++) {
        const dx = ox + T.x[i] - E0, dy = oy + T.y[i] - N0;
        if (dx * dx + dy * dy < R * R && (dx * dx + dy * dy) > 2.5) pick.push(i);
      }
      const kinds = { 1: [], 2: [], 3: [], 4: [] };
      for (const i of pick) kinds[T.k[i]] && kinds[T.k[i]].push(i);
      const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 1, 5); trunkGeo.translate(0, 0.5, 0);
      const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
      const ballGeo = new THREE.SphereGeometry(1, 7, 4);
      const trunkMat = new THREE.MeshLambertMaterial({ color: "#4a3a2c" });
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), color = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
      const at = (i) => { const E = ox + T.x[i], N = oy + T.y[i], z = gz(E, N); return [E - E0, (Number.isFinite(z) ? z : z0) - z0, -(N - N0)]; };
      const parts = [];
      // trunks for everything taller than regrowth
      const tall = pick.filter((i) => T.k[i] !== 4);
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, tall.length);
      tall.forEach((i, j) => {
        const [x, y, z] = at(i), h = T.h[i], k = T.k[i];
        const th = k === 2 ? h * 0.7 : k === 3 ? h * 0.5 : h * 0.3, tw = Math.max(0.12, h * 0.012);
        trunks.setMatrixAt(j, m4.compose(v.set(x, y, z), q.identity(), sc.set(tw, th, tw)));
      });
      parts.push(trunks);
      const crown = (list, geom, mat, fn) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(geom, mat, list.length);
        list.forEach((i, j) => {
          const [x, y, z] = at(i), r = fn(T.h[i], x, y, z);
          im.setMatrixAt(j, m4.compose(v.set(r.x, r.y, r.z), q.setFromAxisAngle(UP, (i * 2.399) % 6.28), sc.set(r.sx, r.sy, r.sz)));
          color.setHSL(r.hue, r.sat, r.lit * (0.85 + ((i * 7919) % 100) / 400)); im.setColorAt(j, color);
        });
        parts.push(im);
      };
      const crownMat = new THREE.MeshLambertMaterial({ flatShading: true });
      const roundMat = new THREE.MeshLambertMaterial();
      crown(kinds[1], coneGeo, crownMat, (h, x, y, z) => ({ x, y: y + h * 0.18, z, sx: 0.17 * h + 0.5, sy: h * 0.84, sz: 0.17 * h + 0.5, hue: 0.33, sat: 0.38, lit: 0.17 }));
      crown(kinds[2], ballGeo, roundMat, (h, x, y, z) => ({ x, y: y + h * 0.82, z, sx: 0.14 * h + 0.9, sy: 0.09 * h + 0.6, sz: 0.14 * h + 0.9, hue: 0.27, sat: 0.32, lit: 0.22 }));
      const leafMat = new THREE.MeshLambertMaterial({ transparent: leafless, opacity: leafless ? 0.32 : 1, depthWrite: !leafless });
      crown(kinds[3], ballGeo, leafMat, (h, x, y, z) => leafless
        ? { x, y: y + h * 0.66, z, sx: 0.2 * h + 1, sy: 0.3 * h + 0.6, sz: 0.2 * h + 1, hue: 0.08, sat: 0.18, lit: 0.32 }
        : { x, y: y + h * 0.66, z, sx: 0.2 * h + 1, sy: 0.3 * h + 0.6, sz: 0.2 * h + 1, hue: 0.22, sat: 0.42, lit: 0.3 });
      crown(kinds[4], coneGeo, crownMat, (h, x, y, z) => ({ x, y, z, sx: 0.35 * h + 0.4, sy: h, sz: 0.35 * h + 0.4, hue: 0.25, sat: 0.35, lit: 0.27 }));
      for (const p of parts) { p.instanceMatrix.needsUpdate = true; if (p.instanceColor) p.instanceColor.needsUpdate = true; scene.add(p); }
    }

    // ---- shooting sector and range on the ground ----
    const lineMat = new THREE.LineBasicMaterial({ color: "#ff7a2e", depthTest: false, transparent: true, opacity: 0.9 });
    const groundLine = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([dx, dn]) => {
      const z = gz(E0 + dx, N0 + dn); return new THREE.Vector3(dx, (Number.isFinite(z) ? z - z0 : 0) + 0.6, -dn);
    })), lineMat);
    if (typeof o.facing === "number" && o.range) {
      const a0 = o.facing - o.width / 2, a1 = o.facing + o.width / 2;
      for (const a of [a0, a1]) {
        const pts = []; for (let d = 3; d <= o.range; d += 3) pts.push([Math.sin(a * rad) * d, Math.cos(a * rad) * d]);
        const l = groundLine(pts); l.renderOrder = 5; scene.add(l);
      }
      const arc = []; for (let a = a0; a <= a1; a += 1.5) arc.push([Math.sin(a * rad) * o.range, Math.cos(a * rad) * o.range]);
      const l = groundLine(arc); l.renderOrder = 5; scene.add(l);
      const lab = label(`${o.range} m`, "#ffb07a", 48);
      const am = o.facing * rad, zr = gz(E0 + Math.sin(am) * o.range, N0 + Math.cos(am) * o.range);
      lab.position.set(Math.sin(am) * o.range, (Number.isFinite(zr) ? zr - z0 : 0) + 3, -Math.cos(am) * o.range); scene.add(lab);
    }
    // compass letters on the horizon
    for (const [t, a] of [["N", 0], ["Ö", 90], ["S", 180], ["V", 270]]) {
      const sp = label(t, t === "N" ? "#ff8a80" : "#fff", 80); sp.position.set(Math.sin(a * rad) * 220, 18, -Math.cos(a * rad) * 220); sp.scale.multiplyScalar(2); scene.add(sp);
    }
    // other stands
    for (const s of o.stands || []) {
      const [E, N] = Geo.toSweref(s.lon, s.lat), dx = E - E0, dn = N - N0, d = Math.hypot(dx, dn);
      if (d < 5 || d > R) continue;
      const z = gz(E, N), y = Number.isFinite(z) ? z - z0 : 0;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), new THREE.MeshBasicMaterial({ color: "#ff7a2e" }));
      pole.position.set(dx, y + 4, -dn); scene.add(pole);
      const lab = label(`${s.name || "Pass"} · ${Math.round(d)} m`, "#fff", 44); lab.position.set(dx, y + 10, -dn); scene.add(lab);
    }

    // ---- camera and controls ----
    let eye = o.eye || 1.6, yaw = (o.facing || 0) * rad, pitch = -0.04, follow = false, fov = 60;
    const hIn = box.querySelector(".v3d-h input"), hOut = box.querySelector(".v3d-h output"), dirEl = box.querySelector(".v3d-dir");
    hIn.value = eye; hOut.textContent = `${eye} m`;
    hIn.addEventListener("input", () => { eye = +hIn.value; hOut.textContent = `${eye} m`; });
    const ptrs = new Map(); let pinch0 = 0, fov0 = fov;
    canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fov0 = fov; } });
    canvas.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 2) {
        ptrs.set(e.pointerId, [e.clientX, e.clientY]);
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch0) fov = Math.min(75, Math.max(12, fov0 * pinch0 / d));
        return;
      }
      const k = (fov / 60) * 0.005;
      if (!follow) yaw -= (e.clientX - p[0]) * k;
      pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - p[1]) * k));
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    });
    const up = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); fov = Math.min(75, Math.max(12, fov * (1 + e.deltaY * 0.001))); }, { passive: false });
    const compassBtn = box.querySelector('[data-a="compass"]');
    compassBtn.addEventListener("click", async () => {
      follow = !follow;
      if (follow && o.enableHeading) await o.enableHeading();
      compassBtn.setAttribute("aria-pressed", String(follow));
    });

    let raf = 0, alive = true;
    function size() {
      const w = box.clientWidth, h = box.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", size); size();
    function frame() {
      if (!alive) return;
      if (follow && o.heading) { const hd = o.heading(); if (hd !== null) yaw = hd * rad; }
      camera.fov = fov; camera.updateProjectionMatrix();
      camera.position.set(0, eye, 0);
      camera.rotation.set(0, 0, 0, "YXZ");
      camera.rotation.order = "YXZ"; camera.rotation.y = -yaw; camera.rotation.x = pitch;
      const deg = ((yaw / rad) % 360 + 360) % 360;
      dirEl.textContent = `${o.compassName(deg)} ${Math.round(deg)}°`;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    frame();
    const close = () => {
      alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", size);
      renderer.dispose(); scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); });
      box.remove(); ui = null;
    };
    box.querySelector('[data-a="close"]').addEventListener("click", close);
    ui = { close };
    return ui;
  }
  root.View3D = { open, close: () => ui && ui.close() };
})(window);
