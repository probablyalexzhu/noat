import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { push } from '@/lib/data/sync';
import { subscribeToNotes } from '@/lib/data/realtime';

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Realtime cloud sync with Supabase postgres_changes.
 *
 * ARCHITECTURE:
 * - Pull (remote → local): Realtime postgres_changes subscription (<100ms latency)
 * - Push (local → remote): Event-driven + debounce (1.5s latency, efficient batching)
 *
 * HOW IT WORKS:
 * - Subscribes to postgres_changes for current user's notes on mount
 * - Receives INSERT/UPDATE/DELETE events in <100ms when remote changes happen
 * - Calls onRemoteChange callback with noteId and event type
 * - Uses event-driven notifications (via onNoteDirty callback) to detect local changes
 * - Debounces push to 1.5 seconds after last local save
 *
 * COORDINATION WITH useAutosave:
 * - useAutosave debounces local SQLite saves at 300ms
 * - useAutosave calls onNoteDirty callback after each save
 * - This hook waits 1.5 seconds AFTER receiving notification before push
 * - Total delay: ~300ms (autosave) + 1500ms (push debounce) = 1.8s after last keystroke
 *
 * SAFETY TRIGGERS:
 * - On app background: immediate push (mirrors useAutosave flush behavior)
 * - On app foreground: reconnect realtime subscription + immediate push
 * - On mount: initial push + realtime subscribe
 */
export function useRealtimeSync(options?: {
  debounceMs?: number;
  onRemoteChange?: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onNoteDirty?: (noteId: string) => void;
}) {
  const { debounceMs = PUSH_DEBOUNCE_MS, onRemoteChange, onNoteDirty } = options ?? {};

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPushingRef = useRef(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const pushRetryCountRef = useRef(0);
  const maxRetries = 3;

  // Clear push timer
  const clearPushTimer = useCallback(() => {
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
      pushRetryCountRef.current = 0; // Reset on success
      console.log(`[${getTime()}] Push complete ✓`);
    } catch (error) {
      console.error(`[${getTime()}] Push failed:`, error);

      if (pushRetryCountRef.current < maxRetries) {
        pushRetryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, pushRetryCountRef.current), 30000);
        console.log(
          `Retrying push in ${delay}ms (attempt ${pushRetryCountRef.current}/${maxRetries})`,
        );

        setTimeout(() => {
          triggerPush();
        }, delay);
      } else {
        console.error('Push failed after max retries, will retry on next change');
        pushRetryCountRef.current = 0;
      }
    } finally {
      isPushingRef.current = false;
    }
  }, []);

  // Schedule push after debounce delay
  const schedulePush = useCallback(() => {
    clearPushTimer();
    pushTimerRef.current = setTimeout(() => {
      triggerPush();
    }, debounceMs);
  }, [debounceMs, clearPushTimer, triggerPush]);

  // Store callback in ref to avoid recreating subscription when callback changes
  const onRemoteChangeRef = useRef(onRemoteChange);
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
  }, [onRemoteChange]);

  // Handle dirty note notifications - schedule push when local changes occur
  const handleNoteDirty = useCallback(
    (_noteId: string) => {
      schedulePush();
    },
    [schedulePush],
  );

  // Setup realtime subscription (stable, doesn't depend on callback)
  const setupRealtime = useCallback(() => {
    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    // Subscribe to realtime changes
    if (onRemoteChangeRef.current) {
      const channel = subscribeToNotes(
        (noteId, event) => {
          // Use ref to always call latest callback without recreating subscription
          onRemoteChangeRef.current?.(noteId, event);
        },
        (status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`Subscription ${status}, will retry on next app foreground`);
          }
        },
      );
      realtimeChannelRef.current = channel;
    }
  }, []); // No dependencies - stable function

  // Lifecycle
  useEffect(() => {
    // Setup realtime subscription (only once on mount)
    setupRealtime();

    // Listen for app state changes
    const handleAppStateChange = (state: string) => {
      if (state === 'background') {
        // Push immediately before backgrounding
        clearPushTimer();
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
      if (realtimeChannelRef.current) realtimeChannelRef.current.unsubscribe();
      clearPushTimer();
      sub.remove();
    };
    // setupRealtime is stable (no deps), so it won't cause re-runs
  }, [triggerPush, clearPushTimer, setupRealtime]);

  return { handleNoteDirty };
}
