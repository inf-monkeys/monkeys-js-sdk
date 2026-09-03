import type { RenderTree } from '../contracts/render';
import { JsonObjectSchema } from '../contracts/common';
import type { DeclarativeCreateTemplateRegistration, DeclarativeProductResourceRegistration, DeclarativeRouteSpaceRegistration } from '../contracts/declarative-control-http';
import { compileRenderTree } from './render-tree-compiler';
import {
  AccessPolicySchema,
  CompiledRouteClaimSchema,
  LegacyRouteClaimSchema,
  NavigationReleaseSchema,
  NavigationRuntimeBundleSchema,
  NavigationSchema,
  PageReleaseSchema,
  PageRuntimeBundleSchema,
  PageSchema,
  ProductSurfaceSchema,
  RevisionRefSchema,
  RouteClaimSchema,
  RoutePathTemplateSchema,
  RouteSpaceSchema,
  StableRefSchema,
  TenantScopeSchema,
  WorkbenchReleaseSchema,
  WorkbenchRuntimeBundleSchema,
  WorkbenchSchema,
  type AccessPolicy,
  type CompiledRouteClaim,
  type DeclarativeRouteClaim,
  type Navigation,
  type NavigationRelease,
  type NavigationRuntimeBundle,
  type Page,
  type PageRelease,
  type PageRuntimeBundle,
  type ReleaseDependency,
  type RevisionRef,
  type RouteSpace,
  type StableRef,
  type TenantScope,
  type Workbench,
  type WorkbenchRelease,
  type WorkbenchRuntimeBundle,
} from '../contracts/declarative-control';

export type DeclarativeControlCompilationErrorCode =
  | 'AUDIENCE_WIDER_THAN_TARGET'
  | 'CAPABILITY_BINDING_MISMATCH'
  | 'CAPABILITY_NOT_EDITOR_ELIGIBLE'
  | 'CROSS_TENANT_REFERENCE'
  | 'DEPENDENCY_MISSING'
  | 'HEAD_CONFLICT'
  | 'NAV_DEPTH_EXCEEDED'
  | 'NAV_ACTION_INPUT_INVALID'
  | 'NAV_NODE_LIMIT_EXCEEDED'
  | 'NAV_TARGET_UNRELEASED'
  | 'PORT_TYPE_MISMATCH'
  | 'RENDER_DEPTH_EXCEEDED'
  | 'RENDER_NODE_LIMIT_EXCEEDED'
  | 'RELEASE_VALIDATION_FAILED'
  | 'REGISTRY_CONFLICT'
  | 'REVISION_MISMATCH'
  | 'ROUTE_CONFLICT'
  | 'ROUTE_RESERVED'
  | 'ROUTE_SPACE_MISSING'
  | 'ROUTE_SPACE_MISMATCH'
  | 'WORKBENCH_INSTANCE_LIMIT_EXCEEDED'
  | 'WORKBENCH_RELEASE_SET_INVALID'
  | 'WORKBENCH_TEMPLATE_UNRELEASABLE';

export class DeclarativeControlCompilationError extends Error {
  constructor(
    public readonly code: DeclarativeControlCompilationErrorCode,
    public readonly path: string,
    message: string,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'DeclarativeControlCompilationError';
  }
}

export interface DeclarativeControlCompileLimits {
  maxNavigationNodes: number;
  maxNavigationDepth: number;
  maxRenderNodes: number;
  maxRenderDepth: number;
  maxWorkbenchGroups: number;
  maxWorkbenchInstances: number;
}

export interface RouteSpaceRegistration {
  revisionRef: RevisionRef;
  routeSpace: RouteSpace;
}

export interface CapabilityPortRegistration {
  name: string;
  schemaRevisionRef: RevisionRef;
}

export interface DeclarativeCapabilityRegistration {
  capabilityRevisionRef: RevisionRef;
  providerRevisionRef: RevisionRef;
  editorEligible: boolean;
  inputPorts: readonly CapabilityPortRegistration[];
  outputPorts: readonly CapabilityPortRegistration[];
  allowedSideEffects: readonly ('network' | 'storage' | 'navigation' | 'worker' | 'websocket')[];
}

export interface WorkbenchTargetRegistration {
  stableTargetRef: StableRef;
  targetRevisionRef: RevisionRef;
  accessPolicy: AccessPolicy;
}

export interface NavigationRouteTargetRegistration extends WorkbenchTargetRegistration {
  kind: 'route';
  releaseRevisionRef?: RevisionRef;
  surface: 'studio' | 'kernel';
  routeClaim: CompiledRouteClaim;
}

export interface NavigationRegisteredMenuActionRegistration extends WorkbenchTargetRegistration {
  kind: 'registered-menu-action';
  surface: 'studio' | 'kernel';
  applicationId: string;
  actionRef: string;
  inputSchemaRef?: string;
  validateInput?: (input: Record<string, unknown>) => Record<string, unknown>;
  sourceCatalogRevisionRef: RevisionRef;
}

export interface NavigationDomainCommandRegistration extends WorkbenchTargetRegistration {
  kind: 'governed-domain-command';
  surface: 'studio' | 'kernel';
  inputSchemaRevisionRef: RevisionRef;
  resultSchemaRevisionRef?: RevisionRef;
}

export type NavigationTargetRegistration = NavigationRouteTargetRegistration | NavigationRegisteredMenuActionRegistration | NavigationDomainCommandRegistration;

export interface CompileRouteClaimsInput {
  claims: readonly DeclarativeRouteClaim[];
  routeSpaces: readonly RouteSpaceRegistration[];
  surface: 'studio' | 'kernel';
}

export interface MaterializeRouteSpacePathInput {
  routeSpace: RouteSpace;
  applicationPath: string;
  parameters?: Readonly<Record<string, string | number>>;
}

export interface CompilePageRuntimeBundleInput {
  page: Page;
  pageRevisionRef: RevisionRef;
  release: PageRelease;
  releaseRevisionRef: RevisionRef;
  routeSpaces: readonly RouteSpaceRegistration[];
  compilerRevisionRef: RevisionRef;
  generation: number;
  limits: DeclarativeControlCompileLimits;
  capabilityRegistry: readonly DeclarativeCapabilityRegistration[];
}

export interface CompileWorkbenchRuntimeBundleInput {
  workbench: Workbench;
  workbenchRevisionRef: RevisionRef;
  release: WorkbenchRelease;
  releaseRevisionRef: RevisionRef;
  routeSpaces: readonly RouteSpaceRegistration[];
  targetRegistry: readonly WorkbenchTargetRegistration[];
  compilerRevisionRef: RevisionRef;
  generation: number;
  limits: DeclarativeControlCompileLimits;
}

export interface CompileNavigationRuntimeBundleInput {
  navigation: Navigation;
  navigationRevisionRef: RevisionRef;
  release: NavigationRelease;
  releaseRevisionRef: RevisionRef;
  targetRegistry: readonly NavigationTargetRegistration[];
  compilerRevisionRef: RevisionRef;
  generation: number;
  limits: DeclarativeControlCompileLimits;
}

const scopedIdentityKey = (reference: TenantScope['tenantRef']): string =>
  `${reference.kind}:${reference.id}:${reference.ownerRepo}`;

