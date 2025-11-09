import { value } from "./helper";

if (value === "extensionless-import-works") {
  console.log("SUCCESS: extensionless import");
  process.exit(0);
} else {
  console.error("FAILED: extensionless import");
  process.exit(1);
}
