import { z } from 'zod';
import { JsonObjectSchema, JsonValueSchema } from './common';

const Id = z.string().min(1).max(256);
export const DesignBoardNodeKindSchema = z.enum(['workflow', 'instruction', 'output', 'live-image', 'live-image-workflow', 'linesheet-slot', 'linesheet-table', 'note', 'other']);
export const DesignBoardNodeSchema = z.object({
  id: Id, pageId: Id, kind: DesignBoardNodeKindSchema, title: z.string().max(2000),
  x: z.number().finite(), y: z.number().finite(), width: z.number().finite().positive(), height: z.number().finite().positive(),
  props: JsonObjectSchema, meta: JsonObjectSchema, deleted: z.boolean().optional(),
}).strict();
export const DesignBoardPageSchema = z.object({ id: Id, name: z.string().min(1).max(2000), order: z.number().int().nonnegative(), backgroundColor: z.string().max(128).optional(), backgroundFileRef: z.string().regex(/^file:\/\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/).optional() }).strict();
export const DesignBoardConnectionSchema = z.object({
  id: Id, pageId: Id, from: Id, to: Id, label: z.string().max(2000).optional(), kind: Id, props: JsonObjectSchema, deleted: z.boolean().optional(),
}).strict();
export const DesignBoardFileSchema = z.object({
  canonicalUri: z.string().regex(/^file:\/\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?:#[A-Za-z0-9_-]+)?$/),
  fileId: Id.optional(), mimeType: z.string().min(1).max(128), byteSize: z.number().int().nonnegative().optional(),
  contentHash: z.string().optional(), role: Id,
}).strict();
export const DesignBoardSceneElementSchema = z.object({
  id: Id, type: z.string().min(1), x: z.number().finite(), y: z.number().finite(),
  width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative(),
}).catchall(JsonValueSchema);
export const DesignBoardDomainSchema = z.object({
  schemaVersion: z.literal(1), boardId: Id, projectId: Id.optional(), revision: z.number().int().nonnegative().optional(),
  pages: z.array(DesignBoardPageSchema).min(1).max(200), nodes: z.array(DesignBoardNodeSchema).max(10000),
  connections: z.array(DesignBoardConnectionSchema).max(20000), files: z.array(DesignBoardFileSchema).max(10000),
}).strict();
export const DesignBoardDocumentSchema = z.object({
  engine: z.literal('excalidraw'), schemaVersion: z.literal(1),
  document: z.object({ elements: z.array(DesignBoardSceneElementSchema).max(20000), appState: JsonObjectSchema.optional(), files: z.object({}).strict().optional() }).strict(),
  domain: DesignBoardDomainSchema,
}).strict().superRefine((document, context) => {
  const unique = (values: string[], path: string[]) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: 'custom', path, message: 'Board identities must be unique.' });
  };
  unique(document.domain.pages.map((page) => page.id), ['domain', 'pages']);
  unique(document.domain.nodes.map((node) => node.id), ['domain', 'nodes']);
  unique(document.domain.connections.map((edge) => edge.id), ['domain', 'connections']);
  unique(document.document.elements.map((element) => element.id), ['document', 'elements']);
  unique(document.domain.files.map((file) => file.canonicalUri), ['domain', 'files']);
  const pages = new Set(document.domain.pages.map((page) => page.id));
  const nodes = new Map(document.domain.nodes.map((node) => [node.id, node]));
  document.document.elements.forEach((element, index) => {
    const pageId = (element.customData as any)?.designBoard?.pageId;
    if (pageId !== undefined && !pages.has(pageId)) context.addIssue({ code: 'custom', path: ['document', 'elements', index], message: 'Scene page does not exist.' });
  });
  document.domain.nodes.forEach((node, index) => {
    if (!pages.has(node.pageId)) context.addIssue({ code: 'custom', path: ['domain', 'nodes', index, 'pageId'], message: 'Node page does not exist.' });
  });
  document.domain.connections.forEach((edge, index) => {
    if (!pages.has(edge.pageId) || !nodes.has(edge.from) || !nodes.has(edge.to) || edge.from === edge.to)
      context.addIssue({ code: 'custom', path: ['domain', 'connections', index], message: 'Connection endpoints and page must exist.' });
    if (nodes.get(edge.from)?.pageId !== edge.pageId || nodes.get(edge.to)?.pageId !== edge.pageId)
      context.addIssue({ code: 'custom', path: ['domain', 'connections', index], message: 'Connections cannot cross pages.' });
  });
});

export const DesignBoardChangesSchema = z.object({
  pages: z.array(DesignBoardPageSchema).max(200).optional(),
  appState: JsonObjectSchema.optional(),
  scenes: z.array(z.object({ pageId: Id, elements: z.array(DesignBoardSceneElementSchema).max(20000) }).strict()).max(200),
  nodes: z.array(DesignBoardNodeSchema).max(10000), removedNodeIds: z.array(Id).max(10000),
  connections: z.array(DesignBoardConnectionSchema).max(20000), removedConnectionIds: z.array(Id).max(20000),
  files: z.array(DesignBoardFileSchema).max(10000), removedFileUris: z.array(z.string()).max(10000),
}).strict();
export const DesignBoardCommitCommandSchema = z.object({
  contract: z.literal('DesignBoardCommitCommand'), schemaVersion: z.literal(1), boardId: Id,
  expectedRevision: z.number().int().nonnegative(), requestId: Id, changes: DesignBoardChangesSchema,
}).strict();

export type DesignBoardNodeKind = z.infer<typeof DesignBoardNodeKindSchema>;
export type DesignBoardNode = z.infer<typeof DesignBoardNodeSchema>;
export type DesignBoardPage = z.infer<typeof DesignBoardPageSchema>;
export type DesignBoardConnection = z.infer<typeof DesignBoardConnectionSchema>;
export type DesignBoardFile = z.infer<typeof DesignBoardFileSchema>;
export type DesignBoardDomain = z.infer<typeof DesignBoardDomainSchema>;
export type DesignBoardSceneElement = z.infer<typeof DesignBoardSceneElementSchema>;
export type DesignBoardDocument<Element = DesignBoardSceneElement> = {
  engine: 'excalidraw'; schemaVersion: 1;
  document: { elements: Element[]; appState?: Record<string, unknown>; files?: Record<string, unknown> };
  domain: Omit<DesignBoardDomain, 'nodes' | 'connections'> & {
    nodes: Array<Omit<DesignBoardNode, 'props' | 'meta'> & { props: Record<string, unknown>; meta: Record<string, unknown> }>;
    connections: Array<Omit<DesignBoardConnection, 'props'> & { props: Record<string, unknown> }>;
  };
};
export type DesignBoardChanges = z.infer<typeof DesignBoardChangesSchema>;
export type DesignBoardCommitCommand = z.infer<typeof DesignBoardCommitCommandSchema>;