const scopeKey = (scope: TenantScope): string =>
  `${scopedIdentityKey(scope.tenantRef)}:${scopedIdentityKey(scope.dataSpaceRef)}:${scope.teamRef ? scopedIdentityKey(scope.teamRef) : ''}`;

export const stableRefKey = (reference: StableRef): string =>
  `${reference.visibility}:${reference.tenantScope ? scopeKey(reference.tenantScope) : ''}:${reference.kind}:${reference.id}:${reference.ownerRepo}`;

export const revisionRefKey = (reference: RevisionRef): string =>
  `${stableRefKey(reference)}@${reference.revision}:v${reference.schemaVersion}:${reference.contentHash.toLowerCase()}`;

export const sameStableRef = (left: StableRef, right: StableRef): boolean => stableRefKey(left) === stableRefKey(right);
export const sameRevisionRef = (left: RevisionRef, right: RevisionRef): boolean => revisionRefKey(left) === revisionRefKey(right);

const assertUniqueRegistryKeys = (keys: readonly string[], path: string) => {
  const seen = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) {
      throw new DeclarativeControlCompilationError('REGISTRY_CONFLICT', `${path}[${index}]`, `Duplicate registry identity: ${key}`);
    }
    seen.add(key);
  });
};

const stableSerialize = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
};

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const SHA256_ROUND = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotateRight = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));

const sha256Hex = (value: string): string => {
  const source = [...new TextEncoder().encode(value)];
  const bitLength = source.length * 8;
  source.push(0x80);
  while (source.length % 64 !== 56) source.push(0);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8) source.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) source.push((low >>> shift) & 0xff);
  const hash = [...SHA256_INITIAL];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < source.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] = ((source[start] << 24) | (source[start + 1] << 16) | (source[start + 2] << 8) | source[start + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const previous = words[index - 15];
      const recent = words[index - 2];
      const small0 = rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3);
      const small1 = rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ (recent >>> 10);
      words[index] = (words[index - 16] + small0 + words[index - 7] + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + big1 + choice + SHA256_ROUND[index] + words[index]) >>> 0;
      const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (big0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((part) => part.toString(16).padStart(8, '0')).join('');
};

export const canonicalContentHash = (value: unknown): string => sha256Hex(stableSerialize(value));

export const declarativeCreateTemplateSourceHash = (document: DeclarativeCreateTemplateRegistration['document']): string => canonicalContentHash(document);

export const declarativeCreateTemplateRevisionHash = (registration: DeclarativeCreateTemplateRegistration): string =>
  canonicalContentHash(registration.document);

export const declarativeRouteSpaceSourceHash = (routeSpace: DeclarativeRouteSpaceRegistration['routeSpace']): string => canonicalContentHash(routeSpace);

export const declarativeRouteSpaceRevisionHash = (registration: DeclarativeRouteSpaceRegistration): string =>
  canonicalContentHash(registration.routeSpace);

export const declarativeProductResourceSourceHash = (document: DeclarativeProductResourceRegistration['document']): string => canonicalContentHash(document);

export const declarativeProductResourceRevisionHash = (registration: DeclarativeProductResourceRegistration): string =>
  canonicalContentHash(registration.document);

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
};

const assertTenantCompatible = (reference: StableRef, scope: TenantScope, path: string) => {
  if (reference.visibility === 'tenant' && scopeKey(reference.tenantScope as TenantScope) !== scopeKey(scope)) {
    throw new DeclarativeControlCompilationError('CROSS_TENANT_REFERENCE', path, `Reference ${reference.kind}/${reference.id} belongs to another tenant scope.`);
  }
};

const assertSameTenantScope = (candidate: TenantScope, expected: TenantScope, path: string) => {
  if (scopeKey(candidate) !== scopeKey(expected)) {
    throw new DeclarativeControlCompilationError('CROSS_TENANT_REFERENCE', path, 'Record and release tenant scopes do not match.');
  }
};

const stableFromRevision = (reference: RevisionRef): StableRef => StableRefSchema.parse({
  kind: reference.kind,
  id: reference.id,
  ownerRepo: reference.ownerRepo,
  visibility: reference.visibility,
  ...(reference.tenantScope ? { tenantScope: reference.tenantScope } : {}),
});

const assertRevisionIdentity = (
  reference: RevisionRef,
  expectedKind: string,
  expectedId: string,
  scope: TenantScope,
  path: string,
) => {
  if (reference.kind !== expectedKind || reference.id !== expectedId) {
    throw new DeclarativeControlCompilationError('REVISION_MISMATCH', path, `Expected ${expectedKind}/${expectedId}, received ${reference.kind}/${reference.id}.`);
  }
  assertTenantCompatible(reference, scope, path);
};

const dependencyKey = (role: ReleaseDependency['role'], reference: RevisionRef) => `${role}:${revisionRefKey(reference)}`;

const requireDependencies = (
  snapshot: readonly ReleaseDependency[],
  required: readonly ReleaseDependency[],
) => {
  const available = new Set(snapshot.map((dependency) => dependencyKey(dependency.role, dependency.revisionRef)));
  for (const dependency of required) {
    const key = dependencyKey(dependency.role, dependency.revisionRef);
    if (!available.has(key)) {
      throw new DeclarativeControlCompilationError('DEPENDENCY_MISSING', 'dependencySnapshot', `Missing exact ${dependency.role} dependency ${revisionRefKey(dependency.revisionRef)}.`);
    }
  }
};

const assertDependencyScopes = (
  snapshot: readonly ReleaseDependency[],
  scope: TenantScope,
) => snapshot.forEach((dependency, index) =>
  assertTenantCompatible(dependency.revisionRef, scope, `dependencySnapshot[${index}].revisionRef`));

const requireReleaseReady = (release: PageRelease | WorkbenchRelease | NavigationRelease) => {
  if (release.evidence.validation.result !== 'pass') {
    throw new DeclarativeControlCompilationError('RELEASE_VALIDATION_FAILED', 'evidence.validation.result', 'Runtime bundles require a passing release validation result.');
  }
};

const refSet = (values: readonly StableRef[]) => new Set(values.map(stableRefKey));

const chainRequiresAll = (
  policies: readonly AccessPolicy[],
  field: 'permissionAllOf' | 'groupAllOf' | 'conditionAllOf',
): ReadonlySet<string> => {
  if (field === 'permissionAllOf') return new Set(policies.flatMap((policy) => policy.permissionAllOf));
  if (field === 'groupAllOf') return refSet(policies.flatMap((policy) => policy.groupAllOf));
  return new Set(policies.flatMap((policy) => policy.conditionAllOf.map(revisionRefKey)));
};

const chainImpliesAny = (
  policies: readonly AccessPolicy[],
  targetAny: ReadonlySet<string>,
  allValues: ReadonlySet<string>,
  anyValues: (policy: AccessPolicy) => readonly string[],
): boolean => {
  if (targetAny.size === 0) return true;
  if ([...allValues].some((value) => targetAny.has(value))) return true;
  return policies.some((policy) => {
    const values = anyValues(policy);
    return values.length > 0 && values.every((value) => targetAny.has(value));
  });
};

