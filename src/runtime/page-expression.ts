import type { JsonObject, JsonValue } from '../contracts/common';
import {
  PageExpressionSchema, PagePropertyBindingSchema, PAGE_EXPRESSION_LIMITS, assertPageValueBudget,
  type PageExpression, type PagePropertyBinding,
} from '../contracts/page-expression';

export type PageExpressionContext = Partial<Record<'state' | 'model' | 'bindings' | 'scope' | 'intent' | 'result' | 'actions', JsonValue>>;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
const fail = (code: string): never => { throw Object.assign(new Error(code), { code }); };
const assertBudget = assertPageValueBudget;

export const readPageValue = (value: JsonValue | undefined, path: readonly string[]): JsonValue | undefined => {
  let current = value;
  for (const segment of path) {
    if (unsafe.has(segment)) fail('PAGE_EXPRESSION_UNSAFE_PATH');
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    if (Array.isArray(current) && !/^(0|[1-9][0-9]*)$/.test(segment)) return undefined;
    current = (current as JsonObject)[segment];
  }
  return current;
};

const unary = new Set(['not', 'string', 'number', 'length', 'round', 'entries', 'from-entries', 'trim']);
const binary = new Set(['subtract', 'divide', 'equals', 'not-equals', 'less-than', 'less-or-equal', 'greater-than', 'greater-or-equal', 'includes', 'get', 'fixed']);

export const compilePageExpression = (input: unknown): PageExpression => {
  assertBudget(input);
  const expression = PageExpressionSchema.parse(input);
  const check = (node: PageExpression): void => {
    if (node.kind === 'operator') {
      if ((unary.has(node.operator) && node.arguments.length !== 1) || (binary.has(node.operator) && node.arguments.length !== 2) || (['set-path', 'slice'].includes(node.operator) && node.arguments.length !== 3) || (node.operator === 'number-format' && node.arguments.length !== 5)) fail('PAGE_EXPRESSION_ARITY');
      node.arguments.forEach(check);
    } else if (node.kind === 'conditional') {
      check(node.condition); check(node.then); check(node.else);
    } else if (node.kind === 'object') Object.values(node.fields).forEach(check);
    else if (node.kind === 'array') node.items.forEach(check);
    else if (node.kind === 'map' || node.kind === 'filter' || node.kind === 'sum') { check(node.source); check(node.value); }
  };
  check(expression);
  return expression;
};

const number = (value: JsonValue): number => typeof value === 'number' && Number.isFinite(value) ? value : fail('PAGE_EXPRESSION_TYPE_NUMBER');
const boolean = (value: JsonValue): boolean => typeof value === 'boolean' ? value : fail('PAGE_EXPRESSION_TYPE_BOOLEAN');
const finite = (value: number): number => Number.isFinite(value) ? value : fail('PAGE_EXPRESSION_NUMBER');
const object = (value: JsonValue): JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value : fail('PAGE_EXPRESSION_TYPE_OBJECT');
const valuePath = (value: JsonValue): string[] => {
  if (!Array.isArray(value) || value.length > 16 || value.some((segment) => typeof segment !== 'string' || !segment || unsafe.has(segment))) return fail('PAGE_EXPRESSION_UNSAFE_PATH');
  return value as string[];
};

export const writePageDraftPath = (source: JsonValue, path: readonly string[], value: JsonValue): JsonValue => {
  if (!path.length) return value;
  const [segment, ...rest] = path;
  if (!segment || unsafe.has(segment) || path.length > 16) return fail('PAGE_EXPRESSION_UNSAFE_PATH');
  if (Array.isArray(source)) {
    if (!/^(0|[1-9][0-9]*)$/.test(segment) || Number(segment) >= source.length) return fail('PAGE_EXPRESSION_ARRAY_INDEX');
    return source.map((item, index) => index === Number(segment) ? writePageDraftPath(item, rest, value) : item);
  }
  const current = object(source);
  return { ...current, [segment]: writePageDraftPath(current[segment] ?? {}, rest, value) };
};

const same = (a: JsonValue, b: JsonValue): boolean => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && same((a as JsonObject)[key]!, (b as JsonObject)[key]!));
};

