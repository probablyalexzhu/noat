import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import type { Colors } from '@/lib/theme';
import { makeMarkdownStyle } from '@/lib/markdownStyles';

type NotePageProps = {
  noteId: string;
  content: string;
  onChangeText: (noteId: string, text: string) => void;
  registerInputRef: (noteId: string, ref: TextInput | null) => void;
  width: number;
  colors: Colors;
  contentPaddingTop: number;
  contentPaddingBottom: number;
  isKeyboardVisible: boolean;
};

/**
 * Keyboard interaction with the swipe-based FlatList:
 *
 * - `pointerEvents="none"` on the TextInput when keyboard is closed prevents
 *   swipe touches from inadvertently focusing the input and opening the keyboard.
 * - The Pressable wrapper (disabled when keyboard is open) catches intentional
 *   taps and calls `.focus()`, giving the user a clear way to start typing.
 * - When the keyboard is already open, Pressable disables itself so touches
 *   pass through directly to the TextInput for normal cursor positioning.
 *
 * See hooks/useKeyboardNavigation.ts for the full keyboard/swipe model.
 */
function NotePage({
  noteId,
  content: externalContent,
  onChangeText,
  registerInputRef,
  width,
  colors,
  contentPaddingTop,
  contentPaddingBottom,
  isKeyboardVisible,
}: NotePageProps) {
  const [content, setContent] = useState(externalContent);
  const markdownStyle = makeMarkdownStyle(colors);
  const localInputRef = useRef<TextInput | null>(null);

  // Sync internal state when external content changes (e.g., remote updates)
  useEffect(() => {
    setContent(externalContent);
  }, [externalContent]);

  const inputRefCallback = useCallback(
    (ref: TextInput | null) => {
      localInputRef.current = ref;
      registerInputRef(noteId, ref);
    },
    [registerInputRef, noteId],
  );

  const handleChange = (text: string) => {
    setContent(text);
    onChangeText(noteId, text);
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          width,
          paddingTop: contentPaddingTop,
          paddingBottom: contentPaddingBottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      <Pressable
        style={styles.pressableWrapper}
        onPress={() => localInputRef.current?.focus()}
        disabled={isKeyboardVisible}
      >
        <MarkdownTextInput
          ref={inputRefCallback}
          style={[styles.editor, { color: colors.text }]}
          markdownStyle={markdownStyle}
          parser={parseExpensiMark}
          multiline
          scrollEnabled={false}
          value={content}
          onChangeText={handleChange}
          placeholder="Noat to self..."
          placeholderTextColor={colors.placeholder}
          textAlignVertical="top"
          autoCorrect={true}
          spellCheck={false}
          pointerEvents={isKeyboardVisible ? 'auto' : 'none'}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  pressableWrapper: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontSize: 16,
    padding: 16,
    textAlignVertical: 'top',
  },
});

export default React.memo(NotePage);
