import type { RenderNode, RenderTree } from "../contracts/render";
import { JsonObjectSchema } from "../contracts/common";
import {
  DeclarativeProductResourceRegistrationSchema,
  DeclarativeShellResourceDocumentSchema,
  DesignCapabilityCatalogArtifactSchema,
  ProductDeclarativeCapabilityRegistrationSchema,
  type DeclarativeCreateTemplateRegistration,
  type DeclarativeProductResourceRegistration,
  type DeclarativeRouteSpaceRegistration,
  type DeclarativeSchemaDefinitionRegistration,
  type DesignCapabilityCatalogArtifact,
  type DesignCapabilityCatalogEntry,
  type ProductDeclarativeCapabilityRegistration,
} from "../contracts/declarative-control-http";
import { compileRenderTree } from "./render-tree-compiler";
import { collectPageExpressionReads } from "../contracts/page-expression";
import {
  AccessPolicySchema,
  CompiledRouteClaimSchema,
  DeclarativeRouteOwnerIndexSchema,
  DomainQueryDefinitionSchema,
  PageSchema,
  DeclarativeWorkbenchCatalogSchema,
  LegacyRouteTakeoverAuthorizationSchema,
  LegacyRouteClaimSchema,
  PermissionAlternativePolicySchema,
  NavigationReleaseSchema,
  NavigationRuntimeBundleSchema,
  NavigationSchema,
  PageReleaseSchema,
  PageRuntimeBundleSchema,
  LegacyPageRuntimeBundleSchema,
  ResolvedPageSchema,
  OntologyBindingSchema,
  LegacyOntologyBindingSchema,
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
  type DeclarativeRouteOwnerIndex,
  type DeclarativeRouteOwnerIndexEntry,
  type DeclarativeRouteClaim,
  type DeclarativeWorkbenchCatalog,
  type DeclarativeWorkbenchCatalogEntry,
  type DomainQueryDefinition,
  type LegacyRouteTakeoverAuthorization,
  type PermissionAlternativePolicy,
  type Navigation,
  type NavigationRelease,
  type NavigationRuntimeBundle,
  type Page,
  type ResolvedPage,
  type PageRelease,
  type PageRuntimeBundle,
  type LegacyPageRuntimeBundle,
  type ReleaseDependency,
  type RevisionRef,
  type RouteClaim,
  type RouteSpace,
  type StableRef,
  type TenantScope,
  type Workbench,
  type WorkbenchRelease,
  type WorkbenchRuntimeBundle,
} from "../contracts/declarative-control";
import type { DomainCommandDefinition } from "../contracts/semantic";
export type DeclarativeControlCompilationErrorCode =
  | "AUDIENCE_WIDER_THAN_TARGET"
  | "CAPABILITY_BINDING_MISMATCH"
  | "CAPABILITY_NOT_EDITOR_ELIGIBLE"
  | "COMMAND_DEFINITION_MISMATCH"
  | "CROSS_TENANT_REFERENCE"
  | "DEPENDENCY_MISSING"
  | "DESIGN_CATALOG_INVALID"
  | "HEAD_CONFLICT"
  | "NAV_DEPTH_EXCEEDED"
  | "NAV_ACTION_INPUT_INVALID"
  | "NAV_NODE_LIMIT_EXCEEDED"
  | "NAV_TARGET_UNRELEASED"
  | "PAGE_ENTRY_TARGET_UNRELEASED"
  | "PORT_TYPE_MISMATCH"
  | "PRODUCT_CAPABILITY_CATALOG_INVALID"
  | "QUERY_DEFINITION_MISMATCH"
  | "RENDER_DEPTH_EXCEEDED"
  | "RENDER_TREE_INVALID"
  | "RENDER_NODE_LIMIT_EXCEEDED"
  | "RELEASE_OPERATION_INVALID"
  | "RELEASE_VALIDATION_FAILED"
  | "REGISTRY_CONFLICT"
  | "REVISION_MISMATCH"
  | "ROUTE_CONFLICT"
  | "ROUTE_RESERVED"
  | "ROUTE_TAKEOVER_INVALID"
  | "SCHEMA_DEFINITION_MISMATCH"
  | "ROUTE_SPACE_MISSING"
  | "ROUTE_SPACE_MISMATCH"
  | "SHELL_CHROME_UNAVAILABLE"
  | "SHELL_REVISION_MISMATCH"
  | "SHELL_SURFACE_MISMATCH"
  | "WORKBENCH_INSTANCE_LIMIT_EXCEEDED"
  | "WORKBENCH_RELEASE_SET_INVALID"
  | "WORKBENCH_TEMPLATE_UNRELEASABLE";
export class DeclarativeControlCompilationError extends Error {
  constructor(
    public readonly code: DeclarativeControlCompilationErrorCode,
    public readonly path: string,
    message: string,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = "DeclarativeControlCompilationError";
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
  propertySchemaRevisionRef: RevisionRef;
  accessPolicy: AccessPolicy;
  editorEligible: boolean;
  inputPorts: readonly CapabilityPortRegistration[];
  outputPorts: readonly CapabilityPortRegistration[];
  allowedSideEffects: readonly (
    | "network"
    | "storage"
    | "navigation"
    | "clipboard"
    | "worker"
    | "websocket"
  )[];
}
export interface DomainQueryRegistration {
  definitionRevisionRef: RevisionRef;
  definition: DomainQueryDefinition;
}
export interface DomainCommandRegistration {
  definitionRevisionRef: RevisionRef;
  definition: DomainCommandDefinition;
}
export interface ResolvePageDefaults {
  routeSpace: RevisionRef;
  shell: RevisionRef;
  tokens: readonly RevisionRef[];
  performanceBudget: RevisionRef;
  observationPolicy: RevisionRef;
}
export interface ResolvePageInput {
  page: Page;
  pageOwnerRepo: string;
  defaults: ResolvePageDefaults;
  routeSpaces?: readonly RouteSpaceRegistration[];
  productResources?: readonly DeclarativeProductResourceRegistration[];
  capabilityRegistry: readonly DeclarativeCapabilityRegistration[];
  domainQueryRegistry?: readonly DomainQueryRegistration[];
  domainCommandRegistry?: readonly DomainCommandRegistration[];
  schemaRegistry?: readonly DeclarativeSchemaDefinitionRegistration[];
  targetRegistry?: readonly NavigationRouteTargetRegistration[];
}
export interface WorkbenchTargetRegistration {
  stableTargetRef: StableRef;
  targetRevisionRef: RevisionRef;
  accessPolicy: AccessPolicy;
}
export interface NavigationRouteTargetRegistration extends WorkbenchTargetRegistration {
  kind: "route";
  releaseRevisionRef?: RevisionRef;
  surface: "studio" | "kernel";
  routeClaim: CompiledRouteClaim;
}
export interface NavigationRegisteredMenuActionRegistration extends WorkbenchTargetRegistration {
  kind: "registered-menu-action";
  surface: "studio" | "kernel";
  applicationId: string;
  actionRef: string;
  inputSchemaRef?: string;
  validateInput?: (input: Record<string, unknown>) => Record<string, unknown>;
  sourceCatalogRevisionRef: RevisionRef;
}
export interface NavigationDomainCommandRegistration extends WorkbenchTargetRegistration {
  kind: "governed-domain-command";
  surface: "studio" | "kernel";
  inputSchemaRevisionRef: RevisionRef;
  resultSchemaRevisionRef?: RevisionRef;
}
export type NavigationTargetRegistration =
  | NavigationRouteTargetRegistration
  | NavigationRegisteredMenuActionRegistration
  | NavigationDomainCommandRegistration;
export interface CompileRouteClaimsInput {
  claims: readonly (
    | RouteClaim
    | DeclarativeRouteClaim
    | ResolvedPage["routeClaims"][number]
    | Workbench["routeClaims"][number]
  )[];
  routeSpaces: readonly RouteSpaceRegistration[];
  surface: "studio" | "kernel";
  legacyRouteTakeoverAuthorizations?: readonly LegacyRouteTakeoverAuthorization[];
}
export interface MaterializeRouteSpacePathInput {
  routeSpace: RouteSpace;
  applicationPath: string;
  parameters?: Readonly<Record<string, string | number>>;
}
export interface CompilePageRuntimeBundleInput {
  page: ResolvedPage;
  pageRevisionRef: RevisionRef;
  release: PageRelease;
  releaseRevisionRef: RevisionRef;
  routeSpaces: readonly RouteSpaceRegistration[];
  compilerRevisionRef: RevisionRef;
  generation: number;
  limits: DeclarativeControlCompileLimits;
  capabilityRegistry: readonly DeclarativeCapabilityRegistration[];
  domainQueryRegistry?: readonly DomainQueryRegistration[];
  targetRegistry?: readonly NavigationRouteTargetRegistration[];
  shellRegistration: DeclarativeProductResourceRegistration;
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
const scopedIdentityKey = (reference: TenantScope["tenantRef"]): string =>
  `${reference.kind}:${reference.id}:${reference.ownerRepo}`;
const scopeKey = (scope: TenantScope): string =>
  `${scopedIdentityKey(scope.tenantRef)}:${scopedIdentityKey(scope.dataSpaceRef)}:${scope.teamRef ? scopedIdentityKey(scope.teamRef) : ""}`;
export const stableRefKey = (reference: StableRef): string =>
  `${reference.visibility}:${reference.tenantScope ? scopeKey(reference.tenantScope) : ""}:${reference.kind}:${reference.id}:${reference.ownerRepo}`;
export const revisionRefKey = (reference: RevisionRef): string =>
  `${stableRefKey(reference)}@${reference.revision}:v${reference.schemaVersion}:${reference.contentHash.toLowerCase()}`;
export const sameStableRef = (left: StableRef, right: StableRef): boolean =>
  stableRefKey(left) === stableRefKey(right);
export const sameRevisionRef = (
  left: RevisionRef,
  right: RevisionRef,
): boolean => revisionRefKey(left) === revisionRefKey(right);
const assertUniqueRegistryKeys = (keys: readonly string[], path: string) => {
  const seen = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) {
      throw new DeclarativeControlCompilationError(
        "REGISTRY_CONFLICT",
        `${path}[${index}]`,
        `Duplicate registry identity: ${key}`,
      );
    }
    seen.add(key);
  });
};
const stableSerialize = (value: unknown): string => {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value))
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
};
const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];
const SHA256_ROUND = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const rotateRight = (value: number, amount: number) =>
  (value >>> amount) | (value << (32 - amount));
