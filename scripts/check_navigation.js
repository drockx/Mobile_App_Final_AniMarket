const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise navigation against the stack router bundled with the installed Expo SDK.
const { StackRouter, StackActions } = require(path.resolve(__dirname, '../node_modules/expo-router/build/react-navigation/routers/StackRouter.js'));
const sourceRoot = path.resolve(__dirname, '../src');
const appRoot = path.join(sourceRoot, 'app');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? files(filename) : /\.(ts|tsx)$/.test(filename) ? [filename] : [];
  });
}
const routeNames = files(appRoot).filter((filename) => !/[/\\][_+]/.test(filename)).map((filename) => path.relative(appRoot, filename).replace(/\\/g, '/').replace(/\.tsx?$/, '').replace(/\/index$/, ''));
const options = { routeNames, routeParamList: {}, routeGetIdList: {} };

function stack(initialRoutes) {
  const engine = StackRouter({ initialRouteName: initialRoutes[0] });
  let state = engine.getInitialState(options);
  function dispatch(action) {
    const next = engine.getStateForAction(state, action, options);
    assert.ok(next, `Stack rejected ${JSON.stringify(action)}`);
    state = next;
  }
  function target(href) {
    return typeof href === 'string' ? { name: href.slice(1) } : { name: href.pathname.slice(1), params: href.params };
  }
  const router = {
    canGoBack: () => state.index > 0,
    canDismiss: () => state.index > 0,
    back: () => dispatch({ type: 'GO_BACK' }),
    dismissAll: () => dispatch(StackActions.popToTop()),
    replace: (href) => { const { name, params } = target(href); dispatch(StackActions.replace(name, params)); },
    push: (href) => { const { name, params } = target(href); dispatch(StackActions.push(name, params)); },
    dismissTo: (href) => { const { name, params } = target(href); dispatch(StackActions.popTo(name, params)); },
  };
  initialRoutes.slice(1).forEach((name) => router.push(`/${name}`));
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(sourceRoot, 'navigation/app_navigation.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require: (name) => {
    assert.equal(name, 'expo-router');
    return { router };
  } });
  return { router, navigation: module.exports, getState: () => state };
}

test('placing an order removes checkout history and native back returns to My Orders', () => {
  for (const initial of [['home', 'listings/id', 'order_checkout', 'order_review'], ['order_review']]) {
    const harness = stack(initial);
    harness.navigation.openPlacedOrder('ANM-2026-000001');
    assert.deepEqual(harness.getState().routes.map((route) => route.name), ['my_orders', 'order_placed']);
    assert.equal(harness.getState().routes[1].params.orderId, 'ANM-2026-000001');
    harness.router.replace({ pathname: '/order_status', params: { orderId: 'ANM-2026-000001' } });
    harness.router.back();
    assert.deepEqual(harness.getState().routes.map((route) => route.name), ['my_orders']);
  }
});

test('viewing a saved request also returns to My Orders instead of another checkout', () => {
  const harness = stack(['home', 'order_checkout', 'order_review']);
  harness.navigation.openSavedOrder('ANM-2026-000002');
  assert.deepEqual(harness.getState().routes.map((route) => route.name), ['my_orders', 'order_status']);
  assert.equal(harness.getState().routes[1].params.orderId, 'ANM-2026-000002');
  harness.router.dismissTo('/my_orders');
  assert.equal(harness.getState().routes.length, 1);
});

test('back uses history when available and a safe fallback on a direct link', () => {
  const nested = stack(['home', 'notifications']);
  nested.navigation.backOrReplace('/messages');
  assert.equal(nested.getState().routes[0].name, 'home');
  const direct = stack(['notifications']);
  direct.navigation.backOrReplace('/home');
  assert.equal(direct.getState().routes[0].name, 'home');
  assert.equal(direct.getState().routes.length, 1);
});

test('returning to a main page removes duplicates and applies updated filter parameters', () => {
  const harness = stack(['home', 'profile', 'search_filter']);
  harness.router.dismissTo({ pathname: '/home', params: { applied: 'true', category: 'Goat' } });
  assert.equal(harness.getState().routes.length, 1);
  assert.equal(harness.getState().routes[0].params.category, 'Goat');
  harness.router.dismissTo('/messages');
  assert.deepEqual(harness.getState().routes.map((route) => route.name), ['messages']);
});

test('every literal app navigation destination resolves to an existing route', () => {
  const destinations = [];
  for (const filename of files(sourceRoot)) {
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'router' && ['push', 'replace', 'navigate', 'dismissTo'].includes(node.expression.name.text)) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) destinations.push(argument.text);
        if (argument && ts.isObjectLiteralExpression(argument)) {
          const pathname = argument.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText(source) === 'pathname');
          if (pathname && ts.isStringLiteral(pathname.initializer)) destinations.push(pathname.initializer.text);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(destinations.length > 30);
  for (const destination of destinations) {
    const name = destination === '/' ? 'index' : destination.slice(1);
    assert.ok(routeNames.includes(name), `Missing route: ${destination}`);
  }
});

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  module._compile(outputText, filename);
};
const { createMessageService } = require('../src/features/messages/application/message_service.ts');
const { mockConversations, mockTabBadges } = require('../src/features/messages/data/mock_conversations.ts');

test('seller chat reuses matching conversations and starts empty conversations for other listings', () => {
  const service = createMessageService(mockConversations, mockTabBadges);
  const original = service.getSnapshot();
  let updates = 0;
  const unsubscribe = service.subscribe(() => { updates++; });
  assert.equal(service.openBuyerConversation({ id: 'brahman', title: 'Brahman Bull (Pure Breed)', seller: 'Juan Dela Cruz' }).id, 'juan-brahman');
  assert.equal(service.getSnapshot(), original);
  const item = { id: 'simmental-cow', title: 'Simmental Cow', seller: 'Juan Dela Cruz', verified: true };
  const newConversation = service.openBuyerConversation(item);
  assert.equal(newConversation.empty, true);
  assert.equal(newConversation.unreadCount, 0);
  assert.equal(newConversation.listingId, item.id);
  assert.equal(service.get(newConversation.id), newConversation);
  assert.equal(service.list('buying', 'Simmental')[0], newConversation);
  assert.equal(service.openBuyerConversation(item), newConversation);
  assert.equal(updates, 1);
  unsubscribe();
  service.openBuyerConversation({ ...item, id: 'other-cow', title: 'Other Cow' });
  assert.equal(updates, 1);
});
