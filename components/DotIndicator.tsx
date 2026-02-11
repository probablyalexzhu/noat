import React from 'react';
import { View, StyleSheet } from 'react-native';

type DotIndicatorProps = {
  dotColors: string[];
  activeIndex: number;
};

export default function DotIndicator({ dotColors, activeIndex }: DotIndicatorProps) {
  if (dotColors.length <= 1) return null;

  return (
    <View style={styles.container}>
      {dotColors.map((accent, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: accent,
              opacity: i === activeIndex ? 1 : 0.4,
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
