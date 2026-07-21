import { z } from 'zod';
import { ContractPortSchema } from './capability';
import {
  ContractIdentifierSchema,
  ContractMetadataSchema,
  EntityRefSchema,
  JsonValueSchema,
  LocalizedTextSchema,
  type JsonValue,
  type LocalizedText,
} from './common';

export const ConductorTaskTypeSchema = z.enum([
  'SIMPLE',
  'DYNAMIC',
  'FORK_JOIN',
  'FORK_JOIN_DYNAMIC',
  'DECISION',
  'SWITCH',
  'JOIN',
  'DO_WHILE',
  'SUB_WORKFLOW',
  'START_WORKFLOW',
  'EVENT',
  'WAIT',
  'HUMAN',
  'USER_DEFINED',
  'HTTP',
  'LAMBDA',
  'INLINE',
  'EXCLUSIVE_JOIN',
  'TERMINATE',
  'KAFKA_PUBLISH',
  'JSON_JQ_TRANSFORM',
  'SET_VARIABLE',
  'CALL_MCP_TOOL',
  'GENERATE_AUDIO',
  'GENERATE_IMAGE',
  'GENERATE_PDF',
  'GENERATE_VIDEO',
  'LIST_MCP_TOOLS',
  'LLM_CHAT_COMPLETE',
  'LLM_GENERATE_EMBEDDINGS',
  'LLM_INDEX_TEXT',
  'LLM_SEARCH_INDEX',
  'TITUS',
  'USER_TASK',
]);

export interface ConductorTaskDefinition {
  name: string;
  taskReferenceName: string;
  type: z.infer<typeof ConductorTaskTypeSchema>;
  inputParameters?: Record<string, JsonValue>;
  startDelay?: number;
  optional?: boolean;
  asyncComplete?: boolean;
  rateLimited?: boolean;
  retryCount?: number;
  taskDefinition?: Record<string, JsonValue>;
  loopCondition?: string;
  loopOver?: ConductorTaskDefinition[];
  sink?: string;
  forkTasks?: ConductorTaskDefinition[][];
  joinOn?: string[];
  defaultExclusiveJoinTask?: string[];
  dynamicForkTasksParam?: string;
  dynamicForkTasksInputParamName?: string;
  subWorkflowParam?: {
    $ref?: string;
    name: string;
    version?: number;
    taskToDomain?: Record<string, string>;
    workflowDefinition?: Record<string, JsonValue>;
  };
  decisionCases?: Record<string, ConductorTaskDefinition[]>;
  defaultCase?: ConductorTaskDefinition[];
  evaluatorType?: 'value-param' | 'javascript' | 'graaljs';
  expression?: string;
  __alias?: JsonValue;
  callbackFromWorker?: boolean;
  caseExpression?: JsonValue;
  caseValueParam?: string;
  dependencies?: JsonValue[];
  description?: string;
  dynamicTaskNameParam?: string;
  joinMode?: string;
  permissive?: boolean;
  joinTaskRef?: string;
  forkTaskRef?: string;
}

const requiredTaskFields: Partial<Record<ConductorTaskDefinition['type'], readonly (keyof ConductorTaskDefinition)[]>> = {
  DO_WHILE: ['inputParameters', 'loopOver'],
  EVENT: ['sink'],
  FORK_JOIN: ['forkTasks'],
  FORK_JOIN_DYNAMIC: ['inputParameters', 'dynamicForkTasksParam', 'dynamicForkTasksInputParamName'],
  DYNAMIC: ['inputParameters'],
  JOIN: ['joinOn'],
  SUB_WORKFLOW: ['subWorkflowParam'],
  SWITCH: ['inputParameters', 'decisionCases', 'evaluatorType', 'expression'],
  DECISION: ['inputParameters', 'decisionCases'],
  WAIT: ['inputParameters'],
  TERMINATE: ['inputParameters'],
};

