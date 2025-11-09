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

    // Test 2: Require extensionless .ts module again (different variable)
    const fooExplicit = require("./foo");

    if (fooExplicit.message !== "Hello from TypeScript via require!") {
      throw new Error(`Expected message from foo, got: ${fooExplicit.message}`);
    }
    console.log("✓ Required .ts module without extension (second time)");

    // Test 3: Dynamic import of .mts module from CommonJS
    const boo = await import("./boo");

    if (boo.esmMessage !== "Hello from TypeScript ESM (.mts) via dynamic import!") {
      throw new Error(`Expected esmMessage from boo.mts, got: ${boo.esmMessage}`);
    }
    console.log("✓ Dynamically imported .mts module from CommonJS");

    if (boo.esmValue !== 100) {
      throw new Error(`Expected esmValue 100, got: ${boo.esmValue}`);
    }
    console.log("✓ Successfully accessed exported values from .mts module");

    console.log("SUCCESS: CommonJS require() with TypeScript files");
    process.exit(0);
  } catch (error) {
    console.error("FAILED:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
