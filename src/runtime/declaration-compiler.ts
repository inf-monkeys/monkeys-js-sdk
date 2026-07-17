import type { CapabilityManifest } from '../contracts/capability';
import { CapabilityManifestSchema } from '../contracts/capability';
import type { EntityRef } from '../contracts/common';
import type { PageDefinition } from '../contracts/page';
import {
  ChangeImpactGraphSchema,
  DomainCommandDefinitionSchema,
  DomainCommandSchema,
  ProductDeclarationSchema,
  type ChangeImpactGraph,
  type DomainCommand,
  type DomainCommandDefinition,
  type ProductDeclaration,
} from '../contracts/semantic';

const uniqueIndex = <T>(values: readonly T[], key: (value: T) => string, label: string): ReadonlyMap<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
    result.set(id, value);
  }
  return result;
};

const ref = (kind: string, id: string): EntityRef => ({ kind, id });
const refKey = (value: EntityRef) => `${value.kind}:${value.id}`;

export interface CompiledProductDeclaration {
  declaration: ProductDeclaration;
  conceptsById: ReadonlyMap<string, ProductDeclaration['concepts'][number]>;
  ontologiesById: ReadonlyMap<string, ProductDeclaration['ontologies'][number]>;
  projectionsById: ReadonlyMap<string, ProductDeclaration['projections'][number]>;
  commandsByName: ReadonlyMap<string, DomainCommandDefinition>;
  capabilitiesById: ReadonlyMap<string, CapabilityManifest>;
  pagesById: ReadonlyMap<string, PageDefinition>;
  nodes: readonly EntityRef[];
  edges: readonly ChangeImpactGraph['edges'][number][];
}

export interface ToolCapabilityPortSource {
  name: string;
  required?: boolean;
  type?: string;
  description?: string;
}

export interface ToolCapabilitySource {
  id: string;
  capabilityVersion: string;
  ownerRepo: string;
  displayName: string;
  description?: string;
  inputs?: readonly ToolCapabilityPortSource[];
  outputs?: readonly ToolCapabilityPortSource[];
  sideEffects?: CapabilityManifest['runtime']['sideEffects'];
}

export interface OpenApiToolCapabilityPublisherOptions {
  namespace: string;
  ownerRepo: string;
  capabilityVersion: string;
}

export const compileToolCapabilityManifest = (input: unknown): CapabilityManifest => {
  const manifest = CapabilityManifestSchema.parse(input);
  if (manifest.kind !== 'tool') throw new Error(`Capability ${manifest.id} must use kind tool.`);
  if (manifest.runtime.providerRef.kind !== 'tool') {
    throw new Error(`Tool capability ${manifest.id} must reference a tool provider.`);
  }
  return Object.freeze(manifest);
};

export const createToolCapabilityManifest = (input: ToolCapabilitySource): CapabilityManifest => {
  const ports = (direction: 'input' | 'output', values: readonly ToolCapabilityPortSource[] = []) =>
    values.map((value) => ({
      name: String(value.name),
      schemaRef: `schema://tool/${input.id}/${direction}/${String(value.name)}`,
      required: value.required === true,
      multiple: value.type === 'array',
      description: value.description,
    }));
  return compileToolCapabilityManifest({
    contract: 'CapabilityManifest',
    id: input.id,
    capabilityVersion: input.capabilityVersion,
    ownerRepo: input.ownerRepo,
    kind: 'tool',
    displayName: input.displayName,
    description: input.description,
    ports: { inputs: ports('input', input.inputs), outputs: ports('output', input.outputs) },
    runtime: {
      providerRef: { kind: 'tool', id: input.id },
      loading: 'on-activation',
      stateOwner: 'provider',
      sideEffects: input.sideEffects ?? ['network'],
    },
    placement: { surfaces: ['agent', 'workflow'], slots: [], variants: [], tokenRefs: [] },
    accessibility: { keyboardModel: 'tool-form', focusModel: 'host-managed', labelContract: 'tool-display-name' },
    observability: { eventNamespace: `tool.${input.id}`, metrics: ['calls', 'duration', 'errors'], evidenceRefs: [] },
  });
};

