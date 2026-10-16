const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const sdk = require("../lib");
const f = require("./declarative-control-fixtures.cjs");
const schema = {
  contract: "Schema",
  schemaVersion: 1,
  schemaId: "program.input",
  ownerRepo: "monkeys-server",
  dialect: "https://json-schema.org/draft/2020-12/schema",
  document: {
    type: "object",
    properties: { recordId: { type: "string" } },
    required: ["recordId"],
    additionalProperties: false,
  },
};
const ref = (kind, id, body) => ({
  kind,
  id,
  ownerRepo: "monkeys-server",
  visibility: "tenant",
  tenantScope: f.tenantScope,
  revision: 1,
  schemaVersion: 1,
  contentHash: sdk.canonicalContentHash(body),
});
const schemaRef = ref("schema", schema.schemaId, schema);
test('runtime calls reject untrusted overrides and download artifacts stay bounded', () => {
  const context = { activeReleaseRevisionRef: ref('page-release','slot',{}),pageRevisionRef:ref('page','page',{}),intent:{},pageState:{},idempotencyKey:'click' };
  const call = { context,kind:'command',dependencyId:'save',args:{},stepKey:'save' };
  assert.equal(sdk.RuntimeProgramCallRequestSchema.safeParse(call).success,true);
  for (const extra of [{endpoint:'https://invalid.test'},{definition:{}},{stepKey:''},{recoveryOnly:false}]) assert.equal(sdk.RuntimeProgramCallRequestSchema.safeParse({...call,...extra}).success,false);
  assert.equal(sdk.RuntimeProgramDownloadResultSchema.safeParse({kind:'text-artifact',fileName:'a.txt',mimeType:'text/html',content:'x'}).success,false);
});
test('program value validators support scalar state without coercion', () => {
  const { compileProgramValueValidator } = require('../lib/runtime');
  const validate = compileProgramValueValidator({type:'integer'});
  assert.equal(validate(3),true);
  assert.equal(validate('3'),false);
});
const definition = {
  contract: "ActionProgramDefinition",
  schemaVersion: 1,
  programId: "test.program",
  ownerRepo: "monkeys-server",
  tenantScope: f.tenantScope,
  supportedSurface: "studio",
  inputSchemaRevisionRef: schemaRef,
  resultSchemaRevisionRef: schemaRef,
  entry: "main",
  abi: sdk.ACTION_PROGRAM_ABI,
  compiler: "test/1",
  target: "quickjs-es2020",
  sourceHash: "a".repeat(64),
  compiledHash: "b".repeat(64),
  sourceMapHash: "c".repeat(64),
  dependencies: [],
  effects: [],
  refreshAliases: [],
  stateAliases: [],
  budgets: sdk.DEFAULT_ACTION_PROGRAM_BUDGETS,
};
const registration = {
  definitionRevisionRef: ref(
    "action-program",
    definition.programId,
    definition,
  ),
  definition,
};
const source = {
  contract: "Page",
  schemaVersion: 1,
  pageId: f.page.pageId,
  tenantScope: f.tenantScope,
  identity: f.page.identity,
  surface: "studio",
  route: "/Gallery/",
  body: {
    id: "gallery",
    component: f.capabilityRevisionRef.id,
    programActions: [
      {
        bindingId: "program.run",
        program: definition.programId,
        port: "run",
        inputMapping: { recordId: { kind: "intent-field", path: "recordId" } },
        dependencyInputs: {},
        accessPolicy: f.page.pageAccessPolicy,
        concurrencyKeyPath: ["recordId"],
        refreshAliases: {},
        stateAliases: {},
      },
    ],
  },
  access: f.page.pageAccessPolicy,
  managementAccess: f.managementAccess,
};
const options = {
  page: source,
  pageOwnerRepo: "monkeys-server",
  defaults: {
    routeSpace: f.routeSpaceRevisionRef,
    shell: f.shellRevisionRef,
    tokens: [f.tokenRevisionRef],
    performanceBudget: f.performanceBudgetRef,
    observationPolicy: f.observationPolicyRevisionRef,
  },
  capabilityRegistry: [
    {
      capabilityRevisionRef: f.capabilityRevisionRef,
      providerRevisionRef: f.providerRevisionRef,
      propertySchemaRevisionRef:
        f.page.capabilityInstances[0].propertySchemaRevisionRef,
      accessPolicy: f.page.pageAccessPolicy,
      editorEligible: true,
      inputPorts: [],
      outputPorts: [{ name: "run", schemaRevisionRef: schemaRef }],
      allowedSideEffects: ["worker"],
    },
  ],
  schemaRegistry: [{ definitionRevisionRef: schemaRef, definition: schema }],
  programRegistry: [registration],
};

