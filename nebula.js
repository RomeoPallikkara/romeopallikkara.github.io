/* Physically structured gas-and-galaxy backdrop, rendered in a fragment shader.
   - Ionized gas: emission measure ~ n^2, H-alpha / [O III] / H-beta line colours with
     ionization stratification, blue reflection nebulosity.
   - Dust: extinction rising toward the blue (reddening), forming dark lanes.
   - Spiral galaxy: de Vaucouleurs bulge, exponential disc, two logarithmic arms
     (pitch ~20 deg), HII-region knots in the arms, dust lanes on the leading edge.
   Illustrative, not a data image. Falls back to CSS gradients without WebGL. */
(function () {
  var canvas = document.getElementById('nebulagl');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  var reduce = document.documentElement.dataset.motion === 'reduced';

  var vert = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var frag = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;uniform float uTime;uniform float uP;uniform vec2 uMouse;',
    'float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);',
    ' float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));',
    ' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    ' for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;',
    ' vec2 p=(uv-.5)*vec2(uRes.x/uRes.y,1.);',
    ' p+=uMouse*.02; p.y-=uP*.5; p.x+=uP*.15;',
    ' float t=uTime;',
    // ---- ionized gas
    ' vec2 q=vec2(fbm(p*1.3+vec2(0.,t*.006)),fbm(p*1.3+vec2(5.2,1.3)-t*.005));',
    ' vec2 r=vec2(fbm(p*1.3+3.*q+vec2(1.7,9.2)),fbm(p*1.3+3.*q+vec2(8.3,2.8)));',
    ' float D=fbm(p*1.3+3.*r);',
    ' float em=pow(smoothstep(.30,.85,D),2.);',            // recombination: ~ n^2
    ' float core=smoothstep(.55,.90,D);',                  // high-ionization zone
    ' vec3 Ha=vec3(.95,.14,.17),Hb=vec3(.10,.50,.95),OIII=vec3(.04,.80,.58),SII=vec3(.60,.03,.05);',
    ' vec3 gas=mix(Ha+.15*Hb,OIII,core*.8);',
    ' gas=mix(gas,SII,(1.-smoothstep(.30,.50,D))*.5);',
    ' gas*=em*.55;',
    ' float refl=smoothstep(.45,.80,fbm(p*2.1+r*2.+4.))*(1.-core);',
    ' vec3 col=gas+vec3(.16,.28,.62)*refl*.20;',           // Rayleigh-like blue scattering
    // ---- dust: extinction stronger in the blue
    ' float tau=2.4*smoothstep(.50,.78,fbm(p*3.+r*2.+9.));',
    ' col*=exp(-tau*vec3(.80,1.0,1.45)*.9);',
    // ---- spiral galaxy
    ' vec2 g=p-vec2(.40-uP*.05,-.08+uP*.2);',
    ' g=rot(-.5)*g; g.y*=1.45;',                            // position angle, ~46 deg inclination
    ' float rg=length(g)+1e-4,ph=atan(g.y,g.x);',
    ' float Re=.03,Rd=.2;',
    ' float bulge=exp(-7.67*(pow(rg/Re,.25)-1.))*.06;',    // r^(1/4) law
    ' float disk=exp(-rg/Rd)*.9;',                         // exponential disc
    ' float armPhase=2.*(ph-2.2*log(rg/.03));',            // log spiral, pitch ~24 deg (cot = 2.2), m=2
    ' float arm=pow(.5+.5*cos(armPhase),2.2);',
    ' float armMask=smoothstep(.04,.12,rg);',
    ' float hii=smoothstep(.72,.90,noise(g*38.))*arm*armMask*exp(-rg/(Rd*.9));',
    ' float young=disk*arm*armMask;',
    ' float old=disk*(.35+.65*arm*armMask);',
    ' vec3 cBulge=vec3(1.,.74,.44),cOld=vec3(1.,.88,.70),cYoung=vec3(.62,.76,1.),cHII=vec3(1.,.25,.38);',
    ' vec3 gl=bulge*cBulge*1.6+old*cOld*.22+young*cYoung*.75+hii*cHII*.7;',
    ' float lane=pow(.5+.5*cos(armPhase-.9),6.)*armMask*exp(-rg/(Rd*1.2));',   // leading-edge dust lanes
    ' gl*=exp(-lane*2.2*vec3(.80,1.0,1.45));',
    ' gl*=smoothstep(.75,.5,rg);',
    ' col+=gl;',
    // ---- foreground fades as the view goes deeper
    ' col*=1.-smoothstep(.08,.85,uP)*.82;',
    ' col*=1.-1.2*dot(uv-.5,uv-.5);',
    ' col*=mix(.50,1.,smoothstep(0.,.8,uv.x));',
    ' col*=.9;',
    ' col+=(hash(gl_FragCoord.xy+fract(t))-.5)/120.;',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (window.console) console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'),
      uP = gl.getUniformLocation(prog, 'uP'), uMouse = gl.getUniformLocation(prog, 'uMouse');

  var SCALE = 0.6, slow = 0, frames = 0, tPrev = 0, acc = 0;
  var dirty = true, running = true, pShown = 0, mx = 0, my = 0, tmx = 0, tmy = 0, t0 = performance.now();

  function resize() {
    canvas.width = Math.max(2, Math.round(window.innerWidth * SCALE));
    canvas.height = Math.max(2, Math.round(window.innerHeight * SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    dirty = true;
  }

  function adapt(now) {
    if (reduce || !tPrev) { tPrev = now; return; }
    acc += now - tPrev; tPrev = now; frames++;
    if (frames < 90) return;
    var avg = acc / frames; frames = 0; acc = 0;
    if (avg > 26) {                                   // under ~38 fps: step quality down, then give up
      slow++;
      if (SCALE > 0.35) { SCALE = SCALE > 0.5 ? 0.45 : 0.35; resize(); }
      else if (slow > 3) { running = false; document.documentElement.classList.remove('gl'); }
    }
  }

  function render(now) {
    if (!running) return;
    adapt(now);
    var target = (window.skyState && window.skyState.p) || 0;
    pShown += (target - pShown) * 0.08;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    if (!reduce || dirty || Math.abs(target - pShown) > 0.0005) {
      gl.uniform1f(uTime, reduce ? 12.0 : (now - t0) / 1000);
      gl.uniform1f(uP, pShown);
      gl.uniform2f(uMouse, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      dirty = false;
    }
    requestAnimationFrame(render);
  }

  resize();
  window.addEventListener('resize', resize);
  if (!reduce) window.addEventListener('pointermove', function (e) {
    tmx = e.clientX / window.innerWidth - 0.5; tmy = 0.5 - e.clientY / window.innerHeight;
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) requestAnimationFrame(render);
  });
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); running = false; document.documentElement.classList.remove('gl'); });

  // Debug aid: luminance statistics of the backdrop at a given page progress.
  window.__nebulaProbe = function (p) {
    var W = 64, H = 40, old = [canvas.width, canvas.height];
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, 12.0); gl.uniform1f(uP, p); gl.uniform2f(uMouse, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    var px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var lin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var ls = [], i;
    for (i = 0; i < px.length; i += 4) ls.push(0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]));
    ls.sort(function (a, b) { return a - b; });
    var out = { mean: ls.reduce(function (a, b) { return a + b; }, 0) / ls.length, p95: ls[Math.floor(ls.length * 0.95)], max: ls[ls.length - 1] };
    canvas.width = old[0]; canvas.height = old[1]; gl.viewport(0, 0, old[0], old[1]); gl.uniform2f(uRes, old[0], old[1]); dirty = true;
    return out;
  };

  document.documentElement.classList.add('gl');
  requestAnimationFrame(render);
})();
