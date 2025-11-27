// Test implicit type-only imports (without explicit `type` keyword)
// This tests the load hook that filters out type-only imports at runtime

// Case 1: Mixed runtime and type-only imports
import { Pool, PoolClient } from "pg";

// Case 2: All type-only imports from a package with runtime exports
import { PoolConfig, QueryConfig } from "pg";

// Case 3: Default import with type-only named imports
import pg, { ClientConfig } from "pg";

// Use the type-only imports as type annotations (these should work)
function queryWithClient(client: PoolClient, config: QueryConfig): void {
  client.query(config);
}

function createPool(config: PoolConfig): Pool {
  return new Pool(config);
}

function getDefaults(config: ClientConfig): typeof pg.defaults {
  return { ...pg.defaults, ...config };
}

// Use the runtime imports
const pool = new Pool();
const defaults = pg.defaults;

// Verify everything works
if (typeof pool === "object" && typeof defaults === "object") {
  console.log("SUCCESS: implicit type-only imports handled correctly");
  process.exit(0);
} else {
  console.error("FAILED: imports not working correctly");
  process.exit(1);
}
