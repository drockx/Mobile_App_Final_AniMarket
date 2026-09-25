const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../src');
const featureRoot = path.join(sourceRoot, 'features');
const allowed = {
  domain: new Set(['domain']),
  application: new Set(['domain', 'application']),
  data: new Set(['domain', 'data']),
  presentation: new Set(['domain', 'application', 'presentation']),
};
const errors = [];

function visitFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return visitFiles(filename);
    return /\.(ts|tsx)$/.test(entry.name) ? [filename] : [];
  });
}

function featureLayer(filename) {
  const parts = path.relative(featureRoot, filename).split(path.sep);
  return parts.length > 2 && Object.hasOwn(allowed, parts[1]) ? parts[1] : null;
}

function resolvedImport(filename, specifier) {
  if (specifier.startsWith('@/')) return path.join(sourceRoot, specifier.slice(2));
  if (specifier.startsWith('.')) return path.resolve(path.dirname(filename), specifier);
  return null;
}

for (const filename of visitFiles(sourceRoot)) {
  const layer = featureLayer(filename);
  const isRoute = path.relative(sourceRoot, filename).split(path.sep)[0] === 'app';
  if (!layer && !isRoute) continue;

  const source = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function check(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const target = resolvedImport(filename, specifier);
      if (layer && (specifier === 'expo-router' || specifier.startsWith('expo-router/'))) {
        errors.push(`${path.relative(sourceRoot, filename)}: route navigation belongs in src/app`);
      }
      if (target && target.startsWith(featureRoot + path.sep)) {
        const targetLayer = featureLayer(target);
        if (layer && targetLayer && !allowed[layer].has(targetLayer)) {
          errors.push(`${path.relative(sourceRoot, filename)}: ${layer} cannot import ${targetLayer}`);
        }
        if (isRoute && targetLayer && targetLayer !== 'presentation') {
          errors.push(`${path.relative(sourceRoot, filename)}: routes should import presentation or feature wiring`);
        }
      }
    }
    ts.forEachChild(node, check);
  }
  check(source);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Architecture boundaries passed.');
}
