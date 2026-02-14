import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { updateNoteContent } from '@/lib/data/database';

const AUTOSAVE_DELAY_MS = 300;

/**
 * Debounced autosave with background flush.
 *
 * Every keystroke updates `latestContents` immediately and resets a per-note
 * debounce timer. When the timer fires (after AUTOSAVE_DELAY_MS of inactivity),
 * the note is persisted to the database.
 *
 * When the app moves to the background, all pending timers are cancelled and
 * their latest contents are flushed to the database synchronously so no typing
 * is lost. The same flush runs on unmount.
 *
 * `contentCache` and `latestContents` are exposed as refs because the parent
 * component reads/writes them during init, add, and delete operations.
 */
export function useAutosave() {
  const contentCache = useRef(new Map<string, string>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latestContents = useRef(new Map<string, string>());

  const handleChangeText = useCallback((noteId: string, text: string) => {
    contentCache.current.set(noteId, text);
    latestContents.current.set(noteId, text);

    const existing = saveTimers.current.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      updateNoteContent(noteId, text);
      saveTimers.current.delete(noteId);
    }, AUTOSAVE_DELAY_MS);

    saveTimers.current.set(noteId, timer);
  }, []);

  const flushNote = useCallback((noteId: string) => {
    const timer = saveTimers.current.get(noteId);
    if (timer) {
      clearTimeout(timer);
      saveTimers.current.delete(noteId);
      const text = latestContents.current.get(noteId);
      if (text !== undefined) {
        updateNoteContent(noteId, text);
      }
    }
  }, []);

  useEffect(() => {
    const flushAllPendingSaves = () => {
      for (const [noteId, timer] of saveTimers.current.entries()) {
        clearTimeout(timer);
        const text = latestContents.current.get(noteId);
        if (text !== undefined) {
          updateNoteContent(noteId, text);
        }
      }
      saveTimers.current.clear();
    };

    const handleAppStateChange = (state: string) => {
      if (state === 'background') {
        flushAllPendingSaves();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      flushAllPendingSaves();
    };
  }, []);

  return { contentCache, latestContents, handleChangeText, flushNote };
}
