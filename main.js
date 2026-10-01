(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body, header = $('#header'), hero = $('.hero');
  const WA = '233506387636';

  $('#yr').textContent = new Date().getFullYear();

  // ---------- reveal on scroll ----------
  const els = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12 });
    els.forEach(e => io.observe(e));
  } else els.forEach(e => e.classList.add('in'));

  // ---------- header + dock state ----------
  const onScroll = () => {
    const h = hero.offsetHeight, y = scrollY;
    header.classList.toggle('solid', y > h - 90);
    body.classList.toggle('past-hero', y > h * .55);
  };
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  // ---------- hero slideshow ----------
  const slides = $$('.slide'), bars = $$('#pager button');
  let i = 0, timer;
  const show = n => {
    slides[i].classList.remove('active'); bars[i].classList.remove('on');
    i = (n + slides.length) % slides.length;
    slides[i].classList.add('active'); bars[i].classList.add('on');
    const img = slides[i].querySelector('img'); if (img) img.loading = 'eager';
  };
  if (!reduced) timer = setInterval(() => show(i + 1), 5500);
  bars.forEach((b, n) => b.addEventListener('click', () => { show(n); clearInterval(timer); }));

  // ---------- mobile menu ----------
  const burger = $('#burger');
  const setMenu = open => {
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  $$('.menu-overlay a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  // ---------- gallery arrows + mouse drag ----------
  const rail = $('#rail');
  $('#prev').addEventListener('click', () => rail.scrollBy({ left: -340, behavior: 'smooth' }));
  $('#next').addEventListener('click', () => rail.scrollBy({ left: 340, behavior: 'smooth' }));
  let drag = false, sx = 0, sl = 0;
  rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; drag = true; sx = e.clientX; sl = rail.scrollLeft; rail.style.scrollSnapType = 'none'; });
  addEventListener('pointerup', () => { if (drag) { drag = false; rail.style.scrollSnapType = ''; } });
  addEventListener('pointermove', e => { if (drag) rail.scrollLeft = sl - (e.clientX - sx); });

  // ---------- count-up ----------
  const ease = t => t * t * (3 - 2 * t);
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; co.unobserve(e.target);
      const el = e.target, to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, t0 = performance.now();
      if (reduced) return;
      const step = t => { const k = ease(clamp((t - t0) / 1500)); el.textContent = (to * k).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: .6 });
    $$('[data-count]').forEach(el => co.observe(el));
  }

  // ---------- smooth in-page nav ----------
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }));

  // ---------- dish arrows: ask on WhatsApp ----------
  $$('[data-ask]').forEach(a => {
    if (a.classList.contains('go') || a.getAttribute('href') === '#') {
      a.href = `https://wa.me/${WA}?text=` + encodeURIComponent(`Hello BOOMiiS, I'd like to ask about the ${a.dataset.ask}.`);
      a.target = '_blank'; a.rel = 'noopener';
    }
  });

  // ---------- reservation -> WhatsApp ----------
  const form = $('#form'), guests = $('#guests');
  let g = 2;
  $$('[data-step]', form).forEach(b => b.addEventListener('click', () => { g = clamp(g + +b.dataset.step, 1, 30); guests.textContent = g; }));
  const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  form.elements.date.min = form.elements.date.value = today.toISOString().slice(0, 10);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements; let ok = true;
    [f.name, f.date].forEach(i => { const bad = !i.value.trim(); i.classList.toggle('err', bad); ok = ok && !bad; });
    if (!ok) return;
    const d = new Date(f.date.value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = `Hello BOOMiiS! I'd like to reserve a table.\n\nName: ${f.name.value.trim()}\nGuests: ${g}\nDate: ${d}\nTime: ${f.time.value}\nSeating: ${f.seat.value}` + (f.note.value.trim() ? `\nNote: ${f.note.value.trim()}` : '') + '\n\nThank you!';
    window.open(`https://wa.me/${WA}?text=` + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();
