// Mechanical adaptation: Workers requires a statically imported WASM module.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const source = readFileSync(new URL('./node_modules/dji-log-parser-js/dji_log_parser_js.mjs', import.meta.url), 'utf8');
const match = source.match(/const bytes = __toBinary\("([A-Za-z0-9+/=]+)"\);/);
if (!match) throw new Error('Unexpected decoder package format');
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/decoder.wasm', import.meta.url), Buffer.from(match[1], 'base64'));
writeFileSync(new URL('./dist/decoder.mjs', import.meta.url), 'import wasmModule from "./decoder.wasm";\n' + source.replace(match[0], '').replace('const wasmModule = new WebAssembly.Module(bytes);', ''));
