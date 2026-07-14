import { z } from 'zod';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonValueSchema,
} from './common';

export const ActorRefSchema = z
  .object({
    kind: z.enum(['human', 'agent', 'service', 'tenant', 'public']),
    id: ContractIdentifierSchema.optional(),
    userId: ContractIdentifierSchema.optional(),
    agentId: ContractIdentifierSchema.optional(),
    serviceId: ContractIdentifierSchema.optional(),
  })
  .strict();

export const AuthorityScopeSchema = z
  .object({
    resource: ContractIdentifierSchema,
    actions: z.array(ContractIdentifierSchema).min(1),
    constraints: z.record(z.string(), JsonValueSchema).optional(),
  })
  .strict();

export const RequestScopeSchema = z
  .object({
    contract: z.literal('RequestScope'),
    requestId: ContractIdentifierSchema,
    traceId: ContractIdentifierSchema.optional(),
    appId: ContractIdentifierSchema,
    tenantId: ContractIdentifierSchema.optional(),
    teamId: ContractIdentifierSchema.optional(),
    actor: ActorRefSchema,
    session: z
      .object({
        authType: ContractIdentifierSchema,
        authenticated: z.boolean(),
        membershipVerified: z.boolean(),
      })
      .strict(),
    permissionCodes: z.array(ContractIdentifierSchema).default([]),
    authority: z.array(AuthorityScopeSchema).default([]),
    issuedAt: IsoDateTimeSchema,
  })
  .strict();

export const ExecutionLinkSchema = z
  .object({
    contract: z.literal('ExecutionLink'),
    requestId: ContractIdentifierSchema,
    traceId: ContractIdentifierSchema.optional(),
    correlationId: ContractIdentifierSchema.optional(),
    causationId: ContractIdentifierSchema.optional(),
    workflowRef: EntityRefSchema.optional(),
    runRef: EntityRefSchema,
    taskRef: EntityRefSchema.optional(),
    parentRunRef: EntityRefSchema.optional(),
  })
  .strict();

export const CompletionHeaderSchema = z
  .object({
    contract: z.literal('CompletionHeader'),
    eventId: ContractIdentifierSchema,
    runtimeEventId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    sequence: z.number().int().nonnegative(),
    execution: ExecutionLinkSchema,
    producer: z
      .object({
        service: ContractIdentifierSchema,
        runtime: ContractIdentifierSchema,
        version: ContractIdentifierSchema,
      })
      .strict(),
    status: z.enum(['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMED_OUT']),
    occurredAt: IsoDateTimeSchema,
    payloadSchemaRef: ContractIdentifierSchema.optional(),
  })
  .strict();

export const CompletionEventSchema = z
  .object({
    header: CompletionHeaderSchema,
    payload: JsonValueSchema.optional(),
  })
  .strict();

export type ActorRef = z.infer<typeof ActorRefSchema>;
export type AuthorityScope = z.infer<typeof AuthorityScopeSchema>;
export type RequestScope = z.infer<typeof RequestScopeSchema>;
export type ExecutionLink = z.infer<typeof ExecutionLinkSchema>;
export type CompletionHeader = z.infer<typeof CompletionHeaderSchema>;
export type CompletionEvent = z.infer<typeof CompletionEventSchema>;
