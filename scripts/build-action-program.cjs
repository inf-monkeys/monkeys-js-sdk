#!/usr/bin/env node
"use strict";

// Repository authoring tool. Requires the SDK's pinned TypeScript/esbuild dev toolchain.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const esbuild = require("esbuild");
const {
  ActionProgramDefinitionSchema,
  ActionProgramArtifactSchema,
  generateActionProgramTypes,
  canonicalContentHash,
} = require("../lib");

async function buildActionProgram(configFile) {
  const configPath = path.resolve(configFile);
  const base = path.dirname(configPath);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const entry = path.resolve(base, config.entry);
  const output = path.resolve(base, config.outputDirectory);
  const definition = ActionProgramDefinitionSchema.parse(config.definition);
  if (!/\.(ts|js)$/.test(entry))
    throw new Error("Program entry must be .ts or checked .js");
  fs.mkdirSync(output, { recursive: true });
  const typesFile = path.join(output, "program-types.d.ts");
  fs.writeFileSync(
    typesFile,
    generateActionProgramTypes(definition, config.schemas),
  );
  const checkFile = path.join(output, "program-entry-check.ts");
  const relativeEntry = path
    .relative(output, entry)
    .replaceAll("\\", "/")
    .replace(/\.(ts|js)$/, "");
  fs.writeFileSync(
    checkFile,
    `import type {Program} from './program-types';\nimport {main} from ${JSON.stringify(relativeEntry.startsWith(".") ? relativeEntry : "./" + relativeEntry)};\nconst checked: Program = main;\n`,
  );
  const program = ts.createProgram([entry, checkFile], {
    baseUrl: base,
    paths: { "@inf-monkeys-tech/monkeys": [path.resolve(__dirname, "../lib")] },
    strict: true,
    noEmit: true,
    allowJs: true,
    checkJs: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => base,
        getNewLine: () => "\n",
      }),
    );
  const sources = new Map();
  const built = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    sourcemap: "external",
    sourcesContent: true,
    outfile: path.join(output, "program.js"),
    format: "iife",
    globalName: "__actionProgram",
    platform: "neutral",
    target: "es2020",
    metafile: true,
    plugins: [
      {
        name: "static-program-inputs",
        setup(build) {
          build.onLoad({ filter: /\.[cm]?[jt]s$/ }, (args) => {
            const source = fs.readFileSync(args.path, "utf8");
            const ast = ts.createSourceFile(
              args.path,
              source,
              ts.ScriptTarget.Latest,
              true,
            );
            const visit = (node) => {
              if (
                ts.isCallExpression(node) &&
                (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                  (ts.isIdentifier(node.expression) &&
                    node.expression.text === "require"))
              )
                throw new Error(
                  "Dynamic loading and require are not supported in action programs. Use static bundled imports.",
                );
              ts.forEachChild(node, visit);
            };
            visit(ast);
            sources.set(
              path.relative(base, args.path).replaceAll("\\", "/"),
              source,
            );
            return {
              contents: source,
              loader: args.path.endsWith(".ts") ? "ts" : "js",
            };
          });
        },
      },
    ],
  });
  if (Object.values(built.metafile.outputs).some((file) => file.imports.length))
    throw new Error("Program bundle contains an external import");
  const javascript = built.outputFiles.find((file) =>
    file.path.endsWith(".js"),
  ).text;
  const sourceMap = built.outputFiles.find((file) =>
    file.path.endsWith(".js.map"),
  ).text;
  const artifact = ActionProgramArtifactSchema.parse({
    definition: {
      ...definition,
      compiler: `typescript/${ts.version};esbuild/${esbuild.version}`,
      sourceHash: canonicalContentHash(
        Object.fromEntries(
          [...sources].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        ),
      ),
      compiledHash: canonicalContentHash(javascript),
      sourceMapHash: canonicalContentHash(sourceMap),
    },
    javascript,
    sourceMap,
  });
  fs.writeFileSync(path.join(output, "program.js"), javascript);
  fs.writeFileSync(path.join(output, "program.js.map"), sourceMap);
  fs.writeFileSync(
    path.join(output, "program-artifact.json"),
    JSON.stringify(artifact, null, 2) + "\n",
  );
  return artifact;
}
module.exports = { buildActionProgram };
if (require.main === module)
  buildActionProgram(process.argv[2])
    .then((artifact) =>
      console.log(
        JSON.stringify({
          programId: artifact.definition.programId,
          compiledHash: artifact.definition.compiledHash,
        }),
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
