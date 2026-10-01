(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const WA = '233506387636';
  const KEY = 'boomiis-order-v1';
  const cedi = n => 'GH₵' + n.toLocaleString('en-GH');

  $('#yr').textContent = new Date().getFullYear();

  // ---------- mobile menu ----------
  const burger = $('#burger');
  const setMenu = open => {
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  $$('.menu-overlay a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // ---------- tabs: scroll-spy ----------
  const tabs = $$('#tabs a'), cats = $$('.cat');
  const tabRow = $('.tabs__in');
  let current = '';
  const setTab = id => {
    if (id === current) return;
    current = id;
    tabs.forEach(t => {
      const on = t.getAttribute('href') === '#' + id;
      t.classList.toggle('on', on);
      if (on) tabRow.scrollTo({ left: t.offsetLeft - tabRow.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
    });
  };
  const spy = () => {
    const line = innerWidth >= 960 ? 190 : 150;
    let id = cats[0].id;
    for (const c of cats) { if (!c.hidden && c.getBoundingClientRect().top <= line) id = c.id; }
    setTab(id);
  };
  addEventListener('scroll', spy, { passive: true });
  spy();
  tabs.forEach(t => t.addEventListener('click', e => {
    const target = $(t.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if ($('#q').value) { $('#q').value = ''; filter(''); }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', t.getAttribute('href'));
  }));

  // ---------- search ----------
  const empty = $('#empty');
  const filter = q => {
    q = q.trim().toLowerCase();
    let any = false;
    cats.forEach(c => {
      let shown = 0;
      $$('.dish', c).forEach(d => {
        const hit = !q || d.dataset.search.includes(q) || c.querySelector('h2').textContent.toLowerCase().includes(q);
        d.hidden = !hit; if (hit) shown++;
      });
      c.hidden = shown === 0; if (shown) any = true;
    });
    empty.hidden = any;
    spy();
  };
  $('#q').addEventListener('input', e => filter(e.target.value));

  // ---------- order basket ----------
  let order = [];
  try { order = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { order = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(order)); } catch (e) {} };
  const find = name => order.find(o => o.name === name);
  const total = () => order.reduce((s, o) => s + o.price * o.qty, 0);
  const count = () => order.reduce((s, o) => s + o.qty, 0);

  const bar = $('#orderbar'), obCount = $('#obCount'), obTotal = $('#obTotal');
  const lines = $('#lines'), sheetTotal = $('#sheetTotal');
  const buttons = $$('.add, .opt');

  const paintButtons = () => buttons.forEach(b => {
    const o = find(b.dataset.name);
    b.classList.toggle('in', !!o);
    let badge = b.querySelector('.qty');
    if (o) { if (!badge) { badge = document.createElement('span'); badge.className = 'qty'; b.appendChild(badge); } badge.textContent = o.qty; }
    else if (badge) badge.remove();
  });

  const paintSheet = () => {
    lines.innerHTML = '';
    order.forEach(o => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="nm"></div><div class="step"><button type="button" aria-label="Remove one">−</button><span></span><button type="button" aria-label="Add one">+</button></div><div class="lt"></div>`;
      li.querySelector('.nm').innerHTML = '';
      li.querySelector('.nm').append(o.name);
      const sm = document.createElement('small'); sm.textContent = cedi(o.price) + ' each'; li.querySelector('.nm').append(sm);
      li.querySelector('.step span').textContent = o.qty;
      li.querySelector('.lt').textContent = cedi(o.price * o.qty);
      const [minus, plus] = li.querySelectorAll('.step button');
      minus.addEventListener('click', () => change(o.name, -1));
      plus.addEventListener('click', () => change(o.name, 1));
      lines.appendChild(li);
    });
    sheetTotal.textContent = cedi(total());
  };

  const paint = (pop) => {
    const n = count();
    obCount.textContent = n;
    obTotal.textContent = cedi(total());
    bar.classList.toggle('show', n > 0);
    if (pop) { obCount.classList.remove('pop'); void obCount.offsetWidth; obCount.classList.add('pop'); }
    paintButtons(); paintSheet();
    if (!n && body.classList.contains('basket-open')) openSheet(false);
  };

  const change = (name, d, price) => {
    let o = find(name);
    if (!o && d > 0) { o = { name, price, qty: 0 }; order.push(o); }
    if (!o) return;
    o.qty += d;
    if (o.qty <= 0) order = order.filter(x => x !== o);
    save(); paint(d > 0);
  };

  const toast = $('#toast'); let tt;
  const say = msg => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1600); };

  buttons.forEach(b => b.addEventListener('click', () => {
    change(b.dataset.name, 1, +b.dataset.price);
    say('Added ' + b.dataset.name);
    if (navigator.vibrate) navigator.vibrate(12);
  }));

  // sheet
  const sheet = $('#basket');
  const openSheet = open => {
    body.classList.toggle('basket-open', open);
    sheet.setAttribute('aria-hidden', !open);
    bar.setAttribute('aria-expanded', open);
    if (open) $('#closeSheet').focus();
  };
  bar.addEventListener('click', () => openSheet(true));
  $('#closeSheet').addEventListener('click', () => openSheet(false));
  $('#sheetBg').addEventListener('click', () => openSheet(false));
  addEventListener('keydown', e => { if (e.key === 'Escape') { openSheet(false); setMenu(false); } });
  $('#clear').addEventListener('click', () => { order = []; save(); paint(); });

  // swipe down to close
  let y0 = null;
  sheet.addEventListener('touchstart', e => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) openSheet(false); y0 = null; }, { passive: true });

  // delivery address toggle
  const form = $('#orderForm'), addr = $('.addr', form);
  $$('input[name=mode]', form).forEach(r => r.addEventListener('change', () => { addr.hidden = form.elements.mode.value !== 'Delivery'; }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    const bad = !f.name.value.trim();
    f.name.classList.toggle('err', bad);
    if (bad) { f.name.focus(); return; }
    if (!order.length) return;
    const mode = f.mode.value;
    const list = order.map(o => `• ${o.qty} × ${o.name}  ${cedi(o.price * o.qty)}`).join('\n');
    let msg = `Hello BOOMiiS! I'd like to place an order (${mode}).\n\n${list}\n\nTotal: ${cedi(total())}\nName: ${f.name.value.trim()}`;
    if (mode === 'Delivery' && f.addr.value.trim()) msg += `\nAddress: ${f.addr.value.trim()}`;
    if (f.note.value.trim()) msg += `\nNote: ${f.note.value.trim()}`;
    msg += '\n\nThank you!';
    window.open(`https://wa.me/${WA}?text=` + encodeURIComponent(msg), '_blank', 'noopener');
  });

  paint();
  if (location.hash) { const t = $(location.hash); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 60); }
})();
