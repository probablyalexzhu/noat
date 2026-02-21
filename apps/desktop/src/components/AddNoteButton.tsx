import type { Colors } from '@/lib/theme';

type AddNoteButtonProps = {
  onPress: () => void;
  colors: Colors;
};

export default function AddNoteButton({ onPress, colors }: AddNoteButtonProps) {
  return (
    <button
      onClick={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        backgroundColor: colors.surface,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        lineHeight: '26px',
        fontWeight: '300',
        color: colors.text,
      }}
    >
      +
    </button>
  );
}
