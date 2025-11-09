import { helperValue } from "@lib/helper";
import { utilsValue } from "@utils";

if (helperValue === "path-alias-helper-works" && utilsValue === "path-alias-utils-works") {
  console.log("SUCCESS: path aliases resolution");
  process.exit(0);
} else {
  console.error("FAILED: path aliases resolution");
  console.error("helperValue:", helperValue);
  console.error("utilsValue:", utilsValue);
  process.exit(1);
}
