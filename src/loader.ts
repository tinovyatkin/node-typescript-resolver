import type { ResolveHook, ResolveHookSync } from "node:module";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
    // May be undefined for entry points - resolver will handle the fallback
    const parentURL = context.parentURL;

    // Skip built-in modules and remote URLs - they should have been handled by Node.js
    if (
      specifier.startsWith("node:") ||
      specifier.startsWith("http://") ||
      specifier.startsWith("https://") ||
      specifier.startsWith("data:")
    ) {
      throw error;
    }

    // Normalize file:// URLs to extract bare specifiers and derive parent
    const { parent: resolveParent, specifier: resolveSpecifier } = normalizeFileUrl(
      specifier,
      parentURL,
    );

    // Try our custom resolver as a fallback
    try {
      if (!resolver) {
        throw error;
      }

      // oxc-resolver handles file:// URLs for paths, but needs bare specifiers for aliases
      const resolved = await resolver.resolve(resolveSpecifier, resolveParent, context.conditions);

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
 * Synchronous resolve hook for Node.js loader API
 *
 * This hook provides synchronous module resolution to support:
 * - TypeScript file extensions (.ts, .tsx)
 * - Extensionless imports
 * - tsconfig.json path aliases
 *
 * Following the same approach as the async version:
 * - First tries default Node.js resolution
 * - Only kicks in when Node.js fails to resolve
 */
export const resolveSync: ResolveHookSync = (specifier, context, nextResolve) => {
  // Always try default Node.js resolution first
  try {
    return nextResolve(specifier, context);
  } catch (error) {
    // Only attempt custom resolution if default resolution failed
    // with ERR_MODULE_NOT_FOUND or ERR_UNSUPPORTED_DIR_IMPORT
    if (!isResolutionError(error)) {
      throw error;
    }

    // Get parent URL for custom resolution
    // May be undefined for entry points - resolver will handle the fallback
    const parentURL = context.parentURL;

    // Skip built-in modules and remote URLs - they should have been handled by Node.js
    if (
      specifier.startsWith("node:") ||
      specifier.startsWith("http://") ||
      specifier.startsWith("https://") ||
      specifier.startsWith("data:")
    ) {
      throw error;
    }

    // Normalize file:// URLs to extract bare specifiers and derive parent
    const { parent: resolveParent, specifier: resolveSpecifier } = normalizeFileUrl(
      specifier,
      parentURL,
    );

    // Try our custom resolver as a fallback
    try {
      if (!resolver) {
        throw error;
      }

      // oxc-resolver handles file:// URLs for paths, but needs bare specifiers for aliases
      const resolved: null | string = resolver.resolveSync(
        resolveSpecifier,
        resolveParent,
        context.conditions,
      );

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
 * Handles ERR_MODULE_NOT_FOUND, ERR_UNSUPPORTED_DIR_IMPORT, and ERR_INVALID_MODULE_SPECIFIER
 */
function isResolutionError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ERR_MODULE_NOT_FOUND" ||
      error.code === "ERR_UNSUPPORTED_DIR_IMPORT" ||
      error.code === "ERR_INVALID_MODULE_SPECIFIER")
  );
}

/**
 * Extract bare specifier and parent from file:// URL when needed
 * For entry points, Node.js converts bare specifiers to file:// URLs
 */
function normalizeFileUrl(
  specifier: string,
  parentURL: string | undefined,
): { parent: string | undefined; specifier: string } {
  if (!specifier.startsWith("file://")) {
    return { parent: parentURL, specifier };
  }

  // If we have a parent and specifier is under it, extract relative path
  if (parentURL?.startsWith("file://") && specifier.startsWith(parentURL)) {
    return {
      parent: parentURL,
      specifier: specifier.slice(parentURL.length),
    };
  }

  // No parent - extract filename and derive parent from specifier's directory
  if (!parentURL) {
    const filePath = fileURLToPath(specifier);
    const filename = basename(filePath);
    if (filename) {
      const parentHref = pathToFileURL(dirname(filePath)).href;
      return {
        parent: parentHref.endsWith("/") ? parentHref : `${parentHref}/`,
        specifier: filename,
      };
    }
  }

  return { parent: parentURL, specifier };
}
