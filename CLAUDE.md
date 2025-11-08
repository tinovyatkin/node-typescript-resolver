# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js loader that provides TypeScript-aware module resolution with minimal performance overhead. It bridges the gap between Node.js's built-in TypeScript support and proper TS import resolution, supporting extensionless imports and tsconfig path aliases.

**Key dependencies:**
- `oxc-resolver`: Fast resolver that handles the heavy lifting of file resolution and tsconfig parsing
- Node.js >= 22.7.0 required (uses native module loader hooks)

## Development Commands

```bash
# Build TypeScript to dist/
npm run build

# Run all tests (builds first, then runs compiled tests)
npm test

# Run tests directly with TypeScript (requires Node 22.7.0+)
npm run test:ts

# Test a single file
node --test test/resolver.test.js
```

## Architecture

The codebase follows a **three-layer structure**:

### 1. Public API Layer (`src/index.ts`)
- Exports `createResolver()` factory and `TypeScriptResolver` class
- Re-exports oxc-resolver types for consumer convenience
- Simple entry point with minimal logic

### 2. Loader Layer (`src/loader.ts`)
- Implements Node.js `ResolveHook` interface for the module loader API
- **Critical design principle: Non-intrusive resolution**
  - Always calls `nextResolve()` first to let Node.js handle standard resolution
  - Only intercepts on `ERR_MODULE_NOT_FOUND` errors
  - This ensures zero performance impact on normal imports
- Creates a singleton `TypeScriptResolver` instance for the process
- Converts resolved paths to `file://` URLs and determines module format

### 3. Core Resolver Layer (`src/resolver.ts`)
- `TypeScriptResolver` class wraps `oxc-resolver` with TS-specific configuration
- `ResolverCache` implements simple LRU eviction (removes first entry when full)
- **Extension alias mapping**: Maps `.js` → `.ts/.tsx`, `.mjs` → `.mts`, `.cjs` → `.cts`
  - This allows `import './file.js'` to resolve to `./file.ts`
- TSConfig support via oxc-resolver's built-in `tsconfig` option:
  - Auto-detects tsconfig.json when no path provided
  - Handles `baseUrl` and `paths` aliases automatically
  - No manual tsconfig parsing needed (oxc-resolver handles it)

## Key Design Patterns

### Non-Intrusive Resolution (Loader Pattern)
The loader follows the battle-tested approach from `node-ts-resolver` and `extensionless`:
1. Always try default Node.js resolution first via `nextResolve()`
2. Only run custom logic when Node.js returns `ERR_MODULE_NOT_FOUND`
3. Skip built-in modules (`node:`, `http:`, `https:`, `data:`)
4. Return `shortCircuit: true` on successful custom resolution

This pattern is critical - do not change it unless you understand the performance implications.

### Caching Strategy
- Simple LRU: When cache is full, delete the first (oldest) entry
- Cache key format: `${specifier}:${parent}`
- Cache stores final resolved paths (strings)
- Cache size configurable via constructor, defaults to 10,000 entries
- Trade-off: Simple implementation over true LRU (no access-time tracking)

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
- `test/resolver.test.ts`: Unit tests for the resolver class
- `test/loader.test.js`: Integration tests for the Node.js loader hook

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
