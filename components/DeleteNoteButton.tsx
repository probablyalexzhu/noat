import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import type { Colors } from '@/lib/theme';

type DeleteNoteButtonProps = {
  onPress: () => void;
  colors: Colors;
};

export default function DeleteNoteButton({ onPress, colors }: DeleteNoteButtonProps) {
  return (
    <Pressable style={[styles.button, { backgroundColor: colors.surface }]} onPress={onPress}>
      <Text style={[styles.minus, { color: colors.text }]}>−</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minus: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '300',
  },
});
