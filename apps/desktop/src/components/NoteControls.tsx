import HeaderBar from '@/components/HeaderBar';
import ThemePicker from '@/components/ThemePicker';
import type { ThemeMode } from '@/lib/theme';

type NoteControlsProps = {
  dotColors: string[];
  activeIndex: number;
  activeTheme: ThemeMode;
  onDeleteNote: () => void;
  onAddNote: () => void;
  onThemeChange: (theme: ThemeMode) => void;
};

export default function NoteControls({
  dotColors,
  activeIndex,
  activeTheme,
  onDeleteNote,
  onAddNote,
  onThemeChange,
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
        showAddButton={dotColors.length < 5}
      />

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 6,
          pointerEvents: 'auto',
        }}
      >
        <ThemePicker currentTheme={activeTheme} onSelectTheme={onThemeChange} />
      </div>
    </div>
  );
}
