/**
 * node-typescript-resolver (CommonJS entry point)
 *
 * Entry point for --require flag that uses synchronous hooks.
 * For --import flag, use the main entry point instead for better async performance.
 *
 * @example Using with --require
 * ```bash
 * node --require node-typescript-resolver your-app.cjs
 * ```
 *
 * @example Using with --experimental-transform-types
 * ```bash
 * node --experimental-transform-types --require node-typescript-resolver your-app.ts
 * ```
 */

import { registerHooks } from "node:module";
import { argv, execArgv } from "node:process";

// Import hooks and initialize function
import { initialize, resolveSync } from "./loader.ts";

// Initialize the resolver before registering hooks
initialize({ argv, execArgv });

// Register synchronous hooks for require() and import support
registerHooks({ resolve: resolveSync });
