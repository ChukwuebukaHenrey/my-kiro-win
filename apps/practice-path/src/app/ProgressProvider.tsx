// ProgressProvider (design C15, D64, D65; Requirements 12.1, 12.11, 13.1–13.7, 18.8–18.10, 18.21).
// The only module that imports @dreame/storage: it reads the Progress_Store once at app start and
// writes it after each Attempt_End, import and clear. Views and node types never touch storage.

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AttemptState } from '@dreame/runtime';
import type { Manifest } from '@dreame/schema';
import {
  browserStorage,
  readJson,
  removeKey,
  writeJson,
  type Json,
  type StorageBackend,
  type StorageError,
} from '@dreame/storage';
import {
  PROGRESS_FILE_MAX,
  PROGRESS_FILE_NAME,
  PROGRESS_KEY_NAME,
  PROGRESS_VERSION,
  buildProgressFile,
  isProgressStore,
  mergeProgress,
  parseProgressFile,
  recordAttempt as recordAttemptInStore,
  type ProgressStore,
} from '../progress.ts';

export type SaveStatusValue =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'not-saved'; readonly error: StorageError }
  | { readonly kind: 'read-failed'; readonly error: 'corrupt' | 'version' | 'too-large' };

export type ImportOutcome =
  | { readonly kind: 'too-large' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'loaded'; readonly count: number };

export interface ProgressApi {
  readonly store: ProgressStore;
  /** false when the read at app start returned `unavailable`. */
  readonly backendAvailable: boolean;
  readonly status: SaveStatusValue;
  recordAttempt(manifest: Manifest, attempt: AttemptState): void;
  importFile(file: File): Promise<ImportOutcome>;
  exportFile(): void;
  clear(): void;
}

export interface ProgressProviderProps {
  readonly children: ReactNode;
  /** Defaults to browserStorage(); tests pass an in-memory backend or null. */
  readonly backend?: StorageBackend | null;
  /** Defaults to a Blob download; tests pass a recorder. */
  readonly download?: (fileName: string, text: string) => void;
}

interface StartState {
  readonly backend: StorageBackend | null;
  readonly backendAvailable: boolean;
  readonly store: ProgressStore;
  readonly status: SaveStatusValue;
}

interface ViewState {
  readonly store: ProgressStore;
  readonly status: SaveStatusValue;
}

const IDLE: SaveStatusValue = { kind: 'idle' };
const ProgressContext = createContext<ProgressApi | null>(null);

/** Reads the stored Progress_Store once (Requirements 12.11, 18.21). */
function start(backendProp: StorageBackend | null | undefined): StartState {
  const backend = backendProp === undefined ? browserStorage() : backendProp;
  const read = readJson(backend, PROGRESS_KEY_NAME, PROGRESS_VERSION, isProgressStore);
  if (read.ok) return { backend, backendAvailable: true, store: read.value ?? {}, status: IDLE };
  const error = read.error;
  if (error === 'corrupt' || error === 'version' || error === 'too-large') {
    return { backend, backendAvailable: true, store: {}, status: { kind: 'read-failed', error } };
  }
  return { backend, backendAvailable: false, store: {}, status: IDLE };
}

/** The store as a Json value with each Item_Record in its fixed field order. */
function storeJson(store: ProgressStore): Json {
  const out: Record<string, Json> = {};
  for (const key of Object.keys(store)) {
    const r = store[key];
    if (r === undefined) continue;
    Object.defineProperty(out, key, {
      value: { seen: r.seen, firstTryMisses: r.firstTryMisses, last: r.last, lastSeenAt: r.lastSeenAt },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** Default export download (D64): a Blob URL on a detached anchor; nothing is sent over the network. */
function blobDownload(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ProgressProvider(props: ProgressProviderProps): ReactNode {
  const [init] = useState<StartState>(() => start(props.backend));
  const [view, setView] = useState<ViewState>({ store: init.store, status: init.status });
  // The latest store, so an import that resolves later merges into the current value.
  const storeRef = useRef<ProgressStore>(init.store);
  const download = props.download ?? blobDownload;

  const api = useMemo<ProgressApi>(() => {
    const backend = init.backend;
    function save(next: ProgressStore): void {
      storeRef.current = next;
      const written = writeJson(backend, PROGRESS_KEY_NAME, PROGRESS_VERSION, storeJson(next));
      setView({ store: next, status: written.ok ? { kind: 'saved' } : { kind: 'not-saved', error: written.error } });
    }
    return {
      store: view.store,
      backendAvailable: init.backendAvailable,
      status: view.status,
      recordAttempt(manifest: Manifest, attempt: AttemptState): void {
        save(recordAttemptInStore(storeRef.current, manifest, attempt));
      },
      async importFile(file: File): Promise<ImportOutcome> {
        // The size check runs before any read of the file (Requirement 13.4).
        if (file.size > PROGRESS_FILE_MAX) return { kind: 'too-large' };
        let text: string;
        try {
          text = await file.text();
        } catch {
          return { kind: 'invalid' };
        }
        const items = parseProgressFile(text);
        if (items === null) return { kind: 'invalid' };
        save(mergeProgress(storeRef.current, items));
        return { kind: 'loaded', count: Object.keys(items).length };
      },
      exportFile(): void {
        download(PROGRESS_FILE_NAME, buildProgressFile(storeRef.current));
      },
      clear(): void {
        const removed = removeKey(backend, PROGRESS_KEY_NAME);
        storeRef.current = {};
        setView({ store: {}, status: removed.ok ? IDLE : { kind: 'not-saved', error: removed.error } });
      },
    };
  }, [init, view, download]);

  return <ProgressContext.Provider value={api}>{props.children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext);
  if (api === null) throw new Error('useProgress is used outside ProgressProvider');
  return api;
}
