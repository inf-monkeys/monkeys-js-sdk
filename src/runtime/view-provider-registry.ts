import type { CapabilityManifest } from '../contracts/capability';
import { CapabilityManifestSchema } from '../contracts/capability';
import { PageTypeSchema } from '../contracts/page';
import type { ProductContext, ViewProviderDescriptor } from '../contracts/render';
import { ViewProviderDescriptorSchema } from '../contracts/render';

const referenceVersion = (version: string | number | undefined): string | undefined =>
  version === undefined ? undefined : String(version);

const sameStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const expected = new Set(left);
  return right.every((value) => expected.has(value));
};

const unique = <T>(values: readonly T[], key: (value: T) => string, label: string): ReadonlyMap<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
    result.set(id, value);
  }
  return result;
};

export interface CompileViewProviderRegistryInput {
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
}

export interface CompiledViewProviderRegistry {
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
  capabilitiesById: ReadonlyMap<string, CapabilityManifest>;
  providersById: ReadonlyMap<string, ViewProviderDescriptor>;
  providersByRendererKey: ReadonlyMap<string, readonly ViewProviderDescriptor[]>;
  requireCapability(capabilityId: string): CapabilityManifest;
  requireProvider(providerId: string): ViewProviderDescriptor;
  resolveProvider(capabilityId: string, product: ProductContext, preferredProviderId?: string): ViewProviderDescriptor;
}

/**
 * Compiles the canonical capability-to-provider graph independently of pages.
 * Nested views and component catalogs use this boundary so descriptor metadata
 * cannot drift away from the implementation registry that renders it.
 */