export const ConductorTaskDefinitionSchema: z.ZodType<ConductorTaskDefinition> = z.lazy(() =>
  z
    .object({
      name: ContractIdentifierSchema,
      taskReferenceName: ContractIdentifierSchema,
      type: ConductorTaskTypeSchema,
      inputParameters: z.record(z.string(), JsonValueSchema).optional(),
      startDelay: z.number().int().nonnegative().optional(),
      optional: z.boolean().optional(),
      asyncComplete: z.boolean().optional(),
      rateLimited: z.boolean().optional(),
      retryCount: z.number().int().nonnegative().optional(),
      taskDefinition: z.record(z.string(), JsonValueSchema).optional(),
      loopCondition: z.string().optional(),
      loopOver: z.array(ConductorTaskDefinitionSchema).optional(),
      sink: z.string().optional(),
      forkTasks: z.array(z.array(ConductorTaskDefinitionSchema)).optional(),
      joinOn: z.array(ContractIdentifierSchema).optional(),
      defaultExclusiveJoinTask: z.array(ContractIdentifierSchema).optional(),
      dynamicForkTasksParam: z.string().optional(),
      dynamicForkTasksInputParamName: z.string().optional(),
      subWorkflowParam: z
        .object({
          $ref: z.string().optional(),
          name: ContractIdentifierSchema,
          version: z.number().int().positive().optional(),
          taskToDomain: z.record(z.string(), z.string()).optional(),
          workflowDefinition: z.record(z.string(), JsonValueSchema).optional(),
        })
        .strict()
        .optional(),
      decisionCases: z.record(z.string(), z.array(ConductorTaskDefinitionSchema)).optional(),
      defaultCase: z.array(ConductorTaskDefinitionSchema).optional(),
      evaluatorType: z.enum(['value-param', 'javascript', 'graaljs']).optional(),
      expression: z.string().optional(),
      __alias: JsonValueSchema.optional(),
      callbackFromWorker: z.boolean().optional(),
      caseExpression: JsonValueSchema.optional(),
      caseValueParam: z.string().optional(),
      dependencies: z.array(JsonValueSchema).optional(),
      description: z.string().optional(),
      dynamicTaskNameParam: z.string().optional(),
      joinMode: z.string().optional(),
      permissive: z.boolean().optional(),
      joinTaskRef: ContractIdentifierSchema.optional(),
      forkTaskRef: ContractIdentifierSchema.optional(),
    })
    .strict()
    .superRefine((task, context) => {
      for (const field of requiredTaskFields[task.type] ?? []) {
        if (task[field] === undefined) {
          context.addIssue({ code: 'custom', path: [field], message: `${task.type} task requires ${String(field)}.` });
        }
      }
      if (
        task.type === 'DO_WHILE' &&
        (task.inputParameters?.mode === undefined || task.inputParameters.mode === 'expression') &&
        task.loopCondition === undefined &&
        task.inputParameters?.loopCondition === undefined
      ) {
        context.addIssue({ code: 'custom', path: ['loopCondition'], message: 'Expression DO_WHILE task requires loopCondition.' });
      }
    }),
);

export const ConductorWorkflowDefinitionSchema = z.object({
  ownerApp: z.string().optional(),
  createTime: z.number().int().nonnegative().optional(),
  updateTime: z.number().int().nonnegative().optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  name: ContractIdentifierSchema,
  description: z.string().optional(),
  version: z.number().int().positive(),
  tasks: z.array(ConductorTaskDefinitionSchema),
  inputParameters: z.array(ContractIdentifierSchema),
  outputParameters: z.record(z.string(), JsonValueSchema).optional(),
  failureWorkflow: ContractIdentifierSchema.optional(),
  schemaVersion: z.number().int().positive().optional(),
  restartable: z.boolean().optional(),
  workflowStatusListenerEnabled: z.boolean().optional(),
  ownerEmail: z.string().email().optional(),
  timeoutPolicy: z.enum(['TIME_OUT_WF', 'ALERT_ONLY']).optional(),
  timeoutSeconds: z.number().int().nonnegative(),
  variables: z.record(z.string(), JsonValueSchema).optional(),
  inputTemplate: z.record(z.string(), JsonValueSchema).optional(),
}).strict();

