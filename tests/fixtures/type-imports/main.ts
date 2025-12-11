import { type Writable } from "type-fest";

import { type MyType } from "./types";

// Test type-only imports from local .d.ts file
const test: MyType = { foo: "bar" };

// Test type-only imports from external package
type TestType = Writable<{ readonly foo: string }>;
const test2: TestType = { foo: "baz" };
test2.foo = "modified"; // This should work because Writable removes readonly

if (test.foo === "bar" && test2.foo === "modified") {
  console.log("SUCCESS: type imports from both local .d.ts and type-fest package");
  process.exit(0);
} else {
  console.error("FAILED: type imports");
  process.exit(1);
}
