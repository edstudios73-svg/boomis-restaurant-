(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const KEY = 'boomiis-order-v1';

  // ---------- payment details: edit here when the final MoMo number / bank account is confirmed ----------
  const PAY = {
    // add more accounts to this list to let customers choose a network; the first is the default
    momo: [
      { number: '0242165783', name: 'BOOMIIS LIMITED' },
      { number: '0506387636', name: 'BOOMIIS LIMITED' }
    ],
    bank: null // e.g. { bank: 'GCB Bank', name: 'BOOMiiS Restaurant', account: '1234567890', branch: 'East Legon' }
  };
  const cedi = n => 'GH₵' + n.toLocaleString('en-GH');

  $('#yr').textContent = new Date().getFullYear();

  // ---------- menu changes made in /admin (prices, sold out, new or removed dishes) ----------
  // Applying is idempotent: every dish is reset to the printed menu first, so changes can be re-applied
  // when the live copy arrives from the database.
  const soldOut = li => {
    li.classList.add('soldout');
    li.querySelectorAll('.add, .opt').forEach(b => { b.disabled = true; b.setAttribute('aria-label', 'Sold out'); });
    const tag = document.createElement('span'); tag.className = 'sold'; tag.textContent = 'Sold out';
    li.querySelector('.dish__row').appendChild(tag);
  };
  const setDesc = (li, text) => {
    let p = li.querySelector('.dish__main > p');
    if (!text) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('p'); li.querySelector('.dish__row').after(p); }
    p.textContent = text;
  };
  const printed = new Map();
  $$('.dish[data-id]').forEach(li => printed.set(li.dataset.id, li.cloneNode(true)));
  const applyMenu = m => {
    $$('.dish[data-added]').forEach(li => li.remove());
    printed.forEach((tpl, id) => { const cur = $(`.dish[data-id="${id}"]`); if (cur) cur.replaceWith(tpl.cloneNode(true)); });
    Object.entries(m.items || {}).forEach(([id, o]) => {
      const li = $(`.dish[data-id="${id}"]`);
      if (!li) return;
      if (o.deleted) { li.classList.add('gone'); return; }
      if (o.name) {
        li.querySelector('h3').textContent = o.name;
        const add = li.querySelector('.add'); if (add) add.dataset.name = o.name;
        li.querySelectorAll('.opt').forEach(b => { b.dataset.name = b.dataset.name.replace(/^.*\(/, o.name + ' ('); });
      }
      if (o.desc !== undefined) setDesc(li, o.desc);
      if (o.price != null) {
        li.querySelector('.price').textContent = cedi(o.price);
        let add = li.querySelector('.add');
        if (add && add.tagName === 'A') {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'add'; btn.innerHTML = '<svg aria-hidden="true"><use href="#i-plus"/></svg>';
          btn.dataset.name = li.querySelector('h3').textContent; btn.setAttribute('aria-label', 'Add ' + btn.dataset.name + ' to your order');
          add.replaceWith(btn); add = btn;
        }
        if (add) add.dataset.price = o.price;
      }
      if (Array.isArray(o.options)) {
        const opts = li.querySelectorAll('.opt');
        o.options.forEach((p, i) => { if (opts[i] && p != null) { opts[i].dataset.price = p; opts[i].querySelector('b').textContent = cedi(p); } });
        const from = li.querySelector('.from'); if (from) from.textContent = 'from ' + cedi(Math.min(...[...opts].map(b => +b.dataset.price)));
      }
      li.dataset.search = (li.querySelector('h3').textContent + ' ' + (li.querySelector('.dish__main > p') || { textContent: '' }).textContent).toLowerCase();
      if (o.available === false) soldOut(li);
    });
    (m.added || []).forEach(a => {
      const ul = $(`#${a.cat} .dishes`);
      if (!ul || a.deleted) return;
      const li = document.createElement('li');
      li.className = 'dish'; li.dataset.id = a.id; li.dataset.added = '1'; li.dataset.search = (a.name + ' ' + (a.desc || '')).toLowerCase();
      li.innerHTML = '<div class="dish__main"><div class="dish__row"><h3></h3><span class="dots"></span><span class="price"></span></div></div>'
        + '<button type="button" class="add"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>';
      li.querySelector('h3').textContent = a.name;
      li.querySelector('.price').textContent = cedi(+a.price);
      setDesc(li, a.desc);
      const add = li.querySelector('.add');
      add.dataset.name = a.name; add.dataset.price = a.price; add.setAttribute('aria-label', 'Add ' + a.name + ' to your order');
      ul.appendChild(li);
      if (a.available === false) soldOut(li);
    });
    $$('.cat').forEach(c => {
      const n = $$('.dish:not(.gone)', c).length, eb = $('.cat__banner .eyebrow', c);
      if (eb) eb.textContent = n + (n === 1 ? ' dish' : ' dishes');
    });
  };

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
      $$('.dish:not(.gone)', c).forEach(d => {
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
  const paintButtons = () => $$('button.add, button.opt').forEach(b => {
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
    paintPay();
    if (!n && body.classList.contains('basket-open')) openSheet(false);
  };

  const change = (name, d, price) => {
    if (sentRef === ref) { ref = newRef(); try { localStorage.setItem(REFKEY, ref); } catch (e) {} }
    let o = find(name);
    if (!o && d > 0) { o = { name, price, qty: 0 }; order.push(o); }
    if (!o) return;
    o.qty += d;
    if (o.qty <= 0) order = order.filter(x => x !== o);
    save(); paint(d > 0);
  };

  const toast = $('#toast'); let tt;
  const say = msg => { toast.textContent = msg; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('on'), 1600); };

  document.addEventListener('click', e => {
    const b = e.target.closest('button.add, button.opt');
    if (!b || b.disabled || !b.closest('.dish')) return;
    change(b.dataset.name, 1, +b.dataset.price);
    say('Added ' + b.dataset.name);
    if (navigator.vibrate) navigator.vibrate(12);
  });

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
  $('#clear').addEventListener('click', () => { order = []; save(); ref = newRef(); try { localStorage.setItem(REFKEY, ref); } catch (e) {} paint(); });

  // swipe down to close
  let y0 = null;
  sheet.addEventListener('touchstart', e => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) openSheet(false); y0 = null; }, { passive: true });

  // delivery address toggle
  const form = $('#orderForm'), addr = $('.addr', form);
  $$('input[name=mode]', form).forEach(r => r.addEventListener('change', () => { addr.hidden = form.elements.mode.value !== 'Delivery'; paintPay(); }));

  // ---------- payment ----------
  const NETS = [
    { name: 'MTN MoMo', cls: 'mtn', code: '*170#', path: 'Transfer Money, then MoMo User', prefixes: ['024', '025', '053', '054', '055', '059'] },
    { name: 'Telecel Cash', cls: 'telecel', code: '*110#', path: 'Send Money', prefixes: ['020', '050'] },
    { name: 'AT Money', cls: 'at', code: '*110#', path: 'Send Money', prefixes: ['026', '027', '056', '057'] }
  ];
  const fallbackNet = { name: 'Mobile Money', cls: 'other', code: 'your MoMo menu', path: 'Send Money', prefixes: [] };
  const accounts = PAY.momo.map(acc => {
    const num = acc.number.replace(/\D/g, '').replace(/^233/, '0');
    return { ...acc, num, pretty: num.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3'),
             net: NETS.find(n => n.prefixes.includes(num.slice(0, 3))) || fallbackNet };
  });
  let acct = accounts[0];
  const isAndroid = /android/i.test(navigator.userAgent);
  const pick = $('#momoPick');
  if (accounts.length > 1) {
    pick.innerHTML = accounts.map((a, i) => `<button type="button" class="net net--${a.net.cls}" role="radio" data-acct="${i}"></button>`).join('');
    $$('[data-acct]', pick).forEach((btn, i) => {
      btn.textContent = accounts[i].net.name;
      btn.addEventListener('click', () => { acct = accounts[i]; paintAcct(); });
    });
  } else pick.hidden = true;
  const paintAcct = () => {
    const { net } = acct;
    $$('[data-acct]', pick).forEach(btn => {
      const on = accounts[+btn.dataset.acct] === acct;
      btn.classList.toggle('on', on); btn.setAttribute('aria-checked', on);
    });
    const badge = $('#momoNet');
    badge.textContent = net.name; badge.className = 'net net--' + net.cls;
    badge.hidden = accounts.length > 1;
    $('#momoNum').textContent = acct.pretty;
    $('#momoName').textContent = acct.name;
    $('#momoCode').textContent = net.code;
    $('#momoPath').textContent = net.path;
    const dial = $('#momoDial');
    dial.hidden = !(isAndroid && net.code.startsWith('*'));
    if (!dial.hidden) { dial.href = 'tel:' + encodeURIComponent(net.code); dial.textContent = 'Open ' + net.name + ' (' + net.code + ')'; }
  };
  paintAcct();
  if (PAY.bank) {
    $('[data-bank]').hidden = false;
    const rows = [['Bank', PAY.bank.bank], ['Account name', PAY.bank.name], ['Account no.', PAY.bank.account], ['Branch', PAY.bank.branch]].filter(r => r[1]);
    $('#bankDl').innerHTML = rows.map(([k], i) => `<div><dt>${k}</dt><dd><span data-bank-v="${i}"></span>${k === 'Account no.' ? `<button type="button" class="copy" data-copy="[data-bank-v='${i}']">Copy</button>` : ''}</dd></div>`).join('');
    rows.forEach(([, v], i) => { $(`[data-bank-v='${i}']`).textContent = v; });
  }

  const REFKEY = 'boomiis-ref-v1';
  const newRef = () => 'BM-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  let ref; try { ref = localStorage.getItem(REFKEY); } catch (e) {}
  let sentRef = null; try { sentRef = localStorage.getItem(REFKEY + '-sent'); } catch (e) {}
  if (!ref) { ref = newRef(); try { localStorage.setItem(REFKEY, ref); } catch (e) {} }

  const paintPay = () => {
    const method = form.elements.pay.value;
    $('#payMomo').hidden = method !== 'momo';
    $('#payBank').hidden = method !== 'bank';
    $('#payFee').hidden = form.elements.mode.value !== 'Delivery';
    $$('[data-pay-amt]').forEach(el => { el.textContent = cedi(total()); });
    $$('[data-pay-ref]').forEach(el => { el.textContent = ref; });
  };
  $$('input[name=pay]', form).forEach(r => r.addEventListener('change', paintPay));
  form.addEventListener('input', e => { if (e.target.value.trim()) e.target.classList.remove('err'); });

  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (err) {} ta.remove();
    }
  };
  form.addEventListener('click', e => {
    const b = e.target.closest('.copy'); if (!b) return;
    const src = $(b.dataset.copy); if (!src) return;
    copyText(src.textContent.replace(/\s/g, '')).then(() => {
      say('Copied ' + src.textContent);
      b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400);
    });
  });

  // ---------- place order (saved straight to the admin) ----------
  const placeBtn = $('#placeBtn'), placeErr = $('#placeErr');
  const done = $('#done'), doneBg = $('#doneBg');
  let placing = false;
  const orderError = err => {
    const m = String(err && err.message || '');
    if (/Too many orders/i.test(m)) return 'You’ve placed several orders in the last few minutes. Please wait a little or call us on 050 638 7636.';
    if (/total does not match|Invalid order item/i.test(m)) return 'Your basket looks out of date. Please refresh the page and try again.';
    if (/Failed to fetch|NetworkError|network|Load failed/i.test(m) || !navigator.onLine) return 'No internet connection. Check your data or Wi-Fi and tap “Place paid order” again.';
    return 'We couldn’t send your order. Please try again, or call us on 050 638 7636.';
  };
  const showDone = o => {
    $('#doneRef').textContent = '#' + o.ref;
    $('#doneTotal').textContent = cedi(o.total);
    $('#doneMode').textContent = o.mode;
    $('#doneNote').textContent = o.mode === 'Delivery'
      ? 'Your food will be delivered once payment is confirmed. Please pay the rider the delivery fee on arrival.'
      : 'We’ll let you know when your food is ready for pickup at 47 Adjiringano Road.';
    $('#doneTrack').href = '/track?o=' + encodeURIComponent(o.ref);
    $('#doneWa').href = 'https://wa.me/233506387636?text=' + encodeURIComponent(`Hello BOOMiiS, I just placed order #${o.ref} (${cedi(o.total)}, ${o.mode}). Payment ref: ${o.payment.txn}.`);
    try { localStorage.setItem('boomiis-last-order', JSON.stringify({ ref: o.ref, phone: o.customer.phone })); } catch (e) {}
    openSheet(false);
    done.hidden = doneBg.hidden = false;
    setTimeout(() => $('#doneTrack').focus(), 50);
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  };
  const closeDone = () => { done.hidden = doneBg.hidden = true; };
  $('#doneBtn').addEventListener('click', closeDone);
  doneBg.addEventListener('click', closeDone);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !done.hidden) closeDone(); });
  const placeOrder = async o => {
    if (placing) return;
    placing = true; placeErr.hidden = true;
    placeBtn.disabled = true;
    const label = placeBtn.innerHTML;
    placeBtn.innerHTML = '<span class="spin" aria-hidden="true"></span><span>Sending your order…</span>';
    try {
      if (!window.BoomiisStore) throw new Error('Store unavailable');
      await BoomiisStore.addOrder(o);
      // success: empty the basket and start a fresh reference for the next order
      order = []; save();
      ref = newRef(); sentRef = null;
      try { localStorage.setItem(REFKEY, ref); localStorage.removeItem(REFKEY + '-sent'); } catch (e) {}
      form.elements.txn.value = ''; form.elements.note.value = '';
      if (form.elements.btxn) form.elements.btxn.value = '';
      paint();
      showDone(o);
    } catch (err) {
      console.error(err);
      placeErr.textContent = orderError(err);
      placeErr.hidden = false;
      placeErr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } finally {
      placing = false; placeBtn.disabled = false; placeBtn.innerHTML = label;
    }
  };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const f = form.elements;
    if (!order.length) return;
    const mode = f.mode.value, method = f.pay.value;
    const proof = method === 'bank' ? f.btxn : f.txn;
    const required = [f.name, f.phone, ...(mode === 'Delivery' ? [f.addr] : []), proof];
    required.forEach(i => i.classList.toggle('err', !i.value.trim()));
    const missing = required.find(i => !i.value.trim());
    if (missing) {
      missing.focus();
      say(missing === proof ? 'Pay first, then enter your ' + (method === 'bank' ? 'transfer reference' : 'MoMo transaction ID')
        : missing === f.addr ? 'Add your delivery address' : missing === f.phone ? 'Add your phone number' : 'Add your name');
      return;
    }
    placeOrder({
      ref, mode, note: f.note.value.trim(),
      customer: { name: f.name.value.trim(), phone: f.phone.value.trim() },
      address: mode === 'Delivery' ? f.addr.value.trim() : '',
      items: order.map(o => ({ name: o.name, qty: o.qty, price: o.price })),
      total: total(),
      payment: method === 'bank' && PAY.bank
        ? { method: 'bank', network: PAY.bank.bank, to: PAY.bank.account, txn: f.btxn.value.trim(), amount: total() }
        : { method: 'momo', network: acct.net.name, to: acct.pretty, txn: f.txn.value.trim(), amount: total() }
    });
  });

  const refreshMenu = m => { applyMenu(m); filter($('#q').value); paint(); };
  if (window.BoomiisStore) {
    refreshMenu(BoomiisStore.menuOverrides());
    BoomiisStore.loadMenu().then(refreshMenu).catch(err => console.error(err));
  }
  paint();
  paintPay();
  if (location.hash) { const t = $(location.hash); if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 60); }
})();
