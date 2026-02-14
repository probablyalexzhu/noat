import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { db } from '@/lib/data/database';
import { push } from '@/lib/data/sync';
import { subscribeToNotes } from '@/lib/data/realtime';

/**
 * Realtime cloud sync with Supabase postgres_changes.
 *
 * ARCHITECTURE:
 * - Pull (remote → local): Realtime postgres_changes subscription (<100ms latency)
 * - Push (local → remote): Polling + debounce (3s latency, efficient batching)
 *
 * HOW IT WORKS:
 * - Subscribes to postgres_changes for current user's notes on mount
 * - Receives INSERT/UPDATE/DELETE events in <100ms when remote changes happen
 * - Calls onRemoteChange callback with noteId and event type
 * - Still uses polling (500ms) to detect local dirty notes for push trigger
 * - Debounces push to 3 seconds after last local save
 *
 * COORDINATION WITH useAutosave:
 * - useAutosave debounces local SQLite saves at 300ms
 * - This hook waits 3 seconds AFTER SQLite save completes before push
 * - Total delay: ~300ms (autosave) + 3000ms (push debounce) = 3.3s after last keystroke
 *
 * SAFETY TRIGGERS:
 * - On app background: immediate push (mirrors useAutosave flush behavior)
 * - On app foreground: reconnect realtime subscription + immediate push
 * - On mount: initial push + realtime subscribe
 */
export function useRealtimeSync(options?: {
  debounceMs?: number;
  pollIntervalMs?: number;
  onRemoteChange?: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
}) {
  const { debounceMs = 3000, pollIntervalMs = 500, onRemoteChange } = options ?? {};

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPushingRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDirtyCountRef = useRef(0);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Clear push debounce timer
  const clearDebounceTimer = useCallback(() => {
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
  }, []);

  // Push local changes to Supabase
  const triggerPush = useCallback(async () => {
    if (isPushingRef.current) return;
    isPushingRef.current = true;

    const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false });

    try {
      await push();
      console.log(`[${getTime()}] Push complete ✓`);
    } catch (error) {
      console.error(`[${getTime()}] Push failed:`, error);
    } finally {
      isPushingRef.current = false;
    }
  }, []);

  // Reset push debounce timer when dirty notes detected
  const resetDebounceTimer = useCallback(() => {
    clearDebounceTimer();
    pushTimerRef.current = setTimeout(() => {
      triggerPush();
    }, debounceMs);
  }, [debounceMs, clearDebounceTimer, triggerPush]);

  // Poll database for dirty notes (push trigger only)
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

  // Store callback in ref to avoid recreating subscription when callback changes
  const onRemoteChangeRef = useRef(onRemoteChange);
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  // Setup realtime subscription (stable, doesn't depend on callback)
  const setupRealtime = useCallback(() => {
    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    // Subscribe to realtime changes
    if (onRemoteChangeRef.current) {
      const channel = subscribeToNotes((noteId, event) => {
        // Use ref to always call latest callback without recreating subscription
        onRemoteChangeRef.current?.(noteId, event);
      });
      realtimeChannelRef.current = channel;
    }
  }, []); // No dependencies - stable function

  // Lifecycle
  useEffect(() => {
    // Start polling for dirty notes (push trigger)
    pollIntervalRef.current = setInterval(checkForDirtyNotes, pollIntervalMs);

    // Setup realtime subscription (only once on mount)
    setupRealtime();

    // Listen for app state changes
    const handleAppStateChange = (state: string) => {
      if (state === 'background') {
        // Push immediately before backgrounding
        clearDebounceTimer();
        triggerPush();
      } else if (state === 'active') {
        // Reconnect realtime on foreground
        setupRealtime();
        triggerPush(); // Also push any pending changes
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    // Initial push on mount
    triggerPush();

    // Cleanup
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (realtimeChannelRef.current) realtimeChannelRef.current.unsubscribe();
      clearDebounceTimer();
      sub.remove();
    };
    // setupRealtime is stable (no deps), so it won't cause re-runs
  }, [pollIntervalMs, checkForDirtyNotes, triggerPush, clearDebounceTimer, setupRealtime]);

  return {};
}
