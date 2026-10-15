/* Small astrophysics toolkit shared by the background and the readout.
   Flat LCDM, H0 = 70 km/s/Mpc, Omega_m = 0.3. Pure functions, no dependencies. */
(function () {
  var H0 = 70, Om = 0.3, OL = 0.7, c = 299792.458;
  var hubbleGyr = 977.8 / H0;     // 1/H0 in Gyr
  var hubbleMpc = c / H0;         // c/H0 in Mpc
  var ARCSEC = 4.84813681e-6;     // radians per arcsecond

  function E(z) { return Math.sqrt(Om * Math.pow(1 + z, 3) + OL); }
  function simpson(f, a, b, n) {
    if (b <= a) return 0;
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }
  function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

  var cosmo = window.cosmo = {
    /* Lookback time in Gyr. */
    lookback: function (z) { return hubbleGyr * simpson(function (x) { return 1 / ((1 + x) * E(x)); }, 0, z, 120); },
    /* Comoving distance in Mpc. */
    Dc: function (z) { return hubbleMpc * simpson(function (x) { return 1 / E(x); }, 0, z, 120); },
    /* Proper transverse scale in kpc per arcsecond. */
    scale: function (z) { return z < 1e-3 ? 0 : cosmo.Dc(z) / (1 + z) * 1000 * ARCSEC; },

    /* Blackbody colour (approximate sRGB, Tanner Helland fit), lightly desaturated for display. */
    bb: function (T) {
      var t = Math.max(10, Math.min(400, T / 100)), r, g, b;
      if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
      else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
      if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
      r = clamp(r); g = clamp(g); b = clamp(b);
      return [r + (255 - r) * 0.12, g + (255 - g) * 0.12, b + (255 - b) * 0.12];
    },

    /* Relative f_nu of a model galaxy seen at observed wavelength lam (micron) and redshift z.
       'S' star-forming (flat f_nu, blue UV), 'D' dusty star-forming (red slope),
       'Q' quiescent (4000 A break, red). Lyman-alpha forest absorption blueward of
       1216 A (rest), complete absorption below the Lyman limit (912 A). */
    fnu: function (kind, lam, z) {
      var lr = lam / (1 + z), f;
      if (kind === 'S') f = 1;
      else if (kind === 'D') f = Math.pow(lr / 0.16, 1.0);
      else f = Math.pow(lr / 0.4, 1.5) * (lr < 0.4 ? 0.45 : 1);
      if (lr < 0.0912) return 0;
      if (lr < 0.1216) f *= Math.exp(-0.0036 * Math.pow(1 + z, 3.46));
      return f;
    }
  };
})();