const sha256Hex = (value: string): string => {
  const source = [...new TextEncoder().encode(value)];
  const bitLength = source.length * 8;
  source.push(0x80);
  while (source.length % 64 !== 56) source.push(0);
  const high = Math.floor(bitLength / 4294967296);
  const low = bitLength >>> 0;
  for (let shift = 24; shift >= 0; shift -= 8)
    source.push((high >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8)
    source.push((low >>> shift) & 0xff);
  const hash = [...SHA256_INITIAL];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < source.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4;
      words[index] =
        ((source[start] << 24) |
          (source[start + 1] << 16) |
          (source[start + 2] << 8) |
          source[start + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const previous = words[index - 15];
      const recent = words[index - 2];
      const small0 =
        rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3);
      const small1 =
        rotateRight(recent, 17) ^ rotateRight(recent, 19) ^ (recent >>> 10);
      words[index] =
        (words[index - 16] + small0 + words[index - 7] + small1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h + big1 + choice + SHA256_ROUND[index] + words[index]) >>> 0;
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
  return hash.map((part) => part.toString(16).padStart(8, "0")).join("");
};
export const canonicalContentHash = (value: unknown): string =>
  sha256Hex(stableSerialize(value));
/**
 * Names one immutable Runtime Bundle projection by its exact Release evidence.
 * The fixed-size digest stays below Data Server's 256-byte projection id limit
 * even when a governed release slot uses the maximum contract identifier size.
 */
export const declarativeRuntimeProjectionId = (
  resourceKind: "page" | "navigation" | "workbench",
  releaseSlotId: string,
  releaseRevisionRef: Pick<
    RevisionRef,
    "kind" | "id" | "ownerRepo" | "revision" | "schemaVersion" | "contentHash"
  >,
): string =>
  `drb:${canonicalContentHash({ resourceKind, releaseSlotId, releaseRevisionRef })}`;
/** Names the rebuildable route-owner index for one tenant environment surface. */
export const declarativeRouteOwnerIndexProjectionId = (
  tenantScope: TenantScope,
  environmentRef: StableRef,
  surface: "studio" | "kernel",
): string =>
  `dri:${canonicalContentHash({
    tenantScope: {
      teamRef: tenantScope.teamRef
        ? { kind: tenantScope.teamRef.kind, id: tenantScope.teamRef.id }
        : null,
    },
    environmentRef,
    surface,
  })}`;
export const declarativeWorkbenchCatalogProjectionId = (
  tenantScope: TenantScope,
  environmentRef: StableRef,
  surface: "studio" | "kernel",
): string =>
  `dwc:${canonicalContentHash({
    tenantScope: {
      teamRef: tenantScope.teamRef
        ? { kind: tenantScope.teamRef.kind, id: tenantScope.teamRef.id }
        : null,
    },
    environmentRef,
    surface,
  })}`;
const takeoverHashSource = (
  authorization: Omit<LegacyRouteTakeoverAuthorization, "contentHash">,
) => authorization;
export const compileLegacyRouteTakeoverAuthorization = (
  input: Omit<LegacyRouteTakeoverAuthorization, "contentHash">,
): LegacyRouteTakeoverAuthorization => {
  const unsigned = {
    ...input,
    contract: "LegacyRouteTakeoverAuthorization" as const,
    schemaVersion: 1 as const,
  };
  return deepFreeze(
    LegacyRouteTakeoverAuthorizationSchema.parse({
      ...unsigned,
      contentHash: canonicalContentHash(takeoverHashSource(unsigned)),
    }),
  );
};
export const legacyRouteTakeoverAuthorizationHash = (
  input: Omit<LegacyRouteTakeoverAuthorization, "contentHash">,
): string => canonicalContentHash(takeoverHashSource(input));
export const parseExactLegacyRouteTakeoverAuthorization = (
  input: unknown,
): LegacyRouteTakeoverAuthorization => {
  const parsed = LegacyRouteTakeoverAuthorizationSchema.parse(input);
  const { contentHash, ...unsigned } = parsed;
  if (contentHash !== legacyRouteTakeoverAuthorizationHash(unsigned)) {
    throw new DeclarativeControlCompilationError(
      "ROUTE_TAKEOVER_INVALID",
      "contentHash",
      "Legacy route takeover authorization content hash is not exact.",
    );
  }
  return deepFreeze(parsed);
};
export const permissionAlternativePolicyAllows = (
  policyInput: PermissionAlternativePolicy,
  permissionCodes: ReadonlySet<string> | readonly string[],
): boolean => {
  const parsed = PermissionAlternativePolicySchema.parse(policyInput);
  const available =
    permissionCodes instanceof Set ? permissionCodes : new Set(permissionCodes);
  return parsed.alternatives.some((alternative) =>
    alternative.every((permission) => available.has(permission)),
  );
};
export const compileDeclarativeRouteOwnerIndex = (input: {
  tenantScope: TenantScope;
  environmentRef: StableRef;
  surface: "studio" | "kernel";
  generation: number;
  entries: readonly DeclarativeRouteOwnerIndexEntry[];
}): DeclarativeRouteOwnerIndex => {
  const entries = input.entries
    .map((entry) => ({ ...entry }))
    .sort((left, right) => {
      const leftKey = `${left.resourceKind}:${left.releaseSlotId}`;
      const rightKey = `${right.resourceKind}:${right.releaseSlotId}`;
      return leftKey.localeCompare(rightKey);
    });
  const unsigned = {
    contract: "DeclarativeRouteOwnerIndex" as const,
    schemaVersion: 1 as const,
    tenantScope: TenantScopeSchema.parse(input.tenantScope),
    environmentRef: StableRefSchema.parse(input.environmentRef),
    surface: input.surface,
    generation: input.generation,
    entries,
    rebuildable: true as const,
  };
  return deepFreeze(
    DeclarativeRouteOwnerIndexSchema.parse({
      ...unsigned,
      contentHash: canonicalContentHash(unsigned),
    }),
  );
};
export const compileDeclarativeWorkbenchCatalog = (input: {
  tenantScope: TenantScope;
  environmentRef: StableRef;
  surface: "studio" | "kernel";
  generation: number;
  entries: readonly DeclarativeWorkbenchCatalogEntry[];
}): DeclarativeWorkbenchCatalog => {
  const entries = input.entries
    .map((entry) => ({ ...entry }))
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.workbenchId.localeCompare(right.workbenchId),
    );
  const unsigned = {
    contract: "DeclarativeWorkbenchCatalog" as const,
    schemaVersion: 1 as const,
    tenantScope: TenantScopeSchema.parse(input.tenantScope),
    environmentRef: StableRefSchema.parse(input.environmentRef),
    surface: input.surface,
    generation: input.generation,
    entries,
    rebuildable: true as const,
  };
  return deepFreeze(
    DeclarativeWorkbenchCatalogSchema.parse({
      ...unsigned,
      contentHash: canonicalContentHash(unsigned),
    }),
  );
};
export const declarativeCreateTemplateSourceHash = (
  document: DeclarativeCreateTemplateRegistration["document"],
): string => canonicalContentHash(document);
export const declarativeCreateTemplateRevisionHash = (
  registration: DeclarativeCreateTemplateRegistration,
): string => canonicalContentHash(registration.document);
export const declarativeRouteSpaceSourceHash = (
  routeSpace: DeclarativeRouteSpaceRegistration["routeSpace"],
): string => canonicalContentHash(routeSpace);
export const declarativeRouteSpaceRevisionHash = (
  registration: DeclarativeRouteSpaceRegistration,
): string => canonicalContentHash(registration.routeSpace);
export const declarativeProductResourceSourceHash = (
  document: DeclarativeProductResourceRegistration["document"],
): string => canonicalContentHash(document);
export const declarativeProductResourceRevisionHash = (
  registration: DeclarativeProductResourceRegistration,
): string => canonicalContentHash(registration.document);
const designCapabilityCatalogHashSource = (input: {
  sourceRef: string;
  entries: readonly DesignCapabilityCatalogEntry[];
}) => ({
  contract: "DesignCapabilityCatalogArtifact" as const,
  schemaVersion: 1 as const,
  sourceRef: input.sourceRef,
  entries: input.entries,
});
export const designCapabilityCatalogArtifactHash = (input: {
  sourceRef: string;
  entries: readonly DesignCapabilityCatalogEntry[];
}): string => canonicalContentHash(designCapabilityCatalogHashSource(input));
export const compileDesignCapabilityCatalogArtifact = (input: {
  sourceRef: string;
  revision: number;
  entries: readonly DesignCapabilityCatalogEntry[];
}): DesignCapabilityCatalogArtifact => {
  const entries = input.entries
    .map((entry) => ({ ...entry }))
    .sort((left, right) => left.manifest.id.localeCompare(right.manifest.id));
  entries.forEach((entry, index) => {
    const registration = entry.declarativeRegistration;
    const {
      registrationRevisionRef: _registrationRevisionRef,
      sourceContentHash: _sourceContentHash,
      ...unsignedRegistration
    } = registration;
    const registrationHash = canonicalContentHash(unsignedRegistration);
    if (
      registration.capabilityRevisionRef.id !== entry.manifest.id ||
      registration.capabilityRevisionRef.ownerRepo !==
        entry.manifest.ownerRepo ||
      String(registration.capabilityRevisionRef.revision) !==
        String(entry.manifest.capabilityVersion) ||
      registration.capabilityRevisionRef.contentHash !==
        canonicalContentHash(entry.manifest) ||
      registration.providerRevisionRef.id !== entry.provider.providerId ||
      registration.providerRevisionRef.ownerRepo !== entry.provider.ownerRepo ||
      String(registration.providerRevisionRef.revision) !==
        String(entry.provider.providerVersion) ||
      registration.providerRevisionRef.contentHash !==
        canonicalContentHash(entry.provider) ||
      registration.sourceContentHash !== registrationHash ||
      registration.registrationRevisionRef.contentHash !== registrationHash
    ) {
      throw new DeclarativeControlCompilationError(
        "DESIGN_CATALOG_INVALID",
        `entries[${index}]`,
        "Design capability manifest, provider and authoring registration are not exact.",
      );
    }
    registration.schemaDocuments.forEach((schema, schemaIndex) => {
      if (
        schema.schemaRevisionRef.ownerRepo !== "monkeys-design" ||
        schema.schemaRevisionRef.visibility !== "global" ||
        schema.schemaRevisionRef.contentHash !==
          canonicalContentHash(schema.document)
      ) {
        throw new DeclarativeControlCompilationError(
          "DESIGN_CATALOG_INVALID",
          `entries[${index}].declarativeRegistration.schemaDocuments[${schemaIndex}]`,
          "Design Schema documents require exact global monkeys-design authority.",
        );
      }
    });
  });
  const sourceContentHash = designCapabilityCatalogArtifactHash({
    sourceRef: input.sourceRef,
    entries,
  });
  const sourceRevisionRef = RevisionRefSchema.parse({
    kind: "design-capability-catalog",
    id: input.sourceRef,
    ownerRepo: "monkeys-design",
    visibility: "global",
    revision: input.revision,
    schemaVersion: 1,
    contentHash: sourceContentHash,
  });
  return deepFreeze(
    DesignCapabilityCatalogArtifactSchema.parse({
      contract: "DesignCapabilityCatalogArtifact",
      schemaVersion: 1,
      sourceRef: input.sourceRef,
      sourceRevisionRef,
      entries,
      sourceContentHash,
    }),
  );
};
/** Validate immutable product-owned capability provenance from an application release. */
export const parseExactProductDeclarativeCapabilityRegistration = (
  input: unknown,
): ProductDeclarativeCapabilityRegistration => {
  const entry = ProductDeclarativeCapabilityRegistrationSchema.parse(input);
  const registration = entry.declarativeRegistration;
  const {
    registrationRevisionRef: _registrationRevisionRef,
    sourceContentHash: _sourceContentHash,
    ...unsignedRegistration
  } = registration;
  if (
    registration.capabilityRevisionRef.contentHash !==
      canonicalContentHash(entry.manifest) ||
    registration.providerRevisionRef.contentHash !==
      canonicalContentHash(entry.provider) ||
    registration.sourceContentHash !==
      canonicalContentHash(unsignedRegistration) ||
    registration.registrationRevisionRef.contentHash !==
      registration.sourceContentHash
  ) {
    throw new DeclarativeControlCompilationError(
      "PRODUCT_CAPABILITY_CATALOG_INVALID",
      "declarativeRegistration",
      "Product capability manifest, provider and authoring registration are not exact.",
    );
  }
  registration.schemaDocuments.forEach((schema, schemaIndex) => {
    if (
      schema.schemaRevisionRef.contentHash !==
      canonicalContentHash(schema.document)
    ) {
      throw new DeclarativeControlCompilationError(
        "PRODUCT_CAPABILITY_CATALOG_INVALID",
        `declarativeRegistration.schemaDocuments[${schemaIndex}]`,
        "Product capability Schema document does not match its exact RevisionRef.",
      );
    }
  });
  return deepFreeze(entry);
};
export const parseExactDesignCapabilityCatalogArtifact = (
  input: unknown,
): DesignCapabilityCatalogArtifact => {
  const parsed = DesignCapabilityCatalogArtifactSchema.parse(input);
  const expected = compileDesignCapabilityCatalogArtifact({
    sourceRef: parsed.sourceRef,
    revision: parsed.sourceRevisionRef.revision,
    entries: parsed.entries,
  });
  if (
    parsed.sourceContentHash !== expected.sourceContentHash ||
    !sameRevisionRef(parsed.sourceRevisionRef, expected.sourceRevisionRef)
  ) {
    throw new DeclarativeControlCompilationError(
      "DESIGN_CATALOG_INVALID",
      "sourceRevisionRef",
      "Design capability catalog artifact provenance or content hash is not exact.",
    );
  }
  return deepFreeze(parsed);
};
const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.values(value as Record<string, unknown>).forEach((child) =>
    deepFreeze(child),
  );
  return Object.freeze(value);
};
const assertTenantCompatible = (
  reference: StableRef,
  scope: TenantScope,
  path: string,
) => {
  if (
    reference.visibility === "tenant" &&
    scopeKey(reference.tenantScope as TenantScope) !== scopeKey(scope)
  ) {
    throw new DeclarativeControlCompilationError(
      "CROSS_TENANT_REFERENCE",
      path,
      `Reference ${reference.kind}/${reference.id} belongs to another tenant scope.`,
    );
  }
};
const assertSameTenantScope = (
  candidate: TenantScope,
  expected: TenantScope,
  path: string,
) => {
  if (scopeKey(candidate) !== scopeKey(expected)) {
    throw new DeclarativeControlCompilationError(
      "CROSS_TENANT_REFERENCE",
      path,
      "Record and release tenant scopes do not match.",
    );
  }
};
const stableFromRevision = (reference: RevisionRef): StableRef =>
  StableRefSchema.parse({
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
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      path,
      `Expected ${expectedKind}/${expectedId}, received ${reference.kind}/${reference.id}.`,
    );
  }
  assertTenantCompatible(reference, scope, path);
};
const dependencyKey = (
  role: ReleaseDependency["role"],
  reference: RevisionRef,
) => `${role}:${revisionRefKey(reference)}`;
const requireDependencies = (
  snapshot: readonly ReleaseDependency[],
  required: readonly ReleaseDependency[],
) => {
  const available = new Set(
    snapshot.map((dependency) =>
      dependencyKey(dependency.role, dependency.revisionRef),
    ),
  );
  for (const dependency of required) {
    const key = dependencyKey(dependency.role, dependency.revisionRef);
    if (!available.has(key)) {
      throw new DeclarativeControlCompilationError(
        "DEPENDENCY_MISSING",
        "dependencySnapshot",
        `Missing exact ${dependency.role} dependency ${revisionRefKey(dependency.revisionRef)}.`,
      );
    }
  }
};
const assertDependencyScopes = (
  snapshot: readonly ReleaseDependency[],
  scope: TenantScope,
) =>
  snapshot.forEach((dependency, index) =>
    assertTenantCompatible(
      dependency.revisionRef,
      scope,
      `dependencySnapshot[${index}].revisionRef`,
    ),
  );
const requireReleaseReady = (
  release: PageRelease | WorkbenchRelease | NavigationRelease,
) => {
  if (release.operation === "deactivate") {
    throw new DeclarativeControlCompilationError(
      "RELEASE_OPERATION_INVALID",
      "operation",
      "A deactivation Release cannot produce an active runtime bundle.",
    );
  }
  if (release.evidence.validation.result !== "pass") {
    throw new DeclarativeControlCompilationError(
      "RELEASE_VALIDATION_FAILED",
      "evidence.validation.result",
      "Runtime bundles require a passing release validation result.",
    );
  }
};
const refSet = (values: readonly StableRef[]) =>
  new Set(values.map(stableRefKey));
const chainRequiresAll = (
  policies: readonly AccessPolicy[],
  field: "permissionAllOf" | "groupAllOf" | "conditionAllOf",
): ReadonlySet<string> => {
  if (field === "permissionAllOf") {
    return new Set(
      policies.flatMap((policy) => [
        ...policy.permissionAllOf,
        ...(policy.permissionAnyOf.length === 1 ? policy.permissionAnyOf : []),
      ]),
    );
  }
  if (field === "groupAllOf") {
    return refSet(
      policies.flatMap((policy) => [
        ...policy.groupAllOf,
        ...(policy.groupAnyOf.length === 1 ? policy.groupAnyOf : []),
      ]),
    );
  }
  return new Set(
    policies.flatMap((policy) => policy.conditionAllOf.map(revisionRefKey)),
  );
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
  const policies = policyInputs.map((policy) =>
    AccessPolicySchema.parse(policy),
  );
  const target = AccessPolicySchema.parse(targetInput);
  if (target.authenticated && !policies.some((policy) => policy.authenticated))
    return false;
  const permissionAll = chainRequiresAll(policies, "permissionAllOf");
  if (
    target.permissionAllOf.some((permission) => !permissionAll.has(permission))
  )
    return false;
  if (
    !chainImpliesAny(
      policies,
      new Set(target.permissionAnyOf),
      permissionAll,
      (policy) => policy.permissionAnyOf,
    )
  )
    return false;
  const groupAll = chainRequiresAll(policies, "groupAllOf");
  if (target.groupAllOf.some((group) => !groupAll.has(stableRefKey(group))))
    return false;
  if (
    !chainImpliesAny(policies, refSet(target.groupAnyOf), groupAll, (policy) =>
      policy.groupAnyOf.map(stableRefKey),
    )
  )
    return false;
  const conditionAll = chainRequiresAll(policies, "conditionAllOf");
  if (
    target.conditionAllOf.some(
      (condition) => !conditionAll.has(revisionRefKey(condition)),
    )
  )
    return false;
  return true;
};
const normalizePath = (path: string, routeSpace: RouteSpace): string => {
  let normalized = path;
  if (!routeSpace.caseSensitive) {
    normalized = normalized
      .split("/")
      .map((segment) =>
        segment.startsWith(":") ? segment : segment.toLowerCase(),
      )
      .join("/");
  }
  if (routeSpace.trailingSlash === "remove" && normalized.length > 1)
    normalized = normalized.replace(/\/+$/, "");
  if (
    routeSpace.trailingSlash === "require" &&
    normalized.length > 1 &&
    !normalized.endsWith("/")
  )
    normalized += "/";
  return normalized;
};
const acceptedTrailingSlashStates = (
  claim: Pick<CompiledRouteClaim, "normalizedPath" | "matcher">,
): ReadonlySet<boolean> => {
  if (claim.matcher.trailingSlash === "remove") return new Set([false, true]);
  if (claim.matcher.trailingSlash === "require") return new Set([true]);
  return new Set([
    claim.normalizedPath.length > 1 && claim.normalizedPath.endsWith("/"),
  ]);
};
const routeSegmentParameter = (segment: string) =>
  segment.match(/^[:$]([A-Za-z][A-Za-z0-9_-]*)$/)?.[1];
const parameterTypeFor = (
  claim: Pick<CompiledRouteClaim, "matcher">,
  name: string,
) =>
  claim.matcher.parameters.find((parameter) => parameter.name === name)?.type;
