import type { MarkdownStyle } from '@expensify/react-native-live-markdown';
import type { Colors } from './theme';

export function makeMarkdownStyle(colors: Colors): MarkdownStyle {
  return {
    syntax: {
      color: colors.placeholder,
    },
    link: {
      color: colors.accent,
    },
    h1: {
      fontSize: 25,
    },
    blockquote: {
      borderColor: colors.accent,
      borderWidth: 3,
      marginLeft: 6,
      paddingLeft: 6,
    },
    code: {
      fontFamily: 'Courier',
      backgroundColor: colors.surface,
    },
    pre: {
      fontFamily: 'Courier',
      backgroundColor: colors.surface,
    },
  };
}
