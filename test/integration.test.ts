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
      ["--no-warnings", "--experimental-strip-types", "--import", loaderPath, fixturePath],
      {
        cwd: rootDir,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
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
  });
});
