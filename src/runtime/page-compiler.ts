import type { CapabilityManifest } from '../contracts/capability';
import type {
  PageDefinition,
  PageGuardProjection,
  PageNavigationProjection,
  PageRendererProjection,
  PageRouteProjection,
  PageRuntimeProjection,
} from '../contracts/page';
import {
  PageDefinitionSchema,
  PageRuntimeProjectionSchema,
} from '../contracts/page';
import type { ProductContext, ViewProviderDescriptor } from '../contracts/render';
import { compileViewProviderRegistry } from './view-provider-registry';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const routePattern = (path: string): RegExp => {
  const parts = path.split('/').filter(Boolean);
  const expression = parts.map((part, index) => {
    if (part === '*') return index === parts.length - 1 ? '(?:/.*)?' : '/.*';
    if (part.startsWith(':') || part.startsWith('$')) return '/[^/]+';
    if (part.endsWith('*')) return `/${escapeRegExp(part.slice(0, -1))}.*`;
    return `/${escapeRegExp(part)}`;
  }).join('');
  return new RegExp(`^${expression || '/'}\/?$`);
};

const routeSignature = (path: string): string => path
  .split('/')
  .map((part) => {
    if (part === '*' || part.endsWith('*')) return '*';
    if (part.startsWith(':') || part.startsWith('$')) return ':';
    return part;
  })
  .join('/');

const routeSpecificity = (path: string): number => path.split('/').filter(Boolean).reduce((score, part) => {
  if (part === '*' || part.endsWith('*')) return score;
  if (part.startsWith(':') || part.startsWith('$')) return score + 1;
  return score + 10;
}, 0);

const unique = <T>(values: readonly T[], key: (value: T) => string, label: string): Map<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
    result.set(id, value);
  }
  return result;
};

const referenceVersion = (version: string | number | undefined): string | undefined =>
  version === undefined ? undefined : String(version);

const assertCapabilityReference = (
  owner: string,
  reference: PageDefinition['capabilityRef'],
  capability: CapabilityManifest | undefined,
) => {
  if (!capability) throw new Error(`${owner} references unknown capability ${reference.id}.`);
  if (referenceVersion(reference.version) !== capability.capabilityVersion) {
    throw new Error(`${owner} references inactive capability version ${String(reference.version)} for ${reference.id}.`);
  }
  if (reference.ownerRepo !== capability.ownerRepo) {
    throw new Error(`${owner} capability ${reference.id} owner must be ${capability.ownerRepo}.`);
  }
};

export interface PageAccessContext {
  authenticated: boolean;
  permissionCodes: readonly string[];
  featureFlags: Readonly<Record<string, boolean>>;
}

export interface PageAccessDecision {
  allowed: boolean;
  reasons: readonly (
    | 'authentication'
    | 'permission-all'
    | 'permission-any'
    | 'feature-flag'
  )[];
}

export interface CompilePageRuntimeProjectionInput {
  product: ProductContext;
  pages: readonly PageDefinition[];
  capabilities: readonly CapabilityManifest[];
  providers: readonly ViewProviderDescriptor[];
}

export interface CompiledPageRuntimeProjection {
  document: PageRuntimeProjection;
  pagesById: ReadonlyMap<string, PageDefinition>;
  providersById: ReadonlyMap<string, ViewProviderDescriptor>;
  routesById: ReadonlyMap<string, PageRouteProjection>;
  navigationByPageId: ReadonlyMap<string, PageNavigationProjection>;
  guardsByPageId: ReadonlyMap<string, PageGuardProjection>;
  renderersByPageId: ReadonlyMap<string, PageRendererProjection>;
  evaluateAccess(pageId: string, context: PageAccessContext): PageAccessDecision;
  visibleNavigation(context: PageAccessContext): readonly PageNavigationProjection[];
  matchRoute(pathname: string): PageDefinition | undefined;
  requireRoute(routeId: string): PageRouteProjection;
  requireGuard(pageId: string): PageGuardProjection;
  requireRenderer(pageId: string): PageRendererProjection;
}

