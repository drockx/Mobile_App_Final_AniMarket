import { BackendError } from './core.mjs';
import { id, text } from './records.mjs';

function dateOnly(value, now) {
  const date = text(value, 'observation date', 10);
  const parsed = new Date(`${date}T12:00:00Z`);
  const today = new Date(now() + 8 * 3600000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) throw new BackendError('Choose a real observation date on or before today.', 400);
  return date;
}

export function validateMarketPrice(body, now = Date.now) {
  const { min, max, statistic, confirmed } = body ?? {};
  if (confirmed !== true) throw new BackendError('Confirm that you checked the price against its source.', 400);
  if (!['average', 'range'].includes(statistic) || ![min, max].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001) || max < min || (statistic === 'average' && min !== max)) throw new BackendError('Enter a positive peso amount with at most two decimal places. An average has one value; a range must be ordered.', 400);
  const sourceName = text(body.sourceName, 'source name', 150);
  const sourceUrl = text(body.sourceUrl, 'HTTPS source link', 2048);
  let url;
  try { url = new URL(sourceUrl); } catch { throw new BackendError('Enter a valid HTTPS source link.', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^localhost$|^[\d.]+$/.test(url.hostname) || url.port) throw new BackendError('Use a public HTTPS source link.', 400);
  return { min, max, statistic, sourceName, sourceUrl: url.href, observedAt: dateOnly(body.observedAt, now), notes: text(body.notes ?? '', 'source notes', 500, true) };
}

/** Clients cannot write prices directly. Every edit rechecks the trusted staff role. */
export function createMarketPrices({ store, now = Date.now }) {
  return async function handle(session, path, body, method) {
    if (!path.startsWith('/admin/market-references')) return undefined;
    const role = await store.get(`roles/${id(session.uid)}`);
    if (role?.staff !== true || role?.reviewer !== true) throw new BackendError('Administrator access is required to edit market prices.', 403);
    if (path === '/admin/market-references' && method === 'GET') return { markets: await store.query('marketReferences') };
    const match = /^\/admin\/market-references\/([\w-]+)\/prices\/([\w-]+)$/.exec(path);
    if (!match || method !== 'POST') throw new BackendError('This market action is unavailable.', 404);
    const observation = validateMarketPrice(body, now);
    if (!Number.isSafeInteger(body.revision) || body.revision < 1) throw new BackendError('Reload the current reference before saving.', 400);
    const [, marketId, priceId] = match;
    return store.transact(async (tx) => {
      const [currentRole, market] = await Promise.all([tx.get(`roles/${session.uid}`), tx.get(`marketReferences/${marketId}`)]);
      if (currentRole?.staff !== true || currentRole?.reviewer !== true) throw new BackendError('Administrator access was removed.', 403);
      const previous = market?.prices?.find((price) => price.id === priceId);
      if (!previous) throw new BackendError('This market reference is unavailable.', 404);
      if ((previous.revision ?? 1) !== body.revision) throw new BackendError('Another admin updated this price. Reload the latest values before saving.', 409);
      if (previous.observedAt && observation.observedAt < previous.observedAt) throw new BackendError('The current reference cannot be replaced by an older observation.', 400);
      const entries = [...(previous.historyEntries ?? []).filter((entry) => entry.observedAt !== observation.observedAt), observation].sort((a, b) => a.observedAt.localeCompare(b.observedAt)).slice(-36);
      const latest = entries.at(-2);
      const guide = (observation.min + observation.max) / 2;
      const priorGuide = latest ? (latest.min + latest.max) / 2 : null;
      const price = { ...previous, ...observation, median: guide, observations: 0, revision: body.revision + 1,
        change: priorGuide ? (guide / priorGuide - 1) * 100 : 0, history: entries.map((entry) => (entry.min + entry.max) / 2), historyEntries: entries };
      const updatedAt = new Date(now()).toISOString();
      const updated = { ...market, sample: false, updatedAt, prices: market.prices.map((item) => item.id === priceId ? price : item) };
      tx.set(`marketReferences/${marketId}`, updated);
      tx.set(`marketReferenceEdits/${marketId}_${priceId}_${price.revision}`, { marketId, priceId, editorId: session.uid, updatedAt, previous, price });
      return { market: updated, price };
    });
  };
}
