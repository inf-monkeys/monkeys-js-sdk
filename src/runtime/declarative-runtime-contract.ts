import type { CapabilityInstance, RevisionRef } from '../contracts/declarative-control';
import type { DesignCapabilityCatalogEntry } from '../contracts/declarative-control-http';
import type { RenderNode, ViewProviderDescriptor } from '../contracts/render';
import { canonicalContentHash, sameStableRef, sameSchemaContract, sameRevisionRef } from './declarative-control-compiler';

/** The public contract is independent of the implementation snapshot revision. */
export const assertViewProviderContract = (
  node: Pick<RenderNode, 'capabilityRef' | 'providerRef' | 'runtimeContractVersion'>,
  provider: ViewProviderDescriptor,
): void => {
  if (node.capabilityRef.kind !== 'capability' || node.providerRef?.kind !== 'view-provider' ||
      node.capabilityRef.id !== provider.capabilityRef.id || node.capabilityRef.ownerRepo !== provider.capabilityRef.ownerRepo ||
      node.providerRef.id !== provider.providerId || node.providerRef.ownerRepo !== provider.ownerRepo) {
    throw new TypeError('Runtime capability and provider identities do not match their registered owners.');
  }
  if (node.runtimeContractVersion !== undefined) {
    if (node.runtimeContractVersion !== provider.runtimeContractVersion) {
      throw new TypeError('The provider does not implement the declared runtime contract.');
    }
  } else if (String(node.capabilityRef.version) !== String(provider.capabilityRef.version) ||
      String(node.providerRef.version) !== provider.providerVersion) {
    throw new TypeError('An unversioned runtime contract requires an exact provider snapshot.');
  }
};

export type DeclarativeCapabilityContractRequest = Pick<CapabilityInstance,
  'capabilityRevisionRef' | 'providerRevisionRef' | 'runtimeContractVersion'> &
  Partial<Pick<CapabilityInstance, 'propertySchemaRevisionRef'>> & { inputSchemaRevisionRef?: RevisionRef };

export const supportsCapabilityInputSchema = (
  entry: DesignCapabilityCatalogEntry,
  reference: RevisionRef,
  runtimeContractVersion?: string,
  portName?: string,
): boolean => entry.declarativeRegistration.inputPorts.some(port =>
  (portName === undefined || port.name === portName) &&
  (sameSchemaContract(port.schemaRevisionRef, reference) ||
    (runtimeContractVersion !== undefined && runtimeContractVersion === entry.provider.runtimeContractVersion &&
      reference.schemaVersion === port.schemaRevisionRef.schemaVersion && sameStableRef(port.schemaRevisionRef, reference))));

/** Validate the saved contract without rewriting the declaration or its hashes. */
export const assertDeclarativeCapabilityContract = (
  entry: DesignCapabilityCatalogEntry,
  request: DeclarativeCapabilityContractRequest,
): void => {
  const registration = entry.declarativeRegistration;
  if (request.inputSchemaRevisionRef && !supportsCapabilityInputSchema(entry, request.inputSchemaRevisionRef, request.runtimeContractVersion)) {
    throw new TypeError('The input schema is not owned by the runtime contract.');
  }
  if (!sameStableRef(request.capabilityRevisionRef, registration.capabilityRevisionRef) ||
      !sameStableRef(request.providerRevisionRef, registration.providerRevisionRef) ||
      request.capabilityRevisionRef.schemaVersion !== registration.capabilityRevisionRef.schemaVersion ||
      request.providerRevisionRef.schemaVersion !== registration.providerRevisionRef.schemaVersion) {
    throw new TypeError('Runtime contract snapshots must retain their registered identity, scope and schema version.');
  }
  if (request.runtimeContractVersion !== undefined) {
    if (request.runtimeContractVersion !== entry.provider.runtimeContractVersion ||
        (request.propertySchemaRevisionRef && (!sameStableRef(request.propertySchemaRevisionRef, registration.propertySchemaRevisionRef) || request.propertySchemaRevisionRef.schemaVersion !== registration.propertySchemaRevisionRef.schemaVersion))) {
      throw new TypeError('The capability does not implement the declared runtime contract.');
    }
    return;
  }
  // Older declarations contain only immutable snapshots. Reconstruct their
  // numbering and require both full hashes; matching IDs never proves support.
  const capabilityVersion = String(request.capabilityRevisionRef.revision);
  const providerVersion = String(request.providerRevisionRef.revision);
  const manifest = {
    ...entry.manifest, capabilityVersion,
    runtime: {
      ...entry.manifest.runtime,
      providerBindings: entry.manifest.runtime.providerBindings.map(binding => ({
        ...binding,
        providerRef: binding.providerRef.id === entry.provider.providerId
          ? { ...binding.providerRef, version: providerVersion } : binding.providerRef,
      })),
    },
  };
  const { runtimeContractVersion: _contract, ...descriptor } = entry.provider;
  const provider = {
    ...descriptor, providerVersion,
    capabilityRef: { ...descriptor.capabilityRef, version: capabilityVersion },
    ...(descriptor.sideEffectAdapterRef ? { sideEffectAdapterRef: { ...descriptor.sideEffectAdapterRef, version: capabilityVersion } } : {}),
  };
  const exact = sameRevisionRef(request.capabilityRevisionRef, registration.capabilityRevisionRef) &&
    sameRevisionRef(request.providerRevisionRef, registration.providerRevisionRef);
  const equivalent = request.capabilityRevisionRef.contentHash === canonicalContentHash(manifest) &&
    request.providerRevisionRef.contentHash === canonicalContentHash(provider);
  if ((!exact && !equivalent) || (request.propertySchemaRevisionRef &&
      !sameSchemaContract(request.propertySchemaRevisionRef, registration.propertySchemaRevisionRef))) {
    throw new TypeError('The historical capability snapshot is not supported by the current runtime contract.');
  }
};

