import { z } from 'zod';
import {
  ContractIdentifierSchema,
  JsonObjectSchema,
  LocalizedTextSchema,
  Sha256Schema,
} from './common';
import { PageDefinitionSchema } from './page';

export const MENU_ACTIVATION_QUERY_PARAMETER = '__menuActivation';
export const MENU_CONTRACT_VERSION = 1;
export const MENU_MAX_DEFINITIONS = 128;
export const MENU_MAX_NODES = 1_024;
export const MENU_MAX_TREE_DEPTH = 16;
export const MENU_MAX_INPUT_BYTES = 64 * 1_024;
export const MENU_MAX_INPUT_VALUES = 2_048;

const MenuOrderSchema = z.number().int().min(-1_000_000).max(1_000_000);

const inspectJsonValue = (value: unknown): { bytes: number; depth: number; values: number } => {
  let maxDepth = 0;
  let values = 0;
  const visit = (candidate: unknown, depth: number) => {
    values += 1;
    maxDepth = Math.max(maxDepth, depth);
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (candidate && typeof candidate === 'object') {
      Object.values(candidate as Record<string, unknown>).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(value, 1);
  return {
    bytes: new TextEncoder().encode(JSON.stringify(value)).byteLength,
    depth: maxDepth,
    values,
  };
};

export const MenuBoundedInputSchema = JsonObjectSchema.superRefine((value, context) => {
  const bounds = inspectJsonValue(value);
  if (bounds.bytes > MENU_MAX_INPUT_BYTES) {
    context.addIssue({
      code: 'custom',
      message: `Menu input exceeds ${MENU_MAX_INPUT_BYTES} UTF-8 bytes.`,
    });
  }
  if (bounds.depth > MENU_MAX_TREE_DEPTH) {
    context.addIssue({
      code: 'custom',
      message: `Menu input exceeds maximum depth ${MENU_MAX_TREE_DEPTH}.`,
    });
  }
  if (bounds.values > MENU_MAX_INPUT_VALUES) {
    context.addIssue({
      code: 'custom',
      message: `Menu input exceeds ${MENU_MAX_INPUT_VALUES} values.`,
    });
  }
});

export const MenuPageRefSchema = z
  .object({
    applicationId: ContractIdentifierSchema,
    pageId: ContractIdentifierSchema,
  })
  .strict();

export const MenuSourceInputBindingSchema = z.discriminatedUnion('exposure', [
  z.object({ exposure: z.literal('client'), value: MenuBoundedInputSchema }).strict(),
  z.object({ exposure: z.literal('server'), value: MenuBoundedInputSchema }).strict(),
]);

export const MenuRuntimeInputBindingSchema = z.discriminatedUnion('exposure', [
  z.object({ exposure: z.literal('client'), value: MenuBoundedInputSchema }).strict(),
  z.object({ exposure: z.literal('server') }).strict(),
]);

export const MenuNavigateBehaviorSchema = z
  .object({
    kind: z.literal('navigate'),
    page: MenuPageRefSchema,
    activationId: ContractIdentifierSchema.optional(),
    input: MenuSourceInputBindingSchema.optional(),
  })
  .strict();

export const MenuActionBehaviorSchema = z
  .object({
    kind: z.literal('action'),
    actionRef: ContractIdentifierSchema,
    input: MenuBoundedInputSchema.optional(),
  })
  .strict();

export const MenuBehaviorSchema = z.discriminatedUnion('kind', [
  MenuNavigateBehaviorSchema,
  MenuActionBehaviorSchema,
]);

const MenuNodeBaseShape = {
  nodeId: ContractIdentifierSchema,
  parentNodeId: ContractIdentifierSchema.optional(),
  order: MenuOrderSchema,
};

export const MenuGroupNodeSchema = z
  .object({
    ...MenuNodeBaseShape,
    kind: z.literal('group'),
    label: LocalizedTextSchema.optional(),
    iconRef: ContractIdentifierSchema.optional(),
  })
  .strict();

export const MenuDividerNodeSchema = z
  .object({
    ...MenuNodeBaseShape,
    kind: z.literal('divider'),
  })
  .strict();

export const MenuItemNodeSchema = z
  .object({
    ...MenuNodeBaseShape,
    kind: z.literal('item'),
    label: LocalizedTextSchema,
    iconRef: ContractIdentifierSchema.optional(),
    tone: z.enum(['default', 'danger']).optional(),
    requiredPermission: ContractIdentifierSchema.optional(),
    behavior: MenuBehaviorSchema,
  })
  .strict();

export const MenuNodeSchema = z.discriminatedUnion('kind', [
  MenuGroupNodeSchema,
  MenuDividerNodeSchema,
  MenuItemNodeSchema,
]);

export const MenuContributionSchema = z
  .object({
    providerId: ContractIdentifierSchema,
    parentNodeId: ContractIdentifierSchema.optional(),
    order: MenuOrderSchema,
  })
  .strict();

const validateMenuStructure = (
  menu: {
    nodes: z.infer<typeof MenuNodeSchema>[];
    contributions: z.infer<typeof MenuContributionSchema>[];
  },
  context: z.RefinementCtx,
) => {
  const nodesById = new Map<string, { node: z.infer<typeof MenuNodeSchema>; index: number }>();
  menu.nodes.forEach((node, index) => {
    if (nodesById.has(node.nodeId)) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'nodeId'],
        message: `Duplicate menu nodeId: ${node.nodeId}`,
      });
      return;
    }
    nodesById.set(node.nodeId, { node, index });
  });

  const validateParent = (parentNodeId: string | undefined, path: (string | number)[]) => {
    if (!parentNodeId) return;
    const parent = nodesById.get(parentNodeId);
    if (!parent) {
      context.addIssue({ code: 'custom', path, message: `Unknown menu parentNodeId: ${parentNodeId}` });
      return;
    }
    if (parent.node.kind !== 'group') {
      context.addIssue({ code: 'custom', path, message: `Menu parent ${parentNodeId} must be a group.` });
    }
  };

  menu.nodes.forEach((node, index) => validateParent(node.parentNodeId, ['nodes', index, 'parentNodeId']));
  menu.contributions.forEach((contribution, index) =>
    validateParent(contribution.parentNodeId, ['contributions', index, 'parentNodeId']));

  menu.nodes.forEach((node, index) => {
    const ancestors = new Set([node.nodeId]);
    let parentNodeId = node.parentNodeId;
    let depth = 1;
    while (parentNodeId) {
      if (ancestors.has(parentNodeId)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'parentNodeId'],
          message: `Menu node cycle contains ${node.nodeId}.`,
        });
        break;
      }
      ancestors.add(parentNodeId);
      depth += 1;
      if (depth > MENU_MAX_TREE_DEPTH) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'parentNodeId'],
          message: `Menu tree exceeds maximum depth ${MENU_MAX_TREE_DEPTH}.`,
        });
        break;
      }
      parentNodeId = nodesById.get(parentNodeId)?.node.parentNodeId;
    }
  });

  const contributionKeys = new Set<string>();
  menu.contributions.forEach((contribution, index) => {
    const key = `${contribution.parentNodeId ?? ''}\u0000${contribution.providerId}`;
    if (contributionKeys.has(key)) {
      context.addIssue({
        code: 'custom',
        path: ['contributions', index, 'providerId'],
        message: `Duplicate menu contribution provider at parent: ${contribution.providerId}`,
      });
    }
    contributionKeys.add(key);
  });
};

