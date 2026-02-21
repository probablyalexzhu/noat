/**
 * Keyboard / swipe interaction model
 *
 * THE PROBLEM
 * When the user swipes between notes with the keyboard open, React Native's
 * default behavior dismisses the keyboard (losing context) or, conversely,
 * opens it on every swipe even when it was closed (annoying).
 *
 * THE SOLUTION — three coordinated mechanisms:
 *
 * 1. Dual tracking (state + ref)
 *    `isKeyboardVisible` (state) drives UI rendering (dismiss button, pointerEvents).
 *    `isKeyboardVisibleRef` (ref) gives synchronous access inside scroll handlers
 *    that fire before the next React render.
 *
 * 2. Touch-start snapshot
 *    `handleTouchStart` captures whether the keyboard was open *before* the
 *    swipe began and stores it in `wasKeyboardOpenRef`. This lets the momentum-
 *    end handler distinguish "user swiped while typing" from "user swiped while
 *    reading".
 *
 * 3. Momentum-end decision
 *    `handleMomentumScrollEnd` fires after the FlatList settles on a new page.
 *    - If the keyboard was open when the swipe started → focus the new page's
 *      TextInput so the keyboard stays up seamlessly.
 *    - If the keyboard was closed → explicitly dismiss to prevent accidental
 *      focus from the page change.
 *
 * COORDINATION WITH NotePage
 * - `pointerEvents="none"` on the TextInput when the keyboard is closed
 *   prevents swipe touches from inadvertently focusing the input.
 * - A Pressable wrapper (disabled when keyboard is open) catches intentional
 *   taps and calls `.focus()`, giving the user a clear way to start typing.
 * - `keyboardDismissMode="none"` on both the FlatList and the per-page
 *   ScrollView ensures React Native never auto-dismisses on scroll.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  type KeyboardEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';

type Params = {
  width: number;
  activeIndex: number;
  noteIds: string[];
  onPageChange: (newIndex: number) => void;
  flushNote: (noteId: string) => void;
};

export function useKeyboardNavigation({
  width,
  activeIndex,
  noteIds,
  onPageChange,
  flushNote,
}: Params) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isKeyboardVisibleRef = useRef(false);
  const wasKeyboardOpenRef = useRef(false);
  const inputRefs = useRef(new Map<string, TextInput>());

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (_e: KeyboardEvent) => {
      isKeyboardVisibleRef.current = true;
      setIsKeyboardVisible(true);
    };

    const handleKeyboardHide = (_e: KeyboardEvent) => {
      isKeyboardVisibleRef.current = false;
      setIsKeyboardVisible(false);
    };

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const registerInputRef = useCallback((noteId: string, ref: TextInput | null) => {
    if (ref) {
      inputRefs.current.set(noteId, ref);
    } else {
      inputRefs.current.delete(noteId);
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    wasKeyboardOpenRef.current = isKeyboardVisibleRef.current;
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
      const pageChanged = newIndex !== activeIndex;

      if (pageChanged && noteIds[activeIndex]) {
        flushNote(noteIds[activeIndex]);
      }

      onPageChange(newIndex);

      if (pageChanged && wasKeyboardOpenRef.current) {
        inputRefs.current.get(noteIds[newIndex])?.focus();
      } else if (pageChanged) {
        Keyboard.dismiss();
      }
    },
    [width, activeIndex, noteIds, flushNote, onPageChange],
  );

  return {
    isKeyboardVisible,
    registerInputRef,
    handleTouchStart,
    handleMomentumScrollEnd,
  };
}