/** Prove exclusion from explicit constraints; unknown relationships may overlap. */
const schemasCannotOverlap = (left: unknown, right: unknown): boolean => {
  if (left === false || right === false) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
      Array.isArray(left) || Array.isArray(right)) return false;
  const a = left as Record<string, any>;
  const b = right as Record<string, any>;
  if (a.$ref || b.$ref) return false;
  // A union cannot overlap a schema when none of its branches can overlap it.
  // Sibling constraints can only reduce this union's accepted values.
  for (const key of ['anyOf', 'oneOf']) {
    if (Array.isArray(a[key]) && a[key].every((branch: unknown) => schemasCannotOverlap(branch, b))) return true;
    if (Array.isArray(b[key]) && b[key].every((branch: unknown) => schemasCannotOverlap(a, branch))) return true;
  }
  const values = (schema: typeof a): unknown[] | undefined =>
    Object.prototype.hasOwnProperty.call(schema, 'const') ? [schema.const] : Array.isArray(schema.enum) ? schema.enum : undefined;
  const av = values(a), bv = values(b);
  if (av && bv && av.every(value => !bv.some(other => canonicalContentHash(value) === canonicalContentHash(other)))) return true;
  // JSON primitive types can prove union branches disjoint even when only one
  // branch has const/enum (for example "auto" versus an integer column count).
  // Keep integer and number together: their value sets overlap.
  const declaredTypes = (schema: typeof a): string[] | undefined => {
    const types = typeof schema.type === 'string' ? [schema.type] : schema.type;
    if (!Array.isArray(types) || !types.length || types.some(type => !['null', 'boolean', 'object', 'array', 'number', 'integer', 'string'].includes(type))) return undefined;
    return types.map(type => type === 'integer' ? 'number' : type);
  };
  const valueTypes = (entries: unknown[] | undefined): string[] | undefined => entries?.map(value =>
    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
  const disjoint = (leftTypes: string[] | undefined, rightTypes: string[] | undefined): boolean =>
    !!leftTypes && !!rightTypes && leftTypes.every(type => !rightTypes.includes(type));
  const at = declaredTypes(a), bt = declaredTypes(b);
  if (disjoint(at, bt) || disjoint(valueTypes(av), bt) || disjoint(at, valueTypes(bv))) return true;
  if (a.type !== 'object' || b.type !== 'object') return false;
  const property = (schema: typeof a, key: string): unknown => schema.properties?.[key] ??
    (schema.patternProperties ? true : schema.additionalProperties ?? true);
  return [...(a.required ?? []), ...(b.required ?? [])].some(key =>
    schemasCannotOverlap(property(a, key), property(b, key)));
};

type NumericBound = { value: number; inclusive: boolean };