/** Compiles route, navigation, guard and renderer tables from one canonical PageDefinition set. */
export const compilePageRuntimeProjection = (
  input: CompilePageRuntimeProjectionInput,
): CompiledPageRuntimeProjection => {
  const pages = input.pages.map((page) => PageDefinitionSchema.parse(page));
  const providerRegistry = compileViewProviderRegistry(input);
  const capabilities = providerRegistry.capabilities;
  const providers = providerRegistry.providers;
  const pagesById = unique(pages, (page) => page.pageId, 'pageId');
  unique(pages, (page) => page.routeId, 'routeId');
  unique(pages, (page) => page.routePath, 'route path');
  unique(pages, (page) => routeSignature(page.routePath), 'route pattern');
  const capabilitiesById = providerRegistry.capabilitiesById;
  const providersById = providerRegistry.providersById;

  for (const page of pages) {
    if (page.record.deleted) {
      throw new Error(`Deleted page ${page.pageId} cannot be compiled into a runtime projection.`);
    }
    if (!page.visibility.productContexts.includes(input.product)) {
      throw new Error(`Page ${page.pageId} is not visible in ${input.product}.`);
    }
    if (page.navigation.parentPageId && !pagesById.has(page.navigation.parentPageId)) {
      throw new Error(`Page ${page.pageId} references unknown parent ${page.navigation.parentPageId}.`);
    }
    for (const reference of [page.capabilityRef, ...page.capabilityRefs]) {
      assertCapabilityReference(`Page ${page.pageId}`, reference, capabilitiesById.get(reference.id));
    }

    const provider = providerRegistry.resolveProvider(page.capabilityRef.id, input.product);
    if (provider.rendererKey !== page.rendererKey || provider.capabilityRef.id !== page.capabilityRef.id) {
      throw new Error(`Page ${page.pageId} renderer ${page.rendererKey} does not match provider ${provider.providerId}.`);
    }
    if (!provider.supportedPageTypes.includes(page.pageType)) {
      throw new Error(`Provider ${provider.providerId} does not support page type ${page.pageType}.`);
    }
    if (!provider.supportedSurfaces.includes(page.surface)) {
      throw new Error(`Provider ${provider.providerId} does not support surface ${page.surface}.`);
    }
  }

  for (const page of pages) {
    const ancestors = new Set([page.pageId]);
    let parent = page.navigation.parentPageId;
    while (parent) {
      if (ancestors.has(parent)) throw new Error(`Navigation cycle contains page ${page.pageId}.`);
      ancestors.add(parent);
      parent = pagesById.get(parent)?.navigation.parentPageId;
    }
  }

  const routes = pages.map((page) => ({
    pageId: page.pageId,
    routeId: page.routeId,
    path: page.routePath,
  }));
  const navigation = pages
    .filter((page) => !page.navigation.hidden)
    .map((page) => ({
      pageId: page.pageId,
      routeId: page.routeId,
      path: page.routePath,
      label: page.navigation.label,
      iconRef: page.navigation.iconRef,
      parentPageId: page.navigation.parentPageId,
      order: page.navigation.order,
      pinned: page.navigation.pinned,
    }))
    .sort((left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER)
      || left.pageId.localeCompare(right.pageId));
  const guards = pages.map((page) => ({
    pageId: page.pageId,
    authenticated: page.visibility.authenticated,
    permissionAllOf: page.visibility.permissionAllOf,
    permissionAnyOf: page.visibility.permissionAnyOf,
    featureFlags: page.visibility.featureFlags,
    actions: page.access.actions,
  }));
  const renderers = pages.map((page) => {
    const provider = providerRegistry.resolveProvider(page.capabilityRef.id, input.product);
    return {
      pageId: page.pageId,
      surface: page.surface,
      rendererKey: page.rendererKey,
      capabilityRef: page.capabilityRef,
      capabilityRefs: page.capabilityRefs,
      providerRef: {
        kind: 'view-provider' as const,
        id: provider.providerId,
        version: provider.providerVersion,
        ownerRepo: provider.ownerRepo,
      },
      binding: page.binding,
      rendererConfig: page.rendererConfig,
      workflowRef: page.workflowRef,
    };
  });
  const document = PageRuntimeProjectionSchema.parse({
    contract: 'PageRuntimeProjection',
    product: input.product,
    routes,
    navigation,
    guards,
    renderers,
  });
  const routesById = unique(document.routes, (route) => route.routeId, 'projected routeId');
  const navigationByPageId = unique(document.navigation, (item) => item.pageId, 'navigation pageId');
  const guardsByPageId = unique(document.guards, (guard) => guard.pageId, 'guard pageId');
  const renderersByPageId = unique(document.renderers, (renderer) => renderer.pageId, 'renderer pageId');
  const matchers = pages
    .map((page) => ({ page, pattern: routePattern(page.routePath), specificity: routeSpecificity(page.routePath) }))
    .sort((left, right) => right.specificity - left.specificity || left.page.pageId.localeCompare(right.page.pageId));

  const evaluateAccess = (pageId: string, context: PageAccessContext): PageAccessDecision => {
    const guard = guardsByPageId.get(pageId);
    if (!guard) throw new Error(`Unknown page guard: ${pageId}`);
    const reasons: PageAccessDecision['reasons'][number][] = [];
    if (guard.authenticated && !context.authenticated) reasons.push('authentication');
    const permissions = new Set(context.permissionCodes);
    if (guard.permissionAllOf.some((permission) => !permissions.has(permission))) {
      reasons.push('permission-all');
    }
    if (guard.permissionAnyOf.length > 0 && !guard.permissionAnyOf.some((permission) => permissions.has(permission))) {
      reasons.push('permission-any');
    }
    if (guard.featureFlags.some((flag) => context.featureFlags[flag] !== true)) reasons.push('feature-flag');
    return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
  };

  return Object.freeze({
    document: Object.freeze(document),
    pagesById,
    providersById,
    routesById,
    navigationByPageId,
    guardsByPageId,
    renderersByPageId,
    evaluateAccess,
    visibleNavigation(context: PageAccessContext) {
      return Object.freeze(document.navigation.filter((item) => evaluateAccess(item.pageId, context).allowed));
    },
    matchRoute(pathname: string) {
      const path = pathname.split('?')[0]?.split('#')[0] || '/';
      return matchers.find((matcher) => matcher.pattern.test(path))?.page;
    },
    requireRoute(routeId: string) {
      const route = routesById.get(routeId);
      if (!route) throw new Error(`Unknown route: ${routeId}`);
      return route;
    },
    requireGuard(pageId: string) {
      const guard = guardsByPageId.get(pageId);
      if (!guard) throw new Error(`Unknown page guard: ${pageId}`);
      return guard;
    },
    requireRenderer(pageId: string) {
      const renderer = renderersByPageId.get(pageId);
      if (!renderer) throw new Error(`Unknown page renderer: ${pageId}`);
      return renderer;
    },
  });
};
