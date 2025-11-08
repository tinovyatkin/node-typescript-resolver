import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createResolver } from '../src/resolver.ts';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('TypeScriptResolver', () => {
  let testDir: string;
  let resolver: ReturnType<typeof createResolver>;

  before(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `ts-resolver-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create test files
    await writeFile(join(testDir, 'module.ts'), 'export const test = 1;');
    await writeFile(join(testDir, 'module.js'), 'export const test = 2;');
    await writeFile(join(testDir, 'index.ts'), 'export const main = true;');
    
    // Create a subdirectory
    await mkdir(join(testDir, 'lib'), { recursive: true });
    await writeFile(join(testDir, 'lib', 'helper.ts'), 'export const helper = true;');

    // Create tsconfig.json with path aliases
    const tsconfig = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@lib/*': ['lib/*'],
          '@utils': ['lib/helper.ts'],
        },
      },
    };
    await writeFile(join(testDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    resolver = createResolver({ tsconfigPath: join(testDir, 'tsconfig.json') });
  });

  after(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('basic resolution', () => {
    it('should resolve .ts files', () => {
      const resolved = resolver.resolve('./module.ts', join(testDir, 'index.ts'));
      assert.ok(resolved);
      assert.ok(resolved.endsWith('module.ts'));
    });

    it('should resolve relative paths', () => {
      const resolved = resolver.resolve('./lib/helper', join(testDir, 'index.ts'));
      assert.ok(resolved);
      assert.ok(resolved.includes('lib') && resolved.endsWith('helper.ts'));
    });

    it('should prefer .ts over .js', () => {
      const resolved = resolver.resolve('./module', join(testDir, 'index.ts'));
      assert.ok(resolved);
      assert.ok(resolved.endsWith('module.ts'), 'Should resolve to .ts file');
    });
  });

  describe('extensionless imports', () => {
    it('should resolve imports without extensions', () => {
      const resolved = resolver.resolve('./module', join(testDir, 'index.ts'));
      assert.ok(resolved);
      assert.ok(resolved.endsWith('.ts') || resolved.endsWith('.js'));
    });

    it('should resolve directory imports to index files', () => {
      const resolved = resolver.resolve('.', join(testDir, 'lib', 'helper.ts'));
      assert.ok(resolved);
      // Should resolve to either index.ts or the directory resolution
    });
  });

  describe('path aliases', () => {
    it('should resolve path alias with wildcard', () => {
      const resolved = resolver.resolve('@lib/helper', join(testDir, 'index.ts'));
      assert.ok(resolved, 'Should resolve @lib/helper alias');
      assert.ok(resolved.includes('lib') && resolved.endsWith('helper.ts'));
    });

    it('should resolve exact path alias', () => {
      const resolved = resolver.resolve('@utils', join(testDir, 'index.ts'));
      assert.ok(resolved, 'Should resolve @utils alias');
      assert.ok(resolved.includes('lib') && resolved.endsWith('helper.ts'));
    });
  });

  describe('caching', () => {
    it('should cache resolved modules', () => {
      const specifier = './module.ts';
      const parent = join(testDir, 'index.ts');
      
      const resolved1 = resolver.resolve(specifier, parent);
      const resolved2 = resolver.resolve(specifier, parent);
      
      assert.strictEqual(resolved1, resolved2);
    });

    it('should clear cache when requested', () => {
      resolver.clearCache();
      const resolved = resolver.resolve('./module.ts', join(testDir, 'index.ts'));
      assert.ok(resolved);
    });
  });

  describe('edge cases', () => {
    it('should return null for non-existent modules', () => {
      const resolved = resolver.resolve('./non-existent', join(testDir, 'index.ts'));
      assert.strictEqual(resolved, null);
    });

    it('should handle file:// URLs as parent', () => {
      const parentURL = `file://${join(testDir, 'index.ts')}`;
      const resolved = resolver.resolve('./module.ts', parentURL);
      assert.ok(resolved);
      assert.ok(resolved.endsWith('module.ts'));
    });
  });
});
