import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Staff authorization is also rechecked by the server for every edit.
export function createMarketPrices({ db, request, notice }) {
  const $ = (id) => document.getElementById(id);
  let stopSnapshot, generation = 0, records = [], selection, busy = false, stale = false;
  const amount = (value) => `₱${value.toFixed(2)}`;
  const today = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const latest = () => records.find((market) => market.id === selection?.market.id)?.prices.find((price) => price.id === selection?.price.id);
  function controls() { $('price-save').disabled = busy || stale; $('price-reload').disabled = busy || !latest(); document.querySelectorAll('#price-form input, #price-form textarea, #price-form select').forEach((input) => { input.disabled = busy; }); document.querySelectorAll('#prices-list button').forEach((button) => { button.disabled = busy; }); }
  function priceType() { const range = $('price-type').value === 'range'; $('price-max-field').hidden = !range; $('price-max').required = range; $('price-min-label').textContent = range ? 'Minimum price (PHP/kg)' : 'Average price (PHP/kg)'; document.querySelector('.price-fields').classList.toggle('single-price', !range); }
  function select(market, price) {
    selection = { market, price }; stale = false; $('price-stale').hidden = true;
    $('price-title').textContent = price.name; $('price-basis').textContent = `${market.location} · PHP ${price.unit}. Use farmgate live animal prices, not retail meat prices.`;
    $('price-type').value = price.statistic ?? 'range'; $('price-min').value = price.min.toFixed(2); $('price-max').value = price.max.toFixed(2);
    $('price-date').value = price.observedAt ?? ''; $('price-date').min = price.observedAt ?? ''; $('price-date').max = today();
    $('price-source').value = price.sourceName ?? ''; $('price-url').value = price.sourceUrl ?? ''; $('price-notes').value = price.notes ?? ''; $('price-confirm').checked = false;
    $('price-form').hidden = false; $('prices-choose').hidden = true; priceType(); render(); controls();
  }
  function render() {
    const buttons = records.flatMap((market) => market.prices.map((price) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'queue-item'; button.disabled = busy; button.setAttribute('aria-pressed', String(selection?.market.id === market.id && selection.price.id === price.id));
      const name = document.createElement('strong'), detail = document.createElement('small'); name.textContent = price.name; detail.textContent = `${price.min === price.max ? amount(price.min) : `${amount(price.min)}–${amount(price.max)}`} ${price.unit} · ${price.observedAt ?? 'Date unavailable'}`;
      button.append(name, detail); button.addEventListener('click', () => { if (!busy) { notice(); select(market, price); } }); return button;
    }));
    $('prices-list').replaceChildren(...buttons); $('prices-empty').hidden = buttons.length > 0; $('prices-empty').textContent = 'No market references have been published.';
  }
  function stop() { ++generation; stopSnapshot?.(); stopSnapshot = undefined; records = []; selection = undefined; busy = false; stale = false; $('prices-list').replaceChildren(); $('price-form').reset(); $('price-form').hidden = true; $('prices-choose').hidden = false; $('prices-pane').hidden = true; $('prices-tab').hidden = true; }
  function start() {
    stop(); const current = generation; $('prices-tab').hidden = false; $('prices-empty').hidden = false; $('prices-empty').textContent = 'Loading references…';
    stopSnapshot = onSnapshot(collection(db, 'marketReferences'), (snapshot) => {
      if (current !== generation) return;
      const previousRecords = records;
      records = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })).filter((market) => Array.isArray(market.prices)).map((market) => {
        const previous = previousRecords.find((record) => record.id === market.id);
        return { ...market, prices: market.prices.map((price) => {
          const known = previous?.prices.find((record) => record.id === price.id);
          // A cached snapshot cannot undo a successful server acknowledgement.
          return known && (known.revision ?? 1) > (price.revision ?? 1) ? known : price;
        }) };
      });
      stale = !!selection && latest()?.revision !== selection.price.revision;
      $('price-stale').hidden = !stale; render(); controls();
    }, () => { if (current === generation) notice('Market prices could not load. Check your connection and refresh.', true); });
  }
  $('price-type').addEventListener('change', priceType);
  $('price-form').addEventListener('input', (event) => { if (event.target !== $('price-confirm')) $('price-confirm').checked = false; });
  $('price-reload').addEventListener('click', () => { if (!busy && latest()) { notice(); select(records.find((market) => market.id === selection.market.id), latest()); } });
  $('price-form').addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || stale || !selection || !$('price-form').reportValidity()) return;
    let source;
    try { source = new URL($('price-url').value.trim()); } catch { notice('Enter a valid HTTPS source link.', true); return; }
    if (source.protocol !== 'https:' || source.username || source.password || source.port || !source.hostname.includes('.') || /^localhost$|^[\d.]+$/.test(source.hostname)) { notice('Use a public HTTPS source link.', true); return; }
    const min = Number($('price-min').value), statistic = $('price-type').value, max = statistic === 'average' ? min : Number($('price-max').value);
    if (max < min) { notice('The maximum price must be at least the minimum price.', true); return; }
    const current = generation, { market, price } = selection;
    busy = true; controls(); notice('Publishing price update…');
    try {
      const result = await request(`/admin/market-references/${market.id}/prices/${price.id}`, { revision: price.revision ?? 1, min, max, statistic, observedAt: $('price-date').value, sourceName: $('price-source').value.trim(), sourceUrl: source.href, notes: $('price-notes').value.trim(), confirmed: $('price-confirm').checked }, 'POST');
      if (current !== generation) return;
      records = records.map((entry) => entry.id === result.market.id ? result.market : entry);
      select(result.market, result.price); notice('Price published. The app receives this update automatically.');
    } catch (error) { if (current === generation) notice(error.message || 'Unable to save. Reload the reference before retrying.', true); }
    finally { if (current === generation) { busy = false; controls(); } }
  });
  return { start, stop, busy: () => busy };
}