export const accessPolicyChainImplies = (
  policyInputs: readonly AccessPolicy[],
  targetInput: AccessPolicy,
): boolean => {
  const policies = policyInputs.map((policy) => AccessPolicySchema.parse(policy));
  const target = AccessPolicySchema.parse(targetInput);
  if (target.authenticated && !policies.some((policy) => policy.authenticated)) return false;

  const permissionAll = chainRequiresAll(policies, 'permissionAllOf');
  if (target.permissionAllOf.some((permission) => !permissionAll.has(permission))) return false;
  if (!chainImpliesAny(policies, new Set(target.permissionAnyOf), permissionAll, (policy) => policy.permissionAnyOf)) return false;

  const groupAll = chainRequiresAll(policies, 'groupAllOf');
  if (target.groupAllOf.some((group) => !groupAll.has(stableRefKey(group)))) return false;
  if (!chainImpliesAny(
    policies,
    refSet(target.groupAnyOf),
    groupAll,
    (policy) => policy.groupAnyOf.map(stableRefKey),
  )) return false;

  const conditionAll = chainRequiresAll(policies, 'conditionAllOf');
  if (target.conditionAllOf.some((condition) => !conditionAll.has(revisionRefKey(condition)))) return false;
  return true;
};

const normalizePath = (path: string, routeSpace: RouteSpace): string => {
  let normalized = path;
  if (!routeSpace.caseSensitive) {
    normalized = normalized
      .split('/')
      .map((segment) => segment.startsWith(':') ? segment : segment.toLowerCase())
      .join('/');
  }
  if (routeSpace.trailingSlash === 'remove' && normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
  if (routeSpace.trailingSlash === 'require' && normalized.length > 1 && !normalized.endsWith('/')) normalized += '/';
  return normalized;
};

export const compileRouteClaims = (input: CompileRouteClaimsInput): readonly CompiledRouteClaim[] => {
  const registrations = input.routeSpaces.map((entry, index) => {
    const revisionRef = RevisionRefSchema.parse(entry.revisionRef);
    const routeSpace = RouteSpaceSchema.parse(entry.routeSpace);
    if (revisionRef.kind !== 'route-space' || revisionRef.id !== routeSpace.routeSpaceId) {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `routeSpaces[${index}]`, 'RouteSpace registration identity does not match its pinned revision.');
    }
    return { revisionRef, routeSpace };
  });
  assertUniqueRegistryKeys(registrations.map((entry) => revisionRefKey(entry.revisionRef)), 'routeSpaces');
  const routeSpacesByRevision = new Map(registrations.map((entry) => [revisionRefKey(entry.revisionRef), entry.routeSpace]));
  const normalizedPaths = new Set<string>();
  const compiled: CompiledRouteClaim[] = [];
  input.claims.forEach((inputClaim, index) => {
    const parsedClaim = 'surface' in inputClaim
      ? RouteClaimSchema.parse(inputClaim)
      : LegacyRouteClaimSchema.parse(inputClaim);
    const routeSpace = routeSpacesByRevision.get(revisionRefKey(parsedClaim.routeSpaceRevisionRef));
    if (!routeSpace) throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISSING', `routeClaims[${index}].routeSpaceRevisionRef`, 'No exact RouteSpace registration exists.');
    const claim = RouteClaimSchema.parse({
      ...parsedClaim,
      surface: 'surface' in parsedClaim ? parsedClaim.surface : routeSpace.supportedSurface,
    });
    if (routeSpace.supportedSurface !== claim.surface) {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `routeClaims[${index}].surface`, `Route claim surface ${claim.surface} does not match RouteSpace ${routeSpace.routeSpaceId}.`);
    }
    if (claim.surface !== input.surface) return;
    const normalizedPath = normalizePath(claim.pathTemplate, routeSpace);
    const knownParameters = new Set(routeSpace.parameters.map((parameter) => parameter.name));
    const pathParameters = [...normalizedPath.matchAll(/:([A-Za-z][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
    if (new Set(pathParameters).size !== pathParameters.length) {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `routeClaims[${index}].pathTemplate`, 'Route parameters must be unique within a path.');
    }
    const unknownParameter = pathParameters.find((parameter) => !knownParameters.has(parameter));
    if (unknownParameter) {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `routeClaims[${index}].pathTemplate`, `Route parameter ${unknownParameter} is not declared by ${routeSpace.routeSpaceId}.`);
    }
    const reserved = routeSpace.reservedPaths.some((candidate) => {
      const normalizedReserved = normalizePath(candidate, routeSpace);
      return normalizedPath === normalizedReserved || normalizedPath.startsWith(`${normalizedReserved}/`);
    });
    if (reserved) throw new DeclarativeControlCompilationError('ROUTE_RESERVED', `routeClaims[${index}].pathTemplate`, `Route ${normalizedPath} is reserved by ${routeSpace.routeSpaceId}.`);
    const routeIdentity = `${revisionRefKey(claim.routeSpaceRevisionRef)}:${normalizedPath}`;
    if (normalizedPaths.has(routeIdentity)) throw new DeclarativeControlCompilationError('ROUTE_CONFLICT', `routeClaims[${index}].pathTemplate`, `Duplicate normalized route ${normalizedPath}.`);
    normalizedPaths.add(routeIdentity);
    compiled.push(CompiledRouteClaimSchema.parse({
      ...claim,
      normalizedPath,
      matcher: {
        caseSensitive: routeSpace.caseSensitive,
        trailingSlash: routeSpace.trailingSlash,
        parameters: routeSpace.parameters,
      },
    }));
  });
  if (!compiled.some((claim) => claim.kind === 'canonical')) {
    throw new DeclarativeControlCompilationError('ROUTE_CONFLICT', 'routeClaims', 'At least one canonical route claim is required.');
  }
  return Object.freeze(compiled);
};

const routeParameterPattern = (type: RouteSpace['parameters'][number]['type']): RegExp => {
  if (type === 'integer') return /^-?\d+$/;
  if (type === 'uuid') return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (type === 'slug') return /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
};

/**
 * Materializes the browser URL owned by a RouteSpace from an application-relative
 * compiled route. Declarations and runtime resolution remain application-relative;
 * only this boundary applies product bases such as /:teamId or /kernel.
 */
export const materializeRouteSpacePath = (input: MaterializeRouteSpacePathInput): string => {
  const routeSpace = RouteSpaceSchema.parse(input.routeSpace);
  const applicationPath = RoutePathTemplateSchema.parse(input.applicationPath);
  const basePath = routeSpace.basePath === '/' ? '' : routeSpace.basePath.replace(/\/+$/, '');
  let browserTemplate = normalizePath(`${basePath}${applicationPath === '/' ? '/' : applicationPath}` || '/', routeSpace);
  const parameters = input.parameters || {};
  const declared = new Map(routeSpace.parameters.map((parameter) => [parameter.name, parameter]));
  const referenced = [...browserTemplate.matchAll(/:([A-Za-z][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
  for (const name of referenced) {
    const definition = declared.get(name);
    const raw = parameters[name];
    if (!definition || raw === undefined || raw === null || String(raw).trim() === '') {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', 'parameters', `Route parameter ${name} is not resolved by ${routeSpace.routeSpaceId}.`);
    }
    const value = String(raw);
    if (!routeParameterPattern(definition.type).test(value)) {
      throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `parameters.${name}`, `Route parameter ${name} does not satisfy ${definition.type}.`);
    }
    browserTemplate = browserTemplate.replace(`:${name}`, encodeURIComponent(value));
  }
  const unknown = Object.keys(parameters).find((name) => !declared.has(name));
  if (unknown) throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `parameters.${unknown}`, `RouteSpace ${routeSpace.routeSpaceId} does not declare ${unknown}.`);
  return browserTemplate;
};

const renderTreeDepth = (tree: RenderTree): number => {
  const byId = new Map(tree.nodes.map((node) => [node.nodeId, node]));
  let maximum = 0;
  tree.nodes.forEach((node) => {
    let depth = 1;
    let parentId = node.parentNodeId;
    while (parentId) {
      depth += 1;
      parentId = byId.get(parentId)?.parentNodeId;
    }
    maximum = Math.max(maximum, depth);
  });
  return maximum;
};

const compareLegacyEntityRef = (reference: { kind: string; id: string; version?: number | string; ownerRepo?: string }, revision: RevisionRef) =>
  reference.kind === revision.kind
  && reference.id === revision.id
  && String(reference.version) === String(revision.revision)
  && reference.ownerRepo === revision.ownerRepo;

const pageDependencies = (page: Page, compilerRevisionRef: RevisionRef): ReleaseDependency[] => [
  ...page.routeClaims.map((claim) => ({ role: 'route-space' as const, revisionRef: claim.routeSpaceRevisionRef })),
  { role: 'shell', revisionRef: page.shellRevisionRef },
  ...page.capabilityInstances.flatMap((instance) => [
    { role: 'capability' as const, revisionRef: instance.capabilityRevisionRef },
    { role: 'provider' as const, revisionRef: instance.providerRevisionRef },
    { role: 'schema' as const, revisionRef: instance.propertySchemaRevisionRef },
  ]),
  ...page.ontologyBindings.flatMap((binding) => [
    { role: 'ontology-definition' as const, revisionRef: binding.ontologyDefinitionRevisionRef },
    ...(binding.viewRevisionRef ? [{ role: 'view' as const, revisionRef: binding.viewRevisionRef }] : []),
    ...(binding.projectionRevisionRef ? [{ role: 'projection' as const, revisionRef: binding.projectionRevisionRef }] : []),
    { role: 'schema' as const, revisionRef: binding.renderModelSchemaRevisionRef },
  ]),
  ...page.actionBindings.flatMap((binding) => [
    { role: 'action' as const, revisionRef: binding.commandRevisionRef },
    { role: 'schema' as const, revisionRef: binding.sourceIntentSchemaRevisionRef },
    { role: 'schema' as const, revisionRef: binding.inputSchemaRevisionRef },
    { role: 'schema' as const, revisionRef: binding.resultSchemaRevisionRef },
    ...(binding.compensationCommandRevisionRef ? [{ role: 'action' as const, revisionRef: binding.compensationCommandRevisionRef }] : []),
  ]),
  ...page.tokenRevisionRefs.map((revisionRef) => ({ role: 'token' as const, revisionRef })),
  { role: 'performance-budget', revisionRef: page.performanceBudgetRef },
  { role: 'observation-policy', revisionRef: page.observationPolicyRevisionRef },
  { role: 'compiler', revisionRef: compilerRevisionRef },
];

export const compilePageRuntimeBundle = (input: CompilePageRuntimeBundleInput): PageRuntimeBundle => {
  const page = PageSchema.parse(input.page);
  const pageRevisionRef = RevisionRefSchema.parse(input.pageRevisionRef);
  const release = PageReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(input.compilerRevisionRef);
  const scope = TenantScopeSchema.parse(page.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, 'release.tenantScope');
  assertRevisionIdentity(pageRevisionRef, 'page', page.pageId, scope, 'pageRevisionRef');
  assertRevisionIdentity(release.pageRevisionRef, 'page', page.pageId, scope, 'release.pageRevisionRef');
  if (!sameRevisionRef(pageRevisionRef, release.pageRevisionRef)) throw new DeclarativeControlCompilationError('REVISION_MISMATCH', 'release.pageRevisionRef', 'Release does not pin the supplied Page revision.');
  assertRevisionIdentity(releaseRevisionRef, 'page-release', release.releaseSlotId, scope, 'releaseRevisionRef');
  requireReleaseReady(release);
  requireDependencies(release.dependencySnapshot, pageDependencies(page, compilerRevisionRef));
  assertDependencyScopes(release.dependencySnapshot, scope);

  if (page.renderTree.nodes.length > input.limits.maxRenderNodes) throw new DeclarativeControlCompilationError('RENDER_NODE_LIMIT_EXCEEDED', 'page.renderTree.nodes', 'RenderTree exceeds the caller-approved node limit.');
  if (renderTreeDepth(page.renderTree) > input.limits.maxRenderDepth) throw new DeclarativeControlCompilationError('RENDER_DEPTH_EXCEEDED', 'page.renderTree.nodes', 'RenderTree exceeds the caller-approved depth limit.');
  const renderTree = compileRenderTree(page.renderTree).tree;
  const instancesByNode = new Map(page.capabilityInstances.map((instance) => [instance.nodeId, instance]));
  const registrations = input.capabilityRegistry.map((registration, registrationIndex) => ({
    ...registration,
    capabilityRevisionRef: RevisionRefSchema.parse(registration.capabilityRevisionRef),
    providerRevisionRef: RevisionRefSchema.parse(registration.providerRevisionRef),
    inputPorts: registration.inputPorts.map((port, portIndex) => {
      const schemaRevisionRef = RevisionRefSchema.parse(port.schemaRevisionRef);
      if (schemaRevisionRef.kind !== 'schema') {
        throw new DeclarativeControlCompilationError('PORT_TYPE_MISMATCH', `capabilityRegistry[${registrationIndex}].inputPorts[${portIndex}].schemaRevisionRef`, 'Capability ports must pin schema revisions.');
      }
      return { ...port, schemaRevisionRef };
    }),
    outputPorts: registration.outputPorts.map((port, portIndex) => {
      const schemaRevisionRef = RevisionRefSchema.parse(port.schemaRevisionRef);
      if (schemaRevisionRef.kind !== 'schema') {
        throw new DeclarativeControlCompilationError('PORT_TYPE_MISMATCH', `capabilityRegistry[${registrationIndex}].outputPorts[${portIndex}].schemaRevisionRef`, 'Capability ports must pin schema revisions.');
      }
      return { ...port, schemaRevisionRef };
    }),
  }));
  assertUniqueRegistryKeys(registrations.map((registration) =>
    `${revisionRefKey(registration.capabilityRevisionRef)}:${revisionRefKey(registration.providerRevisionRef)}`), 'capabilityRegistry');
  const registrationsByPair = new Map(registrations.map((registration) => [
    `${revisionRefKey(registration.capabilityRevisionRef)}:${revisionRefKey(registration.providerRevisionRef)}`,
    registration,
  ]));
  page.capabilityInstances.forEach((instance, index) => {
    const node = renderTree.nodes.find((candidate) => candidate.nodeId === instance.nodeId);
    if (!node || !compareLegacyEntityRef(node.capabilityRef, instance.capabilityRevisionRef)
      || !node.providerRef || !compareLegacyEntityRef(node.providerRef, instance.providerRevisionRef)
      || node.pageRef.id !== page.pageId) {
      throw new DeclarativeControlCompilationError('CAPABILITY_BINDING_MISMATCH', `capabilityInstances[${index}]`, 'RenderTree node identity does not match the declared capability/provider instance.');
    }
    const registration = registrationsByPair.get(`${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`);
    if (!registration?.editorEligible) {
      throw new DeclarativeControlCompilationError('CAPABILITY_NOT_EDITOR_ELIGIBLE', `capabilityInstances[${index}]`, 'Capability/provider pair is not editor-eligible.');
    }
    if (instance.allowedSideEffects.some((sideEffect) => !registration.allowedSideEffects.includes(sideEffect))) {
      throw new DeclarativeControlCompilationError('CAPABILITY_BINDING_MISMATCH', `capabilityInstances[${index}].allowedSideEffects`, 'Page requests undeclared provider side effects.');
    }
  });
  page.ontologyBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find((candidate) => candidate.instanceId === binding.target.capabilityInstanceId);
    const registration = instance && registrationsByPair.get(`${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`);
    const port = registration?.inputPorts.find((candidate) => candidate.name === binding.target.port);
    if (!port || !sameRevisionRef(port.schemaRevisionRef, binding.renderModelSchemaRevisionRef)) {
      throw new DeclarativeControlCompilationError('PORT_TYPE_MISMATCH', `ontologyBindings[${index}].target.port`, 'Ontology render model does not match the registered capability input port.');
    }
  });
  page.actionBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find((candidate) => candidate.instanceId === binding.source.capabilityInstanceId);
    const registration = instance && registrationsByPair.get(`${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`);
    const port = registration?.outputPorts.find((candidate) => candidate.name === binding.source.port);
    if (!port || !sameRevisionRef(port.schemaRevisionRef, binding.sourceIntentSchemaRevisionRef)) {
      throw new DeclarativeControlCompilationError('PORT_TYPE_MISMATCH', `actionBindings[${index}].sourceIntentSchemaRevisionRef`, 'Action source intent does not match the registered capability output port.');
    }
  });

  const routeClaims = compileRouteClaims({ claims: page.routeClaims, routeSpaces: input.routeSpaces, surface: release.target.surface });
  const releaseRoute = routeClaims.find((claim) => claim.kind === 'canonical' && claim.normalizedPath === release.target.normalizedPath);
  if (!releaseRoute || !sameRevisionRef(releaseRoute.routeSpaceRevisionRef, release.target.routeSpaceRevisionRef)) {
    throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', 'release.target', 'Release target does not match a canonical Page route claim.');
  }
  if (!page.supportedSurfaces.includes(release.target.surface)) {
    throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', 'release.target.surface', 'Page does not support the release surface.');
  }
  const unsigned = {
    contract: 'PageRuntimeBundle' as const,
    schemaVersion: 1 as const,
    tenantScope: scope,
    releaseRevisionRef,
    compilerRevisionRef,
    generation: input.generation,
    dependencySnapshot: release.dependencySnapshot,
    rebuildable: true as const,
    diagnostics: [],
    pageId: page.pageId,
    pageRevisionRef,
    surface: release.target.surface,
    routeClaims,
    shellRevisionRef: page.shellRevisionRef,
    renderTree,
    capabilityInstances: page.capabilityInstances,
    ontologyBindings: page.ontologyBindings,
    actionBindings: page.actionBindings,
    pageAccessPolicy: page.pageAccessPolicy,
    tokenRevisionRefs: page.tokenRevisionRefs,
    performanceBudgetRef: page.performanceBudgetRef,
    observationPolicyRevisionRef: page.observationPolicyRevisionRef,
    privacyClassification: page.privacyClassification,
  };
  return deepFreeze(PageRuntimeBundleSchema.parse({ ...unsigned, contentHash: canonicalContentHash(unsigned) }));
};

