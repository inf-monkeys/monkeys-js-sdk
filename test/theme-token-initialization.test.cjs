'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

test('theme validation compiles on first use, reuses the validator and preserves per-call errors', () => {
  // Isolate the module cache and Ajv instrumentation from other contract tests.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const Ajv = require('ajv');
    const original = Ajv.prototype.compile;
    let compilations = 0;
    Ajv.prototype.compile = function (...args) {
      compilations++;
      return original.apply(this, args);
    };
    const { validateThemeTokensDocumentStructure: validate } = require('./lib/theme-tokens/core');
    assert.equal(compilations, 0);
    assert.deepEqual(validate({}), []);
    assert.equal(compilations, 1);
    const issues = validate(null);
    assert.ok(issues.length > 0);
    const saved = JSON.stringify(issues);
    assert.deepEqual(validate({ spacing: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } }), []);
    assert.equal(JSON.stringify(issues), saved);
    assert.ok(validate({ spacing: { $type: 'dimension', $value: 'invalid' } }).length > 0);
    assert.equal(compilations, 1);
  `], { cwd: require('node:path').resolve(__dirname, '..'), stdio: 'pipe' });
});
