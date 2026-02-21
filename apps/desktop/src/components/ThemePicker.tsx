import { useState } from 'react';
import { palettes, themeOrder, type ThemeMode } from '@/lib/theme';

const TRIGGER_SIZE = 48;
const OPTION_SIZE = 40;
const COLLAPSE_ANIMATION_DELAY_MS = 150;

// Precomputed offsets for 5 positions along a 180° semicircular arc
// Angles: 180°, 135°, 90°, 45°, 0° (left to right)
const offsets = [
  { x: -100, y: 0 },
  { x: -70.7, y: -70.7 },
  { x: 0, y: -100 },
  { x: 70.7, y: -70.7 },
  { x: 100, y: 0 },
];

function OptionCircle({
  theme,
  index,
  isOpen,
  isSelected,
  onPress,
}: {
  theme: ThemeMode;
  index: number;
  isOpen: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const colors = palettes[theme];
  const { x, y } = offsets[index];

  const scaleValue = isOpen ? 1 : 0;
  const translateX = isOpen ? x : 0;
  const translateY = isOpen ? y : 0;

  return (
    <button
      onClick={onPress}
      style={{
        position: 'absolute',
        width: OPTION_SIZE,
        height: OPTION_SIZE,
        borderRadius: '50%',
        backgroundColor: colors.background,
        border: `${isSelected ? 3 : 2}px solid ${colors.accent}`,
        cursor: 'pointer',
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleValue})`,
        opacity: isOpen ? 1 : 0,
        transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease',
        zIndex: 10,
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

  const expand = () => {
    setOpen(true);
  };

  const collapse = () => {
    setOpen(false);
  };

  const selectTheme = (theme: ThemeMode) => {
    onSelectTheme(theme);
    setTimeout(() => {
      setOpen(false);
    }, COLLAPSE_ANIMATION_DELAY_MS);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
          position: 'relative',
          width: TRIGGER_SIZE,
          height: TRIGGER_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Option circles (rendered behind trigger so trigger is on top) */}
        {open &&
          themeOrder.map((theme, i) => (
            <OptionCircle
              key={theme}
              theme={theme}
              index={i}
              isOpen={open}
              isSelected={theme === currentTheme}
              onPress={() => selectTheme(theme)}
            />
          ))}

        {/* Trigger circle */}
        <button
          onClick={open ? collapse : expand}
          style={{
            width: TRIGGER_SIZE,
            height: TRIGGER_SIZE,
            borderRadius: '50%',
            backgroundColor: colors.background,
            border: `2px solid ${colors.accent}`,
            cursor: 'pointer',
            zIndex: 20,
          }}
        />
      </div>
    </div>
  );
}
