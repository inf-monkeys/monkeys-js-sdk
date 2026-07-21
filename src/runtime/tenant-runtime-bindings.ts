import type {
  TenantAuthBinding,
  TenantDataBinding,
  TenantRuntimeConfig,
} from '../contracts/tenant';

export interface TenantRuntimeBindingPolicy {
  authProviderIds: readonly string[];
  dataProviderIds: readonly string[];
  projectionRefs?: readonly string[];
  requiredAuthBindings?: readonly string[];
  requiredDataBindings?: readonly string[];
}

export interface CompiledTenantRuntimeBindings {
  readonly auth: Readonly<Record<string, TenantAuthBinding>>;
  readonly data: Readonly<Record<string, TenantDataBinding>>;
  requireAuth(bindingId?: string): TenantAuthBinding;
  requireData(bindingId?: string): TenantDataBinding;
}

const requireBinding = <T>(
  kind: 'auth' | 'data',
  bindings: Readonly<Record<string, T>>,
  bindingId: string,
): T => {
  const binding = bindings[bindingId];
  if (!binding) {
    throw new TypeError(`Tenant runtime is missing required ${kind} binding "${bindingId}".`);
  }
  return binding;
};

/**
 * Compiles tenant provider references against the providers actually shipped by
 * a product. This is the browser-side fail-closed boundary: a typo or an
 * uninstalled provider cannot silently fall back to a legacy endpoint.
 */
export const compileTenantRuntimeBindings = (
  config: Pick<TenantRuntimeConfig, 'authBinding' | 'dataBinding'>,
  policy: TenantRuntimeBindingPolicy,
): CompiledTenantRuntimeBindings => {
  const authProviderIds = new Set(policy.authProviderIds);
  const dataProviderIds = new Set(policy.dataProviderIds);
  const projectionRefs = new Set(policy.projectionRefs ?? []);

  const auth = Object.freeze({ ...config.authBinding });
  const data = Object.freeze({ ...config.dataBinding });

  for (const [bindingId, binding] of Object.entries(auth)) {
    if (!authProviderIds.has(binding.providerId)) {
      throw new TypeError(
        `Tenant auth binding "${bindingId}" references unavailable provider "${binding.providerId}".`,
      );
    }
  }
  for (const [bindingId, binding] of Object.entries(data)) {
    const supported =
      binding.kind === 'data-provider'
        ? dataProviderIds.has(binding.providerId)
        : projectionRefs.has(binding.projectionRef);
    if (!supported) {
      const target = binding.kind === 'data-provider' ? binding.providerId : binding.projectionRef;
      throw new TypeError(`Tenant data binding "${bindingId}" references unavailable provider or projection "${target}".`);
    }
  }

  for (const bindingId of policy.requiredAuthBindings ?? []) {
    requireBinding('auth', auth, bindingId);
  }
  for (const bindingId of policy.requiredDataBindings ?? []) {
    requireBinding('data', data, bindingId);
  }

  return Object.freeze({
    auth,
    data,
    requireAuth: (bindingId = 'primary') => requireBinding('auth', auth, bindingId),
    requireData: (bindingId = 'primary') => requireBinding('data', data, bindingId),
  });
};
