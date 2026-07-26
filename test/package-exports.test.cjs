'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const PACKAGE_NAME = '@inf-monkeys-tech/monkeys';

test('runtime subpath preserves CommonJS resolution', () => {
  const runtime = require(`${PACKAGE_NAME}/runtime`);

  assert.equal(typeof runtime.resolveThemeTokens, 'function');
});

test('runtime subpath exposes native ESM named exports', async () => {
  const runtime = await import(`${PACKAGE_NAME}/runtime`);

  assert.equal(typeof runtime.resolveThemeTokens, 'function');
  assert.equal(typeof runtime.mergeThemeTokenDocuments, 'function');
});

test('all public module subpaths resolve through ESM import conditions', async () => {
  const [root, contracts, schemas] = await Promise.all([
    import(PACKAGE_NAME),
    import(`${PACKAGE_NAME}/contracts`),
    import(`${PACKAGE_NAME}/schemas`),
  ]);

  assert.equal(typeof root.resolveThemeTokens, 'function');
  assert.equal(typeof contracts.ThemeTokensSchema?.parse, 'function');
  assert.equal(typeof schemas.ThemeTokensSchema?.parse, 'function');
});
