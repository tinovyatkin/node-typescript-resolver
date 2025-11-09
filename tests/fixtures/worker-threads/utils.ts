// Second-level import - this will be imported by the worker
export function computeResult(): string {
  return "worker-thread-two-level-import-works";
}

export const metadata = {
  module: "utils",
  level: "second",
};
