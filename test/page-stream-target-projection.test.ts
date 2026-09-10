import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { QueryBindingSchema } from '../src/contracts/declarative-control';
import { evaluatePageExpression } from '../src/runtime/page-expression';
const require = createRequire(import.meta.url);
const { revision } = require('./declarative-control-fixtures.cjs');
const expression = { kind: 'object', fields: { status: { kind: 'read', root: 'model', path: ['stream', 'status'] }, title: { kind: 'read', root: 'model', path: ['queryModel', 'title'] }, items: { kind: 'read', root: 'model', path: ['stream', 'events'] } } };
const binding = { bindingId: 'events', queryDefinitionRevisionRef: revision('domain-query-definition', 'events'), parameters: {}, target: { capabilityInstanceId: 'feed', port: 'content' }, renderModelSchemaRevisionRef: revision('schema', 'raw'), streamTargetProjection: { schemaRevisionRef: revision('schema', 'feed'), expression }, execution: 'server', pagination: 'none', cache: 'identity-scoped', cancelOnChange: true };
test('stream projections consume the explicit validated query and stream envelope', () => {
  const parsed = QueryBindingSchema.parse(binding);
  assert.deepEqual(evaluatePageExpression(parsed.streamTargetProjection!.expression, { model: { queryModel: { title: 'Events' }, stream: { status: 'open', events: [{ id: 'a' }] } } }), { status: 'open', title: 'Events', items: [{ id: 'a' }] });
});
test('stream projections reject external input, unpinned schemas and paginated/local queries', () => {
  for (const root of ['state', 'intent', 'bindings', 'actions', 'scope']) assert.equal(QueryBindingSchema.safeParse({ ...binding, streamTargetProjection: { ...binding.streamTargetProjection, expression: { kind: 'read', root, path: ['value'] } } }).success, false);
  for (const patch of [{ execution: 'local-state' }, { pagination: 'cursor' }, { streamTargetProjection: { ...binding.streamTargetProjection, schemaRevisionRef: revision('page', 'not-schema') } }]) assert.equal(QueryBindingSchema.safeParse({ ...binding, ...patch }).success, false);
});
import { compilePageRuntimeBundle, canonicalContentHash } from '../src/runtime/declarative-control-compiler';
test('compiler retains stream schema dependencies and rejects a mismatched target revision', () => {
  const f = require('./declarative-control-fixtures.cjs');
  const targetRef = f.page.ontologyBindings[0].renderModelSchemaRevisionRef;
  const inputSchemaRevisionRef = revision('schema', 'stream-input');
  const definition = { contract: 'DomainQueryDefinition', schemaVersion: 1, queryId: 'stream.query', tenantScope: f.tenantScope, dataSource: { kind: 'registered-service' }, handlerRef: { kind: 'domain-query', id: 'stream.query', version: 1, ownerRepo: 'monkeys-server' }, inputSchemaRevisionRef, resultSchemaRevisionRef: targetRef, accessPolicy: f.page.pageAccessPolicy, lineageRequired: true };
  const definitionRevisionRef = revision('domain-query-definition', definition.queryId, { contentHash: canonicalContentHash(definition) });
  const query = QueryBindingSchema.parse({ ...binding, queryDefinitionRevisionRef: definitionRevisionRef, target: { capabilityInstanceId: 'gallery', port: 'items' }, renderModelSchemaRevisionRef: targetRef, streamTargetProjection: { schemaRevisionRef: targetRef, expression } });
  const input = { page: { ...f.page, queryBindings: [query] }, pageRevisionRef: f.pageRevisionRef, release: { ...f.pageRelease, dependencySnapshot: [...f.pageRelease.dependencySnapshot, { role: 'query-definition', revisionRef: definitionRevisionRef }, { role: 'schema', revisionRef: inputSchemaRevisionRef }] }, releaseRevisionRef: f.pageReleaseRevisionRef, routeSpaces: [{ revisionRef: f.routeSpaceRevisionRef, routeSpace: f.routeSpace }], compilerRevisionRef: f.compilerRevisionRef, generation: 1, limits: { maxNavigationNodes: 1024, maxNavigationDepth: 16, maxRenderNodes: 1024, maxRenderDepth: 32, maxWorkbenchGroups: 128, maxWorkbenchInstances: 1024 }, capabilityRegistry: [{ capabilityRevisionRef: f.capabilityRevisionRef, providerRevisionRef: f.providerRevisionRef, propertySchemaRevisionRef: f.page.capabilityInstances[0].propertySchemaRevisionRef, accessPolicy: f.page.pageAccessPolicy, editorEligible: true, inputPorts: [{ name: 'items', schemaRevisionRef: targetRef }], outputPorts: [{ name: 'favorite', schemaRevisionRef: f.actionSourceIntentSchemaRevisionRef }], allowedSideEffects: ['network'] }], domainQueryRegistry: [{ definitionRevisionRef, definition }], targetRegistry: [], shellRegistration: f.shellRegistration };
  const bundle = compilePageRuntimeBundle(input);
  assert.deepEqual(bundle.queryBindings[0].streamTargetProjection, query.streamTargetProjection);
  const wrongRef = { ...targetRef, id: 'another-stream-model', contentHash: 'b'.repeat(64) };
  const wrongInput = { ...input, page: { ...input.page, queryBindings: [{ ...query, streamTargetProjection: { ...query.streamTargetProjection!, schemaRevisionRef: wrongRef } }] } };
  assert.throws(() => compilePageRuntimeBundle(wrongInput), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'DEPENDENCY_MISSING');
  assert.throws(() => compilePageRuntimeBundle({ ...wrongInput, release: { ...input.release, dependencySnapshot: [...input.release.dependencySnapshot, { role: 'schema', revisionRef: wrongRef }] } }), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PORT_TYPE_MISMATCH');
});
