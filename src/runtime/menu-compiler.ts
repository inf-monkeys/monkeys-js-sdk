import { ContractIdentifierSchema, type JsonObject } from '../contracts/common';
import {
  CompiledMenuItemNodeSchema,
  CompiledMenuProjectionSchema,
  MENU_ACTIVATION_QUERY_PARAMETER,
  MENU_CONTRACT_VERSION,
  MenuActionRegistrationSchema,
  MenuBoundedInputSchema,
  MenuContributionProviderRegistrationSchema,
  MenuDefinitionSchema,
  MenuPageRefSchema,
  MenuPageRegistrationSchema,
  MenuRuntimeBundleSchema,
  type CompiledMenuItemNode,
  type CompiledMenuNode,
  type CompiledMenuProjection,
  type MenuAccessRequirement,
  type MenuActionRegistration,
  type MenuContributionProviderRegistration,
  type MenuDefinition,
  type MenuItemNode,
  type MenuNavigationTarget,
  type MenuPageRef,
  type MenuPageRegistration,
  type MenuRuntimeBundle,
  type MenuRuntimeInputBinding,
} from '../contracts/menu';

export type MenuCompilationErrorCode =
  | 'duplicate-definition'
  | 'duplicate-registration'
  | 'unsupported-surface'
  | 'invalid-page-application'
  | 'unknown-page'
  | 'unknown-action'
  | 'unknown-contribution-provider'
  | 'unsupported-contribution-surface'
  | 'unknown-permission'
  | 'missing-input-schema'
  | 'unknown-input-schema'
  | 'invalid-input'
  | 'conflicting-navigation-target';

export class MenuCompilationError extends Error {
  readonly code: MenuCompilationErrorCode;
  readonly path: string;

  constructor(code: MenuCompilationErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'MenuCompilationError';
    this.code = code;
    this.path = path;
  }
}

export type MenuInputValidator = (value: JsonObject) => unknown;

export interface CompileMenuRuntimeBundleInput {
  applicationId: string;
  supportedSurfaces: readonly string[];
  sourceVersion: string;
  definitions: readonly MenuDefinition[];
  pages: readonly MenuPageRegistration[];
  actions: readonly MenuActionRegistration[];
  contributionProviders: readonly MenuContributionProviderRegistration[];
  permissionCodes: readonly string[];
  inputValidators?: ReadonlyMap<string, MenuInputValidator>;
  sourceMap?: Readonly<Record<string, string>>;
}

export interface MenuAccessContext {
  sessionResolved: boolean;
  authenticated: boolean;
  permissionCodes: readonly string[];
  featureFlags: Readonly<Record<string, boolean>>;
  isKernelSuperAdmin?: boolean;
}

export type MenuAccessDenialReason =
  | 'session-unresolved'
  | 'authentication'
  | 'permission-all'
  | 'permission-any'
  | 'required-permission'
  | 'feature-flag';

export interface MenuAccessDecision {
  allowed: boolean;
  reasons: readonly MenuAccessDenialReason[];
}

export type MenuNavigationResolution =
  | { status: 'resolved'; target: MenuNavigationTarget }
  | { status: 'unmatched' }
  | { status: 'invalid'; reason: 'invalid-activation' | 'unknown-activation' | 'page-mismatch' };

export interface CompiledMenuRuntimeBundle {
  document: MenuRuntimeBundle;
  menusByKey: ReadonlyMap<string, CompiledMenuProjection>;
  navigationTargetsByKey: ReadonlyMap<string, MenuNavigationTarget>;
  serverInputByTargetKey: ReadonlyMap<string, JsonObject>;
  evaluateItemAccess(item: CompiledMenuItemNode, context: MenuAccessContext): MenuAccessDecision;
  resolveNavigationTarget(page: MenuPageRef, explicitActivationId?: string): MenuNavigationResolution;
  selectedNodeIds(menu: CompiledMenuProjection, page: MenuPageRef, activationId?: string): ReadonlySet<string>;
}

const menuKey = (applicationId: string, surface: string, menuId: string) =>
  `${applicationId}\u0000${surface}\u0000${menuId}`;

const pageKey = (page: MenuPageRef) => `${page.applicationId}\u0000${page.pageId}`;
const targetKey = (page: MenuPageRef, activationId: string) =>
  `${page.applicationId}\u0000${page.pageId}\u0000${activationId}`;
