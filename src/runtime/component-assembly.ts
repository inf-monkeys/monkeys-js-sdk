import Ajv from 'ajv';
import type { ComponentAssembly, ComponentAssemblyDescriptor } from '../contracts/component-assembly';
import { ComponentAssemblySchema } from '../contracts/component-assembly';

const validatorPools = new WeakMap<object, Ajv>();
const definitionId = 'https://monkeys.design/schemas/component-props/v1';

const schemaObject = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

/** Only declared text leaves are localizable; unrestricted objects do not declare text. */
const declaresTextPath = (schema: unknown, path: readonly (string | number)[], definitions: Record<string, unknown>, depth = 0): boolean => {
  if (depth > 48) return false;
  const node = schemaObject(schema);
  if (!node) return false;
  if (node.const !== undefined || node.enum !== undefined || node.pattern !== undefined || node.format !== undefined) return false;
  if (Array.isArray(node.allOf) && node.allOf.some(variant => {
    const constraint = schemaObject(variant);
    return constraint && ['const', 'enum', 'pattern', 'format'].some(key => constraint[key] !== undefined);
  })) return false;
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/$defs/')) {
    const name = node.$ref.slice('#/$defs/'.length).replace(/~1/g, '/').replace(/~0/g, '~');
    if (Object.prototype.hasOwnProperty.call(definitions, name) && declaresTextPath(definitions[name], path, definitions, depth + 1)) return true;
  }
  for (const kind of ['anyOf', 'oneOf', 'allOf']) {
    const variants = node[kind];
    if (Array.isArray(variants) && variants.some(variant => declaresTextPath(variant, path, definitions, depth + 1))) return true;
  }
  if (path.length === 0) {
    // Enums and discriminators describe structure, even when encoded as strings.
    return node.type === 'string' || (Array.isArray(node.type) && node.type.includes('string'));
  }
  const [part, ...rest] = path;
  if (typeof part === 'number') {
    const tuple = Array.isArray(node.prefixItems) ? node.prefixItems : Array.isArray(node.items) ? node.items : undefined;
    return declaresTextPath(tuple ? tuple[part] : node.items, rest, definitions, depth + 1);
  }
  const properties = schemaObject(node.properties);
  const child = properties && Object.prototype.hasOwnProperty.call(properties, part!) ? properties[part!] : node.additionalProperties;
  return declaresTextPath(child, rest, definitions, depth + 1);
};

const readOwnTextTarget = (props: unknown, path: readonly (string | number)[]): unknown => {
  let current = props;
  for (const part of path) {
    if (current === null || typeof current !== 'object' ||
      (Array.isArray(current) ? typeof part !== 'number' || part >= current.length : typeof part !== 'string') ||
      !Object.prototype.hasOwnProperty.call(current, part)) throw new TypeError('Localized component path does not exist.');
    current = (current as Record<string | number, unknown>)[part];
  }
  return current;
};