const TOOL_HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const normalizeToolIdentifier = (value: string) => value.replace(/[^a-zA-Z0-9_.-]/g, '_');
const localizedText = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const locale of ['en-US', 'zh-CN']) {
      if (typeof record[locale] === 'string' && String(record[locale]).trim()) return String(record[locale]);
    }
  }
  return fallback;
};

const normalizeToolCapabilityPorts = (
  value: unknown,
  direction: 'input' | 'output',
): ToolCapabilityPortSource[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Tool ${direction} declaration must be an array.`);

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Tool ${direction} declaration at index ${index} must be an object.`);
    }

    const record = item as Record<string, unknown>;
    if (typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error(`Tool ${direction} declaration at index ${index} must have a non-empty name.`);
    }
    if (record.required !== undefined && typeof record.required !== 'boolean') {
      throw new Error(`Tool ${direction} ${record.name} required must be a boolean.`);
    }
    if (record.type !== undefined && (typeof record.type !== 'string' || !record.type.trim())) {
      throw new Error(`Tool ${direction} ${record.name} type must be a non-empty string.`);
    }

    const name = record.name.trim();
    const descriptionSource = record.description ?? record.displayName;
    return {
      name,
      required: record.required === true,
      type: typeof record.type === 'string' ? record.type.trim() : undefined,
      description: descriptionSource === undefined
        ? undefined
        : localizedText(descriptionSource, name),
    };
  });
};

/** Publishes canonical CapabilityManifest values on every tool operation in an OpenAPI document. */
export const publishOpenApiToolCapabilityManifests = <T extends Record<string, unknown>>(
  document: T,
  options: OpenApiToolCapabilityPublisherOptions,
): T => {
  const paths = document.paths;
  if (!paths || typeof paths !== 'object') throw new Error('OpenAPI document paths are required.');
  for (const pathItem of Object.values(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operationValue] of Object.entries(pathItem as Record<string, unknown>)) {
      if (!TOOL_HTTP_METHODS.has(method.toLowerCase()) || !operationValue || typeof operationValue !== 'object') continue;
      const operation = operationValue as Record<string, unknown>;
      const declaredName = operation['x-monkey-tool-name'];
      if (typeof declaredName !== 'string' || !declaredName.trim()) continue;
      const toolName = normalizeToolIdentifier(declaredName);
      const id = `${normalizeToolIdentifier(options.namespace)}_${toolName}`;
      const displayName = localizedText(operation['x-monkey-tool-display-name'] ?? operation.summary, toolName);
      const description = localizedText(operation['x-monkey-tool-description'] ?? operation.description, displayName);
      const inputs = normalizeToolCapabilityPorts(operation['x-monkey-tool-input'], 'input');
      const outputs = normalizeToolCapabilityPorts(operation['x-monkey-tool-output'], 'output');
      operation['x-monkeys-capability-manifest'] = createToolCapabilityManifest({
        id,
        capabilityVersion: typeof operation['x-monkey-tool-version'] === 'string'
          ? operation['x-monkey-tool-version']
          : options.capabilityVersion,
        ownerRepo: options.ownerRepo,
        displayName,
        description,
        inputs,
        outputs,
        sideEffects: Array.isArray(operation['x-monkey-tool-side-effects'])
          ? operation['x-monkey-tool-side-effects'] as CapabilityManifest['runtime']['sideEffects']
          : undefined,
      });
    }
  }
  return document;
};

