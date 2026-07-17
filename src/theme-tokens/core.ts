import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import dtcgFormatSchema from '../contracts/dtcg-format.schema.json';

export const THEME_TOKEN_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
] as const;

export type ThemeTokenType = (typeof THEME_TOKEN_TYPES)[number];
export type ThemeTokenDeprecated = boolean | string;
export type ThemeTokenExtensions = Record<string, unknown>;

export interface ThemeTokenReference {
  $ref: string;
}

export interface ThemeToken {
  $value?: unknown;
  $ref?: string;
  $type?: ThemeTokenType;
  $description?: string;
  $deprecated?: ThemeTokenDeprecated;
  $extensions?: ThemeTokenExtensions;
}

export interface ThemeTokenGroup {
  [name: string]: unknown;
}

export type ThemeTokens = Record<string, unknown>;

export interface ThemeColorValue {
  colorSpace:
    | 'srgb'
    | 'srgb-linear'
    | 'hsl'
    | 'hwb'
    | 'lab'
    | 'lch'
    | 'oklab'
    | 'oklch'
    | 'display-p3'
    | 'a98-rgb'
    | 'prophoto-rgb'
    | 'rec2020'
    | 'xyz-d65'
    | 'xyz-d50';
  components: [number | 'none', number | 'none', number | 'none'];
  alpha?: number;
  hex?: string;
}

export interface ThemeDimensionValue {
  value: number;
  unit: 'px' | 'rem';
}

export interface ThemeDurationValue {
  value: number;
  unit: 'ms' | 's';
}

export interface ResolvedThemeToken {
  path: string;
  type: ThemeTokenType;
  value: unknown;
  description?: string;
  deprecated?: ThemeTokenDeprecated;
  extensions?: ThemeTokenExtensions;
}

export interface ResolvedThemeTokens {
  document: ThemeTokens;
  materializedDocument: ThemeTokens;
  resolvedDocument: ThemeTokens;
  tokens: ReadonlyMap<string, ResolvedThemeToken>;
}

export interface ThemeTokenValidationIssue {
  path: string;
  message: string;
}

export class ThemeTokenValidationError extends TypeError {
  public readonly issues: readonly ThemeTokenValidationIssue[];

  constructor(message: string, issues: ThemeTokenValidationIssue[] = []) {
    super(message);
    this.name = 'ThemeTokenValidationError';
    this.issues = issues;
  }
}

const schema = dtcgFormatSchema as Record<string, unknown>;
const ajv = new Ajv({
  allErrors: true,
  strict: false,
  strictNumbers: true,
  validateFormats: false,
});

const validateDtcgDocument = ajv.compile(schema) as ValidateFunction;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isToken(value: unknown): value is ThemeToken & Record<string, unknown> {
  return isRecord(value) && (hasOwn(value, '$value') || hasOwn(value, '$ref'));
}

function isGroup(value: unknown): value is ThemeTokenGroup {
  return isRecord(value) && !isToken(value);
}

function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)])) as T;
}

function formatAjvIssues(errors: ErrorObject[] | null | undefined): ThemeTokenValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    message: `${error.message ?? 'is invalid'}${
      error.params && Object.keys(error.params).length > 0 ? ` (${JSON.stringify(error.params)})` : ''
    }`,
  }));
}

export function validateThemeTokensDocumentStructure(input: unknown): ThemeTokenValidationIssue[] {
  if (validateDtcgDocument(input)) return [];
  return formatAjvIssues(validateDtcgDocument.errors);
}

export function assertThemeTokensDocumentStructure(input: unknown): asserts input is ThemeTokens {
  const issues = validateThemeTokensDocumentStructure(input);
  if (issues.length === 0) return;
  const summary = issues.slice(0, 5).map((issue) => `${issue.path} ${issue.message}`).join('; ');
  throw new ThemeTokenValidationError(`Invalid DTCG 2025.10 token document: ${summary}`, issues);
}

const GROUP_META_KEYS = new Set(['$schema', '$type', '$description', '$deprecated', '$extensions']);