export const WorkflowParameterTypeSchema = z.enum([
  'string',
  'file',
  'number',
  'boolean',
  'options',
  'json',
  'notice',
  'canvas-assist',
]);

const WorkflowConditionalStateSchema = z
  .object({
    conditions: z.array(
      z
        .object({
          field: z.string(),
          operator: z.enum(['is', 'isNot', 'isGreaterThan', 'isLessThan', 'isGreaterThanOrEqual', 'isLessThanOrEqual', 'in', 'notIn']),
          value: JsonValueSchema,
        })
        .strict(),
    ),
    logic: z.enum(['AND', 'OR']).optional(),
  })
  .strict();

const ImageSelectMappingAppearanceSchema = z
  .object({
    columns: z.number().int().min(1).max(4).optional(),
    cardSize: z.enum(['sm', 'md', 'lg']).optional(),
    imageAspectRatio: z.enum(['square', '4:5', '3:4', '16:9']).optional(),
    gap: z.enum(['sm', 'md', 'lg']).optional(),
    radius: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
    borderStyle: z.enum(['none', 'soft', 'strong']).optional(),
    borderWidth: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    enableScroll: z.boolean().optional(),
    maxHeight: z.number().int().min(160).max(1200).optional(),
    enableCollapse: z.boolean().optional(),
    visibleRows: z.number().int().min(1).max(6).optional(),
    hideLabel: z.boolean().optional(),
    hideDescription: z.boolean().optional(),
    hideValue: z.boolean().optional(),
  })
  .strict();

