import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type NapiResolveOptions, ResolverFactory } from "oxc-resolver";

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 */
export class TypeScriptResolver {
  private readonly oxcResolver: ResolverFactory;

  constructor(options: { tsconfigPath?: string } = {}) {
    // Initialize oxc-resolver with TypeScript-friendly settings
    const resolverOptions: NapiResolveOptions = {
      conditionNames: ["import", "require", "node", "default"],
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

    // Use oxc-resolver's built-in tsconfig support

    this.oxcResolver = new ResolverFactory(resolverOptions);
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.oxcResolver.clearCache();
  }

  /**
   * Resolve a module specifier
   */
  async resolve(specifier: string, parent: string): Promise<null | string> {
    // Convert parent URL to path if needed
    const parentPath = parent.startsWith("file://") ? fileURLToPath(parent) : parent;

    const parentDir = dirname(parentPath);

    // Use oxc-resolver's async method for better performance and scalability
    try {
      const result = await this.oxcResolver.async(parentDir, specifier);

      if (result?.path) {
        return result.path;
      }
    } catch {
      // Resolution failed
    }

    return null;
  }
}

/**
 * Create a resolver instance
 */
export function createResolver(options?: { tsconfigPath?: string }) {
  return new TypeScriptResolver(options);
}
