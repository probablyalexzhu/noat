import React from 'react';
import { View, StyleSheet } from 'react-native';

type DotIndicatorProps = {
  dotColors: string[];
  activeIndex: number;
};

const ACTIVE_OPACITY = 1;
const INACTIVE_OPACITY = 0.4;

export default function DotIndicator({ dotColors, activeIndex }: DotIndicatorProps) {
  if (dotColors.length <= 1) {
    return null;
  }

  return (
    <View style={styles.container}>
      {dotColors.map((accent, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            {
              backgroundColor: accent,
              opacity: index === activeIndex ? ACTIVE_OPACITY : INACTIVE_OPACITY,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
