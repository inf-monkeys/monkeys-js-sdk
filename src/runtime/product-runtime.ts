import type { CapabilityManifest } from '../contracts/capability';
import { CapabilityManifestSchema } from '../contracts/capability';
import type { PageDefinition } from '../contracts/page';
import { PageDefinitionSchema } from '../contracts/page';
import type {
  ApplicationHandoff,
  ProductContext,
  ViewProviderDescriptor,
} from '../contracts/render';
import {
  ApplicationHandoffSchema,
  ViewProviderDescriptorSchema,
} from '../contracts/render';

export const APPLICATION_HANDOFF_QUERY_PARAMETER = 'monkeys-handoff';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compileRoutePattern = (routePath: string): RegExp => {
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const segments = normalized.split('/').filter(Boolean);
  const pattern = segments
    .map((segment, index) => {
      if (segment === '*') return index === segments.length - 1 ? '(?:/.*)?' : '/.*';
      if (segment.startsWith(':') || segment.startsWith('$')) return '[^/]+';
      if (segment.endsWith('*')) return `${escapeRegExp(segment.slice(0, -1))}.*`;
      return escapeRegExp(segment);
    })
    .reduce((result, segment) => `${result}${segment.startsWith('(?:/') || segment.startsWith('/.*') ? segment : `/${segment}`}`, '');
  return new RegExp(`^${pattern || '/'}/?$`);
};

export interface ProductRuntimeCatalogInput {
  product: ProductContext;
  pages: readonly PageDefinition[];
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
}

export interface ProductRuntimeCatalog {
  product: ProductContext;
  pages: readonly PageDefinition[];
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
  pagesById: ReadonlyMap<string, PageDefinition>;
  pagesByRouteId: ReadonlyMap<string, PageDefinition>;
  capabilitiesById: ReadonlyMap<string, CapabilityManifest>;
  providersById: ReadonlyMap<string, ViewProviderDescriptor>;
  navigation: readonly PageDefinition[];
  matchPage(pathname: string): PageDefinition | undefined;
}

const indexUnique = <T>(values: readonly T[], key: (value: T) => string, label: string): ReadonlyMap<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
    result.set(id, value);
  }
  return result;
};

export const compileProductRuntimeCatalog = (input: ProductRuntimeCatalogInput): ProductRuntimeCatalog => {
  const pages = input.pages.map((page) => PageDefinitionSchema.parse(page));
  const capabilities = input.capabilities.map((capability) => CapabilityManifestSchema.parse(capability));
  const providers = input.providers.map((provider) => ViewProviderDescriptorSchema.parse(provider));
  const pagesById = indexUnique(pages, (page) => page.pageId, 'pageId');
  const pagesByRouteId = indexUnique(pages, (page) => page.routeId, 'routeId');
  const capabilitiesById = indexUnique(capabilities, (capability) => capability.id, 'capability id');
  const providersById = indexUnique(providers, (provider) => provider.providerId, 'provider id');

  for (const page of pages) {
    if (!page.visibility.productContexts.includes(input.product)) {
      throw new Error(`Page ${page.pageId} is not visible in ${input.product}.`);
    }
    for (const reference of [page.capabilityRef, ...page.capabilityRefs].filter(Boolean)) {
      if (!capabilitiesById.has(reference!.id)) {
        throw new Error(`Page ${page.pageId} references unknown capability ${reference!.id}.`);
      }
    }
  }

  for (const provider of providers) {
    if (!capabilitiesById.has(provider.capabilityRef.id)) {
      throw new Error(`Provider ${provider.providerId} references unknown capability ${provider.capabilityRef.id}.`);
    }
  }

  const routeMatchers = pages.map((page) => ({ page, pattern: compileRoutePattern(page.routePath) }));
  const navigation = pages
    .filter((page) => !page.navigation.hidden)
    .sort((left, right) => (left.navigation.order ?? Number.MAX_SAFE_INTEGER) - (right.navigation.order ?? Number.MAX_SAFE_INTEGER));

  return Object.freeze({
    product: input.product,
    pages: Object.freeze(pages),
    capabilities: Object.freeze(capabilities),
    providers: Object.freeze(providers),
    pagesById,
    pagesByRouteId,
    capabilitiesById,
    providersById,
    navigation: Object.freeze(navigation),
    matchPage(pathname: string) {
      const normalized = pathname.split('?')[0]?.split('#')[0] || '/';
      return routeMatchers.find(({ pattern }) => pattern.test(normalized))?.page;
    },
  });
};

export const serializeApplicationHandoff = (handoff: ApplicationHandoff): string =>
  JSON.stringify(ApplicationHandoffSchema.parse(handoff));

export const parseApplicationHandoff = (value: string | null | undefined): ApplicationHandoff | undefined => {
  if (!value) return undefined;
  try {
    return ApplicationHandoffSchema.parse(JSON.parse(value));
  } catch {
    return undefined;
  }
};

export const readApplicationHandoffFromUrl = (input: string | URL): ApplicationHandoff | undefined => {
  const url = typeof input === 'string' ? new URL(input, 'https://monkeys.local') : input;
  return parseApplicationHandoff(url.searchParams.get(APPLICATION_HANDOFF_QUERY_PARAMETER));
};

export const buildApplicationHandoffUrl = (targetPath: string, handoff: ApplicationHandoff): string => {
  const parsed = ApplicationHandoffSchema.parse(handoff);
  const isRelative = targetPath.startsWith('/') && !targetPath.startsWith('//');
  const url = new URL(targetPath, 'https://monkeys.local');
  url.searchParams.set(APPLICATION_HANDOFF_QUERY_PARAMETER, serializeApplicationHandoff(parsed));
  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
};
