(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- wordmark letters ----------
  const row = $('.wordmark__row');
  'BOOMiiS'.split('').forEach((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.setProperty('--i', i);
    if (ch === 'i') s.className = 'lc';
    row.appendChild(s);
  });

  // ---------- curtain ----------
  const lift = () => $('#curtain').classList.add('done');
  addEventListener('load', () => setTimeout(lift, 700));
  setTimeout(lift, 2600);
  $('#yr').textContent = new Date().getFullYear();

  // ---------- WebGL ember-flow shader ----------
  const canvas = $('#gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  const U = { t: 0, p: 0, mx: .5, my: .5, ms: 0 };
  let draw = () => {};

  if (gl) {
    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `precision highp float;
uniform vec2 uRes,uM;uniform float uT,uP,uMs;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
 vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
 float t=uT*.06;
 vec2 m=(uM-.5)*vec2(uRes.x/min(uRes.x,uRes.y),uRes.y/min(uRes.x,uRes.y));
 float d=length(p-m);
 p+=normalize(p-m+1e-4)*exp(-d*d*9.)*.07*uMs;
 vec2 q=vec2(fbm(p*1.3+t),fbm(p*1.3+vec2(5.2,1.3)-t));
 vec2 r=vec2(fbm(p*1.7+q*2.+vec2(1.7,9.2)+t*1.4),fbm(p*1.7+q*2.+vec2(8.3,2.8)-t));
 float f=fbm(p*1.4+r*2.3);
 f+=.28*exp(-d*d*7.)*(.35+uMs);
 vec3 wine=vec3(.078,.031,.039),mar=vec3(.35,.09,.13),emb=vec3(.85,.33,.12),gold=vec3(.89,.69,.29),grn=vec3(.08,.34,.22);
 vec3 c=mix(wine,mar,smoothstep(.15,.7,f));
 c=mix(c,emb,smoothstep(.55,1.,f*f*1.7)*(.35+.65*uP));
 c=mix(c,gold,smoothstep(.8,1.1,f+r.x*.25)*.55);
 c=mix(c,grn,smoothstep(.45,1.,uP)*smoothstep(.35,.85,q.x)*.6);
 c*=1.-.55*smoothstep(.3,1.1,length(p*vec2(.9,.7)));
 gl_FragColor=vec4(c,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = n => gl.getUniformLocation(prog, n);
      const uRes = u('uRes'), uT = u('uT'), uP = u('uP'), uM = u('uM'), uMs = u('uMs');
      let scale = innerWidth < 700 ? .5 : .6;
      const size = () => {
        const dpr = Math.min(devicePixelRatio || 1, 2) * scale;
        canvas.width = Math.max(2, Math.floor(canvas.clientWidth * dpr));
        canvas.height = Math.max(2, Math.floor(canvas.clientHeight * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      size(); addEventListener('resize', size);
      draw = () => {
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uT, U.t); gl.uniform1f(uP, U.p);
        gl.uniform2f(uM, U.mx, 1 - U.my); gl.uniform1f(uMs, U.ms);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
    }
  }

  // ---------- pointer / touch glow ----------
  let tx = .5, ty = .5, tms = 0;
  const point = e => {
    const t = e.touches ? e.touches[0] : e;
    tx = t.clientX / innerWidth; ty = t.clientY / innerHeight; tms = 1;
  };
  addEventListener('pointermove', point, { passive: true });
  addEventListener('touchstart', point, { passive: true });
  addEventListener('touchmove', point, { passive: true });

  // ---------- hero scroll director ----------
  const hero = $('.hero'), s1 = $('.scene--1'), s2 = $('.scene--2'), s3 = $('.scene--3');
  const lines = $$('[data-line]'), rail = $$('.hero__rail b'), cue = $('#cue');
  let target = 0, prog = 0, visible = true;

  const win = (p, a, b) => clamp((p - a) / (b - a));
  const show = (el, o, y = 0, s = 1, blur = 0) => {
    el.style.opacity = o;
    el.style.visibility = o < .01 ? 'hidden' : 'visible';
    el.style.transform = `translate3d(0,${y}px,0) scale(${s})`;
    el.style.filter = blur > .1 ? `blur(${blur}px)` : 'none';
  };

  const direct = p => {
    // scene 1 exits 0.16 → 0.30
    const o1 = 1 - ease(win(p, .16, .30));
    show(s1, o1, -ease(win(p, .16, .30)) * 60, 1 + ease(win(p, .12, .30)) * .35, (1 - o1) * 14);
    // scene 2: in .30–.38, lines stagger, out .62–.72
    const in2 = ease(win(p, .30, .38)), out2 = ease(win(p, .62, .72));
    show(s2, in2 * (1 - out2), (1 - in2) * 50 - out2 * 60, 1 + out2 * .15, out2 * 12);
    lines.forEach((l, i) => {
      const a = .33 + i * .08, k = ease(win(p, a, a + .1));
      l.style.opacity = k; l.style.transform = `translateY(${(1 - k) * 46}px)`;
    });
    // scene 3 in .74–.86
    const in3 = ease(win(p, .74, .86));
    show(s3, in3, (1 - in3) * 70, .92 + in3 * .08, (1 - in3) * 12);
    // rail + cue
    const idx = p < .3 ? 0 : p < .72 ? 1 : 2;
    rail.forEach((b, i) => b.classList.toggle('on', i === idx));
    cue.style.opacity = p > .04 ? 0 : '';
    cue.style.animation = p > .04 ? 'none' : '';
  };

  const measure = () => {
    const r = hero.getBoundingClientRect();
    const total = hero.offsetHeight - innerHeight;
    target = clamp(-r.top / total);
    visible = r.bottom > 0;
  };

  // ---------- global scroll bits ----------
  const bar = $('#progress'), nav = $('#nav'), dock = $('#dock');
  const para = $('#parallax');
  const words = (() => {
    const el = $('#statement'); const txt = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    return txt.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w + ' '; el.appendChild(s); return s; });
  })();
  const stEl = $('#statement');

  const onScroll = () => {
    measure();
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${clamp(scrollY / max)})`;
    nav.classList.toggle('solid', scrollY > innerHeight * .8);
    dock.classList.toggle('show', target > .9 || scrollY > hero.offsetHeight - innerHeight * 1.2);
    // word-by-word reveal
    const r = stEl.getBoundingClientRect();
    const k = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35));
    const n = Math.floor(k * (words.length + 1));
    words.forEach((w, i) => w.classList.toggle('on', i < n));
    // parallax
    if (para) {
      const pr = para.parentElement.getBoundingClientRect();
      if (pr.bottom > 0 && pr.top < innerHeight) {
        const m = (pr.top + pr.height / 2 - innerHeight / 2) / innerHeight;
        para.style.transform = `translate3d(0,${(-9 + m * -9)}%,0)`;
      }
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // ---------- render loop ----------
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (visible || reduce) {
      prog += (target - prog) * (1 - Math.pow(.0009, dt));
      U.t += dt; U.p = prog;
      U.mx += (tx - U.mx) * .08; U.my += (ty - U.my) * .08;
      tms *= .992; U.ms += (tms - U.ms) * .06;
      direct(prog); draw();
    }
    if (!reduce) requestAnimationFrame(frame);
  };
  if (reduce) { prog = target; direct(prog); draw(); addEventListener('scroll', () => { prog = target; direct(prog); draw(); }, { passive: true }); }
  else requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  // ---------- reveals ----------
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // ---------- count-up ----------
  const co = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; co.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, t0 = performance.now();
    const step = t => { const k = ease(clamp((t - t0) / 1600)); el.textContent = (to * k).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => co.observe(el));

  // ---------- smooth in-page nav (hero anchors land at the end of the story) ----------
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }));

  // ---------- horizontal rail: wheel → sideways on desktop ----------
  const railEl = $('#rail');
  let drag = false, sx = 0, sl = 0;
  railEl.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = true; sx = e.clientX; sl = railEl.scrollLeft; railEl.style.scrollSnapType = 'none'; });
  addEventListener('pointerup', () => { if (drag) { drag = false; railEl.style.scrollSnapType = ''; } });
  addEventListener('pointermove', e => { if (drag) railEl.scrollLeft = sl - (e.clientX - sx); });

  // ---------- reservation → WhatsApp ----------
  const form = $('#form'), guests = $('#guests');
  let g = 2;
  $$('[data-step]', form).forEach(b => b.addEventListener('click', () => { g = clamp(g + +b.dataset.step, 1, 30, ); guests.textContent = g; }));
  const dateIn = form.elements.date;
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  dateIn.min = dateIn.value = today.toISOString().slice(0, 10);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements; let ok = true;
    [f.name, f.date].forEach(i => { const bad = !i.value.trim(); i.classList.toggle('err', bad); ok = ok && !bad; });
    if (!ok) return;
    const d = new Date(f.date.value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = `Hello BOOMiiS! I'd like to reserve a table.\n\nName: ${f.name.value.trim()}\nGuests: ${g}\nDate: ${d}\nTime: ${f.time.value}\nSeating: ${f.seat.value}` + (f.note.value.trim() ? `\nNote: ${f.note.value.trim()}` : '') + '\n\nThank you!';
    window.open('https://wa.me/233506387636?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();
