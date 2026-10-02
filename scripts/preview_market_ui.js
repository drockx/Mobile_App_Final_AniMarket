// Isolated, read-only layout previews rendered from the real screen components.
// Outputs stay in ignored .expo; mocks never enter the app or touch cloud records.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const native = require('react-native-web');
const root = path.resolve(__dirname, '..');
const research = JSON.parse(fs.readFileSync(path.join(root, 'data/market_references/davao_del_norte.json'), 'utf8'));
let width = 320;
const originalLoad = Module._load, originalResolve = Module._resolveFilename;
const mocks = {
  'react-native': { ...native, useWindowDimensions: () => ({ width, height: 720, scale: 1, fontScale: 1 }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-status-bar': { StatusBar: () => null },
  'expo-symbols': { SymbolView: ({ size }) => React.createElement('span', { 'aria-hidden': true, style: { display: 'inline-block', flexShrink: 0, width: size, height: size } }) },
  'expo-router': { router: {} }, 'expo-image-picker': {}, 'expo-document-picker': {},
  'expo-image': { Image: ({ source, style, ...props }) => React.createElement(native.Image, { ...props, style, source: typeof source === 'string' && source.endsWith('.svg') ? { uri: `data:image/svg+xml;base64,${fs.readFileSync(source).toString('base64')}` } : source }) },
  '@/features/market_reference/market_reference_dependencies': { useMarketReferences: () => ({ items: [research], loading: false, error: null }), marketReferenceStore: { retry() {} } },
  '@/features/profile/profile_store': { useAccount: () => ({ signedIn: false }) },
  '@/services/api': { apiRequest: async () => { throw new Error('Read-only layout preview.'); } },
  '@/services/development_data': { createRecordId: () => 'layout-preview-only' },
  '@/features/location/presentation/location_picker': { LocationPicker: () => null },
};
Module._load = function (name, parent, ...args) { if (name.endsWith('/market_reference_dependencies')) return mocks['@/features/market_reference/market_reference_dependencies']; return Object.hasOwn(mocks, name) ? mocks[name] : originalLoad.call(this, name, parent, ...args); };
Module._resolveFilename = function (name, parent, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, parent, ...args); };
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  let source = fs.readFileSync(filename, 'utf8');
  if (filename.endsWith('market_price_editor_screen.tsx')) source = source.replace('useState<Selection | null>(null)', 'useState<Selection | null>({ market: previewRecord, price: previewRecord.prices[4] })');
  const compiled = ts.transpileModule(source, { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  module._compile(`const previewRecord = ${JSON.stringify(research)};\n${compiled}`, filename);
};
require.extensions['.svg'] = (module, filename) => { module.exports = filename; };
const { MarketReferenceScreen } = require('../src/features/market_reference/presentation/market_reference_screen');
const { MarketPriceEditorScreen } = require('../src/features/market_reference/presentation/market_price_editor_screen');
const { PriceCalculatorScreen } = require('../src/features/price_calculator/presentation/price_calculator_screen');
const { CreateListingScreen } = require('../src/features/marketplace/presentation/create_listing_screen');
const { PublicProfileScreen } = require('../src/features/profile/presentation/public_profile_screen');
const output = path.join(root, '.expo/market-ui-preview'); fs.mkdirSync(output, { recursive: true });
const props = { onBack() {}, onClose() {}, onSignOut() {}, onPublished() {}, onMarketReference() {}, onUsePrice() {} };
const components = {
  market: () => React.createElement(MarketReferenceScreen, { markets: [research], onOpenCalculator() {} }),
  editor: () => React.createElement(MarketPriceEditorScreen, { onSignOut() {}, navigation: React.createElement(native.Text, { style: { fontSize: 16, color: '#12372a' } }, 'ID Reviews  /  Market Prices') }),
  calculator: () => React.createElement(PriceCalculatorScreen, { ...props, initialCategory: 'poultry', initialPriceId: 'poultry-4' }),
  listing: () => React.createElement(CreateListingScreen, { ...props, marketplace: {}, initialCategory: 'Chicken', initialReferencePriceId: 'poultry-4', initialWeight: '2' }),
  profile: () => React.createElement(PublicProfileScreen, { profile: { id: 'layout-preview-only', fullName: 'Alexandra Marie Dela Cruz', city: 'Island Garden City of Samal', memberSince: '2026-10-01T00:00:00Z', verified: true, photoUrl: null, rating: { average: 4.5, count: 2 }, myRating: null, canRate: true }, loading: false, error: null, busy: false, onBack() {}, onRetry() {}, onRate: async () => false }),
};
for (const size of [320, 390]) for (const [name, component] of Object.entries(components)) {
  width = size; native.AppRegistry.registerComponent('MarketLayoutPreview', () => component);
  const application = native.AppRegistry.getApplication('MarketLayoutPreview', { rootTag: 'root' });
  const markup = renderToStaticMarkup(application.element), styles = renderToStaticMarkup(application.getStyleElement());
  fs.writeFileSync(path.join(output, `${name}-${size}.html`), `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name} · Read-only layout preview</title>${styles}<style>html,body,#root{height:100%;margin:0}body{font-family:Arial,sans-serif}#root{display:flex}</style></head><body><div id="root">${markup}</div></body></html>`);
}
console.log('Generated ten read-only screen previews from the actual components at 320 and 390 px.');
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let portal = fs.readFileSync(path.join(root, 'admin_portal/index.html'), 'utf8')
  .replace('<script type="module" src="/app.js"></script>', '')
  .replace('<link rel="stylesheet" href="/styles.css">', `<style>${fs.readFileSync(path.join(root, 'admin_portal/styles.css'), 'utf8')}</style>`)
  .replace('id="login-panel" class="login-card card"', 'id="login-panel" class="login-card card" hidden')
  .replace('id="workspace" hidden', 'id="workspace"').replace('id="reviews-pane"', 'id="reviews-pane" hidden')
  .replace('id="prices-tab" class="outline" type="button" aria-pressed="false" hidden', 'id="prices-tab" class="primary" type="button" aria-pressed="true"')
  .replace('id="reviews-tab" class="primary" type="button" aria-pressed="true"', 'id="reviews-tab" class="outline" type="button" aria-pressed="false"')
  .replace('class="price-fields"', 'class="price-fields single-price"')
  .replace('id="prices-pane" hidden', 'id="prices-pane"').replace('id="price-form" hidden', 'id="price-form"')
  .replace('id="prices-choose" class="empty"', 'id="prices-choose" class="empty" hidden')
  .replace('id="prices-empty" class="empty"', 'id="prices-empty" class="empty" hidden')
  .replace('id="prices-list"></div>', `id="prices-list">${research.prices.map((price) => `<button type="button" class="queue-item"><strong>${escape(price.name)}</strong><small>₱${price.min.toFixed(2)} ${escape(price.unit)} · ${price.observedAt}</small></button>`).join('')}</div>`)
  .replace('id="price-title"></h2>', `id="price-title">${escape(research.prices[4].name)}</h2>`)
  .replace('id="price-basis" class="muted"></p>', 'id="price-basis" class="muted">Davao del Norte · PHP/kg live weight. Read-only layout preview.</p>');
for (const [id, value] of [['price-min', research.prices[4].min], ['price-date', research.prices[4].observedAt], ['price-source', research.prices[4].sourceName], ['price-url', research.prices[4].sourceUrl]]) portal = portal.replace(`id="${id}"`, `id="${id}" value="${escape(value)}"`);
portal = portal.replace('id="price-notes" rows="4" maxlength="500"></textarea>', `id="price-notes" rows="4" maxlength="500">${escape(research.prices[4].notes)}</textarea>`);
for (const size of [320, 390]) fs.writeFileSync(path.join(output, `portal-${size}.html`), portal);
console.log('Generated two hosted admin layout previews with public research data only.');
if (process.argv.includes('--serve')) {
  const server = http.createServer((request, response) => {
    const filename = (request.url ?? '').replace(/^\//, '');
    if (!/^(market|editor|calculator|listing|portal|profile)-(320|390)\.html$/.test(filename)) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(fs.readFileSync(path.join(output, filename)));
  });
  server.listen(8093, '127.0.0.1', () => console.log('Read-only market layout previews available on http://127.0.0.1:8093/market-320.html'));
}
