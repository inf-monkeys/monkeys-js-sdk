import { z } from 'zod';
import { DeclarativeRuntimeResolveResultSchema, type DeclarativeRuntimeResolveResult } from '../contracts/declarative-control-http';

export const RUNTIME_DEFINITION_FORMAT = 'dictionary-v1';
export const RUNTIME_DEFINITION_FORMAT_HEADER = 'x-monkeys-runtime-definition-format';
const CONTRACT = 'DeclarativeRuntimeDictionary';
const MAX_ENTRIES = 8192;
const MAX_EXPANDED_CHARACTERS = 32 * 1024 * 1024;
type ObjectValue = Record<string, any>;
export interface RuntimeDefinitionDictionary {
  contract: typeof CONTRACT;
  schemaVersion: 1;
  payload: unknown;
  values: unknown[];
}

const record = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): ObjectValue[] => {
  if (!Array.isArray(value) || value.length > 4096 || value.some(item => !record(item))) throw new TypeError('Invalid runtime definition collection.');
  return value;
};

/** Copy only protocol containers. Opaque props, expressions and business JSON are never rewritten. */
function mapDefinition(input: unknown, map: (value: unknown) => unknown): unknown {
  if (!record(input) || input.outcome !== 'declarative' || !record(input.resolved) || !record(input.resolved.page)) return input;
  const page = input.resolved.page;
  const fields = (source: ObjectValue, names: string[]) => {
    const result = { ...source };
    for (const name of names) if (source[name] !== undefined) result[name] = map(source[name]);
    return result;
  };
  return { ...input, resolved: { ...input.resolved, page: {
    ...page,
    capabilityInstances: list(page.capabilityInstances).map(instance => fields(instance, [
      'capabilityRevisionRef', 'providerRevisionRef', 'propertySchemaRevisionRef',
    ])),
    programBindings: list(page.programBindings ?? []).map(binding => fields(binding, [
      'definition', 'programRevisionRef', 'sourceIntentSchemaRevisionRef',
    ])),
    renderTree: { ...page.renderTree, nodes: list(page.renderTree?.nodes).map(node => fields(node, [
      'pageRef', 'capabilityRef', 'providerRef', 'lifecycle', 'scroll', 'surface',
    ])) },
  } } };
}

/** Input has already passed the runtime service contract. No extra whole-page parse/copy here. */
export function encodeRuntimeDefinition(input: DeclarativeRuntimeResolveResult): RuntimeDefinitionDictionary {
  const values: unknown[] = [];
  const indices = new Map<string, number>();
  const identities = new WeakMap<object, number>();
  const payload = mapDefinition(input, value => {
    if (!record(value)) throw new TypeError('Invalid runtime definition object.');
    const existing = identities.get(value);
    if (existing !== undefined) return existing;
    const key = JSON.stringify(value);
    let index = indices.get(key);
    if (index === undefined) {
      index = values.length;
      if (index >= MAX_ENTRIES) throw new RangeError('Runtime definition dictionary is too large.');
      indices.set(key, index);
      values.push(value);
    }
    identities.set(value, index);
    return index;
  });
  return { contract: CONTRACT, schemaVersion: 1, payload, values };
}

/** Expansion is transport-only. The caller validates the canonical schema exactly once afterwards. */
export function expandRuntimeDefinition(input: unknown): unknown {
  if (!record(input) || input.contract !== CONTRACT) return input;
  if (input.schemaVersion !== 1 || !Array.isArray(input.values) || input.values.length > MAX_ENTRIES ||
      Object.keys(input).some(key => !['contract', 'schemaVersion', 'payload', 'values'].includes(key)))
    throw new TypeError('Invalid runtime definition dictionary.');
  const lengths = input.values.map(value => {
    if (!record(value)) throw new TypeError('Invalid runtime definition dictionary entry.');
    return JSON.stringify(value).length;
  });
  let expandedLength = JSON.stringify(input.payload).length;
  const used = new Set<number>();
  const result = mapDefinition(input.payload, index => {
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= input.values.length)
      throw new TypeError('Invalid runtime definition dictionary reference.');
    expandedLength += lengths[index];
    if (expandedLength > MAX_EXPANDED_CHARACTERS) throw new RangeError('Expanded runtime definition is too large.');
    used.add(index);
    return input.values[index];
  });
  if (used.size !== input.values.length) throw new TypeError('Unused runtime definition dictionary entry.');
  return result;
}

export const RuntimeDefinitionResponseSchema = z.preprocess((input, context) => {
  try { return expandRuntimeDefinition(input); }
  catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid runtime definition.' }); return z.NEVER; }
}, DeclarativeRuntimeResolveResultSchema);

export const runtimeDefinitionEtag = (etag: string): string => {
  if (!/^"[^"\r\n]+"$/.test(etag)) throw new TypeError('Invalid runtime ETag.');
  return `"${RUNTIME_DEFINITION_FORMAT}.${etag.slice(1, -1)}"`;
};