export const MenuDefinitionSchema = z
  .object({
    contract: z.literal('MenuDefinition'),
    version: z.literal(MENU_CONTRACT_VERSION),
    applicationId: ContractIdentifierSchema,
    surface: ContractIdentifierSchema,
    menuId: ContractIdentifierSchema,
    nodes: z.array(MenuNodeSchema).max(MENU_MAX_NODES),
    contributions: z.array(MenuContributionSchema).max(MENU_MAX_NODES).default([]),
  })
  .strict()
  .superRefine(validateMenuStructure);

export const MenuDefinitionSetSchema = z.union([
  z.literal('*'),
  z
    .object({
      version: z.literal(MENU_CONTRACT_VERSION),
      definitions: z.array(MenuDefinitionSchema).max(MENU_MAX_DEFINITIONS),
    })
    .strict(),
]);

export const MenuAccessRequirementSchema = z
  .object({
    authenticated: z.boolean().default(true),
    permissionAllOf: z.array(ContractIdentifierSchema).default([]),
    permissionAnyOf: z.array(ContractIdentifierSchema).default([]),
    featureFlags: z.array(ContractIdentifierSchema).default([]),
  })
  .strict();

export const MenuPageRegistrationSchema = z
  .object({
    applicationId: ContractIdentifierSchema,
    page: PageDefinitionSchema,
  })
  .strict();

export const MenuActionRegistrationSchema = z
  .object({
    applicationId: ContractIdentifierSchema,
    actionRef: ContractIdentifierSchema,
    inputSchemaRef: ContractIdentifierSchema.optional(),
    access: MenuAccessRequirementSchema,
  })
  .strict();

export const MenuContributionProviderRegistrationSchema = z
  .object({
    applicationId: ContractIdentifierSchema,
    providerId: ContractIdentifierSchema,
    surfaces: z.array(ContractIdentifierSchema).min(1).optional(),
  })
  .strict();

export const CompiledMenuNavigateBehaviorSchema = z
  .object({
    kind: z.literal('navigate'),
    page: MenuPageRefSchema,
    activationId: ContractIdentifierSchema,
    input: MenuRuntimeInputBindingSchema.optional(),
  })
  .strict();

export const CompiledMenuActionBehaviorSchema = z
  .object({
    kind: z.literal('action'),
    actionRef: ContractIdentifierSchema,
    input: MenuBoundedInputSchema.optional(),
  })
  .strict();