const workbenchDependencyRole = (kind: string): ReleaseDependency['role'] => {
  switch (kind) {
    case 'workflow': return 'workflow';
    case 'agent': return 'agent';
    case 'capability': return 'capability';
    case 'design': return 'design';
    case 'built-in-application': return 'built-in-application';
    default: return 'workflow';
  }
};

const workbenchDependencies = (workbench: Workbench, compilerRevisionRef: RevisionRef): ReleaseDependency[] => [
  ...workbench.routeClaims.map((claim) => ({ role: 'route-space' as const, revisionRef: claim.routeSpaceRevisionRef })),
  ...workbench.appInstances.flatMap((instance) => [
    { role: workbenchDependencyRole(instance.targetRevisionRef.kind), revisionRef: instance.targetRevisionRef },
    { role: 'provider' as const, revisionRef: instance.providerRevisionRef },
    { role: 'schema' as const, revisionRef: instance.inputSchemaRevisionRef },
  ]),
  { role: 'capability', revisionRef: workbench.layout.hostCapabilityRevisionRef },
  { role: 'provider', revisionRef: workbench.layout.hostProviderRevisionRef },
  { role: 'layout-policy', revisionRef: workbench.layout.layoutPolicyRevisionRef },
  ...workbench.layout.tokenRevisionRefs.map((revisionRef) => ({ role: 'token' as const, revisionRef })),
  { role: 'performance-budget', revisionRef: workbench.performanceBudgetRef },
  { role: 'observation-policy', revisionRef: workbench.observationPolicyRevisionRef },
  { role: 'compiler', revisionRef: compilerRevisionRef },
];

