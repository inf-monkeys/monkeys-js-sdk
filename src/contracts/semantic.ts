import { z } from 'zod';
import { CapabilityManifestSchema } from './capability';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
} from './common';
import { OntologyDefinitionSchema, ProjectionSpecSchema } from './data';
import { MenuDefinitionSchema } from './menu';
import { PageDefinitionSchema } from './page';

export const ConceptRelationshipSchema = z
  .object({
    kind: ContractIdentifierSchema,
    targetConceptId: ContractIdentifierSchema,
    cardinality: z.enum(['one', 'optional', 'many']),
  })
  .strict();

export const ConceptDefinitionSchema = z
  .object({
    contract: z.literal('ConceptDefinition'),
    conceptId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    displayName: z.string().trim().min(1),
    description: z.string().optional(),
    schemaRef: ContractIdentifierSchema,
    ontologyId: ContractIdentifierSchema.optional(),
    capabilityIds: z.array(ContractIdentifierSchema).default([]),
    commandNames: z.array(ContractIdentifierSchema).default([]),
    relationships: z.array(ConceptRelationshipSchema).default([]),
  })
  .strict();

export const DomainCommandDefinitionSchema = z
  .object({
    contract: z.literal('DomainCommandDefinition'),
    commandName: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    displayName: z.string().trim().min(1),
    description: z.string().optional(),
    targetKinds: z.array(ContractIdentifierSchema).min(1),
    inputSchemaRef: ContractIdentifierSchema,
    outputSchemaRef: ContractIdentifierSchema.optional(),
    requiredPermissionCodes: z.array(ContractIdentifierSchema).default([]),
    handlerRef: EntityRefSchema,
    sideEffects: z
      .array(z.enum(['data-write', 'execution', 'navigation', 'notification', 'external-call']))
      .default([]),
  })
  .strict();

export const DomainCommandSchema = z
  .object({
    contract: z.literal('DomainCommand'),
    commandId: ContractIdentifierSchema,
    commandName: ContractIdentifierSchema,
    requestId: ContractIdentifierSchema,
    traceId: ContractIdentifierSchema,
    idempotencyKey: ContractIdentifierSchema,
    targetRef: EntityRefSchema,
    actorRef: EntityRefSchema,
    source: z
      .object({
        product: z.enum(['studio', 'kernel', 'compute', 'agent', 'mcp', 'service']),
        pageId: ContractIdentifierSchema.optional(),
        capabilityId: ContractIdentifierSchema.optional(),
      })
      .strict(),
    payload: JsonObjectSchema,
    issuedAt: IsoDateTimeSchema,
  })
  .strict();

export const ProductDeclarationSchema = z
  .object({
    contract: z.literal('ProductDeclaration'),
    declarationId: ContractIdentifierSchema,
    ownerRepo: ContractIdentifierSchema,
    concepts: z.array(ConceptDefinitionSchema).default([]),
    ontologies: z.array(OntologyDefinitionSchema).default([]),
    projections: z.array(ProjectionSpecSchema).default([]),
    commands: z.array(DomainCommandDefinitionSchema).default([]),
    capabilities: z.array(CapabilityManifestSchema).default([]),
    pages: z.array(PageDefinitionSchema).default([]),
    menus: z.array(MenuDefinitionSchema).default([]),
  })
  .strict();

export const DeclarationGraphEdgeSchema = z
  .object({
    from: EntityRefSchema,
    to: EntityRefSchema,
    relation: z.enum([
      'uses-ontology',
      'uses-projection',
      'uses-capability',
      'uses-command',
      'relates-to-concept',
    ]),
  })
  .strict();

export const ChangeImpactSchema = z
  .object({
    changedRef: EntityRefSchema,
    affectedRefs: z.array(EntityRefSchema),
    reasons: z.array(ContractIdentifierSchema).min(1),
  })
  .strict();

export const ChangeImpactGraphSchema = z
  .object({
    contract: z.literal('ChangeImpactGraph'),
    declarationId: ContractIdentifierSchema,
    nodes: z.array(EntityRefSchema),
    edges: z.array(DeclarationGraphEdgeSchema),
    impacts: z.array(ChangeImpactSchema),
    generatedAt: IsoDateTimeSchema,
  })
  .strict();

export type ConceptRelationship = z.infer<typeof ConceptRelationshipSchema>;
export type ConceptDefinition = z.infer<typeof ConceptDefinitionSchema>;
export type DomainCommandDefinition = z.infer<typeof DomainCommandDefinitionSchema>;
export type DomainCommand = z.infer<typeof DomainCommandSchema>;
export type ProductDeclaration = z.infer<typeof ProductDeclarationSchema>;
export type DeclarationGraphEdge = z.infer<typeof DeclarationGraphEdgeSchema>;
export type ChangeImpact = z.infer<typeof ChangeImpactSchema>;
export type ChangeImpactGraph = z.infer<typeof ChangeImpactGraphSchema>;
