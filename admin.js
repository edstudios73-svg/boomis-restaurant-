/* BOOMiiS admin (live).
 * Staff sign in with Supabase Auth; orders, payments, bookings and menu changes are
 * read and written through store.js. Access is enforced by row-level security in
 * the database (supabase/setup.sql), so only accounts listed in public.staff can
 * see or change anything.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.BoomiisStore;

  const MOMO = { mtn: '024 216 5783', telecel: '050 638 7636' };

  // ---------- helpers ----------
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cedi = n => 'GH₵' + Number(n || 0).toLocaleString('en-GH');
  const netCls = name => /mtn/i.test(name || '') ? 'mtn' : /telecel/i.test(name || '') ? 'telecel' : 'other';
  const intl = phone => { let d = String(phone || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '233' + d.slice(1); return d; };
  const wa = (phone, text) => `https://wa.me/${intl(phone)}?text=${encodeURIComponent(text)}`;
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = () => dayKey(new Date());
  const shiftKey = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return dayKey(d); };
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayLabel = k => {
    if (k === todayKey()) return 'Today';
    if (k === shiftKey(1)) return 'Tomorrow';
    if (k === shiftKey(-1)) return 'Yesterday';
    return fromKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const clock = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ');
  const ago = iso => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 360) return Math.round(mins / 60) + ' h ago';
    return dayLabel(dayKey(new Date(iso))) + ', ' + clock(iso);
  };
  const minutesOf = t => { const m = String(t).match(/(\d+):(\d+)\s*(am|pm)/i); if (!m) return 0; let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + +m[2]; };

  const toastEl = $('#toast'); let toastT;
  const toast = msg => { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2200); };

  // ---------- sheet ----------
  const sheet = $('#sheet'), sheetBody = $('#sheetBody');
  const openSheet = html => {
    sheetBody.innerHTML = html;
    document.body.classList.add('sheet-open');
    sheet.setAttribute('aria-hidden', 'false');
    const f = sheetBody.querySelector('input,textarea,select,button'); if (f) setTimeout(() => f.focus(), 350);
  };
  const closeSheet = () => { document.body.classList.remove('sheet-open'); sheet.setAttribute('aria-hidden', 'true'); };
  $('#sheetBg').addEventListener('click', closeSheet);
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  let y0 = null;
  sheet.addEventListener('touchstart', e => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) closeSheet(); y0 = null; }, { passive: true });
  const confirmSheet = (title, text, okLabel, onOk, danger) => {
    openSheet(`<h2>${esc(title)}</h2><p class="sub">${esc(text)}</p>
      <div class="oc__act"><button class="btn btn--ghost" data-x="no">Keep</button><button class="btn ${danger ? 'btn--bad' : ''}" data-x="ok">${esc(okLabel)}</button></div>`);
    sheetBody.querySelector('[data-x=no]').onclick = closeSheet;
    sheetBody.querySelector('[data-x=ok]').onclick = () => { closeSheet(); onOk(); };
  };

  // ---------- auth ----------
  const friendly = e => {
    const m = String(e && e.message || e || '');
    if (/Invalid login credentials/i.test(m)) return 'Wrong username or password.';
    if (/Email not confirmed/i.test(m)) return 'This account isn’t confirmed yet. Confirm it in Supabase → Authentication → Users.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Check the internet and try again.';
    if (/relation .* does not exist|Could not find the table|is_staff/i.test(m)) return 'The database isn’t set up yet. Run supabase/setup.sql in the Supabase SQL Editor.';
    if (/permission denied|row-level security/i.test(m)) return 'This account doesn’t have permission to do that.';
    return m.replace(/^[^:]+:\s*/, '') || 'Something went wrong. Please try again.';
  };
  const loginErr = msg => {
    const el = $('#loginErr'); el.textContent = msg; el.hidden = false;
    const card = $('#loginForm'); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements, btn = e.target.querySelector('button[type=submit]');
    $('#loginErr').hidden = true;
    if (!f.user.value.trim() || !f.pass.value) { loginErr('Enter your username and password.'); return; }
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await S.signIn(f.user.value, f.pass.value);
      if (!(await S.isStaff())) {
        await S.signOut();
        loginErr('Signed in, but this account isn’t on the staff list yet. Run step 2 of supabase/setup.sql.');
        return;
      }
      f.pass.value = '';
      await start();
    } catch (err) {
      loginErr(friendly(err)); f.pass.value = ''; f.pass.focus();
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
  const signOut = async () => { try { await S.signOut(); } catch (e) {} location.hash = ''; location.reload(); };

  // run a save; tell staff if it fails (the screen keeps the database's real state)
  const save = (promise, okMsg) => Promise.resolve(promise)
    .then(r => { if (okMsg) toast(okMsg); return r; })
    .catch(err => { toast('⚠ ' + friendly(err)); console.error(err); });

  // ---------- state ----------
  const state = { tab: 'overview', orderFilter: 'active', payFilter: 'pending', bookFilter: 'upcoming', menuCat: 'all', q: '', mq: '' };
  let known = new Set();
  let menuBase = null;

  const db = () => S.load();
  const active = o => ['new', 'preparing', 'ready', 'out'].includes(o.status);

  // ---------- badges ----------
  function paintBadges() {
    const d = db(), today = todayKey();
    const counts = {
      orders: d.orders.filter(o => o.status === 'new').length,
      payments: d.orders.filter(o => o.payment && o.payment.status === 'pending' && o.status !== 'cancelled').length,
      bookings: d.reservations.filter(r => r.status === 'requested' && r.date >= today).length
    };
    $$('[data-badge]').forEach(b => { const n = counts[b.dataset.badge]; b.hidden = !n; b.textContent = n; });
    document.title = (counts.payments ? `(${counts.payments}) ` : '') + 'Admin | BOOMiiS Restaurant';
  }

  // ---------- shared card pieces ----------
  const ORDER_LABEL = { new: 'New · check payment', preparing: 'Preparing', ready: 'Ready', out: 'On the way', completed: 'Completed', cancelled: 'Cancelled' };
  const PAY_LABEL = { pending: 'Awaiting check', verified: 'Verified', rejected: 'Rejected' };
  const BOOK_LABEL = { requested: 'Requested', confirmed: 'Confirmed', seated: 'Seated', cancelled: 'Declined', noshow: 'No-show' };
  // ---------- WhatsApp updates to customers ----------
  const SITE = 'https://boomiisgh.com';
  const trackUrl = o => `${SITE}/track?o=${encodeURIComponent(o.ref)}`;
  const MSG_KINDS = [['new', 'Received'], ['preparing', 'Payment confirmed'], ['ready', 'Ready'], ['out', 'On the way'], ['completed', 'Thank you'], ['cancelled', 'Payment issue'], ['custom', 'Custom']];
  const orderMsg = (o, kind = o.status) => {
    const first = (o.customer.name || '').trim().split(/\s+/)[0] || 'there';
    const track = `\n\nTrack your order: ${trackUrl(o)}`;
    return {
      new: `Hello ${first}, thank you for ordering from BOOMiiS! 🍲\n\nWe've received your order #${o.ref} (${cedi(o.total)}, ${o.mode}) and we're confirming your MoMo payment now. Your order is being processed.${track}`,
      preparing: `Hello ${first}, your payment for order #${o.ref} is confirmed ✅\n\nOur kitchen is preparing your food now.${track}`,
      ready: o.mode === 'Delivery'
        ? `Hello ${first}, your order #${o.ref} is packed and ready. Our rider will leave with it shortly 🛵${track}`
        : `Hello ${first}, your order #${o.ref} is ready for pickup! 🎉\n\nCome to 47 Adjiringano Road, East Legon and show your order number.${track}`,
      out: `Hello ${first}, your order #${o.ref} is on the way 🛵\n\nPlease have the delivery fee ready for the rider.${track}`,
      completed: `Thank you for ordering from BOOMiiS, ${first}! We hope you enjoyed your meal 🙏\n\nOrder again anytime: ${SITE}/menu`,
      cancelled: `Hello ${first}, we couldn't confirm a MoMo payment for order #${o.ref} (${cedi(o.total)}), so it has been cancelled.\n\nIf you have paid, please reply with your MoMo transaction ID and we'll sort it out right away.`,
      custom: `Hello ${first}, this is BOOMiiS Restaurant about your order #${o.ref}. `
    }[kind] || '';
  };
  // a sheet with ready-made messages; tapping "Send on WhatsApp" opens the chat with the text filled in
  function messageSheet(o, intro) {
    const first = (o.customer.name || '').trim().split(/\s+/)[0] || 'customer';
    const kinds = MSG_KINDS.filter(([k]) => k !== 'out' || o.mode === 'Delivery');
    const startKind = kinds.some(([k]) => k === o.status) ? o.status : 'custom';
    openSheet(`<h2>${esc(intro ? intro.title : 'Message ' + first)}</h2>
      <p class="sub">${intro ? esc(intro.text) + ' ' : ''}Pick a message, edit it if you like, then send it to ${esc(first)} on WhatsApp (${esc(o.customer.phone)}).</p>
      <div class="chips msg-kinds" role="radiogroup" aria-label="Message">${kinds.map(([k, l]) => `<button type="button" class="chip${k === startKind ? ' on' : ''}" role="radio" aria-checked="${k === startKind}" data-kind="${k}">${esc(l)}</button>`).join('')}</div>
      <label class="msg-box"><span class="sr-only">Message</span><textarea id="waText" rows="7"></textarea></label>
      <div class="oc__act"><button class="btn btn--ghost" type="button" data-x="no">${intro ? 'Skip' : 'Close'}</button><a class="btn btn--wa" id="waGo" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>Send on WhatsApp</a></div>
      <a class="msg-call" href="tel:${esc(intl(o.customer.phone).replace(/^233/, '0'))}"><svg><use href="#i-phone"/></svg>Or call ${esc(o.customer.phone)}</a>`);
    const ta = $('#waText'), go = $('#waGo');
    const sync = () => { go.href = wa(o.customer.phone, ta.value.trim()); };
    const pick = k => {
      $$('[data-kind]', sheetBody).forEach(c => { const on = c.dataset.kind === k; c.classList.toggle('on', on); c.setAttribute('aria-checked', on); });
      ta.value = orderMsg(o, k); sync();
    };
    $$('[data-kind]', sheetBody).forEach(c => c.addEventListener('click', () => pick(c.dataset.kind)));
    ta.addEventListener('input', sync);
    go.addEventListener('click', () => setTimeout(closeSheet, 300));
    sheetBody.querySelector('[data-x=no]').onclick = closeSheet;
    pick(startKind);
  }
  const contactBtns = (phone, msg) => phone ? `
    <a class="icon-btn" href="tel:${esc(intl(phone).replace(/^233/, '0'))}" aria-label="Call"><svg><use href="#i-phone"/></svg></a>
    <a class="icon-btn icon-btn--wa" href="${esc(wa(phone, msg))}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg><use href="#i-wa"/></svg></a>` : '';

  function orderActions(o) {
    const id = esc(o.id);
    if (o.status === 'new') return `<button class="btn btn--ok" data-act="verify" data-id="${id}">✓ Verify payment</button><button class="btn btn--bad" data-act="reject" data-id="${id}">Reject</button>`;
    if (o.status === 'preparing') return `<button class="btn" data-act="ready" data-id="${id}">Mark ready</button><button class="btn btn--ghost" data-act="cancel" data-id="${id}">Cancel</button>`;
    if (o.status === 'ready') return o.mode === 'Delivery'
      ? `<button class="btn" data-act="out" data-id="${id}">Out for delivery</button>`
      : `<button class="btn btn--ok" data-act="done" data-id="${id}">Collected</button>`;
    if (o.status === 'out') return `<button class="btn btn--ok" data-act="done" data-id="${id}">Delivered</button>`;
    return '';
  }

  function orderCard(o) {
    const p = o.payment || {};
    const acts = orderActions(o);
    return `<article class="oc" data-oid="${esc(o.id)}">
      <div class="oc__top"><div><div class="oc__ref">#${esc(o.ref)}</div><div class="oc__time">${esc(ago(o.createdAt))}</div></div><span class="st st--${esc(o.status)}">${esc(ORDER_LABEL[o.status] || o.status)}</span></div>
      <div class="oc__who"><div><b>${esc(o.customer && o.customer.name)}</b><small>${esc(o.customer && o.customer.phone)}</small></div>${o.customer && o.customer.phone ? `<a class="icon-btn" href="tel:${esc(intl(o.customer.phone).replace(/^233/, '0'))}" aria-label="Call ${esc(o.customer.name)}"><svg><use href="#i-phone"/></svg></a><button class="btn btn--wa btn--sm" type="button" data-msg="${esc(o.id)}"><svg><use href="#i-wa"/></svg>Message</button>` : ''}</div>
      <div class="oc__mode"><svg><use href="#${o.mode === 'Delivery' ? 'i-pin' : 'i-bag'}"/></svg><span><b>${esc(o.mode)}</b>${o.mode === 'Delivery' ? ' · ' + esc(o.address) + '<br><small class="muted">Rider collects the delivery fee</small>' : ' · 47 Adjiringano Road'}</span></div>
      <ul class="oc__items">${(o.items || []).map(it => `<li><span>${esc(it.qty)} × ${esc(it.name)}</span><span>${cedi(it.qty * it.price)}</span></li>`).join('')}</ul>
      ${o.note ? `<p class="oc__note">“${esc(o.note)}”</p>` : ''}
      <div class="oc__pay"><span class="net net--${netCls(p.network)}">${esc(p.network || 'MoMo')}</span><span class="txn" title="Transaction ID">${esc(p.txn || '—')}</span><span class="st st--${esc(p.status)}">${esc(PAY_LABEL[p.status] || p.status)}</span><span class="oc__total">${cedi(o.total)}</span></div>
      ${p.reason ? `<p class="oc__note">${esc(p.reason)}</p>` : ''}
      ${acts ? `<div class="oc__act">${acts}</div>` : ''}
    </article>`;
  }

  // ---------- actions ----------
  // change an order's status, then offer to send the customer the matching WhatsApp update
  const step = (o, patch, okMsg, title) => save(S.update('orders', o.id, patch).then(r => { if (!r) throw new Error('Order not updated'); return r; }))
    .then(r => { if (r) messageSheet(r, { title, text: okMsg + '.' }); });
  function act(kind, id) {
    const o = db().orders.find(x => x.id === id);
    if (!o) return;
    const now = new Date().toISOString();
    const first = (o.customer.name || '').trim().split(/\s+/)[0] || 'the customer';
    if (kind === 'verify') step(o, { status: 'preparing', payment: { status: 'verified', verifiedAt: now } }, `Payment verified · #${o.ref} is now preparing`, `Tell ${first} it’s confirmed`);
    if (kind === 'reject') confirmSheet(`Reject payment for #${o.ref}?`, `No MoMo payment of ${cedi(o.total)} with transaction ID ${o.payment.txn} was found. The order will be cancelled.`, 'Reject & cancel', () => {
      step(o, { status: 'cancelled', payment: { status: 'rejected', reason: 'No matching MoMo payment received' } }, `#${o.ref} cancelled`, `Let ${first} know`);
    }, true);
    if (kind === 'ready') step(o, { status: 'ready' }, `#${o.ref} is ready`, `Tell ${first} it’s ready`);
    if (kind === 'out') step(o, { status: 'out' }, `#${o.ref} is out for delivery`, `Tell ${first} it’s on the way`);
    if (kind === 'done') step(o, { status: 'completed' }, `#${o.ref} completed`, `Say thank you to ${first}`);
    if (kind === 'cancel') confirmSheet(`Cancel order #${o.ref}?`, 'Remember to refund the customer’s MoMo payment if they have paid.', 'Cancel order', () => {
      step(o, { status: 'cancelled' }, `#${o.ref} cancelled`, `Let ${first} know`);
    }, true);
  }
  function bookAct(kind, id) {
    const r = db().reservations.find(x => x.id === id);
    if (!r) return;
    const map = { confirm: ['confirmed', 'Booking confirmed'], decline: ['cancelled', 'Booking declined'], seat: ['seated', 'Guests seated'], noshow: ['noshow', 'Marked as no-show'] };
    const [status, msg] = map[kind];
    const run = () => { save(S.update('reservations', id, { status }), `${msg} · ${r.name}`); };
    if (kind === 'decline') confirmSheet(`Decline ${r.name}’s booking?`, 'Let them know on WhatsApp so they can choose another time.', 'Decline', run, true); else run();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (b) { act(b.dataset.act, b.dataset.id); return; }
    const m = e.target.closest('[data-msg]'); if (m) { const o = db().orders.find(x => x.id === m.dataset.msg); if (o) messageSheet(o); return; }
    const k = e.target.closest('[data-book]'); if (k) { bookAct(k.dataset.book, k.dataset.id); return; }
    const c = e.target.closest('[data-copy]'); if (c) {
      const text = c.dataset.copy;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied ' + text), () => toast(text));
    }
  });

  // ---------- views ----------
  const view = name => $(`.view[data-view="${name}"]`);

  // OVERVIEW
  function renderOverview() {
    const d = db(), today = todayKey();
    const todays = d.orders.filter(o => dayKey(new Date(o.createdAt)) === today);
    const paidToday = todays.filter(o => o.payment && o.payment.status === 'verified');
    const pending = d.orders.filter(o => o.payment && o.payment.status === 'pending' && o.status !== 'cancelled');
    const live = d.orders.filter(active);
    const bookToday = d.reservations.filter(r => r.date === today && !['cancelled', 'noshow'].includes(r.status));
    const hr = new Date().getHours();
    const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    // 7-day verified revenue
    const days = Array.from({ length: 7 }, (_, i) => shiftKey(i - 6));
    const rev = days.map(k => d.orders.filter(o => o.payment && o.payment.status === 'verified' && dayKey(new Date(o.createdAt)) === k).reduce((s, o) => s + o.total, 0));
    const max = Math.max(1, ...rev);
    const week = rev.reduce((a, b) => a + b, 0);
    // top dishes this week
    const since = fromKey(days[0]);
    const tally = {};
    d.orders.filter(o => o.status !== 'cancelled' && new Date(o.createdAt) >= since).forEach(o => (o.items || []).forEach(it => {
      const key = it.name.replace(/\s*\(.*\)$/, '');
      tally[key] = tally[key] || { qty: 0, value: 0 }; tally[key].qty += it.qty; tally[key].value += it.qty * it.price;
    }));
    const top = Object.entries(tally).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const attention = [
      ...pending.slice(0, 3).map(o => `<div class="attn__row"><span class="net net--${netCls(o.payment.network)}">${esc(o.payment.network)}</span><div><b>${cedi(o.total)} · #${esc(o.ref)}</b><small>${esc(o.customer.name)} · Txn ${esc(o.payment.txn)}</small></div><button class="btn btn--ok btn--sm" data-act="verify" data-id="${esc(o.id)}">Verify</button></div>`),
      ...d.reservations.filter(r => r.status === 'requested' && r.date >= today).slice(0, 2).map(r => `<div class="attn__row"><svg><use href="#i-cal"/></svg><div><b>${esc(r.name)} · ${esc(r.guests)} guests</b><small>${esc(dayLabel(r.date))}, ${esc(r.time)}</small></div><button class="btn btn--sm" data-book="confirm" data-id="${esc(r.id)}">Confirm</button></div>`)
    ];
    view('overview').innerHTML = `
      <div class="vh"><div><h1 id="h-overview">${hello}</h1><p>${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div></div>
      <div class="tiles">
        <div class="tile"><span>Today’s sales</span><b>${cedi(paidToday.reduce((s, o) => s + o.total, 0))}</b><small>${paidToday.length} paid order${paidToday.length === 1 ? '' : 's'}</small></div>
        <a class="tile ${pending.length ? 'tile--hot' : ''}" href="#payments"><span>Payments to check</span><b>${pending.length}</b><small>${cedi(pending.reduce((s, o) => s + o.total, 0))} awaiting</small></a>
        <a class="tile" href="#orders"><span>Active orders</span><b>${live.length}</b><small>${live.filter(o => o.mode === 'Delivery').length} for delivery</small></a>
        <a class="tile" href="#bookings"><span>Bookings today</span><b>${bookToday.length}</b><small>${bookToday.reduce((s, r) => s + +r.guests, 0)} guests</small></a>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="chart__head"><div><div class="h2">Sales, last 7 days</div><small class="muted">Verified MoMo payments</small></div><b>${cedi(week)}</b></div>
          <div class="chart" role="group" aria-label="Verified sales for each of the last 7 days">
            ${rev.map((v, i) => `<div class="chart__col" tabindex="0" data-tip="${esc(dayLabel(days[i]))}" data-val="${cedi(v)}" aria-label="${esc(dayLabel(days[i]))}: ${cedi(v)}"><div class="chart__bar" style="height:${Math.max(2, (v / max) * 100)}%;animation-delay:${i * 50}ms"></div></div>`).join('')}
          </div>
          <div class="chart__x">${days.map(k => `<span class="${k === today ? 'today' : ''}">${k === today ? 'Today' : fromKey(k).toLocaleDateString('en-GB', { weekday: 'short' })}</span>`).join('')}</div>
          <button class="linkbtn" id="tblBtn" type="button" aria-expanded="false" style="margin-top:10px">Show as table</button>
          <table class="datatable" id="tbl" hidden><thead><tr><th>Day</th><th>Sales</th></tr></thead><tbody>${days.map((k, i) => `<tr><td>${esc(dayLabel(k))}</td><td>${cedi(rev[i])}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="card"><div class="h2" style="margin-bottom:12px">Needs attention</div>
          <div class="attn">${attention.length ? attention.join('') : '<div class="empty"><b>All caught up</b>No payments or bookings waiting.</div>'}</div>
        </div>
      </div>
      <div class="card"><div class="h2" style="margin-bottom:12px">Top dishes this week <a href="#menu">Edit menu</a></div>
        ${top.length ? `<ol class="rank">${top.map(([n, t]) => `<li><span>${esc(n)}</span><small class="muted">${cedi(t.value)}</small><b>× ${t.qty}</b></li>`).join('')}</ol>` : '<p class="muted">No orders yet this week.</p>'}
      </div>`;
    $('#tblBtn').onclick = e => { const t = $('#tbl'); t.hidden = !t.hidden; e.target.textContent = t.hidden ? 'Show as table' : 'Hide table'; e.target.setAttribute('aria-expanded', !t.hidden); };
    wireTips();
  }
  const tip = $('#tip'); let tipT;
  function wireTips() {
    $$('.chart__col').forEach(col => {
      const show = () => {
        const r = col.querySelector('.chart__bar').getBoundingClientRect();
        tip.innerHTML = `${esc(col.dataset.val)}<small>${esc(col.dataset.tip)}</small>`;
        tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = (r.top - 8) + 'px'; tip.hidden = false;
        clearTimeout(tipT); tipT = setTimeout(() => { tip.hidden = true; }, 2500);
      };
      col.addEventListener('pointerenter', show); col.addEventListener('focus', show); col.addEventListener('click', show);
      col.addEventListener('pointerleave', () => { tip.hidden = true; }); col.addEventListener('blur', () => { tip.hidden = true; });
    });
  }
  addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

  // ORDERS
  const ORDER_FILTERS = [['active', 'Active', active], ['new', 'New', o => o.status === 'new'], ['preparing', 'Preparing', o => o.status === 'preparing'], ['ready', 'Ready', o => o.status === 'ready'], ['out', 'On the way', o => o.status === 'out'], ['completed', 'Completed', o => o.status === 'completed'], ['cancelled', 'Cancelled', o => o.status === 'cancelled'], ['all', 'All', () => true]];
  const match = (o, q) => !q || [o.ref, o.customer && o.customer.name, o.customer && o.customer.phone, o.payment && o.payment.txn].join(' ').toLowerCase().includes(q);
  function renderOrders() {
    view('orders').innerHTML = `
      <div class="vh"><div><h1 id="h-orders">Orders</h1><p>Verify the MoMo payment before cooking.</p></div></div>
      <label class="search"><svg><use href="#i-search"/></svg><span class="sr-only">Search orders</span><input id="oq" type="search" placeholder="Search name, phone, reference or Txn ID" value="${esc(state.q)}"></label>
      <div class="chips" id="ochips"></div>
      <div class="list list--cols" id="olist"></div>`;
    $('#oq').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); fillOrders(); });
    fillOrders();
  }
  function fillOrders() {
    const all = db().orders;
    $('#ochips').innerHTML = ORDER_FILTERS.map(([k, label, fn]) => `<button class="chip ${state.orderFilter === k ? 'on' : ''}" data-of="${k}">${label} <i>${all.filter(fn).length}</i></button>`).join('');
    $$('#ochips [data-of]').forEach(b => b.onclick = () => { state.orderFilter = b.dataset.of; fillOrders(); });
    const fn = ORDER_FILTERS.find(f => f[0] === state.orderFilter)[2];
    const rows = all.filter(fn).filter(o => match(o, state.q));
    $('#olist').innerHTML = rows.length ? rows.map(orderCard).join('') : `<div class="empty"><b>No orders here</b>${state.q ? 'Try a different search.' : 'New online orders appear here instantly.'}</div>`;
  }

  // PAYMENTS
  const PAY_FILTERS = [['pending', 'Awaiting check'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['all', 'All']];
  function renderPayments() {
    const d = db(), today = todayKey(), since = fromKey(shiftKey(-6));
    const pays = d.orders.filter(o => o.payment);
    const verified = pays.filter(o => o.payment.status === 'verified');
    const vToday = verified.filter(o => dayKey(new Date(o.createdAt)) === today).reduce((s, o) => s + o.total, 0);
    const pend = pays.filter(o => o.payment.status === 'pending' && o.status !== 'cancelled');
    const wk = net => verified.filter(o => netCls(o.payment.network) === net && new Date(o.createdAt) >= since).reduce((s, o) => s + o.total, 0);
    view('payments').innerHTML = `
      <div class="vh"><div><h1 id="h-payments">Payments</h1><p>Mobile Money received for online orders.</p></div></div>
      <div class="tiles">
        <div class="tile ${pend.length ? 'tile--hot' : ''}"><span>Awaiting check</span><b>${pend.length}</b><small>${cedi(pend.reduce((s, o) => s + o.total, 0))}</small></div>
        <div class="tile"><span>Verified today</span><b>${cedi(vToday)}</b><small>${verified.filter(o => dayKey(new Date(o.createdAt)) === today).length} payments</small></div>
        <div class="tile"><span><i class="net net--mtn">MTN MoMo</i></span><b>${cedi(wk('mtn'))}</b><small>Last 7 days · ${MOMO.mtn}</small></div>
        <div class="tile"><span><i class="net net--telecel">Telecel Cash</i></span><b>${cedi(wk('telecel'))}</b><small>Last 7 days · ${MOMO.telecel}</small></div>
      </div>
      <div class="tipcard"><svg><use href="#i-cash"/></svg><span>Before verifying, open the MoMo SMS on that line and check that the <b>transaction ID</b> and <b>amount</b> match. Only then start cooking.</span></div>
      <div class="chips" id="pchips"></div>
      <div class="list list--cols" id="plist"></div>`;
    fillPayments();
  }
  function fillPayments() {
    const pays = db().orders.filter(o => o.payment);
    const f = k => k === 'all' ? pays : pays.filter(o => o.payment.status === k && (k !== 'pending' || o.status !== 'cancelled'));
    $('#pchips').innerHTML = PAY_FILTERS.map(([k, label]) => `<button class="chip ${state.payFilter === k ? 'on' : ''}" data-pf="${k}">${label} <i>${f(k).length}</i></button>`).join('');
    $$('#pchips [data-pf]').forEach(b => b.onclick = () => { state.payFilter = b.dataset.pf; fillPayments(); });
    const rows = f(state.payFilter);
    $('#plist').innerHTML = rows.length ? rows.map(o => {
      const p = o.payment;
      return `<article class="oc">
        <div class="oc__top"><div><div class="oc__ref">${cedi(p.amount || o.total)}</div><div class="oc__time">#${esc(o.ref)} · ${esc(o.customer.name)} · ${esc(ago(o.createdAt))}</div></div><span class="net net--${netCls(p.network)}">${esc(p.network)}</span></div>
        <div class="oc__pay"><span class="muted">Txn ID</span><span class="txn">${esc(p.txn)}</span><button class="linkbtn" data-copy="${esc(p.txn)}">Copy</button><span class="st st--${esc(p.status)}" style="margin-left:auto">${esc(PAY_LABEL[p.status])}</span></div>
        <small class="muted">Sent to ${esc(p.to || '')}${p.verifiedAt ? ' · verified ' + esc(ago(p.verifiedAt)) : ''}${p.reason ? ' · ' + esc(p.reason) : ''}</small>
        ${p.status === 'pending' && o.status !== 'cancelled' ? `<div class="oc__act"><button class="btn btn--ok" data-act="verify" data-id="${esc(o.id)}">✓ Verify</button><button class="btn btn--bad" data-act="reject" data-id="${esc(o.id)}">Not received</button></div>` : ''}
      </article>`;
    }).join('') : '<div class="empty"><b>Nothing here</b>Payments for new orders appear here.</div>';
  }

  // BOOKINGS
  const BOOK_FILTERS = [['upcoming', 'Upcoming'], ['today', 'Today'], ['requested', 'To confirm'], ['past', 'Past'], ['all', 'All']];
  function renderBookings() {
    view('bookings').innerHTML = `
      <div class="vh"><div><h1 id="h-bookings">Bookings</h1><p>Table requests from the website.</p></div></div>
      <div class="chips" id="bchips"></div>
      <div class="list" id="blist"></div>`;
    fillBookings();
  }
  function fillBookings() {
    const all = db().reservations, today = todayKey();
    const fns = { upcoming: r => r.date >= today, today: r => r.date === today, requested: r => r.status === 'requested' && r.date >= today, past: r => r.date < today, all: () => true };
    $('#bchips').innerHTML = BOOK_FILTERS.map(([k, label]) => `<button class="chip ${state.bookFilter === k ? 'on' : ''}" data-bf="${k}">${label} <i>${all.filter(fns[k]).length}</i></button>`).join('');
    $$('#bchips [data-bf]').forEach(b => b.onclick = () => { state.bookFilter = b.dataset.bf; fillBookings(); });
    const desc = state.bookFilter === 'past';
    const rows = all.filter(fns[state.bookFilter]).sort((a, b) => (a.date === b.date ? minutesOf(a.time) - minutesOf(b.time) : a.date < b.date ? -1 : 1) * (desc ? -1 : 1));
    let html = '', last = '';
    rows.forEach(r => {
      if (r.date !== last) { html += `<div class="day">${esc(dayLabel(r.date))}</div>`; last = r.date; }
      const first = (r.name || '').split(' ')[0];
      const when = `${dayLabel(r.date).toLowerCase() === 'today' ? 'today' : fromKey(r.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at ${r.time}`;
      const msg = r.status === 'cancelled'
        ? `Hello ${first}, sorry, we can't take your booking for ${when}. Would another time work for you?`
        : `Hello ${first}, your table for ${r.guests} at BOOMiiS ${when} is confirmed. See you at 47 Adjiringano Road!`;
      const id = esc(r.id);
      let acts = '';
      if (r.status === 'requested') acts = `<button class="btn" data-book="confirm" data-id="${id}">Confirm</button><button class="btn btn--bad" data-book="decline" data-id="${id}">Decline</button>`;
      else if (r.status === 'confirmed' && r.date <= today) acts = `<button class="btn btn--ok" data-book="seat" data-id="${id}">Seated</button><button class="btn btn--ghost" data-book="noshow" data-id="${id}">No-show</button>`;
      html += `<article class="oc">
        <div class="oc__top"><div class="bk__time">${esc(r.time)}</div><span class="st st--${esc(r.status)}">${esc(BOOK_LABEL[r.status] || r.status)}</span></div>
        <div class="oc__who"><div><b>${esc(r.name)}</b><small>${esc(r.phone || '')}</small></div>${contactBtns(r.phone, msg)}</div>
        <div class="bk__meta"><span>${esc(r.guests)} guest${+r.guests === 1 ? '' : 's'}</span><span>${esc(r.seating)}</span></div>
        ${r.note ? `<p class="oc__note">“${esc(r.note)}”</p>` : ''}
        ${acts ? `<div class="oc__act">${acts}</div>` : ''}
      </article>`;
    });
    $('#blist').innerHTML = html || '<div class="empty"><b>No bookings here</b>Requests from the website appear here.</div>';
  }

  // MENU
  async function loadMenuBase() {
    if (menuBase) return menuBase;
    const res = await fetch('/menu-data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('menu-data.json ' + res.status);
    menuBase = await res.json();
    return menuBase;
  }
  function mergedMenu() {
    const ov = S.menuOverrides();
    return menuBase.map(c => ({
      id: c.id, title: c.title,
      items: c.items.map(it => {
        const o = Object.fromEntries(Object.entries(ov.items[it.id] || {}).filter(([, v]) => v !== undefined));
        return {
          id: it.id, cat: c.id, base: it,
          name: o.name || it.name,
          desc: o.desc !== undefined ? o.desc : it.desc,
          price: o.price != null ? o.price : it.price,
          options: it.options ? it.options.map((op, i) => ({ label: op.label, price: o.options && o.options[i] != null ? o.options[i] : op.price })) : null,
          available: o.available !== false, deleted: !!o.deleted, edited: Object.keys(o).length > 0
        };
      }).concat(ov.added.filter(a => a.cat === c.id).map(a => ({ ...a, isNew: true, options: null, available: a.available !== false })))
    }));
  }
  const priceText = it => it.options ? `from ${cedi(Math.min(...it.options.map(o => o.price)))} · ${it.options.length} options` : (it.price == null || it.price === '' ? 'Ask for price' : cedi(it.price));
  async function renderMenu() {
    view('menu').innerHTML = `
      <div class="vh"><div><h1 id="h-menu">Menu</h1><p>Edits show on the live menu page straight away.</p></div><a class="btn btn--ghost btn--sm" href="/menu" target="_blank" rel="noopener">View menu <svg style="width:14px;height:14px"><use href="#i-ext"/></svg></a></div>
      <label class="search"><svg><use href="#i-search"/></svg><span class="sr-only">Search dishes</span><input id="mq" type="search" placeholder="Search dishes" value="${esc(state.mq)}"></label>
      <div class="chips" id="mchips"></div>
      <div id="mlist" class="list"><div class="empty">Loading the menu…</div></div>
      <button class="linkbtn" id="resetMenu" type="button" style="justify-self:start">Undo all menu changes</button>
      <button class="fab" id="addDish" type="button"><svg><use href="#i-plus"/></svg>Add dish</button>`;
    $('#mq').addEventListener('input', e => { state.mq = e.target.value.trim().toLowerCase(); fillMenu(); });
    $('#addDish').onclick = () => editDish(null);
    $('#resetMenu').onclick = () => confirmSheet('Undo all menu changes?', 'Prices, sold-out flags and added or removed dishes go back to the printed menu.', 'Undo changes', () => save(S.resetMenu(), 'Menu reset to the printed menu'), true);
    try { await loadMenuBase(); fillMenu(); }
    catch (e) { $('#mlist').innerHTML = '<div class="empty"><b>Couldn’t load the menu</b>Check your connection and refresh.</div>'; }
  }
  function fillMenu() {
    if (!menuBase || !$('#mlist')) return;
    const cats = mergedMenu();
    $('#mchips').innerHTML = [['all', 'All']].concat(cats.map(c => [c.id, c.title])).map(([k, l]) => `<button class="chip ${state.menuCat === k ? 'on' : ''}" data-mc="${k}">${esc(l)}</button>`).join('');
    $$('#mchips [data-mc]').forEach(b => b.onclick = () => { state.menuCat = b.dataset.mc; fillMenu(); });
    const q = state.mq;
    const html = cats.filter(c => state.menuCat === 'all' || c.id === state.menuCat).map(c => {
      const items = c.items.filter(it => !q || (it.name + ' ' + (it.desc || '')).toLowerCase().includes(q));
      if (!items.length) return '';
      const off = items.filter(it => !it.available && !it.deleted).length;
      return `<section class="mcat"><h2>${esc(c.title)} <span>${items.length} dishes${off ? ` · ${off} sold out` : ''}</span></h2>
        ${items.map(it => `<div class="mi ${it.available && !it.deleted ? '' : 'mi--off'}">
          <button class="mi__main" data-edit="${esc(it.id)}"><b>${esc(it.name)}${it.isNew ? '<span class="mi__tag">New</span>' : ''}${it.deleted ? '<span class="mi__tag">Removed</span>' : it.edited ? '<span class="mi__tag">Edited</span>' : ''}</b><small><em>${esc(priceText(it))}</em>${it.desc ? ' · ' + esc(it.desc) : ''}</small></button>
          ${it.deleted ? '' : `<button class="switch" role="switch" aria-checked="${it.available}" aria-label="${esc(it.name)} available" data-avail="${esc(it.id)}"></button>`}
        </div>`).join('')}</section>`;
    }).join('');
    $('#mlist').innerHTML = html || '<div class="empty"><b>No dishes match</b>Try another search.</div>';
    $$('#mlist [data-avail]').forEach(sw => sw.onclick = () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', on);
      save(S.setMenuItem(sw.dataset.avail, { available: on }), on ? 'Back on the menu' : 'Marked sold out');
    });
    $$('#mlist [data-edit]').forEach(b => b.onclick = () => editDish(b.dataset.edit));
  }
  function findDish(id) { for (const c of mergedMenu()) { const it = c.items.find(i => i.id === id); if (it) return it; } return null; }
  function editDish(id) {
    const it = id ? findDish(id) : null;
    const cats = mergedMenu();
    const isNew = !it;
    const priceField = it && it.options
      ? `<div class="form" style="gap:8px"><span style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700">Prices</span>${it.options.map((o, i) => `<label class="opt-row"><span>${esc(o.label)}</span><span class="money"><input name="opt${i}" type="number" inputmode="decimal" min="0" step="1" value="${esc(o.price)}" required></span></label>`).join('')}</div>`
      : `<label>Price<span class="money"><input name="price" type="number" inputmode="decimal" min="0" step="1" value="${it && it.price != null ? esc(it.price) : ''}" placeholder="${it && it.price == null ? 'Ask for price' : '0'}"></span></label>`;
    openSheet(`<h2>${isNew ? 'Add a dish' : esc(it.name)}</h2><p class="sub">${isNew ? 'It appears on the live menu as soon as you save.' : esc(cats.find(c => c.id === it.cat).title)}</p>
      <form class="form" id="dishForm" novalidate>
        ${isNew ? `<label>Section<select name="cat">${cats.map(c => `<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></label>` : ''}
        <label>Name<input name="name" required value="${it ? esc(it.name) : ''}" placeholder="e.g. Asun"></label>
        <label>Description<textarea name="desc" rows="2" placeholder="Optional">${it ? esc(it.desc || '') : ''}</textarea></label>
        ${priceField}
        ${it && it.deleted ? '' : `<div class="toggle-row">Available today<button type="button" class="switch" role="switch" id="availSw" aria-checked="${it ? it.available : true}" aria-label="Available today"></button></div>`}
        <button class="btn btn--block" type="submit">${isNew ? 'Add to menu' : it.deleted ? 'Restore dish' : 'Save changes'}</button>
        ${it && !it.deleted ? `<button class="btn btn--bad btn--block" type="button" id="delDish">Remove from menu</button>` : ''}
      </form>`);
    const sw = $('#availSw'); if (sw) sw.onclick = () => sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') !== 'true');
    const del = $('#delDish');
    if (del) del.onclick = () => confirmSheet(`Remove ${it.name}?`, it.isNew ? 'This dish will be deleted.' : 'It disappears from the menu page. You can restore it here any time.', 'Remove', () => save(S.removeMenuItem(it.id), 'Removed from the menu'), true);
    $('#dishForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target.elements;
      const name = f.name.value.trim();
      f.name.classList.toggle('err', !name);
      if (!name) { f.name.focus(); return; }
      const available = sw ? sw.getAttribute('aria-checked') === 'true' : true;
      const desc = f.desc.value.trim();
      if (isNew) {
        const price = f.price.value === '' ? NaN : +f.price.value;
        f.price.classList.toggle('err', !(price >= 0));
        if (!(price >= 0)) { f.price.focus(); return; }
        closeSheet(); save(S.addMenuItem({ cat: f.cat.value, name, desc, price, available }), name + ' added to the menu'); return;
      }
      let price = it.options ? null : (f.price.value === '' ? null : +f.price.value);
      if (price !== null && !(price >= 0)) { f.price.classList.add('err'); f.price.focus(); return; }
      const prices = it.options ? it.options.map((o, i) => +f['opt' + i].value) : null;
      if (prices && prices.some(p => !(p >= 0))) { toast('Check the prices'); return; }
      if (it.isNew) {
        closeSheet(); save(S.setMenuItem(it.id, { name, desc, price: price === null ? it.price : price, available }), 'Saved · live on the menu'); return;
      } else {
        // store only what differs from the printed menu, so untouched dishes stay untagged
        const b = it.base;
        const patch = {
          name: name !== b.name ? name : undefined,
          desc: desc !== (b.desc || '') ? desc : undefined,
          price: !it.options && price !== null && price !== b.price ? price : undefined,
          options: prices && prices.some((p, i) => p !== b.options[i].price) ? prices : undefined,
          available: available ? undefined : false,
          deleted: undefined
        };
        closeSheet(); save(S.setMenuItem(it.id, patch), 'Saved · live on the menu');
      }
    });
  }

  // ---------- account sheet ----------
  let me = null;
  $('#moreBtn').addEventListener('click', () => {
    openSheet(`<h2>Signed in</h2><p class="sub">${esc(me && me.email || '')} · Live data from Supabase</p>
      <div class="menu-list">
        <button type="button" id="reload"><svg><use href="#i-cash"/></svg>Refresh data</button>
        <a href="/" target="_blank" rel="noopener"><svg><use href="#i-ext"/></svg>View website</a>
        <a href="/menu" target="_blank" rel="noopener"><svg><use href="#i-menu"/></svg>View menu page</a>
        <button type="button" class="danger" id="signOut"><svg><use href="#i-ext"/></svg>Sign out</button>
      </div>`);
    $('#signOut').onclick = signOut;
    $('#reload').onclick = () => { closeSheet(); save(S.loadAll(), 'Data refreshed'); };
  });

  // ---------- new-order chime ----------
  let audio = null;
  const chime = () => {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.16].forEach((t, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = i ? 1046 : 784;
        g.gain.setValueAtTime(0.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.35);
        o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.4);
      });
    } catch (e) {}
  };
  // browsers only allow sound after a tap, so unlock it on the first interaction
  addEventListener('pointerdown', () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) {} }, { once: true });

  // ---------- routing & live refresh ----------
  const RENDER = { overview: renderOverview, orders: renderOrders, payments: renderPayments, bookings: renderBookings, menu: renderMenu };
  const FILL = { overview: renderOverview, orders: fillOrders, payments: renderPayments, bookings: fillBookings, menu: fillMenu };
  function show() {
    const tab = (location.hash || '#overview').slice(1);
    state.tab = RENDER[tab] ? tab : 'overview';
    $$('.view').forEach(v => { v.hidden = v.dataset.view !== state.tab; });
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === state.tab));
    closeSheet();
    RENDER[state.tab]();
    paintBadges();
    window.scrollTo(0, 0);
  }
  function refresh() {
    if (!known) { FILL[state.tab](); paintBadges(); return; }
    const orders = db().orders;
    const fresh = orders.filter(o => !known.has(o.id));
    fresh.forEach(o => known.add(o.id));
    FILL[state.tab]();
    paintBadges();
    if (fresh.length) {
      const o = fresh[0];
      toast(`New order #${o.ref} · ${cedi(o.total)}`);
      chime();
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      const card = $(`[data-oid="${o.id}"]`); if (card) card.classList.add('oc--flash');
    }
  }

  const setLive = status => {
    const pill = $('#livePill');
    const ok = status === 'SUBSCRIBED';
    pill.textContent = ok ? 'Live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'Offline' : 'Connecting';
    pill.classList.toggle('demo-pill--live', ok);
    pill.classList.toggle('demo-pill--off', !ok && pill.textContent === 'Offline');
  };

  let started = false;
  async function start() {
    if (started) return;
    started = true;
    $('#login').hidden = true;
    $('#app').hidden = false;
    view('overview').innerHTML = '<div class="empty"><b>Loading live data…</b>Orders, payments and bookings from Supabase.</div>';
    try { me = await S.currentUser(); await S.loadAll(); }
    catch (err) { view('overview').innerHTML = `<div class="empty"><b>Couldn’t load data</b>${esc(friendly(err))}</div>`; toast('⚠ ' + friendly(err)); }
    known = new Set(db().orders.map(o => o.id));
    addEventListener('hashchange', show);
    S.onChange(refresh);
    S.subscribe(setLive);
    // catch up after the phone sleeps or the connection drops
    document.addEventListener('visibilitychange', () => { if (!document.hidden) S.loadAll().catch(() => {}); });
    setInterval(() => { if (state.tab === 'orders') fillOrders(); }, 60000); // keep "x min ago" fresh
    show();
  }

  (async () => {
    try {
      if (await S.currentUser() && await S.isStaff()) { await start(); return; }
    } catch (e) { console.error(e); }
    $('#login').hidden = false;
    $('#loginForm').elements.user.focus();
  })();
})();
