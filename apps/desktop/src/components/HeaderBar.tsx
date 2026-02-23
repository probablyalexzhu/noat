import { Minus, Plus } from 'lucide-react';

type HeaderBarProps = {
  dotColors: string[];
  activeIndex: number;
  onDeleteNote: () => void;
  onAddNote: () => void;
  onDotPress: (index: number) => void;
  showAddButton: boolean;
  hovered: boolean;
};

const INACTIVE_COLOR = '#888';

export default function HeaderBar({
  dotColors,
  activeIndex,
  onDeleteNote,
  onAddNote,
  onDotPress,
  showAddButton,
  hovered,
}: HeaderBarProps) {
  return (
    <div
      data-tauri-drag-region
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
          color: dotColors[activeIndex] ?? '#888',
          opacity: hovered ? 0.7 : 0,
          transition: 'opacity 150ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Minus size={16} strokeWidth={2.5} />
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
            onClick={() => onDotPress(index)}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: index === activeIndex ? accent : INACTIVE_COLOR,
              cursor: 'pointer',
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
          color: dotColors[activeIndex] ?? '#888',
          opacity: hovered && showAddButton ? 0.7 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: showAddButton ? 'auto' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
