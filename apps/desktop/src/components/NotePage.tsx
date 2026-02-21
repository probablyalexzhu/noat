import React, { useEffect, useRef, useState } from 'react';
import type { Colors } from '@/lib/theme';

type NotePageProps = {
  noteId: string;
  content: string;
  onChangeText: (noteId: string, text: string) => void;
  width: number;
  colors: Colors;
};

/**
 * Desktop note editor with auto-resizing textarea.
 *
 * Unlike mobile, there's no keyboard focus/blur concept here.
 * The textarea is always interactive, and we auto-resize it to fit content.
 */
function NotePage({ noteId, content: externalContent, onChangeText, width, colors }: NotePageProps) {
  const [content, setContent] = useState(externalContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync internal state when external content changes (e.g., remote updates)
  useEffect(() => {
    setContent(externalContent);
  }, [externalContent]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const handleChange = (text: string) => {
    setContent(text);
    onChangeText(noteId, text);
  };

  return (
    <div
      style={{
        width,
        height: '100%',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        scrollSnapAlign: 'start',
      }}
      onClick={() => textareaRef.current?.focus()}
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Noat to self..."
        style={{
          flex: 1,
          fontSize: 16,
          padding: 16,
          color: colors.text,
          backgroundColor: colors.background,
          border: 'none',
          resize: 'none',
          overflow: 'hidden',
          fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

export default React.memo(NotePage);
