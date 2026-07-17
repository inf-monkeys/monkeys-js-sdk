import type { ContractPort } from '../contracts/capability';
import type {
  ConductorTaskDefinition,
  ConductorWorkflowDefinition,
  WorkflowDefinition,
  WorkflowOutputBinding,
  WorkflowParameter,
} from '../contracts/workflow-definition';
import {
  ConductorWorkflowDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowOutputBindingSchema,
  WorkflowParameterSchema,
} from '../contracts/workflow-definition';

export interface CompileWorkflowDefinitionFromConductorInput {
  metadata: WorkflowDefinition['metadata'];
  revision: WorkflowDefinition['revision'];
  presentation: WorkflowDefinition['presentation'];
  conductor: ConductorWorkflowDefinition;
  variables: readonly WorkflowParameter[];
  output: readonly WorkflowOutputBinding[];
  execution: Omit<WorkflowDefinition['execution'], 'timeoutMs' | 'conductor'>;
  triggers: WorkflowDefinition['triggers'];
  views: WorkflowDefinition['views'];
  dataContracts: WorkflowDefinition['dataContracts'];
  governance: WorkflowDefinition['governance'];
  interfaces: WorkflowDefinition['interfaces'];
}

export interface WorkflowPersistenceProjection {
  tasks: readonly ConductorTaskDefinition[];
  variables: readonly WorkflowParameter[];
  output: readonly WorkflowOutputBinding[];
}

const localizedText = (value: WorkflowDefinition['metadata']['description']): string | undefined => {
  if (typeof value === 'string') return value;
  if (!value) return undefined;
  return value['en-US'] ?? value['zh-CN'] ?? Object.values(value)[0];
};
const parameterPort = (workflowId: string, parameter: WorkflowParameter): ContractPort => ({
  name: parameter.name,
  schemaRef: `schema://workflow/${workflowId}/input/${parameter.name}`,
  required: parameter.required === true,
  multiple: parameter.typeOptions?.multipleValues === true,
  description: localizedText(parameter.description),
});

const outputPort = (workflowId: string, output: WorkflowOutputBinding): ContractPort => ({
  name: output.key,
  schemaRef: `schema://workflow/${workflowId}/output/${output.key}`,
  required: false,
  multiple: false,
});

/**
 * One-time production compiler from Conductor + authoring data to the canonical
 * WorkflowDefinition. Nested control-flow tasks remain typed inside each node,
 * so the projection does not depend on a lossy graph reconstruction.
 */
export const compileWorkflowDefinitionFromConductor = (
  input: CompileWorkflowDefinitionFromConductorInput,
): WorkflowDefinition => {
  const conductor = ConductorWorkflowDefinitionSchema.parse(input.conductor);
  if (conductor.name !== input.metadata.id || conductor.version !== input.metadata.version) {
    throw new Error('Conductor workflow identity must match canonical metadata.');
  }
  const variables = input.variables.map((parameter) => WorkflowParameterSchema.parse(parameter));
  const outputs = input.output.map((output) => WorkflowOutputBindingSchema.parse(output));
  if (JSON.stringify(conductor.inputParameters) !== JSON.stringify(variables.map((parameter) => parameter.name))) {
    throw new Error('Conductor inputParameters must match canonical workflow variables in order.');
  }
  const expectedOutput = Object.fromEntries(outputs.map((output) => [output.key, output.value]));
  if (JSON.stringify(conductor.outputParameters ?? {}) !== JSON.stringify(expectedOutput)) {
    throw new Error('Conductor outputParameters must match canonical workflow output bindings.');
  }

  const nodes = conductor.tasks.map((task) => ({
    id: task.taskReferenceName,
    referenceName: task.taskReferenceName,
    capabilityRef: task.name,
    inputBindings: task.inputParameters ?? {},
    configuration: { executor: 'conductor' as const, task },
  }));
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }));
  const {
    name: _name,
    description: _description,
    version: _version,
    tasks: _tasks,
    inputParameters: _inputParameters,
    outputParameters: _outputParameters,
    timeoutSeconds,
    ...conductorOptions
  } = conductor;

  return WorkflowDefinitionSchema.parse({
    contract: 'WorkflowDefinition',
    metadata: input.metadata,
    revision: input.revision,
    presentation: input.presentation,
    ports: {
      inputs: variables.map((parameter) => parameterPort(input.metadata.id, parameter)),
      outputs: outputs.map((output) => outputPort(input.metadata.id, output)),
    },
    parameters: { variables, outputs },
    graph: { nodes, edges },
    execution: {
      ...input.execution,
      ...(timeoutSeconds > 0 ? { timeoutMs: timeoutSeconds * 1000 } : {}),
      conductor: conductorOptions,
    },
    triggers: input.triggers,
    views: input.views,
    dataContracts: input.dataContracts,
    governance: input.governance,
    interfaces: input.interfaces,
  });
};

export const compileConductorWorkflowDefinition = (
  input: WorkflowDefinition,
): ConductorWorkflowDefinition => {
  const workflow = WorkflowDefinitionSchema.parse(input);
  return ConductorWorkflowDefinitionSchema.parse({
    ...workflow.execution.conductor,
    name: workflow.metadata.id,
    description: localizedText(workflow.metadata.description),
    version: workflow.metadata.version,
    tasks: workflow.graph.nodes.map((node) => node.configuration.task),
    inputParameters: workflow.parameters.variables.map((parameter) => parameter.name),
    outputParameters: Object.fromEntries(workflow.parameters.outputs.map((output) => [output.key, output.value])),
    timeoutSeconds: workflow.execution.timeoutMs ? Math.ceil(workflow.execution.timeoutMs / 1000) : 0,
  });
};

export const compileWorkflowPersistenceProjection = (
  input: WorkflowDefinition,
): WorkflowPersistenceProjection => {
  const workflow = WorkflowDefinitionSchema.parse(input);
  return Object.freeze({
    tasks: Object.freeze(workflow.graph.nodes.map((node) => node.configuration.task)),
    variables: Object.freeze(workflow.parameters.variables),
    output: Object.freeze(workflow.parameters.outputs),
  });
};
