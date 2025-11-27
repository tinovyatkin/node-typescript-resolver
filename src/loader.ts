import type { LoadHook, ResolveHook, ResolveHookSync } from "node:module";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "oxc-parser";

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

/**
 * Cache for runtime exports of external packages
 * Maps package specifier to Set of exported names
 */
const runtimeExportsCache = new Map<string, null | Set<string>>();

/**
 * Filter type-only imports from source code
 * Removes named imports that don't exist in the target module's runtime exports
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- Complex but well-structured import filtering logic
async function filterTypeOnlyImports(source: string, url: string): Promise<string> {
  const result = await parse(url, source);

  if (result.errors.length > 0) {
    return source;
  }

  // Collect all modifications needed (in reverse order for safe string manipulation)
  const modifications: { end: number; replacement: string; start: number }[] = [];

  for (const node of result.program.body) {
    if (node.type !== "ImportDeclaration") continue;
    if (node.importKind === "type") continue;

    const specifier = node.source.value;
    if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) {
      continue;
    }

    const runtimeExports = await getRuntimeExports(specifier);
    if (!runtimeExports) continue;

    // Find named import specifiers that don't exist at runtime
    const specifiersToRemove: { end: number; name: string; start: number }[] = [];

    for (const spec of node.specifiers ?? []) {
      if (spec.type !== "ImportSpecifier") continue;
      if (spec.importKind === "type") continue;

      // Handle both Identifier and StringLiteral for imported name
      const imported = spec.imported;
      const importedName = "name" in imported ? imported.name : spec.local.name;
      if (!runtimeExports.has(importedName)) {
        specifiersToRemove.push({ end: spec.end, name: spec.local.name, start: spec.start });
      }
    }

    if (specifiersToRemove.length === 0) continue;

    const namedSpecifiers = (node.specifiers ?? []).filter((s) => s.type === "ImportSpecifier");
    const remainingCount = namedSpecifiers.length - specifiersToRemove.length;

    if (remainingCount === 0) {
      const hasOtherImports = (node.specifiers ?? []).some(
        (s) => s.type === "ImportDefaultSpecifier" || s.type === "ImportNamespaceSpecifier",
      );

      if (hasOtherImports) {
        // Remove just the named imports part: import foo, { Type } from 'x' -> import foo from 'x'
        const importText = source.slice(node.start, node.end);
        const braceStart = importText.indexOf("{");
        const braceEnd = importText.lastIndexOf("}");
        if (braceStart !== -1 && braceEnd !== -1) {
          let removeStart = node.start + braceStart;
          const removeEnd = node.start + braceEnd + 1;
          const beforeBraces = importText.slice(0, braceStart);
          const commaIndex = beforeBraces.lastIndexOf(",");
          if (commaIndex !== -1) {
            removeStart = node.start + commaIndex;
          }
          modifications.push({ end: removeEnd, replacement: "", start: removeStart });
        }
      } else {
        // No other imports, comment out the entire import
        modifications.push({
          end: node.end,
          replacement: `/* removed type-only: ${source.slice(node.start, node.end)} */`,
          start: node.start,
        });
      }
    } else {
      // Some named imports remain - remove only the type-only ones
      const sortedToRemove = specifiersToRemove.toSorted((a, b) => b.start - a.start);

      for (const spec of sortedToRemove) {
        let removeStart = spec.start;
        let removeEnd = spec.end;

        const afterSpec = source.slice(spec.end, node.end);
        const trailingMatch = /^(\s*,\s*)/.exec(afterSpec);
        if (trailingMatch) {
          removeEnd = spec.end + trailingMatch[1].length;
        } else {
          const beforeSpec = source.slice(node.start, spec.start);
          const leadingMatch = /,\s*$/.exec(beforeSpec);
          if (leadingMatch) {
            removeStart = spec.start - leadingMatch[0].length;
          }
        }

        modifications.push({ end: removeEnd, replacement: "", start: removeStart });
      }
    }
  }

  if (modifications.length === 0) {
    return source;
  }

  const sortedMods = modifications.toSorted((a, b) => b.start - a.start);
  let modified = source;
  for (const mod of sortedMods) {
    modified = modified.slice(0, mod.start) + mod.replacement + modified.slice(mod.end);
  }

  return modified;
}

/**
 * Pending imports map to deduplicate concurrent requests for the same specifier
 */
const pendingImports = new Map<string, Promise<null | Set<string>>>();

/**
 * Get runtime exports for an external package
 * Uses dynamic import and caches the result
 */
async function getRuntimeExports(specifier: string): Promise<null | Set<string>> {
  // Check cache first
  const cached = runtimeExportsCache.get(specifier);
  if (cached !== undefined) {
    return cached;
  }

  // Check for pending import to avoid duplicate concurrent imports
  const pending = pendingImports.get(specifier);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      // Dynamic import to get actual runtime exports
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Dynamic import returns unknown module
      const mod = await import(specifier);
      const exports = new Set(Object.keys(mod as object));
      runtimeExportsCache.set(specifier, exports);
      return exports;
    } catch {
      // Can't import module, return null to skip filtering
      runtimeExportsCache.set(specifier, null);
      return null;
    } finally {
      pendingImports.delete(specifier);
    }
  })();

  pendingImports.set(specifier, promise);
  return promise;
}

/**
 * Load hook for Node.js loader API
 *
 * This hook intercepts module loading to filter out type-only imports
 * that would cause runtime errors in ESM TypeScript files.
 *
 * Only processes 'module-typescript' format files since:
 * - CJS TypeScript files handle missing exports gracefully (returns undefined)
 * - ESM has strict static binding that throws on missing exports
 */
export const load: LoadHook = async (url, context, nextLoad) => {
  const result = await nextLoad(url, context);

  // Only process ESM TypeScript files
  // CJS TypeScript works fine with missing exports (returns undefined)
  if (result.format !== "module-typescript" || result.source == null) {
    return result;
  }

  const source = result.source.toString();

  // Filter out type-only imports that don't exist at runtime
  const filtered = await filterTypeOnlyImports(source, url);

  if (filtered !== source) {
    return {
      ...result,
      source: filtered,
    };
  }

  return result;
};