export const compiledRouteClaimsOverlap = (
  leftInput: CompiledRouteClaim,
  rightInput: CompiledRouteClaim,
): boolean => {
  const left = CompiledRouteClaimSchema.parse(leftInput);
  const right = CompiledRouteClaimSchema.parse(rightInput);
  if (
    ![...acceptedTrailingSlashStates(left)].some((state) =>
      acceptedTrailingSlashStates(right).has(state),
    )
  )
    return false;
  const leftSegments = left.normalizedPath.split("/").filter(Boolean);
  const rightSegments = right.normalizedPath.split("/").filter(Boolean);
  if (leftSegments.length !== rightSegments.length) return false;
  return leftSegments.every((leftSegment, index) => {
    const rightSegment = rightSegments[index];
    const leftParameter = routeSegmentParameter(leftSegment);
    const rightParameter = routeSegmentParameter(rightSegment);
    if (!leftParameter && !rightParameter) {
      if (left.matcher.caseSensitive && right.matcher.caseSensitive)
        return leftSegment === rightSegment;
      return leftSegment.toLowerCase() === rightSegment.toLowerCase();
    }
    if (leftParameter && !rightParameter) {
      const type = parameterTypeFor(left, leftParameter);
      return !!type && routeParameterPattern(type).test(rightSegment);
    }
    if (!leftParameter && rightParameter) {
      const type = parameterTypeFor(right, rightParameter);
      return !!type && routeParameterPattern(type).test(leftSegment);
    }
    const leftType = parameterTypeFor(left, leftParameter!);
    const rightType = parameterTypeFor(right, rightParameter!);
    if (!leftType || !rightType) return false;
    return (
      !(leftType === "integer" && rightType === "uuid") &&
      !(leftType === "uuid" && rightType === "integer")
    );
  });
};
export const compileRouteClaims = (
  input: CompileRouteClaimsInput,
): readonly CompiledRouteClaim[] => {
  const embeddedTakeovers = input.claims.flatMap((claim) => {
    const authorization =
      "legacyRouteTakeoverAuthorization" in claim
        ? claim.legacyRouteTakeoverAuthorization
        : undefined;
    return authorization ? [authorization] : [];
  });
  const takeoverAuthorizations = [
    ...(input.legacyRouteTakeoverAuthorizations ?? []),
    ...embeddedTakeovers,
  ].map((authorization, index) => {
    try {
      return parseExactLegacyRouteTakeoverAuthorization(authorization);
    } catch (error) {
      if (error instanceof DeclarativeControlCompilationError) {
        throw new DeclarativeControlCompilationError(
          error.code,
          `legacyRouteTakeoverAuthorizations[${index}].${error.path}`,
          error.message,
        );
      }
      throw error;
    }
  });
  const registrations = input.routeSpaces.map((entry, index) => {
    const revisionRef = RevisionRefSchema.parse(entry.revisionRef);
    const routeSpace = RouteSpaceSchema.parse(entry.routeSpace);
    if (
      revisionRef.kind !== "route-space" ||
      revisionRef.id !== routeSpace.routeSpaceId
    ) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `routeSpaces[${index}]`,
        "RouteSpace registration identity does not match its pinned revision.",
      );
    }
    return { revisionRef, routeSpace };
  });
  assertUniqueRegistryKeys(
    registrations.map((entry) => revisionRefKey(entry.revisionRef)),
    "routeSpaces",
  );
  const routeSpacesByRevision = new Map(
    registrations.map((entry) => [
      revisionRefKey(entry.revisionRef),
      entry.routeSpace,
    ]),
  );
  const compiled: CompiledRouteClaim[] = [];
  input.claims.forEach((inputClaim, index) => {
    const {
      legacyRouteTakeoverAuthorization: _authorization,
      ...runtimeClaim
    } = inputClaim as DeclarativeRouteClaim;
    const legacyClaim =
      "surface" in runtimeClaim
        ? RouteClaimSchema.parse(runtimeClaim)
        : LegacyRouteClaimSchema.parse(runtimeClaim);
    const routeSpace = routeSpacesByRevision.get(
      revisionRefKey(legacyClaim.routeSpaceRevisionRef),
    );
    if (!routeSpace)
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISSING",
        `routeClaims[${index}].routeSpaceRevisionRef`,
        "No exact RouteSpace registration exists.",
      );
    const claim = RouteClaimSchema.parse({
      ...legacyClaim,
      surface:
        "surface" in legacyClaim
          ? legacyClaim.surface
          : routeSpace.supportedSurface,
    });
    if (routeSpace.supportedSurface !== claim.surface) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `routeClaims[${index}].surface`,
        `Route claim surface ${claim.surface} does not match RouteSpace ${routeSpace.routeSpaceId}.`,
      );
    }
    if (claim.surface !== input.surface) return;
    const normalizedPath = normalizePath(claim.pathTemplate, routeSpace);
    const knownParameters = new Set(
      routeSpace.parameters.map((parameter) => parameter.name),
    );
    const pathParameters = [
      ...normalizedPath.matchAll(/:([A-Za-z][A-Za-z0-9_-]*)/g),
    ].map((match) => match[1]);
    if (new Set(pathParameters).size !== pathParameters.length) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `routeClaims[${index}].pathTemplate`,
        "Route parameters must be unique within a path.",
      );
    }
    const unknownParameter = pathParameters.find(
      (parameter) => !knownParameters.has(parameter),
    );
    if (unknownParameter) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `routeClaims[${index}].pathTemplate`,
        `Route parameter ${unknownParameter} is not declared by ${routeSpace.routeSpaceId}.`,
      );
    }
    const matcher = {
      surface: claim.surface,
      caseSensitive: routeSpace.caseSensitive,
      trailingSlash: routeSpace.trailingSlash,
      parameters: routeSpace.parameters,
    };
    const compiledClaim = CompiledRouteClaimSchema.parse({
      ...claim,
      normalizedPath,
      matcher,
    });
    const reserved = routeSpace.reservedPaths.some((candidate) => {
      const normalizedReserved = normalizePath(candidate, routeSpace);
      const reservedClaim = CompiledRouteClaimSchema.parse({
        kind: "canonical",
        routeSpaceRevisionRef: claim.routeSpaceRevisionRef,
        pathTemplate: candidate,
        surface: claim.surface,
        normalizedPath: normalizedReserved,
        matcher,
      });
      return (
        compiledRouteClaimsOverlap(compiledClaim, reservedClaim) ||
        normalizedPath.startsWith(`${normalizedReserved.replace(/\/+$/, "")}/`)
      );
    });
    if (reserved) {
      const takeover = takeoverAuthorizations.find(
        (authorization) =>
          compiledClaim.kind === "canonical" &&
          authorization.normalizedPath === compiledClaim.normalizedPath &&
          sameRevisionRef(
            authorization.routeSpaceRevisionRef,
            compiledClaim.routeSpaceRevisionRef,
          ),
      );
      if (!takeover) {
        throw new DeclarativeControlCompilationError(
          "ROUTE_RESERVED",
          `routeClaims[${index}].pathTemplate`,
          `Route ${normalizedPath} is reserved by ${routeSpace.routeSpaceId}.`,
        );
      }
    }
    const conflict = compiled.find(
      (candidate) =>
        sameRevisionRef(
          candidate.routeSpaceRevisionRef,
          claim.routeSpaceRevisionRef,
        ) && compiledRouteClaimsOverlap(candidate, compiledClaim),
    );
    if (conflict)
      throw new DeclarativeControlCompilationError(
        "ROUTE_CONFLICT",
        `routeClaims[${index}].pathTemplate`,
        `Route ${normalizedPath} overlaps another active claim pattern.`,
      );
    compiled.push(compiledClaim);
  });
  if (!compiled.some((claim) => claim.kind === "canonical")) {
    throw new DeclarativeControlCompilationError(
      "ROUTE_CONFLICT",
      "routeClaims",
      "At least one canonical route claim is required.",
    );
  }
  return Object.freeze(compiled);
};
export type CompiledRouteMatch = {
  matched: boolean;
  normalizedPath?: string;
  parameters: Readonly<Record<string, string>>;
};
/**
 * Matches an application-relative request path using only the policy frozen into
 * a CompiledRouteClaim. Runtime consumers must not reconstruct RouteSpace policy
 * from product ids or deployment configuration.
 */
export const matchCompiledRouteClaim = (
  claimInput: CompiledRouteClaim,
  pathInput: string,
): CompiledRouteMatch => {
  const claim = CompiledRouteClaimSchema.parse(claimInput);
  const rawPath = String(pathInput || "").trim();
  if (
    !rawPath.startsWith("/") ||
    rawPath.includes("?") ||
    rawPath.includes("#") ||
    rawPath.includes("\\") ||
    rawPath.includes("://")
  ) {
    return { matched: false, parameters: {} };
  }
  const rawSegments = rawPath.split("/");
  if (rawSegments.some((segment) => segment === "." || segment === ".."))
    return { matched: false, parameters: {} };
  const requestHasTrailingSlash = rawPath.length > 1 && rawPath.endsWith("/");
  if (claim.matcher.trailingSlash === "require" && !requestHasTrailingSlash)
    return { matched: false, parameters: {} };
  if (
    claim.matcher.trailingSlash === "preserve" &&
    requestHasTrailingSlash !==
      (claim.normalizedPath.length > 1 && claim.normalizedPath.endsWith("/"))
  ) {
    return { matched: false, parameters: {} };
  }
  const normalizeTrailing = (value: string) => {
    if (claim.matcher.trailingSlash === "remove" && value.length > 1)
      return value.replace(/\/+$/, "");
    if (
      claim.matcher.trailingSlash === "require" &&
      value.length > 1 &&
      !value.endsWith("/")
    )
      return `${value}/`;
    return value;
  };
  const requestPath = normalizeTrailing(rawPath);
  const templatePath = normalizeTrailing(claim.normalizedPath);
  const requestSegments = requestPath.split("/").filter(Boolean);
  const templateSegments = templatePath.split("/").filter(Boolean);
  if (requestSegments.length !== templateSegments.length)
    return { matched: false, parameters: {} };
  const parameterDefinitions = new Map(
    claim.matcher.parameters.map((parameter) => [parameter.name, parameter]),
  );
  const parameters: Record<string, string> = {};
  const normalizedSegments: string[] = [];
  for (let index = 0; index < templateSegments.length; index += 1) {
    const template = templateSegments[index];
    const rawValue = requestSegments[index];
    const match = template.match(/^[:$]([A-Za-z][A-Za-z0-9_-]*)$/);
    if (!match) {
      if (
        (claim.matcher.caseSensitive ? template : template.toLowerCase()) !==
        (claim.matcher.caseSensitive ? rawValue : rawValue.toLowerCase())
      ) {
        return { matched: false, parameters: {} };
      }
      normalizedSegments.push(template);
      continue;
    }
    const definition = parameterDefinitions.get(match[1]);
    let value: string;
    try {
      value = decodeURIComponent(rawValue);
    } catch {
      return { matched: false, parameters: {} };
    }
    if (!definition || !routeParameterPattern(definition.type).test(value))
      return { matched: false, parameters: {} };
    parameters[definition.name] = value;
    normalizedSegments.push(rawValue);
  }
  const canonicalPath = normalizeTrailing(
    `/${normalizedSegments.join("/")}` || "/",
  );
  return {
    matched: true,
    normalizedPath: canonicalPath,
    parameters: Object.freeze(parameters),
  };
};
function routeParameterPattern(
  type: RouteSpace["parameters"][number]["type"],
): RegExp {
  if (type === "integer") return /^-?\d+$/;
  if (type === "uuid")
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (type === "slug") return /^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
}
/**
 * Materializes the browser URL owned by a RouteSpace from an application-relative
 * compiled route. Declarations and runtime resolution remain application-relative;
 * only this boundary applies product bases such as /:teamId or /kernel.
 */
export const materializeRouteSpacePath = (
  input: MaterializeRouteSpacePathInput,
): string => {
  const routeSpace = RouteSpaceSchema.parse(input.routeSpace);
  const applicationPath = RoutePathTemplateSchema.parse(input.applicationPath);
  const basePath =
    routeSpace.basePath === "/" ? "" : routeSpace.basePath.replace(/\/+$/, "");
  let browserTemplate = normalizePath(
    `${basePath}${applicationPath === "/" ? "/" : applicationPath}` || "/",
    routeSpace,
  );
  const parameters = input.parameters || {};
  const declared = new Map(
    routeSpace.parameters.map((parameter) => [parameter.name, parameter]),
  );
  const referenced = [
    ...browserTemplate.matchAll(/:([A-Za-z][A-Za-z0-9_-]*)/g),
  ].map((match) => match[1]);
  for (const name of referenced) {
    const definition = declared.get(name);
    const raw = parameters[name];
    if (
      !definition ||
      raw === undefined ||
      raw === null ||
      String(raw).trim() === ""
    ) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        "parameters",
        `Route parameter ${name} is not resolved by ${routeSpace.routeSpaceId}.`,
      );
    }
    const value = String(raw);
    if (!routeParameterPattern(definition.type).test(value)) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `parameters.${name}`,
        `Route parameter ${name} does not satisfy ${definition.type}.`,
      );
    }
    browserTemplate = browserTemplate.replace(
      `:${name}`,
      encodeURIComponent(value),
    );
  }
  const unknown = Object.keys(parameters).find((name) => !declared.has(name));
  if (unknown)
    throw new DeclarativeControlCompilationError(
      "ROUTE_SPACE_MISMATCH",
      `parameters.${unknown}`,
      `RouteSpace ${routeSpace.routeSpaceId} does not declare ${unknown}.`,
    );
  return browserTemplate;
};
const renderTreeDepth = (tree: RenderTree): number => {
  const byId = new Map(tree.nodes.map((node) => [node.nodeId, node]));
  let maximum = 0;
  tree.nodes.forEach((node) => {
    let depth = 1;
    let parentId = node.parentNodeId;
    const ancestors = new Set([node.nodeId]);
    while (parentId) {
      if (ancestors.has(parentId)) {
        throw new DeclarativeControlCompilationError(
          "RENDER_TREE_INVALID",
          "page.renderTree.nodes",
          `RenderTree contains a parent cycle at ${parentId}.`,
        );
      }
      ancestors.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentNodeId;
    }
    maximum = Math.max(maximum, depth);
  });
  return maximum;
};
const compareLegacyEntityRef = (
  reference: {
    kind: string;
    id: string;
    version?: number | string;
    ownerRepo?: string;
  },
  revision: RevisionRef,
) =>
  reference.kind === revision.kind &&
  reference.id === revision.id &&
  String(reference.version) === String(revision.revision) &&
  reference.ownerRepo === revision.ownerRepo;
