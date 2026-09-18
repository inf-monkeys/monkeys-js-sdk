import { z } from 'zod';
import { JsonValueSchema, type JsonValue } from './common';

export const PageMemberSchema = z.string().min(1).max(256).refine(
  (value) => !['__proto__', 'prototype', 'constructor'].includes(value),
  'Unsafe Page member.',
);
export const PageValuePathSchema = z.array(PageMemberSchema).max(16);
export const PageExpressionRootSchema = z.enum(['state', 'model', 'bindings', 'scope', 'intent', 'result', 'actions']);
export const PageOperatorSchema = z.enum([
  'add', 'subtract', 'multiply', 'divide', 'min', 'max', 'round',
  'equals', 'not-equals', 'less-than', 'less-or-equal', 'greater-than', 'greater-or-equal',
  'and', 'or', 'not', 'coalesce', 'concat', 'string', 'number', 'length', 'includes',
  'get', 'set-path', 'merge', 'entries', 'from-entries', 'array-concat', 'slice', 'trim', 'fixed', 'number-format', 'encode-uri-component',
]);
export type PageExpression =
  | { kind: 'literal'; value: JsonValue }
  | { kind: 'read'; root: z.infer<typeof PageExpressionRootSchema>; path: string[] }
  | { kind: 'operator'; operator: z.infer<typeof PageOperatorSchema>; arguments: PageExpression[] }
  | { kind: 'conditional'; condition: PageExpression; then: PageExpression; else: PageExpression }
  | { kind: 'object'; fields: Record<string, PageExpression> }
  | { kind: 'array'; items: PageExpression[] }
  | { kind: 'map' | 'filter' | 'sum'; source: PageExpression; value: PageExpression };

const RecursivePageExpressionSchema: z.ZodType<PageExpression> = z.lazy(() => z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('literal'), value: JsonValueSchema }).strict(),
  z.object({ kind: z.literal('read'), root: PageExpressionRootSchema, path: PageValuePathSchema }).strict(),
  z.object({ kind: z.literal('operator'), operator: PageOperatorSchema, arguments: z.array(RecursivePageExpressionSchema).min(1).max(32) }).strict(),
  z.object({ kind: z.literal('conditional'), condition: RecursivePageExpressionSchema, then: RecursivePageExpressionSchema, else: RecursivePageExpressionSchema }).strict(),
  z.object({ kind: z.literal('object'), fields: z.record(PageMemberSchema, RecursivePageExpressionSchema) }).strict(),
  z.object({ kind: z.literal('array'), items: z.array(RecursivePageExpressionSchema).max(1000) }).strict(),
  ...(['map', 'filter', 'sum'] as const).map((kind) => z.object({ kind: z.literal(kind), source: RecursivePageExpressionSchema, value: RecursivePageExpressionSchema }).strict()),
]));

export const PAGE_EXPRESSION_LIMITS = Object.freeze({ depth: 32, nodes: 4096, operations: 20000, collection: 1000, bytes: 1048576 });

export const assertPageValueBudget = (value: unknown): void => {
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  let bytes = 0;
  while (queue.length) {
    const item = queue.pop()!;
    if (++nodes > PAGE_EXPRESSION_LIMITS.nodes || item.depth > PAGE_EXPRESSION_LIMITS.depth) throw new Error('PAGE_EXPRESSION_BUDGET');
    if (typeof item.value === 'string') bytes += item.value.length * 2;
    if (item.value && typeof item.value === 'object') {
      for (const [key, child] of Object.entries(item.value)) {
        bytes += key.length * 2;
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('PAGE_EXPRESSION_UNSAFE_PATH');
        if (queue.length >= PAGE_EXPRESSION_LIMITS.nodes) throw new Error('PAGE_EXPRESSION_BUDGET');
        queue.push({ value: child, depth: item.depth + 1 });
      }
    }
    if (bytes > PAGE_EXPRESSION_LIMITS.bytes) throw new Error('PAGE_EXPRESSION_BUDGET');
  }
};

/** The input guard runs before recursive schema parsing, including direct Page parsing. */
export const PageExpressionSchema = z.unknown().superRefine((value, context) => {
  try { assertPageValueBudget(value); }
  catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'PAGE_EXPRESSION_BUDGET' }); }
}).pipe(RecursivePageExpressionSchema);

export const PagePropertyBindingSchema = z.object({
  targetPath: PageValuePathSchema.min(1),
  expression: PageExpressionSchema,
  valueType: z.enum(['string', 'number', 'boolean', 'object', 'array', 'null']).optional(),
}).strict();
export type PagePropertyBinding = z.infer<typeof PagePropertyBindingSchema>;

export const visitPageExpression = (expression: PageExpression, visit: (node: PageExpression) => void): void => {
  visit(expression);
  switch (expression.kind) {
    case 'operator': expression.arguments.forEach((node) => visitPageExpression(node, visit)); break;
    case 'conditional': [expression.condition, expression.then, expression.else].forEach((node) => visitPageExpression(node, visit)); break;
    case 'object': Object.values(expression.fields).forEach((node) => visitPageExpression(node, visit)); break;
    case 'array': expression.items.forEach((node) => visitPageExpression(node, visit)); break;
    case 'map': case 'filter': case 'sum':
      visitPageExpression(expression.source, visit); visitPageExpression(expression.value, visit); break;
  }
};

export const collectPageExpressionReads = (expression: PageExpression): Extract<PageExpression, { kind: 'read' }>[] => {
  const reads: Extract<PageExpression, { kind: 'read' }>[] = [];
  visitPageExpression(expression, (node) => { if (node.kind === 'read') reads.push(node); });
  return reads;
};

/** Reads supplied by the caller, excluding lexically bound collection item/index reads. */
export const collectExternalPageExpressionReads = (expression: PageExpression): Extract<PageExpression, { kind: 'read' }>[] => {
  const reads: Extract<PageExpression, { kind: 'read' }>[] = [];
  const visit = (node: PageExpression, depth: number): void => {
    if (node.kind === 'read') {
      let remaining = depth;
      let index = 0;
      while (remaining > 0 && node.path[index] === 'parent') { remaining -= 1; index += 1; }
      const local = node.root === 'scope' && remaining > 0 && ['item', 'index'].includes(node.path[index]);
      if (!local) reads.push(node);
      return;
    }
    switch (node.kind) {
      case 'operator': node.arguments.forEach(child => visit(child, depth)); break;
      case 'conditional': [node.condition, node.then, node.else].forEach(child => visit(child, depth)); break;
      case 'object': Object.values(node.fields).forEach(child => visit(child, depth)); break;
      case 'array': node.items.forEach(child => visit(child, depth)); break;
      case 'map': case 'filter': case 'sum': visit(node.source, depth); visit(node.value, depth + 1); break;
    }
  };
  visit(expression, 0);
  return reads;
};
