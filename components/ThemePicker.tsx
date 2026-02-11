import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { palettes, themeOrder } from '@/lib/theme';
import type { ThemeMode } from '@/lib/database';

const TRIGGER_SIZE = 48;
const OPTION_SIZE = 40;

const springConfig = { damping: 20, stiffness: 300 };

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
  progress,
  isSelected,
  onPress,
}: {
  theme: ThemeMode;
  index: number;
  progress: SharedValue<number>;
  isSelected: boolean;
  onPress: () => void;
}) {
  const colors = palettes[theme];
  const { x, y } = offsets[index];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, y]) },
      { scale: interpolate(progress.value, [0, 1], [0.3, 1]) },
    ],
    opacity: progress.value,
  }));

  return (
    <Animated.View
      style={[
        styles.option,
        {
          backgroundColor: colors.background,
          borderColor: colors.accent,
          borderWidth: isSelected ? 3 : 2,
        },
        animatedStyle,
      ]}
    >
      <Pressable style={styles.optionHit} onPress={onPress} />
    </Animated.View>
  );
}

type ThemePickerProps = {
  currentTheme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
};

export default function ThemePicker({ currentTheme, onSelectTheme }: ThemePickerProps) {
  const colors = palettes[currentTheme];
  const progress = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const expand = () => {
    setOpen(true);
    progress.value = withSpring(1, springConfig);
  };

  const collapse = () => {
    progress.value = withSpring(0, springConfig);
    // Delay unmounting the backdrop so the closing animation plays
    setTimeout(() => setOpen(false), 150);
  };

  const selectTheme = (theme: ThemeMode) => {
    onSelectTheme(theme);
    collapse();
  };

  return (
    <View style={styles.wrapper}>
      {open && <Pressable style={StyleSheet.absoluteFill} onPress={collapse} />}

      <View style={styles.anchor}>
        {/* Option circles (rendered behind trigger so trigger is on top) */}
        {open &&
          themeOrder.map((theme, i) => (
            <OptionCircle
              key={theme}
              theme={theme}
              index={i}
              progress={progress}
              isSelected={theme === currentTheme}
              onPress={() => selectTheme(theme)}
            />
          ))}

        {/* Trigger circle */}
        <Pressable
          style={[
            styles.trigger,
            {
              backgroundColor: colors.background,
              borderColor: colors.accent,
            },
          ]}
          onPress={open ? collapse : expand}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  anchor: {
    width: TRIGGER_SIZE,
    height: TRIGGER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trigger: {
    width: TRIGGER_SIZE,
    height: TRIGGER_SIZE,
    borderRadius: TRIGGER_SIZE / 2,
    borderWidth: 2,
  },
  option: {
    position: 'absolute',
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionHit: {
    width: '100%',
    height: '100%',
  },
});
