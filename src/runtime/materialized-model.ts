import type { JsonObject, JsonValue } from '../contracts/common';
import { MaterializedModelProjectionSchema, type MaterializedModelProjection } from '../contracts/materialized-model';

const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
function fail(code: string): never { throw Object.assign(new Error(code), { code }); }
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : fail('MATERIALIZED_MODEL_INVALID');
const read = (value: unknown, path: readonly string[]): JsonValue => {
  let current: any = value;
  for (const key of path) {
    if (unsafe.has(key)) fail('MATERIALIZED_MODEL_UNSAFE_PATH');
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) fail('MATERIALIZED_MODEL_PATH_MISSING');
    current = current[key];
  }
  return current;
};
const integer = (value: unknown, min: number, max: number): number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fail('MATERIALIZED_MODEL_INCOMPLETE');

export function assertMaterializedModelBudget(value: unknown, budget: MaterializedModelProjection['budget']): void {
  const pending = [{ value, depth: 0 }];
  let nodes = 0, bytes = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++nodes > budget.maxNodes || item.depth > 64) fail('MATERIALIZED_MODEL_BUDGET');
    bytes += 32; // Conservative JSON punctuation / scalar overhead, separate from string and key bytes.
    const current = item.value;
    if (typeof current === 'string') bytes += current.length * 2;
    else if (typeof current === 'number' && !Number.isFinite(current)) fail('MATERIALIZED_MODEL_INVALID');
    else if (current !== null && typeof current === 'object') {
      if (Array.isArray(current) && current.length > Math.max(budget.maxItems, budget.maxRows)) fail('MATERIALIZED_MODEL_BUDGET');
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) fail('MATERIALIZED_MODEL_INVALID');
      for (const [key, child] of Object.entries(current)) {
        if (unsafe.has(key)) fail('MATERIALIZED_MODEL_UNSAFE_PATH');
        bytes += key.length * 2;
        if (pending.length >= budget.maxNodes) fail('MATERIALIZED_MODEL_BUDGET');
        pending.push({ value: child, depth: item.depth + 1 });
      }
    } else if (current !== null && !['string', 'number', 'boolean'].includes(typeof current)) fail('MATERIALIZED_MODEL_INVALID');
    if (bytes > budget.maxBytes) fail('MATERIALIZED_MODEL_BUDGET');
  }
}

/** Assign into a private clone only. Array indexes must already exist. */
function assign(root: JsonObject, path: readonly string[], value: JsonValue): void {
  let target: any = root;
  for (const key of path.slice(0, -1)) {
    if (unsafe.has(key) || !target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, key)) fail('MATERIALIZED_MODEL_PATH_MISSING');
    target = target[key];
  }
  const last = path[path.length - 1]!;
  if (unsafe.has(last) || !target || typeof target !== 'object' || !Object.prototype.hasOwnProperty.call(target, last)) fail('MATERIALIZED_MODEL_PATH_MISSING');
  target[last] = value;
}
const overlaps = (a: readonly string[], b: readonly string[]) => a.slice(0, Math.min(a.length, b.length)).every((key, index) => key === b[index]);
const canonical = (value: JsonValue): string => value && typeof value === 'object' ? Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key]!)).join(',') + '}' : JSON.stringify(value);

