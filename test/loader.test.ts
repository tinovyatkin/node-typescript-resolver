import assert from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { initialize, resolve } from "../src/loader.ts";

/**
 * Mock nextResolve function that simulates Node.js failing to resolve a module
 */
async function mockNextResolveWithNotFound(): Promise<never> {
  const error = new Error("Cannot find module") as Error & { code: string };
  error.code = "ERR_MODULE_NOT_FOUND";
  throw error;
}

describe("Loader", () => {
  let testDir: string;
  let parentURL: string;

  before(async () => {
    // Initialize the loader (normally done by the initialize hook)
    initialize();

    // Create a temporary test directory
    testDir = join(tmpdir(), `ts-loader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create test files
    await writeFile(join(testDir, "module.ts"), "export const test = 1;");
    await writeFile(join(testDir, "data.json"), JSON.stringify({ key: "value" }));
    await writeFile(join(testDir, "module.wasm"), new Uint8Array([0x00, 0x61, 0x73, 0x6d])); // WASM magic bytes

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@data": ["data.json"],
        },
      },
    };
    await writeFile(join(testDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

    // Create an index file that will act as the parent
    await writeFile(join(testDir, "index.ts"), "// test file");
    parentURL = pathToFileURL(join(testDir, "index.ts")).href;
  });

  after(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { force: true, recursive: true });
    }
  });

  describe("import attributes", () => {
    it("should set importAttributes for JSON files", async () => {
      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      const result = await resolve("./data.json", context, mockNextResolveWithNotFound);

      assert.notStrictEqual(result, null, "Should resolve JSON file");
      assert.strictEqual(result.format, "json", "Format should be json");
      assert.notStrictEqual(result.importAttributes, undefined, "Should have importAttributes");
      assert.strictEqual(result.importAttributes?.type, "json", "Should have type: json");
      assert.strictEqual(result.shortCircuit, true, "Should short circuit");
      assert.strictEqual(result.url.endsWith("data.json"), true, "URL should point to data.json");
    });

    it("should set importAttributes for WASM files", async () => {
      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      const result = await resolve("./module.wasm", context, mockNextResolveWithNotFound);

      assert.notStrictEqual(result, null, "Should resolve WASM file");
      assert.strictEqual(result.format, "wasm", "Format should be wasm");
      assert.notStrictEqual(result.importAttributes, undefined, "Should have importAttributes");
      assert.strictEqual(result.importAttributes?.type, "wasm", "Should have type: wasm");
      assert.strictEqual(result.shortCircuit, true, "Should short circuit");
      assert.strictEqual(
        result.url.endsWith("module.wasm"),
        true,
        "URL should point to module.wasm",
      );
    });

    it("should not set importAttributes for TypeScript files", async () => {
      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      const result = await resolve("./module.ts", context, mockNextResolveWithNotFound);

      assert.notStrictEqual(result, null, "Should resolve TypeScript file");
      assert.strictEqual(result.format, undefined, "Format should be undefined for TS files");
      assert.strictEqual(
        result.importAttributes,
        undefined,
        "Should not have importAttributes for TS files",
      );
      assert.strictEqual(result.shortCircuit, true, "Should short circuit");
      assert.strictEqual(result.url.endsWith("module.ts"), true, "URL should point to module.ts");
    });

    it("should resolve JSON via path alias with importAttributes", async () => {
      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      const result = await resolve("@data", context, mockNextResolveWithNotFound);

      assert.notStrictEqual(result, null, "Should resolve @data alias");
      assert.strictEqual(result.format, "json", "Format should be json");
      assert.notStrictEqual(result.importAttributes, undefined, "Should have importAttributes");
      assert.strictEqual(result.importAttributes?.type, "json", "Should have type: json");
      assert.strictEqual(result.url.endsWith("data.json"), true, "URL should point to data.json");
    });
  });

  describe("non-intrusive resolution", () => {
    it("should use Node.js resolution when it succeeds", async () => {
      const expectedUrl = "file:///resolved/module.js";
      const mockNextResolve = async () => ({
        format: "module" as const,
        shortCircuit: false,
        url: expectedUrl,
      });

      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      const result = await resolve("some-package", context, mockNextResolve);

      assert.strictEqual(result.url, expectedUrl, "Should return Node.js resolution result");
      assert.strictEqual(result.format, "module");
    });

    it("should throw non-ERR_MODULE_NOT_FOUND errors", async () => {
      const customError = new Error("Permission denied") as Error & { code: string };
      customError.code = "EACCES";

      const mockNextResolve = async () => {
        throw customError;
      };

      const context = {
        conditions: ["node", "import"],
        importAttributes: {},
        parentURL,
      };

      await assert.rejects(
        async () => resolve("./module.ts", context, mockNextResolve),
        (error: Error & { code: string }) => {
          assert.strictEqual(error.code, "EACCES");
          assert.strictEqual(error.message, "Permission denied");
          return true;
        },
      );
    });
  });
});
