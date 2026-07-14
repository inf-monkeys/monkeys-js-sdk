import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefV1Schema,
  IsoDateTimeSchema,
  JsonValueSchema,
} from './common';

export const ActorRefV1Schema = z
  .object({
    kind: z.enum(['human', 'agent', 'service', 'tenant', 'public']),
    id: ContractIdentifierSchema.optional(),
    userId: ContractIdentifierSchema.optional(),
    agentId: ContractIdentifierSchema.optional(),
    serviceId: ContractIdentifierSchema.optional(),
  })
  .catchall(JsonValueSchema);

export const AuthorityScopeV1Schema = z
  .object({
    resource: ContractIdentifierSchema,
    actions: z.array(ContractIdentifierSchema).min(1),
    constraints: z.record(z.string(), JsonValueSchema).optional(),
  })
  .catchall(JsonValueSchema);

export const RequestScopeV1Schema = z
  .object({
    contract: z.literal('RequestScope'),
    version: z.literal(1),
    requestId: ContractIdentifierSchema,
    traceId: ContractIdentifierSchema.optional(),
    appId: ContractIdentifierSchema,
    tenantId: ContractIdentifierSchema.optional(),
    teamId: ContractIdentifierSchema.optional(),
    actor: ActorRefV1Schema,
    session: z
      .object({
        authType: ContractIdentifierSchema,
        authenticated: z.boolean(),
        membershipVerified: z.boolean(),
      })
      .catchall(JsonValueSchema),
    permissionCodes: z.array(ContractIdentifierSchema).default([]),
    authority: z.array(AuthorityScopeV1Schema).default([]),
    issuedAt: IsoDateTimeSchema,
  })
  .catchall(JsonValueSchema);

export const ExecutionLinkV1Schema = z
  .object({
    contract: z.literal('ExecutionLink'),
    version: z.literal(1),
    requestId: ContractIdentifierSchema,
    traceId: ContractIdentifierSchema.optional(),
    correlationId: ContractIdentifierSchema.optional(),
    causationId: ContractIdentifierSchema.optional(),
    workflowRef: EntityRefV1Schema.optional(),
    runRef: EntityRefV1Schema,
    taskRef: EntityRefV1Schema.optional(),
    parentRunRef: EntityRefV1Schema.optional(),
  })
  .catchall(JsonValueSchema);

export const CompletionHeaderV1Schema = z
  .object({
    contract: z.literal('CompletionHeader'),
    version: z.literal(1),
    eventId: ContractIdentifierSchema,
    runtimeEventId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    sequence: z.number().int().nonnegative(),
    execution: ExecutionLinkV1Schema,
    producer: z
      .object({
        service: ContractIdentifierSchema,
        runtime: ContractIdentifierSchema,
        version: ContractIdentifierSchema,
      })
      .catchall(JsonValueSchema),
    status: z.enum(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']),
    occurredAt: IsoDateTimeSchema,
    payloadSchemaRef: ContractIdentifierSchema.optional(),
  })
  .catchall(JsonValueSchema);

export const CompletionEventV1Schema = z
  .object({
    header: CompletionHeaderV1Schema,
    payload: JsonValueSchema.optional(),
  })
  .catchall(JsonValueSchema);

export type ActorRefV1 = z.infer<typeof ActorRefV1Schema>;
export type AuthorityScopeV1 = z.infer<typeof AuthorityScopeV1Schema>;
export type RequestScopeV1 = z.infer<typeof RequestScopeV1Schema>;
export type ExecutionLinkV1 = z.infer<typeof ExecutionLinkV1Schema>;
export type CompletionHeaderV1 = z.infer<typeof CompletionHeaderV1Schema>;
export type CompletionEventV1 = z.infer<typeof CompletionEventV1Schema>;

