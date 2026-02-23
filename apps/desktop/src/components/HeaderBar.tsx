import { useState } from 'react';

type HeaderBarProps = {
  dotColors: string[];
  activeIndex: number;
  onDeleteNote: () => void;
  onAddNote: () => void;
  showAddButton: boolean;
};

const ACTIVE_OPACITY = 1;
const INACTIVE_OPACITY = 0.4;

export default function HeaderBar({
  dotColors,
  activeIndex,
  onDeleteNote,
  onAddNote,
  showAddButton,
}: HeaderBarProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-tauri-drag-region
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={onDeleteNote}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: '20px',
          fontWeight: '300',
          color: dotColors[activeIndex] ?? '#888',
          opacity: hovered ? 0.7 : 0,
          transition: 'opacity 150ms ease',
          padding: '0 8px',
        }}
      >
        −
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
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

      <button
        onClick={onAddNote}
        style={{
          background: 'none',
          border: 'none',
          cursor: showAddButton ? 'pointer' : 'default',
          fontSize: 20,
          lineHeight: '20px',
          fontWeight: '300',
          color: dotColors[activeIndex] ?? '#888',
          opacity: hovered && showAddButton ? 0.7 : 0,
          transition: 'opacity 150ms ease',
          padding: '0 8px',
          pointerEvents: showAddButton ? 'auto' : 'none',
        }}
      >
        +
      </button>
    </div>
  );
}
