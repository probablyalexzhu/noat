import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import type { Colors } from '@/lib/theme';

type AddNoteButtonProps = {
  onPress: () => void;
  colors: Colors;
};

export default function AddNoteButton({ onPress, colors }: AddNoteButtonProps) {
  return (
    <Pressable style={[styles.button, { backgroundColor: colors.surface }]} onPress={onPress}>
      <Text style={[styles.plus, { color: colors.text }]}>+</Text>
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
  plus: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '300',
  },
});
