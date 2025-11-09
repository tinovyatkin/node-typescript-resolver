/**
 * Test fixture for CommonJS require() with TypeScript files
 * This tests the synchronous resolve hook with require()
 */

try {
  // Test 1: Require extensionless .ts module
  const foo = require("./foo");

  if (foo.message !== "Hello from TypeScript via require!") {
    throw new Error(`Expected message from foo, got: ${foo.message}`);
  }
  console.log("✓ Required extensionless .ts module");

  if (foo.value !== 42) {
    throw new Error(`Expected value 42, got: ${foo.value}`);
  }
  console.log("✓ Successfully accessed exported values");

  // Test 2: Require with explicit .ts extension
  const fooExplicit = require("./foo.ts");

  if (fooExplicit.message !== "Hello from TypeScript via require!") {
    throw new Error(`Expected message from foo.ts, got: ${fooExplicit.message}`);
  }
  console.log("✓ Required .ts module with extension");

  console.log("SUCCESS: CommonJS require() with TypeScript files");
  process.exit(0);
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