export const CompiledMenuBehaviorSchema = z.discriminatedUnion('kind', [
  CompiledMenuNavigateBehaviorSchema,
  CompiledMenuActionBehaviorSchema,
]);

export const CompiledMenuItemAccessSchema = MenuAccessRequirementSchema.extend({
  requiredPermission: ContractIdentifierSchema.optional(),
}).strict();

export const CompiledMenuGroupNodeSchema = MenuGroupNodeSchema;
export const CompiledMenuDividerNodeSchema = MenuDividerNodeSchema;
export const CompiledMenuItemNodeSchema = MenuItemNodeSchema.omit({ behavior: true, requiredPermission: true }).extend({
  behavior: CompiledMenuBehaviorSchema,
  access: CompiledMenuItemAccessSchema,
}).strict();

export const CompiledMenuNodeSchema = z.discriminatedUnion('kind', [
  CompiledMenuGroupNodeSchema,
  CompiledMenuDividerNodeSchema,
  CompiledMenuItemNodeSchema,
]);

export const CompiledMenuProjectionSchema = z
  .object({
    applicationId: ContractIdentifierSchema,
    surface: ContractIdentifierSchema,
    menuId: ContractIdentifierSchema,
    nodes: z.array(CompiledMenuNodeSchema).max(MENU_MAX_NODES),
    contributions: z.array(MenuContributionSchema).max(MENU_MAX_NODES),
  })
  .strict();

export const MenuNavigationTargetSchema = z
  .object({
    page: MenuPageRefSchema,
    activationId: ContractIdentifierSchema,
    input: MenuRuntimeInputBindingSchema.optional(),
  })
  .strict();

export const MenuRuntimeBundleSchema = z
  .object({
    contract: z.literal('MenuRuntimeBundle'),
    version: z.literal(MENU_CONTRACT_VERSION),
    applicationId: ContractIdentifierSchema,
    sourceVersion: ContractIdentifierSchema,
    contentHash: Sha256Schema,
    menus: z.array(CompiledMenuProjectionSchema).max(MENU_MAX_DEFINITIONS),
    navigationTargets: z.array(MenuNavigationTargetSchema),
    sourceMap: z.record(z.string(), ContractIdentifierSchema).default({}),
  })
  .strict();

export const MenuContributionResultSchema = z
  .object({
    contract: z.literal('MenuContributionResult'),
    applicationId: ContractIdentifierSchema,
    surface: ContractIdentifierSchema,
    menuId: ContractIdentifierSchema,
    providerId: ContractIdentifierSchema,
    nodes: z.array(CompiledMenuNodeSchema).max(MENU_MAX_NODES),
  })
  .strict();

export type MenuPageRef = z.infer<typeof MenuPageRefSchema>;
export type MenuSourceInputBinding = z.infer<typeof MenuSourceInputBindingSchema>;
export type MenuRuntimeInputBinding = z.infer<typeof MenuRuntimeInputBindingSchema>;
export type MenuNavigateBehavior = z.infer<typeof MenuNavigateBehaviorSchema>;
export type MenuActionBehavior = z.infer<typeof MenuActionBehaviorSchema>;
export type MenuBehavior = z.infer<typeof MenuBehaviorSchema>;
export type MenuGroupNode = z.infer<typeof MenuGroupNodeSchema>;
export type MenuDividerNode = z.infer<typeof MenuDividerNodeSchema>;
export type MenuItemNode = z.infer<typeof MenuItemNodeSchema>;
export type MenuNode = z.infer<typeof MenuNodeSchema>;
export type MenuContribution = z.infer<typeof MenuContributionSchema>;
export type MenuDefinition = z.infer<typeof MenuDefinitionSchema>;
export type MenuDefinitionSet = z.infer<typeof MenuDefinitionSetSchema>;
export type MenuAccessRequirement = z.infer<typeof MenuAccessRequirementSchema>;
export type MenuPageRegistration = z.infer<typeof MenuPageRegistrationSchema>;
export type MenuActionRegistration = z.infer<typeof MenuActionRegistrationSchema>;
export type MenuContributionProviderRegistration = z.infer<typeof MenuContributionProviderRegistrationSchema>;
export type CompiledMenuBehavior = z.infer<typeof CompiledMenuBehaviorSchema>;
export type CompiledMenuItemNode = z.infer<typeof CompiledMenuItemNodeSchema>;
export type CompiledMenuNode = z.infer<typeof CompiledMenuNodeSchema>;
export type CompiledMenuProjection = z.infer<typeof CompiledMenuProjectionSchema>;
export type MenuNavigationTarget = z.infer<typeof MenuNavigationTargetSchema>;
export type MenuRuntimeBundle = z.infer<typeof MenuRuntimeBundleSchema>;
export type MenuContributionResult = z.infer<typeof MenuContributionResultSchema>;
