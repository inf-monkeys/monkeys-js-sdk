import type { CapabilityManifest } from '../contracts/capability';
import { CapabilityManifestSchema } from '../contracts/capability';
import { PageTypeSchema } from '../contracts/page';
import type { ViewProviderDescriptor } from '../contracts/render';
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
  providersByRendererKey: ReadonlyMap<string, ViewProviderDescriptor>;
  requireCapability(capabilityId: string): CapabilityManifest;
  requireProvider(providerId: string): ViewProviderDescriptor;
  resolveProvider(capabilityId: string): ViewProviderDescriptor;
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
  const providersByRendererKey = unique(providers, (provider) => provider.rendererKey, 'provider renderer key');

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
    if (provider.capabilityRef.ownerRepo !== capability.ownerRepo || provider.ownerRepo !== capability.ownerRepo) {
      throw new Error(`Provider ${provider.providerId} owner must match capability ${capability.id}.`);
    }
    const runtimeProviderRef = capability.runtime.providerRef;
    if (
      runtimeProviderRef.kind !== 'view-provider'
      || runtimeProviderRef.id !== provider.providerId
      || runtimeProviderRef.ownerRepo !== provider.ownerRepo
    ) {
      throw new Error(`Capability ${capability.id} runtime provider must reference ${provider.providerId}.`);
    }
    if (provider.loading !== capability.runtime.loading || provider.stateOwner !== capability.runtime.stateOwner) {
      throw new Error(`Provider ${provider.providerId} loading and state ownership must match capability ${capability.id}.`);
    }
    if (!sameStringSet(provider.sideEffects, capability.runtime.sideEffects)) {
      throw new Error(`Provider ${provider.providerId} side effects must match capability ${capability.id}.`);
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
    const providerRef = capability.runtime.providerRef;
    if (providerRef.kind !== 'view-provider') {
      throw new Error(`View capability ${capability.id} must resolve to a view-provider.`);
    }
    const provider = providersById.get(providerRef.id);
    if (!provider || provider.capabilityRef.id !== capability.id) {
      throw new Error(`View capability ${capability.id} references missing provider ${providerRef.id}.`);
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
    resolveProvider: (capabilityId: string) => {
      const capability = requireCapability(capabilityId);
      if (capability.runtime.providerRef.kind !== 'view-provider') {
        throw new Error(`Capability ${capabilityId} does not resolve to a view provider.`);
      }
      return requireProvider(capability.runtime.providerRef.id);
    },
  });
};
