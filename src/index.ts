/**
 * node-typescript-resolver
 *
 * A companion loader for Node.js's built-in TypeScript support that adds TypeScript-aware import resolution.
 *
 * Note: This package does NOT transform TypeScript code. It works alongside Node.js 22's built-in
 * TypeScript support (type stripping) or --experimental-transform-types flag to provide proper
 * module resolution for TypeScript imports.
 *
 * Features:
 * - TypeScript file resolution (.ts, .tsx, .mts, .cts)
 * - Extensionless imports
 * - Directory imports (import './dir' resolves to './dir/index.ts')
 * - tsconfig.json path aliases support
 * - Efficient caching
 * - Built on oxc-resolver for fast resolution
 *
 * @example Using as a Node.js loader with built-in TypeScript support
 * ```bash
 * node --import node-typescript-resolver your-app.ts
 * ```
 *
 * @example Using with --experimental-transform-types
 * ```bash
 * node --experimental-transform-types --import node-typescript-resolver your-app.ts
 * ```
 */

import { register, registerHooks } from "node:module";
import { argv, execArgv } from "node:process";

// Import the synchronous resolve hook for import.meta.resolve support
import { resolveSync } from "./loader.ts";

// Register synchronous hooks (for import.meta.resolve and require support)
// Note: We still need to initialize the resolver, which will happen via register() below
registerHooks({ resolve: resolveSync });

// Register asynchronous loader (for dynamic imports)
// The initialize hook will be called automatically by Node.js
// Use the same extension as the current file (works for both .ts and .js)
const loaderPath = import.meta.url.replace(/index\.(ts|js)$/, "loader.$1");
register(loaderPath, import.meta.url, { data: { argv, execArgv } });
