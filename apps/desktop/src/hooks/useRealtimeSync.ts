import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { push, pull } from '@/lib/sync';
import { subscribeToNotes } from '@/lib/realtime';
import { supabase } from '@noat/sync';
import { waitForDatabase } from '@/lib/database';
import { getTimestamp } from '@/lib/utils';
import { getCurrentWindow } from '@tauri-apps/api/window';

const PUSH_DEBOUNCE_MS = 300;
const MAX_PUSH_RETRIES = 3;
const MAX_SUBSCRIBE_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const SUPABASE_INIT_DELAY_MS = 500;

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
  onPullCompleted?: () => void;
}) {
  const { debounceMs = PUSH_DEBOUNCE_MS, onRemoteChange, onPullCompleted } = options ?? {};

  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPushingRef = useRef(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const pushRetryCountRef = useRef(0);
  const subscribeRetryCountRef = useRef(0);
  const subscribeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubscribedRef = useRef(false);

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

    try {
      await push();
      pushRetryCountRef.current = 0;
    } catch (error) {
      console.error(`[${getTimestamp()}] Push failed:`, error);

      if (pushRetryCountRef.current < MAX_PUSH_RETRIES) {
        pushRetryCountRef.current++;
        const delay = Math.min(
          RETRY_BASE_DELAY_MS * Math.pow(2, pushRetryCountRef.current),
          RETRY_MAX_DELAY_MS,
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

  // Store callbacks in refs to avoid recreating subscription when they change
  const onRemoteChangeRef = useRef(onRemoteChange);
  const onPullCompletedRef = useRef(onPullCompleted);
  useEffect(() => {
    onRemoteChangeRef.current = onRemoteChange;
    onPullCompletedRef.current = onPullCompleted;
  }, [onRemoteChange, onPullCompleted]);

  // Handle dirty note notifications - schedule push when local changes occur
  const handleNoteDirty = useCallback(
    (_noteId: string) => {
      schedulePush();
    },
    [schedulePush],
  );

  // Setup realtime subscription (stable, doesn't depend on callback)
  const setupRealtime = useCallback(async () => {
    const ready = await waitForDatabase();
    if (!ready) {
      console.error(
        `[${getTimestamp()}] setupRealtime: Database failed to initialize after timeout`,
      );
      return;
    }

    // Clear any pending retry
    if (subscribeRetryTimerRef.current) {
      clearTimeout(subscribeRetryTimerRef.current);
      subscribeRetryTimerRef.current = null;
    }

    // Cleanup existing subscription — removeChannel() tears down the underlying
    // WebSocket when no channels remain, ensuring a fresh connection on re-subscribe.
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    // Subscribe to realtime changes
    if (onRemoteChangeRef.current) {
      const channel = await subscribeToNotes(
        (noteId, event) => {
          onRemoteChangeRef.current?.(noteId, event);
        },
        (status) => {
          if (status === 'SUBSCRIBED') {
            subscribeRetryCountRef.current = 0;
            isSubscribedRef.current = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            isSubscribedRef.current = false;
            if (subscribeRetryCountRef.current < MAX_SUBSCRIBE_RETRIES) {
              subscribeRetryCountRef.current++;
              const delay = Math.min(
                RETRY_BASE_DELAY_MS * Math.pow(2, subscribeRetryCountRef.current),
                RETRY_MAX_DELAY_MS,
              );
              console.warn(
                `[${getTimestamp()}] Subscription ${status} — retrying in ${delay}ms (attempt ${subscribeRetryCountRef.current}/${MAX_SUBSCRIBE_RETRIES})`,
              );
              subscribeRetryTimerRef.current = setTimeout(() => {
                setupRealtime().catch(console.error);
              }, delay);
            } else {
              console.error(
                `[${getTimestamp()}] Subscription failed after ${MAX_SUBSCRIBE_RETRIES} retries`,
              );
            }
          }
        },
      );
      realtimeChannelRef.current = channel;
    }
  }, []); // No dependencies - stable function

  // Lifecycle
  useEffect(() => {
    // Small delay to ensure Supabase client is fully initialized
    const timer = setTimeout(() => {
      setupRealtime().catch((error) => {
        console.error(`[${getTimestamp()}] setupRealtime error:`, error);
      });

      // Initial push on mount
      triggerPush();
    }, SUPABASE_INIT_DELAY_MS);

    // On window focus: push/pull to reconcile, and only reconnect the
    // realtime subscription if it's in a failed state. Desktop windows
    // lose/gain focus frequently — tearing down a healthy WebSocket each
    // time causes unnecessary TIMED_OUT errors.
    const unlisten = getCurrentWindow().onFocusChanged(async ({ payload: focused }) => {
      if (!focused) return;

      if (!isSubscribedRef.current) {
        subscribeRetryCountRef.current = 0;
        setupRealtime().catch(console.error);
      }

      triggerPush();

      try {
        await pull();
        onPullCompletedRef.current?.();
      } catch (error) {
        console.error(`[${getTimestamp()}] Focus pull failed:`, error);
      }
    });

    return () => {
      clearTimeout(timer);
      unlisten.then((f) => f());
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
      if (subscribeRetryTimerRef.current) clearTimeout(subscribeRetryTimerRef.current);
      clearPushTimer();
    };
    // setupRealtime is stable (no deps), so it won't cause re-runs
  }, [triggerPush, clearPushTimer, setupRealtime]);

  return { handleNoteDirty };
}
