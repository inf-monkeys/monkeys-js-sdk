import type {
  CapabilityManifest,
  CapabilityRegistryDocument,
  CapabilityRegistrySource,
  CapabilitySourceType,
} from '../contracts/capability';
import {
  CapabilityManifestSchema,
  CapabilityRegistryDocumentSchema,
  CapabilityRegistrySourceSchema,
} from '../contracts/capability';
import type { EntityRef } from '../contracts/common';
import type { WorkflowDefinition } from '../contracts/workflow-definition';
import { WorkflowDefinitionSchema } from '../contracts/workflow-definition';

export interface CapabilityRegistryInputSource extends CapabilityRegistrySource {
  manifests: readonly unknown[];
}

export interface CompiledCapabilityRegistry {
  document: CapabilityRegistryDocument;
  manifests: readonly CapabilityManifest[];
  manifestsById: ReadonlyMap<string, CapabilityManifest>;
  sourcesByCapabilityId: ReadonlyMap<string, readonly CapabilityRegistrySource[]>;
  require(reference: EntityRef | string): CapabilityManifest;
}

const operationMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

/** Extracts only canonical extensions and fails when a declared Monkeys tool has no manifest. */
export const extractOpenApiCapabilityManifests = (document: unknown): CapabilityManifest[] => {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new TypeError('OpenAPI capability source must be an object.');
  }
  const paths = (document as Record<string, unknown>).paths;
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
    throw new TypeError('OpenAPI capability source must contain a paths object.');
  }

  const manifests: CapabilityManifest[] = [];
  for (const [path, pathValue] of Object.entries(paths)) {
    if (!pathValue || typeof pathValue !== 'object' || Array.isArray(pathValue)) continue;
    for (const [method, operationValue] of Object.entries(pathValue as Record<string, unknown>)) {
      if (!operationMethods.has(method.toLowerCase()) || !operationValue || typeof operationValue !== 'object' || Array.isArray(operationValue)) continue;
      const operation = operationValue as Record<string, unknown>;
      const manifest = operation['x-monkeys-capability-manifest'];
      if (manifest === undefined) {
        if (operation['x-monkey-tool-name'] !== undefined) {
          throw new Error(`OpenAPI operation ${method.toUpperCase()} ${path} declares a tool without x-monkeys-capability-manifest.`);
        }
        continue;
      }
      manifests.push(CapabilityManifestSchema.parse(manifest));
    }
  }
  return manifests;
};

export const createCapabilityRegistrySource = (
  sourceType: CapabilitySourceType,
  sourceId: string,
  ownerRepo: string,
  manifests: readonly unknown[],
): CapabilityRegistryInputSource => ({
  ...CapabilityRegistrySourceSchema.parse({ sourceType, sourceId, ownerRepo }),
  manifests,
});

export const createOpenApiCapabilityRegistrySource = (
  sourceId: string,
  ownerRepo: string,
  document: unknown,
): CapabilityRegistryInputSource =>
  createCapabilityRegistrySource('openapi', sourceId, ownerRepo, extractOpenApiCapabilityManifests(document));

export interface WorkflowCapabilityManifestOptions {
  ownerRepo: string;
  surfaces: readonly string[];
  slots?: readonly string[];
  variants?: readonly string[];
  tokenRefs?: readonly string[];
}

