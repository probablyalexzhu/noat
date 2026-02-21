import { useCallback, useEffect, useRef } from 'react';
import { updateNoteContent } from '@/lib/database';

const AUTOSAVE_DELAY_MS = 300;

/**
 * Debounced autosave with background flush.
 *
 * Every keystroke updates `latestContents` immediately and resets a per-note
 * debounce timer. When the timer fires (after AUTOSAVE_DELAY_MS of inactivity),
 * the note is persisted to the database.
 *
 * When the tab/window is hidden, all pending timers are cancelled and
 * their latest contents are flushed to the database synchronously so no typing
 * is lost. The same flush runs on unmount.
 *
 * `contentCache` and `latestContents` are exposed as refs because the parent
 * component reads/writes them during init, add, and delete operations.
 *
 * @param options.onNoteDirty - Optional callback invoked after note is saved to DB
 */
export function useAutosave(options?: { onNoteDirty?: (noteId: string) => void }) {
  const { onNoteDirty } = options ?? {};
  const contentCache = useRef(new Map<string, string>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latestContents = useRef(new Map<string, string>());

  const handleChangeText = useCallback(
    (noteId: string, text: string) => {
      contentCache.current.set(noteId, text);
      latestContents.current.set(noteId, text);

      const existing = saveTimers.current.get(noteId);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        updateNoteContent(noteId, text);
        saveTimers.current.delete(noteId);
        onNoteDirty?.(noteId); // Notify
      }, AUTOSAVE_DELAY_MS);

      saveTimers.current.set(noteId, timer);
    },
    [onNoteDirty],
  );

  const flushNote = useCallback(
    (noteId: string) => {
      const timer = saveTimers.current.get(noteId);
      if (timer) {
        clearTimeout(timer);
        saveTimers.current.delete(noteId);
        const text = latestContents.current.get(noteId);
        if (text !== undefined) {
          updateNoteContent(noteId, text);
          onNoteDirty?.(noteId); // Notify
        }
      }
    },
    [onNoteDirty],
  );

  useEffect(() => {
    const flushAllPendingSaves = () => {
      for (const [noteId, timer] of saveTimers.current.entries()) {
        clearTimeout(timer);
        const text = latestContents.current.get(noteId);
        if (text !== undefined) {
          updateNoteContent(noteId, text);
          onNoteDirty?.(noteId); // Notify
        }
      }
      saveTimers.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushAllPendingSaves();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushAllPendingSaves();
    };
  }, [onNoteDirty]);

  return { contentCache, latestContents, handleChangeText, flushNote };
}
