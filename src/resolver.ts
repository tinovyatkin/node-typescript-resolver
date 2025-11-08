import { ResolverFactory, type NapiResolveOptions, type ResolveResult } from 'oxc-resolver';
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Interface for tsconfig.json structure
 */
interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

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
 * TypeScript path alias configuration
 */
interface PathAliasConfig {
  baseUrl: string;
  paths: Record<string, string[]>;
}

/**
 * Parse tsconfig.json and extract path aliases
 */
function parseTsConfig(tsconfigPath: string): PathAliasConfig | null {
  try {
    const content = readFileSync(tsconfigPath, 'utf-8');
    const tsconfig: TsConfig = JSON.parse(content);
    
    let config = tsconfig;
    
    // Handle extends
    if (config.extends) {
      const extendedPath = resolve(dirname(tsconfigPath), config.extends);
      const extendedConfig = parseTsConfig(extendedPath);
      if (extendedConfig) {
        // Merge configs (current overrides extended)
        config = {
          ...JSON.parse(readFileSync(extendedPath, 'utf-8')),
          ...config,
          compilerOptions: {
            ...JSON.parse(readFileSync(extendedPath, 'utf-8')).compilerOptions,
            ...config.compilerOptions,
          },
        };
      }
    }
    
    if (!config.compilerOptions?.paths) {
      return null;
    }
    
    const baseUrl = config.compilerOptions.baseUrl || '.';
    const basePath = resolve(dirname(tsconfigPath), baseUrl);
    
    return {
      baseUrl: basePath,
      paths: config.compilerOptions.paths,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Find tsconfig.json starting from a directory
 */
function findTsConfig(startDir: string): string | null {
  let currentDir = startDir;
  const root = '/';
  
  while (currentDir !== root) {
    const tsconfigPath = join(currentDir, 'tsconfig.json');
    try {
      readFileSync(tsconfigPath, 'utf-8');
      return tsconfigPath;
    } catch {
      currentDir = dirname(currentDir);
    }
  }
  
  return null;
}

/**
 * Main resolver class that wraps oxc-resolver with TypeScript support
 */
export class TypeScriptResolver {
  private oxcResolver: ResolverFactory;
  private cache: ResolverCache;
  private pathAliases: PathAliasConfig | null = null;
  private tsconfigPath: string | null = null;

  constructor(options: { cacheSize?: number; tsconfigPath?: string } = {}) {
    this.cache = new ResolverCache(options.cacheSize);
    
    // Initialize oxc-resolver with TypeScript-friendly settings
    this.oxcResolver = new ResolverFactory({
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main'],
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      },
    });

    // Load tsconfig if provided
    if (options.tsconfigPath) {
      this.tsconfigPath = options.tsconfigPath;
      this.pathAliases = parseTsConfig(options.tsconfigPath);
    }
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

    // Auto-detect tsconfig if not set
    if (!this.tsconfigPath) {
      this.tsconfigPath = findTsConfig(parentDir);
      if (this.tsconfigPath) {
        this.pathAliases = parseTsConfig(this.tsconfigPath);
      }
    }

    // Try to resolve with path aliases first
    if (this.pathAliases) {
      const aliasResolved = this.resolveWithPathAlias(specifier, parentDir);
      if (aliasResolved) {
        this.cache.set(cacheKey, aliasResolved);
        return aliasResolved;
      }
    }

    // Use oxc-resolver
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
   * Resolve using TypeScript path aliases
   */
  private resolveWithPathAlias(specifier: string, parentDir: string): string | null {
    if (!this.pathAliases) {
      return null;
    }

    const { baseUrl, paths } = this.pathAliases;

    // Try each path alias pattern
    for (const [pattern, replacements] of Object.entries(paths)) {
      const match = this.matchPathPattern(specifier, pattern);
      if (!match) continue;

      // Try each replacement
      for (const replacement of replacements) {
        const substituted = replacement.replace('*', match.captured);
        const fullPath = resolve(baseUrl, substituted);

        // Try to resolve this path with oxc-resolver
        try {
          const result = this.oxcResolver.sync(dirname(fullPath), `./${substituted.split('/').pop()}`);
          if (result?.path) {
            return result.path;
          }
        } catch {
          // Try next replacement
        }

        // Try direct file resolution
        try {
          const result = this.oxcResolver.sync(baseUrl, substituted);
          if (result?.path) {
            return result.path;
          }
        } catch {
          // Continue to next replacement
        }
      }
    }

    return null;
  }

  /**
   * Match a specifier against a path pattern (supports * wildcard)
   */
  private matchPathPattern(specifier: string, pattern: string): { captured: string } | null {
    const starIndex = pattern.indexOf('*');
    
    if (starIndex === -1) {
      // No wildcard, exact match
      return specifier === pattern ? { captured: '' } : null;
    }

    const prefix = pattern.slice(0, starIndex);
    const suffix = pattern.slice(starIndex + 1);

    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) {
      return null;
    }

    const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
    return { captured };
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
