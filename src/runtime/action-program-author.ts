import Ajv2020 from "ajv/dist/2020";
import type {
  ActionProgramDefinition,
  RevisionRef,
} from "../contracts/declarative-control";
import type { SchemaDefinition } from "../contracts/semantic";
import {
  canonicalContentHash,
  sameRevisionRef,
} from "./declarative-control-compiler";

export interface ProgramCapability {
  input: unknown;
  result: unknown;
}
export type ProgramCapabilityMap = Record<string, ProgramCapability>;
export interface ActionProgramContext<
  Q extends ProgramCapabilityMap,
  C extends ProgramCapabilityMap,
  F extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>,
  R extends string = string,
> {
  query<K extends keyof Q & string>(
    id: K,
    input: Q[K]["input"],
  ): Promise<Q[K]["result"]>;
  command<K extends keyof C & string>(
    id: K,
    input: C[K]["input"],
    options: { stepKey: string },
  ): Promise<C[K]["result"]>;
  ui: {
    form<K extends keyof F & string>(
      schemaId: K,
      value: F[K],
    ): Promise<{ status: "submitted"; value: F[K] } | { status: "cancelled" }>;
    toast(message: string, tone: "success" | "error" | "info"): Promise<void>;
    refresh(alias: R): Promise<void>;
    download(handle: string): Promise<{ status: "started" }>;
  };
  state: {
    get<K extends keyof S & string>(alias: K): Promise<S[K]>;
    set<K extends keyof S & string>(alias: K, value: S[K]): Promise<void>;
  };
}
export interface ProgramSchemaRegistration {
  definitionRevisionRef: RevisionRef;
  definition: SchemaDefinition;
}

/** Strict structural projection. Validation-only keywords remain enforced by runtime AJV. */
export function programSchemaType(
  schema: unknown,
  path = "$",
  depth = 0,
): string {
  if (
    depth > 32 ||
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema)
  )
    throw new Error(`Unsupported schema at ${path}`);
  const value = schema as Record<string, unknown>;
  const allowed = new Set([
    "$schema",
    "$id",
    "title",
    "description",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "enum",
    "const",
    "anyOf",
    "oneOf",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "default",
    "examples",
    "readOnly",
    "writeOnly",
  ]);
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`Unsupported schema keyword ${path}.${key}`);
  const child = (schema: unknown, key: string) =>
    programSchemaType(schema, `${path}.${key}`, depth + 1);
  const literal = (input: unknown) => {
    if (
      input !== null &&
      !["string", "number", "boolean"].includes(typeof input)
    )
      throw new Error(`Unsupported literal at ${path}`);
    return JSON.stringify(input);
  };
  if ("const" in value) return literal(value.const);
  if (Array.isArray(value.enum) && value.enum.length)
    return value.enum.map(literal).join(" | ");
  if (Array.isArray(value.anyOf) || Array.isArray(value.oneOf))
    return (
      ((value.anyOf ?? value.oneOf) as unknown[])
        .map((schema, i) => `(${child(schema, String(i))})`)
        .join(" | ") || "never"
    );
  if (Array.isArray(value.type))
    return value.type
      .map((type) => child({ ...value, type }, String(type)))
      .join(" | ");
  switch (value.type) {
    case "null":
      return "null";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "array":
      return `Array<${child(value.items, "items")}>`;
    case "object": {
      const properties = value.properties ?? {};
      if (
        typeof properties !== "object" ||
        !properties ||
        Array.isArray(properties)
      )
        throw new Error(`Invalid properties at ${path}`);
      const required = value.required ?? [];
      if (
        !Array.isArray(required) ||
        required.some(
          (key) =>
            typeof key !== "string" ||
            !Object.prototype.hasOwnProperty.call(properties, key),
        )
      )
        throw new Error(`Unsupported required keys at ${path}`);
      const fields = Object.entries(properties).map(
        ([key, schema]) =>
          `${JSON.stringify(key)}${required.includes(key) ? "" : "?"}: ${child(schema, key)};`,
      );
      if (value.additionalProperties !== false) {
        // A schema-valued index signature could conflict with named fields; reject it explicitly.
        if (
          value.additionalProperties !== undefined &&
          value.additionalProperties !== true
        )
          throw new Error(`Unsupported additionalProperties at ${path}`);
        fields.push("[key: string]: unknown;");
      }
      return `{ ${fields.join(" ")} }`;
    }
    default:
      throw new Error(`Schema needs a supported explicit type at ${path}`);
  }
}

