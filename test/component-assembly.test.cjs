const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ComponentAssemblySchema } = require('../lib/contracts/component-assembly');

test('component assembly preserves original prop names and references existing event ports and slots', () => {
  const value = { contract: 'ComponentAssembly', schemaVersion: 1, props: { disabled: false, value: 'first' }, events: { onChange: { port: 'change', arguments: [{ argument: 0, path: ['currentTarget', 'value'] }], preventDefault: false, stopPropagation: false } }, slots: { children: 'body' }, renderers: {}, hosts: {}, messages: {} };
  assert.deepEqual(ComponentAssemblySchema.parse(value), value);
});

test('component assembly rejects executable values and unsafe property paths', () => {
  for (const patch of [
    { props: { onClick() {} } },
    { events: { onChange: { port: 'change', arguments: [{ argument: 0, path: ['__proto__'] }] } } },
    { schemaVersion: 2 },
    { children: [] },
  ]) assert.equal(ComponentAssemblySchema.safeParse({ contract: 'ComponentAssembly', schemaVersion: 1, props: {}, ...patch }).success, false);
});

test('assembly validates source-derived prop constraints and required members', () => {
  const { compileComponentAssemblyValidator } = require('../lib/runtime/component-assembly');
  const validate = compileComponentAssemblyValidator({ id: 'Input', version: 1, source: 'input.tsx', exports: [], props: [
    { name: 'value', type: 'string', required: true, kind: 'property', schema: { type: 'string' } },
    { name: 'onChange', type: '(value: string) => void', required: false, kind: 'event' },
  ] });
  const base = { contract: 'ComponentAssembly', schemaVersion: 1 };
  assert.equal(validate({ ...base, props: { value: 'ready' } }).props.value, 'ready');
  for (const props of [{}, { value: 1 }, { value: 'ready', surprise: true }, { value: 'ready', dangerouslySetInnerHTML: { __html: '<script />' } }]) assert.throws(() => validate({ ...base, props }));
  assert.throws(() => validate({ ...base, props: { value: 'ready' }, events: { value: { port: 'change' } } }));
  assert.throws(() => validate({ ...base, props: { value: 'ready' }, hosts: { value: 'competing-owner' } }));
});

test('assembly preserves discriminated union requirements and mixed renderable slots', () => {
  const { compileComponentAssemblyValidator } = require('../lib/runtime/component-assembly');
  const validate = compileComponentAssemblyValidator({ id: 'Choice', version: 1, source: 'choice.tsx', exports: [], props: [
    { name: 'kind', type: '"text" | "action"', required: true, kind: 'property', schema: { anyOf: [{ $ref: '#/$defs/text' }, { const: 'action' }] } },
    { name: 'value', type: 'string', required: false, kind: 'property', schema: { type: 'string' } },
    { name: 'onSelect', type: '() => void', required: false, kind: 'event' },
    { name: 'children', type: 'ReactNode | (() => ReactNode)', required: false, kind: 'renderer', accepts: ['renderer', 'slot'] },
  ], variants: [
    { required: ['kind', 'value'], allowed: ['kind', 'value', 'children'], properties: { kind: { const: 'text' } } },
    { required: ['kind', 'onSelect'], allowed: ['kind', 'onSelect', 'children'], properties: { kind: { const: 'action' } } },
  ] }, { text: { const: 'text' } });
  const base = { contract: 'ComponentAssembly', schemaVersion: 1 };
  assert.doesNotThrow(() => validate({ ...base, props: { kind: 'text', value: 'Ready', children: ['one', ['two', null]] } }));
  assert.doesNotThrow(() => validate({ ...base, props: { kind: 'action' }, events: { onSelect: { port: 'onSelect' } }, slots: { children: 'body' } }));
  assert.throws(() => validate({ ...base, props: { kind: 'text' } }), /combination/);
  assert.throws(() => validate({ ...base, props: { kind: 'action', value: 'wrong variant' }, events: { onSelect: { port: 'onSelect' } } }), /combination/);
});
