/**
 * Test fixture for import.meta.resolve with TypeScript files
 * This tests the synchronous resolve hook
 */

try {
  // Test 1: Resolve extensionless .ts import
  const resolved1 = import.meta.resolve("./helper");
  if (!resolved1.endsWith("helper.ts")) {
    throw new Error(`Expected helper.ts, got: ${resolved1}`);
  }
  console.log("✓ Resolved extensionless .ts import");

  // Test 2: Resolve with explicit .ts extension
  const resolved2 = import.meta.resolve("./helper.ts");
  if (!resolved2.endsWith("helper.ts")) {
    throw new Error(`Expected helper.ts, got: ${resolved2}`);
  }
  console.log("✓ Resolved .ts import with extension");

  // Test 3: Resolve path alias
  const resolved3 = import.meta.resolve("@/helper");
  if (!resolved3.endsWith("helper.ts")) {
    throw new Error(`Expected helper.ts from path alias, got: ${resolved3}`);
  }
  console.log("✓ Resolved path alias");

  // Test 4: Verify the resolved URL is valid by importing it
  const helperModule = await import(resolved1);
  if (helperModule.message !== "Helper module loaded") {
    throw new Error(`Expected helper message, got: ${helperModule.message}`);
  }
  console.log("✓ Successfully imported resolved module");

  console.log("SUCCESS: import.meta.resolve with TypeScript files");
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