const pageDependencies = (
  page: ResolvedPage,
  compilerRevisionRef: RevisionRef,
): ReleaseDependency[] => [
  ...page.routeClaims.map((claim) => ({
    role: "route-space" as const,
    revisionRef: claim.routeSpaceRevisionRef,
  })),
  { role: "shell", revisionRef: page.shellRevisionRef },
  ...page.capabilityInstances.flatMap((instance) => [
    {
      role: "capability" as const,
      revisionRef: instance.capabilityRevisionRef,
    },
    { role: "provider" as const, revisionRef: instance.providerRevisionRef },
    ...(instance.eventEffects ?? []).map((effect) => ({
      role: "schema" as const,
      revisionRef: effect.sourceIntentSchemaRevisionRef,
    })),
    {
      role: "schema" as const,
      revisionRef: instance.propertySchemaRevisionRef,
    },
  ]),
  ...(page.stateDefinitions ?? []).map((state) => ({
    role: "schema" as const,
    revisionRef: state.schemaRevisionRef,
  })),
  ...(page.interactionBindings ?? []).map((binding) => ({
    role: "schema" as const,
    revisionRef: binding.sourceIntentSchemaRevisionRef,
  })),
  ...page.ontologyBindings.flatMap((binding) => [
    {
      role: "ontology-definition" as const,
      revisionRef: binding.ontologyDefinitionRevisionRef,
    },
    ...(binding.viewRevisionRef
      ? [{ role: "view" as const, revisionRef: binding.viewRevisionRef }]
      : []),
    ...("projectionRevisionRef" in binding && binding.projectionRevisionRef
      ? [
          {
            role: "projection-spec" as const,
            revisionRef: binding.projectionRevisionRef,
          },
        ]
      : []),
    ...(binding.canonicalDataViewRevisionRef
      ? [
          {
            role: "view" as const,
            revisionRef: binding.canonicalDataViewRevisionRef,
          },
        ]
      : []),
    {
      role: "schema" as const,
      revisionRef: binding.renderModelSchemaRevisionRef,
    },
    ...(binding.cursorWindow
      ? [
          {
            role: "schema" as const,
            revisionRef: binding.cursorWindow.pageChangeIntentSchemaRevisionRef,
          },
        ]
      : []),
  ]),
  ...(page.queryBindings ?? []).flatMap((binding) => [
    {
      role: "query-definition" as const,
      revisionRef: binding.queryDefinitionRevisionRef,
    },
    {
      role: "schema" as const,
      revisionRef: binding.renderModelSchemaRevisionRef,
    },
    ...(binding.targetProjection
      ? [
          {
            role: "schema" as const,
            revisionRef: binding.targetProjection.schemaRevisionRef,
          },
        ]
      : []),
    ...(binding.streamTargetProjection
      ? [
          {
            role: "schema" as const,
            revisionRef: binding.streamTargetProjection.schemaRevisionRef,
          },
        ]
      : []),
    ...(binding.cursorWindow
      ? [
          {
            role: "schema" as const,
            revisionRef: binding.cursorWindow.pageChangeIntentSchemaRevisionRef,
          },
        ]
      : []),
  ]),
  ...page.actionBindings.flatMap((binding) => [
    { role: "action" as const, revisionRef: binding.commandRevisionRef },
    {
      role: "schema" as const,
      revisionRef: binding.sourceIntentSchemaRevisionRef,
    },
    { role: "schema" as const, revisionRef: binding.inputSchemaRevisionRef },
    { role: "schema" as const, revisionRef: binding.resultSchemaRevisionRef },
    ...(binding.compensationCommandRevisionRef
      ? [
          {
            role: "action" as const,
            revisionRef: binding.compensationCommandRevisionRef,
          },
        ]
      : []),
  ]),
  ...page.tokenRevisionRefs.map((revisionRef) => ({
    role: "token" as const,
    revisionRef,
  })),
  { role: "performance-budget", revisionRef: page.performanceBudgetRef },
  {
    role: "observation-policy",
    revisionRef: page.observationPolicyRevisionRef,
  },
  { role: "compiler", revisionRef: compilerRevisionRef },
];
const domainQueryDependencies = (
  definition: DomainQueryDefinition,
): ReleaseDependency[] => [
  ...(definition.ontologyDefinitionRevisionRef
    ? [
        {
          role: "ontology-definition" as const,
          revisionRef: definition.ontologyDefinitionRevisionRef,
        },
      ]
    : []),
  ...(definition.viewRevisionRef
    ? [{ role: "view" as const, revisionRef: definition.viewRevisionRef }]
    : []),
  ...(definition.canonicalDataViewRevisionRef
    ? [
        {
          role: "view" as const,
          revisionRef: definition.canonicalDataViewRevisionRef,
        },
      ]
    : []),
  { role: "schema", revisionRef: definition.inputSchemaRevisionRef },
  { role: "schema", revisionRef: definition.resultSchemaRevisionRef },
];
const singleByStableIdentity = <T extends { revisionRef: RevisionRef }>(
  registrations: readonly T[],
  kind: string,
  id: string,
  path: string,
): T => {
  const matches = registrations.filter(
    ({ revisionRef }) => revisionRef.kind === kind && revisionRef.id === id,
  );
  if (matches.length !== 1) {
    throw new DeclarativeControlCompilationError(
      "DEPENDENCY_MISSING",
      path,
      `Expected exactly one active ${kind} registration for ${id}; found ${matches.length}.`,
    );
  }
  return matches[0]!;
};
const usesResultValue = (
  mapping: Readonly<Record<string, { kind: string; expression?: unknown }>>,
): boolean =>
  Object.values(mapping).some(
    (source) =>
      source.kind === "result-field" ||
      (source.kind === "expression" &&
        source.expression !== undefined &&
        collectPageExpressionReads(
          source.expression as Parameters<typeof collectPageExpressionReads>[0],
        ).some((read) => read.root === "result")),
  );
const simpleEntityRef = (revisionRef: RevisionRef) => ({
  kind: revisionRef.kind,
  id: revisionRef.id,
  version: revisionRef.revision,
  ownerRepo: revisionRef.ownerRepo,
});
const defaultRenderSurface = {
  frameOwner: "host" as const,
  density: "default" as const,
};
const defaultRenderScroll = {
  owner: "surface" as const,
  axis: "none" as const,
  virtualizationBoundary: false,
};
const defaultRenderLifecycle = {
  mountPolicy: "always" as const,
  queryPolicy: "always" as const,
  retainOnDeactivate: false,
  deepLink: false,
  focusReturn: false,
};

export const resolvePage = (input: ResolvePageInput): ResolvedPage => {
  const page = PageSchema.parse(input.page);
  const defaults = {
    routeSpace: RevisionRefSchema.parse(input.defaults.routeSpace),
    shell: RevisionRefSchema.parse(input.defaults.shell),
    tokens: input.defaults.tokens.map((reference) =>
      RevisionRefSchema.parse(reference),
    ),
    performanceBudget: RevisionRefSchema.parse(
      input.defaults.performanceBudget,
    ),
    observationPolicy: RevisionRefSchema.parse(
      input.defaults.observationPolicy,
    ),
  };
  const resourceRegistrations = (input.productResources ?? []).map(
    (registration) => ({
      revisionRef: RevisionRefSchema.parse(registration.resourceRevisionRef),
      registration:
        DeclarativeProductResourceRegistrationSchema.parse(registration),
    }),
  );
  const resolveResource = (
    kind: DeclarativeProductResourceRegistration["resourceKind"],
    id: string | undefined,
    fallback: RevisionRef,
    path: string,
  ): RevisionRef => {
    const targetId = id ?? fallback.id;
    if (resourceRegistrations.length === 0) {
      if (targetId !== fallback.id || fallback.kind !== kind) {
        throw new DeclarativeControlCompilationError(
          "DEPENDENCY_MISSING",
          path,
          `No ${kind} registry was supplied for ${targetId}.`,
        );
      }
      return fallback;
    }
    return singleByStableIdentity(resourceRegistrations, kind, targetId, path)
      .revisionRef;
  };
  const routeSpaceId = page.routeSpace ?? defaults.routeSpace.id;
  const routeRegistrations = (input.routeSpaces ?? []).map((registration) => ({
    revisionRef: RevisionRefSchema.parse(registration.revisionRef),
    routeSpace: registration.routeSpace,
  }));
  const routeSpaceRevisionRef =
    routeRegistrations.length === 0
      ? (() => {
          if (routeSpaceId !== defaults.routeSpace.id) {
            throw new DeclarativeControlCompilationError(
              "ROUTE_SPACE_MISSING",
              "page.routeSpace",
              `No RouteSpace registry was supplied for ${routeSpaceId}.`,
            );
          }
          return defaults.routeSpace;
        })()
      : singleByStableIdentity(
          routeRegistrations,
          "route-space",
          routeSpaceId,
          "page.routeSpace",
        ).revisionRef;
  const shellRevisionRef = resolveResource(
    "shell",
    page.shell,
    defaults.shell,
    "page.shell",
  );
  const tokenRevisionRefs = page.tokens?.map((id, index) =>
    resolveResource(
      "design-token",
      id,
      defaults.tokens[0]!,
      `page.tokens[${index}]`,
    ),
  ) ?? [...defaults.tokens];
  const performanceBudgetRef = resolveResource(
    "performance-budget",
    page.performanceBudget,
    defaults.performanceBudget,
    "page.performanceBudget",
  );
  const observationPolicyRevisionRef = resolveResource(
    "observation-policy",
    page.observationPolicy,
    defaults.observationPolicy,
    "page.observationPolicy",
  );
  const capabilityRegistrations = input.capabilityRegistry.map(
    (registration) => ({
      ...registration,
      revisionRef: RevisionRefSchema.parse(registration.capabilityRevisionRef),
      providerRevisionRef: RevisionRefSchema.parse(
        registration.providerRevisionRef,
      ),
      propertySchemaRevisionRef: RevisionRefSchema.parse(
        registration.propertySchemaRevisionRef,
      ),
      inputPorts: registration.inputPorts.map((port) => ({
        ...port,
        schemaRevisionRef: RevisionRefSchema.parse(port.schemaRevisionRef),
      })),
      outputPorts: registration.outputPorts.map((port) => ({
        ...port,
        schemaRevisionRef: RevisionRefSchema.parse(port.schemaRevisionRef),
      })),
    }),
  );
  const queryRegistrations = (input.domainQueryRegistry ?? []).map(
    (registration) => ({
      revisionRef: RevisionRefSchema.parse(registration.definitionRevisionRef),
      definition: DomainQueryDefinitionSchema.parse(registration.definition),
    }),
  );
  const commandRegistrations = (input.domainCommandRegistry ?? []).map(
    (registration) => ({
      revisionRef: RevisionRefSchema.parse(registration.definitionRevisionRef),
      definition: registration.definition,
    }),
  );
  const schemaRegistrations = (input.schemaRegistry ?? []).map(
    (registration) => ({
      revisionRef: RevisionRefSchema.parse(registration.definitionRevisionRef),
      definition: registration.definition,
    }),
  );
  const stateSchemaById = new Map(
    schemaRegistrations.map((registration) => [
      registration.definition.schemaId,
      registration.revisionRef,
    ]),
  );
  const stateDefinitions = (page.state ?? []).map(
    ({ schema, ...state }, index) => {
      const schemaRevisionRef = stateSchemaById.get(schema);
      if (!schemaRevisionRef) {
        throw new DeclarativeControlCompilationError(
          "SCHEMA_DEFINITION_MISMATCH",
          `page.state[${index}].schema`,
          `No active Schema registration exists for ${schema}.`,
        );
      }
      return { ...state, schemaRevisionRef };
    },
  );
  const stateSchemasByStateId = new Map(
    stateDefinitions.map((definition) => [
      definition.stateId,
      definition.schemaRevisionRef,
    ]),
  );
  const renderNodes: RenderNode[] = [];
  const capabilityInstances: ResolvedPage["capabilityInstances"] = [];
  const queryBindings: NonNullable<ResolvedPage["queryBindings"]> = [];
  const actionBindings: ResolvedPage["actionBindings"] = [];
  const interactionBindings: NonNullable<ResolvedPage["interactionBindings"]> =
    [];
  const nodesById = new Map<string, Page["body"]>();
  const indexNode = (node: Page["body"]): void => {
    nodesById.set(node.id, node);
    node.children?.forEach(indexNode);
  };
  indexNode(page.body);
  const visitNode = (node: Page["body"], parentNodeId?: string): void => {
    const registration = singleByStableIdentity(
      capabilityRegistrations,
      "capability",
      node.component,
      `page.body.${node.id}.component`,
    );
    const children = node.children ?? [];
    const defaultActivation = {
      activationId: node.id,
      mode: "inline" as const,
    };
    renderNodes.push({
      contract: "RenderNode",
      nodeId: node.id,
      kind: node.kind ?? "view",
      version: 1,
      ownerRepo: registration.providerRevisionRef.ownerRepo,
      ...(parentNodeId ? { parentNodeId } : {}),
      children: children.map((child) => child.id),
      ...(node.slot ? { slot: node.slot } : {}),
      pageRef: {
        kind: "page",
        id: page.pageId,
        version: 1,
        ownerRepo: input.pageOwnerRepo,
      },
      capabilityRef: simpleEntityRef(registration.revisionRef),
      providerRef: simpleEntityRef(registration.providerRevisionRef),
      surface: node.surface ?? defaultRenderSurface,
      scroll: node.scroll ?? defaultRenderScroll,
      activation: node.activation ?? defaultActivation,
      lifecycle: node.lifecycle ?? defaultRenderLifecycle,
      layout: node.layout ?? { mode: "contents" },
      ...(node.style ? { style: node.style } : {}),
      responsive: node.responsive ?? [],
      state: node.state ?? "idle",
      renderModel: node.model ?? {},
      ...(node.repeat
        ? { repeat: { ...node.repeat, limit: node.repeat.limit ?? 200 } }
        : {}),
    });
    capabilityInstances.push({
      instanceId: node.id,
      nodeId: node.id,
      capabilityRevisionRef: registration.revisionRef,
      providerRevisionRef: registration.providerRevisionRef,
      propertySchemaRevisionRef: registration.propertySchemaRevisionRef,
      properties: node.props ?? {},
      ...(node.bindings ? { propertyBindings: node.bindings } : {}),
      ...(node.eventPayloads
        ? { eventPayloadBindings: node.eventPayloads }
        : {}),
      ...(node.effects
        ? {
            eventEffects: node.effects.map((effect, index) => {
              const port = registration.outputPorts.find(
                (candidate) => candidate.name === effect.port,
              );
              if (!port) {
                throw new DeclarativeControlCompilationError(
                  "PORT_TYPE_MISMATCH",
                  `page.body.${node.id}.effects[${index}].port`,
                  `No output port ${effect.port} exists on ${node.component}.`,
                );
              }
              return {
                sourcePort: effect.port,
                sourceIntentSchemaRevisionRef: port.schemaRevisionRef,
                refreshBindingIds: effect.refresh,
              };
            }),
          }
        : {}),
      ...(node.access ? { accessPolicy: node.access } : {}),
      ...(node.activeWhen ? { activationWhen: node.activeWhen } : {}),
      allowedSideEffects: [...registration.allowedSideEffects],
    });
    for (const [index, binding] of (node.data ?? []).entries()) {
      const queryRegistration = singleByStableIdentity(
        queryRegistrations,
        "domain-query-definition",
        binding.query,
        `page.body.${node.id}.data[${index}].query`,
      );
      const port = registration.inputPorts.find(
        (candidate) => candidate.name === binding.port,
      );
      if (!port) {
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `page.body.${node.id}.data[${index}].port`,
          `No input port ${binding.port} exists on ${node.component}.`,
        );
      }
      const {
        query,
        port: _port,
        targetProjection,
        streamTargetProjection,
        cursorWindow,
        resultStateBindings,
        ...rest
      } = binding;
      queryBindings.push({
        ...rest,
        queryDefinitionRevisionRef: queryRegistration.revisionRef,
        target: { capabilityInstanceId: node.id, port: binding.port },
        renderModelSchemaRevisionRef:
          queryRegistration.definition.resultSchemaRevisionRef,
        ...(targetProjection
          ? {
              targetProjection: {
                ...targetProjection,
                schemaRevisionRef: port.schemaRevisionRef,
              },
            }
          : {}),
        ...(streamTargetProjection
          ? {
              streamTargetProjection: {
                ...streamTargetProjection,
                schemaRevisionRef: port.schemaRevisionRef,
              },
            }
          : {}),
        ...(cursorWindow
          ? {
              cursorWindow: {
                ...cursorWindow,
                pageChangeIntentSchemaRevisionRef: (() => {
                  const sourceInstanceId =
                    cursorWindow.sourceCapabilityInstanceId ?? node.id;
                  const sourceNode = nodesById.get(sourceInstanceId);
                  const sourceCapability = sourceNode
                    ? singleByStableIdentity(
                        capabilityRegistrations,
                        "capability",
                        sourceNode.component,
                        `page.body.${sourceNode.id}.component`,
                      )
                    : undefined;
                  const sourcePort = sourceCapability?.outputPorts.find(
                    (candidate) =>
                      candidate.name === cursorWindow.pageChangePort,
                  );
                  if (!sourcePort) {
                    throw new DeclarativeControlCompilationError(
                      "PORT_TYPE_MISMATCH",
                      `page.body.${node.id}.data[${index}].cursorWindow.pageChangePort`,
                      `No output port ${cursorWindow.pageChangePort} exists on the cursor source component.`,
                    );
                  }
                  return sourcePort.schemaRevisionRef;
                })(),
              },
            }
          : {}),
        ...(resultStateBindings
          ? {
              resultStateBindings: resultStateBindings.map(
                (stateBinding, stateIndex) => {
                  const targetStateSchemaRevisionRef =
                    stateSchemasByStateId.get(stateBinding.targetStateId);
                  if (!targetStateSchemaRevisionRef) {
                    throw new DeclarativeControlCompilationError(
                      "SCHEMA_DEFINITION_MISMATCH",
                      `page.body.${node.id}.data[${index}].resultStateBindings[${stateIndex}].targetStateId`,
                      `Unknown Page state ${stateBinding.targetStateId}.`,
                    );
                  }
                  return { ...stateBinding, targetStateSchemaRevisionRef };
                },
              ),
            }
          : {}),
      });
    }
    for (const [index, binding] of (node.actions ?? []).entries()) {
      const commandRegistration = singleByStableIdentity(
        commandRegistrations,
        "domain-command",
        binding.command,
        `page.body.${node.id}.actions[${index}].command`,
      );
      const port = registration.outputPorts.find(
        (candidate) => candidate.name === binding.port,
      );
      if (!port) {
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `page.body.${node.id}.actions[${index}].port`,
          `No output port ${binding.port} exists on ${node.component}.`,
        );
      }
      const inputSchemaRevisionRef = stateSchemaById.get(
        commandRegistration.definition.inputSchemaRef,
      );
      const resultSchemaRevisionRef = commandRegistration.definition
        .outputSchemaRef
        ? stateSchemaById.get(commandRegistration.definition.outputSchemaRef)
        : undefined;
      if (!inputSchemaRevisionRef || !resultSchemaRevisionRef) {
        throw new DeclarativeControlCompilationError(
          "COMMAND_DEFINITION_MISMATCH",
          `page.body.${node.id}.actions[${index}].command`,
          `Command ${binding.command} must resolve active input and output Schemas.`,
        );
      }
      const compensationCommandRevisionRef = binding.compensationCommand
        ? singleByStableIdentity(
            commandRegistrations,
            "domain-command",
            binding.compensationCommand,
            `page.body.${node.id}.actions[${index}].compensationCommand`,
          ).revisionRef
        : undefined;
      const { command, port: _port, compensationCommand, ...rest } = binding;
      actionBindings.push({
        ...rest,
        commandRevisionRef: commandRegistration.revisionRef,
        source: { capabilityInstanceId: node.id, port: binding.port },
        sourceIntentSchemaRevisionRef: port.schemaRevisionRef,
        inputSchemaRevisionRef,
        ...(compensationCommandRevisionRef
          ? { compensationCommandRevisionRef }
          : {}),
        resultSchemaRevisionRef,
      });
    }
    for (const [index, binding] of (node.on ?? []).entries()) {
      const port = registration.outputPorts.find(
        (candidate) => candidate.name === binding.port,
      );
      if (!port) {
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `page.body.${node.id}.on[${index}].port`,
          `No output port ${binding.port} exists on ${node.component}.`,
        );
      }
      const matchingAction = actionBindings.find(
        (action) =>
          action.source.capabilityInstanceId === node.id &&
          action.source.port === binding.port,
      );
      const { port: _port, ...rest } = binding;
      interactionBindings.push({
        ...rest,
        source: { capabilityInstanceId: node.id, port: binding.port },
        sourceIntentSchemaRevisionRef: port.schemaRevisionRef,
        ...(usesResultValue(binding.inputMapping)
          ? (() => {
              if (!matchingAction) {
                throw new DeclarativeControlCompilationError(
                  "COMMAND_DEFINITION_MISMATCH",
                  `page.body.${node.id}.on[${index}].inputMapping`,
                  "A result-driven interaction requires an Action on the same output port.",
                );
              }
              return {
                sourceResultSchemaRevisionRef:
                  matchingAction.resultSchemaRevisionRef,
              };
            })()
          : {}),
      });
    }
    children.forEach((child) => visitNode(child, node.id));
  };
  visitNode(page.body);
  const resolved = {
    contract: "Page" as const,
    schemaVersion: 1 as const,
    pageId: page.pageId,
    tenantScope: page.tenantScope,
    identity: page.identity,
    supportedSurfaces: [page.surface],
    lifecycle: page.lifecycle,
    ...(page.routeStatePresentations
      ? { routeStatePresentations: page.routeStatePresentations }
      : {}),
    routeClaims: [
      {
        kind: "canonical" as const,
        surface: page.surface,
        routeSpaceRevisionRef,
        pathTemplate: page.route,
      },
    ],
    shellRevisionRef,
    renderTree: {
      contract: "RenderTree" as const,
      treeId: page.pageId,
      product: page.surface,
      rootNodeId: page.body.id,
      nodes: renderNodes,
    },
    capabilityInstances,
    ...(stateDefinitions.length ? { stateDefinitions } : {}),
    ...(page.entryTransitions
      ? {
          entryTransitions: page.entryTransitions.map(
            ({ target, ...transition }, index) => {
              const matches = (input.targetRegistry ?? []).filter(
                (registration) =>
                  registration.stableTargetRef.kind === target.kind &&
                  registration.stableTargetRef.id === target.id,
              );
              if (matches.length !== 1) {
                throw new DeclarativeControlCompilationError(
                  "PAGE_ENTRY_TARGET_UNRELEASED",
                  `page.entryTransitions[${index}].target`,
                  `Expected one active ${target.kind} target for ${target.id}; found ${matches.length}.`,
                );
              }
              return { ...transition, targetRef: matches[0]!.stableTargetRef };
            },
          ),
        }
      : {}),
    ...(interactionBindings.length ? { interactionBindings } : {}),
    ontologyBindings: [],
    ...(queryBindings.length ? { queryBindings } : {}),
    actionBindings,
    pageAccessPolicy: page.access,
    managementAccess: page.managementAccess,
    tokenRevisionRefs,
    performanceBudgetRef,
    observationPolicyRevisionRef,
    privacyClassification: page.privacyClassification,
  };
  return ResolvedPageSchema.parse(resolved);
};
export type LegacyCompilePageRuntimeBundleInput = Omit<
  CompilePageRuntimeBundleInput,
  "capabilityRegistry" | "shellRegistration"
