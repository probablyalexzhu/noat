import React, { useState, useRef } from 'react';
import { ScrollView, TextInput, StyleSheet } from 'react-native';
import { MarkdownTextInput, parseExpensiMark } from '@expensify/react-native-live-markdown';
import type { Colors } from '@/lib/theme';
import { makeMarkdownStyle } from '@/lib/markdownStyles';

type NotePageProps = {
  noteId: string;
  initialContent: string;
  onChangeText: (noteId: string, text: string) => void;
  width: number;
  colors: Colors;
  contentPaddingTop: number;
  contentPaddingBottom: number;
};

function NotePage({
  noteId,
  initialContent,
  onChangeText,
  width,
  colors,
  contentPaddingTop,
  contentPaddingBottom,
}: NotePageProps) {
  const [content, setContent] = useState(initialContent);
  const inputRef = useRef<TextInput>(null);
  const markdownStyle = makeMarkdownStyle(colors);

  const handleChange = (text: string) => {
    setContent(text);
    onChangeText(noteId, text);
  };

  return (
    <ScrollView
      style={{ width, flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: contentPaddingTop,
        paddingBottom: contentPaddingBottom,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
    >
      <MarkdownTextInput
        ref={inputRef}
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
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    fontSize: 16,
    padding: 16,
    textAlignVertical: 'top',
  },
});

export default React.memo(NotePage);
