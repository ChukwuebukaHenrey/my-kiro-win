// Two small node type descriptors for codegen tests. Not a test file.

import Type from 'typebox';
import type { NodeTypeDescriptor } from '../../src/node-type.ts';

const closed = { additionalProperties: false } as const;

/** Non-terminal; its response `tag` has `maxLength: 3` to pin Decision D6 (UTF-16 code units). */
export const noteDescriptor: NodeTypeDescriptor = {
  type: 'note',
  version: 1,
  terminal: false,
  configSchema: Type.Object({ text: Type.String({ minLength: 1, maxLength: 2000 }) }, closed),
  responseSchema: Type.Object({ tag: Type.String({ maxLength: 3 }) }, closed),
  validate: () => [],
  answerType: () => null,
};

/** Terminal; empty closed response. */
export const endDescriptor: NodeTypeDescriptor = {
  type: 'end',
  version: 1,
  terminal: true,
  configSchema: Type.Object({ label: Type.String({ maxLength: 64 }) }, closed),
  responseSchema: Type.Object({}, closed),
  validate: () => [],
  answerType: () => null,
};

export const fixtureNodeTypes: readonly NodeTypeDescriptor[] = [noteDescriptor, endDescriptor];