export const compileWorkbenchRuntimeBundle = (input: CompileWorkbenchRuntimeBundleInput): WorkbenchRuntimeBundle => {
  const workbench = WorkbenchSchema.parse(input.workbench);
  const workbenchRevisionRef = RevisionRefSchema.parse(input.workbenchRevisionRef);
  const release = WorkbenchReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(input.compilerRevisionRef);
  const scope = TenantScopeSchema.parse(workbench.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, 'release.tenantScope');
  if (workbench.purpose === 'template') throw new DeclarativeControlCompilationError('WORKBENCH_TEMPLATE_UNRELEASABLE', 'workbench.purpose', 'Workbench templates cannot be activated.');
  if (workbench.groups.length > input.limits.maxWorkbenchGroups || workbench.appInstances.length > input.limits.maxWorkbenchInstances) {
    throw new DeclarativeControlCompilationError('WORKBENCH_INSTANCE_LIMIT_EXCEEDED', 'workbench', 'Workbench exceeds caller-approved compilation limits.');
  }
  assertRevisionIdentity(workbenchRevisionRef, 'workbench', workbench.workbenchId, scope, 'workbenchRevisionRef');
  assertRevisionIdentity(release.workbenchRevisionRef, 'workbench', workbench.workbenchId, scope, 'release.workbenchRevisionRef');
  if (!sameRevisionRef(workbenchRevisionRef, release.workbenchRevisionRef)) throw new DeclarativeControlCompilationError('REVISION_MISMATCH', 'release.workbenchRevisionRef', 'Release does not pin the supplied Workbench revision.');
  assertRevisionIdentity(releaseRevisionRef, 'workbench-release', release.releaseSlotId, scope, 'releaseRevisionRef');
  if (release.target.workbenchId !== workbench.workbenchId) throw new DeclarativeControlCompilationError('REVISION_MISMATCH', 'release.target.workbenchId', 'Release target does not match Workbench identity.');
  requireReleaseReady(release);
  requireDependencies(release.dependencySnapshot, workbenchDependencies(workbench, compilerRevisionRef));
  assertDependencyScopes(release.dependencySnapshot, scope);
  const routeClaims = compileRouteClaims({ claims: workbench.routeClaims, routeSpaces: input.routeSpaces, surface: release.target.surface });
  const releaseRoute = routeClaims.find((claim) => claim.kind === 'canonical' && claim.normalizedPath === release.target.normalizedPath);
  if (!releaseRoute || !sameRevisionRef(releaseRoute.routeSpaceRevisionRef, release.target.routeSpaceRevisionRef)) {
    throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', 'release.target', 'Release target does not match a canonical Workbench route claim.');
  }
  const targetRegistry = input.targetRegistry.map((registration) => ({
    stableTargetRef: StableRefSchema.parse(registration.stableTargetRef),
    targetRevisionRef: RevisionRefSchema.parse(registration.targetRevisionRef),
    accessPolicy: AccessPolicySchema.parse(registration.accessPolicy),
  }));
  assertUniqueRegistryKeys(targetRegistry.map((registration) => stableRefKey(registration.stableTargetRef)), 'targetRegistry');
  const targetsByStableRef = new Map(targetRegistry.map((registration) => [stableRefKey(registration.stableTargetRef), registration]));
  const groupsById = new Map(workbench.groups.map((group) => [group.groupId, group]));
  const appInstances = workbench.appInstances.map((instance, index) => {
    const stableTarget = StableRefSchema.parse({
      kind: instance.targetRevisionRef.kind,
      id: instance.targetRevisionRef.id,
      ownerRepo: instance.targetRevisionRef.ownerRepo,
      visibility: instance.targetRevisionRef.visibility,
      ...(instance.targetRevisionRef.tenantScope ? { tenantScope: instance.targetRevisionRef.tenantScope } : {}),
    });
    const registration = targetsByStableRef.get(stableRefKey(stableTarget));
    if (!registration || !sameStableRef(registration.stableTargetRef, stableFromRevision(registration.targetRevisionRef))
      || !sameRevisionRef(registration.targetRevisionRef, instance.targetRevisionRef)) {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `appInstances[${index}].targetRevisionRef`, 'Workbench app target is not present at the exact registered revision.');
    }
    assertTenantCompatible(instance.targetRevisionRef, scope, `appInstances[${index}].targetRevisionRef`);
    const group = groupsById.get(instance.groupId);
    const chain = [workbench.workbenchAccessPolicy, ...(group?.accessPolicy ? [group.accessPolicy] : []), instance.accessPolicy];
    if (!accessPolicyChainImplies(chain, registration.accessPolicy)) {
      throw new DeclarativeControlCompilationError('AUDIENCE_WIDER_THAN_TARGET', `appInstances[${index}].accessPolicy`, 'Workbench and instance audience is wider than the target audience.');
    }
    return { ...instance, targetAccessPolicy: registration.accessPolicy };
  });
  const unsigned = {
    contract: 'WorkbenchRuntimeBundle' as const,
    schemaVersion: 1 as const,
    tenantScope: scope,
    releaseRevisionRef,
    compilerRevisionRef,
    generation: input.generation,
    dependencySnapshot: release.dependencySnapshot,
    rebuildable: true as const,
    diagnostics: [],
    workbenchId: workbench.workbenchId,
    workbenchRevisionRef,
    surface: release.target.surface,
    routeClaims,
    groups: workbench.groups,
    appInstances,
    defaultEntry: workbench.defaultEntry,
    layout: workbench.layout,
    workbenchAccessPolicy: workbench.workbenchAccessPolicy,
    personalPreferencesPolicy: workbench.personalPreferencesPolicy,
    target: { ...release.target, routeClaim: releaseRoute },
    performanceBudgetRef: workbench.performanceBudgetRef,
    observationPolicyRevisionRef: workbench.observationPolicyRevisionRef,
    privacyClassification: workbench.privacyClassification,
  };
  return deepFreeze(WorkbenchRuntimeBundleSchema.parse({ ...unsigned, contentHash: canonicalContentHash(unsigned) }));
};

