import type { ResolveHook } from 'node:module';
import { createResolver } from './resolver.js';
import { pathToFileURL } from 'node:url';

/**
 * Singleton resolver instance with caching
 */
const resolver = createResolver();

/**
 * Determine if a specifier should be handled by this resolver
 */
function shouldResolve(specifier: string): boolean {
  // Skip built-in modules
  if (specifier.startsWith('node:')) {
    return false;
  }

  // Skip URLs
  if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
    return false;
  }

  // Skip data URLs
  if (specifier.startsWith('data:')) {
    return false;
  }

  return true;
}

/**
 * Resolve hook for Node.js loader API
 * 
 * This hook intercepts module resolution to support:
 * - TypeScript file extensions (.ts, .tsx)
 * - Extensionless imports
 * - tsconfig.json path aliases
 */
export const resolve: ResolveHook = async (
  specifier,
  context,
  nextResolve
) => {
  // Check if we should handle this specifier
  if (!shouldResolve(specifier)) {
    return nextResolve(specifier, context);
  }

  // Get parent path
  const parentURL = context.parentURL;
  if (!parentURL) {
    return nextResolve(specifier, context);
  }

  // Try our custom resolver
  try {
    const resolved = resolver.resolve(specifier, parentURL);
    
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
  } catch (error) {
    // Fall through to default resolver
  }

  // Fall back to default resolver
  return nextResolve(specifier, context);
};
