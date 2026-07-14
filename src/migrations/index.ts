import type { CapabilityManifestV1 } from '../contracts/capability';
import type { JsonValue } from '../contracts/common';
import { JsonValueSchema } from '../contracts/common';
import type { ThemeTokensV1 } from '../contracts/theme';
import type { WorkflowDefinitionV2 } from '../contracts/workflow-definition';
import {
  CapabilityManifestV1Schema,
  ThemeTokensV1Schema,
  WorkflowDefinitionV2Schema,
} from '../schemas';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value: unknown, name: string): UnknownRecord {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object.`);
  return value;
}

function readString(value: unknown, fallback?: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (fallback) return fallback;
  throw new TypeError('Expected a non-empty string.');
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function asJsonValue(value: unknown): JsonValue {
  return JsonValueSchema.parse(value);
}

export interface WorkflowDefinitionMigrationOptions {
  workflowId?: string;
  teamId?: string;
  ownerRepo?: string;
}

export function migrateLegacyWorkflowDefinition(
  input: unknown,
  options: WorkflowDefinitionMigrationOptions = {},
): WorkflowDefinitionV2 {
  const legacy = requireRecord(input, 'Legacy workflow definition');
  if (legacy.contract === 'WorkflowDefinition' && legacy.version === 2) {
    return WorkflowDefinitionV2Schema.parse(legacy);
  }

  const rawTasks = Array.isArray(legacy.tasks)
    ? legacy.tasks
    : isRecord(legacy.workflowDef) && Array.isArray(legacy.workflowDef.tasks)
      ? legacy.workflowDef.tasks
      : [];
  const nodes = rawTasks.map((task, index) => {
    const source = requireRecord(task, `tasks[${index}]`);
    const referenceName = readString(
      source.taskReferenceName ?? source.referenceName ?? source.name,
      `task-${index + 1}`,
    );
    const capabilityName = readString(source.name ?? source.type, referenceName);
    return {
      id: referenceName,
      referenceName,
      capabilityRef: capabilityName,
      capabilityVersion: typeof source.version === 'string' ? source.version : undefined,
      inputBindings: isRecord(source.inputParameters)
        ? asJsonValue(source.inputParameters) as Record<string, JsonValue>
        : {},
      configuration: asJsonValue(source) as Record<string, JsonValue>,
    };
  });
  const edges = nodes.slice(1).map((node, index) => ({
    from: nodes[index].id,
    to: node.id,
  }));
  const workflowId = readString(options.workflowId ?? legacy.workflowId ?? legacy.id);
  const workflowVersion = readPositiveInteger(legacy.version, 1);

  return WorkflowDefinitionV2Schema.parse({
    contract: 'WorkflowDefinition',
    version: 2,
    metadata: {
      id: workflowId,
      version: workflowVersion,
      name: typeof legacy.displayName === 'string' ? legacy.displayName : workflowId,
      description: typeof legacy.description === 'string' ? legacy.description : undefined,
      role: legacy.role === 'template' ? 'template' : 'workflow',
      teamId: options.teamId ?? (typeof legacy.teamId === 'string' ? legacy.teamId : undefined),
      creatorRef: typeof legacy.creatorUserId === 'string' ? legacy.creatorUserId : undefined,
      tags: Array.isArray(legacy.tags) ? legacy.tags.filter((item): item is string => typeof item === 'string') : [],
    },
    ports: { inputs: [], outputs: [] },
    graph: { nodes, edges },
    execution: {
      retries: 0,
      idempotency: 'supported',
      rateLimit: isRecord(legacy.rateLimiter) && legacy.rateLimiter.enabled === true
        ? {
            max: readPositiveInteger(legacy.rateLimiter.max, 1),
            windowMs: readPositiveInteger(legacy.rateLimiter.windowMs, 60_000),
          }
        : undefined,
    },
    triggers: legacy.trigger
      ? [{
          id: 'legacy-trigger',
          type: isRecord(legacy.trigger) && legacy.trigger.triggerType === 'SCHEDULER'
            ? 'schedule'
            : isRecord(legacy.trigger) && legacy.trigger.triggerType === 'WEBHOOK'
              ? 'webhook'
              : 'manual',
          configuration: asJsonValue(legacy.trigger) as Record<string, JsonValue>,
        }]
      : [],
    views: [],
    dataContracts: { reads: [], writes: [], emits: [] },
    migration: {
      sourceContract: 'MonkeyWorkflow',
      sourceVersion: workflowVersion,
      ownerRepo: options.ownerRepo ?? 'unknown',
      legacy: asJsonValue(legacy),
    },
  });
}

export interface ThemeTokensMigrationOptions {
  id?: string;
  name?: string;
}

export function migrateLegacyThemeTokens(
  input: unknown,
  options: ThemeTokensMigrationOptions = {},
): ThemeTokensV1 {
  const legacy = requireRecord(input, 'Legacy theme config');
  if (legacy.contract === 'ThemeTokens' && legacy.version === 1) {
    return ThemeTokensV1Schema.parse(legacy);
  }
  const tokens = isRecord(legacy.tokens) ? legacy.tokens : {};
  const colors = isRecord(legacy.colors) ? legacy.colors : {};
  const primaryColor = readString(tokens.primaryColor ?? colors.primaryColor, '#4D8F9D');
  const radius = readString(tokens.radius ?? legacy.roundedSize, '0.5rem');
  const mode = readString(tokens.mode ?? legacy.themeMode, 'shadow');

  return ThemeTokensV1Schema.parse({
    contract: 'ThemeTokens',
    version: 1,
    metadata: {
      id: options.id ?? readString(legacy.id, 'default'),
      version: 1,
      name: options.name ?? readString(legacy.name, 'Monkeys Theme'),
      packageName: '@inf-monkeys-tech/monkeys-design',
    },
    seed: {
      'color.primary': { $type: 'color', $value: primaryColor },
      'radius.default': { $type: 'dimension', $value: radius },
      'appearance.mode': { $type: 'string', $value: mode },
    },
    semantic: {},
    component: {},
    assets: {
      logo: typeof legacy.logo === 'string' ? legacy.logo : undefined,
      favicon: typeof legacy.favicon === 'string' ? legacy.favicon : undefined,
      fontFamilies: [],
      icons: {},
    },
    modes: {
      color: ['light', 'dark'],
      density: ['compact', 'default', 'comfortable'],
    },
    compatibility: {
      cssVariableAliases: {
        '--monkeys-primary': 'seed.color.primary',
        '--radius': 'seed.radius.default',
      },
      deprecatedTokenKeys: [],
    },
    migration: { sourceContract: 'MonkeysThemeConfig', legacy: asJsonValue(legacy) },
  });
}

export interface CapabilityMigrationOptions {
  ownerRepo: string;
  capabilityVersion?: string;
  providerRef?: string;
}

export function migrateLegacyCapabilityManifest(
  input: unknown,
  options: CapabilityMigrationOptions,
): CapabilityManifestV1 {
  const legacy = requireRecord(input, 'Legacy capability manifest');
  if (legacy.contract === 'CapabilityManifest' && legacy.version === 1) {
    return CapabilityManifestV1Schema.parse(legacy);
  }
  const id = readString(legacy.id ?? legacy.name);
  const inputPorts = Array.isArray(legacy.input) ? legacy.input : [];
  const outputPorts = Array.isArray(legacy.output) ? legacy.output : [];
  const mapPort = (port: unknown, index: number) => {
    const value = requireRecord(port, `port[${index}]`);
    const name = readString(value.name, `port-${index + 1}`);
    return {
      name,
      schemaRef: `tool-property://${readString(value.type, 'json')}`,
      required: value.required === true,
      multiple: isRecord(value.typeOptions) && value.typeOptions.multipleValues === true,
      description: typeof value.description === 'string' ? value.description : undefined,
    };
  };

  return CapabilityManifestV1Schema.parse({
    contract: 'CapabilityManifest',
    version: 1,
    id,
    capabilityVersion: options.capabilityVersion ?? readString(legacy.version, '1.0.0'),
    ownerRepo: options.ownerRepo,
    kind: 'tool',
    displayName: typeof legacy.displayName === 'string' ? legacy.displayName : id,
    description: typeof legacy.description === 'string' ? legacy.description : undefined,
    ports: {
      inputs: inputPorts.map(mapPort),
      outputs: outputPorts.map(mapPort),
    },
    runtime: {
      providerRef: { kind: 'tool-provider', id: options.providerRef ?? id, ownerRepo: options.ownerRepo },
      loading: 'on-activation',
      stateOwner: 'provider',
      sideEffects: ['network'],
    },
    placement: {
      surfaces: ['workflow-editor', 'agent-runtime'],
      slots: [],
      variants: [],
      tokenRefs: [],
    },
    accessibility: {
      keyboardModel: 'host',
      focusModel: 'host',
      labelContract: 'displayName',
    },
    observability: {
      eventNamespace: `capability.${id}`,
      metrics: [],
      evidenceRefs: [],
    },
    compatibility: {
      aliases: [],
      sourceKinds: ['ToolDef'],
      minHostContractVersion: 1,
    },
    migration: { sourceContract: 'ToolDef', legacy: asJsonValue(legacy) },
  });
}

export type MigratableContractKind = 'workflow-definition-v2' | 'theme-tokens-v1' | 'capability-manifest-v1';

export function migrateContract(
  kind: MigratableContractKind,
  input: unknown,
  options: Record<string, unknown> = {},
): WorkflowDefinitionV2 | ThemeTokensV1 | CapabilityManifestV1 {
  switch (kind) {
    case 'workflow-definition-v2':
      return migrateLegacyWorkflowDefinition(input, options as WorkflowDefinitionMigrationOptions);
    case 'theme-tokens-v1':
      return migrateLegacyThemeTokens(input, options as ThemeTokensMigrationOptions);
    case 'capability-manifest-v1':
      return migrateLegacyCapabilityManifest(input, options as unknown as CapabilityMigrationOptions);
  }
}

