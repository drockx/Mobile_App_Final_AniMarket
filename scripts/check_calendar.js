const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../src/components/calendar_dates.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported, Date });
const { calendarDateKey, parseCalendarDate, isCalendarDateSelectable } = exported;

test('selected dates retain the local date rather than shifting to UTC', () => {
  const localDate = new Date(2026, 9, 2, 0, 15);
  assert.equal(calendarDateKey(localDate), '2026-10-02');
  assert.equal(calendarDateKey(parseCalendarDate('2026-10-02')), '2026-10-02');
});

test('invalid and non-calendar dates are rejected', () => {
  for (const value of ['', '2026-2-03', '10/02/2026', '2026-13-01', '2026-00-10', '2026-04-31', '2026-10-00', '2026-10-32']) {
    assert.equal(parseCalendarDate(value), null, value);
    assert.equal(isCalendarDateSelectable(value, {}), false, value);
  }
});

test('leap dates follow leap-year and century rules', () => {
  for (const value of ['2024-02-29', '2000-02-29']) assert.ok(parseCalendarDate(value), value);
  for (const value of ['2026-02-29', '1900-02-29', '2100-02-29']) assert.equal(parseCalendarDate(value), null, value);
});

test('vaccination dates include today and exclude future dates', () => {
  const limits = { maxDate: '2026-10-02' };
  assert.equal(isCalendarDateSelectable('2026-10-01', limits), true);
  assert.equal(isCalendarDateSelectable('2026-10-02', limits), true);
  assert.equal(isCalendarDateSelectable('2026-10-03', limits), false);
});

test('pickup dates begin tomorrow and respect seller unavailable days', () => {
  const limits = { minDate: '2026-10-03', excludedDays: [0] };
  assert.equal(isCalendarDateSelectable('2026-10-02', limits), false);
  assert.equal(isCalendarDateSelectable('2026-10-03', limits), true);
  assert.equal(isCalendarDateSelectable('2026-10-04', limits), false);
  assert.equal(isCalendarDateSelectable('2026-10-05', limits), true);
});

test('date range endpoints are inclusive', () => {
  const limits = { minDate: '2026-12-31', maxDate: '2027-01-02' };
  assert.equal(isCalendarDateSelectable('2026-12-30', limits), false);
  assert.equal(isCalendarDateSelectable('2026-12-31', limits), true);
  assert.equal(isCalendarDateSelectable('2027-01-02', limits), true);
  assert.equal(isCalendarDateSelectable('2027-01-03', limits), false);
});

// Exercise the actual picker callbacks without loading native view modules.
// This checks selection behavior; it does not assert native rendering or pixels.
function picker(properties = {}) {
  const states = [];
  const values = [];
  let cursor = 0;
  let closed = 0;
  let tree;
  const jsx = (type, props) => ({ type, props });
  const componentSource = fs.readFileSync(require.resolve('../src/components/calendar_picker.tsx'), 'utf8');
  const component = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const moduleExports = {};
  class Today extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 2, 12])); }
  }
  vm.runInNewContext(component, {
    exports: moduleExports,
    Date: Today,
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return { useState(initial) {
        const index = cursor++;
        if (!Object.hasOwn(states, index)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
      } };
      if (name === 'react-native') return { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width: 390, fontScale: 1 }) };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
      if (name === '@/constants/app_theme') return { appColors: {}, appTypography: {} };
      if (name === './calendar_dates') return exported;
      if (name === './navigation_icon') return { NavigationIcon: 'Icon' };
      throw new Error(`Unexpected calendar dependency: ${name}`);
    },
  });
  function render() {
    cursor = 0;
    tree = moduleExports.CalendarPicker({ title: 'Date', value: '', onSelect: (value) => values.push(value), onClose: () => closed++, ...properties });
  }
  function allNodes(value) {
    if (Array.isArray(value)) return value.flatMap(allNodes);
    if (!value || typeof value !== 'object') return [];
    return [value, ...allNodes(value.props?.children)];
  }
  function textContent(value) {
    if (Array.isArray(value)) return value.map(textContent).join('');
    if (value && typeof value === 'object') return textContent(value.props?.children);
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }
  function button(label) {
    const match = allNodes(tree).find((node) => node.type === 'Pressable' && (node.props.accessibilityLabel === label || textContent(node) === label));
    assert.ok(match, `Calendar button missing: ${label}`);
    return match;
  }
  render();
  return {
    values, button,
    get closed() { return closed; },
    tap(label) { const node = button(label); assert.ok(!node.props.disabled, `${label} is disabled`); node.props.onPress(); render(); },
    day(year, month, day) { return new Date(year, month - 1, day, 12).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); },
  };
}

test('selecting a day commits only after confirmation, and Cancel preserves the form', () => {
  const calendar = picker({ value: '2026-10-01', maxDate: '2026-10-02' });
  calendar.tap(calendar.day(2026, 10, 2));
  assert.deepEqual(calendar.values, []);
  calendar.tap('Cancel');
  assert.deepEqual(calendar.values, []);
  assert.equal(calendar.closed, 1);

  const confirmed = picker({ maxDate: '2026-10-02' });
  assert.equal(confirmed.button('Confirm Date').props.disabled, true);
  confirmed.tap(confirmed.day(2026, 10, 2));
  confirmed.tap('Confirm Date');
  assert.deepEqual(confirmed.values, ['2026-10-02']);
  assert.equal(confirmed.closed, 1);
});

test('month and year selection allow a leap date and keep the saved date format', () => {
  const calendar = picker({ maxDate: '2026-10-02' });
  calendar.tap('Choose year');
  calendar.tap('2024');
  calendar.tap('Choose month');
  calendar.tap('Feb');
  calendar.tap(calendar.day(2024, 2, 29));
  calendar.tap('Confirm Date');
  assert.deepEqual(calendar.values, ['2024-02-29']);
});

test('the pickup picker disables unavailable days and month navigation outside its range', () => {
  const calendar = picker({ minDate: '2026-10-03', maxDate: '2026-10-06', excludedDays: [0] });
  assert.equal(calendar.button('Previous month').props.disabled, true);
  assert.equal(calendar.button('Next month').props.disabled, true);
  assert.equal(calendar.button(calendar.day(2026, 10, 2)).props.disabled, true);
  assert.equal(calendar.button(calendar.day(2026, 10, 4)).props.disabled, true);
  calendar.tap(calendar.day(2026, 10, 5));
  calendar.tap('Confirm Date');
  assert.deepEqual(calendar.values, ['2026-10-05']);
});