const numericBound = (schema: Record<string, unknown>, direction: 'lower' | 'upper'): NumericBound | undefined | null => {
  const inclusiveKey = direction === 'lower' ? 'minimum' : 'maximum';
  const exclusiveKey = direction === 'lower' ? 'exclusiveMinimum' : 'exclusiveMaximum';
  const inclusiveValue = schema[inclusiveKey];
  const exclusiveValue = schema[exclusiveKey];
  const candidates: NumericBound[] = [];
  if (inclusiveValue !== undefined) {
    if (typeof inclusiveValue !== 'number' || !Number.isFinite(inclusiveValue)) return null;
    candidates.push({ value: inclusiveValue, inclusive: true });
  }
  if (typeof exclusiveValue === 'number') {
    if (!Number.isFinite(exclusiveValue)) return null;
    candidates.push({ value: exclusiveValue, inclusive: false });
  } else if (exclusiveValue === true) {
    if (typeof inclusiveValue !== 'number' || !Number.isFinite(inclusiveValue)) return null;
    candidates.push({ value: inclusiveValue, inclusive: false });
  } else if (exclusiveValue !== undefined && exclusiveValue !== false) {
    return null;
  }
  if (!candidates.length) return undefined;
  const compare = direction === 'lower' ? Math.max : Math.min;
  const value = compare(...candidates.map(candidate => candidate.value));
  return { value, inclusive: candidates.filter(candidate => candidate.value === value).every(candidate => candidate.inclusive) };
};

const boundAcceptsPrevious = (previous: NumericBound | undefined | null, next: NumericBound | undefined | null, direction: 'lower' | 'upper'): boolean => {
  if (previous === null || next === null) return false;
  if (!next) return true;
  if (!previous) return false;
  if (direction === 'lower' && previous.value < next.value) return false;
  if (direction === 'upper' && previous.value > next.value) return false;
  return previous.value !== next.value || !previous.inclusive || next.inclusive;
};

const numericRangesAcceptPrevious = (previous: Record<string, unknown>, next: Record<string, unknown>): boolean =>
  boundAcceptsPrevious(numericBound(previous, 'lower'), numericBound(next, 'lower'), 'lower') &&
  boundAcceptsPrevious(numericBound(previous, 'upper'), numericBound(next, 'upper'), 'upper');

const containsSchemaReference = (value: unknown): boolean => !!value && typeof value === 'object' &&
  Object.entries(value).some(([key, child]) => ['$ref', '$dynamicRef', '$recursiveRef'].includes(key) || containsSchemaReference(child));

/** Definitions may expand together only when all references occur positively.
 * In particular, oneOf, negation and conditional tests are not monotone. */
const hasPositiveLocalReferences = (schema: unknown, names: ReadonlySet<string>, root = true): boolean => {
  if (typeof schema === 'boolean') return true;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
  return Object.entries(schema).every(([key, value]) => {
    if (key === '$ref') return typeof value === 'string' && [...names].some(name => value === `#/$defs/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`);
    if (['$dynamicRef', '$recursiveRef', '$dynamicAnchor', '$recursiveAnchor', '$anchor'].includes(key)) return false;
    if (key === '$id') return root;
    if (key === '$defs' || key === 'properties') {
      if (key === '$defs' && !root) return false;
      return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(child => hasPositiveLocalReferences(child, names, false));
    }
    if (['items', 'additionalProperties'].includes(key)) return hasPositiveLocalReferences(value, names, false);
    if (['anyOf', 'allOf'].includes(key)) return Array.isArray(value) && value.every(child => hasPositiveLocalReferences(child, names, false));
    return !containsSchemaReference(value);
  });
};

/** A newly introduced conditional must be unreachable for every old object,
 * including objects omitting the discriminant. Unknown predicates stay exact. */
const isUnreachableConditional = (previous: Record<string, any>, branch: unknown): boolean => {
  if (previous.type !== 'object' || !branch || typeof branch !== 'object' || Array.isArray(branch)) return false;
  const rule = branch as Record<string, any>;
  if (!rule.if || Object.keys(rule).some(key => !['if', 'then'].includes(key))) return false;
  const condition = rule.if;
  if (typeof condition !== 'object' || Array.isArray(condition) ||
      Object.keys(condition).some(key => !['type', 'properties', 'required'].includes(key)) ||
      (condition.type !== undefined && condition.type !== 'object') || !Array.isArray(condition.required)) return false;
  return condition.required.some((key: unknown) => typeof key === 'string' &&
    schemasCannotOverlap(previous.properties?.[key] ?? (previous.patternProperties ? true : previous.additionalProperties ?? true), condition.properties?.[key] ?? true));
};

