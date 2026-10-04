import { BackendError } from './core.mjs';

export function encodeValue(value) {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (value && typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new BackendError('Invalid record value.', 400);
}
export const encodeFields = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeValue(value)]));
export function decodeValue(value) {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  return Object.fromEntries(Object.entries(value.mapValue?.fields ?? {}).map(([key, item]) => [key, decodeValue(item)]));
}
export const decodeDocument = (value) => value?.fields ? decodeValue({ mapValue: { fields: value.fields } }) : null;
export const where = (fieldPath, value, op = 'EQUAL') => ({ fieldFilter: { field: { fieldPath }, op, value: encodeValue(value) } });

/** Firestore remains the sole record database; transactions guard multi-user writes. */
export function createFirestore({ project, accessToken, fetcher = fetch, origin = 'https://firestore.googleapis.com' }) {
  const name = `projects/${project}/databases/(default)/documents`;
  const base = `${origin}/v1/${name}`;
  async function request(url, method = 'GET', body, missing = false) {
    const token = await accessToken();
    const response = await fetcher(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    if (missing && response.status === 404) return null;
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 || result.error?.status === 'ABORTED') throw Object.assign(new Error('Transaction changed'), { retryTransaction: true });
      throw new BackendError(response.status === 429 ? 'The free database quota is temporarily unavailable. Retry later.' : 'The cloud database could not complete this action. Retry later.', 503);
    }
    return result;
  }
  const get = async (path, transaction) => {
    if (transaction) {
      const result = await request(`${base}:batchGet`, 'POST', { documents: [`${name}/${path}`], transaction });
      return decodeDocument(result.find((row) => row.found)?.found);
    }
    return decodeDocument(await request(`${base}/${path.split('/').map(encodeURIComponent).join('/')}`, 'GET', undefined, true));
  };
  const getAll = async (paths, transaction) => {
    const names = paths.map((path) => `${name}/${path}`);
    const result = await request(`${base}:batchGet`, 'POST', { documents: names, transaction });
    // Firestore may return results in a different order, including missing documents.
    const found = new Map(result.filter((row) => row.found).map((row) => [row.found.name, decodeDocument(row.found)]));
    return names.map((name) => found.get(name) ?? null);
  };
  const query = async (collection, filters = [], options = {}) => {
    const parts = collection.split('/'); const collectionId = parts.pop(); const parent = parts.length ? '/' + parts.map(encodeURIComponent).join('/') : '';
    const structuredQuery = { from: [{ collectionId }], limit: options.limit ?? 100,
      ...(filters.length ? { where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } } } : {}),
      ...(options.orderBy ? { orderBy: options.orderBy } : {}) };
    const rows = await request(`${base}${parent}:runQuery`, 'POST', { structuredQuery, ...(options.transaction ? { transaction: options.transaction } : {}) });
    return rows.filter((row) => row.document).map((row) => decodeDocument(row.document));
  };
  return {
    get, query,
    async transact(action) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction } = await request(`${base}:beginTransaction`, 'POST', { options: { readWrite: {} } });
        const writes = [];
        const tx = { get: (path) => get(path, transaction), getAll: (paths) => getAll(paths, transaction), query: (collection, filters, options) => query(collection, filters, { ...options, transaction }),
          set: (path, value) => writes.push({ update: { name: `${name}/${path}`, fields: encodeFields(value) } }),
          delete: (path) => writes.push({ delete: `${name}/${path}` }) };
        try {
          const value = await action(tx);
          await request(`${base}:commit`, 'POST', { transaction, writes });
          return value;
        } catch (error) {
          await request(`${base}:rollback`, 'POST', { transaction }).catch(() => {});
          if (!error.retryTransaction || attempt === 4) throw error;
        }
      }
      throw new BackendError('Another user changed this record. Refresh and retry.', 409);
    },
  };
}
