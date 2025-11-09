# node-typescript-resolver [![codecov](https://codecov.io/gh/tinovyatkin/node-typescript-resolver/graph/badge.svg?token=h66FWU5vjB)](https://codecov.io/gh/tinovyatkin/node-typescript-resolver)

**A companion loader for Node.js's built-in TypeScript support** that adds TypeScript-aware import resolution.

> **Note:** This package does **not** transform TypeScript code. It works alongside Node.js 22's built-in TypeScript support (type stripping) or `--experimental-transform-types` flag to provide proper module resolution for TypeScript imports.

This package provides a fast and efficient TypeScript module resolver for Node.js that supports:

- ✨ **TypeScript file resolution** (.ts, .tsx, .mts, .cts)
- 🚀 **Extensionless imports** (import './module' resolves to './module.ts')
- 📁 **Directory imports** (import './dir' resolves to './dir/index.ts')
- 🎯 **tsconfig.json path aliases** (e.g., '@lib/\*', '@utils')
- 🔄 **import.meta.resolve support** (synchronous resolution for TypeScript files)
- 📦 **CommonJS require() support** (require TypeScript files with extensionless imports)
- 🧵 **Worker threads support** (extensionless imports inside worker threads)
- ⚡ **Efficient caching** for fast repeated resolutions
- 🔧 **Built on [oxc-resolver](https://www.npmjs.com/package/oxc-resolver)** for blazing-fast resolution

## Installation

```bash
npm install node-typescript-resolver
```

## Usage

Use the loader alongside Node.js's built-in TypeScript support to enable TypeScript-aware module resolution:

```bash
# Node.js 22.7.0+ with built-in TypeScript support (type stripping)
node --import node-typescript-resolver your-app.ts

# Or with --experimental-transform-types for type transformations
node --experimental-transform-types --import node-typescript-resolver your-app.ts
```

This allows you to write TypeScript imports like:

```javascript
// Import without extension - resolves to helper.ts or helper.js
import { helper } from "./helper";

// Import directory - resolves to ./components/index.ts
import { Button } from "./components";

// Import with TypeScript path alias (from tsconfig.json)
import { utils } from "@lib/utils";

// Standard imports still work
import { something } from "./module.ts";
```

## TypeScript Path Aliases

The resolver automatically detects and uses `tsconfig.json` for path alias resolution:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@lib/*": ["src/lib/*"],
      "@utils": ["src/utils/index.ts"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

With this configuration, you can use imports like:

```typescript
import { Button } from "@components/Button";
import { helper } from "@lib/helpers";
import { format } from "@utils";
```

## import.meta.resolve Support

The loader provides both **asynchronous** and **synchronous** resolve hooks, enabling full support for `import.meta.resolve()` with TypeScript files:

```typescript
// Resolve extensionless TypeScript imports
const helperPath = import.meta.resolve("./helper"); // Resolves to ./helper.ts

// Resolve with explicit .ts extension
const modulePath = import.meta.resolve("./module.ts");

// Resolve path aliases from tsconfig.json
const utilsPath = import.meta.resolve("@lib/utils");

// Use the resolved path
const module = await import(helperPath);
```

This is powered by the **synchronous resolve hook** (`resolveSync`), which Node.js uses internally when calling `import.meta.resolve()`. Both the async and sync hooks provide the same resolution capabilities:

- TypeScript file extensions (.ts, .tsx, .mts, .cts)
- Extensionless imports
- Directory imports to index files
- tsconfig.json path aliases

## CommonJS require() Support

The synchronous resolve hook also enables CommonJS `require()` to work seamlessly with TypeScript files:

```javascript
// main.cjs
// Require extensionless TypeScript module
const helper = require("./helper"); // Resolves to ./helper.ts

// Require with explicit .ts extension
const module = require("./module.ts");

// Require path aliases from tsconfig.json
const utils = require("@lib/utils");
```

This means you can:

- Mix CommonJS and ESM modules in the same project
- Gradually migrate from CommonJS to ESM
- Use TypeScript files in legacy CommonJS codebases
- Leverage path aliases in both module systems

**Note:** While Node.js's built-in TypeScript support works with CommonJS files (`.cjs`), the TypeScript files themselves should use ESM syntax (`export`/`import`). The loader enables CommonJS code to `require()` those TypeScript ESM modules.

## Worker Threads Support

Worker threads work with TypeScript files. The Worker constructor requires the `.ts` extension for the worker file itself, but imports **inside** the worker support extensionless resolution:

```javascript
// Worker file must have .ts extension
const worker = new Worker(new URL("./worker.ts", import.meta.url), {
  execArgv: process.execArgv, // Pass loader to worker
});

// Inside worker.ts - extensionless imports work
import { helper } from "./helper"; // Resolves to ./helper.ts
```

## How It Works

### Non-Intrusive Resolution

This loader is designed to be **non-intrusive** and provides both **async** and **sync** resolve hooks:

1. **Always tries default Node.js resolution first**
   - Lets Node.js handle all normal module resolution
   - Only activates when Node.js fails with `ERR_MODULE_NOT_FOUND`
   - Works for both dynamic imports and `import.meta.resolve()`

2. **Fallback resolution** - When default resolution fails, the loader tries:
   - TypeScript path aliases (if configured via tsconfig.json)
   - TypeScript file extensions (.ts, .tsx, .mts, .cts)
   - Extensionless imports with multiple extension candidates
   - oxc-resolver for fast filesystem lookups

3. **Dual resolution modes**
   - **Async hook** (`resolve`) - Used for dynamic imports and regular import statements
   - **Sync hook** (`resolveSync`) - Used by `import.meta.resolve()` and CommonJS `require()` for synchronous resolution
   - Both hooks share the same resolution logic and capabilities

4. **Efficient caching**
   - All resolutions are cached automatically by oxc-resolver
   - Built-in caching minimizes filesystem access for repeated imports
   - Cache can be cleared when needed via `clearCache()`

This approach ensures:

- ✅ No performance impact on standard Node.js module resolution
- ✅ No interference with existing working imports
- ✅ Full support for both async and sync resolution APIs
- ✅ Only enhances resolution when needed

## Performance

This package is designed for high performance:

- Built on top of the fast [oxc-resolver](https://www.npmjs.com/package/oxc-resolver)
- Built-in caching from oxc-resolver to avoid repeated filesystem lookups
- Minimal overhead in the resolution path

## Production Ready

This package is built for reliability and production use:

- **Stable Node.js APIs** - Uses Node.js's official [customization hooks](https://nodejs.org/docs/latest-v22.x/api/module.html#customization-hooks) API (stable since Node.js 22.7.0)
- **Battle-tested resolver** - Powered by [oxc-resolver](https://www.npmjs.com/package/oxc-resolver), a Rust-based resolver used in production by the Oxc project
- **Comprehensive test coverage** - Extensively tested with 33 integration tests covering real-world scenarios:
  - ESM and CommonJS interoperability
  - Path aliases and extensionless imports
  - `import.meta.resolve()` and `createRequire()` support
  - Directory imports and edge cases

## Requirements

- Node.js >= 22.7.0 (with built-in TypeScript support)
- Works with Node.js's built-in type stripping or `--experimental-transform-types` flag (this package only handles import resolution, not code transformation)

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Run tests with TypeScript directly (Node.js 22.7.0+)
npm run test:ts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Konstantin Vyatkin <tino@vtkn.io>
