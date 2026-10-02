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
const { loginDestination } = require('../src/navigation/login_destination.ts');

test('login resumes message routes and rejects external or unexpected destinations', () => {
  assert.equal(loginDestination('/messages'), '/messages');
  assert.equal(loginDestination('/messages/abcd-1234'), '/messages/abcd-1234');
  assert.equal(loginDestination('/listings/create'), '/listings/create');
  assert.equal(loginDestination('https://other.example'), '/home');
  assert.equal(loginDestination('//other.example'), '/home');
  assert.equal(loginDestination('/messages/../../profile'), '/home');
  assert.equal(loginDestination(), '/home');
});

test('staff login always opens the admin portal and customer return links cannot reach it', () => {
  for (const returnTo of [undefined, '/home', '/messages', '/admin', '/order_checkout?id=one']) {
    assert.equal(loginDestination(returnTo, true), '/admin');
  }
  assert.equal(loginDestination('/admin', false), '/home');
});

test('every screen is declared and protected routing separates staff from customer screens', () => {
  const filename = path.join(appRoot, '_layout.tsx');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screens = [];
  function attribute(node, name) { return node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name)?.initializer; }
  function visit(node, guards = []) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Stack.Protected') {
      const guard = attribute(node.openingElement, 'guard');
      assert.ok(guard && ts.isJsxExpression(guard));
      for (const child of node.children) visit(child, [...guards, guard.expression.getText(source)]);
      return;
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'Stack.Screen') {
      const name = attribute(node, 'name'); assert.ok(name && ts.isStringLiteral(name));
      screens.push({ name: name.text.replace(/\/index$/, ''), guards });
    }
    ts.forEachChild(node, (child) => visit(child, guards));
  }
  visit(source);
  assert.deepEqual(screens.map((screen) => screen.name).sort(), [...routeNames].sort());
  function visible(account) { return screens.filter((screen) => screen.guards.every((guard) => vm.runInNewContext(guard, { account }))).map((screen) => screen.name); }
  assert.deepEqual(visible({ signedIn: true, isStaff: true, isReviewer: true }), ['admin']);
  assert.equal(visible({ signedIn: false, isStaff: false, isReviewer: false }).includes('admin'), false);
  assert.equal(visible({ signedIn: true, isStaff: false, isReviewer: false }).includes('admin'), false);
  assert.equal(visible({ signedIn: true, isStaff: false, isReviewer: true }).includes('verification_review'), true);
  assert.equal(visible({ signedIn: true, isStaff: true, isReviewer: false }).includes('admin'), false);
});