const actionKey = (applicationId: string, actionRef: string) => `${applicationId}\u0000${actionRef}`;
const providerKey = (applicationId: string, providerId: string) => `${applicationId}\u0000${providerId}`;

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

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child));
  return Object.freeze(value);
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
      words[index] = (
        (source[start] << 24)
        | (source[start + 1] << 16)
        | (source[start + 2] << 8)
        | source[start + 3]
      ) >>> 0;
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

const uniqueIndex = <T>(
  values: readonly T[],
  key: (value: T) => string,
  path: string,
): ReadonlyMap<string, T> => {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    const identity = key(value);
    if (result.has(identity)) {
      throw new MenuCompilationError(
        'duplicate-registration',
        `${path}[${index}]`,
        `Duplicate registry identity: ${identity.split('\u0000').join('/')}`,
      );
    }
    result.set(identity, value);
  });
  return result;
};

const normalizedSiblingOrder = <T extends { order: number; nodeId: string }>(left: T, right: T) =>
  left.order - right.order || left.nodeId.localeCompare(right.nodeId);

const normalizeNodeOrder = (nodes: readonly CompiledMenuNode[]): CompiledMenuNode[] => {
  const childrenByParent = new Map<string, CompiledMenuNode[]>();
  nodes.forEach((node) => {
    const parent = node.parentNodeId ?? '';
    const children = childrenByParent.get(parent) ?? [];
    children.push(node);
    childrenByParent.set(parent, children);
  });
  childrenByParent.forEach((children) => children.sort(normalizedSiblingOrder));

  const ordered: CompiledMenuNode[] = [];
  const appendChildren = (parentNodeId: string) => {
    for (const node of childrenByParent.get(parentNodeId) ?? []) {
      ordered.push(node);
      appendChildren(node.nodeId);
    }
  };
  appendChildren('');
  return ordered;
};

const requirementFromPage = (registration: MenuPageRegistration): MenuAccessRequirement => ({
  authenticated: registration.page.visibility.authenticated,
  permissionAllOf: registration.page.visibility.permissionAllOf,
  permissionAnyOf: registration.page.visibility.permissionAnyOf,
  featureFlags: registration.page.visibility.featureFlags,
});

const validatePermissionCodes = (
  permissions: readonly string[],
  knownPermissions: ReadonlySet<string>,
  path: string,
) => {
  permissions.forEach((permission, index) => {
    if (!knownPermissions.has(permission)) {
      throw new MenuCompilationError(
        'unknown-permission',
        `${path}[${index}]`,
        `Unknown platform permission: ${permission}`,
      );
    }
  });
};

