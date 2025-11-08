import type { ResolveHook } from 'node:module';
import { createResolver } from './resolver.js';
import { pathToFileURL } from 'node:url';

/**
 * Singleton resolver instance with caching
 */
const resolver = createResolver();

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
export const resolve: ResolveHook = async (
  specifier,
  context,
  nextResolve
) => {
  // Always try default Node.js resolution first
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Only attempt custom resolution if default resolution failed
    // with ERR_MODULE_NOT_FOUND
    if (!isModuleNotFoundError(error)) {
      throw error;
    }

    // Get parent URL for custom resolution
    const parentURL = context.parentURL;
    if (!parentURL) {
      throw error;
    }

    // Skip built-in modules and URLs - they should have been handled by Node.js
    if (
      specifier.startsWith('node:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://') ||
      specifier.startsWith('data:')
    ) {
      throw error;
    }

    // Try our custom resolver as a fallback
    try {
      const resolved = await resolver.resolve(specifier, parentURL);

      if (resolved) {
        // Convert to URL
        const url = pathToFileURL(resolved).href;
        
        // Determine format based on extension
        let format: string | undefined;
        if (resolved.endsWith('.json')) {
          format = 'json';
        } else if (resolved.endsWith('.wasm')) {
          format = 'wasm';
        }
        
        return {
          url,
          format,
          shortCircuit: true,
        };
      }
    } catch (resolverError) {
      // Custom resolver also failed, throw original error
      throw error;
    }

    // Custom resolver returned null, throw original error
    throw error;
  }
};

/**
 * Check if an error is a module not found error
 */
function isModuleNotFoundError(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ERR_MODULE_NOT_FOUND'
  );
}