const WorkflowParameterTypeOptionsSchema = z
  .object({
    editor: z.enum(['code', 'codeNodeEditor', 'htmlEditor', 'sqlEditor', 'json']).optional(),
    editorLanguage: z.enum(['javaScript', 'json', 'python', 'sql']).optional(),
    maxValue: z.number().optional(), minValue: z.number().optional(), max: z.number().optional(), min: z.number().optional(),
    multipleValues: z.boolean().optional(), numberPrecision: z.number().nonnegative().optional(), password: z.boolean().optional(), rows: z.number().int().positive().optional(),
    assetType: z.string().optional(), accept: z.string().optional(), maxSize: z.number().positive().optional(), fileType: z.string().optional(),
    aiMultiShotMainImageField: z.string().optional(), aiMultiShotWorkflowAppId: z.string().optional(), aiMultiShotWorkflowId: z.string().optional(),
    allowCustomInput: z.boolean().optional(), allowUploadVideo: z.boolean().optional(), aspectRatioField: z.string().optional(), assemblyValueType: z.string().optional(),
    autoAnalyzeDesignImage: z.boolean().optional(), autoDetectAspectRatio: z.boolean().optional(), autoIncrementId: z.boolean().optional(), comfyuiModelServerId: z.string().optional(), comfyuiModelTypeName: z.string().optional(),
    defaultCustomInput: JsonValueSchema.optional(), descriptionAlert: z.boolean().optional(), disabled: z.union([z.boolean(), WorkflowConditionalStateSchema]).optional(), editable: z.union([z.boolean(), WorkflowConditionalStateSchema]).optional(),
    enableAiMultiShot: z.boolean().optional(), enableBooleanSwitchMode: z.boolean().optional(), enableClear: z.boolean().optional(), enableExpand: z.boolean().optional(), enableImageMask: z.boolean().optional(), enableImageOverlay: z.boolean().optional(), enablePopupEditor: z.boolean().optional(), enablePromptFontSize: z.boolean().optional(), enableReset: z.boolean().optional(), enableSelectItemIcon: z.boolean().optional(), enableSelectList: z.boolean().optional(), enableSelectSearch: z.boolean().optional(), enableSliderEnterMode: z.boolean().optional(), enableVoice: z.boolean().optional(),
    expandButtonText: z.string().optional(), foldUp: z.boolean().optional(), hidden: z.boolean().optional(), hideRequiredDot: z.boolean().optional(), inlineTitleWithSelect: z.boolean().optional(), knowledgeGraphButtonText: z.string().optional(),
    identifyAttributeCount: z.union([z.number().nonnegative(), z.string().min(1), z.object({ min: z.number().nonnegative().optional(), max: z.number().nonnegative().optional() }).strict()]).optional(), identifyAttributes: z.array(JsonValueSchema).optional(), identifyMaxVariants: z.number().int().nonnegative().optional(), identifySourceField: z.string().optional(),
    imageOverlayBaseField: z.string().optional(), imageOverlayOverlayField: z.string().optional(), imageSelectMappingAppearance: ImageSelectMappingAppearanceSchema.optional(), imageSelectMappingColumns: z.number().int().min(1).max(4).optional(), imageSelectMappingEnableCustomUpload: z.boolean().optional(), imageSelectMappingHideLabel: z.boolean().optional(), imageSelectMappingHideLink: z.boolean().optional(), imageSelectMappingHideMeta: z.boolean().optional(), imageSelectMappingInlineUseLargeUploadBox: z.boolean().optional(), imageSelectMappingPromptField: z.string().optional(), imageSelectMappingTabOrder: z.enum(['template-first', 'upload-first']).optional(), imageSelectMappingTabWidthMode: z.enum(['content', 'fill']).optional(), imageSelectMappingTemplatePrompt: LocalizedTextSchema.optional(), imageSelectMappingTemplateTabTitle: LocalizedTextSchema.optional(), imageSelectMappingUploadMode: z.enum(['tabs', 'inline']).optional(), imageSelectMappingUploadPrompt: LocalizedTextSchema.optional(), imageSelectMappingUploadTabTitle: LocalizedTextSchema.optional(),
    endpoints: z.array(JsonValueSchema).optional(), examples: z.array(JsonValueSchema).optional(), extraData: JsonValueSchema.optional(), layer: JsonValueSchema.optional(), map: JsonValueSchema.optional(), multiline: z.boolean().optional(), options: z.array(JsonValueSchema).optional(), originalFiles: z.array(JsonValueSchema).optional(), placeholder: LocalizedTextSchema.optional(), preserveSelectListOrder: z.boolean().optional(), promptDictionary: JsonValueSchema.optional(), promptFontSize: z.number().optional(), promptModeToggle: JsonValueSchema.optional(), requireActiveSelectFilter: z.boolean().optional(), restoreDefaultOnEmptyEnter: z.boolean().optional(), search: z.boolean().optional(),
    selectButtonEnableCollapse: z.boolean().optional(), selectButtonVisibleRows: z.number().int().positive().optional(), selectList: z.array(JsonValueSchema).optional(), selectListDisplayMode: z.string().optional(), selectPromptField: z.string().optional(), showAddLocalFileButton: z.boolean().optional(), singleColumn: z.boolean().optional(), singleFrameForMultiple: z.boolean().optional(), textSingleLine: z.boolean().optional(), textareaMiniHeight: z.number().nonnegative().optional(), tips: LocalizedTextSchema.optional(), visibility: JsonValueSchema.optional(), voiceButtonText: z.string().optional(),
    designAnalysisFields: z.array(JsonValueSchema).optional(), designAnalysisFillStrategy: z.string().optional(), designAnalysisMaxFields: z.number().int().nonnegative().optional(), designAnalysisType: z.string().optional(),
    designAnalysisFieldPrefix: z.string().optional(),
  })
  .strict();

