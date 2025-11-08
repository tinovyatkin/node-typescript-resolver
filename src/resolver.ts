import { ResolverFactory, type NapiResolveOptions } from 'oxc-resolver';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 */
export class TypeScriptResolver {
  private oxcResolver: ResolverFactory;

  constructor(options: { tsconfigPath?: string } = {}) {
    
    // Initialize oxc-resolver with TypeScript-friendly settings
    const resolverOptions: NapiResolveOptions = {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main'],
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      },
    };

    // Use oxc-resolver's built-in tsconfig support
    if (options.tsconfigPath) {
      resolverOptions.tsconfig = {
        configFile: options.tsconfigPath,
        references: 'auto',
      };
    } else {
      // Auto-detect tsconfig.json
      resolverOptions.tsconfig = 'auto';
    }

    this.oxcResolver = new ResolverFactory(resolverOptions);
  }

  /**
   * Resolve a module specifier
   */
  resolve(specifier: string, parent: string): string | null {
    // Convert parent URL to path if needed
    const parentPath = parent.startsWith('file://')
      ? fileURLToPath(parent)
      : parent;

    const parentDir = dirname(parentPath);

    // Use oxc-resolver which handles tsconfig path aliases and caching automatically
    try {
      const result = this.oxcResolver.sync(parentDir, specifier);

      if (result?.path) {
        return result.path;
      }
    } catch (error) {
      // Resolution failed
    }

    return null;
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.oxcResolver.clearCache();
  }
}

/**
 * Create a resolver instance
 */
export function createResolver(options?: { tsconfigPath?: string }) {
  return new TypeScriptResolver(options);
}
