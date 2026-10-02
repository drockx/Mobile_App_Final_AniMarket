const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../src/components/input_visibility.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported });
const { inputScrollDelta } = exported;

test('visible inputs remain still while typing', () => {
  assert.equal(inputScrollDelta({ y: 130, height: 48 }, { y: 80, height: 300 }, 450), 0);
});
test('a field covered by the keyboard moves above it', () => {
  assert.equal(inputScrollDelta({ y: 340, height: 48 }, { y: 80, height: 500 }, 360), 40);
});
test('fixed actions below a form determine its visible bottom', () => {
  assert.equal(inputScrollDelta({ y: 285, height: 48 }, { y: 80, height: 240 }, 420), 25);
});
test('switching to a field above the viewport scrolls back toward it', () => {
  assert.equal(inputScrollDelta({ y: 50, height: 48 }, { y: 80, height: 300 }, 450), -42);
});
test('scrolling still works without soft keyboard events', () => {
  assert.equal(inputScrollDelta({ y: 300, height: 48 }, { y: 80, height: 240 }), 40);
});
test('a temporarily taller text box aligns its top inside the viewport', () => {
  assert.equal(inputScrollDelta({ y: 150, height: 200 }, { y: 80, height: 180 }, 320), 58);
});
test('a viewport completely covered by a keyboard causes no runaway scroll', () => {
  assert.equal(inputScrollDelta({ y: 250, height: 48 }, { y: 280, height: 200 }, 270), 0);
});
test('fields fit after correction across phone heights and keyboard sizes', () => {
  for (const height of [180, 240, 320, 420, 600]) {
    for (const keyboardTop of [300, 360, 480, 640]) {
      for (const inputHeight of [44, 48, 80, 120]) {
        for (const y of [20, 80, 120, 230, 340, 520, 680]) {
          const viewport = { y: 70, height };
          const top = viewport.y + 12;
          const bottom = Math.min(viewport.y + height, keyboardTop) - 12;
          if (inputHeight > bottom - top) continue;
          const delta = inputScrollDelta({ y, height: inputHeight }, viewport, keyboardTop);
          assert.ok(y - delta >= top);
          assert.ok(y - delta + inputHeight <= bottom);
        }
      }
    }
  }
});