/** Conservative schema inclusion; unknown relationships fail closed. */
export const acceptsPreviousSchema = (previous: unknown, next: unknown): boolean => {
  if (canonicalContentHash(previous) === canonicalContentHash(next) || next === true) return true;
  if (previous === false) return true;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' ||
      Array.isArray(previous) || Array.isArray(next)) return false;
  const withoutAnnotations = (schema: object) => Object.fromEntries(Object.entries(schema).filter(([key]) => !['title', 'description', 'examples', '$comment'].includes(key)));
  const before = withoutAnnotations(previous) as Record<string, any>;
  const after = withoutAnnotations(next) as Record<string, any>;
  // Keep all sibling constraints exact while comparing branches of a tagged
  // union. oneOf additionally requires proof that no other target branch matches.
  const union = (schema: typeof before) => {
    const key = Array.isArray(schema.oneOf) && !schema.anyOf ? 'oneOf' : Array.isArray(schema.anyOf) && !schema.oneOf ? 'anyOf' : undefined;
    if (!key) return undefined;
    const { [key]: alternatives, ...siblings } = schema;
    return { key, alternatives: alternatives as unknown[], siblings };
  };
  const oldUnion = union(before), newUnion = union(after);
  if (oldUnion && newUnion && canonicalContentHash(oldUnion.siblings) === canonicalContentHash(newUnion.siblings)) {
    return oldUnion.alternatives.every(branch => newUnion.alternatives.some((candidate, index) =>
      acceptsPreviousSchema(branch, candidate) && (newUnion.key !== 'oneOf' || newUnion.alternatives.every((other, otherIndex) =>
        index === otherIndex || schemasCannotOverlap(branch, other)))));
  }
  // Resolve standalone unions before inspecting sibling constraints. An old
  // allOf may be preserved inside a new union branch rather than at its root.
  const branches = (schema: typeof before): unknown[] | undefined => Object.keys(schema).length === 1
    ? Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined
    : undefined;
  const oldBranches = branches(before);
  if (oldBranches) return oldBranches.every(branch => acceptsPreviousSchema(branch, next));
  const newBranches = branches(after);
  if (newBranches) return newBranches.some((branch, index) => acceptsPreviousSchema(previous, branch) &&
    (!after.oneOf || newBranches.every((other, otherIndex) => index === otherIndex || schemasCannotOverlap(previous, other))));
  if (canonicalContentHash(before.$defs ?? null) !== canonicalContentHash(after.$defs ?? null)) {
    const oldDefinitions = before.$defs, newDefinitions = after.$defs;
    if (!oldDefinitions || !newDefinitions || typeof oldDefinitions !== 'object' || typeof newDefinitions !== 'object' ||
        Array.isArray(oldDefinitions) || Array.isArray(newDefinitions)) return false;
    const names = new Set(Object.keys(oldDefinitions));
    if (names.size !== Object.keys(newDefinitions).length || [...names].some(name => !Object.prototype.hasOwnProperty.call(newDefinitions, name)) ||
        !hasPositiveLocalReferences(before, names) || !hasPositiveLocalReferences(after, names) ||
        [...names].some(name => !acceptsPreviousSchema(oldDefinitions[name], newDefinitions[name]))) return false;
    // The positive recursive graph is monotone; every referenced definition
    // accepts its previous values. Compare the remaining root constraints.
    delete before.$defs;
    delete after.$defs;
  }
  if (canonicalContentHash(before.allOf ?? null) !== canonicalContentHash(after.allOf ?? null)) {
    if ((before.allOf !== undefined && !Array.isArray(before.allOf)) || !Array.isArray(after.allOf)) return false;
    const previousBranches: unknown[] = before.allOf ?? [];
    if (previousBranches.some(branch => !after.allOf.some((candidate: unknown) => canonicalContentHash(branch) === canonicalContentHash(candidate))) ||
        after.allOf.some((branch: unknown) => !previousBranches.some(candidate => canonicalContentHash(branch) === canonicalContentHash(candidate)) && !isUnreachableConditional(before, branch))) return false;
    if (before.allOf === undefined) delete after.allOf;
    else after.allOf = before.allOf;
  }
  const { properties: oldProperties, required: oldRequired, additionalProperties: oldAdditional,
    enum: oldEnum, items: oldItems, minimum: _oldMinimum, maximum: _oldMaximum,
    exclusiveMinimum: _oldExclusiveMinimum, exclusiveMaximum: _oldExclusiveMaximum, ...oldFixed } = before;
  const { properties: newProperties, required: newRequired, additionalProperties: newAdditional,
    enum: newEnum, items: newItems, minimum: _newMinimum, maximum: _newMaximum,
    exclusiveMinimum: _newExclusiveMinimum, exclusiveMaximum: _newExclusiveMaximum, ...newFixed } = after;
  if (canonicalContentHash(oldFixed) !== canonicalContentHash(newFixed)) return false;
  if (!numericRangesAcceptPrevious(before, after)) return false;
  // Homogeneous arrays apply the same inclusion rule to every element. Tuple
  // schemas and other array constraints stay exact unless already identical.
  if (!acceptsPreviousSchema(oldItems ?? true, newItems ?? true)) return false;
  if (newEnum && (!oldEnum || oldEnum.some((value: unknown) => !newEnum.some((candidate: unknown) =>
    canonicalContentHash(candidate) === canonicalContentHash(value))))) return false;
  if ((newRequired ?? []).some((key: string) => !(oldRequired ?? []).includes(key))) return false;
  const oldExtra = oldAdditional ?? true;
  const newExtra = newAdditional ?? true;
  if (!acceptsPreviousSchema(oldExtra, newExtra)) return false;
  const keys = new Set([...Object.keys(oldProperties ?? {}), ...Object.keys(newProperties ?? {})]);
  for (const key of keys) {
    if (!acceptsPreviousSchema(oldProperties?.[key] ?? oldExtra, newProperties?.[key] ?? newExtra)) return false;
  }
  return true;
};

