import React, { useEffect, useRef, useState } from 'react';
import type { Colors } from '@/lib/theme';

const BOTTOM_SPACER_HEIGHT = 28;

type NotePageProps = {
  noteId: string;
  content: string;
  onChangeText: (noteId: string, text: string) => void;
  width: number;
  colors: Colors;
  translucent: boolean;
  isActive: boolean;
};

/**
 * Desktop note editor with auto-resizing textarea.
 *
 * Unlike mobile, there's no keyboard focus/blur concept here.
 * The textarea is always interactive, and we auto-resize it to fit content.
 */
function NotePage({
  noteId,
  content: externalContent,
  onChangeText,
  width,
  colors,
  translucent,
  isActive,
}: NotePageProps) {
  const [content, setContent] = useState(externalContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync internal state when external content changes (e.g., remote updates)
  useEffect(() => {
    setContent(externalContent);
  }, [externalContent]);

  // Focus textarea when this note becomes active or the window regains focus.
  // Keeps the cursor in the editor after keyboard-shortcut reopen, dot
  // navigation, and pull-triggered re-renders.
  useEffect(() => {
    if (!isActive) return;
    textareaRef.current?.focus();

    const handleWindowFocus = () => textareaRef.current?.focus();
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isActive]);

  const handleChange = (text: string) => {
    setContent(text);
    onChangeText(noteId, text);
  };

  return (
    <div
      style={{
        width,
        height: '100%',
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
      }}
      onClick={() => textareaRef.current?.focus()}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Noat to self..."
        style={
          {
            flex: 1,
            fontSize: 16,
            padding: 16,
            paddingBottom: 0,
            color: colors.text,
            backgroundColor: 'transparent',
            border: 'none',
            resize: 'none',
            overflow: 'auto',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            '--placeholder-color': translucent ? colors.text : colors.placeholder,
          } as React.CSSProperties
        }
      />
      {/* Spacer so the scrollbar ends above the ThemePicker in the bottom-right */}
      <div style={{ height: BOTTOM_SPACER_HEIGHT, flexShrink: 0 }} />
    </div>
  );
}

export default React.memo(NotePage);