function mergeGroups(
  base: ThemeTokenGroup,
  override: ThemeTokenGroup,
  path: string[],
  sourceMerge: boolean,
): ThemeTokenGroup {
  const output = cloneJson(base);
  for (const [key, value] of Object.entries(override)) {
    if (key === '$extends') continue;
    if (key.startsWith('$') && key !== '$root') {
      output[key] = cloneJson(value);
      continue;
    }
    if (!hasOwn(output, key)) {
      output[key] = cloneJson(value);
      continue;
    }
    const existing = output[key];
    const existingKind = isToken(existing) ? 'token' : isGroup(existing) ? 'group' : 'metadata';
    const nextKind = isToken(value) ? 'token' : isGroup(value) ? 'group' : 'metadata';
    if (existingKind === 'group' && nextKind === 'group') {
      output[key] = mergeGroups(existing as ThemeTokenGroup, value as ThemeTokenGroup, [...path, key], sourceMerge);
      continue;
    }
    if (existingKind !== nextKind) {
      const reason = sourceMerge ? 'Token sources' : 'Extended groups';
      throw new ThemeTokenValidationError(
        `${reason} cannot change ${[...path, key].join('.')} from ${existingKind} to ${nextKind}.`,
      );
    }
    output[key] = cloneJson(value);
  }
  return output;
}

function decodeJsonPointer(reference: string): string[] {
  if (!reference.startsWith('#/')) {
    throw new ThemeTokenValidationError(`JSON Pointer reference must start with "#/": ${reference}`);
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(reference.slice(1));
  } catch {
    throw new ThemeTokenValidationError(`JSON Pointer contains invalid URI encoding: ${reference}`);
  }
  return decoded.slice(1).split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getAtSegments(document: unknown, segments: readonly string[], reference: string): unknown {
  let current = document;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment) || Number(segment) >= current.length) {
        throw new ThemeTokenValidationError(`Unresolved JSON Pointer reference: ${reference}`);
      }
      current = current[Number(segment)];
      continue;
    }
    if (!isRecord(current) || !hasOwn(current, segment)) {
      throw new ThemeTokenValidationError(`Unresolved JSON Pointer reference: ${reference}`);
    }
    current = current[segment];
  }
  return current;
}

function parseCurlyReference(reference: string): string[] | null {
  const match = reference.match(/^\{([^{}]+)\}$/);
  return match ? match[1].split('.') : null;
}

function getGroupReference(
  document: ThemeTokens,
  reference: string,
): { group: ThemeTokenGroup; key: string; path: string[] } {
  const curlyPath = parseCurlyReference(reference);
  const path = curlyPath ?? decodeJsonPointer(reference);
  const target = getAtSegments(document, path, reference);
  if (!isGroup(target)) {
    throw new ThemeTokenValidationError(`Group $extends must reference a group: ${reference}`);
  }
  return { group: target, key: path.join('.'), path };
}

function materializeGroups(document: ThemeTokens): ThemeTokens {
  const resolveGroup = (
    group: ThemeTokenGroup,
    path: string[],
    extendsStack: readonly string[],
  ): ThemeTokenGroup => {
    let merged: ThemeTokenGroup = {};
    const extension = group.$extends;
    if (typeof extension === 'string') {
      const target = getGroupReference(document, extension);
      if (extendsStack.includes(target.key)) {
        throw new ThemeTokenValidationError(
          `Circular group $extends reference: ${[...extendsStack, target.key].join(' -> ')}`,
        );
      }
      const base = resolveGroup(target.group, target.path, [...extendsStack, target.key]);
      merged = mergeGroups(base, group, path, false);
    } else {
      merged = cloneJson(group);
      delete merged.$extends;
    }

    for (const [key, value] of Object.entries(merged)) {
      if (key.startsWith('$')) continue;
      if (isGroup(value)) {
        merged[key] = resolveGroup(value, [...path, key], extendsStack);
      }
    }
    return merged;
  };

  return resolveGroup(document, [], ['$root-document']) as ThemeTokens;
}

interface CollectedToken {
  token: ThemeToken & Record<string, unknown>;
  inheritedType?: ThemeTokenType;
  inheritedDeprecated?: ThemeTokenDeprecated;
}

function collectTokens(document: ThemeTokens): Map<string, CollectedToken> {
  const tokens = new Map<string, CollectedToken>();
  const visitGroup = (
    group: ThemeTokenGroup,
    path: string[],
    inheritedType?: ThemeTokenType,
    inheritedDeprecated?: ThemeTokenDeprecated,
  ) => {
    const groupType = (group.$type as ThemeTokenType | undefined) ?? inheritedType;
    const groupDeprecated = (group.$deprecated as ThemeTokenDeprecated | undefined) ?? inheritedDeprecated;
    for (const [key, value] of Object.entries(group)) {
      if (GROUP_META_KEYS.has(key) || key === '$extends') continue;
      const tokenPath = [...path, key].join('.');
      if (isToken(value)) {
        tokens.set(tokenPath, {
          token: value,
          inheritedType: groupType,
          inheritedDeprecated: groupDeprecated,
        });
      } else if (isGroup(value)) {
        visitGroup(value, [...path, key], groupType, groupDeprecated);
      }
    }
  };
  visitGroup(document, []);
  return tokens;
}

