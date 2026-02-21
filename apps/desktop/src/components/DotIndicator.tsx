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
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 6,
      }}
    >
      {dotColors.map((accent, index) => (
        <div
          key={`dot-${index}`}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: accent,
            opacity: index === activeIndex ? ACTIVE_OPACITY : INACTIVE_OPACITY,
          }}
        />
      ))}
    </div>
  );
}
