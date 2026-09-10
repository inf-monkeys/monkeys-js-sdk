import type { JsonObject, JsonValue } from '../contracts/common';
import { RecordEditorDraftOperationSchema, RecordEditorPathSchema, RecordEditorSubmissionSnapshotSchema, RecordEditorValidationDetailsSchema, type RecordEditorSubmissionSnapshot, type RecordEditorDraft, type RecordEditorDraftOperation, type RecordEditorPath } from '../contracts/record-editor-draft';

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export const recordEditorValuesEqual = (left: JsonValue, right: JsonValue): boolean => {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => own(right, key) && recordEditorValuesEqual((left as JsonObject)[key]!, (right as JsonObject)[key]!));
};
export const recordEditorPathKey = (path: RecordEditorPath): string => JSON.stringify(RecordEditorPathSchema.parse(path));
const assertValue = (value: JsonValue) => {
  let nodes = 0;
  const visit = (current: JsonValue, depth: number) => {
    if (++nodes > 16384 || depth > 32) throw new RangeError('Editor draft exceeds its value budget.');
    if (current !== null && typeof current !== 'string' && typeof current !== 'boolean' && !(typeof current === 'number' && Number.isFinite(current)) && typeof current !== 'object') throw new TypeError('Editor draft requires JSON values.');
    if (typeof current === 'number' && !Number.isFinite(current)) throw new TypeError('Editor draft requires finite numbers.');
    if (current && typeof current === 'object' && !Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) throw new TypeError('Editor draft requires plain objects.');
    if (current && typeof current === 'object') for (const [key, child] of Object.entries(current)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new TypeError('Unsafe editor member.');
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
};
export const createRecordEditorDraft = (revision: string, value: JsonObject): RecordEditorDraft => {
  if (!revision || revision.length > 256) throw new TypeError('Editor reset requires a revision.');
  assertValue(value);
  const original = JSON.parse(JSON.stringify(value)) as JsonObject;
  return { revision, original, value: JSON.parse(JSON.stringify(original)), touched: [], errors: [] };
};
export const recordEditorDraftIsDirty = (draft: RecordEditorDraft): boolean => !recordEditorValuesEqual(draft.original, draft.value);
export const recordEditorArrayItems = (value: JsonValue | undefined, idKey: string): JsonObject[] => {
  RecordEditorPathSchema.parse([idKey]);
  if (!Array.isArray(value) || value.length > 1000) throw new TypeError('Editor array requires at most 1000 identified objects.');
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !own(item, idKey) || typeof item[idKey] !== 'string' || !item[idKey] || seen.has(item[idKey] as string)) throw new TypeError('Editor array requires unique non-empty stable IDs.');
    seen.add(item[idKey] as string);
  }
  return value as JsonObject[];
};
export const readRecordEditorPath = (value: JsonValue, path: RecordEditorPath): JsonValue | undefined => {
  let current: JsonValue | undefined = value;
  for (const segment of RecordEditorPathSchema.parse(path)) {
    if (typeof segment !== 'string') current = recordEditorArrayItems(current, segment.idKey).find((item) => item[segment.idKey] === segment.itemId);
    else current = current && typeof current === 'object' && !Array.isArray(current) && own(current, segment) ? current[segment] : undefined;
    if (current === undefined) return undefined;
  }
  return current;
};
const write = (value: JsonValue, path: RecordEditorPath, replacement: JsonValue): JsonValue => {
  if (!path.length) return replacement;
  const [segment, ...rest] = path;
  if (typeof segment !== 'string') {
    const items = recordEditorArrayItems(value, segment!.idKey);
    const index = items.findIndex((item) => item[segment!.idKey] === segment!.itemId);
    if (index < 0 || rest[0] === segment!.idKey) throw new TypeError('Editor item is missing or its stable ID is being changed.');
    const result = items.map((item, i) => i === index ? write(item, rest, replacement) : item);
    recordEditorArrayItems(result, segment!.idKey);
    if ((result[index] as JsonObject)[segment!.idKey] !== segment!.itemId) throw new TypeError('Editor stable ID cannot change.');
    return result;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Editor path requires an object.');
  return { ...value, [segment]: write(own(value, segment) ? value[segment]! : {}, rest, replacement) };
};
export const applyRecordEditorDraft = (draft: RecordEditorDraft, input: RecordEditorDraftOperation): RecordEditorDraft => {
  const operation = RecordEditorDraftOperationSchema.parse(input);
  if (operation.kind === 'reset') return createRecordEditorDraft(operation.revision, operation.value);
  const key = recordEditorPathKey(operation.path);
  const touched = draft.touched.some((path) => recordEditorPathKey(path) === key) ? draft.touched : [...draft.touched, operation.path];
  if (touched.length > 4096) throw new RangeError('Editor touched path budget exceeded.');
  if (operation.kind === 'touch') return { ...draft, touched };
  let replacement: JsonValue;
  if (operation.kind === 'set') replacement = operation.value;
  else {
    const items = [...recordEditorArrayItems(readRecordEditorPath(draft.value, operation.path), operation.idKey)];
    if (operation.kind === 'insert') {
      recordEditorArrayItems([...items, operation.value], operation.idKey);
      const before = operation.beforeId === undefined ? items.length : items.findIndex((item) => item[operation.idKey] === operation.beforeId);
      if (before < 0) throw new TypeError('Editor insertion target is missing.');
      items.splice(before, 0, operation.value);
    } else {
      const index = items.findIndex((item) => item[operation.idKey] === operation.itemId);
      if (index < 0) throw new TypeError('Editor item is missing.');
      if (operation.kind === 'move' && operation.beforeId === operation.itemId) return { ...draft, touched };
      const [item] = items.splice(index, 1);
      if (operation.kind === 'move') {
        const before = operation.beforeId === undefined ? items.length : items.findIndex((entry) => entry[operation.idKey] === operation.beforeId);
        if (before < 0) throw new TypeError('Editor move target is missing.');
        items.splice(before, 0, item!);
      }
    }
    replacement = items;
  }
  const value = write(draft.value, operation.path, replacement);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Editor root requires an object.');
  assertValue(value);
  return { ...draft, value, touched, errors: [] };
};


/** Deliberately select only the non-sensitive draft envelope, excluding secretChanges. */
export const captureRecordEditorSubmission = (payload: unknown): RecordEditorSubmissionSnapshot | undefined => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const input = payload as Record<string, unknown>;
  const parsed = RecordEditorSubmissionSnapshotSchema.safeParse({ revision: input.draftRevision, value: input.values });
  if (!parsed.success) return undefined;
  try {
    const draft = createRecordEditorDraft(parsed.data.revision, parsed.data.value);
    return { revision: draft.revision, value: draft.value };
  } catch { return undefined; }
};

export const projectRecordEditorValidation = (details: unknown, submission: RecordEditorSubmissionSnapshot | undefined) => {
  if (!submission) return undefined;
  const parsed = RecordEditorValidationDetailsSchema.safeParse(details);
  return parsed.success ? { revision: submission.revision, value: submission.value, errors: parsed.data.errors } : undefined;
};
