export type PureRenderModelValue = null | boolean | number | string | PureRenderModelArray | PureRenderModelObject;
export interface PureRenderModelArray extends ReadonlyArray<PureRenderModelValue> {}
export interface PureRenderModelObject {
  readonly [key: string]: PureRenderModelValue;
}

export type ViewRuntimeBindingKind = 'intent-adapter' | 'visual-slot' | 'opaque-adapter';

export interface ViewRuntimeBinding {
  readonly path: string;
  readonly kind: ViewRuntimeBindingKind;
  readonly value: unknown;
}

export interface CompiledViewProviderInput {
  readonly renderModel: PureRenderModelValue;
  readonly runtimeBindings: readonly ViewRuntimeBinding[];
}

const DEFAULT_FORBIDDEN_RENDER_MODEL_KEYS = Object.freeze([
  'tenant',
  'tenantId',
  'customer',
  'customerId',
  'route',
  'routeId',
  'pathname',
  'location',
  'raw',
  'rawRow',
  '__raw',
  '__rawRow',
]);

const escapePointer = (value: string): string => value.replace(/~/g, '~0').replace(/\//g, '~1');
const unescapePointer = (value: string): string => value.replace(/~1/g, '/').replace(/~0/g, '~');
const childPath = (path: string, key: string | number): string => `${path}/${escapePointer(String(key))}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const bindingKind = (value: unknown): ViewRuntimeBindingKind => {
  if (typeof value === 'function') return 'intent-adapter';
  if (value && typeof value === 'object' && '$$typeof' in value) return 'visual-slot';
  return 'opaque-adapter';
};

export interface CompileViewProviderInputOptions {
  forbiddenKeys?: readonly string[];
}

/**
 * Separates deterministic, serializable view data from runtime adapters.
 * React elements become visual slots and functions become intent adapters
 * without adding a React dependency to the SDK.
 */
export const compileViewProviderInput = (
  input: unknown,
  options: CompileViewProviderInputOptions = {},
): CompiledViewProviderInput => {
  const forbidden = new Set([...DEFAULT_FORBIDDEN_RENDER_MODEL_KEYS, ...(options.forbiddenKeys ?? [])]);
  const runtimeBindings: ViewRuntimeBinding[] = [];
  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, path: string): PureRenderModelValue => {
    if (value === null) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`Non-finite number is not allowed in renderModel at ${path || '/'}.`);
      return value;
    }
    if (value === undefined) return null;
    if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
      runtimeBindings.push(Object.freeze({ path, kind: bindingKind(value), value }));
      return null;
    }
    if (!value || typeof value !== 'object') {
      throw new Error(`Unsupported renderModel value at ${path || '/'}.`);
    }
    if (!Array.isArray(value) && !isPlainObject(value)) {
      runtimeBindings.push(Object.freeze({ path, kind: bindingKind(value), value }));
      return null;
    }
    if (!Array.isArray(value) && '$$typeof' in value) {
      runtimeBindings.push(Object.freeze({ path, kind: 'visual-slot', value }));
      return null;
    }
    if (ancestors.has(value)) throw new Error(`Cyclic renderModel input at ${path || '/'}.`);
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        return Object.freeze(value.map((item, index) => visit(item, childPath(path, index))));
      }
      const output: Record<string, PureRenderModelValue> = {};
      for (const [key, item] of Object.entries(value)) {
        if (forbidden.has(key)) {
          throw new Error(`Forbidden renderModel field ${key} at ${childPath(path, key)}.`);
        }
        output[key] = visit(item, childPath(path, key));
      }
      return Object.freeze(output);
    } finally {
      ancestors.delete(value);
    }
  };

  return Object.freeze({
    renderModel: visit(input, ''),
    runtimeBindings: Object.freeze(runtimeBindings),
  });
};

const cloneRenderModel = (value: PureRenderModelValue): unknown => {
  if (Array.isArray(value)) return value.map((item) => cloneRenderModel(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneRenderModel(item)]));
  }
  return value;
};

/** Provider adapters use this only at the final implementation edge. */
export const applyViewRuntimeBindings = (
  renderModel: PureRenderModelValue,
  bindings: readonly ViewRuntimeBinding[],
): unknown => {
  const root = { value: cloneRenderModel(renderModel) };
  for (const binding of bindings) {
    const segments = binding.path.split('/').slice(1).map(unescapePointer);
    if (segments.length === 0) {
      root.value = binding.value;
      continue;
    }
    let cursor: any = root.value;
    for (let index = 0; index < segments.length - 1; index += 1) {
      cursor = cursor?.[segments[index]];
      if (cursor === undefined || cursor === null) {
        throw new Error(`Runtime binding path does not exist: ${binding.path}`);
      }
    }
    cursor[segments[segments.length - 1]] = binding.value;
  }
  return root.value;
};
