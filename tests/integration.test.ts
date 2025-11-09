import assert from "node:assert";
import { execFile, type ExecFileException } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(testDir, "..");
// Use source TypeScript file directly - Node 22 can load .ts files
// Need to use file:// URL for --import
const loaderPath = pathToFileURL(join(rootDir, "src", "index.ts")).href;

/**
 * Helper function to run a fixture with the loader
 */
async function runFixture(
  fixturePath: string,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  try {
    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      ["--import", loaderPath, fixturePath],
      {
        cwd: rootDir,
      },
    );
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    const execError = error as ExecFileException & {
      stderr?: Buffer | string;
      stdout?: Buffer | string;
    };
    const exitCode = typeof execError.code === "number" ? execError.code : 1;

    return {
      exitCode,
      stderr: execError.stderr?.toString() ?? "",
      stdout: execError.stdout?.toString() ?? "",
    };
  }
}

describe("Integration Tests - Loader with real Node.js processes", () => {
  describe("extensionless imports", () => {
    it("should resolve extensionless import from a TypeScript file", async () => {
      const fixturePath = join(testDir, "fixtures", "extensionless", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: extensionless import"),
        `Expected success message in stdout. Got: ${result.stdout}`,
      );
    });
  });

  describe("directory imports", () => {
    it("should resolve import from directory with index.ts", async () => {
      const fixturePath = join(testDir, "fixtures", "directory-index-ts", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: directory index.ts import"),
        `Expected success message in stdout. Got: ${result.stdout}`,
      );
    });

    it("should resolve import from directory with index.js", async () => {
      const fixturePath = join(testDir, "fixtures", "directory-index-js", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: directory index.js import"),
        `Expected success message in stdout. Got: ${result.stdout}`,
      );
    });
  });

  describe("resolution priority", () => {
    it("should prioritize file over directory when both exist with same name", async () => {
      const fixturePath = join(testDir, "fixtures", "priority", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: file has priority over directory"),
        `Expected file to have priority over directory. Got: ${result.stdout}`,
      );
    });
  });

  describe("path aliases", () => {
    it("should resolve tsconfig.json path aliases", async () => {
      const fixturePath = join(testDir, "fixtures", "path-aliases", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: path aliases resolution"),
        `Expected path aliases to resolve correctly. Got: ${result.stdout}`,
      );
    });
  });

  describe("entry points", () => {
    it("should resolve extensionless entry point", async () => {
      const fixturePath = join(testDir, "fixtures", "entry-point", "entry");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: entry point without extension resolved"),
        `Expected extensionless entry point to resolve. Got: ${result.stdout}`,
      );
    });

    it("should resolve path alias entry point from subdirectory tsconfig", async () => {
      // Run from the fixture directory so its tsconfig.json is used
      const fixturePath = "@app";
      const fixtureDir = join(testDir, "fixtures", "entry-point");

      try {
        const { stdout } = await execFileAsync(
          process.execPath,
          ["--import", loaderPath, fixturePath],
          {
            cwd: fixtureDir,
          },
        );

        assert.ok(
          stdout.includes("SUCCESS: path alias entry point resolved"),
          `Expected path alias entry point to resolve. Got: ${stdout}`,
        );
      } catch (error) {
        const execError = error as ExecFileException & {
          stderr?: Buffer | string;
          stdout?: Buffer | string;
        };
        assert.fail(`Process should not throw. stderr: ${execError.stderr?.toString() ?? ""}`);
      }
    });
  });

  describe("import.meta.resolve", () => {
    it("should resolve TypeScript files via import.meta.resolve (sync hook)", async () => {
      const fixturePath = join(testDir, "fixtures", "import-meta-resolve", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("✓ Resolved extensionless .ts import"),
        `Expected to resolve extensionless .ts import. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Resolved .ts import with extension"),
        `Expected to resolve .ts import with extension. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Resolved path alias"),
        `Expected to resolve path alias. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Successfully imported resolved module"),
        `Expected to import resolved module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: import.meta.resolve with TypeScript files"),
        `Expected success message. Got: ${result.stdout}`,
      );
    });
  });

  describe("CommonJS require", () => {
    it("should resolve TypeScript files via require() (sync hook)", async () => {
      const fixturePath = join(testDir, "fixtures", "commonjs-require", "main.cjs");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("✓ Required extensionless .ts module"),
        `Expected to require extensionless .ts module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Successfully accessed exported values"),
        `Expected to access exported values. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Required .ts module with extension"),
        `Expected to require .ts module with extension. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Dynamically imported .mts module from CommonJS"),
        `Expected to dynamically import .mts module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Successfully accessed exported values from .mts module"),
        `Expected to access exported values from .mts module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: CommonJS require() with TypeScript files"),
        `Expected success message. Got: ${result.stdout}`,
      );
    });
  });

  describe("ESM createRequire", () => {
    it("should resolve .cts files via createRequire() (sync hook)", async () => {
      const fixturePath = join(testDir, "fixtures", "esm-create-require", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("✓ Required extensionless .cts module via createRequire"),
        `Expected to require extensionless .cts module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Successfully accessed exported values from .cts"),
        `Expected to access exported values from .cts. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Required .cts module with extension via createRequire"),
        `Expected to require .cts module with extension. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("✓ Successfully called function from required .cts module"),
        `Expected to call function from .cts module. Got: ${result.stdout}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: ESM createRequire() with CommonJS TypeScript files"),
        `Expected success message. Got: ${result.stdout}`,
      );
    });
  });

  describe("Worker Threads", () => {
    it("should resolve TypeScript imports inside worker threads", async () => {
      const fixturePath = join(testDir, "fixtures", "worker-threads", "main.ts");
      const result = await runFixture(fixturePath);

      assert.strictEqual(
        result.exitCode,
        0,
        `Process should exit with code 0. stderr: ${result.stderr}`,
      );
      assert.ok(
        result.stdout.includes("SUCCESS: worker thread with two-level TypeScript imports"),
        `Expected worker thread to resolve TypeScript imports. Got: ${result.stdout}`,
      );
    });
  });
});
