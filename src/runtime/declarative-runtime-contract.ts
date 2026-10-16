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

/** Conservative schema inclusion for compatible inputs; unknown changes fail closed. */
export const acceptsPreviousSchema = (previous: unknown, next: unknown): boolean => {
  if (canonicalContentHash(previous) === canonicalContentHash(next) || next === true) return true;
  if (previous === false) return true;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' ||
      Array.isArray(previous) || Array.isArray(next)) return false;
  const withoutAnnotations = (schema: object) => Object.fromEntries(Object.entries(schema).filter(([key]) => !['title', 'description', 'examples', '$comment'].includes(key)));
  const before = withoutAnnotations(previous) as Record<string, any>;
  const after = withoutAnnotations(next) as Record<string, any>;
  const { properties: oldProperties, required: oldRequired, additionalProperties: oldAdditional,
    enum: oldEnum, ...oldFixed } = before;
  const { properties: newProperties, required: newRequired, additionalProperties: newAdditional,
    enum: newEnum, ...newFixed } = after;
  if (canonicalContentHash(oldFixed) !== canonicalContentHash(newFixed)) return false;
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
    ports: entry.manifest.ports,
    runtime: { ...entry.manifest.runtime, providerBindings: entry.manifest.runtime.providerBindings.map(binding => ({ ...binding, providerRef: { ...binding.providerRef, version: undefined } })) },
    placement: entry.manifest.placement,
    accessibility: entry.manifest.accessibility,
  });
  if (canonicalContentHash(manifestContract(previous)) !== canonicalContentHash(manifestContract(next))) {
    throw new TypeError('Capability behavior, placement and access semantics must preserve the published runtime contract.');
  }
  const oldRegistration = previous.declarativeRegistration;
  const newRegistration = next.declarativeRegistration;
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
    if (oldPorts.length !== newPorts.length) throw new TypeError('Public runtime ports cannot be removed or replaced.');
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
  for (const key of ['allowedSideEffects', 'actionRequirements', 'allowedSlots', 'supportedSurfaces', 'allowedParentCapabilityRefs', 'allowedChildCapabilityRefs'] as const) {
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