export const compileViewProviderRegistry = (
  input: CompileViewProviderRegistryInput,
): CompiledViewProviderRegistry => {
  const capabilities = input.capabilities.map((capability) => CapabilityManifestSchema.parse(capability));
  const providers = input.providers.map((provider) => ViewProviderDescriptorSchema.parse(provider));
  const capabilitiesById = unique(capabilities, (capability) => capability.id, 'capability id');
  const providersById = unique(providers, (provider) => provider.providerId, 'provider id');
  const providersByRendererKeyMutable = new Map<string, ViewProviderDescriptor[]>();
  for (const provider of providers) {
    const values = providersByRendererKeyMutable.get(provider.rendererKey) ?? [];
    values.push(provider);
    providersByRendererKeyMutable.set(provider.rendererKey, values);
  }
  const providersByRendererKey = new Map(
    Array.from(providersByRendererKeyMutable.entries()).map(([key, values]) => [key, Object.freeze(values)] as const),
  );

  unique(
    providers,
    (provider) => `${provider.rendererKey}:${provider.capabilityRef.id}`,
    'renderer/capability provider binding',
  );

  for (const provider of providers) {
    const capability = capabilitiesById.get(provider.capabilityRef.id);
    if (!capability) {
      throw new Error(`Provider ${provider.providerId} references unknown capability ${provider.capabilityRef.id}.`);
    }
    if (!['view', 'professional-provider'].includes(capability.kind)) {
      throw new Error(`Provider ${provider.providerId} capability must be a view or professional-provider.`);
    }
    if (referenceVersion(provider.capabilityRef.version) !== capability.capabilityVersion) {
      throw new Error(`Provider ${provider.providerId} references inactive capability version ${String(provider.capabilityRef.version)}.`);
    }
    if (provider.capabilityRef.ownerRepo !== capability.ownerRepo) {
      throw new Error(`Provider ${provider.providerId} must reference capability owner ${capability.ownerRepo}.`);
    }
    const providerBindings = capability.runtime.providerBindings.filter((binding) => binding.providerRef.id === provider.providerId);
    if (providerBindings.length !== 1) {
      throw new Error(`Capability ${capability.id} must declare exactly one binding for provider ${provider.providerId}.`);
    }
    const providerRef = providerBindings[0].providerRef;
    if (providerRef.kind !== 'view-provider' || providerRef.ownerRepo !== provider.ownerRepo || referenceVersion(providerRef.version) !== provider.providerVersion) {
      throw new Error(`Capability ${capability.id} provider binding does not match ${provider.providerId}@${provider.providerVersion}.`);
    }
    if (provider.loading !== capability.runtime.loading || provider.stateOwner !== capability.runtime.stateOwner) {
      throw new Error(`Provider ${provider.providerId} loading and state ownership must match capability ${capability.id}.`);
    }
    if (!sameStringSet(provider.sideEffects, capability.runtime.sideEffects)) {
      throw new Error(`Provider ${provider.providerId} side effects must match capability ${capability.id}.`);
    }
    const renderModelPort = capability.ports.inputs.find((port) => port.schemaRef === provider.renderModelSchemaRef);
    if (!renderModelPort?.required) {
      throw new Error(`Provider ${provider.providerId} render model schema is not a required capability input.`);
    }
    if (provider.intentSchemaRef && !capability.ports.outputs.some((port) => port.schemaRef === provider.intentSchemaRef)) {
      throw new Error(`Provider ${provider.providerId} intent schema is not declared by capability ${capability.id}.`);
    }
    if (provider.lifecycle.focusModel !== capability.accessibility.focusModel) {
      throw new Error(`Provider ${provider.providerId} focus model must match capability ${capability.id}.`);
    }
    if (provider.supportedSurfaces.some((surface) => !capability.placement.surfaces.includes(surface))) {
      throw new Error(`Provider ${provider.providerId} surfaces must be declared by capability ${capability.id}.`);
    }
    for (const pageType of provider.supportedPageTypes) {
      if (!PageTypeSchema.safeParse(pageType).success) {
        throw new Error(`Provider ${provider.providerId} declares unsupported page type ${pageType}.`);
      }
    }
  }

  for (const capability of capabilities) {
    if (!['view', 'professional-provider'].includes(capability.kind)) continue;
    for (const binding of capability.runtime.providerBindings) {
      const providerRef = binding.providerRef;
      if (providerRef.kind !== 'view-provider') throw new Error(`View capability ${capability.id} must resolve to view providers.`);
      const provider = providersById.get(providerRef.id);
      if (!provider || provider.capabilityRef.id !== capability.id) {
        throw new Error(`View capability ${capability.id} references missing provider ${providerRef.id}.`);
      }
    }
    for (const product of ['studio', 'kernel'] as const) {
      const candidates = capability.runtime.providerBindings.filter((binding) => binding.productContexts.length === 0 || binding.productContexts.includes(product));
      const priorities = candidates.map((binding) => binding.priority).sort((left, right) => right - left);
      if (priorities.length > 1 && priorities[0] === priorities[1]) {
        throw new Error(`Capability ${capability.id} has ambiguous provider bindings for ${product}.`);
      }
    }
  }

  const requireCapability = (capabilityId: string): CapabilityManifest => {
    const capability = capabilitiesById.get(capabilityId);
    if (!capability) throw new Error(`Unknown capability: ${capabilityId}`);
    return capability;
  };
  const requireProvider = (providerId: string): ViewProviderDescriptor => {
    const provider = providersById.get(providerId);
    if (!provider) throw new Error(`Unknown view provider: ${providerId}`);
    return provider;
  };

  return Object.freeze({
    capabilities: Object.freeze(capabilities),
    providers: Object.freeze(providers),
    capabilitiesById,
    providersById,
    providersByRendererKey,
    requireCapability,
    requireProvider,
    resolveProvider: (capabilityId: string, product: ProductContext, preferredProviderId?: string) => {
      const capability = requireCapability(capabilityId);
      const candidates = capability.runtime.providerBindings
        .filter((binding) => binding.productContexts.length === 0 || binding.productContexts.includes(product))
        .sort((left, right) => right.priority - left.priority || left.providerRef.id.localeCompare(right.providerRef.id));
      if (preferredProviderId) {
        const preferred = candidates.find((binding) => binding.providerRef.id === preferredProviderId);
        if (!preferred) throw new Error(`Provider ${preferredProviderId} is not available for capability ${capabilityId} in ${product}.`);
        return requireProvider(preferred.providerRef.id);
      }
      if (candidates.length === 0) throw new Error(`Capability ${capabilityId} has no provider for ${product}.`);
      if (candidates.length > 1 && candidates[0].priority === candidates[1].priority) {
        throw new Error(`Capability ${capabilityId} has ambiguous providers for ${product}.`);
      }
      return requireProvider(candidates[0].providerRef.id);
    },
  });
};
