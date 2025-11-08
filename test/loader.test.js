import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

describe('Loader Integration', () => {
  let testDir;

  before(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `loader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create a TypeScript file that will be resolved
    await writeFile(
      join(testDir, 'helper.mjs'),
      'export const message = "Hello from resolved module";'
    );

    // Create main file that imports without extension
    await writeFile(
      join(testDir, 'main.mjs'),
      `import { message } from './helper';
console.log('Success:', message);`
    );

    // Create package.json for ESM
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ type: 'module' }, null, 2)
    );
  });

  after(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should resolve extensionless imports with the loader', (t, done) => {
    const loaderPath = join(process.cwd(), 'dist', 'loader.js');
    
    // Run Node.js with our loader
    const child = spawn('node', [
      '--loader',
      loaderPath,
      join(testDir, 'main.mjs'),
    ], {
      cwd: testDir,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // The loader should resolve the extensionless import
      if (code !== 0) {
        console.error('stderr:', stderr);
        console.error('stdout:', stdout);
        assert.fail(`Process exited with code ${code}`);
      }
      
      assert.ok(stdout.includes('Success:'), 'Should output success message');
      assert.ok(stdout.includes('Hello from resolved module'), 'Should resolve extensionless import');
      done();
    });
  });
});
