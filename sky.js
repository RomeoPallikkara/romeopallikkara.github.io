/* The sky as a telescope would see it.
   - Stars live on the celestial sphere. Their positions follow a Milky Way band built
     from the real galactic-to-equatorial rotation; magnitudes follow a realistic number
     count (N ~ 10^(0.55 m)); colours come from blackbody temperatures. They do not
     twinkle: there is no atmosphere in space.
   - Scrolling pans the telescope across the sky (gnomonic projection).
   - Deep field: as the readout's redshift grows, distant galaxies appear with JWST-style
     colours (F115W / F200W / F444W as blue / green / red), including the Lyman-alpha break
     and intergalactic absorption, and angular sizes from the LCDM transverse scale.
   Illustrative, not a data image. Reads window.skyState = { p, z }.
   Pauses when the tab is hidden. */
(function () {
  var canvas = document.getElementById('sky');
  if (!canvas || !canvas.getContext || !window.cosmo) return;
  var ctx = canvas.getContext('2d');
  var reduce = document.documentElement.dataset.motion === 'reduced';
  var S = window.skyState = window.skyState || { p: 0, z: 0 };
  var C = window.cosmo;

  var D2R = Math.PI / 180;
  var w, h, dpr, F, stars = [], gals = [], pp = 0, zz = 0, clock = 0, last = 0, running = true;
  var ox = 0, oy = 0, tx = 0, ty = 0;

  // ICRS -> Galactic rotation matrix (Hipparcos); the inverse is its transpose.
  var A = [[-0.0548755604, -0.8734370902, -0.4838350155],
           [ 0.4941094279, -0.4448296300,  0.7469822445],
           [-0.8676661490, -0.1980763734,  0.4559837762]];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function gal2eq(l, b) {
    var cb = Math.cos(b), g0 = cb * Math.cos(l), g1 = cb * Math.sin(l), g2 = Math.sin(b);
    return [A[0][0] * g0 + A[1][0] * g1 + A[2][0] * g2,
            A[0][1] * g0 + A[1][1] * g1 + A[2][1] * g2,
            A[0][2] * g0 + A[1][2] * g1 + A[2][2] * g2];
  }
  function sphere() {
    var u = rand(-1, 1), a = rand(0, 6.2832), s = Math.sqrt(1 - u * u);
    return [s * Math.cos(a), s * Math.sin(a), u];
  }

  // Rough spectral-type mix of a magnitude-limited sample (effective temperatures, K).
  var TEMPS = [[3800, 0.24], [4600, 0.27], [5800, 0.13], [7400, 0.20], [10500, 0.11], [22000, 0.05]];
  function pickT() {
    var u = Math.random(), c = 0;
    for (var i = 0; i < TEMPS.length; i++) { c += TEMPS[i][1]; if (u <= c) return TEMPS[i][0] * rand(0.9, 1.1); }
    return 5800;
  }

  function galaxyColor(z, kind) {
    var r = C.fnu(kind, 4.44, z), g = C.fnu(kind, 2.0, z), b = C.fnu(kind, 1.15, z);
    var m = Math.max(r, g, b);
    if (m < 1e-6) return [40, 0, 0];
    return [255 * Math.pow(r / m, 0.7), 255 * Math.pow(g / m, 0.7), 255 * Math.pow(b / m, 0.7)];
  }

  function build() {
    stars = [];
    for (var i = 0; i < 1800; i++) {
      var l, b;
      for (;;) {                                   // denser toward the Galactic centre
        l = rand(-Math.PI, Math.PI);
        if (Math.random() < 0.35 + 0.65 * Math.exp(-Math.pow(l / (55 * D2R), 2))) break;
      }
      if (Math.random() < 0.6) b = -Math.log(1 - Math.random() * 0.999) * 9 * D2R * (Math.random() < 0.5 ? -1 : 1);
      else b = Math.asin(rand(-1, 1));             // halo and nearby stars: isotropic
      var v = gal2eq(l, b);
      var k = 0.55, mmin = 0.5, mmax = 7.0;
      var m = mmin + Math.log(1 + Math.random() * (Math.pow(10, k * (mmax - mmin)) - 1)) / Math.LN10 / k;
      var rgb = C.bb(pickT());
      var red = Math.exp(-Math.abs(b) / (7 * D2R)) * 0.35;      // interstellar reddening near the plane
      stars.push({ x: v[0], y: v[1], z: v[2], m: m, r: rgb[0], g: rgb[1] * (1 - 0.10 * red), b: rgb[2] * (1 - 0.45 * red) });
    }
    gals = [];
    while (gals.length < 300) {
      var s = sphere();
      var gb = Math.asin(A[2][0] * s[0] + A[2][1] * s[1] + A[2][2] * s[2]);
      if (Math.abs(gb) < 25 * D2R) continue;       // keep the deep field away from the plane
      var zr = Math.exp(rand(Math.log(0.3), Math.log(15.5)));
      var u = Math.random(), kind = (zr < 4 && u < 0.3) ? 'Q' : (u < 0.78 ? 'S' : 'D');
      var rk = rand(0.5, 4.5) * (zr > 6 ? 0.5 : 1);             // half-light radius, kpc
      var theta = rk / C.scale(zr);                             // arcsec, from the transverse scale
      gals.push({ x: s[0], y: s[1], z: s[2], zr: zr, col: galaxyColor(zr, kind),
                  size: 1.8 + 7 * Math.sqrt(theta / 0.5), q: rand(0.35, 1), pa: rand(0, 3.1416),
                  a0: Math.min(0.95, 1.6 / Math.pow(1 + zr, 0.6)) * rand(0.6, 1) });
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = Math.max(w, h) * 0.5 / Math.tan(35 * D2R);             // 70-degree field of view
  }

  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var ra0 = (270 + pp * 85) * D2R - ox * 0.03 + clock * 0.0015;
    var dec0 = (-20 + pp * 32) * D2R + oy * 0.03;
    var cd = Math.cos(dec0), sd = Math.sin(dec0), ca = Math.cos(ra0), sa = Math.sin(ra0);
    var fx = cd * ca, fy = cd * sa, fz = sd;                   // pointing
    var ex = -sa, ey = ca, ez = 0;                             // east
    var nx = -sd * ca, ny = -sd * sa, nz = cd;                 // north
    var cx = w / 2, cy = h / 2, i, s, Z, X, Y, a, r;

    // Deep field first, so stars sit on top.
    for (i = 0; i < gals.length; i++) {
      s = gals[i];
      var vis = (zz - s.zr) / 1.2;
      if (vis <= 0) continue;
      Z = s.x * fx + s.y * fy + s.z * fz;
      if (Z < 0.15) continue;
      X = cx - (s.x * ex + s.y * ey + s.z * ez) / Z * F;
      Y = cy - (s.x * nx + s.y * ny + s.z * nz) / Z * F;
      if (X < -20 || X > w + 20 || Y < -20 || Y > h + 20) continue;
      a = s.a0 * Math.min(1, vis);
      ctx.save();
      ctx.translate(X, Y); ctx.rotate(s.pa); ctx.scale(1, s.q);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.size);
      g.addColorStop(0, rgba(s.col, a)); g.addColorStop(0.4, rgba(s.col, a * 0.45)); g.addColorStop(1, rgba(s.col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s.size, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    // Stars: flux ~ 10^(-0.4 m); no twinkling.
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      Z = s.x * fx + s.y * fy + s.z * fz;
      if (Z < 0.15) continue;
      X = cx - (s.x * ex + s.y * ey + s.z * ez) / Z * F;
      Y = cy - (s.x * nx + s.y * ny + s.z * nz) / Z * F;
      if (X < -20 || X > w + 20 || Y < -20 || Y > h + 20) continue;
      a = 0.10 + 0.9 * Math.pow((7.3 - s.m) / 6.8, 1.7);
      r = 0.45 + (7.2 - s.m) * 0.19;
      var col = [s.r, s.g, s.b];
      if (s.m < 3.2) {
        var gr = 3 + (3.2 - s.m) * 3.5;
        var gg = ctx.createRadialGradient(X, Y, 0, X, Y, gr);
        gg.addColorStop(0, rgba(col, a * 0.5)); gg.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(X, Y, gr, 0, 6.2832); ctx.fill();
      }
      if (s.m < 1.6) {                                         // diffraction spikes of the brightest
        var L = 7 + (1.6 - s.m) * 9;
        ctx.strokeStyle = rgba(col, a * 0.28); ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(X - L, Y); ctx.lineTo(X + L, Y); ctx.moveTo(X, Y - L); ctx.lineTo(X, Y + L); ctx.stroke();
      }
      ctx.fillStyle = rgba(col, a);
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.2832); ctx.fill();
    }
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.1) || 0;
    last = now;
    if (!reduce) clock += dt;
    pp += (S.p - pp) * 0.05;
    zz += (S.z - zz) * 0.12;
    ox += (tx - ox) * 0.04; oy += (ty - oy) * 0.04;
    draw();
    requestAnimationFrame(frame);
  }

  resize(); build();
  window.addEventListener('resize', resize);
  if (!reduce) window.addEventListener('pointermove', function (e) {
    tx = e.clientX / w - 0.5; ty = e.clientY / h - 0.5;
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();
