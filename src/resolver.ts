import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 * and manages multiple resolver instances with different conditions
 */
export class TypeScriptResolver {
  private readonly baseResolver: ResolverFactory;
  private readonly resolverCache = new Map<string, ResolverFactory>();

  constructor(options: { tsconfigPath?: string } = {}) {
    // Initialize base oxc-resolver with TypeScript-friendly settings
    // Set default conditions that will be cloned for specific use cases
    const resolverOptions: NapiResolveOptions = {
      conditionNames: ["node", "import"],
      extensionAlias: {
        ".cjs": [".cts", ".cjs"],
        ".js": [".ts", ".tsx", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main"],
      tsconfig: options.tsconfigPath
        ? {
            configFile: options.tsconfigPath,
            references: "auto",
          }
        : "auto",
    };

    // Create base resolver - we'll clone it with different conditions as needed
    this.baseResolver = new ResolverFactory(resolverOptions);
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.baseResolver.clearCache();
    // Cloned resolvers share the same cache, so clearing base clears all
  }

  /**
   * Resolve a module specifier with specific conditions
   */
  async resolve(
    specifier: string,
    parent: string,
    conditions: readonly string[] = ["node", "import"],
  ): Promise<null | string> {
    // Convert parent URL to path if needed
    const parentPath = parent.startsWith("file://") ? fileURLToPath(parent) : parent;

    const parentDir = dirname(parentPath);

    // Get resolver with appropriate conditions
    const resolver = this.getResolverForConditions(conditions);

    // Use oxc-resolver's async method for better performance and scalability
    try {
      const result = await resolver.async(parentDir, specifier);

      if (result?.path) {
        return result.path;
      }
    } catch {
      // Resolution failed
    }

    return null;
  }

  /**
   * Get a resolver for specific conditions, using cloneWithOptions to share cache
   */
  private getResolverForConditions(conditions: readonly string[]): ResolverFactory {
    // If conditions match base resolver, return it directly
    const cacheKey = conditions.join(",");
    if (cacheKey === "node,import") {
      return this.baseResolver;
    }

    let resolver = this.resolverCache.get(cacheKey);
    if (!resolver) {
      // Clone the base resolver with specific conditions
      // This shares the cache with the base resolver
      resolver = this.baseResolver.cloneWithOptions({
        conditionNames: [...conditions],
      });
      this.resolverCache.set(cacheKey, resolver);
    }

    return resolver;
  }
}

/**
 * Create a resolver instance
 */
export function createResolver(options?: { tsconfigPath?: string }) {
  return new TypeScriptResolver(options);
}
