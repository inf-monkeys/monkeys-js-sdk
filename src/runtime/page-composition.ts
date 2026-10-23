import { z } from 'zod';
import { PageNodeSchema, PageSchema, type Page, type PageNode } from '../contracts/declarative-control';
import { JsonValueSchema, type JsonValue } from '../contracts/common';

/** Source-level components expand at publication, so existing hosts keep the same Page contract. */
const Name = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/);
const Path = z.array(z.union([Name, z.number().int().min(0).max(4095)])).min(1).max(32);
export const PageComponentDefinitionSchema = z.object({
  root: PageNodeSchema,
  inputs: z.record(Name, z.object({ path: Path, default: JsonValueSchema.optional() }).strict()).optional(),
  /** A slot names the local node whose children are supplied by the instance. */
  slots: z.record(Name, Name).optional(),
}).strict();
export type PageComponentDefinition = z.infer<typeof PageComponentDefinitionSchema>;
export type PageCompositionNode = PageNode | {
  id: string;
  use: string;
  inputs?: Record<string, JsonValue>;
  slots?: Record<string, PageCompositionNode[]>;
};
const SourceNode: z.ZodType<any> = z.lazy(() => z.union([
  z.object({ id: Name, use: Name, inputs: z.record(Name, JsonValueSchema).optional(), slots: z.record(Name, z.array(SourceNode)).optional() }).strict(),
  z.object({ children: z.array(SourceNode).optional() }).passthrough(),
]));
export const PageCompositionSchema = z.object({
  contract: z.literal('PageComposition'),
  schemaVersion: z.literal(1),
  /** Page header and state declarations; body is supplied separately. */
  page: z.record(z.string(), z.unknown()),
  components: z.record(Name, PageComponentDefinitionSchema),
  body: SourceNode,
}).strict();

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function assign(root: Record<string, any>, path: (string | number)[], value: JsonValue): void {
  let target: any = root;
  for (const [index, key] of path.entries()) {
    if (forbidden.has(String(key)) || ['id', 'children', 'data', 'actions', 'programActions', 'on', 'effects'].includes(String(path[0])))
      throw new TypeError('A component input must target presentation fields, not identities or executable declarations.');
    if (index === path.length - 1) { target[key] = structuredClone(value); return; }
    if (target[key] === null || typeof target[key] !== 'object') throw new TypeError('Component input path does not exist.');
    target = target[key];
  }
}

/** Reusable presentation trees with explicit inputs/slots; business state and operations stay in Page. */
export function compilePageComposition(input: unknown): Page {
  const source = PageCompositionSchema.parse(input);
  let count = 0;
  const ids = new Set<string>();
  const expand = (value: any, depth: number): PageNode => {
    if (++count > 4096 || depth > 64) throw new RangeError('Page composition exceeds its node budget.');
    if ('use' in value) {
      const definition = source.components[value.use];
      if (!definition) throw new TypeError(`Unknown Page component ${value.use}.`);
      const root = structuredClone(definition.root);
      const localNodes = new Map<string, PageNode>();
      const namespace = (node: PageNode, isRoot = false) => {
        if (localNodes.has(node.id)) throw new TypeError('Duplicate component-local node id.');
        localNodes.set(node.id, node);
        // Operations and scoped state belong to the instance's supplied slots, not a shared template.
        if (node.data?.length || node.actions?.length || node.programActions?.length || node.on?.length || node.effects?.length)
          throw new TypeError('Component templates contain presentation only; supply business operations through slots.');
        node.id = isRoot ? value.id : `${value.id}.${node.id}`;
        node.children?.forEach(child => namespace(child));
      };
      namespace(root, true);
      for (const node of localNodes.values()) {
        if (node.slot && localNodes.has(node.slot)) node.slot = localNodes.get(node.slot)!.id;
        const slots = node.model?.slots;
        if (slots && typeof slots === 'object' && !Array.isArray(slots)) {
          node.model!.slots = Object.fromEntries(Object.entries(slots).map(([name, target]) => [
            name, typeof target === 'string' && localNodes.has(target) ? localNodes.get(target)!.id : target,
          ]));
        }
      }
      for (const name of Object.keys(value.inputs ?? {}))
        if (!definition.inputs?.[name]) throw new TypeError(`Unknown component input ${name}.`);
      for (const [name, binding] of Object.entries(definition.inputs ?? {})) {
        const supplied = Object.prototype.hasOwnProperty.call(value.inputs ?? {}, name) ? value.inputs[name] : binding.default;
        if (supplied === undefined) throw new TypeError(`Missing component input ${name}.`);
        assign(root, binding.path, supplied);
      }
      for (const name of Object.keys(value.slots ?? {}))
        if (!definition.slots?.[name]) throw new TypeError(`Unknown component slot ${name}.`);
      for (const [name, localId] of Object.entries(definition.slots ?? {})) {
        const node = localNodes.get(localId);
        if (!node) throw new TypeError(`Unknown component slot target ${localId}.`);
        if (value.slots?.[name]) node.children = value.slots[name];
      }
      return expand(root, depth + 1);
    }
    if (ids.has(value.id)) throw new TypeError(`Duplicate Page node ${value.id}.`);
    ids.add(value.id);
    return { ...value, ...(value.children ? { children: value.children.map((child: unknown) => expand(child, depth + 1)) } : {}) };
  };
  return PageSchema.parse({ ...source.page, contract: 'Page', schemaVersion: 1, body: expand(source.body, 0) });
}