test("source Page pins program, schemas and port; legacy shape stays unchanged", () => {
  const result = sdk.resolvePage(options);
  assert.deepEqual(
    result.programBindings[0].programRevisionRef,
    registration.definitionRevisionRef,
  );
  assert.equal(result.programBindings[0].source.port, "run");
  const legacy = structuredClone(options);
  delete legacy.page.body.programActions;
  assert.equal(
    Object.hasOwn(sdk.resolvePage(legacy), "programBindings"),
    false,
  );
});

test("runtime compilation preserves the program and rejects missing exact dependencies", () => {
  const page = sdk.resolvePage(options);
  const release = structuredClone(f.pageRelease);
  release.dependencySnapshot.push(
    { role: "action-program", revisionRef: registration.definitionRevisionRef },
    { role: "schema", revisionRef: schemaRef },
  );
  const input = {
    page, release, pageRevisionRef: f.pageRevisionRef,
    releaseRevisionRef: f.pageReleaseRevisionRef,
    routeSpaces: [{revisionRef: f.routeSpaceRevisionRef, routeSpace: f.routeSpace}],
    compilerRevisionRef: f.compilerRevisionRef, generation: 1,
    limits: {maxNavigationNodes:1024,maxNavigationDepth:16,maxRenderNodes:1024,maxRenderDepth:32,maxWorkbenchGroups:128,maxWorkbenchInstances:1024},
    capabilityRegistry: options.capabilityRegistry,
    programRegistry: [registration], shellRegistration: f.shellRegistration,
  };
  const bundle = sdk.compilePageRuntimeBundle(input);
  assert.deepEqual(bundle.programBindings[0].programRevisionRef, registration.definitionRevisionRef);
  assert.throws(() => sdk.compilePageRuntimeBundle({...input, programRegistry: []}), /registration/);
  const missing = structuredClone(release); missing.dependencySnapshot = missing.dependencySnapshot.filter(dep => dep.role !== 'action-program');
  assert.throws(() => sdk.compilePageRuntimeBundle({...input, release: missing}), /dependency/i);
  const duplicate = {...page, actionBindings: [{...f.page.actionBindings[0], source:page.programBindings[0].source}]};
  assert.equal(sdk.ResolvedPageSchema.safeParse(duplicate).success, false);
});
test("reject missing registry, modified manifest, unsupported ABI and raised budgets", () => {
  assert.throws(() => sdk.resolvePage({ ...options, programRegistry: [] }));
  const tampered = structuredClone(options);
  tampered.programRegistry[0].definition.compiler = "changed";
  assert.throws(() => sdk.resolvePage(tampered));
  assert.equal(
    sdk.ActionProgramDefinitionSchema.safeParse({
      ...definition,
      abi: "native-eval",
    }).success,
    false,
  );
  assert.equal(
    sdk.ActionProgramDefinitionSchema.safeParse({
      ...definition,
      budgets: { ...definition.budgets, calls: 129 },
    }).success,
    false,
  );
});
test("reject duplicate program event, unknown refresh alias and cross-tenant schema", () => {
  const duplicate = structuredClone(options);
  duplicate.page.body.programActions.push({
    ...duplicate.page.body.programActions[0],
    bindingId: "program.two",
  });
  assert.throws(() => sdk.resolvePage(duplicate), /exclusive/);
  const alias = structuredClone(options);
  alias.page.body.programActions[0].refreshAliases.extra = ["missing"];
  assert.throws(() => sdk.resolvePage(alias), /refresh aliases/);
  const cross = structuredClone(definition);
  cross.inputSchemaRevisionRef.tenantScope = structuredClone(cross.tenantScope);
  cross.inputSchemaRevisionRef.tenantScope.teamRef.id = "other-team";
  assert.equal(
    sdk.ActionProgramDefinitionSchema.safeParse(cross).success,
    false,
  );
});
test("program artifacts enforce UTF-8 bytes, not string length", () => {
  assert.equal(
    sdk.ActionProgramArtifactSchema.safeParse({
      definition,
      javascript: "汉".repeat(90000),
      sourceMap: "{}",
    }).success,
    false,
  );
});
test("type projection rejects unsupported schemas rather than emitting any", () => {
  for (const document of [
    { $ref: "#/secret" },
    { type: "object", patternProperties: {} },
    { type: "array" },
    { type: "object", required: ["absent"] },
    { type: "object", additionalProperties: { type: "number" } },
  ])
    assert.throws(() => sdk.programSchemaType(document));
  assert.equal(
    sdk.programSchemaType({ type: "array", items: { type: "string" } }),
    "Array<string>",
  );
});
test("generated TS and checkJs reject wrong IDs, argument types and result fields", () => {
  const typed = structuredClone(definition);
  typed.dependencies = [
    {
      kind: "command",
      revisionRef: ref("domain-command", "favorite.set", {}),
      inputSchemaRevisionRef: schemaRef,
      resultSchemaRevisionRef: schemaRef,
      dynamicInputKeys: ["recordId"],
    },
  ];
  const declarations = sdk
    .generateActionProgramTypes(typed, options.schemaRegistry)
    .replace(
      '"@inf-monkeys-tech/monkeys"',
      JSON.stringify(path.resolve(__dirname, "../lib").replaceAll("\\", "/")),
    );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "action-program-types-"));
  try {
    fs.writeFileSync(path.join(dir, "program.d.ts"), declarations);
    fs.writeFileSync(
      path.join(dir, "valid.ts"),
      `import type {Context} from './program'; async function main(c: Context) { const result = await c.command('favorite.set', {recordId:'one'}, {stepKey:'save:one'}); return result.recordId; }`,
    );
    const run = (file) =>
      spawnSync(
        process.execPath,
        [
          require.resolve("typescript/bin/tsc"),
          "--strict",
          "--skipLibCheck",
          "--noEmit",
          "--target",
          "es2020",
          "--moduleResolution",
          "node",
          "--allowJs",
          "--checkJs",
          path.join(dir, file),
        ],
        { encoding: "utf8" },
      );
    const valid = run("valid.ts");
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    fs.writeFileSync(
      path.join(dir, "invalid.js"),
      `/** @param {import('./program').Context} c */ async function main(c) { await c.command('missing', {}, {stepKey:'x'}); const r = await c.command('favorite.set', {recordId:123}, {stepKey:'x'}); return r.missing; }`,
    );
    const invalid = run("invalid.js");
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /missing/);
    assert.match(invalid.stdout, /number/);
  } finally {
    for (const file of ["program.d.ts", "valid.ts", "invalid.js"]) {
      const target = path.join(dir, file);
      if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    fs.rmdirSync(dir);
  }
});

