import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'runtime/index': 'src/runtime/index.ts',
  },
  format: ['esm'],
  outDir: 'lib/esm',
  outExtension: () => ({ js: '.mjs' }),
  clean: false,
  dts: false,
  sourcemap: true,
  splitting: false,
});
