/* BOOMiiS opening hours: the one place to change them.
 * Accra is on GMT all year (no daylight saving), so Accra time = UTC.
 * Keep supabase/setup.sql (function boomiis_open_at) in step with these numbers.
 */
(function () {
  const HOURS = {
    open: 10 * 60,                 // opens 10:00 am every day
    closeWeekday: 22 * 60,         // Mon–Fri: online orders stop at 10:00 pm
    closeWeekend: 23 * 60,         // Sat–Sun: online orders stop at 11:00 pm
    weekend: [6, 0],               // Saturday, Sunday
    prep: 30,                      // first pre-order slot is 30 min after opening
    step: 30,                      // pre-order slots every 30 min
    days: 3                        // pre-orders up to 3 opening days ahead
  };

  // Accra wall-clock parts of a Date (UTC getters, since Accra = GMT)
  const parts = d => ({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() });
  const at = (base, minutes) => new Date(Date.UTC(base.y, base.m, base.d, 0, minutes));
  const closeOf = dow => HOURS.weekend.includes(dow) ? HOURS.closeWeekend : HOURS.closeWeekday;
  const isOpenAt = date => { const p = parts(date); return p.min >= HOURS.open && p.min < closeOf(p.dow); };

  const nextOpening = (now = new Date()) => {
    const p = parts(now);
    if (p.min < HOURS.open) return at(p, HOURS.open);
    const t = new Date(Date.UTC(p.y, p.m, p.d + 1));
    return at(parts(t), HOURS.open);
  };

  const status = (now = new Date()) => {
    const p = parts(now);
    const open = isOpenAt(now);
    return { open, closesAt: at(p, closeOf(p.dow)), opensAt: open ? null : nextOpening(now) };
  };

  // pre-order times (Date objects) across the next few opening days
  const slots = (now = new Date()) => {
    const out = [];
    let day = parts(nextOpening(now));
    for (let i = 0; i < HOURS.days; i++) {
      for (let m = HOURS.open + HOURS.prep; m <= closeOf(day.dow) - HOURS.step; m += HOURS.step) {
        const t = at(day, m);
        if (t - now > 20 * 60000) out.push(t);
      }
      day = parts(new Date(Date.UTC(day.y, day.m, day.d + 1)));
    }
    return out;
  };

  const time = d => { const p = parts(d); const h = Math.floor(p.min / 60), mm = p.min % 60; return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (d, now = new Date()) => {
    const a = parts(d), b = parts(now);
    const diff = Math.round((Date.UTC(a.y, a.m, a.d) - Date.UTC(b.y, b.m, b.d)) / 86400000);
    return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : DAYS[a.dow];
  };
  const when = (d, now = new Date()) => { const w = day(d, now); return (w === 'today' || w === 'tomorrow' ? w[0].toUpperCase() + w.slice(1) : w) + ', ' + time(d); };
  const full = d => { const p = parts(d); return `${DAYS[p.dow].slice(0, 3)} ${p.d} ${MONTHS[p.m]}, ${time(d)}`; };

  window.BoomiisHours = { HOURS, isOpenAt, status, nextOpening, slots, time, day, when, full, closeOf };
})();
