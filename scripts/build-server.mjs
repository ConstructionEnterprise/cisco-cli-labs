import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

// The server is a single entry point with only Node and external package imports.
// Transforming it avoids filesystem traversal during bundle resolution on Windows.
const source = new URL('../server/index.ts', import.meta.url);
const output = new URL('../dist/index.js', import.meta.url);
const contents = await readFile(source, 'utf8');
if (/\bfrom\s*['"]\./.test(contents) || /\bimport\s*\(?\s*['"]\./.test(contents)) {
  throw new Error('The server now has local imports; update this build to bundle them before shipping.');
}
const result = await transform(contents, { loader: 'ts', format: 'esm', platform: 'node', target: 'node20', sourcefile: fileURLToPath(source) });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(output, result.code);
console.log('Server entry built: dist/index.js');