export const createWorkflowCapabilityManifest = (
  input: WorkflowDefinition,
  options: WorkflowCapabilityManifestOptions,
): CapabilityManifest => {
  const workflow = WorkflowDefinitionSchema.parse(input);
  return CapabilityManifestSchema.parse({
    contract: 'CapabilityManifest',
    id: workflow.metadata.id,
    capabilityVersion: String(workflow.metadata.version),
    ownerRepo: options.ownerRepo,
    kind: 'workflow',
    displayName: typeof workflow.metadata.name === 'string'
      ? workflow.metadata.name
      : workflow.metadata.name?.['en-US'] ?? workflow.metadata.name?.['zh-CN'] ?? workflow.metadata.id,
    description: typeof workflow.metadata.description === 'string'
      ? workflow.metadata.description
      : workflow.metadata.description?.['en-US'] ?? workflow.metadata.description?.['zh-CN'],
    ports: workflow.ports,
    runtime: {
      providerBindings: [{
        providerRef: { kind: 'workflow', id: workflow.metadata.id, version: workflow.metadata.version, ownerRepo: options.ownerRepo },
        productContexts: [],
        priority: 0,
      }],
      loading: 'on-activation',
      stateOwner: 'external',
      sideEffects: ['network', 'storage', 'worker'],
    },
    placement: {
      surfaces: options.surfaces,
      slots: options.slots ?? [],
      variants: options.variants ?? [],
      tokenRefs: options.tokenRefs ?? [],
    },
    accessibility: {
      keyboardModel: 'workflow-form',
      focusModel: 'host-managed',
      labelContract: 'workflow-display-name',
    },
    observability: {
      eventNamespace: `workflow.${workflow.metadata.id}`,
      metrics: ['runs', 'duration', 'errors'],
      evidenceRefs: [],
      performanceBudgetMs: workflow.execution.timeoutMs,
    },
  });
};

/** Compiles all production declaration sources into one immutable, conflict-free registry. */
export const compileCapabilityRegistry = (
  sources: readonly CapabilityRegistryInputSource[],
): CompiledCapabilityRegistry => {
  const entriesById = new Map<string, { manifest: CapabilityManifest; sources: CapabilityRegistrySource[] }>();
  const seenSources = new Set<string>();

  for (const sourceInput of sources) {
    const source = CapabilityRegistrySourceSchema.parse({
      sourceType: sourceInput.sourceType,
      sourceId: sourceInput.sourceId,
      ownerRepo: sourceInput.ownerRepo,
    });
    const sourceKey = `${source.sourceType}:${source.sourceId}`;
    if (seenSources.has(sourceKey)) throw new Error(`Duplicate capability source: ${sourceKey}`);
    seenSources.add(sourceKey);

    for (const manifestInput of sourceInput.manifests) {
      const manifest = CapabilityManifestSchema.parse(manifestInput);
      if (manifest.ownerRepo !== source.ownerRepo) {
        throw new Error(`Capability ${manifest.id} owner ${manifest.ownerRepo} does not match source owner ${source.ownerRepo}.`);
      }
      const existing = entriesById.get(manifest.id);
      if (!existing) {
        entriesById.set(manifest.id, { manifest, sources: [source] });
        continue;
      }
      if (JSON.stringify(existing.manifest) !== JSON.stringify(manifest)) {
        throw new Error(`Conflicting capability declarations for ${manifest.id}.`);
      }
      existing.sources.push(source);
    }
  }

  const document = CapabilityRegistryDocumentSchema.parse({
    contract: 'CapabilityRegistry',
    entries: Array.from(entriesById.values()).sort((left, right) => left.manifest.id.localeCompare(right.manifest.id)),
  });
  const manifests = Object.freeze(document.entries.map((entry) => entry.manifest));
  const manifestsById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const sourcesByCapabilityId = new Map(document.entries.map((entry) => [entry.manifest.id, Object.freeze(entry.sources)]));

  return Object.freeze({
    document: Object.freeze(document),
    manifests,
    manifestsById,
    sourcesByCapabilityId,
    require(reference: EntityRef | string): CapabilityManifest {
      if (typeof reference !== 'string' && reference.kind !== 'capability') {
        throw new Error(`Expected a capability reference, received ${reference.kind}:${reference.id}.`);
      }
      const id = typeof reference === 'string' ? reference : reference.id;
      const manifest = manifestsById.get(id);
      if (!manifest) throw new Error(`Unknown capability: ${id}`);
      if (typeof reference !== 'string' && reference.version !== undefined && String(reference.version) !== manifest.capabilityVersion) {
        throw new Error(`Capability ${id} version ${String(reference.version)} is not active; expected ${manifest.capabilityVersion}.`);
      }
      return manifest;
    },
  });
};
