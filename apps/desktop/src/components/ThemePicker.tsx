import { useState } from 'react';
import { palettes, themeOrder, type ThemeMode } from '@/lib/theme';

const CIRCLE_SIZE = 16;
const GAP = 6;
const COLLAPSE_ANIMATION_DELAY_MS = 150;

function OptionCircle({
  theme,
  isOpen,
  isSelected,
  onPress,
}: {
  theme: ThemeMode;
  isOpen: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const colors = palettes[theme];

  return (
    <button
      onClick={onPress}
      style={{
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: '50%',
        backgroundColor: colors.background,
        border: `${isSelected ? 2 : 1.5}px solid ${colors.accent}`,
        cursor: 'pointer',
        transform: `scale(${isOpen ? 1 : 0})`,
        opacity: isOpen ? 1 : 0,
        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease',
        flexShrink: 0,
      }}
    />
  );
}

type ThemePickerProps = {
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
};

export default function ThemePicker({ currentTheme, onSelectTheme }: ThemePickerProps) {
  const colors = palettes[currentTheme];
  const [open, setOpen] = useState(false);

  const expand = () => setOpen(true);
  const collapse = () => setOpen(false);

  const selectTheme = (theme: ThemeMode) => {
    onSelectTheme(theme);
    setTimeout(() => setOpen(false), COLLAPSE_ANIMATION_DELAY_MS);
  };

  return (
    <>
      {open && (
        <div
          onClick={collapse}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: GAP,
          zIndex: 10,
        }}
      >
        {themeOrder.map((theme) => (
          <OptionCircle
            key={theme}
            theme={theme}
            isOpen={open}
            isSelected={theme === currentTheme}
            onPress={() => selectTheme(theme)}
          />
        ))}

        <button
          onClick={open ? collapse : expand}
          style={{
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            borderRadius: '50%',
            backgroundColor: colors.background,
            border: `1.5px solid ${colors.accent}`,
            cursor: 'pointer',
            flexShrink: 0,
            zIndex: 20,
          }}
        />
      </div>
    </>
  );
}
