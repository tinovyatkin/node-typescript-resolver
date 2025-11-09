import { value } from "./components";

if (value === "directory-index-ts-works") {
  console.log("SUCCESS: directory index.ts import");
  process.exit(0);
} else {
  console.error("FAILED: directory index.ts import");
  process.exit(1);
}