test("author build emits a hashed static bundle and rejects unchecked or dynamic code", async () => {
  const { buildActionProgram } = require("../scripts/build-action-program.cjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "program-build-"));
  const output = path.join(dir, "output");
  const config = {
    entry: "main.ts",
    outputDirectory: "output",
    definition,
    schemas: options.schemaRegistry,
  };
  const configFile = path.join(dir, "config.json");
  try {
    fs.writeFileSync(configFile, JSON.stringify(config));
    fs.writeFileSync(
      path.join(dir, "main.ts"),
      `import type {Context, Input, Result} from './output/program-types'; export async function main(ctx:Context, input:Input):Promise<Result> {return {recordId:input.recordId};}`,
    );
    const built = await buildActionProgram(configFile);
    assert.equal(
      built.definition.compiledHash,
      sdk.canonicalContentHash(built.javascript),
    );
    assert.equal(
      built.definition.sourceMapHash,
      sdk.canonicalContentHash(built.sourceMap),
    );
    assert.match(built.javascript, /__actionProgram/);
    fs.writeFileSync(
      path.join(dir, "main.ts"),
      `import type {Context, Input} from './output/program-types'; export async function main(ctx:Context, input:Input) {return {recordId:1};}`,
    );
    await assert.rejects(buildActionProgram(configFile), /number/);
    fs.writeFileSync(
      path.join(dir, "main.ts"),
      `import type {Context, Input} from './output/program-types'; export async function main(ctx:Context, input:Input) {await import(input.recordId); return input;}`,
    );
    await assert.rejects(buildActionProgram(configFile), /Dynamic loading/);
  } finally {
    // Delete only the exact files created by this fixture, never a computed tree.
    for (const name of [
      "program-types.d.ts",
      "program-entry-check.ts",
      "program.js",
      "program.js.map",
      "program-artifact.json",
    ]) {
      const file = path.join(output, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    if (fs.existsSync(output)) fs.rmdirSync(output);
    for (const name of ["main.ts", "config.json"]) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(dir);
  }
});
