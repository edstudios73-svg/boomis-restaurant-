/* BOOMiiS order tracking: order number + phone -> live status (refreshes every 20s) */
(function () {
  const $ = s => document.querySelector(s);
  const WA = '233506387636';
  const LAST = 'boomiis-last-order';
  const store = window.BoomiisStore;
  const cedi = n => 'GH₵' + Number(n).toLocaleString('en-GH', { maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('#yr').textContent = new Date().getFullYear();

  const form = $('#trackForm'), btn = $('#tBtn'), errEl = $('#tErr'), card = $('#tCard');
  const refIn = $('#tRef'), phoneIn = $('#tPhone');
  let timer = null, current = null;

  const showErr = msg => { errEl.textContent = msg; errEl.hidden = !msg; };
  const ago = d => {
    const m = Math.round((Date.now() - new Date(d)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    return h < 24 ? h + (h === 1 ? ' hour ago' : ' hours ago') : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const steps = mode => mode === 'Delivery'
    ? [['new', 'Order received', 'We’re confirming your MoMo payment'], ['preparing', 'Payment confirmed', 'Your food is being prepared'],
       ['ready', 'Ready', 'Packed and waiting for the rider'], ['out', 'On the way', 'Have the delivery fee ready for the rider'], ['completed', 'Delivered', 'Enjoy your meal!']]
    : [['new', 'Order received', 'We’re confirming your MoMo payment'], ['preparing', 'Payment confirmed', 'Your food is being prepared'],
       ['ready', 'Ready for pickup', '47 Adjiringano Road, East Legon'], ['completed', 'Collected', 'Enjoy your meal!']];

  const headline = o => {
    const n = o.firstName ? o.firstName + ', ' : '';
    return {
      new: ['Payment check in progress', `Thanks ${n}we’ve received your order and we’re confirming your MoMo payment. This usually takes a few minutes.`],
      preparing: ['Your food is being prepared', `Good news ${n}your payment is confirmed and the kitchen is on it.`],
      ready: o.mode === 'Delivery' ? ['Ready for the rider', 'Your order is packed and the rider will leave shortly.'] : ['Ready for pickup', 'Your order is ready. Come to 47 Adjiringano Road, East Legon and show your order number.'],
      out: ['On the way', 'Your rider is heading to you. Please have the delivery fee ready.'],
      completed: ['Order complete', `Thank you ${n}for ordering from BOOMiiS. We hope you enjoyed it!`],
      cancelled: ['Order cancelled', 'We couldn’t confirm the payment for this order, so it was cancelled. If you think this is a mistake, chat with us on WhatsApp.']
    }[o.status] || ['Order received', ''];
  };

  const render = o => {
    const [title, msg] = headline(o);
    $('#cRef').textContent = '#' + o.ref;
    $('#cTitle').textContent = title;
    $('#cMsg').textContent = msg;
    const badge = $('#cBadge');
    badge.className = 'trk__badge' + (o.status === 'cancelled' ? ' bad' : o.status === 'completed' || o.payStatus === 'verified' ? ' ok' : '');
    badge.textContent = o.status === 'cancelled' ? 'Cancelled' : o.payStatus === 'verified' ? 'Paid ✓' : 'Checking payment';

    const list = steps(o.mode);
    const at = o.status === 'completed' ? list.length : list.findIndex(s => s[0] === o.status);
    const stepsEl = $('#cSteps');
    stepsEl.hidden = o.status === 'cancelled';
    stepsEl.innerHTML = list.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><div>${esc(s[1])}<small>${esc(s[2])}</small></div></li>`).join('');

    $('#cItems').innerHTML = (o.items || []).map(i => `<li><b>${esc(i.qty)}×</b><span>${esc(i.name)}</span></li>`).join('');
    const pre = o.scheduledFor && window.BoomiisHours ? window.BoomiisHours.full(new Date(o.scheduledFor)) : '';
    $('#cMode').textContent = pre ? `${o.mode} pre-order · ready for ${pre}` : o.mode + ' · placed ' + ago(o.createdAt);
    $('#cTotal').textContent = cedi(o.total);
    $('#cUpd').textContent = (o.status === 'completed' || o.status === 'cancelled' ? 'Last updated ' : 'Live · updated ') + ago(o.updatedAt);
    $('#cWa').href = `https://wa.me/${WA}?text=` + encodeURIComponent(`Hello BOOMiiS, I'm checking on my order #${o.ref}.`);
    card.hidden = false;
  };

  const check = async (quiet) => {
    const ref = refIn.value.trim().toUpperCase().replace(/^#/, '');
    const phone = phoneIn.value.trim();
    refIn.setAttribute('aria-invalid', !ref); phoneIn.setAttribute('aria-invalid', phone.replace(/\D/g, '').length < 9);
    if (!ref || phone.replace(/\D/g, '').length < 9) { showErr('Please enter your order number and the phone number you ordered with.'); return; }
    if (!store) { showErr('Tracking is unavailable right now. Please call 050 638 7636.'); return; }
    if (!quiet) { btn.disabled = true; btn.textContent = 'Checking…'; }
    try {
      const o = await store.trackOrder(ref, phone);
      if (!o) {
        if (!quiet) { card.hidden = true; showErr('We couldn’t find that order. Check the order number (e.g. BM-7K2Q) and use the same phone number you ordered with.'); }
        return;
      }
      showErr('');
      current = { ref, phone };
      try { localStorage.setItem(LAST, JSON.stringify({ ref: o.ref, phone })); } catch (e) {}
      try { history.replaceState(null, '', '/track?o=' + encodeURIComponent(o.ref)); } catch (e) {}
      render(o);
      clearInterval(timer);
      if (o.status !== 'completed' && o.status !== 'cancelled') timer = setInterval(() => document.visibilityState === 'visible' && check(true), 20000);
    } catch (e) {
      if (!quiet) showErr('We couldn’t reach our system. Check your internet connection and try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Track order';
    }
  };

  form.addEventListener('submit', e => { e.preventDefault(); check(false); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && current) check(true); });

  // prefill from the link (/track?o=BM-XXXX) and the last order placed on this phone
  let last = null; try { last = JSON.parse(localStorage.getItem(LAST)); } catch (e) {}
  const q = new URLSearchParams(location.search).get('o');
  if (q) refIn.value = q.toUpperCase();
  else if (last && last.ref) refIn.value = last.ref;
  if (last && last.phone && (!q || q.toUpperCase() === String(last.ref).toUpperCase())) phoneIn.value = last.phone;
  if (refIn.value && phoneIn.value) check(false);
})();