export const compileProductDeclaration = (input: ProductDeclaration): CompiledProductDeclaration => {
  const declaration = ProductDeclarationSchema.parse(input);
  const conceptsById = uniqueIndex(declaration.concepts, (value) => value.conceptId, 'concept id');
  const ontologiesById = uniqueIndex(declaration.ontologies, (value) => value.ontologyId, 'ontology id');
  const projectionsById = uniqueIndex(declaration.projections, (value) => value.projectionId, 'projection id');
  const commandsByName = uniqueIndex(declaration.commands, (value) => value.commandName, 'command name');
  const capabilitiesById = uniqueIndex(declaration.capabilities, (value) => value.id, 'capability id');
  const pagesById = uniqueIndex(declaration.pages, (value) => value.pageId, 'page id');
  const nodes: EntityRef[] = [];
  const edges: ChangeImpactGraph['edges'] = [];

  const addNode = (kind: string, id: string) => nodes.push(ref(kind, id));
  const addEdge = (from: EntityRef, to: EntityRef, relation: ChangeImpactGraph['edges'][number]['relation']) =>
    edges.push({ from, to, relation });

  for (const ontology of declaration.ontologies) addNode('ontology', ontology.ontologyId);
  for (const projection of declaration.projections) {
    addNode('projection', projection.projectionId);
    for (const ontologyId of projection.ontologyIds) {
      if (!ontologiesById.has(ontologyId)) throw new Error(`Projection ${projection.projectionId} references unknown ontology ${ontologyId}.`);
      addEdge(ref('projection', projection.projectionId), ref('ontology', ontologyId), 'uses-ontology');
    }
  }
  for (const command of declaration.commands) addNode('command', command.commandName);
  for (const capability of declaration.capabilities) addNode('capability', capability.id);
  for (const concept of declaration.concepts) {
    addNode('concept', concept.conceptId);
    if (concept.ontologyId) {
      if (!ontologiesById.has(concept.ontologyId)) throw new Error(`Concept ${concept.conceptId} references unknown ontology ${concept.ontologyId}.`);
      addEdge(ref('concept', concept.conceptId), ref('ontology', concept.ontologyId), 'uses-ontology');
    }
    for (const capabilityId of concept.capabilityIds) {
      if (!capabilitiesById.has(capabilityId)) throw new Error(`Concept ${concept.conceptId} references unknown capability ${capabilityId}.`);
      addEdge(ref('concept', concept.conceptId), ref('capability', capabilityId), 'uses-capability');
    }
    for (const commandName of concept.commandNames) {
      if (!commandsByName.has(commandName)) throw new Error(`Concept ${concept.conceptId} references unknown command ${commandName}.`);
      addEdge(ref('concept', concept.conceptId), ref('command', commandName), 'uses-command');
    }
    for (const relationship of concept.relationships) {
      if (!conceptsById.has(relationship.targetConceptId)) {
        throw new Error(`Concept ${concept.conceptId} references unknown concept ${relationship.targetConceptId}.`);
      }
      addEdge(ref('concept', concept.conceptId), ref('concept', relationship.targetConceptId), 'relates-to-concept');
    }
  }
  for (const page of declaration.pages) {
    addNode('page', page.pageId);
    if (page.binding.ontologyId) {
      if (!ontologiesById.has(page.binding.ontologyId)) throw new Error(`Page ${page.pageId} references unknown ontology ${page.binding.ontologyId}.`);
      addEdge(ref('page', page.pageId), ref('ontology', page.binding.ontologyId), 'uses-ontology');
    }
    if (page.binding.projectionRef) {
      if (!projectionsById.has(page.binding.projectionRef)) throw new Error(`Page ${page.pageId} references unknown projection ${page.binding.projectionRef}.`);
      addEdge(ref('page', page.pageId), ref('projection', page.binding.projectionRef), 'uses-projection');
    }
    for (const capabilityRef of [page.capabilityRef, ...page.capabilityRefs].filter(Boolean) as EntityRef[]) {
      if (!capabilitiesById.has(capabilityRef.id)) throw new Error(`Page ${page.pageId} references unknown capability ${capabilityRef.id}.`);
      addEdge(ref('page', page.pageId), ref('capability', capabilityRef.id), 'uses-capability');
    }
  }

  uniqueIndex(nodes, refKey, 'declaration node');
  return Object.freeze({
    declaration: Object.freeze(declaration),
    conceptsById,
    ontologiesById,
    projectionsById,
    commandsByName,
    capabilitiesById,
    pagesById,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
};

export const validateDomainCommand = (
  input: DomainCommand,
  definitions: readonly DomainCommandDefinition[],
  permissionCodes: readonly string[],
): DomainCommand => {
  const command = DomainCommandSchema.parse(input);
  const commandsByName = uniqueIndex(
    definitions.map((definition) => DomainCommandDefinitionSchema.parse(definition)),
    (definition) => definition.commandName,
    'command name',
  );
  const definition = commandsByName.get(command.commandName);
  if (!definition) throw new Error(`Unknown domain command: ${command.commandName}`);
  if (!definition.targetKinds.includes(command.targetRef.kind)) {
    throw new Error(`Command ${command.commandName} does not accept target kind ${command.targetRef.kind}.`);
  }
  const granted = new Set(permissionCodes);
  const missing = definition.requiredPermissionCodes.filter((permission) => !granted.has(permission));
  if (missing.length) throw new Error(`Command ${command.commandName} requires permissions: ${missing.join(', ')}`);
  return Object.freeze(command);
};

const declarationValuesByRef = (compiled: CompiledProductDeclaration): Map<string, unknown> => {
  const values = new Map<string, unknown>();
  for (const value of compiled.declaration.ontologies) values.set(refKey(ref('ontology', value.ontologyId)), value);
  for (const value of compiled.declaration.projections) values.set(refKey(ref('projection', value.projectionId)), value);
  for (const value of compiled.declaration.commands) values.set(refKey(ref('command', value.commandName)), value);
  for (const value of compiled.declaration.capabilities) values.set(refKey(ref('capability', value.id)), value);
  for (const value of compiled.declaration.concepts) values.set(refKey(ref('concept', value.conceptId)), value);
  for (const value of compiled.declaration.pages) values.set(refKey(ref('page', value.pageId)), value);
  return values;
};

export const buildChangeImpactGraph = (
  previousInput: ProductDeclaration,
  nextInput: ProductDeclaration,
  generatedAt = new Date().toISOString(),
): ChangeImpactGraph => {
  const previous = compileProductDeclaration(previousInput);
  const next = compileProductDeclaration(nextInput);
  const previousValues = declarationValuesByRef(previous);
  const nextValues = declarationValuesByRef(next);
  const changedKeys = new Set<string>();
  for (const key of new Set([...previousValues.keys(), ...nextValues.keys()])) {
    if (JSON.stringify(previousValues.get(key)) !== JSON.stringify(nextValues.get(key))) changedKeys.add(key);
  }

  const reverse = new Map<string, Set<string>>();
  for (const edge of [...previous.edges, ...next.edges]) {
    const dependency = refKey(edge.to);
    const dependent = refKey(edge.from);
    const values = reverse.get(dependency) ?? new Set<string>();
    values.add(dependent);
    reverse.set(dependency, values);
  }
  const refs = new Map<string, EntityRef>();
  for (const node of [...previous.nodes, ...next.nodes]) refs.set(refKey(node), node);
  const impacts = Array.from(changedKeys).sort().map((changedKey) => {
    const affected = new Set<string>();
    const queue = [...(reverse.get(changedKey) ?? [])];
    while (queue.length) {
      const current = queue.shift()!;
      if (affected.has(current)) continue;
      affected.add(current);
      queue.push(...(reverse.get(current) ?? []));
    }
    return {
      changedRef: refs.get(changedKey) ?? (() => {
        const separator = changedKey.indexOf(':');
        return ref(changedKey.slice(0, separator), changedKey.slice(separator + 1));
      })(),
      affectedRefs: Array.from(affected).sort().map((key) => refs.get(key)!),
      reasons: affected.size ? ['dependency'] : ['direct-change'],
    };
  });

  return ChangeImpactGraphSchema.parse({
    contract: 'ChangeImpactGraph',
    declarationId: next.declaration.declarationId,
    nodes: Array.from(refs.values()).sort((left, right) => refKey(left).localeCompare(refKey(right))),
    edges: next.edges,
    impacts,
    generatedAt,
  });
};