/** A provider identity continues to serve every declaration on its public contract. */
export const assertCompatibleCapabilityUpgrade = (
  previous: DesignCapabilityCatalogEntry,
  next: DesignCapabilityCatalogEntry,
): void => {
  if ((previous.provider.runtimeContractVersion !== undefined && previous.provider.runtimeContractVersion !== next.provider.runtimeContractVersion) ||
      !sameStableRef(previous.declarativeRegistration.capabilityRevisionRef, next.declarativeRegistration.capabilityRevisionRef) ||
      !sameStableRef(previous.declarativeRegistration.providerRevisionRef, next.declarativeRegistration.providerRevisionRef)) {
    throw new TypeError('A breaking runtime contract requires a new capability/provider identity while the existing contract remains supported.');
  }
  const providerContract = (entry: DesignCapabilityCatalogEntry) => {
    const { providerVersion: _revision, capabilityRef, performance: _performance, sideEffectAdapterRef, ...rest } = entry.provider;
    const { version: _capabilityRevision, ...capability } = capabilityRef;
    return { ...rest, runtimeContractVersion: next.provider.runtimeContractVersion, capabilityRef: capability,
      ...(sideEffectAdapterRef ? { sideEffectAdapterRef: { ...sideEffectAdapterRef, version: undefined } } : {}) };
  };
  if (canonicalContentHash(providerContract(previous)) !== canonicalContentHash(providerContract(next))) {
    throw new TypeError('A compatible provider upgrade must preserve lifecycle, effects, ownership and public rendering semantics.');
  }
  const manifestContract = (entry: DesignCapabilityCatalogEntry) => ({
    kind: entry.manifest.kind,
    runtime: { ...entry.manifest.runtime, providerBindings: entry.manifest.runtime.providerBindings.map(binding => ({ ...binding, providerRef: { ...binding.providerRef, version: undefined } })) },
    placement: entry.manifest.placement && { ...entry.manifest.placement, slots: undefined },
    accessibility: entry.manifest.accessibility,
  });
  if (canonicalContentHash(manifestContract(previous)) !== canonicalContentHash(manifestContract(next))) {
    throw new TypeError('Capability behavior, placement and access semantics must preserve the published runtime contract.');
  }
  const oldRegistration = previous.declarativeRegistration;
  const newRegistration = next.declarativeRegistration;
  // Slots name optional composition points. Adding one cannot invalidate a
  // saved tree, while removing an existing point would orphan its children.
  for (const [oldSlots, newSlots] of [
    [previous.manifest.placement?.slots ?? [], next.manifest.placement?.slots ?? []],
    [oldRegistration.allowedSlots, newRegistration.allowedSlots],
  ]) {
    if (oldSlots.some(slot => !newSlots.includes(slot))) {
      throw new TypeError('Published runtime slots cannot be removed.');
    }
  }
  const schema = (entry: typeof oldRegistration, reference: RevisionRef) => {
    const document = entry.schemaDocuments.find(candidate => sameSchemaContract(candidate.schemaRevisionRef, reference));
    if (!document || canonicalContentHash(document.document) !== reference.contentHash) throw new TypeError('Runtime contract schema integrity failed.');
    return document.document;
  };
  const checkSchema = (oldRef: RevisionRef, newRef: RevisionRef, output = false) => {
    if (!sameStableRef(oldRef, newRef) || oldRef.schemaVersion !== newRef.schemaVersion ||
        !acceptsPreviousSchema(schema(output ? newRegistration : oldRegistration, output ? newRef : oldRef),
          schema(output ? oldRegistration : newRegistration, output ? oldRef : newRef))) {
      throw new TypeError(`Schema ${oldRef.id} breaks the published runtime contract.`);
    }
  };
  checkSchema(oldRegistration.propertySchemaRevisionRef, newRegistration.propertySchemaRevisionRef);
  for (const direction of ['inputPorts', 'outputPorts'] as const) {
    const oldPorts = oldRegistration[direction];
    const newPorts = newRegistration[direction];
    const oldManifestPorts = previous.manifest.ports?.[direction === 'inputPorts' ? 'inputs' : 'outputs'] ?? [];
    const newManifestPorts = next.manifest.ports?.[direction === 'inputPorts' ? 'inputs' : 'outputs'] ?? [];
    for (const port of oldManifestPorts) {
      const replacement = newManifestPorts.find(candidate => candidate.name === port.name);
      if (!replacement || canonicalContentHash(port) !== canonicalContentHash(replacement)) throw new TypeError('Published runtime port semantics changed.');
    }
    if (newManifestPorts.some(port => port.required && !oldManifestPorts.some(previousPort => previousPort.name === port.name)) ||
        newPorts.some(port => port.required && !oldPorts.some(previousPort => previousPort.name === port.name))) {
      throw new TypeError('New runtime ports must be optional for published declarations.');
    }
    for (const port of oldPorts) {
      const replacement = newPorts.find(candidate => candidate.name === port.name);
      if (!replacement || port.required !== replacement.required || port.multiple !== replacement.multiple) throw new TypeError('Public runtime port cardinality changed.');
      checkSchema(port.schemaRevisionRef, replacement.schemaRevisionRef, direction === 'outputPorts');
    }
  }
  const requirements = (entry: typeof oldRegistration) => entry.ontologyRequirements.map(requirement => {
    const { revision: _revision, contentHash: _hash, ...schema } = requirement.renderModelSchemaRevisionRef;
    return { ...requirement, renderModelSchemaRevisionRef: schema };
  });
  if (canonicalContentHash(requirements(oldRegistration)) !== canonicalContentHash(requirements(newRegistration))) {
    throw new TypeError('Runtime Ontology access requirements changed.');
  }
  const existingOutputs = new Set(oldRegistration.outputPorts.map(port => port.name));
  const existingActions = newRegistration.actionRequirements.filter(requirement => existingOutputs.has(requirement.outputPort));
  if (canonicalContentHash(oldRegistration.actionRequirements) !== canonicalContentHash(existingActions)) {
    throw new TypeError('Published output action and permission requirements changed.');
  }
  for (const key of ['allowedSideEffects', 'supportedSurfaces', 'allowedParentCapabilityRefs', 'allowedChildCapabilityRefs'] as const) {
    if (canonicalContentHash(oldRegistration[key]) !== canonicalContentHash(newRegistration[key])) throw new TypeError(`Runtime contract ${key} changed.`);
  }
};

