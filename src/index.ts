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
 * node --import node-typescript-resolver/loader your-app.js
 * ```
 */

export { TypeScriptResolver, createResolver } from './resolver.js';
export type { NapiResolveOptions, ResolveResult } from 'oxc-resolver';
