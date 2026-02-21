import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { push } from '@/lib/sync';
import { subscribeToNotes } from '@/lib/realtime';
import { db } from '@/lib/database';

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
 * - On app load: initial push + realtime subscribe
 */
export function useRealtimeSync(options?: {
  debounceMs?: number;
  onRemoteChange?: (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onNoteDirty?: (noteId: string) => void;
}) {
  const { debounceMs = PUSH_DEBOUNCE_MS, onRemoteChange } = options ?? {};

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
  const setupRealtime = useCallback(async () => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(`[${time}] setupRealtime: Starting subscription setup`);

    // Wait for database to be initialized (max 5 seconds)
    let attempts = 0;
    while (!db || attempts > 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!db) {
      console.error(`[${time}] setupRealtime: Database failed to initialize after timeout`);
      return;
    }

    console.log(`[${time}] setupRealtime: Database is ready, proceeding with subscription`);

    // Cleanup existing subscription
    if (realtimeChannelRef.current) {
      console.log(`[${time}] setupRealtime: Unsubscribing from existing channel`);
      realtimeChannelRef.current.unsubscribe();
      realtimeChannelRef.current = null;
    }

    // Subscribe to realtime changes
    if (onRemoteChangeRef.current) {
      console.log(`[${time}] setupRealtime: Subscribing to notes`);
      const channel = await subscribeToNotes(
        (noteId, event) => {
          // Use ref to always call latest callback without recreating subscription
          console.log(
            `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] setupRealtime: Callback wrapper called with noteId=${noteId}, event=${event}`,
          );
          onRemoteChangeRef.current?.(noteId, event);
        },
        (status) => {
          const msg = `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] Subscription status: ${status}`;
          console.log(msg);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`${msg} - will retry on next app reload`);
          }
        },
      );
      console.log(`[${time}] setupRealtime: Subscription established`);
      realtimeChannelRef.current = channel;
    } else {
      console.warn(`[${time}] setupRealtime: onRemoteChangeRef is null!`);
    }
  }, []); // No dependencies - stable function

  // Lifecycle
  useEffect(() => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log(`[${time}] useRealtimeSync: useEffect running, setting up realtime sync`);

    // Setup realtime subscription (only once on mount)
    setupRealtime().catch((error) => {
      console.error(
        `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] setupRealtime error:`,
        error,
      );
    });

    // Initial push on mount
    triggerPush();

    // Cleanup
    return () => {
      console.log(
        `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] useRealtimeSync: Cleanup, unsubscribing`,
      );
      if (realtimeChannelRef.current) realtimeChannelRef.current.unsubscribe();
      clearPushTimer();
    };
    // setupRealtime is stable (no deps), so it won't cause re-runs
  }, [triggerPush, clearPushTimer, setupRealtime]);

  return { handleNoteDirty };
}
