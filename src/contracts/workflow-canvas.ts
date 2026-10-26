import { z } from 'zod';
import { JsonValueSchema } from './common';

/** Vendor scene fields are presentation data; workflow meaning is referenced by identity. */
export const WorkflowCanvasElementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['rectangle', 'diamond', 'ellipse', 'text', 'arrow', 'line', 'freedraw', 'image', 'frame', 'magicframe', 'embeddable', 'iframe']),
  x: z.number().finite(), y: z.number().finite(),
  width: z.number().finite().nonnegative(), height: z.number().finite().nonnegative(),
  customData: z.object({
    workflow: z.object({
      nodeRef: z.string().min(1).optional(),
      edgeRef: z.string().min(1).optional(),
    }).strict().optional(),
  }).strict().optional(),
}).catchall(JsonValueSchema);

export const WorkflowCanvasSchema = z.object({
  engine: z.literal('excalidraw'),
  schemaVersion: z.literal(1),
  elements: z.array(WorkflowCanvasElementSchema).max(20000),
  files: z.record(z.string(), z.object({
    reference: z.string().regex(/^file:\/\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
    mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']),
    created: z.number().finite().nonnegative(),
  }).strict()),
}).strict().superRefine((canvas, context) => {
  if (new Set(canvas.elements.map(element => element.id)).size !== canvas.elements.length) {
    context.addIssue({ code: 'custom', path: ['elements'], message: 'Canvas element identities must be unique.' });
  }
});

export type WorkflowCanvas = z.infer<typeof WorkflowCanvasSchema>;