const validateInput = (
  value: JsonObject,
  schemaRef: string | undefined,
  validators: ReadonlyMap<string, MenuInputValidator>,
  path: string,
): JsonObject => {
  if (!schemaRef) {
    throw new MenuCompilationError(
      'missing-input-schema',
      path,
      'Input is configured but the target has no input schema reference.',
    );
  }
  const validator = validators.get(schemaRef);
  if (!validator) {
    throw new MenuCompilationError(
      'unknown-input-schema',
      path,
      `No input validator is registered for ${schemaRef}.`,
    );
  }
  try {
    return MenuBoundedInputSchema.parse(validator(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MenuCompilationError('invalid-input', path, `Input validation failed for ${schemaRef}: ${message}`);
  }
};

const evaluateAccess = (item: CompiledMenuItemNode, context: MenuAccessContext): MenuAccessDecision => {
  const reasons: MenuAccessDenialReason[] = [];
  const protectedBySession = item.access.authenticated
    || item.access.permissionAllOf.length > 0
    || item.access.permissionAnyOf.length > 0
    || item.access.requiredPermission !== undefined;
  if (!context.sessionResolved && protectedBySession) reasons.push('session-unresolved');
  if (item.access.authenticated && !context.authenticated) reasons.push('authentication');

  const granted = new Set(context.permissionCodes);
  const elevated = context.isKernelSuperAdmin === true || granted.has('*');
  if (item.access.permissionAllOf.some((permission) => !granted.has(permission))) {
    reasons.push('permission-all');
  }
  if (
    item.access.permissionAnyOf.length > 0
    && !item.access.permissionAnyOf.some((permission) => granted.has(permission))
  ) {
    reasons.push('permission-any');
  }
  if (!elevated && item.access.requiredPermission && !granted.has(item.access.requiredPermission)) {
    reasons.push('required-permission');
  }
  if (item.access.featureFlags.some((flag) => context.featureFlags[flag] !== true)) {
    reasons.push('feature-flag');
  }
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
};

export const resolveMenuActivationId = (page: MenuPageRef, activationId?: string): string =>
  activationId ?? page.pageId;

export const readMenuActivationFromSearch = (search: string | URLSearchParams): string | undefined => {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const value = params.get(MENU_ACTIVATION_QUERY_PARAMETER)?.trim();
  return value || undefined;
};

export const serializeMenuActivationSearch = (
  search: string | URLSearchParams,
  page: MenuPageRef,
  activationId?: string,
): string => {
  const params = new URLSearchParams(typeof search === 'string' ? search : search.toString());
  const effectiveActivationId = resolveMenuActivationId(page, activationId);
  if (effectiveActivationId === page.pageId) params.delete(MENU_ACTIVATION_QUERY_PARAMETER);
  else params.set(MENU_ACTIVATION_QUERY_PARAMETER, effectiveActivationId);
  return params.toString();
};

export const isCompiledMenuItemSelected = (
  item: CompiledMenuItemNode,
  page: MenuPageRef,
  activationId?: string,
): boolean => item.behavior.kind === 'navigate'
  && pageKey(item.behavior.page) === pageKey(page)
  && item.behavior.activationId === resolveMenuActivationId(page, activationId);

/** Compiles source definitions into one browser-safe application bundle and a server-only input index. */
export const compileMenuRuntimeBundle = (
  input: CompileMenuRuntimeBundleInput,
): CompiledMenuRuntimeBundle => {
  const applicationId = ContractIdentifierSchema.parse(input.applicationId);
  const supportedSurfaces = new Set(input.supportedSurfaces.map((surface) => ContractIdentifierSchema.parse(surface)));
  const definitions = input.definitions.map((definition) => MenuDefinitionSchema.parse(definition));
  const pages = input.pages.map((registration) => MenuPageRegistrationSchema.parse(registration));
  const actions = input.actions.map((registration) => MenuActionRegistrationSchema.parse(registration));
  const contributionProviders = input.contributionProviders.map((registration) =>
    MenuContributionProviderRegistrationSchema.parse(registration));
  const inputValidators = input.inputValidators ?? new Map<string, MenuInputValidator>();
  const knownPermissions = new Set(input.permissionCodes.map((permission) => ContractIdentifierSchema.parse(permission)));
  pages.forEach((registration, index) => {
    if (!registration.page.visibility.productContexts.some((context) => context === registration.applicationId)) {
      throw new MenuCompilationError(
        'invalid-page-application',
        `pages[${index}].applicationId`,
        `Page ${registration.page.pageId} is not visible in ${registration.applicationId}.`,
      );
    }
  });
  const pagesByKey = uniqueIndex(pages, (registration) => pageKey({
    applicationId: registration.applicationId,
    pageId: registration.page.pageId,
  }), 'pages');
  const actionsByKey = uniqueIndex(actions, (registration) => actionKey(
    registration.applicationId,
    registration.actionRef,
  ), 'actions');
  const providersByKey = uniqueIndex(contributionProviders, (registration) => providerKey(
    registration.applicationId,
    registration.providerId,
  ), 'contributionProviders');

  const definitionsByKey = new Map<string, MenuDefinition>();
  definitions.forEach((definition, index) => {
    const identity = menuKey(definition.applicationId, definition.surface, definition.menuId);
    if (definitionsByKey.has(identity)) {
      throw new MenuCompilationError(
        'duplicate-definition',
        `definitions[${index}]`,
        `Duplicate menu definition: ${definition.applicationId}/${definition.surface}/${definition.menuId}`,
      );
    }
    definitionsByKey.set(identity, definition);
  });

  const targetSourceSignatures = new Map<string, string>();
  const navigationTargetsByKey = new Map<string, MenuNavigationTarget>();
  const serverInputByTargetKey = new Map<string, JsonObject>();
  const requestedTargetKeys = new Set<string>();
  const requestedMenus: CompiledMenuProjection[] = [];

  definitions.forEach((definition, definitionIndex) => {
    if (definition.applicationId === applicationId && !supportedSurfaces.has(definition.surface)) {
      throw new MenuCompilationError(
        'unsupported-surface',
        `definitions[${definitionIndex}].surface`,
        `Application ${applicationId} does not support menu surface ${definition.surface}.`,
      );
    }
    const compiledNodes: CompiledMenuNode[] = definition.nodes.map((node, nodeIndex) => {
      if (node.kind !== 'item') return node;
      const nodePath = `definitions[${definitionIndex}].nodes[${nodeIndex}]`;
      if (node.requiredPermission && !knownPermissions.has(node.requiredPermission)) {
        throw new MenuCompilationError(
          'unknown-permission',
          `${nodePath}.requiredPermission`,
          `Unknown platform permission: ${node.requiredPermission}`,
        );
      }

      let access: MenuAccessRequirement;
      if (node.behavior.kind === 'navigate') {
        const registration = pagesByKey.get(pageKey(node.behavior.page));
        if (!registration) {
          throw new MenuCompilationError(
            'unknown-page',
            `${nodePath}.behavior.page`,
            `Unknown page reference: ${node.behavior.page.applicationId}/${node.behavior.page.pageId}`,
          );
        }
        access = requirementFromPage(registration);
        validatePermissionCodes(access.permissionAllOf, knownPermissions, `${nodePath}.targetAccess.permissionAllOf`);
        validatePermissionCodes(access.permissionAnyOf, knownPermissions, `${nodePath}.targetAccess.permissionAnyOf`);

        const activationId = resolveMenuActivationId(node.behavior.page, node.behavior.activationId);
        const identity = targetKey(node.behavior.page, activationId);
        let runtimeInput: MenuRuntimeInputBinding | undefined;
        let normalizedSourceInput: unknown;
        if (node.behavior.input) {
          const normalized = validateInput(
            node.behavior.input.value,
            registration.page.input?.schemaRef,
            inputValidators,
            `${nodePath}.behavior.input.value`,
          );
          normalizedSourceInput = { exposure: node.behavior.input.exposure, value: normalized };
          runtimeInput = node.behavior.input.exposure === 'client'
            ? { exposure: 'client', value: normalized }
            : { exposure: 'server' };
          if (node.behavior.input.exposure === 'server' && definition.applicationId === applicationId) {
            serverInputByTargetKey.set(identity, deepFreeze(normalized));
          }
        }
        const signature = stableSerialize({
          kind: 'navigate',
          page: node.behavior.page,
          activationId,
          input: normalizedSourceInput,
        });
        const existingSignature = targetSourceSignatures.get(identity);
        if (existingSignature !== undefined && existingSignature !== signature) {
          throw new MenuCompilationError(
            'conflicting-navigation-target',
            `${nodePath}.behavior`,
            `Navigation target ${node.behavior.page.applicationId}/${node.behavior.page.pageId}/${activationId} has conflicting behavior or input.`,
          );
        }
        targetSourceSignatures.set(identity, signature);
        if (!navigationTargetsByKey.has(identity)) {
          navigationTargetsByKey.set(identity, {
            page: node.behavior.page,
            activationId,
            input: runtimeInput,
          });
        }
        if (definition.applicationId === applicationId) requestedTargetKeys.add(identity);

        const { requiredPermission, behavior: _behavior, ...presentation } = node;
        return CompiledMenuItemNodeSchema.parse({
          ...presentation,
          behavior: {
            kind: 'navigate',
            page: node.behavior.page,
            activationId,
            input: runtimeInput,
          },
          access: { ...access, requiredPermission },
        });
      }

      const action = actionsByKey.get(actionKey(definition.applicationId, node.behavior.actionRef));
      if (!action) {
        throw new MenuCompilationError(
          'unknown-action',
          `${nodePath}.behavior.actionRef`,
          `Unknown action reference for ${definition.applicationId}: ${node.behavior.actionRef}`,
        );
      }
      access = action.access;
      validatePermissionCodes(access.permissionAllOf, knownPermissions, `${nodePath}.targetAccess.permissionAllOf`);
      validatePermissionCodes(access.permissionAnyOf, knownPermissions, `${nodePath}.targetAccess.permissionAnyOf`);
      const actionInput = node.behavior.input
        ? validateInput(node.behavior.input, action.inputSchemaRef, inputValidators, `${nodePath}.behavior.input`)
        : undefined;
      const { requiredPermission, behavior: _behavior, ...presentation } = node;
      return CompiledMenuItemNodeSchema.parse({
        ...presentation,
        behavior: { kind: 'action', actionRef: node.behavior.actionRef, input: actionInput },
        access: { ...access, requiredPermission },
      });
    });

    definition.contributions.forEach((contribution, contributionIndex) => {
      const provider = providersByKey.get(providerKey(definition.applicationId, contribution.providerId));
      const path = `definitions[${definitionIndex}].contributions[${contributionIndex}].providerId`;
      if (!provider) {
        throw new MenuCompilationError(
          'unknown-contribution-provider',
          path,
          `Unknown contribution provider for ${definition.applicationId}: ${contribution.providerId}`,
        );
      }
      if (provider.surfaces && !provider.surfaces.includes(definition.surface)) {
        throw new MenuCompilationError(
          'unsupported-contribution-surface',
          path,
          `Provider ${contribution.providerId} does not support surface ${definition.surface}.`,
        );
      }
    });

    if (definition.applicationId !== applicationId) return;
    requestedMenus.push(CompiledMenuProjectionSchema.parse({
      applicationId: definition.applicationId,
      surface: definition.surface,
      menuId: definition.menuId,
      nodes: normalizeNodeOrder(compiledNodes),
      contributions: [...definition.contributions].sort((left, right) =>
        (left.parentNodeId ?? '').localeCompare(right.parentNodeId ?? '')
        || left.order - right.order
        || left.providerId.localeCompare(right.providerId)),
    }));
  });

  const menus = requestedMenus.sort((left, right) =>
    left.surface.localeCompare(right.surface) || left.menuId.localeCompare(right.menuId));
  const navigationTargets = [...requestedTargetKeys]
    .map((identity) => navigationTargetsByKey.get(identity))
    .filter((target): target is MenuNavigationTarget => target !== undefined)
    .sort((left, right) =>
      left.page.applicationId.localeCompare(right.page.applicationId)
      || left.page.pageId.localeCompare(right.page.pageId)
      || left.activationId.localeCompare(right.activationId));
  const unsignedDocument = {
    contract: 'MenuRuntimeBundle' as const,
    version: MENU_CONTRACT_VERSION,
    applicationId,
    sourceVersion: input.sourceVersion,
    menus,
    navigationTargets,
    sourceMap: Object.fromEntries(
      Object.entries(input.sourceMap ?? {}).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  const document = MenuRuntimeBundleSchema.parse({
    ...unsignedDocument,
    contentHash: sha256Hex(stableSerialize(unsignedDocument)),
  });
  const menusByKey = new Map(document.menus.map((menu) => [
    menuKey(menu.applicationId, menu.surface, menu.menuId),
    menu,
  ]));
  const documentTargetsByKey = new Map(document.navigationTargets.map((target) => [
    targetKey(target.page, target.activationId),
    target,
  ]));

  const resolveNavigationTarget = (page: MenuPageRef, explicitActivationId?: string): MenuNavigationResolution => {
    const parsedPage = MenuPageRefSchema.parse(page);
    if (explicitActivationId !== undefined) {
      const parsedActivation = ContractIdentifierSchema.safeParse(explicitActivationId);
      if (!parsedActivation.success) return Object.freeze({ status: 'invalid', reason: 'invalid-activation' });
      const target = documentTargetsByKey.get(targetKey(parsedPage, parsedActivation.data));
      if (target) return Object.freeze({ status: 'resolved', target });
      const sameActivation = document.navigationTargets.find((candidate) =>
        candidate.page.applicationId === parsedPage.applicationId
        && candidate.activationId === parsedActivation.data);
      return Object.freeze({
        status: 'invalid',
        reason: sameActivation ? 'page-mismatch' : 'unknown-activation',
      });
    }
    const target = documentTargetsByKey.get(targetKey(parsedPage, parsedPage.pageId));
    return target
      ? Object.freeze({ status: 'resolved', target })
      : Object.freeze({ status: 'unmatched' });
  };

  return Object.freeze({
    document: deepFreeze(document),
    menusByKey,
    navigationTargetsByKey: documentTargetsByKey,
    serverInputByTargetKey,
    evaluateItemAccess: evaluateAccess,
    resolveNavigationTarget,
    selectedNodeIds(menu: CompiledMenuProjection, page: MenuPageRef, activationId?: string) {
      if (menu.applicationId !== document.applicationId) return new Set<string>();
      const nodesById = new Map(menu.nodes.map((node) => [node.nodeId, node]));
      const selected = new Set<string>();
      for (const node of menu.nodes) {
        if (node.kind !== 'item' || !isCompiledMenuItemSelected(node, page, activationId)) continue;
        selected.add(node.nodeId);
        let parentNodeId = node.parentNodeId;
        while (parentNodeId) {
          selected.add(parentNodeId);
          parentNodeId = nodesById.get(parentNodeId)?.parentNodeId;
        }
      }
      return selected;
    },
  });
};