function expectedChildType(parentType: ThemeTokenType | undefined, key: string): ThemeTokenType | undefined {
  switch (parentType) {
    case 'border':
      return ({ color: 'color', width: 'dimension', style: 'strokeStyle' } as const)[key];
    case 'transition':
      return ({ duration: 'duration', delay: 'duration', timingFunction: 'cubicBezier' } as const)[key];
    case 'shadow':
      return ({ color: 'color', offsetX: 'dimension', offsetY: 'dimension', blur: 'dimension', spread: 'dimension' } as const)[key];
    case 'gradient':
      return ({ color: 'color', position: 'number' } as const)[key];
    case 'typography':
      return ({
        fontFamily: 'fontFamily',
        fontSize: 'dimension',
        fontWeight: 'fontWeight',
        letterSpacing: 'dimension',
        lineHeight: 'number',
      } as const)[key];
    case 'strokeStyle':
      return key === 'dashArray' ? 'dimension' : undefined;
    case 'dimension':
    case 'duration':
      return key === 'value' ? 'number' : undefined;
    case 'color':
      return key === 'alpha' || key === 'components' ? 'number' : undefined;
    default:
      return undefined;
  }
}

function assertResolvedValueMatchesType(type: ThemeTokenType, value: unknown, path: string): void {
  const syntheticDocument = {
    token: {
      $type: type,
      $value: value,
    },
  };
  const issues = validateThemeTokensDocumentStructure(syntheticDocument);
  if (issues.length === 0) return;
  const mapped = issues.map((issue) => ({
    path: `${path}${issue.path.replace(/^\/token(?:\/\$value)?/, '')}`,
    message: issue.message,
  }));
  const summary = mapped.slice(0, 5).map((issue) => `${issue.path} ${issue.message}`).join('; ');
  throw new ThemeTokenValidationError(`Token ${path} has an invalid ${type} value: ${summary}`, mapped);
}

