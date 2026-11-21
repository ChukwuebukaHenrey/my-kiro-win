/**
 * Real-file-system half of `CliIo` (Requirements 4.5, 4.6, 17.2, design C13 H1).
 *
 * Shared by `src/cli.ts` and `src/hook-cli.ts`; each entry adds its own `out` and `err`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import type { CliIo } from './run.ts';

export const nodeIo: Pick<CliIo, 'readFile' | 'listFiles'> = {
  readFile(path: string): Uint8Array | null {
    try {
      return readFileSync(path);
    } catch {
      return null;
    }
  },
  listFiles(dir: string): string[] | null {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);
    } catch {
      return null;
    }
  },
};