/** No expressions, arbitrary functions, business calculations or network access. */
export function prepareMaterializedModelProjection(input: unknown): (raw: JsonObject) => JsonObject {
  const config = MaterializedModelProjectionSchema.parse(input);
  if (config.kind === 'value') return raw => {
    const selected = object(read(raw, config.path));
    assertMaterializedModelBudget(selected, config.budget);
    return structuredClone(selected);
  };
  for (let i = 0; i < config.collections.length; i++)
    if (config.collections.slice(i + 1).some(other => overlaps(config.collections[i]!.path, other.path))) fail('MATERIALIZED_MODEL_COLLECTION_OVERLAP');
  return raw => {
    const rows = read(raw, config.rowsPath);
    if (!Array.isArray(rows) || !rows.length || rows.length > config.budget.maxRows) fail('MATERIALIZED_MODEL_INCOMPLETE');
    const parts = rows.map(row => object(read(row, config.valuePath)));
    assertMaterializedModelBudget(parts, config.budget);
    const batch = read(parts[0], config.batchPath);
    if (typeof batch !== 'string' || !batch.trim() || batch.length > 256) fail('MATERIALIZED_MODEL_BATCH_MISMATCH');
    const count = integer(read(parts[0], config.countPath), 1, config.budget.maxRows);
    if (parts.length !== count) fail('MATERIALIZED_MODEL_INCOMPLETE');
    const ordered: JsonObject[] = new Array(count);
    for (const part of parts) {
      if (read(part, config.batchPath) !== batch || read(part, config.countPath) !== count) fail('MATERIALIZED_MODEL_BATCH_MISMATCH');
      const position = integer(read(part, config.indexPath), 0, count - 1);
      if (ordered[position]) fail('MATERIALIZED_MODEL_DUPLICATE_CHUNK');
      ordered[position] = part;
    }
    const collections = config.collections.map(collection => ({
      config: collection,
      expected: integer(read(ordered[0], collection.totalPath), 0, config.budget.maxItems),
      items: [] as JsonValue[], keys: new Set<string>(),
    }));
    let base: JsonObject | undefined, header: string | undefined;
    for (const part of ordered) {
      const model = structuredClone(object(read(part, config.modelPath)));
      for (const collection of collections) {
        if (read(part, collection.config.totalPath) !== collection.expected) fail('MATERIALIZED_MODEL_COUNT_MISMATCH');
        const items = read(model, collection.config.path);
        if (!Array.isArray(items)) fail('MATERIALIZED_MODEL_INVALID');
        if (collection.items.length + items.length > config.budget.maxItems) fail('MATERIALIZED_MODEL_BUDGET');
        for (const item of items) {
          if (collection.config.keyPath) {
            const key = read(item, collection.config.keyPath);
            if (typeof key !== 'string' && !(typeof key === 'number' && Number.isFinite(key))) fail('MATERIALIZED_MODEL_INVALID_KEY');
            const identity = typeof key + ':' + key;
            if (collection.keys.has(identity)) fail('MATERIALIZED_MODEL_DUPLICATE_ITEM');
            collection.keys.add(identity);
          }
          collection.items.push(item);
        }
        assign(model, collection.config.path, []);
      }
      const currentHeader = canonical(model);
      if (header !== undefined && header !== currentHeader) fail('MATERIALIZED_MODEL_HEADER_MISMATCH');
      header = currentHeader;
      base ??= model;
    }
    for (const collection of collections) {
      if (collection.items.length !== collection.expected) fail('MATERIALIZED_MODEL_COUNT_MISMATCH');
      assign(base!, collection.config.path, collection.items);
    }
    assertMaterializedModelBudget(base, config.budget);
    return base!;
  };
}

export type MaterializedModelPage = { model: JsonObject; pageInfo?: { hasMore: boolean; nextCursor?: string; returned?: number; pageSize?: number; total?: number } };

/** Exhaust an explicitly configured bounded cursor query before exposing a model. */
export async function collectMaterializedModelPages<T extends MaterializedModelPage>(input: {
  first: T;
  projection: MaterializedModelProjection;
  signal: AbortSignal;
  query: (cursor: string, signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  const config = MaterializedModelProjectionSchema.parse(input.projection);
  if (config.kind !== 'chunks' || !config.pagination) return input.first;
  const rows = read(input.first.model, config.rowsPath);
  if (!Array.isArray(rows)) fail('MATERIALIZED_MODEL_INVALID');
  if (rows.length > config.budget.maxRows) fail('MATERIALIZED_MODEL_BUDGET');
  let all = [...rows], current = input.first, pages = 1;
  const cursors = new Set<string>();
  assertMaterializedModelBudget(all, config.budget);
  while (current.pageInfo?.hasMore) {
    input.signal.throwIfAborted();
    const cursor = current.pageInfo.nextCursor;
    if (!cursor || cursors.has(cursor)) fail('MATERIALIZED_MODEL_CURSOR_INVALID');
    if (pages >= config.pagination.maxPages) fail('MATERIALIZED_MODEL_PAGE_LIMIT');
    cursors.add(cursor);
    current = await input.query(cursor, input.signal);
    input.signal.throwIfAborted();
    const nextRows = read(current.model, config.rowsPath);
    if (!Array.isArray(nextRows) || !nextRows.length) fail('MATERIALIZED_MODEL_CURSOR_INVALID');
    if (all.length + nextRows.length > config.budget.maxRows) fail('MATERIALIZED_MODEL_BUDGET');
    all.push(...nextRows); pages++;
    assertMaterializedModelBudget(all, config.budget);
  }
  input.signal.throwIfAborted();
  const model = structuredClone(input.first.model);
  assign(model, config.rowsPath, all);
  return { ...input.first, model, pageInfo: { ...current.pageInfo, hasMore: false, nextCursor: undefined, returned: all.length } };
}