const navigationDepth = (navigation: Navigation): number => {
  const byId = new Map(navigation.nodes.map((node) => [node.nodeId, node]));
  let maximum = 0;
  navigation.nodes.forEach((node) => {
    let depth = 1;
    let parentId = node.parentNodeId;
    while (parentId) {
      depth += 1;
      parentId = byId.get(parentId)?.parentNodeId ?? null;
    }
    maximum = Math.max(maximum, depth);
  });
  return maximum;
};

const orderedNavigationNodes = (navigation: Navigation): Navigation['nodes'] => {
  const children = new Map<string, Navigation['nodes']>();
  navigation.nodes.forEach((node) => {
    const parent = node.parentNodeId ?? '';
    const siblings = children.get(parent) ?? [];
    children.set(parent, [...siblings, node]);
  });
  children.forEach((siblings) => siblings.sort((left, right) => left.order - right.order || left.nodeId.localeCompare(right.nodeId)));
  const ordered: Navigation['nodes'] = [];
  const append = (parentId: string) => {
    for (const node of children.get(parentId) ?? []) {
      ordered.push(node);
      append(node.nodeId);
    }
  };
  append('');
  return ordered;
};

const navigationDependencies = (
  navigation: Navigation,
  release: NavigationRelease,
  compilerRevisionRef: RevisionRef,
): ReleaseDependency[] => [
  ...release.resolvedTargets.flatMap((target) => [
    { role: target.targetRevisionRef.kind === 'domain-command' ? 'action' as const : target.targetRevisionRef.kind as ReleaseDependency['role'], revisionRef: target.targetRevisionRef },
    ...(target.releaseRevisionRef ? [{ role: target.releaseRevisionRef.kind as ReleaseDependency['role'], revisionRef: target.releaseRevisionRef }] : []),
  ]),
  { role: 'performance-budget', revisionRef: navigation.performanceBudgetRef },
  { role: 'observation-policy', revisionRef: navigation.observationPolicyRevisionRef },
  { role: 'compiler', revisionRef: compilerRevisionRef },
];