export interface WorkflowParameter {
  displayName: LocalizedText;
  name: string;
  type: z.infer<typeof WorkflowParameterTypeSchema>;
  typeOptions?: z.infer<typeof WorkflowParameterTypeOptionsSchema>;
  default?: JsonValue;
  description?: LocalizedText;
  hint?: string;
  displayOptions?: { hide?: Record<string, JsonValue[]>; show?: Record<string, JsonValue[]> };
  options?: Array<WorkflowParameterOption | WorkflowParameter | WorkflowParameterCollection>;
  placeholder?: LocalizedText;
  isNodeSetting?: boolean;
  noDataExpression?: boolean;
  required?: boolean;
  example?: string;
  extractValue?: { type: 'regex'; regex: string };
  properties?: WorkflowParameter[];
  assetType?: string;
  flag?: boolean;
  enableExpand?: boolean;
  enableVoice?: boolean;
  expandButtonText?: string;
  knowledgeGraphButtonText?: string;
  selectListDisplayMode?: string;
  voiceButtonText?: string;
}

export interface WorkflowParameterOption {
  name: LocalizedText;
  value: string | number | boolean;
  action?: string;
  description?: LocalizedText;
}

export interface WorkflowParameterCollection {
  displayName: string;
  name: string;
  values: WorkflowParameter[];
}

export const WorkflowParameterSchema: z.ZodType<WorkflowParameter> = z.lazy(() =>
  z.object({
    displayName: LocalizedTextSchema,
    name: ContractIdentifierSchema,
    type: WorkflowParameterTypeSchema,
    typeOptions: WorkflowParameterTypeOptionsSchema.optional(),
    default: JsonValueSchema.optional(),
    description: LocalizedTextSchema.optional(),
    hint: z.string().optional(),
    displayOptions: z.object({
      hide: z.record(z.string(), z.array(JsonValueSchema)).optional(),
      show: z.record(z.string(), z.array(JsonValueSchema)).optional(),
    }).strict().optional(),
    options: z.array(z.union([
      z.object({ name: LocalizedTextSchema, value: z.union([z.string(), z.number(), z.boolean()]), action: z.string().optional(), description: LocalizedTextSchema.optional() }).strict(),
      WorkflowParameterSchema,
      z.object({ displayName: z.string(), name: ContractIdentifierSchema, values: z.array(WorkflowParameterSchema) }).strict(),
    ])).optional(),
    placeholder: LocalizedTextSchema.optional(),
    isNodeSetting: z.boolean().optional(), noDataExpression: z.boolean().optional(), required: z.boolean().optional(), example: z.string().optional(),
    extractValue: z.object({ type: z.literal('regex'), regex: z.string() }).strict().optional(),
    properties: z.array(WorkflowParameterSchema).optional(), assetType: z.string().optional(), flag: z.boolean().optional(),
    enableExpand: z.boolean().optional(), enableVoice: z.boolean().optional(), expandButtonText: z.string().optional(), knowledgeGraphButtonText: z.string().optional(), selectListDisplayMode: z.string().optional(), voiceButtonText: z.string().optional(),
  }).strict(),
);

export const WorkflowOutputBindingSchema = z.object({ key: ContractIdentifierSchema, value: z.string() }).strict();

export const WorkflowNodeSchema = z
  .object({
    id: ContractIdentifierSchema,
    referenceName: ContractIdentifierSchema,
    capabilityRef: ContractIdentifierSchema,
    capabilityVersion: ContractIdentifierSchema.optional(),
    inputBindings: z.record(z.string(), JsonValueSchema).default({}),
    configuration: z.object({ executor: z.literal('conductor'), task: ConductorTaskDefinitionSchema }).strict(),
  })
  .strict()
  .superRefine((node, context) => {
    if (node.configuration.task.taskReferenceName !== node.referenceName) context.addIssue({ code: 'custom', path: ['configuration', 'task', 'taskReferenceName'], message: 'Conductor task reference must match node referenceName.' });
    if (node.configuration.task.name !== node.capabilityRef) context.addIssue({ code: 'custom', path: ['configuration', 'task', 'name'], message: 'Conductor task name must match node capabilityRef.' });
    if (JSON.stringify(node.configuration.task.inputParameters ?? {}) !== JSON.stringify(node.inputBindings)) context.addIssue({ code: 'custom', path: ['configuration', 'task', 'inputParameters'], message: 'Conductor task inputs must match node inputBindings.' });
  });

