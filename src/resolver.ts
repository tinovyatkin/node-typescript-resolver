import { ResolverFactory, type NapiResolveOptions, type ResolveResult } from 'oxc-resolver';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Cache for resolved modules
 */
class ResolverCache {
  private cache = new Map<string, string>();
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      // Simple LRU: remove first item
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 */
export class TypeScriptResolver {
  private oxcResolver: ResolverFactory;
  private cache: ResolverCache;

  constructor(options: { cacheSize?: number; tsconfigPath?: string } = {}) {
    this.cache = new ResolverCache(options.cacheSize);
    
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
    // Create cache key
    const cacheKey = `${specifier}:${parent}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Convert parent URL to path if needed
    const parentPath = parent.startsWith('file://')
      ? fileURLToPath(parent)
      : parent;

    const parentDir = dirname(parentPath);

    // Use oxc-resolver which handles tsconfig path aliases automatically
    try {
      const result = this.oxcResolver.sync(parentDir, specifier);
      
      if (result?.path) {
        this.cache.set(cacheKey, result.path);
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
    this.cache.clear();
  }
}

/**
 * Create a resolver instance
 */
export function createResolver(options?: { cacheSize?: number; tsconfigPath?: string }) {
  return new TypeScriptResolver(options);
}
