import { defineConfig } from 'tsdown'

// Two binaries, one bundle each. `mcp.ts` joins the entry list in the phase that
// writes it — an entry naming a file that does not exist fails the build.
export default defineConfig({
  entry: ['src/cli.ts'],
  format: 'esm',
  target: 'node20',
  // The package is `"type": "module"`, so a plain `.js` is already ESM. Emitting `.mjs`
  // would mean the bin path in package.json needs a second name for no benefit.
  outExtensions: () => ({ js: '.js' }),
  dts: false,
  clean: true,
})
