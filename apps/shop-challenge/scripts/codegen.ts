// Build-time codegen for the `shop-challenge` profile validators (Requirement 4, design C3). Runs
// under `node --experimental-strip-types`. No try/catch: any thrown error exits non-zero (Req 4.7).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildProfileModule } from '@dreame/schema/codegen';
import { shopNodeTypes } from '../src/node-types/index.ts';

const generatedDir = fileURLToPath(new URL('../generated/', import.meta.url));
const jsPath = fileURLToPath(new URL('../generated/shop-challenge.validators.js', import.meta.url));
const dtsPath = fileURLToPath(new URL('../generated/shop-challenge.validators.d.ts', import.meta.url));

const { js, dts } = buildProfileModule('shop-challenge', shopNodeTypes);

const toLf = (text: string): string => text.replace(/\r\n/g, '\n');
const jsText = toLf(js);

mkdirSync(generatedDir, { recursive: true });
writeFileSync(jsPath, jsText, 'utf8');
writeFileSync(dtsPath, toLf(dts), 'utf8');

const jsBytes = Buffer.from(jsText, 'utf8');
const gzipBytes = gzipSync(jsBytes).length;

console.log(`codegen: wrote ${jsPath} and ${dtsPath} (${jsBytes.length} bytes JS, ${gzipBytes} bytes gzip)`);
