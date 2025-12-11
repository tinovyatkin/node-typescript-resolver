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

      // For ERR_PACKAGE_PATH_NOT_EXPORTED, try to resolve with 'types' condition
      // This handles type-only packages like type-fest that only export types
      if (error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
        try {
          return await tryResolveTypeOnlyPackage(specifier, context, nextResolve);
        } catch {
          // Types resolution also failed, continue with standard resolution
        }
      }

      // Use standard resolution for other errors
      // oxc-resolver handles file:// URLs for paths, but needs bare specifiers for aliases
      const resolved = await resolver.resolve(resolveSpecifier, resolveParent, context.conditions);

      if (resolved) {
        return formatResolvedResult(resolved);
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

      // For ERR_PACKAGE_PATH_NOT_EXPORTED, try to resolve with 'types' condition
      // This handles type-only packages like type-fest that only export types
      if (error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
        try {
          return tryResolveTypeOnlyPackageSync(specifier, context, nextResolve);
        } catch {
          // Types resolution also failed, continue with standard resolution
        }
      }

      // Use standard resolution for other errors
      // oxc-resolver handles file:// URLs for paths, but needs bare specifiers for aliases
      const resolved: null | string = resolver.resolveSync(
        resolveSpecifier,
        resolveParent,
        context.conditions,
      );

      if (resolved) {
        return formatResolvedResult(resolved);
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
 * Format resolved file path as a ResolveHook result
 */
function formatResolvedResult(resolved: string): Awaited<ReturnType<ResolveHook>> {
  const url = pathToFileURL(resolved).href;
  let format: string | undefined;
  let importAttributes: Record<string, string> | undefined;

  if (resolved.endsWith(".json")) {
    format = "json";
    importAttributes = { type: "json" };
  } else if (resolved.endsWith(".wasm")) {
    format = "wasm";
    importAttributes = { type: "wasm" };
  } else if (resolved.endsWith(".mts")) {
    format = "module-typescript";
  } else if (resolved.endsWith(".cts")) {
    format = "commonjs-typescript";
  }
  // Note: .d.ts files don't get a format - they're type declarations only

  return {
    format,
    importAttributes,
    shortCircuit: true,
    url,
  };
}

/**
 * Check if an error is a resolution error that we should handle
 * Handles ERR_MODULE_NOT_FOUND, ERR_UNSUPPORTED_DIR_IMPORT, ERR_INVALID_MODULE_SPECIFIER,
 * ERR_PACKAGE_PATH_NOT_EXPORTED (for type-only packages), and MODULE_NOT_FOUND (CommonJS)
 */
function isResolutionError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ERR_MODULE_NOT_FOUND" ||
      error.code === "ERR_UNSUPPORTED_DIR_IMPORT" ||
      error.code === "ERR_INVALID_MODULE_SPECIFIER" ||
      error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" || // Type-only packages
      error.code === "MODULE_NOT_FOUND") // CommonJS require() error
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

/**
 * Try to resolve type-only packages that only export TypeScript types
 * Returns result if successful, throws if resolution fails
 */
async function tryResolveTypeOnlyPackage(
  specifier: string,
  context: Parameters<ResolveHook>[1],
  nextResolve: Parameters<ResolveHook>[2],
): Promise<Awaited<ReturnType<ResolveHook>>> {
  const typesResult = await nextResolve(specifier, {
    ...context,
    conditions: [...(context.conditions ?? []), "types"],
  });

  // If resolved to .d.ts in node_modules, return empty data URL
  // Node.js can't strip types from files in node_modules, but type-only imports
  // don't need runtime code anyway
  if (typesResult.url.endsWith(".d.ts") && typesResult.url.includes("/node_modules/")) {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,",
    };
  }

  return {
    format: undefined,
    importAttributes: typesResult.importAttributes,
    shortCircuit: true,
    url: typesResult.url,
  };
}

/**
 * Synchronous version of tryResolveTypeOnlyPackage
 * Try to resolve type-only packages that only export TypeScript types
 * Returns result if successful, throws if resolution fails
 *
 * Note: Unlike the async version, sync nextResolve doesn't properly handle
 * type-only packages even with the 'types' condition. So we use oxc-resolver
 * directly with the 'types' condition added.
 */
function tryResolveTypeOnlyPackageSync(
  specifier: string,
  context: Parameters<ResolveHookSync>[1],
  _nextResolve: Parameters<ResolveHookSync>[2],
): ReturnType<ResolveHookSync> {
  if (!resolver) {
    throw new Error("Resolver not initialized");
  }

  // Use oxc-resolver with 'types' condition to resolve type-only packages
  // Node.js's sync nextResolve doesn't handle these properly
  const conditionsWithTypes = [...(context.conditions ?? []), "types"];

  // Normalize parent URL and specifier for resolution
  const { parent: resolveParent, specifier: resolveSpecifier } = normalizeFileUrl(
    specifier,
    context.parentURL,
  );

  const resolved = resolver.resolveSync(resolveSpecifier, resolveParent, conditionsWithTypes);

  if (!resolved) {
    throw new Error(`Failed to resolve type-only package: ${specifier}`);
  }

  // Convert to URL for cross-platform path checking
  const resolvedUrl = pathToFileURL(resolved).href;

  // If resolved to .d.ts in node_modules, return empty data URL
  // Node.js can't strip types from files in node_modules, but type-only imports
  // don't need runtime code anyway
  if (resolvedUrl.endsWith(".d.ts") && resolvedUrl.includes("/node_modules/")) {
    return {
      format: "module",
      shortCircuit: true,
      url: "data:text/javascript,",
    };
  }

  // Return the resolved result
  return formatResolvedResult(resolved);
}
