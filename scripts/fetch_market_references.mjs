// Reproducible PSA research. This fetches public data only; it never publishes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://openstat.psa.gov.ph/PXWeb/api/v1/en/DB/2M/NFG/0032M4AFN12.px';
const sourceUrl = 'https://openstat.psa.gov.ph/PXWeb/pxweb/en/DB/DB__2M__NFG/0032M4AFN12.px/';
const metadata = await (await fetch(api, { signal: AbortSignal.timeout(30000) })).json();
const year = '2026';
const types = [
  ['cow', 'Cow', 'Cattle for Slaughter'], ['pig', 'Pig', 'Hog for Slaughter'], ['goat', 'Goat', 'Goat for Slaughter'],
  ['poultry', 'Chicken (Broiler)', 'Broiler Chicken'], ['poultry', 'Chicken (Native / Improved)', 'Native/Improved Chicken'],
];
function code(variable, label) {
  const found = metadata.variables.find((item) => item.code === variable);
  const index = found.valueTexts.findIndex((value) => value.replace(/^\.+/, '') === label);
  if (index < 0) throw new Error(`PSA no longer supplies ${variable}: ${label}. Review the source manually.`);
  return found.values[index];
}
const typeCodes = types.map((item) => code('Type', item[2]));
const query = { query: [
  { code: 'Geolocation', selection: { filter: 'item', values: [code('Geolocation', 'Davao del Norte')] } },
  { code: 'Type', selection: { filter: 'item', values: typeCodes } },
  { code: 'Year', selection: { filter: 'item', values: [code('Year', year)] } },
  { code: 'Month', selection: { filter: 'item', values: Array.from({ length: 10 }, (_, index) => String(index)) } },
], response: { format: 'json' } };
const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error('PSA did not return the requested price table.');
const raw = await response.json();
if (!Array.isArray(raw.data) || raw.data.length !== types.length * 10) throw new Error('PSA returned an incomplete table.');
const prices = types.map(([category, name, commodity], index) => {
  const rows = raw.data.filter((row) => row.key[0] === code('Geolocation', 'Davao del Norte') && row.key[1] === typeCodes[index] && row.key[2] === code('Year', year));
  const historyEntries = rows.filter((row) => /^\d+(\.\d+)?$/.test(row.values[0]) && Number(row.values[0]) > 0).map((row) => {
    const month = Number(row.key[3]);
    const day = new Date(Number(year), month + 1, 0, 12).getDate();
    return { observedAt: `${year}-${String(month + 1).padStart(2, '0')}-${day}`, min: Number(row.values[0]), max: Number(row.values[0]), statistic: 'average', sourceName: 'Philippine Statistics Authority (PSA)', sourceUrl };
  }).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const latest = historyEntries.at(-1), previous = historyEntries.at(-2);
  if (!latest) throw new Error(`No published Davao del Norte price for ${commodity}.`);
  return { id: `${category}-${index}`, category, name, unit: 'per kg live weight', ...latest, median: latest.min,
    change: previous ? (latest.min / previous.min - 1) * 100 : 0, observations: 0, revision: 1,
    history: historyEntries.map((entry) => entry.min), historyEntries,
    notes: `${commodity}. June 2026 monthly provincial weighted household/establishment farmgate average; Q2 2026 preliminary. PSA table updated August 4, 2026. Not an October spot quote or a breed-specific price.` };
});
const record = { id: 'davao-del-norte-official', name: 'Davao del Norte · Livestock references', location: 'Davao del Norte', scope: 'province', sample: false,
  source: 'Sources and observation dates shown per reference', prices };
const directory = path.join(root, 'data/market_references'); fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'davao_del_norte.json'), JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'psa_query.json'), JSON.stringify({ api, sourceUrl, retrievedAt: new Date().toISOString(), query, raw }, null, 2) + '\n');
console.log(prices.map((price) => `${price.name}: PHP ${price.min.toFixed(2)}/kg; observed ${price.observedAt}`).join('\n'));
