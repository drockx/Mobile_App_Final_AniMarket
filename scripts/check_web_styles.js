const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const web = require('react-native-web');
const { createBoxShadowValue } = require('react-native-web/dist/cjs/exports/StyleSheet/preprocess');
const sourceRoot = path.resolve(__dirname, '../src');

// Evaluate the actual presentation styles with each platform's configuration.
// Native Expo visuals are stand-ins; View, Pressable and StyleSheet use real RN web code.
function loadPresentation(relative, platform, captured = []) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    vm.runInNewContext(outputText, { module, exports: module.exports, console, require: (name) => {
      if (name === 'react' || name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return { ...web, Platform: { ...web.Platform, OS: platform }, StyleSheet: {
        ...web.StyleSheet, create: (styles) => {
          captured.push(styles);
          return platform === 'web' ? web.StyleSheet.create(styles) : styles;
        },
      } };
      if (name.startsWith('@/constants/')) return load(path.join(sourceRoot, name.slice(2) + '.ts'));
      if (name === '@/components/navigation_icon') return load(path.join(sourceRoot, 'components/navigation_icon.tsx'));
      if (name === '@/components/keyboard_scroll_view') return load(path.join(sourceRoot, 'components/keyboard_scroll_view.tsx'));
      if (name === './input_visibility') return load(path.join(sourceRoot, 'components/input_visibility.ts'));
      if (/\.(svg|png)$/.test(name)) return { uri: 'https://example.test/asset.png' };
      if (name === 'expo-linear-gradient') return { LinearGradient: ({ colors, locations, start, end, ...props }) => React.createElement(web.View, props) };
      if (name === 'expo-image') return { Image: ({ style }) => React.createElement(web.View, { style }) };
      if (name === 'expo-status-bar') return { StatusBar: () => null };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      // Other imports are used only by screen behavior, which is not invoked here.
      return {};
    } }, { filename });
    return module.exports;
  }
  return load(path.join(sourceRoot, relative));
}

const shadowScreens = [
  'components/marketplace_bottom_bar.tsx',
  'features/auth/presentation/components/auth_button.tsx',
  'features/auth/presentation/components/auth_screen_layout.tsx',
  'features/calls/presentation/call_notice.tsx',
  'features/marketplace/presentation/marketplace_home_screen.tsx',
  'features/marketplace/presentation/my_listings_screen.tsx',
  'features/onboarding/presentation/splash_screen.tsx',
  'features/profile/presentation/profile_screen.tsx',
];

test('all migrated web shadows match the existing native appearance without deprecation warnings', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let shadows = 0;
  try {
    for (const filename of shadowScreens) {
      const nativeStyles = [], webStyles = [], iosStyles = [];
      loadPresentation(filename, 'android', nativeStyles);
      loadPresentation(filename, 'web', webStyles);
      loadPresentation(filename, 'ios', iosStyles);
      assert.equal(webStyles.length, nativeStyles.length);
      nativeStyles.forEach((sheet, index) => {
        for (const [key, nativeStyle] of Object.entries(sheet)) {
          if (!nativeStyle.shadowColor) continue;
          shadows++;
          const webStyle = webStyles[index][key];
          assert.equal(webStyle.boxShadow, createBoxShadowValue(nativeStyle), `${filename}: ${key}`);
          assert.equal('shadowColor' in webStyle || 'shadowOpacity' in webStyle || 'shadowOffset' in webStyle || 'shadowRadius' in webStyle, false);
          assert.deepEqual(JSON.parse(JSON.stringify(iosStyles[index][key])), JSON.parse(JSON.stringify(nativeStyle)));
        }
      });
    }
    assert.equal(shadows, 11);
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});

test('auth, splash and navigation icons render with pointer styles and no deprecated props', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const { NavigationIcon } = loadPresentation('components/navigation_icon.tsx', 'web');
    const { AuthButton } = loadPresentation('features/auth/presentation/components/auth_button.tsx', 'web');
    const { AuthScreenLayout } = loadPresentation('features/auth/presentation/components/auth_screen_layout.tsx', 'web');
    const { SplashScreen } = loadPresentation('features/onboarding/presentation/splash_screen.tsx', 'web');
    const icon = renderToStaticMarkup(React.createElement(NavigationIcon, { name: 'back' }));
    assert.match(icon, /pointer-events:none/);
    assert.ok(renderToStaticMarkup(React.createElement(AuthScreenLayout, null,
      React.createElement(AuthButton, { label: 'Log In', onPress: () => {} }))).includes('Log In'));
    assert.ok(renderToStaticMarkup(React.createElement(SplashScreen, { onContinue: () => {} })).includes('Continue to login'));
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});
