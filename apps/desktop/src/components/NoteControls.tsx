import AddNoteButton from '@/components/AddNoteButton';
import DeleteNoteButton from '@/components/DeleteNoteButton';
import DotIndicator from '@/components/DotIndicator';
import ThemePicker from '@/components/ThemePicker';
import type { Colors, ThemeMode } from '@/lib/theme';

type NoteControlsProps = {
  dotColors: string[];
  activeIndex: number;
  activeTheme: ThemeMode;
  activeColors: Colors;
  onDeleteNote: () => void;
  onAddNote: () => void;
  onThemeChange: (theme: ThemeMode) => void;
};

export default function NoteControls({
  dotColors,
  activeIndex,
  activeTheme,
  activeColors,
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
      <DotIndicator dotColors={dotColors} activeIndex={activeIndex} />

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 6,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <DeleteNoteButton onPress={onDeleteNote} colors={activeColors} />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <ThemePicker currentTheme={activeTheme} onSelectTheme={onThemeChange} />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {dotColors.length < 5 && <AddNoteButton onPress={onAddNote} colors={activeColors} />}
        </div>
      </div>
    </div>
  );
}
