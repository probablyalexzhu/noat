/**
 * HeaderBar.tsx — Top navigation bar with delete/add buttons and dot indicators.
 *
 * Renders the note dot pagination and icon buttons that fade in on hover.
 */
import { CSSProperties } from 'react';
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
const DOT_SIZE = 7;
const DOT_GAP = 6;
const ICON_SIZE = 16;
const HOVER_OPACITY = 0.7;
const FADE_TRANSITION_MS = 150;

function iconButtonStyle(color: string, visible: boolean): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: visible ? 'pointer' : 'default',
    color,
    opacity: visible ? HOVER_OPACITY : 0,
    transition: `opacity ${FADE_TRANSITION_MS}ms ease`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export default function HeaderBar({
  dotColors,
  activeIndex,
  onDeleteNote,
  onAddNote,
  onDotPress,
  showAddButton,
  hovered,
}: HeaderBarProps) {
  const activeColor = dotColors[activeIndex] ?? INACTIVE_COLOR;

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
      <button onClick={onDeleteNote} style={iconButtonStyle(activeColor, hovered)}>
        <Minus size={ICON_SIZE} strokeWidth={2.5} />
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: DOT_GAP,
        }}
      >
        {dotColors.map((accent, index) => (
          <div
            key={`dot-${index}`}
            onClick={() => onDotPress(index)}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
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
          ...iconButtonStyle(activeColor, hovered && showAddButton),
          pointerEvents: showAddButton ? 'auto' : 'none',
        }}
      >
        <Plus size={ICON_SIZE} strokeWidth={2.5} />
      </button>
    </div>
  );
}
