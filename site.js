/* Scroll choreography: reveals, word-by-word text, pinned horizontal research
   section, cursor glow, and the redshift / lookback-time readout. Vanilla JS. */
(function () {
  var root = document.documentElement;
  var reduce = root.dataset.motion === 'reduced';
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var state = window.skyState = window.skyState || { p: 0, v: 0 };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---- Intro ---- */
  function start() { requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('loaded'); }); }); }
  var intro = document.getElementById('intro'), seen = false;
  try { seen = sessionStorage.getItem('seen') === '1'; } catch (e) {}
  if (!intro || reduce || seen) {
    if (intro) intro.remove();
    start();
  } else {
    var ic = document.getElementById('ic'), t0 = performance.now(), dur = 1300;
    (function tick(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      ic.textContent = ('00' + Math.round(e * 100)).slice(-3);
      if (k < 1) return requestAnimationFrame(tick);
      setTimeout(function () { intro.classList.add('done'); start(); }, 250);
      setTimeout(function () { intro.remove(); }, 1500);
      try { sessionStorage.setItem('seen', '1'); } catch (e2) {}
    })(t0);
  }

  /* ---- Reveal on scroll ---- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    if (el.dataset.delay) el.style.transitionDelay = el.dataset.delay + 'ms';
    if (io) io.observe(el); else el.classList.add('in');
  });

  /* ---- Word-by-word text ---- */
  var scrubs = [];
  document.querySelectorAll('[data-scrub]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    var spans = words.map(function (word, i) {
      var s = document.createElement('span'); s.className = 'w'; s.textContent = word;
      el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    scrubs.push({ el: el, spans: spans });
  });

  /* ---- Pinned horizontal section ---- */
  var hs = document.querySelector('.hscroll'), track, dist = 0;
  function layout() {
    if (!hs) return;
    track = hs.querySelector('.htrack');
    if (window.innerWidth <= 760 || reduce) { hs.style.height = ''; hs.classList.add('flat'); track.style.transform = ''; return; }
    hs.classList.remove('flat');
    dist = Math.max(0, track.scrollWidth - window.innerWidth + 40);
    hs.style.height = (dist + window.innerHeight) + 'px';
  }

  /* ---- Readout: redshift, lookback time, scale, and a live galaxy spectrum ---- */
  function epoch(z) { return z < 0.15 ? 'Today' : z < 1 ? 'Nearby universe' : z < 3 ? 'Cosmic noon' : z < 6 ? 'Reionization' : 'Cosmic dawn'; }
  var ZMAX = 15, K = 3, zShown = 0, lastSedZ = -1;
  var elz = document.getElementById('hz'), elt = document.getElementById('ht'), ele = document.getElementById('he');
  var els = document.getElementById('hs'), ell = document.getElementById('hl');
  var sedc = document.getElementById('sed'), sctx = null, SW = 220, SH = 48;
  if (sedc && sedc.getContext) {
    var sd = Math.min(window.devicePixelRatio || 1, 2);
    sedc.width = SW * sd; sedc.height = SH * sd; sedc.style.width = SW + 'px'; sedc.style.height = SH + 'px';
    sctx = sedc.getContext('2d'); sctx.setTransform(sd, 0, 0, sd, 0, 0);
  }
  var L0 = Math.log(0.5), L1 = Math.log(5.5);
  function sx(lam) { return (Math.log(lam) - L0) / (L1 - L0) * SW; }
  function drawSed(z) {
    if (!sctx || !window.cosmo) return;
    sctx.clearRect(0, 0, SW, SH);
    var bands = [[1.0, 1.3, '90,140,255', 'F115W'], [1.75, 2.25, '90,220,150', 'F200W'], [3.8, 5.0, '255,110,90', 'F444W']];
    sctx.font = '7px -apple-system, Segoe UI, sans-serif'; sctx.textBaseline = 'top';
    bands.forEach(function (bd) {
      var x0 = sx(bd[0]), x1 = sx(bd[1]);
      sctx.fillStyle = 'rgba(' + bd[2] + ',0.16)'; sctx.fillRect(x0, 0, x1 - x0, SH - 10);
      sctx.fillStyle = 'rgba(' + bd[2] + ',0.9)'; var lw = sctx.measureText(bd[3]).width; sctx.fillText(bd[3], Math.max(0, Math.min(x0 + 2, SW - lw - 1)), 2);
    });
    var base = SH - 10, amp = SH - 22, n = 120, i;
    sctx.beginPath(); sctx.moveTo(0, base);
    for (i = 0; i <= n; i++) {
      var lam = Math.exp(L0 + (L1 - L0) * i / n);
      sctx.lineTo(sx(lam), base - Math.min(1, window.cosmo.fnu('S', lam, z)) * amp);
    }
    sctx.lineTo(SW, base); sctx.closePath();
    sctx.fillStyle = 'rgba(236,235,230,0.14)'; sctx.fill();
    sctx.beginPath();
    for (i = 0; i <= n; i++) {
      var l2 = Math.exp(L0 + (L1 - L0) * i / n), y = base - Math.min(1, window.cosmo.fnu('S', l2, z)) * amp;
      if (i) sctx.lineTo(sx(l2), y); else sctx.moveTo(sx(l2), y);
    }
    sctx.strokeStyle = 'rgba(200,180,138,0.95)'; sctx.lineWidth = 1.2; sctx.stroke();
    var lb = 0.1216 * (1 + z);
    if (lb > 0.5 && lb < 5.5) {
      sctx.setLineDash([2, 3]); sctx.strokeStyle = 'rgba(236,235,230,0.55)'; sctx.lineWidth = 1;
      sctx.beginPath(); sctx.moveTo(sx(lb), 10); sctx.lineTo(sx(lb), base); sctx.stroke(); sctx.setLineDash([]);
    }
    sctx.fillStyle = 'rgba(134,139,151,1)'; sctx.textBaseline = 'alphabetic';
    [0.5, 1, 2, 5].forEach(function (t) { var tl = t + (t === 5 ? ' \u00b5m' : ''), tw2 = sctx.measureText(tl).width; sctx.fillText(tl, Math.max(0, Math.min(sx(t) - 6, SW - tw2 - 1)), SH - 1); });
  }

  /* ---- Scroll loop ---- */
  var nav = document.querySelector('.nav'), lastY = window.scrollY, vel = 0, ticking = false, parallax = document.querySelectorAll('[data-speed]');

  function update() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    var p = clamp(y / max, 0, 1);
    var dy = y - lastY; lastY = y;
    vel = vel * 0.8 + dy * 0.2;
    state.p = p; state.v = vel;
    root.style.setProperty('--p', p.toFixed(4));

    if (nav) nav.classList.toggle('hide', dy > 2 && y > 160);
    if (dy < -2) if (nav) nav.classList.remove('hide');

    if (elz) {
      var zt = ZMAX * (Math.exp(K * p) - 1) / (Math.exp(K) - 1);
      zShown += (zt - zShown) * 0.2;
      elz.textContent = zShown.toFixed(2);
      state.z = zShown;
      elt.textContent = window.cosmo.lookback(zShown).toFixed(1) + ' Gyr ago';
      ele.textContent = epoch(zShown);
      if (els) els.textContent = zShown < 0.02 ? '– kpc/″' : window.cosmo.scale(zShown).toFixed(1) + ' kpc/″';
      if (ell) ell.textContent = 'Lyα → ' + (0.1216 * (1 + zShown)).toFixed(2) + ' µm';
      if (Math.abs(zShown - lastSedZ) > 0.01) { lastSedZ = zShown; drawSed(zShown); }
    }

    for (var s = 0; s < scrubs.length; s++) {
      var b = scrubs[s].el.getBoundingClientRect();
      var prog = clamp((vh * 0.82 - b.top) / (vh * 0.55 + b.height * 0.6), 0, 1);
      var spans = scrubs[s].spans, lit = prog * spans.length;
      for (var k = 0; k < spans.length; k++) spans[k].style.opacity = (0.16 + 0.84 * clamp(lit - k, 0, 1)).toFixed(2);
    }

    if (!reduce) {
      for (var i = 0; i < parallax.length; i++) {
        var r = parallax[i].getBoundingClientRect();
        var off = (r.top + r.height / 2 - vh / 2) * parseFloat(parallax[i].dataset.speed);
        parallax[i].style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
      }
      if (hs && !hs.classList.contains('flat')) {
        var hp = clamp(-hs.getBoundingClientRect().top / Math.max(1, hs.offsetHeight - vh), 0, 1);
        track.style.transform = 'translate3d(' + (-hp * dist).toFixed(1) + 'px,0,0)';
        hs.style.setProperty('--hp', hp.toFixed(4));
      }
    }
    if (Math.abs(vel) > 0.05 || Math.abs(zShown - (elz ? ZMAX * (Math.exp(K * p) - 1) / (Math.exp(K) - 1) : 0)) > 0.005) request();
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { layout(); request(); });
  window.addEventListener('load', function () { layout(); request(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layout(); request(); });
  layout(); request();

  /* ---- Active section in the menu ---- */
  var links = document.querySelectorAll('.menu a[href^="#"]');
  if ('IntersectionObserver' in window && links.length) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id ? 'true' : 'false'); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { so.observe(s); });
  }

  /* ---- Cursor ring ---- */
  var cur = document.getElementById('cur');
  if (cur && fine && !reduce) {
    var cx = -100, cy = -100, tx = -100, ty = -100;
    cur.classList.add('on');
    window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      cur.classList.toggle('big', !!(e.target.closest && e.target.closest('a, button, .card, .pub')));
    });
    (function loop() { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)'; requestAnimationFrame(loop); })();
  }

  /* ---- Cursor trail: colour follows blackbody temperature of the pointer's speed;
         a click sends out an expanding, two-ringed ripple (a nod to gravitational waves) ---- */
  var trail = document.getElementById('trail');
  if (trail && fine && !reduce && window.cosmo) {
    var tc = trail.getContext('2d'), tw, th, td, parts = [], rings = [], lx = null, ly = null, tl = performance.now();
    var sizeTrail = function () {
      td = Math.min(window.devicePixelRatio || 1, 2); tw = window.innerWidth; th = window.innerHeight;
      trail.width = tw * td; trail.height = th * td; tc.setTransform(td, 0, 0, td, 0, 0);
    };
    sizeTrail(); window.addEventListener('resize', sizeTrail);
    window.addEventListener('pointermove', function (e) {
      var x = e.clientX, y = e.clientY;
      if (lx === null) { lx = x; ly = y; }
      var dx = x - lx, dy = y - ly, d = Math.sqrt(dx * dx + dy * dy);
      var rgb = window.cosmo.bb(2800 + Math.min(d, 60) * 260);       // slow: orange, fast: blue-white
      var n = Math.min(6, 1 + (d / 6 | 0));
      for (var i = 0; i < n; i++) {
        var t = i / n;
        parts.push({ x: lx + dx * t + (Math.random() - 0.5) * 2, y: ly + dy * t + (Math.random() - 0.5) * 2,
                     vx: (Math.random() - 0.5) * 0.3 + dx * 0.01, vy: (Math.random() - 0.5) * 0.3 + dy * 0.01,
                     life: 1, rgb: rgb });
      }
      if (parts.length > 300) parts.splice(0, parts.length - 300);
      lx = x; ly = y;
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) { rings.push({ x: e.clientX, y: e.clientY, t: 0 }); });
    (function tloop(now) {
      var dt = Math.min((now - tl) / 1000, 0.05); tl = now;
      tc.clearRect(0, 0, tw, th);
      tc.globalCompositeOperation = 'lighter';
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life -= dt / 1.3;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy;
        var a = p.life * p.life * 0.85, r = 0.5 + p.life * 2.6;
        var g = tc.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        g.addColorStop(0, 'rgba(' + (p.rgb[0] | 0) + ',' + (p.rgb[1] | 0) + ',' + (p.rgb[2] | 0) + ',' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + (p.rgb[0] | 0) + ',' + (p.rgb[1] | 0) + ',' + (p.rgb[2] | 0) + ',0)');
        tc.fillStyle = g; tc.beginPath(); tc.arc(p.x, p.y, r * 3, 0, 6.2832); tc.fill();
      }
      for (var k = rings.length - 1; k >= 0; k--) {
        var rg = rings[k]; rg.t += dt / 1.0;
        if (rg.t >= 1) { rings.splice(k, 1); continue; }
        var e1 = 1 - Math.pow(1 - rg.t, 3), al = (1 - rg.t) * 0.7;
        tc.lineWidth = 1.2;
        tc.strokeStyle = 'rgba(200,180,138,' + al.toFixed(3) + ')'; tc.beginPath(); tc.arc(rg.x, rg.y, 6 + e1 * 120, 0, 6.2832); tc.stroke();
        tc.strokeStyle = 'rgba(160,190,255,' + (al * 0.6).toFixed(3) + ')'; tc.beginPath(); tc.arc(rg.x, rg.y, 6 + e1 * 84, 0, 6.2832); tc.stroke();
      }
      tc.globalCompositeOperation = 'source-over';
      requestAnimationFrame(tloop);
    })(tl);
  }

  /* ---- Cursor glow ---- */
  if (fine && !reduce) {
    window.addEventListener('pointermove', function (e) {
      root.style.setProperty('--mx', e.clientX + 'px'); root.style.setProperty('--my', e.clientY + 'px');
    }, { passive: true });
  }

  /* ---- Motion switch ---- */
  var mb = document.getElementById('motion');
  if (mb) {
    mb.textContent = reduce ? 'Motion: reduced' : 'Motion: full';
    mb.setAttribute('aria-pressed', reduce ? 'false' : 'true');
    mb.addEventListener('click', function () {
      try { localStorage.setItem('motion', reduce ? 'full' : 'reduced'); } catch (e) {}
      location.reload();
    });
  }

  /* ---- Fade between pages ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target || reduce) return;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin || /\.pdf$/i.test(u.pathname)) return;
    if (u.pathname === location.pathname && u.hash) return;
    e.preventDefault(); document.body.classList.add('leaving');
    setTimeout(function () { location.href = a.href; }, 380);
  });
  window.addEventListener('pageshow', function () { document.body.classList.remove('leaving'); });
})();
