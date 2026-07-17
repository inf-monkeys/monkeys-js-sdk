import type { ThemeTokens } from '../contracts/theme';
import type {
  TenantProductConfig,
  TenantRuntimeConfig,
} from '../contracts/tenant';
import {
  TenantProductConfigSchema,
  TenantRuntimeConfigSchema,
} from '../contracts/tenant';
import { resolveThemeTokens } from './theme-tokens';

export interface CompileTenantRuntimeConfigInput {
  productConfig: TenantProductConfig;
  resolvedDesignTokens: ThemeTokens;
}

/**
 * Builds the only browser-facing tenant configuration projection.
 * The source list is deliberately not copied, and resolving again guarantees
 * that aliases cannot escape the server boundary.
 */
export const compileTenantRuntimeConfig = (
  input: CompileTenantRuntimeConfigInput,
): TenantRuntimeConfig => {
  const productConfig = TenantProductConfigSchema.parse(input.productConfig);
  const designTokens = resolveThemeTokens(input.resolvedDesignTokens).resolvedDocument;

  return Object.freeze(TenantRuntimeConfigSchema.parse({
    contract: 'TenantRuntimeConfig',
    tenantId: productConfig.tenantId,
    appId: productConfig.appId,
    environment: productConfig.environment,
    designTokens,
    moduleRefs: productConfig.moduleRefs,
    pageRefs: productConfig.pageRefs,
    featureFlags: productConfig.featureFlags,
    authBinding: productConfig.authBinding,
    dataBinding: productConfig.dataBinding,
    sourceMap: productConfig.sourceMap,
    warnings: productConfig.warnings,
    applicationConfig: productConfig.applicationConfig,
  }));
};
