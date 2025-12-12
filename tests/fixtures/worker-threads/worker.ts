// Worker thread implementation - imports another TS file to test two-level imports
import { parentPort } from "node:worker_threads";

import { computeResult, metadata } from "./utils";

if (!parentPort) {
  throw new Error("This module must be run as a worker thread");
}

// Test that the import worked by calling the function
const result = computeResult();
const data = {
  result,
  metadata,
  workerReady: true,
};

// Send data back to parent
parentPort.postMessage(data);
