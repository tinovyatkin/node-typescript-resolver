/**
 * node-typescript-resolver
 *
 * Node.js loader to close the gap between built-in TypeScript support and TS imports resolution.
 *
 * Features:
 * - TypeScript file resolution (.ts, .tsx, .mts, .cts)
 * - Extensionless imports
 * - tsconfig.json path aliases support
 * - Efficient caching
 * - Built on oxc-resolver for fast resolution
 *
 * @example
 * ```typescript
 * import { createResolver } from 'node-typescript-resolver';
 *
 * const resolver = createResolver();
 * const resolved = resolver.resolve('./module', import.meta.url);
 * console.log(resolved); // /path/to/module.ts
 * ```
 *
 * @example Using as a Node.js loader
 * ```bash
 * node --import node-typescript-resolver your-app.js
 * ```
 */

import { register } from 'node:module';

// Register the loader with Node.js
register('./loader.js', import.meta.url);

// Also export the resolver for programmatic use
export { TypeScriptResolver, createResolver } from './resolver.js';
export type { NapiResolveOptions, ResolveResult } from 'oxc-resolver';
