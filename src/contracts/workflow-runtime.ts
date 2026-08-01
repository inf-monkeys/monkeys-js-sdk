import { z } from 'zod';
import { ArtifactManifestSchema, OutputRecordSchema } from './artifact';
import {
  ContractIdentifierSchema,
  EntityRefSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  Sha256Schema,
} from './common';
import { ApplicationRunSchema } from './continuity';
import { LineageRecordSchema } from './data';

export const WorkflowCatalogEntrySchema = z
  .object({
    contract: z.literal('WorkflowCatalogEntry'),
    workflowId: ContractIdentifierSchema,
    teamId: ContractIdentifierSchema,
    creatorRef: EntityRefSchema,
    currentDefinitionRef: EntityRefSchema,
    lifecycle: z.enum(['ACTIVE', 'DELETED']),
    asset: z
      .object({
        preset: z.boolean(),
        marketplacePublished: z.boolean(),
        publishConfig: JsonObjectSchema.optional(),
        sort: z.number().int(),
        forkFromRef: EntityRefSchema.optional(),
        notAuthorized: z.boolean(),
      })
      .strict(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    deletedAt: IsoDateTimeSchema.optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (
      entry.creatorRef.kind !== 'user' &&
      entry.creatorRef.kind !== 'service'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['creatorRef', 'kind'],
        message: 'creatorRef must reference a user or service.',
      });
    }
    if (entry.currentDefinitionRef.kind !== 'workflow-definition') {
      context.addIssue({
        code: 'custom',
        path: ['currentDefinitionRef', 'kind'],
        message: 'currentDefinitionRef must reference a workflow-definition.',
      });
    }
    if (entry.lifecycle === 'DELETED' && !entry.deletedAt) {
      context.addIssue({
        code: 'custom',
        path: ['deletedAt'],
        message: 'Deleted workflow catalog entries require deletedAt.',
      });
    }
    if (entry.lifecycle === 'ACTIVE' && entry.deletedAt) {
      context.addIssue({
        code: 'custom',
        path: ['deletedAt'],
        message: 'Active workflow catalog entries cannot declare deletedAt.',
      });
    }
  });

export const WorkflowPublicationSchema = z
  .object({
    contract: z.literal('WorkflowPublication'),
    publicationId: ContractIdentifierSchema,
    definitionRef: EntityRefSchema,
    runtimeDefinitionRef: EntityRefSchema,
    sourceHash: Sha256Schema,
    compiledHash: Sha256Schema,
    status: z.enum(['PENDING', 'PUBLISHED', 'FAILED', 'RETIRED']),
    publisherRef: EntityRefSchema,
    publishedAt: IsoDateTimeSchema.optional(),
    failureReason: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((publication, context) => {
    if (publication.definitionRef.kind !== 'workflow-definition') {
      context.addIssue({
        code: 'custom',
        path: ['definitionRef', 'kind'],
        message: 'definitionRef must reference a workflow-definition.',
      });
    }
    if (publication.runtimeDefinitionRef.kind !== 'conductor-workflow-definition') {
      context.addIssue({
        code: 'custom',
        path: ['runtimeDefinitionRef', 'kind'],
        message: 'runtimeDefinitionRef must reference a conductor-workflow-definition.',
      });
    }
    if (publication.status === 'PUBLISHED' && !publication.publishedAt) {
      context.addIssue({
        code: 'custom',
        path: ['publishedAt'],
        message: 'Published workflow publications require publishedAt.',
      });
    }
    if (publication.status === 'FAILED' && !publication.failureReason) {
      context.addIssue({
        code: 'custom',
        path: ['failureReason'],
        message: 'Failed workflow publications require failureReason.',
      });
    }
  });

export const WorkflowCompletionCommitSchema = z
  .object({
    contract: z.literal('WorkflowCompletionCommit'),
    commitId: ContractIdentifierSchema,
    run: ApplicationRunSchema,
    outputs: z.array(OutputRecordSchema),
    artifacts: z.array(ArtifactManifestSchema),
    lineage: LineageRecordSchema,
    completedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((commit, context) => {
    const expectedRunId = commit.run.runId;
    const referencesRun = (value: { runRef: { kind: string; id: string } }) =>
      value.runRef.kind === 'application-run' && value.runRef.id === expectedRunId;

    commit.outputs.forEach((output, index) => {
      if (!referencesRun(output)) {
        context.addIssue({
          code: 'custom',
          path: ['outputs', index, 'runRef'],
          message: 'Every output must reference the committed ApplicationRun.',
        });
      }
    });
    commit.artifacts.forEach((artifact, index) => {
      if (!referencesRun(artifact)) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', index, 'runRef'],
          message: 'Every artifact must reference the committed ApplicationRun.',
        });
      }
    });
    if (
      commit.lineage.subjectRef.kind !== 'application-run' ||
      commit.lineage.subjectRef.id !== expectedRunId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lineage', 'subjectRef'],
        message: 'Completion lineage must use the committed ApplicationRun as its subject.',
      });
    }
    const outputIds = new Set(commit.outputs.map(output => output.outputId));
    commit.artifacts.forEach((artifact, index) => {
      if (
        artifact.outputRef.kind !== 'workflow-output' ||
        !outputIds.has(artifact.outputRef.id)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['artifacts', index, 'outputRef'],
          message: 'Artifact outputRef must reference an output in the same commit.',
        });
      }
    });
  });

export const WorkflowCompletionReceiptSchema = z
  .object({
    contract: z.literal('WorkflowCompletionReceipt'),
    commitId: ContractIdentifierSchema,
    runRef: EntityRefSchema,
    outputRefs: z.array(EntityRefSchema),
    artifactRefs: z.array(EntityRefSchema),
    contentHash: Sha256Schema,
    committedAt: IsoDateTimeSchema,
    idempotentReplay: z.boolean(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.runRef.kind !== 'application-run') {
      context.addIssue({
        code: 'custom',
        path: ['runRef', 'kind'],
        message: 'runRef must reference an application-run.',
      });
    }
    receipt.outputRefs.forEach((ref, index) => {
      if (ref.kind !== 'workflow-output') {
        context.addIssue({
          code: 'custom',
          path: ['outputRefs', index, 'kind'],
          message: 'outputRefs must reference workflow-output records.',
        });
      }
    });
    receipt.artifactRefs.forEach((ref, index) => {
      if (ref.kind !== 'artifact') {
        context.addIssue({
          code: 'custom',
          path: ['artifactRefs', index, 'kind'],
          message: 'artifactRefs must reference artifacts.',
        });
      }
    });
  });

export type WorkflowPublication = z.infer<typeof WorkflowPublicationSchema>;
export type WorkflowCatalogEntry = z.infer<typeof WorkflowCatalogEntrySchema>;
export type WorkflowCompletionCommit = z.infer<typeof WorkflowCompletionCommitSchema>;
export type WorkflowCompletionReceipt = z.infer<typeof WorkflowCompletionReceiptSchema>;
