import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'runtime/sha256.node': 'src/runtime/sha256.node.ts',
    'runtime/sha256.browser': 'src/runtime/sha256.browser.ts',
    'contracts/index': 'src/contracts/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'runtime/index': 'src/runtime/index.ts',
    'codex-app-server/index': 'src/codex-app-server/index.ts',
  },
  format: ['esm'],
  outDir: 'lib/esm',
  outExtension: () => ({ js: '.mjs' }),
  clean: false,
  dts: false,
  noExternal: ['ajv'],
  external: ['#canonical-sha256'],
  sourcemap: true,
  // Share schemas, validators and runtime caches across public ESM entry points.
  splitting: true,
});
