// Example tests for ProgressProvider (design C15, D64, D65; Requirements 12.1, 12.11, 13.1–13.7, 18.8).
// These tests are evidence for the cases listed, not a proof of correctness.
import { act, fireEvent, render, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { validateManifest, type Manifest } from '@dreame/schema';
import { checkAction, createAttempt, createRuntime, reduce, type Action, type AttemptState } from '@dreame/runtime';
import type { StorageBackend } from '@dreame/storage';
import { practiceProfile } from '../src/profile.ts';
import {
  PROGRESS_FILE_NAME,
  PROGRESS_KEY_NAME,
  buildProgressFile,
  type ItemRecord,
  type ProgressStore,
} from '../src/progress.ts';
import { ProgressProvider, useProgress, type ProgressApi } from '../src/app/ProgressProvider.tsx';
import { SaveStatus } from '../src/app/SaveStatus.tsx';
import {
  CLEAR_QUESTION_TEXT,
  IMPORT_INVALID_TEXT,
  IMPORT_TOO_LARGE_TEXT,
  ProgressControls,
} from '../src/app/ProgressControls.tsx';
import { SAVED_TEXT, notSavedText, readFailedText } from '../src/app/save-status-text.ts';

const ACTIVITY = 'practice-progress-test';

function recallConfig(itemId: string) {
  return {
    itemId,
    prompt: `Question ${itemId}`,
    options: [
      { id: 'a', label: 'Right' },
      { id: 'b', label: 'Wrong' },
    ],
    correctOptionId: 'a',
    explanation: 'Option a is right.',
    maxRetries: 1,
  };
}

const LESSON = {
  schemaVersion: 1,
  profile: 'practice-path',
  activityId: ACTIVITY,
  version: 1,
  requires: { recall: 1, reviewQueue: 1, masterySummary: 1 },
  entryNodeId: 'r1',
  fallbackOutcomeId: 'ms',
  limits: { maxNodes: 10, maxTransitions: 10 },
  variables: [],
  nodes: [
    { id: 'r1', type: 'recall', config: recallConfig('q1'), edges: [{ to: 'r2' }] },
    { id: 'r2', type: 'recall', config: recallConfig('q2'), edges: [{ to: 'rq' }] },
    { id: 'rq', type: 'reviewQueue', config: { title: 'Review', from: ['r1', 'r2'] }, edges: [{ to: 'ms' }] },
    { id: 'ms', type: 'masterySummary', config: { title: 'Your results', body: 'Done.', from: 'rq' }, edges: [] },
  ],
  theme: 'default',
};

/** The validated lesson and an attempt that answered q1 and q2. */
function lessonAttempt(): { manifest: Manifest; attempt: AttemptState } {
  const result = validateManifest(LESSON, practiceProfile);
  if (!result.ok) throw new Error('the in-test lesson does not pass validation');
  const rt = createRuntime(practiceProfile, result.manifest);
  let s = createAttempt(rt, 7, { now: 1000 });
  [{ tries: ['a'] }, { tries: ['b', 'a'] }].forEach((response, i) => {
    const action: Action = { type: 'respond', nodeId: s.currentNodeId, response };
    expect(checkAction(rt, s, action)).toBeNull();
    s = reduce(rt, s, action, { now: 2000 + i * 1000 });
  });
  return { manifest: result.manifest, attempt: s };
}

/** In-memory Storage_Backend; `quota` makes every write throw a QuotaExceededError. */
class MemoryBackend implements StorageBackend {
  readonly map = new Map<string, string>();
  quota = false;
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.quota) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const REC: ItemRecord = { seen: 1, firstTryMisses: 1, last: 'missed', lastSeenAt: 500 };
const KEY_A = `${ACTIVITY}:a1`;
const KEY_B = `${ACTIVITY}:b1`;

function envelope(v: number, data: unknown): string {
  return JSON.stringify({ v, data });
}

function backendWith(text?: string): MemoryBackend {
  const backend = new MemoryBackend();
  if (text !== undefined) backend.map.set(PROGRESS_KEY_NAME, text);
  return backend;
}

let current: ProgressApi | null = null;
function Probe(): null {
  current = useProgress();
  return null;
}
function api(): ProgressApi {
  if (current === null) throw new Error('the probe has not rendered');
  return current;
}

function mount(backend: StorageBackend | null): Mock<(fileName: string, text: string) => void> {
  const download = vi.fn<(fileName: string, text: string) => void>();
  current = null;
  render(
    <ProgressProvider backend={backend} download={download}>
      <Probe />
    </ProgressProvider>,
  );
  return download;
}

function storedData(backend: MemoryBackend): unknown {
  const text = backend.map.get(PROGRESS_KEY_NAME);
  if (text === undefined) throw new Error('nothing is stored');
  const parsed = JSON.parse(text) as { v: unknown; data: unknown };
  expect(parsed.v).toBe(1);
  return parsed.data;
}

function progressFile(store: ProgressStore): File {
  return new File([buildProgressFile(store)], PROGRESS_FILE_NAME, { type: 'application/json' });
}

describe('ProgressProvider start read', () => {
  it('starts empty and idle when nothing is stored', () => {
    mount(backendWith());
    expect(api().store).toEqual({});
    expect(api().status).toEqual({ kind: 'idle' });
    expect(api().backendAvailable).toBe(true);
  });

  it('loads a valid stored value', () => {
    mount(backendWith(envelope(1, { [KEY_A]: REC })));
    expect(api().store).toEqual({ [KEY_A]: REC });
    expect(api().status).toEqual({ kind: 'idle' });
  });

  it('reports read-failed with corrupt for a damaged value', () => {
    mount(backendWith('{not json'));
    expect(api().store).toEqual({});
    expect(api().status).toEqual({ kind: 'read-failed', error: 'corrupt' });
  });

  it('reports read-failed with version for another version', () => {
    mount(backendWith(envelope(2, {})));
    expect(api().store).toEqual({});
    expect(api().status).toEqual({ kind: 'read-failed', error: 'version' });
  });

  it('gives backendAvailable false for a null backend', () => {
    mount(null);
    expect(api().backendAvailable).toBe(false);
    expect(api().store).toEqual({});
  });
});

describe('ProgressProvider save', () => {
  it('recordAttempt writes the key with v: 1 and sets saved', () => {
    const backend = backendWith();
    mount(backend);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    const data = storedData(backend) as Record<string, unknown>;
    expect(Object.keys(data)).toEqual([`${ACTIVITY}:q1`, `${ACTIVITY}:q2`]);
    expect(api().store).toEqual(data);
    expect(api().status).toEqual({ kind: 'saved' });
  });

  it('a quota error sets not-saved with quota', () => {
    const backend = backendWith();
    backend.quota = true;
    mount(backend);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    expect(backend.map.has(PROGRESS_KEY_NAME)).toBe(false);
    expect(api().status).toEqual({ kind: 'not-saved', error: 'quota' });
    expect(Object.keys(api().store)).toHaveLength(2);
  });

  it('a successful save after read-failed replaces the stored text', () => {
    const backend = backendWith('{not json');
    mount(backend);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    expect(Object.keys(storedData(backend) as object)).toHaveLength(2);
    expect(api().status).toEqual({ kind: 'saved' });
  });
});

describe('ProgressProvider export and import', () => {
  it('exports with a null backend through the download recorder', () => {
    const download = mount(null);
    act(() => api().exportFile());
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(PROGRESS_FILE_NAME, buildProgressFile({}));
  });

  it('refuses a 65,537-byte file as too-large without reading its text', async () => {
    mount(backendWith());
    const file = new File(['x'.repeat(65_537)], PROGRESS_FILE_NAME);
    const text = vi.spyOn(file, 'text');
    let outcome: unknown;
    await act(async () => {
      outcome = await api().importFile(file);
    });
    expect(outcome).toEqual({ kind: 'too-large' });
    expect(text).not.toHaveBeenCalled();
  });

  it('gives invalid for a non-JSON file', async () => {
    const backend = backendWith();
    mount(backend);
    let outcome: unknown;
    await act(async () => {
      outcome = await api().importFile(new File(['not json'], PROGRESS_FILE_NAME));
    });
    expect(outcome).toEqual({ kind: 'invalid' });
    expect(backend.map.has(PROGRESS_KEY_NAME)).toBe(false);
  });

  it('merges a valid file and saves the result', async () => {
    const backend = backendWith(envelope(1, { [KEY_A]: REC }));
    mount(backend);
    const incoming = { [KEY_B]: { ...REC, lastSeenAt: 900 } };
    let outcome: unknown;
    await act(async () => {
      outcome = await api().importFile(progressFile(incoming));
    });
    expect(outcome).toEqual({ kind: 'loaded', count: 1 });
    expect(api().store).toEqual({ [KEY_A]: REC, ...incoming });
    expect(storedData(backend)).toEqual({ [KEY_A]: REC, ...incoming });
    expect(api().status).toEqual({ kind: 'saved' });
  });
});

describe('ProgressProvider clear', () => {
  it('removes the key and empties the store', () => {
    const backend = backendWith(envelope(1, { [KEY_A]: REC }));
    mount(backend);
    expect(api().store).toEqual({ [KEY_A]: REC });
    act(() => api().clear());
    expect(backend.map.has(PROGRESS_KEY_NAME)).toBe(false);
    expect(api().store).toEqual({});
  });
});

/** Mounts the provider with the probe and `ui`; queries are scoped to this render. */
function mountUi(backend: StorageBackend | null, ui: ReactNode) {
  const download = vi.fn<(fileName: string, text: string) => void>();
  current = null;
  const { container } = render(
    <ProgressProvider backend={backend} download={download}>
      <Probe />
      {ui}
    </ProgressProvider>,
  );
  return { download, view: within(container) };
}

describe('SaveStatus', () => {
  it('renders nothing while idle', () => {
    const { view } = mountUi(backendWith(), <SaveStatus />);
    expect(view.queryByRole('status')).toBeNull();
  });

  it('shows the saved text after a save', () => {
    const { view } = mountUi(backendWith(), <SaveStatus />);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    const status = view.getByRole('status');
    expect(status.className).toBe('pp-save-status');
    expect(status.textContent).toBe(SAVED_TEXT);
    expect(view.queryByRole('button')).toBeNull();
  });

  it('shows not-saved with quota and an Export button that downloads', () => {
    const backend = backendWith();
    backend.quota = true;
    const { view, download } = mountUi(backend, <SaveStatus />);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    expect(view.getByRole('status').textContent).toBe(`${notSavedText('quota')} Export progress`);
    fireEvent.click(view.getByRole('button', { name: 'Export progress' }));
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('shows not-saved with unavailable for a null backend', () => {
    const { view } = mountUi(null, <SaveStatus />);
    const { manifest, attempt } = lessonAttempt();
    act(() => api().recordAttempt(manifest, attempt));
    expect(view.getByRole('status').textContent).toBe(`${notSavedText('unavailable')} Export progress`);
    expect(view.getByRole('button', { name: 'Export progress' })).toBeTruthy();
  });

  // `not-saved` with too-large is not reachable here: progress.ts trims the store to 64 KB before each write.

  it.each(['corrupt', 'version'] as const)('shows read-failed with %s and no button', (error) => {
    const text = error === 'corrupt' ? '{not json' : envelope(2, {});
    const { view } = mountUi(backendWith(text), <SaveStatus />);
    expect(view.getByRole('status').textContent).toBe(readFailedText(error));
    expect(view.queryByRole('button')).toBeNull();
  });
});

describe('ProgressControls', () => {
  it('export calls the download recorder', () => {
    const { view, download } = mountUi(backendWith(envelope(1, { [KEY_A]: REC })), <ProgressControls />);
    fireEvent.click(view.getByRole('button', { name: 'Export progress' }));
    expect(download).toHaveBeenCalledWith(PROGRESS_FILE_NAME, buildProgressFile({ [KEY_A]: REC }));
  });

  it('has a labelled file input that accepts JSON', () => {
    const { view } = mountUi(backendWith(), <ProgressControls />);
    const input = view.getByLabelText('Import progress') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('application/json,.json');
  });

  it.each([
    ['a file over 64 KB', () => new File(['x'.repeat(65_537)], PROGRESS_FILE_NAME), IMPORT_TOO_LARGE_TEXT],
    ['a non-JSON file', () => new File(['not json'], PROGRESS_FILE_NAME), IMPORT_INVALID_TEXT],
    ['a valid file', () => progressFile({ [KEY_A]: REC, [KEY_B]: REC }), 'Progress loaded: 2 questions.'],
  ])('shows the import message for %s', async (_name, makeFile, message) => {
    const { view } = mountUi(backendWith(), <ProgressControls />);
    fireEvent.change(view.getByLabelText('Import progress'), { target: { files: [makeFile()] } });
    const status = await view.findByText(message);
    expect(status.getAttribute('role')).toBe('status');
  });

  it('Cancel closes the confirm group and keeps the store', () => {
    const backend = backendWith(envelope(1, { [KEY_A]: REC }));
    const { view } = mountUi(backend, <ProgressControls />);
    fireEvent.click(view.getByRole('button', { name: 'Clear progress' }));
    expect(view.getByRole('group', { name: CLEAR_QUESTION_TEXT })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: 'Cancel' }));
    expect(view.queryByRole('group')).toBeNull();
    expect(backend.map.has(PROGRESS_KEY_NAME)).toBe(true);
    expect(api().store).toEqual({ [KEY_A]: REC });
  });

  it('"Yes, clear" removes the key and empties the store', () => {
    const backend = backendWith(envelope(1, { [KEY_A]: REC }));
    const { view } = mountUi(backend, <ProgressControls />);
    fireEvent.click(view.getByRole('button', { name: 'Clear progress' }));
    fireEvent.click(view.getByRole('button', { name: 'Yes, clear' }));
    expect(backend.map.has(PROGRESS_KEY_NAME)).toBe(false);
    expect(api().store).toEqual({});
    expect(view.getByRole('button', { name: 'Clear progress' })).toBeTruthy();
  });
});