const evaluateCompiled = (expression: PageExpression, context: PageExpressionContext, budget: { operations: number }): JsonValue => {
  const run = (node: PageExpression, current: PageExpressionContext): JsonValue => {
    if (++budget.operations > PAGE_EXPRESSION_LIMITS.operations) fail('PAGE_EXPRESSION_BUDGET');
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'read') {
      const value = readPageValue(current[node.root], node.path) ?? null;
      assertBudget(value);
      return value;
    }
    if (node.kind === 'conditional') return run(boolean(run(node.condition, current)) ? node.then : node.else, current);
    if (node.kind === 'object') return Object.fromEntries(Object.entries(node.fields).map(([key, value]) => [key, run(value, current)]));
    if (node.kind === 'array') return node.items.map((value) => run(value, current));
    if (node.kind === 'map' || node.kind === 'filter' || node.kind === 'sum') {
      const source = run(node.source, current);
      if (!Array.isArray(source)) return fail('PAGE_EXPRESSION_TYPE_ARRAY');
      if (source.length > PAGE_EXPRESSION_LIMITS.collection) fail('PAGE_EXPRESSION_BUDGET');
      const values = source.map((item, index) => run(node.value, { ...current, scope: { item, index, parent: current.scope ?? null } }));
      if (node.kind === 'map') return values;
      if (node.kind === 'filter') return source.filter((_, index) => boolean(values[index]!));
      return finite(values.reduce<number>((total, value) => total + number(value), 0));
    }
    if (node.kind !== 'operator') return fail('PAGE_EXPRESSION_INVALID');
    if (node.operator === 'coalesce') {
      for (const argument of node.arguments) { const value = run(argument, current); if (value !== null) return value; }
      return null;
    }
    if (node.operator === 'and') return node.arguments.every((argument) => boolean(run(argument, current)));
    if (node.operator === 'or') return node.arguments.some((argument) => boolean(run(argument, current)));
    const values = node.arguments.map((argument) => run(argument, current));
    const first = values[0]!;
    const second = values[1]!;
    switch (node.operator) {
      case 'add': return finite(values.reduce<number>((a, b) => a + number(b), 0));
      case 'subtract': return finite(number(first) - number(second));
      case 'multiply': return finite(values.reduce<number>((a, b) => a * number(b), 1));
      case 'divide': { const numerator = number(first); const denominator = number(second); return denominator === 0 ? null : finite(numerator / denominator); }
      case 'min': return Math.min(...values.map(number));
      case 'max': return Math.max(...values.map(number));
      case 'round': return Math.round(number(first));
      case 'equals': return same(first, second);
      case 'not-equals': return !same(first, second);
      case 'less-than': return number(first) < number(second);
      case 'less-or-equal': return number(first) <= number(second);
      case 'greater-than': return number(first) > number(second);
      case 'greater-or-equal': return number(first) >= number(second);
      case 'not': return !boolean(first);
      case 'string': return first === null ? '' : typeof first === 'object' ? fail('PAGE_EXPRESSION_TYPE_SCALAR') : String(first);
      case 'number': return typeof first === 'number' ? first : typeof first === 'string' && first.trim() && Number.isFinite(Number(first)) ? Number(first) : null;
      case 'concat': {
        const strings = values.map((value) => typeof value === 'string' ? value : fail('PAGE_EXPRESSION_TYPE_STRING'));
        if (strings.reduce((bytes, value) => bytes + value.length * 2, 0) > PAGE_EXPRESSION_LIMITS.bytes) fail('PAGE_EXPRESSION_BUDGET');
        return strings.join('');
      }
      case 'length': return typeof first === 'string' || Array.isArray(first) ? first.length : fail('PAGE_EXPRESSION_TYPE_COLLECTION');
      case 'includes': return Array.isArray(first) ? first.some((value) => same(value, second)) : typeof first === 'string' && typeof second === 'string' ? first.includes(second) : fail('PAGE_EXPRESSION_TYPE_COLLECTION');
      case 'get': {
        if (typeof second !== 'string') return fail('PAGE_EXPRESSION_TYPE_STRING');
        return readPageValue(first, [second]) ?? null;
      }
      case 'set-path': return writePageDraftPath(first, valuePath(second), values[2]!);
      case 'merge': {
        const objects = values.map(object);
        const merged = Object.assign({}, ...objects) as JsonObject;
        assertBudget(merged);
        return merged;
      }
      case 'entries': return Object.entries(object(first));
      case 'from-entries': {
        const result: JsonObject = {};
        if (!Array.isArray(first) || first.length > PAGE_EXPRESSION_LIMITS.collection) return fail('PAGE_EXPRESSION_TYPE_ARRAY');
        for (const pair of first) {
          if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || unsafe.has(pair[0])) return fail('PAGE_EXPRESSION_ENTRY');
          if (Object.prototype.hasOwnProperty.call(result, pair[0])) return fail('PAGE_EXPRESSION_DUPLICATE_KEY');
          result[pair[0]] = pair[1]!;
        }
        return result;
      }
      case 'array-concat': {
        const result: JsonValue[] = [];
        for (const value of values) {
          if (!Array.isArray(value)) return fail('PAGE_EXPRESSION_TYPE_ARRAY');
          if (result.length + value.length > PAGE_EXPRESSION_LIMITS.collection) return fail('PAGE_EXPRESSION_BUDGET');
          result.push(...value);
        }
        return result;
      }
      case 'slice': {
        const start = number(second); const end = number(values[2]!);
        if (!Array.isArray(first) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return fail('PAGE_EXPRESSION_TYPE_ARRAY');
        return first.slice(start, end);
      }
      case 'trim': return typeof first === 'string' ? first.trim() : fail('PAGE_EXPRESSION_TYPE_STRING');
      case 'number-format': {
        if (second !== 'en-US' && second !== 'zh-CN') return fail('PAGE_EXPRESSION_LOCALE');
        const minimumFractionDigits = number(values[2]!);
        const maximumFractionDigits = number(values[3]!);
        if (![minimumFractionDigits, maximumFractionDigits].every((digits) => Number.isSafeInteger(digits) && digits >= 0 && digits <= 10) || minimumFractionDigits > maximumFractionDigits) return fail('PAGE_EXPRESSION_PRECISION');
        return new Intl.NumberFormat(second, { minimumFractionDigits, maximumFractionDigits, useGrouping: boolean(values[4]!) }).format(number(first));
      }
      case 'fixed': {
        const digits = number(second);
        if (!Number.isSafeInteger(digits) || digits < 0 || digits > 10) return fail('PAGE_EXPRESSION_PRECISION');
        return number(first).toFixed(digits);
      }

    }
  };
  const result = run(expression, context);
  assertBudget(result);
  return result;
};

