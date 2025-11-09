/**
 * Test fixture for ESM using createRequire to require .cts files
 * This tests the synchronous resolve hook with createRequire()
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

try {
  // Test 1: Require extensionless .cts module
  const helper = require("./helper");

  if (helper.cjsMessage !== "Hello from CommonJS TypeScript!") {
    throw new Error(`Expected message from helper, got: ${helper.cjsMessage}`);
  }
  console.log("✓ Required extensionless .cts module via createRequire");

  if (helper.cjsValue !== 123) {
    throw new Error(`Expected value 123, got: ${helper.cjsValue}`);
  }
  console.log("✓ Successfully accessed exported values from .cts");

  // Test 2: Require with explicit .cts extension
  const helperExplicit = require("./helper.cts");

  if (helperExplicit.cjsMessage !== "Hello from CommonJS TypeScript!") {
    throw new Error(`Expected message from helper.cts, got: ${helperExplicit.cjsMessage}`);
  }
  console.log("✓ Required .cts module with extension via createRequire");

  // Test 3: Call function from required module
  const greeting = helper.greet("TypeScript");
  if (greeting !== "Hello, TypeScript from CTS!") {
    throw new Error(`Expected greeting, got: ${greeting}`);
  }
  console.log("✓ Successfully called function from required .cts module");

  console.log("SUCCESS: ESM createRequire() with CommonJS TypeScript files");
  process.exit(0);
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
