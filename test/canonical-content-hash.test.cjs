const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { build } = require('esbuild');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const serialize = value => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${serialize(value[key])}`).join(',')}}`;
};
const expected = value => createHash('sha256').update(serialize(value), 'utf8').digest('hex');
const values = [null, undefined, true, false, 0, -0, 1.5, Number.MAX_SAFE_INTEGER, NaN, Infinity,
  '', '中文 / é / e\u0301 / 🐒', '\ud800', '\udfff', '\u0000',
  { z: undefined, b: [null, undefined, { c: 'value', a: 1 }], a: 'first' },
  Array.from({ length: 256 }, (_, i) => ({ id: i, content: `${i}🐒`.repeat(17) })),
  { content: 'large input 🐒'.repeat(100_000) }];

// CanonicalContentHashFixtureV1 is mirrored by monkey-data's
// internal/repo/version_helpers_test.go. Keep this historical byte vector
// independent of the implementation so cross-language serializer drift fails.
test('canonical content hash preserves the shared Go/TypeScript control-plane vector', async () => {
  const value = {
    text: 'Overview & Operations <Identity> > Access',
    separators: 'before\u2028middle\u2029after',
    numbers: [0, -0, 1, 1.5, 1e-7, 1e-6, 1e20, 1e21, 9007199254740991, 333333333.33333329],
    nested: { z: '最后', a: 'first' },
  };
  const expectedCanonicalBase64 = 'eyJuZXN0ZWQiOnsiYSI6ImZpcnN0IiwieiI6IuacgOWQjiJ9LCJudW1iZXJzIjpbMCwwLDEsMS41LDFlLTcsMC4wMDAwMDEsMTAwMDAwMDAwMDAwMDAwMDAwMDAwLDFlKzIxLDkwMDcxOTkyNTQ3NDA5OTEsMzMzMzMzMzMzLjMzMzMzMzNdLCJzZXBhcmF0b3JzIjoiYmVmb3Jl4oCobWlkZGxl4oCpYWZ0ZXIiLCJ0ZXh0IjoiT3ZlcnZpZXcgJiBPcGVyYXRpb25zIDxJZGVudGl0eT4gPiBBY2Nlc3MifQ==';
  const expectedSHA256 = 'dff2694e4260d6b13056a9fdcef305860be7c2421eea79e68bbc7d11b896a9a9';
  assert.equal(Buffer.from(serialize(value), 'utf8').toString('base64'), expectedCanonicalBase64);
  assert.equal(require('@inf-monkeys-tech/monkeys/runtime').canonicalContentHash(value), expectedSHA256);
  assert.equal((await import('@inf-monkeys-tech/monkeys/runtime')).canonicalContentHash(value), expectedSHA256);
  const portable = await import(pathToFileURL(path.resolve(__dirname, '../lib/esm/runtime/sha256.browser.mjs')));
  assert.equal(portable.sha256Hex(serialize(value)), expectedSHA256);
});

test('Node CommonJS and ESM preserve canonical hashes and use the native digest entry', async () => {
  const cjs = require('@inf-monkeys-tech/monkeys/runtime');
  const esm = await import('@inf-monkeys-tech/monkeys/runtime');
  assert.match(require.resolve('#canonical-sha256'), /sha256\.node\.js$/);
  const native = require('../lib/runtime/sha256.node.js');
  for (const value of values) {
    assert.equal(cjs.canonicalContentHash(value), expected(value));
    assert.equal(esm.canonicalContentHash(value), expected(value));
    assert.equal(native.sha256Hex(serialize(value)), expected(value));
  }
  assert.equal(cjs.canonicalContentHash({ b: 2, a: 1 }), cjs.canonicalContentHash({ a: 1, b: 2 }));
});

test('browser bundles resolve a portable digest without Node globals or crypto polyfills', async () => {
  const result = await build({
    stdin: { contents: "export { canonicalContentHash } from '@inf-monkeys-tech/monkeys/runtime';", resolveDir: path.resolve(__dirname, '..') },
    platform: 'browser', format: 'iife', globalName: 'runtimeHash', bundle: true, write: false, metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(inputs.some(input => /sha256\.browser/.test(input)));
  assert.ok(!inputs.some(input => /sha256\.node/.test(input)));
  const context = vm.createContext({ TextEncoder, console });
  vm.runInContext(result.outputFiles[0].text, context);
  for (const value of values) assert.equal(context.runtimeHash.canonicalContentHash(value), expected(value));
});

test('portable UTF-8 hashing agrees with native SHA-256 across padding and Unicode boundaries', async () => {
  const { sha256Hex } = await import(pathToFileURL(path.resolve(__dirname, '../lib/esm/runtime/sha256.browser.mjs')));
  for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 4096]) {
    for (const character of ['a', 'é', '🐒', '\ud800']) {
      const value = character.repeat(length);
      assert.equal(sha256Hex(value), createHash('sha256').update(value).digest('hex'));
    }
  }
});
