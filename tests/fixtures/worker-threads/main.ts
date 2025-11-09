// Main entry point - spawns a worker thread with TypeScript file
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

// Worker constructor requires a file path/URL, not a module specifier
// It validates paths before module resolution, so we must use .ts extension
// However, imports INSIDE the worker will test our extensionless resolution
const workerURL = new URL("./worker.ts", import.meta.url);

// Worker threads need the loader with an absolute path
// Find the root directory (3 levels up from this file)
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..", "..", "..");
const loaderPath = pathToFileURL(join(rootDir, "src", "index.ts")).href;

const worker = new Worker(workerURL, {
  execArgv: ["--import", loaderPath],
});

worker.on("message", (data) => {
  if (
    data.result === "worker-thread-two-level-import-works" &&
    data.metadata.module === "utils" &&
    data.metadata.level === "second" &&
    data.workerReady === true
  ) {
    console.log("SUCCESS: worker thread with two-level TypeScript imports");
    process.exit(0);
  } else {
    console.error("FAILED: worker thread import validation failed");
    console.error("Received data:", JSON.stringify(data, null, 2));
    process.exit(1);
  }
});

worker.on("error", (err) => {
  console.error("FAILED: worker thread error:", err.message);
  process.exit(1);
});

worker.on("exit", (code) => {
  if (code !== 0) {
    console.error(`FAILED: worker stopped with exit code ${code}`);
    process.exit(1);
  }
});
