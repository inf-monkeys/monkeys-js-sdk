import { z } from 'zod';
import { JsonObjectSchema } from './common';

const AggregateIdentifierSchema = z.string().trim().min(1).max(128);
const AggregateRequestIdentifierSchema = z.string().trim().min(1).max(256);
const AggregateMutationsLimit = 500;

export const AggregateAssetSchema = z
  .object({
    id: AggregateIdentifierSchema,
    name: z.string().trim().min(1).max(500),
    asset_type: AggregateIdentifierSchema,
    primary_content: JsonObjectSchema,
    status: z.string().trim().min(1).max(64).optional(),
    creator_user_id: AggregateIdentifierSchema.optional(),
    properties: JsonObjectSchema.optional(),
    files: z.array(JsonObjectSchema).max(100).optional(),
    media: z.string().max(4096).optional(),
    thumbnail: z.string().max(4096).optional(),
    media_ref: JsonObjectSchema.optional(),
    keywords: z.string().max(2000).optional(),
    extra: JsonObjectSchema.optional(),
    sort: z.number().int().nonnegative().optional(),
  })
  .strict();

export const AggregateAssetUpsertSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset: AggregateAssetSchema,
    tag_ids: z.array(AggregateIdentifierSchema).max(200).optional(),
  })
  .strict();

export const AggregateAssetDeleteSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
  })
  .strict();

export const AggregateFeatureValueWriteSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
    column_id: AggregateIdentifierSchema,
    value_text: z.string().max(1_000_000).nullable(),
  })
  .strict();

export const AggregateFeatureRelationTargetSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
  })
  .strict();

export const AggregateFeatureRelationReplaceSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
    column_id: AggregateIdentifierSchema,
    targets: z.array(AggregateFeatureRelationTargetSchema).max(AggregateMutationsLimit),
  })
  .strict();

export const AggregateAssetRelationObjectSchema = z
  .object({
    object_kind: z.string().trim().min(1).max(64),
    object_id: z.string().trim().min(1).max(256),
    properties: JsonObjectSchema.optional(),
  })
  .strict();

export const AggregateAssetRelationReplaceSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
    relation_kind: z.string().trim().min(1).max(64),
    objects: z.array(AggregateAssetRelationObjectSchema).max(AggregateMutationsLimit),
  })
  .strict();

export const AggregateContainerMembershipWriteSchema = z
  .object({
    ontology_id: AggregateIdentifierSchema,
    container_view_id: AggregateIdentifierSchema,
    asset_id: AggregateIdentifierSchema,
    present: z.boolean(),
  })
  .strict();

export const AggregateCommitRequestSchema = z
  .object({
    contract: z.literal('AggregateCommitRequest'),
    aggregate_id: AggregateIdentifierSchema,
    request_id: AggregateRequestIdentifierSchema,
    idempotency_key: AggregateIdentifierSchema,
    expected_head_commit_id: AggregateIdentifierSchema.optional(),
    message: z.string().trim().max(500).optional(),
    assets: z.array(AggregateAssetUpsertSchema).max(AggregateMutationsLimit).optional(),
    asset_deletes: z.array(AggregateAssetDeleteSchema).max(AggregateMutationsLimit).optional(),
    feature_values: z.array(AggregateFeatureValueWriteSchema).max(AggregateMutationsLimit).optional(),
    feature_relations: z.array(AggregateFeatureRelationReplaceSchema).max(AggregateMutationsLimit).optional(),
    asset_relations: z.array(AggregateAssetRelationReplaceSchema).max(AggregateMutationsLimit).optional(),
    container_memberships: z.array(AggregateContainerMembershipWriteSchema).max(AggregateMutationsLimit).optional(),
  })
  .strict()
  .superRefine((request, context) => {
    const mutationCount =
      (request.assets?.length ?? 0) +
      (request.asset_deletes?.length ?? 0) +
      (request.feature_values?.length ?? 0) +
      (request.feature_relations?.length ?? 0) +
      (request.asset_relations?.length ?? 0) +
      (request.container_memberships?.length ?? 0);
    if (mutationCount === 0) {
      context.addIssue({ code: 'custom', message: 'at least one aggregate mutation is required' });
    }
  });

export type AggregateAsset = z.infer<typeof AggregateAssetSchema>;
export type AggregateAssetUpsert = z.infer<typeof AggregateAssetUpsertSchema>;
export type AggregateAssetDelete = z.infer<typeof AggregateAssetDeleteSchema>;
export type AggregateFeatureValueWrite = z.infer<typeof AggregateFeatureValueWriteSchema>;
export type AggregateFeatureRelationTarget = z.infer<typeof AggregateFeatureRelationTargetSchema>;
export type AggregateFeatureRelationReplace = z.infer<typeof AggregateFeatureRelationReplaceSchema>;
export type AggregateAssetRelationObject = z.infer<typeof AggregateAssetRelationObjectSchema>;
export type AggregateAssetRelationReplace = z.infer<typeof AggregateAssetRelationReplaceSchema>;
export type AggregateContainerMembershipWrite = z.infer<typeof AggregateContainerMembershipWriteSchema>;
export type AggregateCommitRequest = z.infer<typeof AggregateCommitRequestSchema>;
