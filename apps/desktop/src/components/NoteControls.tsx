/**
 * NoteControls.tsx — Full-screen overlay that positions the HeaderBar and ThemePicker.
 *
 * Sits absolutely over the note content with pointerEvents: 'none' so clicks
 * pass through to the textarea, except on the controls themselves.
 */
import HeaderBar from '@/components/HeaderBar';
import ThemePicker from '@/components/ThemePicker';
import type { ThemeMode } from '@/lib/theme';

const MAX_NOTES = 5;

type NoteControlsProps = {
  dotColors: string[];
  activeIndex: number;
  activeTheme: ThemeMode;
  onDeleteNote: () => void;
  onAddNote: () => void;
  onDotPress: (index: number) => void;
  onThemeChange: (theme: ThemeMode) => void;
  hovered: boolean;
  translucent: boolean;
  onToggleTranslucent: () => void;
};

export default function NoteControls({
  dotColors,
  activeIndex,
  activeTheme,
  onDeleteNote,
  onAddNote,
  onDotPress,
  onThemeChange,
  hovered,
  translucent,
  onToggleTranslucent,
}: NoteControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <HeaderBar
        dotColors={dotColors}
        activeIndex={activeIndex}
        onDeleteNote={onDeleteNote}
        onAddNote={onAddNote}
        onDotPress={onDotPress}
        showAddButton={dotColors.length < MAX_NOTES}
        hovered={hovered}
      />

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 12,
          paddingBottom: 10,
          pointerEvents: 'auto',
        }}
      >
        <ThemePicker
          currentTheme={activeTheme}
          onSelectTheme={onThemeChange}
          hovered={hovered}
          translucent={translucent}
          onToggleTranslucent={onToggleTranslucent}
        />
      </div>
    </div>
  );
}
