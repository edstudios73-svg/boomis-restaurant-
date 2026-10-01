/* BOOMiiS data store, backed by Supabase (live).
 *
 * The website and /admin talk only to this file. It keeps an in-memory copy of
 * the data so pages can render synchronously, writes go to Supabase, and on the
 * admin a realtime subscription keeps every signed-in device up to date.
 *
 * Security is enforced in the database (see supabase/setup.sql): the public key
 * can only place orders, request tables and read menu changes; everything else
 * needs a signed-in staff account.
 */
(function () {
  const cfg = window.BOOMIIS_SUPABASE;
  if (!cfg || !window.supabase) { console.error('Supabase is not configured'); return; }

  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'boomiis-auth' }
  });

  const MENU_CACHE = 'boomiis-menu-cache-v1';
  const cache = { orders: [], reservations: [], menu: { items: {}, added: [] } };
  const listeners = [];
  const notify = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  const fail = (error, what) => { const e = new Error(what + ': ' + (error && error.message || 'unknown error')); e.cause = error; e.code = error && error.code; return e; };

  // ---------- row <-> app object ----------
  const toOrder = r => ({
    id: r.id, ref: r.ref, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, mode: r.mode,
    customer: { name: r.customer_name, phone: r.customer_phone }, address: r.address, note: r.note,
    items: r.items || [], total: Number(r.total),
    payment: { method: r.pay_method, network: r.pay_network, to: r.pay_to, txn: r.pay_txn, amount: Number(r.total),
               status: r.pay_status, reason: r.pay_reason || undefined, verifiedAt: r.verified_at || undefined }
  });
  const toReservation = r => ({
    id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, name: r.name, phone: r.phone,
    guests: r.guests, date: r.date, time: r.time, seating: r.seating, note: r.note
  });
  const orderPatch = p => {
    const row = {};
    if (p.status) row.status = p.status;
    if (p.payment) {
      if (p.payment.status) row.pay_status = p.payment.status;
      if ('reason' in p.payment) row.pay_reason = p.payment.reason || null;
      if ('verifiedAt' in p.payment) row.verified_at = p.payment.verifiedAt || null;
    }
    return row;
  };
  const menuFromRows = rows => {
    const m = { items: {}, added: [] };
    rows.forEach(r => {
      if (r.data && r.data.added) m.added.push(Object.assign({ id: r.id }, r.data));
      else m.items[r.id] = r.data || {};
    });
    return m;
  };
  const clean = obj => { Object.keys(obj).forEach(k => { if (obj[k] === undefined) delete obj[k]; }); return obj; };
  const upsertLocal = (list, row) => {
    const i = list.findIndex(x => x.id === row.id);
    if (i === -1) list.unshift(row); else list[i] = row;
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  // the public menu page paints from this copy first, then refreshes it from the database
  try { const c = JSON.parse(localStorage.getItem(MENU_CACHE)); if (c && c.items) cache.menu = c; } catch (e) {}

  const store = {
    mode: 'live',
    client: sb,
    load: () => cache,
    onChange(fn) { listeners.push(fn); },

    // ---------- public website ----------
    async addOrder(o) {
      const row = {
        ref: o.ref, mode: o.mode, customer_name: o.customer.name, customer_phone: o.customer.phone,
        address: o.address || '', note: o.note || '', items: o.items, total: o.total,
        pay_method: o.payment.method, pay_network: o.payment.network || '', pay_to: o.payment.to || '', pay_txn: o.payment.txn
      };
      const { error } = await sb.from('orders').insert(row);
      if (error && error.code !== '23505') throw fail(error, 'Could not save the order'); // 23505 = same basket sent again
      return true;
    },
    async addReservation(r) {
      const { error } = await sb.from('reservations').insert({
        name: r.name, phone: r.phone, guests: r.guests, date: r.date, time: r.time, seating: r.seating, note: r.note || ''
      });
      if (error) throw fail(error, 'Could not save the booking');
      return true;
    },
    menuOverrides: () => cache.menu,
    async loadMenu() {
      const { data, error } = await sb.from('menu_changes').select('id,data');
      if (error) throw fail(error, 'Could not load menu changes');
      cache.menu = menuFromRows(data || []);
      try { localStorage.setItem(MENU_CACHE, JSON.stringify(cache.menu)); } catch (e) {}
      return cache.menu;
    },

    // ---------- staff sign-in ----------
    async signIn(login, password) {
      const key = String(login || '').trim().toLowerCase();
      const email = (cfg.adminAliases && cfg.adminAliases[key]) || key;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw fail(error, 'Sign-in failed');
      return data.user;
    },
    async signOut() { await sb.auth.signOut(); },
    async currentUser() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    async isStaff() {
      const { data, error } = await sb.rpc('is_staff');
      if (error) throw fail(error, 'Could not check staff access');
      return data === true;
    },

    // ---------- admin data ----------
    async loadAll() {
      const since = new Date(); since.setDate(since.getDate() - 60);
      const fromDay = new Date(); fromDay.setDate(fromDay.getDate() - 30);
      const [o, r] = await Promise.all([
        sb.from('orders').select('*').gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(1000),
        sb.from('reservations').select('*').gte('date', fromDay.toISOString().slice(0, 10)).order('date').limit(1000)
      ]);
      if (o.error) throw fail(o.error, 'Could not load orders');
      if (r.error) throw fail(r.error, 'Could not load bookings');
      cache.orders = (o.data || []).map(toOrder);
      cache.reservations = (r.data || []).map(toReservation).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      await this.loadMenu();
      notify();
    },
    subscribe(onStatus) {
      return sb.channel('boomiis-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, p => {
          if (p.new && p.new.id) { upsertLocal(cache.orders, toOrder(p.new)); notify(); }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, p => {
          if (p.new && p.new.id) { upsertLocal(cache.reservations, toReservation(p.new)); notify(); }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_changes' }, () => {
          this.loadMenu().then(notify).catch(console.error);
        })
        .subscribe(status => { if (onStatus) onStatus(status); });
    },
    async update(kind, id, patch) {
      const list = cache[kind];
      const before = list.find(x => x.id === id);
      if (!before) return null;
      const row = kind === 'orders' ? orderPatch(patch) : clean(Object.assign({}, patch));
      const { data, error } = await sb.from(kind).update(row).eq('id', id).select('*').single();
      if (error) throw fail(error, 'Could not save the change');
      const fresh = kind === 'orders' ? toOrder(data) : toReservation(data);
      upsertLocal(list, fresh);
      notify();
      return fresh;
    },

    // ---------- menu editing (staff) ----------
    async setMenuItem(id, patch) {
      const added = cache.menu.added.find(a => a.id === id);
      const next = clean(Object.assign({}, added || cache.menu.items[id], patch));
      if (!added) { if (next.available === true) delete next.available; if (next.deleted === false) delete next.deleted; }
      if (!added && !Object.keys(next).length) {
        const { error } = await sb.from('menu_changes').delete().eq('id', id);
        if (error) throw fail(error, 'Could not save the dish');
      } else {
        const { error } = await sb.from('menu_changes').upsert({ id, data: next });
        if (error) throw fail(error, 'Could not save the dish');
      }
      await this.loadMenu(); notify();
    },
    async addMenuItem(item) {
      const id = 'new-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const data = clean(Object.assign({ available: true }, item, { added: true }));
      const { error } = await sb.from('menu_changes').insert({ id, data });
      if (error) throw fail(error, 'Could not add the dish');
      await this.loadMenu(); notify();
      return Object.assign({ id }, data);
    },
    async removeMenuItem(id) {
      const isAdded = cache.menu.added.some(a => a.id === id);
      const req = isAdded
        ? sb.from('menu_changes').delete().eq('id', id)
        : sb.from('menu_changes').upsert({ id, data: Object.assign({}, cache.menu.items[id], { deleted: true }) });
      const { error } = await req;
      if (error) throw fail(error, 'Could not remove the dish');
      await this.loadMenu(); notify();
    },
    async resetMenu() {
      const { error } = await sb.from('menu_changes').delete().neq('id', '');
      if (error) throw fail(error, 'Could not reset the menu');
      await this.loadMenu(); notify();
    }
  };

  window.BoomiisStore = store;
})();