export const evaluatePageExpression = (expression: unknown, context: PageExpressionContext): JsonValue =>
  evaluateCompiled(compilePageExpression(expression), context, { operations: 0 });

const write = (input: JsonObject, path: readonly string[], value: JsonValue): JsonObject => {
  const [key, ...rest] = path;
  if (!key || unsafe.has(key)) return fail('PAGE_EXPRESSION_UNSAFE_PATH');
  if (!rest.length) return { ...input, [key]: value };
  const child = input[key];
  if (child !== undefined && (child === null || typeof child !== 'object' || Array.isArray(child))) fail('PAGE_PROPERTY_PATH_TYPE');
  return { ...input, [key]: write((child ?? {}) as JsonObject, rest, value) };
};

export const projectPageProperties = (base: JsonObject, bindings: readonly PagePropertyBinding[], context: PageExpressionContext): JsonObject => {
  assertBudget(bindings);
  const parsed = bindings.map((binding) => PagePropertyBindingSchema.parse(binding));
  const paths: string[][] = [];
  for (const binding of parsed) {
    if (paths.some((path) => path.slice(0, Math.min(path.length, binding.targetPath.length)).every((key, i) => key === binding.targetPath[i]))) fail('PAGE_PROPERTY_OVERLAP');
    paths.push(binding.targetPath);
  }
  const budget = { operations: 0 };
  return parsed.reduce((model, binding) => {
    const value = evaluateCompiled(compilePageExpression(binding.expression), context, budget);
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (binding.valueType && type !== binding.valueType) fail('PAGE_PROPERTY_TYPE');
    return write(model, binding.targetPath, value);
  }, base);
};
