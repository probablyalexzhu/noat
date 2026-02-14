import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { db } from '@/lib/data/database';
import { push, pull } from '@/lib/data/sync';

/**
 * Debounced cloud sync with polling-based trigger.
 *
 * HOW IT WORKS:
 * - Polls database every 500ms for dirty notes (is_synced = 0)
 * - When dirty notes detected, resets a global 3-second debounce timer
 * - Timer fires after 3 seconds of no new changes → sync all dirty notes
 * - Batches multiple notes efficiently if user edits several in succession
 *
 * COORDINATION WITH useAutosave:
 * - useAutosave debounces local SQLite saves at 300ms
 * - This hook waits 3 seconds AFTER SQLite save completes
 * - Total delay: ~300ms (autosave) + 3000ms (cloud sync) = 3.3s after last keystroke
 *
 * SAFETY TRIGGERS:
 * - On app background: immediate sync (mirrors useAutosave flush behavior)
 * - On app foreground: immediate sync to pull latest remote changes
 * - On mount: initial sync when hook first loads
 *
 * ERROR HANDLING:
 * - Retries with exponential backoff: 5s, 10s, 20s (max 3 attempts)
 * - Concurrent syncs prevented by isSyncingRef flag
 * - Errors logged to console for debugging
 */
export function useCloudSync(options?: { debounceMs?: number; pollIntervalMs?: number }) {
  const debounceMs = options?.debounceMs ?? 3000;
  const pollIntervalMs = options?.pollIntervalMs ?? 500;

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDirtyCountRef = useRef(0);
  const retryCountRef = useRef(0);

  // Clear debounce timer
  const clearDebounceTimer = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  // Main sync function with retry logic
  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
      await push();
      await pull();
      retryCountRef.current = 0;
      console.log(`[${getTime()}] Cloud sync complete ✓`);
    } catch (error) {
      console.error(`[${getTime()}] Cloud sync failed:`, error);

      // Exponential backoff retry (max 3 attempts)
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const delay = 5000 * Math.pow(2, retryCountRef.current - 1); // 5s, 10s, 20s
        console.log(
          `[${getTime()}] Retrying in ${delay / 1000}s (attempt ${retryCountRef.current}/3)`,
        );
        setTimeout(() => triggerSync(), delay);
      } else {
        console.error(`[${getTime()}] Max retry attempts reached, giving up`);
        retryCountRef.current = 0;
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Reset debounce timer when dirty notes detected
  const resetDebounceTimer = useCallback(() => {
    clearDebounceTimer();
    syncTimerRef.current = setTimeout(() => {
      triggerSync();
    }, debounceMs);
  }, [debounceMs, clearDebounceTimer, triggerSync]);

  // Poll database for dirty notes
  const checkForDirtyNotes = useCallback(() => {
    try {
      const result: any = db.getFirstSync(
        'SELECT COUNT(*) as count FROM notes WHERE is_synced = 0',
      );
      const currentCount = result?.count ?? 0;

      // New dirty notes detected or count changed → reset timer
      if (currentCount > 0 && currentCount !== lastDirtyCountRef.current) {
        lastDirtyCountRef.current = currentCount;
        resetDebounceTimer();
      }
      // All notes synced → clear timer
      else if (currentCount === 0 && lastDirtyCountRef.current > 0) {
        lastDirtyCountRef.current = 0;
        clearDebounceTimer();
      }
    } catch (error) {
      console.error('Failed to check dirty notes:', error);
    }
  }, [resetDebounceTimer, clearDebounceTimer]);

  // Lifecycle
  useEffect(() => {
    // Start polling for dirty notes
    pollIntervalRef.current = setInterval(checkForDirtyNotes, pollIntervalMs);

    // Listen for app state changes
    const handleAppStateChange = (state: string) => {
      if (state === 'background') {
        // Clear pending debounce and sync immediately before backgrounding
        clearDebounceTimer();
        triggerSync();
      } else if (state === 'active') {
        // Sync on foreground to pull latest changes
        triggerSync();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Initial sync on mount
    triggerSync();

    // Cleanup
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      clearDebounceTimer();
      sub.remove();
    };
  }, [pollIntervalMs, checkForDirtyNotes, triggerSync, clearDebounceTimer]);

  // No return values yet (invisible sync)
  return {};
}
