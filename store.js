/* BOOMiiS data store.
 *
 * DEMO MODE: orders, reservations and menu changes are kept in this browser's
 * localStorage, so the website and /admin share data only on the same device.
 * When the Supabase project is ready, replace the body of this file with a
 * Supabase-backed version that keeps the same method names; nothing else in the
 * site or the admin needs to change.
 */
(function () {
  const KEY = 'boomiis-demo-db-v1';
  const blank = () => ({ orders: [], reservations: [], menu: { items: {}, added: [] }, seeded: false });

  const read = () => {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && db.orders) return Object.assign(blank(), db);
    } catch (e) { /* private mode or corrupt data: start fresh */ }
    return blank();
  };
  const write = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const uid = prefix => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn());

  // Another tab (e.g. the menu page) saved a change: tell this tab.
  window.addEventListener('storage', e => { if (e.key === KEY) notify(); });

  window.BoomiisStore = {
    mode: 'demo',
    KEY,
    load: read,
    save(db) { write(db); notify(); },
    onChange(fn) { listeners.push(fn); },

    addOrder(order) {
      const db = read();
      // Re-sending the same basket (same reference) updates that order instead of duplicating it
      const existing = order.ref && db.orders.find(o => o.ref === order.ref && o.status === 'new');
      if (existing) {
        Object.assign(existing, order, { payment: Object.assign({}, existing.payment, order.payment), updatedAt: new Date().toISOString() });
        write(db);
        return existing;
      }
      const row = Object.assign({ id: uid('o'), createdAt: new Date().toISOString(), status: 'new' }, order);
      row.payment = Object.assign({ status: 'pending' }, order.payment);
      db.orders.unshift(row);
      write(db);
      return row;
    },
    addReservation(r) {
      const db = read();
      const row = Object.assign({ id: uid('r'), createdAt: new Date().toISOString(), status: 'requested' }, r);
      db.reservations.unshift(row);
      write(db);
      return row;
    },
    update(kind, id, patch) {
      const db = read();
      const row = db[kind].find(x => x.id === id);
      if (!row) return null;
      Object.keys(patch).forEach(k => {
        row[k] = (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]))
          ? Object.assign({}, row[k], patch[k]) : patch[k];
      });
      row.updatedAt = new Date().toISOString();
      this.save(db);
      return row;
    },

    // Menu changes are stored as overrides on top of menu-data.json
    menuOverrides() { return read().menu; },
    setMenuItem(id, patch) {
      const db = read();
      const added = db.menu.added.find(a => a.id === id);
      if (added) Object.assign(added, patch);
      else {
        const next = Object.assign({}, db.menu.items[id], patch);
        Object.keys(next).forEach(k => { if (next[k] === undefined) delete next[k]; });
        if (Object.keys(next).length) db.menu.items[id] = next; else delete db.menu.items[id];
      }
      this.save(db);
    },
    addMenuItem(item) {
      const db = read();
      const row = Object.assign({ id: uid('new'), available: true }, item);
      db.menu.added.push(row);
      this.save(db);
      return row;
    },
    removeMenuItem(id) {
      const db = read();
      const before = db.menu.added.length;
      db.menu.added = db.menu.added.filter(a => a.id !== id);
      if (db.menu.added.length === before) db.menu.items[id] = Object.assign({}, db.menu.items[id], { deleted: true });
      this.save(db);
    },
    resetMenu() { const db = read(); db.menu = blank().menu; this.save(db); },
    resetAll() { try { localStorage.removeItem(KEY); } catch (e) {} notify(); }
  };
})();