export const WorkflowEdgeSchema = z.object({
  from: ContractIdentifierSchema, to: ContractIdentifierSchema, outputPort: ContractIdentifierSchema.optional(), inputPort: ContractIdentifierSchema.optional(), condition: z.string().optional(),
}).strict();

export const WorkflowTriggerSchema = z.object({
  id: ContractIdentifierSchema,
  type: z.enum(['manual', 'schedule', 'webhook', 'event', 'api']),
  enabled: z.boolean(),
  schedule: z.object({ cron: z.string().trim().min(1) }).strict().optional(),
  webhook: z.object({
    path: z.string().trim().min(1).optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
    auth: z.enum(['NONE', 'BASIC', 'CUSTOM_HEADER']),
    basicAuth: z.object({ username: z.string(), password: z.string() }).strict().optional(),
    headerAuth: z.object({ name: z.string().trim().min(1), value: z.string() }).strict().optional(),
    responseUntil: z.enum(['WORKFLOW_STARTED', 'WORKFLOW_COMPLETED_OR_FINISHED']),
  }).strict().optional(),
  event: z.object({
    eventType: ContractIdentifierSchema,
    configuration: JsonValueSchema.optional(),
  }).strict().optional(),
}).strict().superRefine((trigger, context) => {
  if (trigger.type === 'schedule' && !trigger.schedule) context.addIssue({ code: 'custom', path: ['schedule'], message: 'Schedule trigger requires schedule configuration.' });
  if (trigger.type === 'webhook' && !trigger.webhook) context.addIssue({ code: 'custom', path: ['webhook'], message: 'Webhook trigger requires webhook configuration.' });
  if (trigger.type === 'event' && !trigger.event) context.addIssue({ code: 'custom', path: ['event'], message: 'Event trigger requires event configuration.' });
});

export const WorkflowValidationIssueSchema = z.object({
  taskReferenceName: ContractIdentifierSchema,
  issueType: z.enum(['ERROR', 'WARNING']),
  detailReason: z.object({ type: ContractIdentifierSchema, name: ContractIdentifierSchema, detailInformation: JsonValueSchema.optional() }).strict(),
  humanMessage: z.object({ en: z.string(), zh: z.string() }).strict(),
}).strict();

