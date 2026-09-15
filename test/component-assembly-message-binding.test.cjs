const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { page } = require('./declarative-control-fixtures.cjs');
const compiled = new Module(__filename, module);
compiled.paths = module.paths;
compiled._compile(require('esbuild').buildSync({ stdin: { contents: `export { ResolvedPageSchema } from './src/contracts/declarative-control'; export { projectPageProperties } from './src/runtime/page-expression'; export { compileComponentAssemblyValidator } from './src/runtime/component-assembly';`, resolveDir: require('node:path').resolve(__dirname, '..'), loader: 'ts' }, bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false }).outputFiles[0].text, __filename);
const { ResolvedPageSchema, projectPageProperties, compileComponentAssemblyValidator } = compiled.exports;
const text = { defaultLocale: 'en-US', values: { 'en-US': 'Heading', 'zh-CN': '标题' } };
const properties = { contract: 'ComponentAssembly', schemaVersion: 1, props: {}, messages: { title: { key: 'heading.title', values: { count: 1 } }, children: { textI18n: text }, legacy: 'heading.legacy' } };
function candidate(targetPath, value = 'updated') {
  const input = structuredClone(page);
  // Keep the fixture's repeated capability revision references consistent.
  const oldId = input.capabilityInstances[0].capabilityRevisionRef.id;
  const renamed = JSON.parse(JSON.stringify(input).replaceAll(oldId, 'monkeys.design.component.BaseHeading'));
  renamed.capabilityInstances[0].properties = structuredClone(properties);
  renamed.capabilityInstances[0].propertyBindings = [{ targetPath, expression: { kind: 'literal', value } }];
  return renamed;
}
test('declared message key/textI18n and existing interpolation/props bindings are accepted', () => {
  for (const path of [['messages', 'title', 'key'], ['messages', 'children', 'textI18n'], ['messages', 'title', 'values'], ['messages', 'title', 'values', 'count'], ['props', 'title']]) {
    const parsed = ResolvedPageSchema.safeParse(candidate(path));
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  }
});
test('message binding cannot add variants, replace declarations, or rewire executable groups', () => {
  for (const path of [['messages'], ['messages', 'children'], ['messages', 'missing', 'key'], ['messages', 'legacy', 'key'], ['messages', 'title', 'textI18n'], ['messages', 'children', 'key'], ['messages', 'children', 'textI18n', 'values', 'zh-CN'], ['messages', 'title', 'key', 'nested'], ['events', 'onClick'], ['slots', 'children'], ['hosts', 'context'], ['renderers', 'item']]) {
    assert.equal(ResolvedPageSchema.safeParse(candidate(path)).success, false, path.join('.'));
  }
});
test('projection preserves siblings and final assembly validation enforces strict message values', () => {
  const validate = compileComponentAssemblyValidator({ id: 'Heading', version: 1, source: 'heading.tsx', exports: [], props: ['title', 'children', 'legacy'].map(name => ({ name, type: 'ReactNode', kind: 'slot', required: false })) });
  for (const [path, value] of [[['messages', 'title', 'key'], 'heading.updated'], [['messages', 'children', 'textI18n'], { defaultLocale: 'zh-CN', values: { 'zh-CN': '动态标题' } }]]) {
    const instance = ResolvedPageSchema.parse(candidate(path, value)).capabilityInstances[0];
    const projected = projectPageProperties(instance.properties, instance.propertyBindings, {});
    const result = validate(projected);
    assert.deepEqual(result.messages[path[1]][path[2]], value);
    assert.equal(result.messages.title.values.count, 1);
    assert.deepEqual(instance.properties, properties);
  }
  for (const [path, value] of [[['messages', 'title', 'key'], 3], [['messages', 'children', 'textI18n'], { 'zh-CN': 'raw map' }], [['messages', 'children', 'textI18n'], { defaultLocale: 'en-US', values: { 'zh-CN': 'missing default' } }]]) {
    const instance = ResolvedPageSchema.parse(candidate(path, value)).capabilityInstances[0];
    assert.throws(() => validate(projectPageProperties(instance.properties, instance.propertyBindings, {})));
  }
});
