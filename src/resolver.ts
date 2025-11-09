import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 */
export class TypeScriptResolver {
  private readonly baseOptions: NapiResolveOptions;
  private readonly baseResolver: ResolverFactory;
  private readonly resolverCache = new Map<string, ResolverFactory>();

  constructor(options: { tsconfigPath?: string } = {}) {
    // Initialize base oxc-resolver with TypeScript-friendly settings
    this.baseOptions = {
      conditionNames: ["node", "import"],
      extensionAlias: {
        ".cjs": [".cts", ".cjs"],
        ".js": [".ts", ".tsx", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main"],
      // Use tsconfig auto-detection for path aliases support
      tsconfig: options.tsconfigPath
        ? {
            configFile: options.tsconfigPath,
            references: "auto",
          }
        : "auto",
    };

    // Create base resolver
    this.baseResolver = new ResolverFactory(this.baseOptions);
  }

  /**
   * Clear the resolution cache for all resolver instances
   */
  clearCache(): void {
    this.baseResolver.clearCache();
    // Clear all cached resolver instances
    for (const resolver of this.resolverCache.values()) {
      resolver.clearCache();
    }
  }

  /**
   * Resolve a module specifier with specific conditions
   */
  async resolve(
    specifier: string,
    parent: string | undefined,
    conditions: readonly string[] = ["node", "import"],
  ): Promise<null | string> {
    // Convert parent URL to path if needed, fallback to cwd if undefined
    let parentPath: string;
    if (parent === undefined) {
      parentPath = process.cwd();
    } else {
      parentPath = parent.startsWith("file://") ? fileURLToPath(parent) : parent;
    }

    let parentDir: string;
    if (parent === undefined) {
      // Entry point - use cwd directly
      parentDir = parentPath;
    } else if (parentPath.endsWith(sep) || parentPath.endsWith("/")) {
      // Already a directory - use as-is
      parentDir = parentPath;
    } else {
      // File path - get containing directory
      parentDir = dirname(parentPath);
    }

    // Get resolver with appropriate conditions
    const resolver = this.getResolverForConditions(conditions);

    // Use oxc-resolver's async method for better performance
    try {
      const result = await resolver.async(parentDir, specifier);

      // oxc-resolver returns { path: string } on success or { error: string } on failure
      if (result != null && "path" in result && result.path) {
        return result.path;
      }
    } catch {
      // Resolution failed
    }

    return null;
  }

  /**
   * Get a resolver for specific conditions
   * Creates new resolver instances instead of cloning to avoid oxc-resolver issues
   */
  private getResolverForConditions(conditions: readonly string[]): ResolverFactory {
    // If conditions match base resolver, return it directly
    const cacheKey = conditions.join(",");
    if (cacheKey === "node,import") {
      return this.baseResolver;
    }

    let resolver = this.resolverCache.get(cacheKey);
    if (!resolver) {
      // Create a new resolver with updated conditions
      // Don't use cloneWithOptions() as it seems to cause issues
      const optionsWithConditions: NapiResolveOptions = {
        ...this.baseOptions,
        conditionNames: [...conditions],
      };
      resolver = new ResolverFactory(optionsWithConditions);
      this.resolverCache.set(cacheKey, resolver);
    }

    return resolver;
  }
}

/**
 * Factory function to create a TypeScript resolver instance
 */
export function createResolver(options: { tsconfigPath?: string } = {}): TypeScriptResolver {
  return new TypeScriptResolver(options);
}