> & {
  capabilityRegistry: readonly (Omit<
    DeclarativeCapabilityRegistration,
    "propertySchemaRevisionRef" | "accessPolicy"
  > &
    Partial<
      Pick<
        DeclarativeCapabilityRegistration,
        "propertySchemaRevisionRef" | "accessPolicy"
      >
    >)[];
};

/** Explicit compatibility boundary for previously persisted resolved Page documents. */
export const compileLegacyPageRuntimeBundle = (
  input: LegacyCompilePageRuntimeBundleInput,
): LegacyPageRuntimeBundle =>
  deepFreeze(
    LegacyPageRuntimeBundleSchema.parse(
      compilePageRuntimeBundleInternal(input, true),
    ),
  );

export const compilePageRuntimeBundle = (
  input: CompilePageRuntimeBundleInput,
): PageRuntimeBundle =>
  deepFreeze(
    PageRuntimeBundleSchema.parse(
      compilePageRuntimeBundleInternal(input, false),
    ),
  );

const compilePageRuntimeBundleInternal = (
  input: LegacyCompilePageRuntimeBundleInput & {
    shellRegistration?: DeclarativeProductResourceRegistration;
  },
  legacy: boolean,
): unknown => {
  const parsedPage = ResolvedPageSchema.parse(input.page);
  parsedPage.ontologyBindings.forEach((binding) =>
    (legacy ? LegacyOntologyBindingSchema : OntologyBindingSchema).parse(
      binding,
    ),
  );
  if (
    legacy &&
    (parsedPage.queryBindings?.length || input.domainQueryRegistry?.length)
  ) {
    throw new DeclarativeControlCompilationError(
      "QUERY_DEFINITION_MISMATCH",
      "queryBindings",
      "Domain queries require the current compiler and its governed registries.",
    );
  }
  const page = {
    ...parsedPage,
    routeStatePresentations: parsedPage.routeStatePresentations ?? [],
    stateDefinitions: parsedPage.stateDefinitions ?? [],
    entryTransitions: parsedPage.entryTransitions ?? [],
    interactionBindings: parsedPage.interactionBindings ?? [],
    queryBindings: parsedPage.queryBindings ?? [],
  };
  const pageRevisionRef = RevisionRefSchema.parse(input.pageRevisionRef);
  const release = PageReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(
    input.compilerRevisionRef,
  );
  const scope = TenantScopeSchema.parse(page.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, "release.tenantScope");
  assertRevisionIdentity(
    pageRevisionRef,
    "page",
    page.pageId,
    scope,
    "pageRevisionRef",
  );
  assertRevisionIdentity(
    release.pageRevisionRef,
    "page",
    page.pageId,
    scope,
    "release.pageRevisionRef",
  );
  if (!sameRevisionRef(pageRevisionRef, release.pageRevisionRef))
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      "release.pageRevisionRef",
      "Release does not pin the supplied Page revision.",
    );
  assertRevisionIdentity(
    releaseRevisionRef,
    "page-release",
    release.releaseSlotId,
    scope,
    "releaseRevisionRef",
  );
  requireReleaseReady(release);
  requireDependencies(
    release.dependencySnapshot,
    pageDependencies(page, compilerRevisionRef),
  );
  assertDependencyScopes(release.dependencySnapshot, scope);
  const queryRegistrations = (input.domainQueryRegistry ?? []).map(
    (registration, index) => {
      const definitionRevisionRef = RevisionRefSchema.parse(
        registration.definitionRevisionRef,
      );
      const definition = DomainQueryDefinitionSchema.parse(
        registration.definition,
      );
      assertSameTenantScope(
        definition.tenantScope,
        scope,
        `domainQueryRegistry[${index}].definition.tenantScope`,
      );
      assertRevisionIdentity(
        definitionRevisionRef,
        "domain-query-definition",
        definition.queryId,
        scope,
        `domainQueryRegistry[${index}].definitionRevisionRef`,
      );
      if (
        definitionRevisionRef.contentHash !== canonicalContentHash(definition)
      ) {
        throw new DeclarativeControlCompilationError(
          "QUERY_DEFINITION_MISMATCH",
          `domainQueryRegistry[${index}].definitionRevisionRef.contentHash`,
          "Domain Query registry entry does not match its exact definition content hash.",
        );
      }
      return { definitionRevisionRef, definition };
    },
  );
  assertUniqueRegistryKeys(
    queryRegistrations.map((registration) =>
      revisionRefKey(registration.definitionRevisionRef),
    ),
    "domainQueryRegistry",
  );
  const queryDefinitionsByRevision = new Map(
    queryRegistrations.map((registration) => [
      revisionRefKey(registration.definitionRevisionRef),
      registration.definition,
    ]),
  );
  page.queryBindings.forEach((binding, index) => {
    const definition = queryDefinitionsByRevision.get(
      revisionRefKey(binding.queryDefinitionRevisionRef),
    );
    if (!definition) {
      throw new DeclarativeControlCompilationError(
        "QUERY_DEFINITION_MISMATCH",
        `queryBindings[${index}].queryDefinitionRevisionRef`,
        "Query binding does not resolve to one exact governed Domain Query definition.",
      );
    }
    if (
      !sameRevisionRef(
        definition.resultSchemaRevisionRef,
        binding.renderModelSchemaRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "QUERY_DEFINITION_MISMATCH",
        `queryBindings[${index}].renderModelSchemaRevisionRef`,
        "Query binding render model does not match the exact Domain Query result schema.",
      );
    }
    if (
      !accessPolicyChainImplies(
        [page.pageAccessPolicy],
        definition.accessPolicy,
      ) &&
      binding.accessFailure !== "render-forbidden"
    ) {
      throw new DeclarativeControlCompilationError(
        "AUDIENCE_WIDER_THAN_TARGET",
        `queryBindings[${index}]`,
        "Page access is wider than the governed Domain Query audience.",
      );
    }
    const sourceKind = definition.dataSource?.kind ?? "exact-view";
    if (binding.execution === "local-state" && sourceKind !== "page-state") {
      throw new DeclarativeControlCompilationError(
        "QUERY_DEFINITION_MISMATCH",
        `queryBindings[${index}].execution`,
        "A local-state binding must resolve to one page-state Domain Query definition.",
      );
    }
    if (binding.execution === "server" && sourceKind === "page-state") {
      throw new DeclarativeControlCompilationError(
        "QUERY_DEFINITION_MISMATCH",
        `queryBindings[${index}].execution`,
        "A page-state Domain Query cannot execute on the Server.",
      );
    }
    requireDependencies(
      release.dependencySnapshot,
      domainQueryDependencies(definition),
    );
  });
  const shellDescriptor = legacy
    ? undefined
    : (() => {
        const shellRegistration =
          DeclarativeProductResourceRegistrationSchema.parse(
            input.shellRegistration,
          );
        if (
          shellRegistration.resourceKind !== "shell" ||
          !sameRevisionRef(
            shellRegistration.resourceRevisionRef,
            page.shellRevisionRef,
          ) ||
          declarativeProductResourceRevisionHash(shellRegistration) !==
            shellRegistration.resourceRevisionRef.contentHash ||
          declarativeProductResourceSourceHash(shellRegistration.document) !==
            shellRegistration.sourceContentHash
        ) {
          throw new DeclarativeControlCompilationError(
            "SHELL_REVISION_MISMATCH",
            "shellRegistration",
            "The active Shell registration does not match the Page exact Shell revision.",
          );
        }
        if (
          !shellRegistration.supportedSurfaces.includes(release.target.surface)
        ) {
          throw new DeclarativeControlCompilationError(
            "SHELL_SURFACE_MISMATCH",
            "shellRegistration.supportedSurfaces",
            "The active Shell registration does not support the release surface.",
          );
        }
        const shellDocument = DeclarativeShellResourceDocumentSchema.parse(
          shellRegistration.document,
        );
        const shellChrome = shellDocument.surfaceChrome.find(
          (entry) => entry.surface === release.target.surface,
        );
        if (!shellChrome) {
          throw new DeclarativeControlCompilationError(
            "SHELL_CHROME_UNAVAILABLE",
            "shellRegistration.document.surfaceChrome",
            "The active Shell does not declare chrome for the release surface.",
          );
        }
        return {
          shellRevisionRef: page.shellRevisionRef,
          header: shellChrome.header,
        };
      })();
  if (page.renderTree.nodes.length > input.limits.maxRenderNodes)
    throw new DeclarativeControlCompilationError(
      "RENDER_NODE_LIMIT_EXCEEDED",
      "page.renderTree.nodes",
      "RenderTree exceeds the caller-approved node limit.",
    );
  if (renderTreeDepth(page.renderTree) > input.limits.maxRenderDepth)
    throw new DeclarativeControlCompilationError(
      "RENDER_DEPTH_EXCEEDED",
      "page.renderTree.nodes",
      "RenderTree exceeds the caller-approved depth limit.",
    );
  const renderTree = compileRenderTree(page.renderTree).tree;
  const instancesByNode = new Map(
    page.capabilityInstances.map((instance) => [instance.nodeId, instance]),
  );
  const registrations = input.capabilityRegistry.map(
    (registration, registrationIndex) => ({
      ...registration,
      capabilityRevisionRef: RevisionRefSchema.parse(
        registration.capabilityRevisionRef,
      ),
      providerRevisionRef: RevisionRefSchema.parse(
        registration.providerRevisionRef,
      ),
      inputPorts: registration.inputPorts.map((port, portIndex) => {
        const schemaRevisionRef = RevisionRefSchema.parse(
          port.schemaRevisionRef,
        );
        if (schemaRevisionRef.kind !== "schema") {
          throw new DeclarativeControlCompilationError(
            "PORT_TYPE_MISMATCH",
            `capabilityRegistry[${registrationIndex}].inputPorts[${portIndex}].schemaRevisionRef`,
            "Capability ports must pin schema revisions.",
          );
        }
        return { ...port, schemaRevisionRef };
      }),
      outputPorts: registration.outputPorts.map((port, portIndex) => {
        const schemaRevisionRef = RevisionRefSchema.parse(
          port.schemaRevisionRef,
        );
        if (schemaRevisionRef.kind !== "schema") {
          throw new DeclarativeControlCompilationError(
            "PORT_TYPE_MISMATCH",
            `capabilityRegistry[${registrationIndex}].outputPorts[${portIndex}].schemaRevisionRef`,
            "Capability ports must pin schema revisions.",
          );
        }
        return { ...port, schemaRevisionRef };
      }),
    }),
  );
  assertUniqueRegistryKeys(
    registrations.map(
      (registration) =>
        `${revisionRefKey(registration.capabilityRevisionRef)}:${revisionRefKey(registration.providerRevisionRef)}`,
    ),
    "capabilityRegistry",
  );
  const registrationsByPair = new Map(
    registrations.map((registration) => [
      `${revisionRefKey(registration.capabilityRevisionRef)}:${revisionRefKey(registration.providerRevisionRef)}`,
      registration,
    ]),
  );
  page.capabilityInstances.forEach((instance, index) => {
    const node = renderTree.nodes.find(
      (candidate) => candidate.nodeId === instance.nodeId,
    );
    if (
      !node ||
      !compareLegacyEntityRef(
        node.capabilityRef,
        instance.capabilityRevisionRef,
      ) ||
      !node.providerRef ||
      !compareLegacyEntityRef(node.providerRef, instance.providerRevisionRef) ||
      node.pageRef.id !== page.pageId
    ) {
      throw new DeclarativeControlCompilationError(
        "CAPABILITY_BINDING_MISMATCH",
        `capabilityInstances[${index}]`,
        "RenderTree node identity does not match the declared capability/provider instance.",
      );
    }
    const registration = registrationsByPair.get(
      `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
    );
    if (!registration) {
      throw new DeclarativeControlCompilationError(
        "CAPABILITY_BINDING_MISMATCH",
        `capabilityInstances[${index}]`,
        "Capability/provider pair has no exact governed Design registration.",
      );
    }
    if (
      instance.allowedSideEffects.some(
        (sideEffect) => !registration.allowedSideEffects.includes(sideEffect),
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "CAPABILITY_BINDING_MISMATCH",
        `capabilityInstances[${index}].allowedSideEffects`,
        "Page requests undeclared provider side effects.",
      );
    }
    if (
      !legacy &&
      (!registration.propertySchemaRevisionRef ||
        !sameRevisionRef(
          instance.propertySchemaRevisionRef,
          registration.propertySchemaRevisionRef,
        ))
    ) {
      throw new DeclarativeControlCompilationError(
        "CAPABILITY_BINDING_MISMATCH",
        `capabilityInstances[${index}].propertySchemaRevisionRef`,
        "Capability properties do not pin the exact schema registered by the active Design catalog.",
      );
    }
    if (
      !legacy &&
      (!registration.accessPolicy ||
        !accessPolicyChainImplies(
          [
            page.pageAccessPolicy,
            ...(instance.accessPolicy ? [instance.accessPolicy] : []),
          ],
          registration.accessPolicy,
        ))
    ) {
      throw new DeclarativeControlCompilationError(
        "AUDIENCE_WIDER_THAN_TARGET",
        `capabilityInstances[${index}]`,
        "Page access is wider than the governed capability audience.",
      );
    }
  });
  if (instancesByNode.size !== page.capabilityInstances.length) {
    throw new DeclarativeControlCompilationError(
      "CAPABILITY_BINDING_MISMATCH",
      "capabilityInstances",
      "Each executable RenderTree node must be governed by at most one capability instance.",
    );
  }
  renderTree.nodes.forEach((node, index) => {
    if (!node.providerRef) return;
    if (!instancesByNode.has(node.nodeId)) {
      throw new DeclarativeControlCompilationError(
        "CAPABILITY_BINDING_MISMATCH",
        `renderTree.nodes[${index}]`,
        "Every provider-backed RenderTree node must be governed by one capability instance.",
      );
    }
  });
  page.ontologyBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find(
      (candidate) =>
        candidate.instanceId === binding.target.capabilityInstanceId,
    );
    const registration =
      instance &&
      registrationsByPair.get(
        `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
      );
    const port = registration?.inputPorts.find(
      (candidate) => candidate.name === binding.target.port,
    );
    if (
      !port ||
      !sameRevisionRef(
        port.schemaRevisionRef,
        binding.renderModelSchemaRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "PORT_TYPE_MISMATCH",
        `ontologyBindings[${index}].target.port`,
        "Ontology render model does not match the registered capability input port.",
      );
    }
    if (binding.cursorWindow) {
      const sourceInstance = page.capabilityInstances.find(
        (candidate) =>
          candidate.instanceId ===
          (binding.cursorWindow!.sourceCapabilityInstanceId ??
            binding.target.capabilityInstanceId),
      );
      const sourceRegistration =
        sourceInstance &&
        registrationsByPair.get(
          `${revisionRefKey(sourceInstance.capabilityRevisionRef)}:${revisionRefKey(sourceInstance.providerRevisionRef)}`,
        );
      const pageChangePort = sourceRegistration?.outputPorts.find(
        (candidate) => candidate.name === binding.cursorWindow!.pageChangePort,
      );
      if (
        !pageChangePort ||
        !sameRevisionRef(
          pageChangePort.schemaRevisionRef,
          binding.cursorWindow.pageChangeIntentSchemaRevisionRef,
        )
      ) {
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `ontologyBindings[${index}].cursorWindow.pageChangePort`,
          "Cursor-window page-change intent does not match the registered capability output port.",
        );
      }
    }
  });
  page.queryBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find(
      (candidate) =>
        candidate.instanceId === binding.target.capabilityInstanceId,
    );
    const registration =
      instance &&
      registrationsByPair.get(
        `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
      );
    const port = registration?.inputPorts.find(
      (candidate) => candidate.name === binding.target.port,
    );
    if (
      !port ||
      !sameRevisionRef(
        port.schemaRevisionRef,
        binding.targetProjection?.schemaRevisionRef ??
          binding.renderModelSchemaRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "PORT_TYPE_MISMATCH",
        `queryBindings[${index}].target.port`,
        "Domain Query render model does not match the registered capability input port.",
      );
    }
    if (
      binding.streamTargetProjection &&
      (!port ||
        !sameRevisionRef(
          port.schemaRevisionRef,
          binding.streamTargetProjection.schemaRevisionRef,
        ))
    ) {
      throw new DeclarativeControlCompilationError(
        "PORT_TYPE_MISMATCH",
        `queryBindings[${index}].streamTargetProjection`,
        "Stream render model does not match the registered capability input port.",
      );
    }
    if (binding.cursorWindow) {
      const sourceInstance = page.capabilityInstances.find(
        (candidate) =>
          candidate.instanceId ===
          (binding.cursorWindow!.sourceCapabilityInstanceId ??
            binding.target.capabilityInstanceId),
      );
      const sourceRegistration =
        sourceInstance &&
        registrationsByPair.get(
          `${revisionRefKey(sourceInstance.capabilityRevisionRef)}:${revisionRefKey(sourceInstance.providerRevisionRef)}`,
        );
      const pageChangePort = sourceRegistration?.outputPorts.find(
        (candidate) => candidate.name === binding.cursorWindow!.pageChangePort,
      );
      if (
        !pageChangePort ||
        !sameRevisionRef(
          pageChangePort.schemaRevisionRef,
          binding.cursorWindow.pageChangeIntentSchemaRevisionRef,
        )
      ) {
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `queryBindings[${index}].cursorWindow.pageChangePort`,
          "Cursor-window page-change intent does not match the registered capability output port.",
        );
      }
    }
  });
  page.capabilityInstances.forEach((instance, index) => {
    const registration = registrationsByPair.get(
      `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
    );
    instance.eventPayloadBindings?.forEach((binding, bindingIndex) => {
      if (!registration?.outputPorts.some((port) => port.name === binding.port))
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `capabilityInstances[${index}].eventPayloadBindings[${bindingIndex}]`,
          "Event payload projection must reference a registered output port.",
        );
    });
    instance.eventEffects?.forEach((effect, effectIndex) => {
      const port = registration?.outputPorts.find(
        (candidate) => candidate.name === effect.sourcePort,
      );
      if (
        !port ||
        !sameRevisionRef(
          port.schemaRevisionRef,
          effect.sourceIntentSchemaRevisionRef,
        )
      )
        throw new DeclarativeControlCompilationError(
          "PORT_TYPE_MISMATCH",
          `capabilityInstances[${index}].eventEffects[${effectIndex}]`,
          "Event effect source must match an exact registered output port schema.",
        );
    });
  });
  page.interactionBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find(
      (candidate) =>
        candidate.instanceId === binding.source.capabilityInstanceId,
    );
    const registration =
      instance &&
      registrationsByPair.get(
        `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
      );
    const port = registration?.outputPorts.find(
      (candidate) => candidate.name === binding.source.port,
    );
    if (
      !port ||
      !sameRevisionRef(
        port.schemaRevisionRef,
        binding.sourceIntentSchemaRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "PORT_TYPE_MISMATCH",
        `interactionBindings[${index}].sourceIntentSchemaRevisionRef`,
        "Interaction source intent does not match the registered capability output port.",
      );
    }
  });
  page.actionBindings.forEach((binding, index) => {
    const instance = page.capabilityInstances.find(
      (candidate) =>
        candidate.instanceId === binding.source.capabilityInstanceId,
    );
    const registration =
      instance &&
      registrationsByPair.get(
        `${revisionRefKey(instance.capabilityRevisionRef)}:${revisionRefKey(instance.providerRevisionRef)}`,
      );
    const port = registration?.outputPorts.find(
      (candidate) => candidate.name === binding.source.port,
    );
    if (
      !port ||
      !sameRevisionRef(
        port.schemaRevisionRef,
        binding.sourceIntentSchemaRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "PORT_TYPE_MISMATCH",
        `actionBindings[${index}].sourceIntentSchemaRevisionRef`,
        "Action source intent does not match the registered capability output port.",
      );
    }
  });
  const routeClaims = compileRouteClaims({
    claims: page.routeClaims,
    routeSpaces: input.routeSpaces,
    surface: release.target.surface,
    legacyRouteTakeoverAuthorizations: release.target
      .legacyRouteTakeoverAuthorization
      ? [release.target.legacyRouteTakeoverAuthorization]
      : [],
  });
  const releaseRoute = routeClaims.find(
    (claim) =>
      claim.kind === "canonical" &&
      claim.normalizedPath === release.target.normalizedPath,
  );
  if (
    !releaseRoute ||
    !sameRevisionRef(
      releaseRoute.routeSpaceRevisionRef,
      release.target.routeSpaceRevisionRef,
    )
  ) {
    throw new DeclarativeControlCompilationError(
      "ROUTE_SPACE_MISMATCH",
      "release.target",
      "Release target does not match an exact Page route claim.",
    );
  }
  if (!page.supportedSurfaces.includes(release.target.surface)) {
    throw new DeclarativeControlCompilationError(
      "ROUTE_SPACE_MISMATCH",
      "release.target.surface",
      "Page does not support the release surface.",
    );
  }
  const routeTargets = (input.targetRegistry ?? []).map(
    (registration, index) => ({
      ...registration,
      stableTargetRef: StableRefSchema.parse(registration.stableTargetRef),
      targetRevisionRef: RevisionRefSchema.parse(
        registration.targetRevisionRef,
      ),
      ...(registration.releaseRevisionRef
        ? {
            releaseRevisionRef: RevisionRefSchema.parse(
              registration.releaseRevisionRef,
            ),
          }
        : {}),
      accessPolicy: AccessPolicySchema.parse(registration.accessPolicy),
      routeClaim: CompiledRouteClaimSchema.parse(registration.routeClaim),
      sourceIndex: index,
    }),
  );
  assertUniqueRegistryKeys(
    routeTargets.map((registration) =>
      stableRefKey(registration.stableTargetRef),
    ),
    "targetRegistry",
  );
  const entryTransitions = page.entryTransitions.map((transition, index) => {
    const matches = routeTargets.filter(
      (registration) =>
        registration.kind === "route" &&
        sameStableRef(registration.stableTargetRef, transition.targetRef) &&
        registration.surface === release.target.surface,
    );
    if (matches.length !== 1) {
      throw new DeclarativeControlCompilationError(
        "PAGE_ENTRY_TARGET_UNRELEASED",
        `entryTransitions[${index}].targetRef`,
        "Entry transition target must resolve to one exact active route registration on the same surface.",
      );
    }
    const target = matches[0]!;
    if (
      target.releaseRevisionRef &&
      !["page-release", "workbench-release"].includes(
        target.releaseRevisionRef.kind,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "PAGE_ENTRY_TARGET_UNRELEASED",
        `entryTransitions[${index}].targetRef`,
        "Entry transition Release provenance must identify a Page or Workbench Release.",
      );
    }
    if (target.routeClaim.kind !== "canonical") {
      throw new DeclarativeControlCompilationError(
        "PAGE_ENTRY_TARGET_UNRELEASED",
        `entryTransitions[${index}].targetRef`,
        "Entry transition targets must expose one canonical route claim.",
      );
    }
    if (!sameStableRef(target.stableTargetRef, target.targetRevisionRef)) {
      throw new DeclarativeControlCompilationError(
        "PAGE_ENTRY_TARGET_UNRELEASED",
        `targetRegistry[${target.sourceIndex}]`,
        "Entry transition target registration identity is not exact.",
      );
    }
    // Entry transitions may narrow into a separately protected route. The target
    // route remains authoritative and re-evaluates its own access policy after
    // navigation, so a source Page must not inherit the target's permissions.
    const requiredPathParameters = [
      ...target.routeClaim.normalizedPath.matchAll(
        /:([A-Za-z][A-Za-z0-9_-]*)/g,
      ),
    ].map((match) => match[1]!);
    const mappedPathParameters = Object.keys(transition.pathParameters);
    const missing = requiredPathParameters.find(
      (name) => !mappedPathParameters.includes(name),
    );
    const unknown = mappedPathParameters.find(
      (name) => !requiredPathParameters.includes(name),
    );
    if (missing || unknown) {
      throw new DeclarativeControlCompilationError(
        "ROUTE_SPACE_MISMATCH",
        `entryTransitions[${index}].pathParameters`,
        missing
          ? `Entry transition does not resolve target route parameter ${missing}.`
          : `Entry transition maps unknown target route parameter ${unknown}.`,
      );
    }
    requireDependencies(release.dependencySnapshot, [
      {
        role: target.targetRevisionRef.kind as "page" | "workbench",
        revisionRef: target.targetRevisionRef,
      },
      ...(target.releaseRevisionRef
        ? [
            {
              role: target.releaseRevisionRef.kind as
                | "page-release"
                | "workbench-release",
              revisionRef: target.releaseRevisionRef,
            },
          ]
        : []),
    ]);
    return {
      ...transition,
      browsingContext: transition.browsingContext ?? "same",
      targetRevisionRef: target.targetRevisionRef,
      ...(target.releaseRevisionRef
        ? { targetReleaseRevisionRef: target.releaseRevisionRef }
        : {}),
      targetAccessPolicy: target.accessPolicy,
      targetRouteClaim: target.routeClaim,
    };
  });
  const unsigned = {
    contract: "PageRuntimeBundle" as const,
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
    routeStatePresentations: page.routeStatePresentations.filter(
      (presentation) => presentation.surface === release.target.surface,
    ),
    shellRevisionRef: page.shellRevisionRef,
    ...(shellDescriptor ? { shellDescriptor } : {}),
    renderTree,
    capabilityInstances: page.capabilityInstances,
    deniedCapabilityInstanceIds: [],
    stateDefinitions: page.stateDefinitions,
    entryTransitions,
    interactionBindings: page.interactionBindings,
    ontologyBindings: page.ontologyBindings,
    queryBindings: page.queryBindings,
    actionBindings: page.actionBindings,
    pageAccessPolicy: page.pageAccessPolicy,
    tokenRevisionRefs: page.tokenRevisionRefs,
    performanceBudgetRef: page.performanceBudgetRef,
    observationPolicyRevisionRef: page.observationPolicyRevisionRef,
    privacyClassification: page.privacyClassification,
  };
  return { ...unsigned, contentHash: canonicalContentHash(unsigned) };
};
const workbenchDependencyRole = (kind: string): ReleaseDependency["role"] => {
  switch (kind) {
    case "workflow":
      return "workflow";
    case "agent":
      return "agent";
    case "capability":
      return "capability";
    case "design":
      return "design";
    case "built-in-application":
      return "built-in-application";
    default:
      return "workflow";
  }
};
const workbenchDependencies = (
  workbench: Workbench,
  compilerRevisionRef: RevisionRef,
): ReleaseDependency[] => [
  ...workbench.routeClaims.map((claim) => ({
    role: "route-space" as const,
    revisionRef: claim.routeSpaceRevisionRef,
  })),
  ...workbench.appInstances.flatMap((instance) => [
    {
      role: workbenchDependencyRole(instance.targetRevisionRef.kind),
      revisionRef: instance.targetRevisionRef,
    },
    { role: "provider" as const, revisionRef: instance.providerRevisionRef },
    { role: "schema" as const, revisionRef: instance.inputSchemaRevisionRef },
  ]),
  {
    role: "capability",
    revisionRef: workbench.layout.hostCapabilityRevisionRef,
  },
  { role: "provider", revisionRef: workbench.layout.hostProviderRevisionRef },
  {
    role: "layout-policy",
    revisionRef: workbench.layout.layoutPolicyRevisionRef,
  },
  ...workbench.layout.tokenRevisionRefs.map((revisionRef) => ({
    role: "token" as const,
    revisionRef,
  })),
  { role: "performance-budget", revisionRef: workbench.performanceBudgetRef },
  {
    role: "observation-policy",
    revisionRef: workbench.observationPolicyRevisionRef,
  },
  { role: "compiler", revisionRef: compilerRevisionRef },
];
export const compileWorkbenchRuntimeBundle = (
  input: CompileWorkbenchRuntimeBundleInput,
): WorkbenchRuntimeBundle => {
  const workbench = WorkbenchSchema.parse(input.workbench);
  const workbenchRevisionRef = RevisionRefSchema.parse(
    input.workbenchRevisionRef,
  );
  const release = WorkbenchReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(
    input.compilerRevisionRef,
  );
  const scope = TenantScopeSchema.parse(workbench.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, "release.tenantScope");
  if (workbench.purpose === "template")
    throw new DeclarativeControlCompilationError(
      "WORKBENCH_TEMPLATE_UNRELEASABLE",
      "workbench.purpose",
      "Workbench templates cannot be activated.",
    );
  if (
    workbench.groups.length > input.limits.maxWorkbenchGroups ||
    workbench.appInstances.length > input.limits.maxWorkbenchInstances
  ) {
    throw new DeclarativeControlCompilationError(
      "WORKBENCH_INSTANCE_LIMIT_EXCEEDED",
      "workbench",
      "Workbench exceeds caller-approved compilation limits.",
    );
  }
  assertRevisionIdentity(
    workbenchRevisionRef,
    "workbench",
    workbench.workbenchId,
    scope,
    "workbenchRevisionRef",
  );
  assertRevisionIdentity(
    release.workbenchRevisionRef,
    "workbench",
    workbench.workbenchId,
    scope,
    "release.workbenchRevisionRef",
  );
  if (!sameRevisionRef(workbenchRevisionRef, release.workbenchRevisionRef))
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      "release.workbenchRevisionRef",
      "Release does not pin the supplied Workbench revision.",
    );
  assertRevisionIdentity(
    releaseRevisionRef,
    "workbench-release",
    release.releaseSlotId,
    scope,
    "releaseRevisionRef",
  );
  if (release.target.workbenchId !== workbench.workbenchId)
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      "release.target.workbenchId",
      "Release target does not match Workbench identity.",
    );
  requireReleaseReady(release);
  requireDependencies(
    release.dependencySnapshot,
    workbenchDependencies(workbench, compilerRevisionRef),
  );
  assertDependencyScopes(release.dependencySnapshot, scope);
  const routeClaims = compileRouteClaims({
    claims: workbench.routeClaims,
    routeSpaces: input.routeSpaces,
    surface: release.target.surface,
    legacyRouteTakeoverAuthorizations: release.target
      .legacyRouteTakeoverAuthorization
      ? [release.target.legacyRouteTakeoverAuthorization]
      : [],
  });
  const releaseRoute = routeClaims.find(
    (claim) =>
      claim.kind === "canonical" &&
      claim.normalizedPath === release.target.normalizedPath,
  );
  if (
    !releaseRoute ||
    !sameRevisionRef(
      releaseRoute.routeSpaceRevisionRef,
      release.target.routeSpaceRevisionRef,
    )
  ) {
    throw new DeclarativeControlCompilationError(
      "ROUTE_SPACE_MISMATCH",
      "release.target",
      "Release target does not match an exact Workbench route claim.",
    );
  }
  const targetRegistry = input.targetRegistry.map((registration) => ({
    stableTargetRef: StableRefSchema.parse(registration.stableTargetRef),
    targetRevisionRef: RevisionRefSchema.parse(registration.targetRevisionRef),
    accessPolicy: AccessPolicySchema.parse(registration.accessPolicy),
  }));
  assertUniqueRegistryKeys(
    targetRegistry.map((registration) =>
      stableRefKey(registration.stableTargetRef),
    ),
    "targetRegistry",
  );
  const targetsByStableRef = new Map(
    targetRegistry.map((registration) => [
      stableRefKey(registration.stableTargetRef),
      registration,
    ]),
  );
  const groupsById = new Map(
    workbench.groups.map((group) => [group.groupId, group]),
  );
  const appInstances = workbench.appInstances.map((instance, index) => {
    const stableTarget = StableRefSchema.parse({
      kind: instance.targetRevisionRef.kind,
      id: instance.targetRevisionRef.id,
      ownerRepo: instance.targetRevisionRef.ownerRepo,
      visibility: instance.targetRevisionRef.visibility,
      ...(instance.targetRevisionRef.tenantScope
        ? { tenantScope: instance.targetRevisionRef.tenantScope }
        : {}),
    });
    const registration = targetsByStableRef.get(stableRefKey(stableTarget));
    if (
      !registration ||
      !sameStableRef(
        registration.stableTargetRef,
        stableFromRevision(registration.targetRevisionRef),
      ) ||
      !sameRevisionRef(
        registration.targetRevisionRef,
        instance.targetRevisionRef,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        `appInstances[${index}].targetRevisionRef`,
        "Workbench app target is not present at the exact registered revision.",
      );
    }
    assertTenantCompatible(
      instance.targetRevisionRef,
      scope,
      `appInstances[${index}].targetRevisionRef`,
    );
    const group = groupsById.get(instance.groupId);
    const chain = [
      workbench.workbenchAccessPolicy,
      ...(group?.accessPolicy ? [group.accessPolicy] : []),
      instance.accessPolicy,
    ];
    if (!accessPolicyChainImplies(chain, registration.accessPolicy)) {
      throw new DeclarativeControlCompilationError(
        "AUDIENCE_WIDER_THAN_TARGET",
        `appInstances[${index}].accessPolicy`,
        "Workbench and instance audience is wider than the target audience.",
      );
    }
    return { ...instance, targetAccessPolicy: registration.accessPolicy };
  });
  const unsigned = {
    contract: "WorkbenchRuntimeBundle" as const,
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
    identity: {
      name: workbench.identity.name,
      ...(workbench.identity.description
        ? { description: workbench.identity.description }
        : {}),
    },
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
  return deepFreeze(
    WorkbenchRuntimeBundleSchema.parse({
      ...unsigned,
      contentHash: canonicalContentHash(unsigned),
    }),
  );
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
const orderedNavigationNodes = (
  navigation: Navigation,
): Navigation["nodes"] => {
  const children = new Map<string, Navigation["nodes"]>();
  navigation.nodes.forEach((node) => {
    const parent = node.parentNodeId ?? "";
    const siblings = children.get(parent) ?? [];
    children.set(parent, [...siblings, node]);
  });
  children.forEach((siblings) =>
    siblings.sort(
      (left, right) =>
        left.order - right.order || left.nodeId.localeCompare(right.nodeId),
    ),
  );
  const ordered: Navigation["nodes"] = [];
  const append = (parentId: string) => {
    for (const node of children.get(parentId) ?? []) {
      ordered.push(node);
      append(node.nodeId);
    }
  };
  append("");
  return ordered;
};
const navigationDependencies = (
  navigation: Navigation,
  release: NavigationRelease,
  compilerRevisionRef: RevisionRef,
): ReleaseDependency[] => [
  ...release.resolvedTargets.flatMap((target) => [
    {
      role:
        target.targetRevisionRef.kind === "domain-command"
          ? ("action" as const)
          : (target.targetRevisionRef.kind as ReleaseDependency["role"]),
      revisionRef: target.targetRevisionRef,
    },
    ...(target.releaseRevisionRef
      ? [
          {
            role: target.releaseRevisionRef.kind as ReleaseDependency["role"],
            revisionRef: target.releaseRevisionRef,
          },
        ]
      : []),
  ]),
  { role: "performance-budget", revisionRef: navigation.performanceBudgetRef },
  {
    role: "observation-policy",
    revisionRef: navigation.observationPolicyRevisionRef,
  },
  { role: "compiler", revisionRef: compilerRevisionRef },
];
export const compileNavigationRuntimeBundle = (
  input: CompileNavigationRuntimeBundleInput,
): NavigationRuntimeBundle => {
  const navigation = NavigationSchema.parse(input.navigation);
  const navigationRevisionRef = RevisionRefSchema.parse(
    input.navigationRevisionRef,
  );
  const release = NavigationReleaseSchema.parse(input.release);
  const releaseRevisionRef = RevisionRefSchema.parse(input.releaseRevisionRef);
  const compilerRevisionRef = RevisionRefSchema.parse(
    input.compilerRevisionRef,
  );
  const scope = TenantScopeSchema.parse(navigation.tenantScope);
  assertSameTenantScope(release.tenantScope, scope, "release.tenantScope");
  if (navigation.nodes.length > input.limits.maxNavigationNodes)
    throw new DeclarativeControlCompilationError(
      "NAV_NODE_LIMIT_EXCEEDED",
      "navigation.nodes",
      "Navigation exceeds the caller-approved node limit.",
    );
  if (navigationDepth(navigation) > input.limits.maxNavigationDepth)
    throw new DeclarativeControlCompilationError(
      "NAV_DEPTH_EXCEEDED",
      "navigation.nodes",
      "Navigation exceeds the caller-approved depth limit.",
    );
  assertRevisionIdentity(
    navigationRevisionRef,
    "navigation",
    navigation.navigationId,
    scope,
    "navigationRevisionRef",
  );
  assertRevisionIdentity(
    release.navigationRevisionRef,
    "navigation",
    navigation.navigationId,
    scope,
    "release.navigationRevisionRef",
  );
  if (!sameRevisionRef(navigationRevisionRef, release.navigationRevisionRef))
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      "release.navigationRevisionRef",
      "Release does not pin the supplied Navigation revision.",
    );
  assertRevisionIdentity(
    releaseRevisionRef,
    "navigation-release",
    release.releaseSlotId,
    scope,
    "releaseRevisionRef",
  );
  if (
    release.target.surface !==
      navigation.supportedSurfaces.find(
        (surface) => surface === release.target.surface,
      ) ||
    !navigation.placements.includes(release.target.placement)
  ) {
    throw new DeclarativeControlCompilationError(
      "REVISION_MISMATCH",
      "release.target",
      "Navigation release target is not declared by the Navigation record.",
    );
  }
  requireReleaseReady(release);
  requireDependencies(
    release.dependencySnapshot,
    navigationDependencies(navigation, release, compilerRevisionRef),
  );
  assertDependencyScopes(release.dependencySnapshot, scope);
  const targetRegistry = input.targetRegistry.map((registration, index) => {
    const common = {
      stableTargetRef: StableRefSchema.parse(registration.stableTargetRef),
      targetRevisionRef: RevisionRefSchema.parse(
        registration.targetRevisionRef,
      ),
      surface: ProductSurfaceSchema.parse(registration.surface),
      accessPolicy: AccessPolicySchema.parse(registration.accessPolicy),
    };
    if (registration.kind === "route") {
      const routeClaim = CompiledRouteClaimSchema.parse(
        registration.routeClaim,
      );
      if (routeClaim.surface !== common.surface) {
        throw new DeclarativeControlCompilationError(
          "ROUTE_SPACE_MISMATCH",
          `targetRegistry[${index}].routeClaim.surface`,
          "Navigation route claim must match its registered surface.",
        );
      }
      return {
        ...common,
        kind: "route" as const,
        releaseRevisionRef: registration.releaseRevisionRef
          ? RevisionRefSchema.parse(registration.releaseRevisionRef)
          : undefined,
        routeClaim,
      };
    }
    if (registration.kind === "registered-menu-action") {
      const sourceCatalogRevisionRef = RevisionRefSchema.parse(
        registration.sourceCatalogRevisionRef,
      );
      if (
        sourceCatalogRevisionRef.kind !== "application-menu-catalog" ||
        registration.targetRevisionRef.kind !== "menu-action"
      ) {
        throw new DeclarativeControlCompilationError(
          "NAV_TARGET_UNRELEASED",
          "targetRegistry",
          "Registered Menu Actions require exact menu-action and application-menu-catalog revisions.",
        );
      }
      if (registration.inputSchemaRef && !registration.validateInput) {
        throw new DeclarativeControlCompilationError(
          "NAV_TARGET_UNRELEASED",
          "targetRegistry",
          "Registered Menu Actions with input schemas require the active catalog validator.",
        );
      }
      return {
        ...common,
        kind: "registered-menu-action" as const,
        applicationId: registration.applicationId,
        actionRef: registration.actionRef,
        inputSchemaRef: registration.inputSchemaRef,
        validateInput: registration.validateInput,
        sourceCatalogRevisionRef,
      };
    }
    if (registration.targetRevisionRef.kind !== "domain-command") {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        "targetRegistry",
        "Governed DomainCommand actions require an exact domain-command revision.",
      );
    }
    const inputSchemaRevisionRef = RevisionRefSchema.parse(
      registration.inputSchemaRevisionRef,
    );
    const resultSchemaRevisionRef = registration.resultSchemaRevisionRef
      ? RevisionRefSchema.parse(registration.resultSchemaRevisionRef)
      : undefined;
    if (
      inputSchemaRevisionRef.kind !== "schema" ||
      (resultSchemaRevisionRef && resultSchemaRevisionRef.kind !== "schema")
    ) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        "targetRegistry",
        "Governed DomainCommand actions require exact input and output Schema revisions.",
      );
    }
    return {
      ...common,
      kind: "governed-domain-command" as const,
      inputSchemaRevisionRef,
      resultSchemaRevisionRef,
    };
  });
  assertUniqueRegistryKeys(
    targetRegistry.map((registration) =>
      stableRefKey(registration.stableTargetRef),
    ),
    "targetRegistry",
  );
  const targetsByStableRef = new Map(
    targetRegistry.map((registration) => [
      stableRefKey(registration.stableTargetRef),
      registration,
    ]),
  );
  const releasedByNodeId = new Map(
    release.resolvedTargets.map((target) => [target.nodeId, target]),
  );
  const unavailableByNodeId = new Map(
    (release.unavailableTargets ?? []).map((target) => [target.nodeId, target]),
  );
  const nodesById = new Map(
    navigation.nodes.map((node) => [node.nodeId, node]),
  );
  for (const target of release.unavailableTargets ?? []) {
    const node = nodesById.get(target.nodeId);
    if (
      node?.kind !== "target" ||
      !sameStableRef(node.targetRef, target.stableTargetRef)
    ) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        "release.unavailableTargets",
        "An unavailable target must identify its source Page node exactly.",
      );
    }
  }
  const nodes = orderedNavigationNodes(navigation).map((node, index) => {
    const ancestors: AccessPolicy[] = [];
    let parentId = node.parentNodeId;
    while (parentId) {
      const parent = nodesById.get(parentId);
      if (parent?.kind === "group") ancestors.unshift(parent.audience);
      parentId = parent?.parentNodeId ?? null;
    }
    if (node.kind !== "target")
      return { ...node, ancestorAccessPolicies: ancestors };
    if (
      !["page", "workbench", "menu-action", "domain-command"].includes(
        node.targetRef.kind,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        `nodes[${index}].targetRef.kind`,
        "Navigation targets may reference only Page, Workbench, registered Menu Action, or DomainCommand identities.",
      );
    }
    const registration = targetsByStableRef.get(stableRefKey(node.targetRef));
    const released = releasedByNodeId.get(node.nodeId);
    const unavailable = unavailableByNodeId.get(node.nodeId);
    if (
      !registration &&
      unavailable &&
      node.targetRef.kind === "page" &&
      sameStableRef(unavailable.stableTargetRef, node.targetRef)
    ) {
      assertTenantCompatible(
        node.targetRef,
        scope,
        `nodes[${index}].targetRef`,
      );
      if (
        unavailable.accessPolicy &&
        !accessPolicyChainImplies(
          [...ancestors, node.audience],
          unavailable.accessPolicy,
        )
      ) {
        throw new DeclarativeControlCompilationError(
          "AUDIENCE_WIDER_THAN_TARGET",
          `nodes[${index}].audience`,
          "Effective Navigation audience is wider than the last verified target audience.",
        );
      }
      return {
        ...node,
        disabled: true,
        parameterMapping: {},
        ancestorAccessPolicies: ancestors,
        resolvedTarget: {
          kind: "unavailable" as const,
          nodeId: node.nodeId,
          stableTargetRef: node.targetRef,
          accessPolicy: unavailable.accessPolicy,
        },
      };
    }
    if (
      !registration ||
      !released ||
      !sameStableRef(
        registration.stableTargetRef,
        stableFromRevision(registration.targetRevisionRef),
      ) ||
      !sameStableRef(registration.stableTargetRef, released.stableTargetRef) ||
      !sameRevisionRef(
        registration.targetRevisionRef,
        released.targetRevisionRef,
      ) ||
      (registration.kind === "route" &&
        (Boolean(registration.releaseRevisionRef) !==
          Boolean(released.releaseRevisionRef) ||
          (registration.releaseRevisionRef &&
            released.releaseRevisionRef &&
            !sameRevisionRef(
              registration.releaseRevisionRef,
              released.releaseRevisionRef,
            ))))
    ) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        `nodes[${index}].targetRef`,
        "Navigation target is not resolved to the exact active release recorded by NavigationRelease.",
      );
    }
    if (registration.surface !== release.target.surface) {
      throw new DeclarativeControlCompilationError(
        "NAV_TARGET_UNRELEASED",
        `nodes[${index}].targetRef`,
        "Navigation target is active on another surface.",
      );
    }
    assertTenantCompatible(
      registration.targetRevisionRef,
      scope,
      `nodes[${index}].targetRef`,
    );
    if (
      !accessPolicyChainImplies(
        [...ancestors, node.audience],
        registration.accessPolicy,
      )
    ) {
      throw new DeclarativeControlCompilationError(
        "AUDIENCE_WIDER_THAN_TARGET",
        `nodes[${index}].audience`,
        "Effective Navigation audience is wider than the target audience.",
      );
    }
    const mappedInput = Object.fromEntries(
      Object.entries(node.parameterMapping).map(([name, source]) => {
        if (source.kind !== "constant") {
          throw new DeclarativeControlCompilationError(
            "NAV_TARGET_UNRELEASED",
            `nodes[${index}].parameterMapping.${name}`,
            "Navigation actions accept only publication-time constant input.",
          );
        }
        return [name, source.value];
      }),
    );
    let resolvedTarget: Record<string, unknown>;
    if (registration.kind === "route") {
      resolvedTarget = {
        ...released,
        kind: "route",
        accessPolicy: registration.accessPolicy,
        routeClaim: registration.routeClaim,
      };
    } else if (registration.kind === "registered-menu-action") {
      if (!registration.inputSchemaRef && Object.keys(mappedInput).length > 0) {
        throw new DeclarativeControlCompilationError(
          "NAV_TARGET_UNRELEASED",
          `nodes[${index}].parameterMapping`,
          "The registered Menu Action does not accept input.",
        );
      }
      let input: Record<string, unknown>;
      try {
        input = JsonObjectSchema.parse(
          registration.validateInput
            ? registration.validateInput(mappedInput)
            : mappedInput,
        );
      } catch (error) {
        throw new DeclarativeControlCompilationError(
          "NAV_ACTION_INPUT_INVALID",
          `nodes[${index}].parameterMapping`,
          `Registered Menu Action input failed its active catalog schema: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const sourceDependency = release.dependencySnapshot.find(
        (dependency) =>
          dependency.role === "application-menu-catalog" &&
          sameRevisionRef(
            dependency.revisionRef,
            registration.sourceCatalogRevisionRef,
          ),
      );
      if (!sourceDependency)
        throw new DeclarativeControlCompilationError(
          "DEPENDENCY_MISSING",
          `nodes[${index}].targetRef`,
          "Registered Menu Action source catalog is not pinned by NavigationRelease.",
        );
      resolvedTarget = {
        ...released,
        kind: "registered-menu-action",
        accessPolicy: registration.accessPolicy,
        execution: "client",
        applicationId: registration.applicationId,
        actionRef: registration.actionRef,
        ...(registration.inputSchemaRef
          ? { inputSchemaRef: registration.inputSchemaRef }
          : {}),
        input,
        sourceCatalogRevisionRef: registration.sourceCatalogRevisionRef,
      };
    } else {
      const inputDependency = release.dependencySnapshot.find(
        (dependency) =>
          dependency.role === "schema" &&
          sameRevisionRef(
            dependency.revisionRef,
            registration.inputSchemaRevisionRef,
          ),
      );
      const resultDependency = registration.resultSchemaRevisionRef
        ? release.dependencySnapshot.find(
            (dependency) =>
              dependency.role === "schema" &&
              sameRevisionRef(
                dependency.revisionRef,
                registration.resultSchemaRevisionRef!,
              ),
          )
        : undefined;
      if (
        !inputDependency ||
        (registration.resultSchemaRevisionRef && !resultDependency)
      ) {
        throw new DeclarativeControlCompilationError(
          "DEPENDENCY_MISSING",
          `nodes[${index}].targetRef`,
          "Governed DomainCommand schemas are not pinned by NavigationRelease.",
        );
      }
      resolvedTarget = {
        ...released,
        kind: "governed-domain-command",
        accessPolicy: registration.accessPolicy,
        execution: "server",
        commandRevisionRef: registration.targetRevisionRef,
        inputSchemaRevisionRef: registration.inputSchemaRevisionRef,
        ...(registration.resultSchemaRevisionRef
          ? { resultSchemaRevisionRef: registration.resultSchemaRevisionRef }
          : {}),
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
    contract: "NavigationRuntimeBundle" as const,
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
  return deepFreeze(
    NavigationRuntimeBundleSchema.parse({
      ...unsigned,
      contentHash: canonicalContentHash(unsigned),
    }),
  );
};
export const validateWorkbenchRuntimeSet = (
  bundleInputs: readonly WorkbenchRuntimeBundle[],
): readonly WorkbenchRuntimeBundle[] => {
  const bundles = bundleInputs.map((bundle) =>
    WorkbenchRuntimeBundleSchema.parse(bundle),
  );
  if (bundles.length === 0) {
    throw new DeclarativeControlCompilationError(
      "WORKBENCH_RELEASE_SET_INVALID",
      "bundles",
      "An active Workbench release set must retain at least one Workbench.",
    );
  }
  const first = bundles[0];
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  let defaultCount = 0;
  bundles.forEach((bundle, index) => {
    if (
      scopeKey(bundle.tenantScope) !== scopeKey(first.tenantScope) ||
      bundle.surface !== first.surface ||
      !sameStableRef(bundle.target.environmentRef, first.target.environmentRef)
    ) {
      throw new DeclarativeControlCompilationError(
        "WORKBENCH_RELEASE_SET_INVALID",
        `bundles[${index}]`,
        "Workbench release set entries must share tenant, environment, and surface.",
      );
    }
    if (seenIds.has(bundle.workbenchId))
      throw new DeclarativeControlCompilationError(
        "WORKBENCH_RELEASE_SET_INVALID",
        `bundles[${index}].workbenchId`,
        "Workbench identities must be unique in an active release set.",
      );
    if (seenOrders.has(bundle.target.order))
      throw new DeclarativeControlCompilationError(
        "WORKBENCH_RELEASE_SET_INVALID",
        `bundles[${index}].target.order`,
        "Workbench order values must be unique in an active release set.",
      );
    seenIds.add(bundle.workbenchId);
    seenOrders.add(bundle.target.order);
    if (bundle.target.isDefaultCandidate) defaultCount += 1;
  });
  if (defaultCount > 1)
    throw new DeclarativeControlCompilationError(
      "WORKBENCH_RELEASE_SET_INVALID",
      "bundles",
      "An active Workbench release set may have at most one default candidate.",
    );
  return Object.freeze(
    [...bundles].sort(
      (left, right) =>
        left.target.order - right.target.order ||
        left.workbenchId.localeCompare(right.workbenchId),
    ),
  );
};
export type WorkbenchEntryResolution =
  | {
      status: "resolved";
      bundle: WorkbenchRuntimeBundle;
      source: "explicit" | "default" | "first-accessible";
    }
  | {
      status: "not-found";
      workbenchId: string;
    }
  | {
      status: "forbidden";
      workbenchId: string;
    };
export const resolveWorkbenchEntry = (input: {
  bundles: readonly WorkbenchRuntimeBundle[];
  requestedWorkbenchId?: string;
  isAllowed: (bundle: WorkbenchRuntimeBundle) => boolean;
}): WorkbenchEntryResolution => {
  if (input.requestedWorkbenchId) {
    const requested = input.bundles.find(
      (bundle) => bundle.workbenchId === input.requestedWorkbenchId,
    );
    if (!requested)
      return { status: "not-found", workbenchId: input.requestedWorkbenchId };
    if (!input.isAllowed(requested))
      return { status: "forbidden", workbenchId: input.requestedWorkbenchId };
    return { status: "resolved", bundle: requested, source: "explicit" };
  }
  const allowed = input.bundles
    .filter(input.isAllowed)
    .sort(
      (left, right) =>
        left.target.order - right.target.order ||
        left.workbenchId.localeCompare(right.workbenchId),
    );
  const defaultBundle = allowed.find(
    (bundle) => bundle.target.isDefaultCandidate,
  );
  if (defaultBundle)
    return { status: "resolved", bundle: defaultBundle, source: "default" };
  if (allowed[0])
    return {
      status: "resolved",
      bundle: allowed[0],
      source: "first-accessible",
    };
  return { status: "forbidden", workbenchId: "" };
};