export function resolveThemeTokens(input: unknown): ResolvedThemeTokens {
  assertThemeTokensDocumentStructure(input);
  const document = cloneJson(input);
  const materializedDocument = materializeGroups(document);
  const collected = collectTokens(materializedDocument);
  const resolved = new Map<string, ResolvedThemeToken>();
  const resolvingTokens: string[] = [];

  const resolveToken = (path: string): ResolvedThemeToken => {
    const cached = resolved.get(path);
    if (cached) return cached;
    const entry = collected.get(path);
    if (!entry) throw new ThemeTokenValidationError(`Unknown token reference: ${path}`);
    if (resolvingTokens.includes(path)) {
      throw new ThemeTokenValidationError(`Circular token reference: ${[...resolvingTokens, path].join(' -> ')}`);
    }
    resolvingTokens.push(path);

    const token = entry.token;
    let tokenType = token.$type ?? entry.inheritedType;

    const inferReferenceType = (reference: string): ThemeTokenType | undefined => {
      const segments = decodeJsonPointer(reference);
      for (let length = segments.length; length > 0; length -= 1) {
        const candidate = segments.slice(0, length).join('.');
        if (!collected.has(candidate)) continue;
        const owner = resolveToken(candidate);
        if (length === segments.length || segments[length] === '$value') return owner.type;
        return undefined;
      }
      return undefined;
    };

    if (!tokenType && typeof token.$value === 'string') {
      const aliasPath = parseCurlyReference(token.$value)?.join('.');
      if (aliasPath) tokenType = resolveToken(aliasPath).type;
    }
    if (!tokenType && typeof token.$ref === 'string') tokenType = inferReferenceType(token.$ref);
    if (!tokenType) {
      resolvingTokens.pop();
      throw new ThemeTokenValidationError(
        `Token ${path} has no $type, does not inherit one, and cannot infer one from its reference.`,
      );
    }

    const resolvingPointers: string[] = [];
    const resolvePointer = (
      reference: string,
      expectedType: ThemeTokenType | undefined,
      location: string,
    ): unknown => {
      const marker = `${path}:${reference}`;
      if (resolvingPointers.includes(marker)) {
        throw new ThemeTokenValidationError(
          `Circular JSON Pointer reference at ${location}: ${[...resolvingPointers, marker].join(' -> ')}`,
        );
      }
      resolvingPointers.push(marker);
      const segments = decodeJsonPointer(reference);
      const target = getAtSegments(materializedDocument, segments, reference);
      let result: unknown;
      if (isToken(target)) {
        const targetPath = segments.join('.');
        const targetToken = resolveToken(targetPath);
        if (expectedType && targetToken.type !== expectedType) {
          throw new ThemeTokenValidationError(
            `Reference at ${location} expects ${expectedType} but ${targetPath} is ${targetToken.type}.`,
          );
        }
        result = targetToken.value;
      } else if (isGroup(target)) {
        throw new ThemeTokenValidationError(`JSON Pointer at ${location} references a group: ${reference}`);
      } else {
        result = resolveValue(target, expectedType, location);
      }
      resolvingPointers.pop();
      return result;
    };

    const resolveValue = (
      value: unknown,
      expectedType: ThemeTokenType | undefined,
      location: string,
      contextType: ThemeTokenType | undefined = expectedType,
    ): unknown => {
      if (typeof value === 'string') {
        const alias = parseCurlyReference(value);
        if (!alias) return value;
        const aliasPath = alias.join('.');
        const target = resolveToken(aliasPath);
        if (expectedType && target.type !== expectedType) {
          throw new ThemeTokenValidationError(
            `Reference at ${location} expects ${expectedType} but ${aliasPath} is ${target.type}.`,
          );
        }
        return cloneJson(target.value);
      }
      if (Array.isArray(value)) {
        return value.map((item, index) => {
          const childType = contextType === 'cubicBezier' ? 'number'
            : contextType === 'strokeStyle' ? 'dimension'
              : undefined;
          return resolveValue(item, childType, `${location}/${index}`, contextType);
        });
      }
      if (!isRecord(value)) return value;
      if (Object.keys(value).length === 1 && typeof value.$ref === 'string') {
        return resolvePointer(value.$ref, expectedType, location);
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        const childType = expectedChildType(contextType, key);
        return [key, resolveValue(child, childType, `${location}/${key}`, contextType)];
      }));
    };

    let value: unknown;
    if (typeof token.$ref === 'string') {
      value = resolvePointer(token.$ref, tokenType, path);
    } else {
      value = resolveValue(token.$value, tokenType, path);
    }
    assertResolvedValueMatchesType(tokenType, value, path);

    const result: ResolvedThemeToken = {
      path,
      type: tokenType,
      value,
      description: token.$description,
      deprecated: token.$deprecated ?? entry.inheritedDeprecated,
      extensions: token.$extensions,
    };
    resolvingTokens.pop();
    resolved.set(path, result);
    return result;
  };

  for (const path of collected.keys()) resolveToken(path);
  const resolvedDocument: ThemeTokens = {};
  for (const token of resolved.values()) {
    const segments = token.path.split('.');
    let parent = resolvedDocument as Record<string, unknown>;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        parent[segment] = {
          $type: token.type,
          $value: cloneJson(token.value),
          ...(token.description !== undefined ? { $description: token.description } : {}),
          ...(token.deprecated !== undefined ? { $deprecated: cloneJson(token.deprecated) } : {}),
          ...(token.extensions !== undefined ? { $extensions: cloneJson(token.extensions) } : {}),
        };
        return;
      }
      const existing = parent[segment];
      if (!isRecord(existing)) parent[segment] = {};
      parent = parent[segment] as Record<string, unknown>;
    });
  }
  return {
    document,
    materializedDocument,
    resolvedDocument,
    tokens: resolved,
  };
}

export function validateThemeTokensDocument(input: unknown): ThemeTokenValidationIssue[] {
  const structuralIssues = validateThemeTokensDocumentStructure(input);
  if (structuralIssues.length > 0) return structuralIssues;
  try {
    resolveThemeTokens(input);
    return [];
  } catch (error) {
    if (error instanceof ThemeTokenValidationError) {
      return error.issues.length > 0 ? [...error.issues] : [{ path: '/', message: error.message }];
    }
    return [{ path: '/', message: error instanceof Error ? error.message : String(error) }];
  }
}

export function mergeThemeTokenDocuments(inputs: readonly unknown[]): ThemeTokens {
  if (inputs.length === 0) {
    throw new ThemeTokenValidationError('At least one DTCG token source is required.');
  }
  let merged: ThemeTokenGroup = {};
  for (const input of inputs) {
    assertThemeTokensDocumentStructure(input);
    merged = mergeGroups(merged, input, [], true);
  }
  resolveThemeTokens(merged);
  return merged as ThemeTokens;
}
