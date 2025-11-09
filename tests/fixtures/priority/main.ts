import { value } from "./foo";

// According to Node.js resolution algorithm, files should have priority over directories
if (value === "file-priority") {
  console.log("SUCCESS: file has priority over directory");
  process.exit(0);
} else if (value === "directory-priority") {
  console.error("FAILED: directory resolved instead of file");
  process.exit(1);
} else {
  console.error("FAILED: unexpected value:", value);
  process.exit(1);
}
