/**
 * Test fixture for CommonJS require() with TypeScript files
 * This tests the synchronous resolve hook with require()
 */

(async () => {
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

    // Test 3: Dynamic import of .mts module from CommonJS
    const fooMts = await import("./foo.mts");

    if (fooMts.esmMessage !== "Hello from TypeScript ESM (.mts) via dynamic import!") {
      throw new Error(`Expected esmMessage from foo.mts, got: ${fooMts.esmMessage}`);
    }
    console.log("✓ Dynamically imported .mts module from CommonJS");

    if (fooMts.esmValue !== 100) {
      throw new Error(`Expected esmValue 100, got: ${fooMts.esmValue}`);
    }
    console.log("✓ Successfully accessed exported values from .mts module");

    console.log("SUCCESS: CommonJS require() with TypeScript files");
    process.exit(0);
  } catch (error) {
    console.error("FAILED:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
