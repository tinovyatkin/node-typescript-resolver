import type { ResolveHook } from "node:module";
import { pathToFileURL } from "node:url";

import { createResolver } from "./resolver.ts";

/**
 * Singleton resolver instance with caching
 */
let resolver: null | ReturnType<typeof createResolver> = null;

/**
 * Initialize hook - called once when the loader is registered
 */
export function initialize(_data?: { argv?: string[]; execArgv?: string[] }) {
  resolver ??= createResolver();
}

/**
 * Resolve hook for Node.js loader API
 *
 * This hook intercepts module resolution to support:
 * - TypeScript file extensions (.ts, .tsx)
 * - Extensionless imports
 * - tsconfig.json path aliases
 *
 * Following the approach from node-ts-resolver and extensionless:
 * - First tries default Node.js resolution
 * - Only kicks in when Node.js fails to resolve
 */
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  // Always try default Node.js resolution first
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Only attempt custom resolution if default resolution failed
    // with ERR_MODULE_NOT_FOUND or ERR_UNSUPPORTED_DIR_IMPORT
    if (!isResolutionError(error)) {
      throw error;
    }

    // Get parent URL for custom resolution
    const parentURL = context.parentURL;
    if (!parentURL) {
      throw error;
    }

    // Skip built-in modules and URLs - they should have been handled by Node.js
    if (
      specifier.startsWith("node:") ||
      specifier.startsWith("http://") ||
      specifier.startsWith("https://") ||
      specifier.startsWith("data:")
    ) {
      throw error;
    }

    // Try our custom resolver as a fallback
    try {
      if (!resolver) {
        throw error;
      }

      // Pass context.conditions to the resolver so it uses the correct conditions
      const resolved = await resolver.resolve(specifier, parentURL, context.conditions);

      if (resolved) {
        // Convert to URL
        const url = pathToFileURL(resolved).href;

        // Determine format and import attributes based on extension
        let format: string | undefined;
        let importAttributes: Record<string, string> | undefined;

        if (resolved.endsWith(".json")) {
          format = "json";
          importAttributes = { type: "json" };
        } else if (resolved.endsWith(".wasm")) {
          format = "wasm";
          importAttributes = { type: "wasm" };
        }

        return {
          format,
          importAttributes,
          shortCircuit: true,
          url,
        };
      }
    } catch {
      // Custom resolver also failed, throw original error
      throw error;
    }

    // Custom resolver returned null, throw original error
    throw error;
  }
};

/**
 * Check if an error is a resolution error that we should handle
 * Handles both ERR_MODULE_NOT_FOUND and ERR_UNSUPPORTED_DIR_IMPORT
 */
function isResolutionError(error: unknown): error is NodeJS.ErrnoException {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  const errnoError = error as NodeJS.ErrnoException;
  const code = errnoError.code;

  return code === "ERR_MODULE_NOT_FOUND" || code === "ERR_UNSUPPORTED_DIR_IMPORT";
}
