// Save_Status texts and Storage_Error reasons (design C15 "SaveStatus" tables,
// Requirements 18.9, 18.10, 18.21). Only ProgressProvider imports @dreame/storage,
// so the error names are listed here as plain strings.

export type StorageErrorName = 'unavailable' | 'quota' | 'too-large' | 'corrupt' | 'version';

export const SAVED_TEXT = 'Saved on this device — export to keep';

export const NOT_SAVED_PREFIX = 'Not saved on this device. ';

export const READ_FAILED_PREFIX =
  'Saved progress on this device could not be read. It will be replaced at the next save. ';

export const STORAGE_ERROR_REASONS: Readonly<Record<StorageErrorName, string>> = {
  unavailable:
    'This browser is not letting the app save, for example in a private window or with site data blocked.',
  quota: "This browser's storage for this site is full.",
  'too-large': 'The progress is larger than the 64 KB the app can save.',
  corrupt: 'The saved data is damaged or was not made by this app.',
  version: 'The saved data was made by another version of this app.',
};

/** Text for the `not-saved` status; the view adds the Export button after it. */
export function notSavedText(error: StorageErrorName): string {
  return NOT_SAVED_PREFIX + STORAGE_ERROR_REASONS[error];
}

/** Text for the `read-failed` status. */
export function readFailedText(error: 'corrupt' | 'version' | 'too-large'): string {
  return READ_FAILED_PREFIX + STORAGE_ERROR_REASONS[error];
}
