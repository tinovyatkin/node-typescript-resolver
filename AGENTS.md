# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TypeScript sources (`index.ts` entry, `resolver.ts` core logic, `loader.ts`/`require.ts` hooks).
- `tests/` holds Node test suites (`*.test.ts`) plus fixtures in `tests/fixtures/`.
- `dist/`: generated; never edit—regenerate with `npm run build` after source/type changes.
- Configs: `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `.commitlintrc.yaml`, `lefthook.yml`.

## Build, Test, and Development Commands

- `npm run build` – compile TypeScript with `tsc` into `dist/`.
- `npm test` – run the Node.js built-in test runner.
- `npm run test:ci` – same tests with coverage reporters (lcov + JUnit) for CI.
- `node --test --test-reporter=dot` – quick local reporter; `node --test tests/resolver.test.ts` for focused runs.
- `npm run lint:fix` – run oxlint.
- Lefthook runs lint/format automatically on staged files if installed.

## Architecture Highlights

- Three-layer flow: `index.ts` registers the loader → `loader.ts` implements Node resolve hooks → `resolver.ts` wraps `oxc-resolver`.
- Non-intrusive resolution: call `nextResolve()` first; handle only `ERR_MODULE_NOT_FOUND`, `ERR_UNSUPPORTED_DIR_IMPORT`,
  `ERR_INVALID_MODULE_SPECIFIER`, then return `shortCircuit: true`.
- Extension aliasing maps `.js/.mjs/.cjs` to `.ts/.mts/.cts`; `oxc-resolver` auto-detects the nearest `tsconfig` and applies `baseUrl/paths`.
- Resolver instances are cached per condition set; avoid `cloneWithOptions()` (breaks resolution).

## Coding Style & Naming Conventions

- Oxfmt enforces print width 100, semicolons, trailing commas, LF endings for JS/TS files.
- Oxlint: prefer type-only imports, forbid `console.*` (use a logger or pass one in), disallow unused vars unless prefixed with `_`. Type-aware
  linting enabled via `--type-aware` flag.
- Keep modules ESM; names should be descriptive and kebab- or camel-cased to match surrounding files. Tests mirror the module name (
  `resolver.test.ts` for `resolver.ts`).

## Testing Guidelines

- Write tests with Node’s `node:test` in `tests/`; use fixtures under `tests/fixtures/` for file-based cases.
- Aim to keep existing coverage; CI emits `lcov.info` and `junit.xml`. Prefer clear assertion messages over broad snapshots.
- Name tests `*.test.ts` and isolate side effects (no network or FS writes outside `tests/fixtures/`); resolver tests use `tmpdir()`—clean up in
  hooks.

## Commit & Pull Request Guidelines

- Commit messages must pass commitlint: lower-case type {build,chore,ci,ai,docs,feat,fix,perf,refactor,revert,style,test}, optional scope, subject
  ≤150 chars, no trailing period; body/footers ≤400/150.
- PRs should describe the change, note test commands executed, link issues, and state if `dist/` was regenerated. Include screenshots only if
  output/UX changes.

## Constraints & Safety

- Node.js must stay >=22.15.0 and the package remains ESM-only (`"type": "module"`).
- Preserve non-intrusive resolution/caching patterns noted above.
- Build artifacts belong in `dist/` with declarations; prefer updating sources/tests, then rebuilding.
