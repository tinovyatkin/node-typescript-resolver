# node-typescript-resolver

Node.js loader to close the gap between built-in TypeScript support and TS imports resolution.

This package provides a fast and efficient TypeScript module resolver for Node.js that supports:

- ✨ **TypeScript file resolution** (.ts, .tsx, .mts, .cts)
- 🚀 **Extensionless imports** (import './module' resolves to './module.ts')
- 🎯 **tsconfig.json path aliases** (e.g., '@lib/*', '@utils')
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
# Using --loader flag (Node.js 18-20)
node --loader node-typescript-resolver/loader your-app.js

# Using --import flag (Node.js 20.6+)
node --import node-typescript-resolver/loader your-app.js
```

This allows you to write imports like:

```javascript
// Import without extension - resolves to helper.ts or helper.js
import { helper } from './helper';

// Import with TypeScript path alias (from tsconfig.json)
import { utils } from '@lib/utils';

// Standard imports still work
import { something } from './module.ts';
```

### Programmatic API

You can also use the resolver programmatically in your code:

```typescript
import { createResolver } from 'node-typescript-resolver';

// Create a resolver instance
const resolver = createResolver({
  cacheSize: 10000, // Optional: cache size (default: 10000)
  tsconfigPath: './tsconfig.json', // Optional: explicit tsconfig path
});

// Resolve a module
const resolved = resolver.resolve('./module', '/path/to/parent.ts');
console.log(resolved); // /path/to/module.ts

// Resolve with path alias
const aliasResolved = resolver.resolve('@lib/helper', '/path/to/parent.ts');
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
import { Button } from '@components/Button';
import { helper } from '@lib/helpers';
import { format } from '@utils';
```

## How It Works

1. **Resolution Strategy**: The resolver tries multiple strategies in order:
   - TypeScript path aliases (if configured)
   - oxc-resolver with TypeScript-aware extensions
   - Fallback to default Node.js resolution

2. **Extension Resolution**: When resolving imports, the resolver checks for these extensions in order:
   - `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.json`

3. **Caching**: All resolved paths are cached for performance. The cache uses a simple LRU strategy with a configurable size.

## Performance

This package is designed for high performance:

- Built on top of the fast [oxc-resolver](https://www.npmjs.com/package/oxc-resolver)
- Efficient LRU caching to avoid repeated filesystem lookups
- Minimal overhead in the resolution path

## Comparison with Similar Tools

| Feature | node-typescript-resolver | node-ts-resolver | extensionless |
|---------|-------------------------|------------------|---------------|
| TypeScript resolution | ✅ | ✅ | ❌ |
| Extensionless imports | ✅ | ❌ | ✅ |
| Path aliases | ✅ | ✅ | ❌ |
| Caching | ✅ | Limited | ❌ |
| Fast resolver | ✅ (oxc) | ❌ | ❌ |

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
- `cacheSize` (number, optional): Maximum number of entries in the resolution cache. Default: 10000
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
