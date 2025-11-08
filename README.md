# node-typescript-resolver

Node.js loader to close the gap between built-in TypeScript support and TS imports resolution.

This package provides a fast and efficient TypeScript module resolver for Node.js that supports:

- ✨ **TypeScript file resolution** (.ts, .tsx, .mts, .cts)
- 🚀 **Extensionless imports** (import './module' resolves to './module.ts')
- 🎯 **tsconfig.json path aliases** (e.g., '@lib/\*', '@utils')
- ⚡ **Efficient caching** for fast repeated resolutions
- 🔧 **Built on oxc-resolver** for blazing-fast resolution

This package combines functionality similar to [node-ts-resolver](https://github.com/niieani/node-ts-resolver) and [extensionless](https://github.com/barhun/extensionless) while using the high-performance [oxc-resolver](https://www.npmjs.com/package/oxc-resolver) under the hood.

## Installation

```bash
npm install node-typescript-resolver
```

## Usage

### As a Node.js Loader

Use the loader to enable TypeScript-aware module resolution in your Node.js applications:

```bash
# Using --import flag (Node.js 22.7.0+)
node --import node-typescript-resolver your-app.js
```

This allows you to write imports like:

```javascript
// Import without extension - resolves to helper.ts or helper.js
import { helper } from "./helper";

// Import with TypeScript path alias (from tsconfig.json)
import { utils } from "@lib/utils";

// Standard imports still work
import { something } from "./module.ts";
```

### Programmatic API

You can also use the resolver programmatically in your code:

```typescript
import { createResolver } from "node-typescript-resolver";

// Create a resolver instance
const resolver = createResolver({
  tsconfigPath: "./tsconfig.json", // Optional: explicit tsconfig path
});

// Resolve a module
const resolved = resolver.resolve("./module", "/path/to/parent.ts");
console.log(resolved); // /path/to/module.ts

// Resolve with path alias
const aliasResolved = resolver.resolve("@lib/helper", "/path/to/parent.ts");
console.log(aliasResolved); // /path/to/lib/helper.ts

// Clear cache if needed
resolver.clearCache();
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

## How It Works

### Non-Intrusive Resolution

Following the proven approach from [node-ts-resolver](https://github.com/niieani/node-ts-resolver) and [extensionless](https://github.com/barhun/extensionless), this loader is designed to be **non-intrusive**:

1. **Always tries default Node.js resolution first**
   - Lets Node.js handle all normal module resolution
   - Only activates when Node.js fails with `ERR_MODULE_NOT_FOUND`

2. **Fallback resolution** - When default resolution fails, the loader tries:
   - TypeScript path aliases (if configured via tsconfig.json)
   - TypeScript file extensions (.ts, .tsx, .mts, .cts)
   - Extensionless imports with multiple extension candidates
   - oxc-resolver for fast filesystem lookups

3. **Efficient caching**
   - All resolutions are cached automatically by oxc-resolver
   - Built-in caching minimizes filesystem access for repeated imports
   - Cache can be cleared when needed via `clearCache()`

This approach ensures:

- ✅ No performance impact on standard Node.js module resolution
- ✅ No interference with existing working imports
- ✅ Only enhances resolution when needed

## Performance

This package is designed for high performance:

- Built on top of the fast [oxc-resolver](https://www.npmjs.com/package/oxc-resolver)
- Built-in caching from oxc-resolver to avoid repeated filesystem lookups
- Minimal overhead in the resolution path

## Comparison with Similar Tools

| Feature               | node-typescript-resolver | node-ts-resolver | extensionless |
| --------------------- | ------------------------ | ---------------- | ------------- |
| TypeScript resolution | ✅                       | ✅               | ❌            |
| Extensionless imports | ✅                       | ❌               | ✅            |
| Path aliases          | ✅                       | ✅               | ❌            |
| Caching               | ✅                       | Limited          | ❌            |
| Fast resolver         | ✅ (oxc)                 | ❌               | ❌            |

## Requirements

- Node.js >= 22.7.0

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

## API Reference

### `createResolver(options)`

Creates a new resolver instance.

**Options:**

- `tsconfigPath` (string, optional): Path to tsconfig.json. If not provided, the resolver will auto-detect it.

**Returns:** `TypeScriptResolver` instance

### `TypeScriptResolver`

#### `resolve(specifier: string, parent: string): string | null`

Resolves a module specifier relative to a parent file.

**Parameters:**

- `specifier`: The module specifier to resolve (e.g., './module', '@lib/helper')
- `parent`: The absolute path or file:// URL of the parent module

**Returns:** Absolute path to the resolved module, or `null` if not found

#### `clearCache(): void`

Clears the internal resolution cache.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Konstantin Vyatkin <tino@vtkn.io>
