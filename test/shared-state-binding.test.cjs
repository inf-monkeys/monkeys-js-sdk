const test = require('node:test');
const assert = require('node:assert/strict');
const sdk = require('@inf-monkeys-tech/monkeys');
const fixture = require('./declarative-control-fixtures.cjs');
const binding = { bindingId: 'navigation', provider: { id: 'studio.navigation', version: 1 }, states: { selected: 'selection' }, queries: {}, writeInteractions: [] };
const state = { stateId: 'selection', schemaRevisionRef: fixture.revision('schema', 'selection'), defaultValue: '', persistence: 'none' };
const page = { ...fixture.page, stateDefinitions: [state], sharedStateBindings: [binding] };
test('shared state contract is bounded, versioned, strict and optional', () => {
  assert.equal(sdk.PageSharedStateBindingSchema.safeParse(binding).success, true);
  for (const invalid of [{...binding,provider:{...binding.provider,version:0}}, {...binding,states:{}}, {...binding,script:'execute()'}, {...binding,states:Object.fromEntries(Array.from({length:33},(_,i)=>['s'+i,'v'+i]))}]) assert.equal(sdk.PageSharedStateBindingSchema.safeParse(invalid).success,false);
  assert.equal(sdk.ResolvedPageSchema.safeParse(fixture.page).success,true);
  assert.deepEqual(sdk.ResolvedPageSchema.parse(page).sharedStateBindings,[binding]);
});
test('resolved shared bindings reject dangling state/query/write and overlapping owners', () => {
  for (const bindings of [
    [{...binding,states:{selected:'missing'}}],
    [{...binding,queries:{catalog:'missing'}}],
    [{...binding,writeInteractions:['missing']}],
    [binding,binding],
    [binding,{...binding,bindingId:'other'}],
  ]) assert.equal(sdk.ResolvedPageSchema.safeParse({...page,sharedStateBindings:bindings}).success,false);
  assert.equal(sdk.ResolvedPageSchema.safeParse({...page,stateDefinitions:[{...state,scopeNodeId:'repeated'}]}).success,false);
});