/** Compile once per descriptor; runtime values still come from the owning props. */
export function compileComponentAssemblyValidator(
  descriptor: ComponentAssemblyDescriptor,
  definitions: Record<string, unknown> = {},
): (value: unknown) => ComponentAssembly {
  let ajv = validatorPools.get(definitions);
  if (!ajv) {
    ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
    ajv.addSchema({ $id: definitionId, $defs: definitions });
    validatorPools.set(definitions, ajv);
  }
  const propertySchema = (schema: unknown): any => {
    if (Array.isArray(schema)) return schema.map(propertySchema);
    if (schema && typeof schema === 'object') return Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/') ? definitionId + value : propertySchema(value)]));
    return schema ?? {};
  };
  const scalarSlot = { anyOf: [{ type: ['string', 'number', 'boolean', 'null'] }, { type: 'array', items: { $ref: '#/$defs/renderable' } }] };
  const properties = Object.fromEntries(descriptor.props.filter((prop) => prop.kind === 'property' || prop.kind === 'slot' || prop.accepts?.includes('slot') || prop.accepts?.includes('property')).map((prop) => [prop.name, prop.schema === undefined ? scalarSlot : propertySchema(prop.schema)]));
  const variants = descriptor.variants?.map((variant) => ({ ...variant, validate: ajv.compile({ type: 'object', properties: Object.fromEntries(Object.entries(variant.properties).map(([name, schema]) => [name, propertySchema(schema)])) }) }));
  const validate = ajv.compile({ $defs: { renderable: scalarSlot }, type: 'object', properties, patternProperties: { '^(data-|aria-)[a-zA-Z0-9_-]+$': { type: ['string', 'number', 'boolean', 'null'] } }, additionalProperties: false });
  const byName = new Map(descriptor.props.map((prop) => [prop.name, prop]));
  return (value) => {
    // Preserve explicit slot-name arrays in declaration order; RenderTree owns each slot.
    const assembly = ComponentAssemblySchema.parse(value);
    if (Object.prototype.hasOwnProperty.call(assembly.props, 'dangerouslySetInnerHTML')) throw new TypeError('Executable HTML is not a component assembly prop.');
    if (!validate(assembly.props)) throw new TypeError(`Invalid ${descriptor.id} props: ${ajv.errorsText(validate.errors)}`);
    for (const [group, kind] of [['events', 'event'], ['slots', 'slot'], ['renderers', 'renderer']] as const) {
      for (const name of Object.keys(assembly[group])) {
        if (byName.get(name)?.kind !== kind && !byName.get(name)?.accepts?.includes(kind)) throw new TypeError(`Invalid ${descriptor.id} ${group} member: ${name}`);
      }
    }
    for (const name of Object.keys(assembly.hosts)) {
      if (!byName.has(name)) throw new TypeError(`Unknown ${descriptor.id} host member: ${name}`);
    }
    for (const name of Object.keys(assembly.messages)) {
      if (!byName.has(name) || !(['slot', 'property'].includes(byName.get(name)!.kind) || byName.get(name)?.accepts?.includes('slot'))) throw new TypeError(`Invalid ${descriptor.id} localized member: ${name}`);
    }
    for (const binding of assembly.messageBindings ?? []) {
      const root = binding.path[0];
      const prop = typeof root === 'string' ? byName.get(root) : undefined;
      if (!prop || !['property', 'slot'].includes(prop.kind) || !Object.prototype.hasOwnProperty.call(assembly.props, root!)) throw new TypeError(`Invalid ${descriptor.id} localized path root.`);
      if (['id', 'type', 'key', 'contract', 'schemaVersion'].includes(String(binding.path[binding.path.length - 1]))) throw new TypeError(`Invalid ${descriptor.id} structural localization target.`);
      const target = readOwnTextTarget(assembly.props, binding.path);
      if ((typeof target !== 'string' && target !== null) || !declaresTextPath(prop.schema ?? scalarSlot, binding.path.slice(1), definitions)) throw new TypeError(`Invalid ${descriptor.id} localized text path.`);
    }
    for (const prop of descriptor.props) {
      if (prop.required && !Object.values(assembly).some((group) => group && typeof group === 'object' && Object.prototype.hasOwnProperty.call(group, prop.name))) {
        throw new TypeError(`Missing ${descriptor.id} prop: ${prop.name}`);
      }
    }
    if (variants) {
      const supplied = new Set(['props', 'events', 'slots', 'renderers', 'hosts', 'messages'].flatMap((group) => Object.keys(assembly[group as 'props'])));
      if (!variants.some((variant) => variant.required.every((name) => supplied.has(name)) && [...supplied].every((name) => variant.allowed.includes(name) || /^(data-|aria-)/.test(name)) && variant.validate(assembly.props))) throw new TypeError(`Invalid ${descriptor.id} prop combination.`);
    }
    return assembly;
  };
}
