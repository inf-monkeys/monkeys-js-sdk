import type { CapabilityManifest } from '../contracts/capability';
import type { PageRuntimeProjection } from '../contracts/page';
import type { PageDefinition } from '../contracts/page';
import type { ProductDeclaration } from '../contracts/semantic';
import type {
  ApplicationHandoff,
  ProductContext,
  ViewProviderDescriptor,
} from '../contracts/render';
import { ApplicationHandoffSchema } from '../contracts/render';
import type { PageAccessContext, PageAccessDecision } from './page-compiler';
import { compilePageRuntimeProjection } from './page-compiler';
import { compileProductDeclaration, type CompiledProductDeclaration } from './declaration-compiler';

export const APPLICATION_HANDOFF_QUERY_PARAMETER = 'monkeys-handoff';

export interface ProductRuntimeCatalogInput {
  product: ProductContext;
  declaration: ProductDeclaration;
  providers: readonly ViewProviderDescriptor[];
}

export interface ProductRuntimeCatalog {
  product: ProductContext;
  declaration: CompiledProductDeclaration;
  pages: readonly PageDefinition[];
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
  pagesById: ReadonlyMap<string, PageDefinition>;
  pagesByRouteId: ReadonlyMap<string, PageDefinition>;
  capabilitiesById: ReadonlyMap<string, CapabilityManifest>;
  providersById: ReadonlyMap<string, ViewProviderDescriptor>;
  projection: PageRuntimeProjection;
  document: PageRuntimeProjection;
  navigation: readonly PageDefinition[];
  evaluateAccess(pageId: string, context: PageAccessContext): PageAccessDecision;
  matchPage(pathname: string): PageDefinition | undefined;
  matchRoute(pathname: string): PageDefinition | undefined;
  requireRenderer(pageId: string): PageRuntimeProjection['renderers'][number];
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
  const declaration = compileProductDeclaration(input.declaration);
  const compiled = compilePageRuntimeProjection({
    product: input.product,
    pages: declaration.declaration.pages,
    capabilities: declaration.declaration.capabilities,
    providers: input.providers,
  });
  const pages = [...compiled.pagesById.values()];
  const capabilities = [...declaration.declaration.capabilities];
  const providers = [...compiled.providersById.values()];
  const pagesById = compiled.pagesById;
  const pagesByRouteId = indexUnique(pages, (page) => page.routeId, 'routeId');
  const capabilitiesById = indexUnique(capabilities, (capability) => capability.id, 'capability id');
  const providersById = compiled.providersById;
  const navigation = compiled.document.navigation.map((item) => pagesById.get(item.pageId)!);

  return Object.freeze({
    product: input.product,
    declaration,
    pages: Object.freeze(pages),
    capabilities: Object.freeze(capabilities),
    providers: Object.freeze(providers),
    pagesById,
    pagesByRouteId,
    capabilitiesById,
    providersById,
    projection: compiled.document,
    document: compiled.document,
    navigation: Object.freeze(navigation),
    evaluateAccess: compiled.evaluateAccess,
    matchPage: compiled.matchRoute,
    matchRoute: compiled.matchRoute,
    requireRenderer: compiled.requireRenderer,
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
