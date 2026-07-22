'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ThemeTokensSchema } = require('../lib/schemas');
const {
  assertMonkeysThemeTokensComplete,
  mergeThemeTokenDocuments,
  resolveThemeTokens,
} = require('../lib/runtime');

const color = (hex, components) => ({
  colorSpace: 'srgb',
  components,
  hex,
});

const completeDocument = () => ({
  primitives: {
    color: { $type: 'color', $value: color('#336699', [0.2, 0.4, 0.6]) },
    dimension: { $type: 'dimension', $value: { value: 0.75, unit: 'rem' } },
    fontFamily: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
    fontWeight: { $type: 'fontWeight', $value: 600 },
    duration: { $type: 'duration', $value: { value: 180, unit: 'ms' } },
    cubicBezier: { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] },
    number: { $type: 'number', $value: 1.5 },
    strokeStyle: { $type: 'strokeStyle', $value: 'solid' },
  },
  composites: {
    border: {
      $type: 'border',
      $value: {
        color: '{primitives.color}',
        width: '{primitives.dimension}',
        style: '{primitives.strokeStyle}',
      },
    },
    transition: {
      $type: 'transition',
      $value: {
        duration: '{primitives.duration}',
        delay: { value: 0, unit: 'ms' },
        timingFunction: '{primitives.cubicBezier}',
      },
    },
    shadow: {
      $type: 'shadow',
      $value: {
        color: '{primitives.color}',
        offsetX: { value: 0, unit: 'px' },
        offsetY: { value: 4, unit: 'px' },
        blur: { value: 12, unit: 'px' },
        spread: { value: 0, unit: 'px' },
      },
    },
    gradient: {
      $type: 'gradient',
      $value: [
        { color: '{primitives.color}', position: 0 },
        { color: color('#FFFFFF', [1, 1, 1]), position: 1 },
      ],
    },
    typography: {
      $type: 'typography',
      $value: {
        fontFamily: '{primitives.fontFamily}',
        fontSize: { value: 1, unit: 'rem' },
        fontWeight: '{primitives.fontWeight}',
        letterSpacing: { value: 0, unit: 'px' },
        lineHeight: 1.5,
      },
    },
  },
});

test('accepts and resolves all thirteen DTCG 2025.10 token types', () => {
  const document = completeDocument();
  assert.doesNotThrow(() => ThemeTokensSchema.parse(document));
  const resolved = resolveThemeTokens(document);
  assert.equal(resolved.tokens.size, 13);
  assert.equal(resolved.tokens.get('composites.border').type, 'border');
  assert.deepEqual(resolved.tokens.get('composites.border').value.width, { value: 0.75, unit: 'rem' });
});

test('resolves inherited group types, $root, $extends and JSON Pointer references', () => {
  const document = {
    base: {
      $type: 'dimension',
      $root: { $value: { value: 4, unit: 'px' } },
      large: { $value: { value: 12, unit: 'px' } },
    },
    inherited: {
      $extends: '{base}',
      large: { $value: { value: 16, unit: 'px' } },
    },
    alias: { $ref: '#/inherited/large' },
    propertyRef: {
      $type: 'dimension',
      $value: {
        value: { $ref: '#/base/$root/$value/value' },
        unit: 'px',
      },
    },
  };
  const resolved = resolveThemeTokens(document);
  assert.deepEqual(resolved.tokens.get('base.$root').value, { value: 4, unit: 'px' });
  assert.deepEqual(resolved.tokens.get('inherited.large').value, { value: 16, unit: 'px' });
  assert.deepEqual(resolved.tokens.get('alias').value, { value: 16, unit: 'px' });
  assert.deepEqual(resolved.tokens.get('propertyRef').value, { value: 4, unit: 'px' });
});

test('merges sources before resolving aliases and lets later tokens override earlier tokens', () => {
  const merged = mergeThemeTokenDocuments([
    {
      palette: {
        brand: { $type: 'color', $value: '{palette.source}' },
      },
    },
    {
      palette: {
        source: { $type: 'color', $value: color('#FF0000', [1, 0, 0]) },
      },
    },
    {
      palette: {
        source: { $type: 'color', $value: color('#00FF00', [0, 1, 0]) },
      },
    },
  ]);
  assert.equal(resolveThemeTokens(merged).tokens.get('palette.brand').value.hex, '#00FF00');
});

test('fails closed on invalid names, CSS strings, missing references, type mismatches and cycles', () => {
  assert.throws(() => ThemeTokensSchema.parse({ 'bad.name': { $type: 'number', $value: 1 } }));
  assert.throws(() => ThemeTokensSchema.parse({ color: { $type: 'color', $value: '#ffffff' } }));
  assert.throws(() => resolveThemeTokens({ missing: { $type: 'color', $value: '{no.token}' } }), /Unknown token/);
  assert.throws(() => resolveThemeTokens({
    number: { $type: 'number', $value: 1 },
    color: { $type: 'color', $value: '{number}' },
  }), /expects color but number is number/);
  assert.throws(() => resolveThemeTokens({
    a: { $type: 'number', $value: '{b}' },
    b: { $type: 'number', $value: '{a}' },
  }), /Circular token reference/);
  assert.throws(() => resolveThemeTokens({
    base: { value: { $type: 'number', $value: 1 } },
    cycleA: { $extends: '{cycleB}' },
    cycleB: { $extends: '{cycleA}' },
  }), /Circular group \$extends/);
});

test('rejects token/group conflicts across sources', () => {
  assert.throws(() => mergeThemeTokenDocuments([
    { item: { $type: 'number', $value: 1 } },
    { item: { child: { $type: 'number', $value: 2 } } },
  ]), /cannot change item from token to group/);
});

test('rejects structurally valid but product-incomplete token releases', () => {
  assert.throws(
    () => assertMonkeysThemeTokensComplete({
      semantic: {
        color: {
          primary: {
            light: { $type: 'color', $value: color('#336699', [0.2, 0.4, 0.6]) },
          },
        },
      },
    }),
    /incomplete/i,
  );
});
