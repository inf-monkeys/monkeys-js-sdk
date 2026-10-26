const assert = require('node:assert/strict');
const test = require('node:test');
const { WorkflowCanvasSchema, WorkflowEditorCommandSchema, WorkflowDefinitionSchema } = require('../lib/contracts');
const { compileWorkflowDefinitionFromConductor, compileConductorWorkflowDefinition } = require('../lib/runtime');

const canvas = () => ({ engine: 'excalidraw', schemaVersion: 1, elements: [
  { id: 'node-a', type: 'embeddable', x: 10, y: 20, width: 200, height: 100, customData: { workflow: { nodeRef: 'a' } } },
], files: {} });

test('canvas round trips vendor drawing fields without a second task definition', () => {
  const input = canvas();
  input.elements[0].roundness = { type: 3 };
  assert.deepEqual(WorkflowCanvasSchema.parse(input), input);
  input.elements[0].customData.workflow.task = { inputParameters: {} };
  assert.equal(WorkflowCanvasSchema.safeParse(input).success, false);
});

test('canvas rejects unknown versions, duplicate identities and inline file bytes', () => {
  assert.equal(WorkflowCanvasSchema.safeParse({ ...canvas(), schemaVersion: 2 }).success, false);
  const duplicate = canvas();
  duplicate.elements.push(duplicate.elements[0]);
  assert.equal(WorkflowCanvasSchema.safeParse(duplicate).success, false);
  assert.equal(WorkflowCanvasSchema.safeParse({ ...canvas(), files: { image: { dataURL: 'data:image/png;base64,a' } } }).success, false);
});

test('editor commands require a concurrency revision and stable request identity', () => {
  assert.equal(WorkflowEditorCommandSchema.safeParse({}).success, false);
  assert.equal(WorkflowEditorCommandSchema.safeParse({ expectedRecordVersion: -1, requestId: 'r', definition: {} }).success, false);
});

test('canvas does not participate in executable workflow compilation', () => {
  const task = { name: 'branch', taskReferenceName: 'branch', type: 'SWITCH', evaluatorType: 'value-param', expression: 'value', inputParameters: {}, decisionCases: { yes: [{ name: 'noop', taskReferenceName: 'a', type: 'SIMPLE', inputParameters: { value: '${workflow.input.value}' } }] }, defaultCase: [] };
  const definition = compileWorkflowDefinitionFromConductor({
    metadata: { id: 'workflow-1', version: 1, name: 'Fixture', role: 'workflow', teamId: 'team-1', creatorRef: { kind: 'user', id: 'user-1' }, tags: [] },
    revision: { kind: 'release', recordVersion: 1 }, presentation: {},
    conductor: { name: 'workflow-1', version: 1, timeoutSeconds: 0, tasks: [task], inputParameters: [], outputParameters: {} },
    variables: [], output: [], execution: { retries: 0, idempotency: 'supported' }, triggers: [], views: [],
    dataContracts: { reads: [], writes: [], emits: [] }, governance: { activated: true, validated: true, validationIssues: [] }, interfaces: { openai: { enabled: false } },
  });
  const before = compileConductorWorkflowDefinition(definition);
  const after = WorkflowDefinitionSchema.parse({ ...definition, presentation: { canvas: canvas() } });
  assert.deepEqual(compileConductorWorkflowDefinition(after), before);
});
