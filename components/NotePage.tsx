import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import type { Colors } from '@/lib/theme';
import { makeMarkdownStyle } from '@/lib/markdownStyles';

type NotePageProps = {
  noteId: string;
  initialContent: string;
  onChangeText: (noteId: string, text: string) => void;
  registerInputRef: (noteId: string, ref: TextInput | null) => void;
  width: number;
  colors: Colors;
  contentPaddingTop: number;
  contentPaddingBottom: number;
  isKeyboardVisible: boolean;
};

function NotePage({
  noteId,
  initialContent,
  onChangeText,
  registerInputRef,
  width,
  colors,
  contentPaddingTop,
  contentPaddingBottom,
  isKeyboardVisible,
}: NotePageProps) {
  const [content, setContent] = useState(initialContent);
  const markdownStyle = makeMarkdownStyle(colors);
  const localInputRef = useRef<TextInput | null>(null);

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
      style={[styles.scrollView, { width, backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
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
          placeholder="Start typing..."
          placeholderTextColor={colors.placeholder}
          textAlignVertical="top"
          autoCorrect={false}
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