export const WorkflowDefinitionSchema = z.object({
  contract: z.literal('WorkflowDefinition'),
  metadata: ContractMetadataSchema.omit({ name: true, description: true, labels: true }).extend({
    name: LocalizedTextSchema,
    description: LocalizedTextSchema.optional(),
    role: z.enum(['workflow', 'template']),
    teamId: ContractIdentifierSchema,
    creatorRef: EntityRefSchema,
    tags: z.array(ContractIdentifierSchema).default([]),
  }).strict(),
  revision: z.object({
    kind: z.enum(['release', 'backup']),
    recordVersion: z.number().int().positive(),
    sourceVersion: z.number().int().positive().optional(),
  }).strict().superRefine((revision, context) => {
    if (revision.kind === 'backup' && revision.sourceVersion === undefined) context.addIssue({ code: 'custom', path: ['sourceVersion'], message: 'Backup revisions require a sourceVersion.' });
  }),
  presentation: z.object({ iconUrl: z.string().optional(), thumbnail: z.string().optional() }).strict(),
  ports: z.object({ inputs: z.array(ContractPortSchema).default([]), outputs: z.array(ContractPortSchema).default([]) }).strict(),
  parameters: z.object({ variables: z.array(WorkflowParameterSchema).default([]), outputs: z.array(WorkflowOutputBindingSchema).default([]) }).strict(),
  graph: z.object({ nodes: z.array(WorkflowNodeSchema), edges: z.array(WorkflowEdgeSchema).default([]) }).strict(),
  execution: z.object({
    timeoutMs: z.number().int().positive().optional(), retries: z.number().int().nonnegative().default(0), concurrencyLimit: z.number().int().positive().optional(), idempotency: z.enum(['required', 'supported', 'none']),
    rateLimit: z.object({ enabled: z.boolean(), max: z.number().int().nonnegative(), windowMs: z.number().int().nonnegative() }).strict().superRefine((rateLimit, context) => {
      if (rateLimit.enabled && (rateLimit.max === 0 || rateLimit.windowMs === 0)) context.addIssue({ code: 'custom', message: 'Enabled rate limit requires positive max and windowMs.' });
    }).optional(),
    conductor: z.object({
      ownerApp: z.string().optional(), createTime: z.number().int().nonnegative().optional(), updateTime: z.number().int().nonnegative().optional(), createdBy: z.string().optional(), updatedBy: z.string().optional(),
      failureWorkflow: ContractIdentifierSchema.optional(), schemaVersion: z.number().int().positive().optional(), restartable: z.boolean().optional(), workflowStatusListenerEnabled: z.boolean().optional(), ownerEmail: z.string().email().optional(), timeoutPolicy: z.enum(['TIME_OUT_WF', 'ALERT_ONLY']).optional(),
      variables: z.record(z.string(), JsonValueSchema).optional(), inputTemplate: z.record(z.string(), JsonValueSchema).optional(),
    }).strict(),
  }).strict(),
  triggers: z.array(WorkflowTriggerSchema).default([]),
  views: z.array(z.object({ pageRef: ContractIdentifierSchema, placement: ContractIdentifierSchema.optional() }).strict()).default([]),
  dataContracts: z.object({ reads: z.array(ContractIdentifierSchema).default([]), writes: z.array(ContractIdentifierSchema).default([]), emits: z.array(ContractIdentifierSchema).default([]) }).strict(),
  governance: z.object({ activated: z.boolean(), validated: z.boolean(), validationIssues: z.array(WorkflowValidationIssueSchema).default([]), hidden: z.boolean().optional() }).strict(),
  interfaces: z.object({
    openai: z.object({ enabled: z.boolean(), modelName: z.string().trim().min(1).optional() }).strict(),
    shortcutRef: EntityRefSchema.optional(),
    preferredAppId: ContractIdentifierSchema.optional(),
  }).strict().superRefine((interfaces, context) => {
    if (interfaces.openai.enabled && !interfaces.openai.modelName) context.addIssue({ code: 'custom', path: ['openai', 'modelName'], message: 'Enabled OpenAI interface requires modelName.' });
    if (interfaces.shortcutRef && interfaces.shortcutRef.kind !== 'workflow') context.addIssue({ code: 'custom', path: ['shortcutRef', 'kind'], message: 'shortcutRef must reference a workflow.' });
  }),
}).strict().superRefine((definition, context) => {
  const nodeIds = new Set(definition.graph.nodes.map((node) => node.id));
  const references = new Set(definition.graph.nodes.map((node) => node.referenceName));
  if (nodeIds.size !== definition.graph.nodes.length) context.addIssue({ code: 'custom', path: ['graph', 'nodes'], message: 'Workflow node ids must be unique.' });
  if (references.size !== definition.graph.nodes.length) context.addIssue({ code: 'custom', path: ['graph', 'nodes'], message: 'Workflow node reference names must be unique.' });
  definition.graph.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) context.addIssue({ code: 'custom', path: ['graph', 'edges', index], message: 'Workflow edges must reference existing node ids.' });
  });
  if (definition.revision.kind === 'release' && definition.metadata.version !== definition.revision.recordVersion) context.addIssue({ code: 'custom', path: ['revision', 'recordVersion'], message: 'Release recordVersion must equal metadata.version.' });
});

export type ConductorTaskType = z.infer<typeof ConductorTaskTypeSchema>;
export type ConductorWorkflowDefinition = z.infer<typeof ConductorWorkflowDefinitionSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;
export type WorkflowDefinitionValidationIssue = z.infer<typeof WorkflowValidationIssueSchema>;
export type WorkflowOutputBinding = z.infer<typeof WorkflowOutputBindingSchema>;
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
