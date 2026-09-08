'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalContentHash } = require('@inf-monkeys-tech/monkeys/runtime');

// CanonicalContentHashFixtureV1 is mirrored by monkey-data's
// internal/repo/version_helpers_test.go. Keeping an expected byte vector and
// digest in both language suites makes serializer drift visible before a
// PublicationPlan crosses the service boundary.
const expectedCanonicalBase64 =
  'eyJuZXN0ZWQiOnsiYSI6ImZpcnN0IiwieiI6IuacgOWQjiJ9LCJudW1iZXJzIjpbMCwwLDEsMS41LDFlLTcsMC4wMDAwMDEsMTAwMDAwMDAwMDAwMDAwMDAwMDAwLDFlKzIxLDkwMDcxOTkyNTQ3NDA5OTEsMzMzMzMzMzMzLjMzMzMzMzNdLCJzZXBhcmF0b3JzIjoiYmVmb3Jl4oCobWlkZGxl4oCpYWZ0ZXIiLCJ0ZXh0IjoiT3ZlcnZpZXcgJiBPcGVyYXRpb25zIDxJZGVudGl0eT4gPiBBY2Nlc3MifQ==';
const expectedSHA256 = 'dff2694e4260d6b13056a9fdcef305860be7c2421eea79e68bbc7d11b896a9a9';

test('canonical content hash matches the shared Go/TypeScript control-plane vector', () => {
  const value = {
    text: 'Overview & Operations <Identity> > Access',
    separators: 'before\u2028middle\u2029after',
    numbers: [0, -0, 1, 1.5, 1e-7, 1e-6, 1e20, 1e21, 9007199254740991, 333333333.33333329],
    nested: { z: '最后', a: 'first' },
  };
  const stableSerialize = (item) => {
    if (item === undefined) return 'null';
    if (item === null || typeof item !== 'object') return JSON.stringify(item) ?? 'null';
    if (Array.isArray(item)) return `[${item.map(stableSerialize).join(',')}]`;
    return `{${Object.keys(item)
      .filter((key) => item[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(item[key])}`)
      .join(',')}}`;
  };

  assert.equal(Buffer.from(stableSerialize(value)).toString('base64'), expectedCanonicalBase64);
  assert.equal(canonicalContentHash(value), expectedSHA256);
});