export function generateActionProgramTypes(
  definition: ActionProgramDefinition,
  schemas: readonly ProgramSchemaRegistration[],
): string {
  const resolve = (ref: RevisionRef) => {
    const matches = schemas.filter((entry) =>
      sameRevisionRef(entry.definitionRevisionRef, ref),
    );
    if (
      matches.length !== 1 ||
      canonicalContentHash(matches[0]!.definition) !== ref.contentHash
    )
      throw new Error(`Missing exact Schema ${ref.id}`);
    return programSchemaType(matches[0]!.definition.document);
  };
  const formRefs = new Map(
    [
      definition.inputSchemaRevisionRef,
      definition.resultSchemaRevisionRef,
      ...definition.dependencies.flatMap((dep) => [
        dep.inputSchemaRevisionRef,
        dep.resultSchemaRevisionRef,
      ]),
    ].map((ref) => [ref.id, ref]),
  );
  for (const ref of [
    definition.inputSchemaRevisionRef,
    definition.resultSchemaRevisionRef,
    ...definition.dependencies.flatMap((dep) => [
      dep.inputSchemaRevisionRef,
      dep.resultSchemaRevisionRef,
    ]),
  ]) {
    if (!sameRevisionRef(formRefs.get(ref.id)!, ref))
      throw new Error("Ambiguous form Schema revision " + ref.id);
  }
  const forms =
    "{" +
    [...formRefs]
      .map(([id, ref]) => JSON.stringify(id) + ": " + resolve(ref) + ";")
      .join(" ") +
    "}";
  const states =
    "{" +
    definition.stateAliases
      .map(
        (entry) =>
          JSON.stringify(entry.alias) +
          ": " +
          resolve(entry.schemaRevisionRef) +
          ";",
      )
      .join(" ") +
    "}";
  const refresh =
    definition.refreshAliases
      .map((alias) => JSON.stringify(alias))
      .join(" | ") || "never";
  const capabilityMap = (kind: "query" | "command") =>
    `{\n${definition.dependencies
      .filter((dep) => dep.kind === kind)
      .map(
        (dep) =>
          `${JSON.stringify(dep.revisionRef.id)}: {input: ${"Pick<" + resolve(dep.inputSchemaRevisionRef) + ", " + (dep.dynamicInputKeys.map((key) => JSON.stringify(key)).join(" | ") || "never") + ">"}; result: ${resolve(dep.resultSchemaRevisionRef)}};`,
      )
      .join("\n")}\n}`;
  return `// Generated from exact program/schema revisions. Do not edit.\nimport type { ActionProgramContext } from "@inf-monkeys-tech/monkeys";\nexport type Input = ${resolve(definition.inputSchemaRevisionRef)};\nexport type Result = ${resolve(definition.resultSchemaRevisionRef)};\nexport type Queries = ${capabilityMap("query")};\nexport type Commands = ${capabilityMap("command")};\nexport type BaseContext = ActionProgramContext<Queries, Commands, ${forms}, ${states}, ${refresh}>;\nexport type Context = Omit<BaseContext, "ui" | "state"> & {ui: Pick<BaseContext["ui"], ${
    definition.effects
      .filter((effect) => !effect.startsWith("state."))
      .map((effect) => JSON.stringify(effect))
      .join(" | ") || "never"
  }>; state: Pick<BaseContext["state"], ${
    definition.effects
      .filter((effect) => effect.startsWith("state."))
      .map((effect) => JSON.stringify(effect.slice(6)))
      .join(" | ") || "never"
  }>};\nexport type Program = (context: Context, input: Input) => Promise<Result>;\n`;
}

/** Validates JSON values without imposing a component render-model object shape. */
export function compileProgramValueValidator(schema: Record<string, unknown>, documents: readonly Record<string, unknown>[] = []) {
  const ajv = new Ajv2020({ strict: false, allErrors: false, coerceTypes: false, removeAdditional: false, useDefaults: false });
  const ids = new Set<string>();
  for (const document of documents) if (typeof document.$id === "string" && document.$id !== schema.$id && !ids.has(document.$id)) { ajv.addSchema(document); ids.add(document.$id); }
  return ajv.compile(schema);
}
