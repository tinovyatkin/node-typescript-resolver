# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js loader that provides TypeScript-aware module resolution with minimal performance overhead. It bridges the gap between Node.js's
built-in TypeScript support and proper TS import resolution, supporting extensionless imports and tsconfig path aliases.

**Key dependencies:**

- `oxc-resolver`: Fast resolver that handles the heavy lifting of file resolution and tsconfig parsing
- Node.js >= 22.7.0 required (uses native module loader hooks)

## Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Run all tests (runs TypeScript tests directly)
npm test

# Run tests with dot reporter (recommended for faster feedback)
node --test --test-reporter=dot

# Test a single file with TypeScript support
node --test tests/resolver.test.ts

# Lint and auto-fix
npm run lint:fix
```

## Architecture

The codebase follows a **three-layer structure**:

### 1. Entry Point (`src/index.ts`)

- Registers the loader with Node.js via `register()` call
- Passes loader path and data (argv, execArgv) for initialization
- No public API exports - package is purely a Node.js loader

### 2. Loader Layer (`src/loader.ts`)

- Implements Node.js `ResolveHook` and `initialize` hooks
- **Critical design principle: Non-intrusive resolution**
  - Always calls `nextResolve()` first to let Node.js handle standard resolution
  - Only intercepts on `ERR_MODULE_NOT_FOUND`, `ERR_UNSUPPORTED_DIR_IMPORT`, and `ERR_INVALID_MODULE_SPECIFIER`
  - This ensures zero performance impact on normal imports
- Creates a singleton `TypeScriptResolver` instance via `initialize()` hook
- Converts resolved paths to `file://` URLs and determines module format
- Handles entry points with no parentURL by deriving parent from specifier directory

### 3. Core Resolver Layer (`src/resolver.ts`)

- `TypeScriptResolver` class wraps `oxc-resolver` with TS-specific configuration
- **Uses `resolveFileSync`/`resolveFileAsync` APIs** (added in oxc-resolver 11.14+):
  - Accepts file paths directly (no need to extract directory from parent URL)
  - Automatically discovers tsconfig.json by traversing parent directories
  - Perfect fit for Node.js loader API which provides parent file URLs
- **Extension alias mapping**: Maps `.js` → `.ts/.tsx`, `.mjs` → `.mts`, `.cjs` → `.cts`
  - This allows `import './file.js'` to resolve to `./file.ts`
- TSConfig support via oxc-resolver's built-in `tsconfig` option:
  - Auto-detects tsconfig.json from the parent file path on each resolution
  - Handles `baseUrl` and `paths` aliases automatically
  - Supports monorepos and TypeScript composite projects
  - No manual tsconfig parsing needed (oxc-resolver handles it)
- Creates separate resolver instances per condition set (not cloning - causes issues)

## Key Design Patterns

### Non-Intrusive Resolution (Loader Pattern)

The loader follows the battle-tested approach from `node-ts-resolver` and `extensionless`:

1. Always try default Node.js resolution first via `nextResolve()`
2. Only run custom logic when Node.js returns resolution errors:
   - `ERR_MODULE_NOT_FOUND` - module not found
   - `ERR_UNSUPPORTED_DIR_IMPORT` - directory import without index
   - `ERR_INVALID_MODULE_SPECIFIER` - invalid bare specifier (needed for path aliases)
3. Skip built-in modules (`node:`, `http:`, `https:`, `data:`)
4. Return `shortCircuit: true` on successful custom resolution

This pattern is critical - do not change it unless you understand the performance implications.

### Caching Strategy

- Per-conditions resolver instances cached by condition string (e.g., "node,import")
- Base resolver with `['node', 'import']` used for most cases
- New `ResolverFactory` instances created for non-standard conditions
- Don't use `cloneWithOptions()` - it causes resolution failures
- Each resolver instance has its own internal cache from oxc-resolver

### Entry Point Resolution

When `parentURL` is undefined (entry points):

- In loader: Derive parent from specifier's directory: `file://.../dir/entry` → parent: `file://.../dir/`
- In loader: Extract bare specifier from file:// URL: `file://.../dir/@app` → specifier: `@app`
- In resolver: Use synthetic file path (`cwd/index.ts`) for tsconfig discovery
- This enables path aliases to work in monorepos (uses correct subdirectory tsconfig.json)

### Extension Priority

oxc-resolver tries extensions in order: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.json`

- TypeScript files take precedence over JavaScript
- Combined with `extensionAlias` mapping, this enables proper TS resolution

## Testing Patterns

Tests use Node.js native test runner (`node:test`):

- Create temporary test directories in `tmpdir()`
- Set up fixtures with specific tsconfig.json configurations
- Use `before()` for setup and `after()` for cleanup
- Test both relative imports and path alias resolution
- Verify caching behavior and edge cases (file:// URLs, null returns)

Test organization:

- `tests/resolver.test.ts`: Unit tests for the resolver class
- `tests/loader.test.ts`: Unit tests for the loader hook
- `tests/integration.test.ts`: Integration tests that spawn real Node.js processes
- `tests/fixtures/`: Test fixtures for integration tests

**Running tests:**

- Use `node --test --test-reporter=dot` for fast feedback during development
- Tests run without needing to build first (Node.js loads .ts files directly)

## Important Constraints

- **Node.js version**: Must remain >= 22.7.0 due to loader API requirements
- **Module system**: ESM-only (`"type": "module"` in package.json)
- **Build output**: Must go to `dist/` with declaration files
- **File structure**: Keep the three-layer architecture (index → loader → resolver)
- **oxc-resolver version**: Stay current with oxc-resolver updates for bug fixes and performance

## Path Alias Resolution

When working with path alias features, remember that oxc-resolver handles all the complexity:

- No need to manually parse tsconfig.json
- Set `tsconfig: 'auto'` for auto-detection or provide explicit `configFile` path
- oxc-resolver follows TypeScript's exact resolution algorithm
- Path aliases work for both wildcard patterns (`@lib/*`) and exact matches (`@utils`)