export const compileNavigationRuntimeBundle = (input: CompileNavigationRuntimeBundleInput): NavigationRuntimeBundle => {
  const navigation = NavigationSchema.parse(input.navigation);
  const navigationRevisionRef = RevisionRefSchema.parse(input.navigationRevisionRef);
  const release = NavigationReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(input.compilerRevisionRef);
  const scope = TenantScopeSchema.parse(navigation.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, 'release.tenantScope');
  if (navigation.nodes.length > input.limits.maxNavigationNodes) throw new DeclarativeControlCompilationError('NAV_NODE_LIMIT_EXCEEDED', 'navigation.nodes', 'Navigation exceeds the caller-approved node limit.');
  if (navigationDepth(navigation) > input.limits.maxNavigationDepth) throw new DeclarativeControlCompilationError('NAV_DEPTH_EXCEEDED', 'navigation.nodes', 'Navigation exceeds the caller-approved depth limit.');
  assertRevisionIdentity(navigationRevisionRef, 'navigation', navigation.navigationId, scope, 'navigationRevisionRef');
  assertRevisionIdentity(release.navigationRevisionRef, 'navigation', navigation.navigationId, scope, 'release.navigationRevisionRef');
  if (!sameRevisionRef(navigationRevisionRef, release.navigationRevisionRef)) throw new DeclarativeControlCompilationError('REVISION_MISMATCH', 'release.navigationRevisionRef', 'Release does not pin the supplied Navigation revision.');
  assertRevisionIdentity(releaseRevisionRef, 'navigation-release', release.releaseSlotId, scope, 'releaseRevisionRef');
  if (release.target.surface !== navigation.supportedSurfaces.find((surface) => surface === release.target.surface)
    || !navigation.placements.includes(release.target.placement)) {
    throw new DeclarativeControlCompilationError('REVISION_MISMATCH', 'release.target', 'Navigation release target is not declared by the Navigation record.');
  }
  requireReleaseReady(release);
  requireDependencies(release.dependencySnapshot, navigationDependencies(navigation, release, compilerRevisionRef));
  assertDependencyScopes(release.dependencySnapshot, scope);
  const targetRegistry = input.targetRegistry.map((registration, index) => {
    const common = {
      stableTargetRef: StableRefSchema.parse(registration.stableTargetRef),
      targetRevisionRef: RevisionRefSchema.parse(registration.targetRevisionRef),
      surface: ProductSurfaceSchema.parse(registration.surface),
      accessPolicy: AccessPolicySchema.parse(registration.accessPolicy),
    };
    if (registration.kind === 'route') {
      const routeClaim = CompiledRouteClaimSchema.parse(registration.routeClaim);
      if (routeClaim.surface !== common.surface) {
        throw new DeclarativeControlCompilationError('ROUTE_SPACE_MISMATCH', `targetRegistry[${index}].routeClaim.surface`, 'Navigation route claim must match its registered surface.');
      }
      return {
        ...common,
        kind: 'route' as const,
        releaseRevisionRef: registration.releaseRevisionRef ? RevisionRefSchema.parse(registration.releaseRevisionRef) : undefined,
        routeClaim,
      };
    }
    if (registration.kind === 'registered-menu-action') {
      const sourceCatalogRevisionRef = RevisionRefSchema.parse(registration.sourceCatalogRevisionRef);
      if (sourceCatalogRevisionRef.kind !== 'application-menu-catalog' || registration.targetRevisionRef.kind !== 'menu-action') {
        throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', 'targetRegistry', 'Registered Menu Actions require exact menu-action and application-menu-catalog revisions.');
      }
      if (registration.inputSchemaRef && !registration.validateInput) {
        throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', 'targetRegistry', 'Registered Menu Actions with input schemas require the active catalog validator.');
      }
      return { ...common, kind: 'registered-menu-action' as const, applicationId: registration.applicationId, actionRef: registration.actionRef, inputSchemaRef: registration.inputSchemaRef, validateInput: registration.validateInput, sourceCatalogRevisionRef };
    }
    if (registration.targetRevisionRef.kind !== 'domain-command') {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', 'targetRegistry', 'Governed DomainCommand actions require an exact domain-command revision.');
    }
    const inputSchemaRevisionRef = RevisionRefSchema.parse(registration.inputSchemaRevisionRef);
    const resultSchemaRevisionRef = registration.resultSchemaRevisionRef
      ? RevisionRefSchema.parse(registration.resultSchemaRevisionRef)
      : undefined;
    if (inputSchemaRevisionRef.kind !== 'schema' || (resultSchemaRevisionRef && resultSchemaRevisionRef.kind !== 'schema')) {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', 'targetRegistry', 'Governed DomainCommand actions require exact input and output Schema revisions.');
    }
    return { ...common, kind: 'governed-domain-command' as const, inputSchemaRevisionRef, resultSchemaRevisionRef };
  });
  assertUniqueRegistryKeys(targetRegistry.map((registration) => stableRefKey(registration.stableTargetRef)), 'targetRegistry');
  const targetsByStableRef = new Map(targetRegistry.map((registration) => [stableRefKey(registration.stableTargetRef), registration]));
  const releasedByNodeId = new Map(release.resolvedTargets.map((target) => [target.nodeId, target]));
  const nodesById = new Map(navigation.nodes.map((node) => [node.nodeId, node]));
  const nodes = orderedNavigationNodes(navigation).map((node, index) => {
    const ancestors: AccessPolicy[] = [];
    let parentId = node.parentNodeId;
    while (parentId) {
      const parent = nodesById.get(parentId);
      if (parent?.kind === 'group') ancestors.unshift(parent.audience);
      parentId = parent?.parentNodeId ?? null;
    }
    if (node.kind !== 'target') return { ...node, ancestorAccessPolicies: ancestors };
    if (!['page', 'workbench', 'menu-action', 'domain-command'].includes(node.targetRef.kind)) {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `nodes[${index}].targetRef.kind`, 'Navigation targets may reference only Page, Workbench, registered Menu Action, or DomainCommand identities.');
    }
    const registration = targetsByStableRef.get(stableRefKey(node.targetRef));
    const released = releasedByNodeId.get(node.nodeId);
    if (!registration || !released
      || !sameStableRef(registration.stableTargetRef, stableFromRevision(registration.targetRevisionRef))
      || !sameStableRef(registration.stableTargetRef, released.stableTargetRef)
      || !sameRevisionRef(registration.targetRevisionRef, released.targetRevisionRef)
      || (registration.kind === 'route' && (Boolean(registration.releaseRevisionRef) !== Boolean(released.releaseRevisionRef)
      || (registration.releaseRevisionRef && released.releaseRevisionRef && !sameRevisionRef(registration.releaseRevisionRef, released.releaseRevisionRef))))) {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `nodes[${index}].targetRef`, 'Navigation target is not resolved to the exact active release recorded by NavigationRelease.');
    }
    if (registration.surface !== release.target.surface) {
      throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `nodes[${index}].targetRef`, 'Navigation target is active on another surface.');
    }
    assertTenantCompatible(registration.targetRevisionRef, scope, `nodes[${index}].targetRef`);
    if (!accessPolicyChainImplies([...ancestors, node.audience], registration.accessPolicy)) {
      throw new DeclarativeControlCompilationError('AUDIENCE_WIDER_THAN_TARGET', `nodes[${index}].audience`, 'Effective Navigation audience is wider than the target audience.');
    }
    const mappedInput = Object.fromEntries(Object.entries(node.parameterMapping).map(([name, source]) => {
      if (source.kind !== 'constant') {
        throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `nodes[${index}].parameterMapping.${name}`, 'Navigation actions accept only publication-time constant input.');
      }
      return [name, source.value];
    }));
    let resolvedTarget: Record<string, unknown>;
    if (registration.kind === 'route') {
      resolvedTarget = { ...released, kind: 'route', accessPolicy: registration.accessPolicy, routeClaim: registration.routeClaim };
    } else if (registration.kind === 'registered-menu-action') {
      if (!registration.inputSchemaRef && Object.keys(mappedInput).length > 0) {
        throw new DeclarativeControlCompilationError('NAV_TARGET_UNRELEASED', `nodes[${index}].parameterMapping`, 'The registered Menu Action does not accept input.');
      }
      let input: Record<string, unknown>;
      try {
        input = JsonObjectSchema.parse(registration.validateInput ? registration.validateInput(mappedInput) : mappedInput);
      } catch (error) {
        throw new DeclarativeControlCompilationError(
          'NAV_ACTION_INPUT_INVALID',
          `nodes[${index}].parameterMapping`,
          `Registered Menu Action input failed its active catalog schema: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const sourceDependency = release.dependencySnapshot.find((dependency) => dependency.role === 'application-menu-catalog' && sameRevisionRef(dependency.revisionRef, registration.sourceCatalogRevisionRef));
      if (!sourceDependency) throw new DeclarativeControlCompilationError('DEPENDENCY_MISSING', `nodes[${index}].targetRef`, 'Registered Menu Action source catalog is not pinned by NavigationRelease.');
      resolvedTarget = {
        ...released,
        kind: 'registered-menu-action',
        accessPolicy: registration.accessPolicy,
        execution: 'client',
        applicationId: registration.applicationId,
        actionRef: registration.actionRef,
        ...(registration.inputSchemaRef ? { inputSchemaRef: registration.inputSchemaRef } : {}),
        input,
        sourceCatalogRevisionRef: registration.sourceCatalogRevisionRef,
      };
    } else {
      const inputDependency = release.dependencySnapshot.find(
        (dependency) => dependency.role === 'schema' && sameRevisionRef(dependency.revisionRef, registration.inputSchemaRevisionRef),
      );
      const resultDependency = registration.resultSchemaRevisionRef
        ? release.dependencySnapshot.find(
            (dependency) => dependency.role === 'schema' && sameRevisionRef(dependency.revisionRef, registration.resultSchemaRevisionRef!),
          )
        : undefined;
      if (!inputDependency || (registration.resultSchemaRevisionRef && !resultDependency)) {
        throw new DeclarativeControlCompilationError('DEPENDENCY_MISSING', `nodes[${index}].targetRef`, 'Governed DomainCommand schemas are not pinned by NavigationRelease.');
      }
      resolvedTarget = {
        ...released,
        kind: 'governed-domain-command',
        accessPolicy: registration.accessPolicy,
        execution: 'server',
        commandRevisionRef: registration.targetRevisionRef,
        inputSchemaRevisionRef: registration.inputSchemaRevisionRef,
        ...(registration.resultSchemaRevisionRef ? { resultSchemaRevisionRef: registration.resultSchemaRevisionRef } : {}),
        input: JsonObjectSchema.parse(mappedInput),
      };
    }
    return {
      ...node,
      ancestorAccessPolicies: ancestors,
      resolvedTarget,
    };
  });
  const unsigned = {
    contract: 'NavigationRuntimeBundle' as const,
    schemaVersion: 1 as const,
    tenantScope: scope,
    releaseRevisionRef,
    compilerRevisionRef,
    generation: input.generation,
    dependencySnapshot: release.dependencySnapshot,
    rebuildable: true as const,
    diagnostics: [],
    navigationId: navigation.navigationId,
    navigationRevisionRef,
    surface: release.target.surface,
    placement: release.target.placement,
    nodes,
    performanceBudgetRef: navigation.performanceBudgetRef,
    observationPolicyRevisionRef: navigation.observationPolicyRevisionRef,
  };
  return deepFreeze(NavigationRuntimeBundleSchema.parse({ ...unsigned, contentHash: canonicalContentHash(unsigned) }));
};

export const validateWorkbenchRuntimeSet = (
  bundleInputs: readonly WorkbenchRuntimeBundle[],
): readonly WorkbenchRuntimeBundle[] => {
  const bundles = bundleInputs.map((bundle) => WorkbenchRuntimeBundleSchema.parse(bundle));
  if (bundles.length === 0) {
    throw new DeclarativeControlCompilationError('WORKBENCH_RELEASE_SET_INVALID', 'bundles', 'An active Workbench release set must retain at least one Workbench.');
  }
  const first = bundles[0];
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  let defaultCount = 0;
  bundles.forEach((bundle, index) => {
    if (scopeKey(bundle.tenantScope) !== scopeKey(first.tenantScope)
      || bundle.surface !== first.surface
      || !sameStableRef(bundle.target.environmentRef, first.target.environmentRef)) {
      throw new DeclarativeControlCompilationError('WORKBENCH_RELEASE_SET_INVALID', `bundles[${index}]`, 'Workbench release set entries must share tenant, environment, and surface.');
    }
    if (seenIds.has(bundle.workbenchId)) throw new DeclarativeControlCompilationError('WORKBENCH_RELEASE_SET_INVALID', `bundles[${index}].workbenchId`, 'Workbench identities must be unique in an active release set.');
    if (seenOrders.has(bundle.target.order)) throw new DeclarativeControlCompilationError('WORKBENCH_RELEASE_SET_INVALID', `bundles[${index}].target.order`, 'Workbench order values must be unique in an active release set.');
    seenIds.add(bundle.workbenchId);
    seenOrders.add(bundle.target.order);
    if (bundle.target.isDefaultCandidate) defaultCount += 1;
  });
  if (defaultCount > 1) throw new DeclarativeControlCompilationError('WORKBENCH_RELEASE_SET_INVALID', 'bundles', 'An active Workbench release set may have at most one default candidate.');
  return Object.freeze([...bundles].sort((left, right) => left.target.order - right.target.order || left.workbenchId.localeCompare(right.workbenchId)));
};

export type WorkbenchEntryResolution =
  | { status: 'resolved'; bundle: WorkbenchRuntimeBundle; source: 'explicit' | 'default' | 'first-accessible' }
  | { status: 'not-found'; workbenchId: string }
  | { status: 'forbidden'; workbenchId: string };

export const resolveWorkbenchEntry = (input: {
  bundles: readonly WorkbenchRuntimeBundle[];
  requestedWorkbenchId?: string;
  isAllowed: (bundle: WorkbenchRuntimeBundle) => boolean;
}): WorkbenchEntryResolution => {
  if (input.requestedWorkbenchId) {
    const requested = input.bundles.find((bundle) => bundle.workbenchId === input.requestedWorkbenchId);
    if (!requested) return { status: 'not-found', workbenchId: input.requestedWorkbenchId };
    if (!input.isAllowed(requested)) return { status: 'forbidden', workbenchId: input.requestedWorkbenchId };
    return { status: 'resolved', bundle: requested, source: 'explicit' };
  }
  const allowed = input.bundles
    .filter(input.isAllowed)
    .sort((left, right) => left.target.order - right.target.order || left.workbenchId.localeCompare(right.workbenchId));
  const defaultBundle = allowed.find((bundle) => bundle.target.isDefaultCandidate);
  if (defaultBundle) return { status: 'resolved', bundle: defaultBundle, source: 'default' };
  if (allowed[0]) return { status: 'resolved', bundle: allowed[0], source: 'first-accessible' };
  return { status: 'forbidden', workbenchId: '' };
};