/** Enrich a rebuildable runtime projection using governed historical catalog entries.
 * Page definitions, release snapshots and dependency hashes remain immutable.
 */
type RuntimeContractProjection = { contentHash: string } & ({
  contract: 'PageRuntimeBundle';
  capabilityInstances: (DeclarativeCapabilityContractRequest & { nodeId: string })[];
  renderTree: { nodes: Pick<RenderNode, 'nodeId' | 'providerRef' | 'capabilityRef' | 'runtimeContractVersion'>[] };
} | {
  contract: 'WorkbenchRuntimeBundle';
  appInstances: { targetRevisionRef: RevisionRef; providerRevisionRef: RevisionRef; inputSchemaRevisionRef: RevisionRef; runtimeContractVersion?: string }[];
  layout: { hostCapabilityRevisionRef: RevisionRef; hostProviderRevisionRef: RevisionRef; runtimeContractVersion?: string };
});
export const projectRuntimeContracts = <T extends RuntimeContractProjection>(
  bundle: T,
  entries: readonly DesignCapabilityCatalogEntry[],
): T => {
  const resolve = (request: DeclarativeCapabilityContractRequest): string | undefined => {
    if (request.runtimeContractVersion) return request.runtimeContractVersion;
    const candidates = entries.filter(entry =>
      sameStableRef(entry.declarativeRegistration.capabilityRevisionRef, request.capabilityRevisionRef) &&
      sameStableRef(entry.declarativeRegistration.providerRevisionRef, request.providerRevisionRef));
    const current = [...candidates].sort((a, b) =>
      b.declarativeRegistration.capabilityRevisionRef.revision - a.declarativeRegistration.capabilityRevisionRef.revision ||
      b.declarativeRegistration.registrationRevisionRef.revision - a.declarativeRegistration.registrationRevisionRef.revision ||
      Number(Boolean(b.provider.runtimeContractVersion)) - Number(Boolean(a.provider.runtimeContractVersion)))[0];
    if (!current?.provider.runtimeContractVersion) return undefined;
    try {
      assertDeclarativeCapabilityContract(current, request);
      return current.provider.runtimeContractVersion;
    } catch {
      const historical = candidates.find(entry =>
        sameRevisionRef(entry.declarativeRegistration.capabilityRevisionRef, request.capabilityRevisionRef) &&
        sameRevisionRef(entry.declarativeRegistration.providerRevisionRef, request.providerRevisionRef));
      if (!historical) return undefined;
      try {
        assertDeclarativeCapabilityContract(historical, request);
        assertCompatibleCapabilityUpgrade(historical, current);
        return current.provider.runtimeContractVersion;
      } catch {
        // An incompatible retained contract must resolve to its own implementation.
        return undefined;
      }
    }
  };
  const projected = structuredClone(bundle);
  if (projected.contract === 'PageRuntimeBundle') {
    for (const instance of projected.capabilityInstances) {
      const contract = resolve(instance);
      if (!contract) continue;
      const node = projected.renderTree.nodes.find(node => node.nodeId === instance.nodeId);
      if (!node || String(node.providerRef?.version) !== String(instance.providerRevisionRef.revision) ||
          String(node.capabilityRef.version) !== String(instance.capabilityRevisionRef.revision) ||
          node.providerRef?.id !== instance.providerRevisionRef.id || node.capabilityRef.id !== instance.capabilityRevisionRef.id) continue;
      instance.runtimeContractVersion = contract;
      node.runtimeContractVersion = contract;
    }
  } else {
    for (const instance of projected.appInstances) {
      const contract = resolve({ capabilityRevisionRef: instance.targetRevisionRef, providerRevisionRef: instance.providerRevisionRef, inputSchemaRevisionRef: instance.inputSchemaRevisionRef, runtimeContractVersion: instance.runtimeContractVersion });
      if (contract) instance.runtimeContractVersion = contract;
    }
    const contract = resolve({ capabilityRevisionRef: projected.layout.hostCapabilityRevisionRef, providerRevisionRef: projected.layout.hostProviderRevisionRef, runtimeContractVersion: projected.layout.runtimeContractVersion });
    if (contract) projected.layout.runtimeContractVersion = contract;
  }
  const { contentHash: _hash, ...unsigned } = projected;
  projected.contentHash = canonicalContentHash(unsigned);
  return projected;
};
