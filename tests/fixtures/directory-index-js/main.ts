import { value } from "./utils";

if (value === "directory-index-js-works") {
  console.log("SUCCESS: directory index.js import");
  process.exit(0);
} else {
  console.error("FAILED: directory index.js import");
  process.exit(1);
}
