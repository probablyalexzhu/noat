/**
 * App.tsx — Root orchestration component.
 *
 * Owns note state (IDs, active index, themes, content caches) and CRUD handlers.
 * Delegates persistence to hooks (useAutosave, useRealtimeSync) and rendering
 * to presentational components (NotePage, NoteControls). Handles horizontal
 * scroll-snap navigation with background color interpolation between themes.
 */
import '@/App.css';
import NoteControls from '@/components/NoteControls';
import NotePage from '@/components/NotePage';
import { useAutosave } from '@/hooks/useAutosave';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  cleanupOldDeletedNotes,
  createNote,
  deleteNote,
  getNotesByCreationOrder,
  initDatabase,
  updateNoteTheme,
} from '@/lib/database';
import { cleanupOldDeletedNotesRemote, pull } from '@/lib/sync';
import {
  getValidThemeOrDefault,
  hexToRgba,
  lerpColor,
  palettes,
  themeOrder,
  type ThemeMode,
} from '@/lib/theme';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_THEME: ThemeMode = 'paper';
const SCROLL_TO_ACTIVE_DELAY_MS = 100;
const BG_ANIMATION_DURATION_MS = 250;

export default function App() {
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);
  const [isInitialized, setIsInitialized] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [translucent, setTranslucent] = useState(
    () => localStorage.getItem('translucent') !== 'false',
  );

  const handleToggleTranslucent = useCallback(() => {
    setTranslucent((prev) => {
      const next = !prev;
      localStorage.setItem('translucent', String(next));
      return next;
    });
  }, []);

  // Document-level hover detection — handles the focused-window case.
  useEffect(() => {
    const onEnter = () => setHovered(true);
    const onLeave = () => setHovered(false);
    document.documentElement.addEventListener('mouseenter', onEnter);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      document.documentElement.removeEventListener('mouseenter', onEnter);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Native hover detection for unfocused window (macOS).
  // The WKWebView only dispatches mouse events to the key window, so a Rust
  // global monitor emits these events when the app is NOT focused.
  useEffect(() => {
    const unlistenEnter = listen('mouse-entered-window', () => setHovered(true));
    const unlistenLeave = listen('mouse-left-window', () => setHovered(false));
    return () => {
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, []);

  const [scrollBackground, setScrollBackground] = useState<string | null>(null);

  const noteThemes = useRef(new Map<string, ThemeMode>());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle remote changes from realtime sync
  const handleRemoteChange = useCallback(
    async (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => {
      if (event === 'DELETE') {
        // Note was deleted remotely - remove from state
        setNoteIds((prev) => prev.filter((id) => id !== noteId));
        removeNoteFromCache(noteId);
        return;
      }

      // INSERT or UPDATE
      const isNewNote = !noteIds.includes(noteId);

      if (isNewNote) {
        // New note created remotely - full reload
        const notes = await getNotesByCreationOrder();
        const ids = notes.map((n) => n.id);

        notes.forEach((note, index) => {
          const theme = getValidThemeOrDefault(note.theme, index);
          initNoteInCache(note.id, note.content ?? '', theme);
        });

        setNoteIds(ids);
      } else {
        // Existing note updated - selective reload
        const notes = await getNotesByCreationOrder();
        const note = notes.find((n) => n.id === noteId);

        if (!note) {
          // Note might have been soft-deleted
          setNoteIds((prev) => prev.filter((id) => id !== noteId));
          removeNoteFromCache(noteId);
          return;
        }

        // Apply remote changes immediately (remote wins)
        const content = note.content ?? '';
        contentCache.current.set(note.id, content);
        latestContents.current.set(note.id, content);

        const theme = note.theme as ThemeMode;
        if (theme && themeOrder.includes(theme)) {
          noteThemes.current.set(note.id, theme);
        }

        // Trigger re-render by updating forceRefresh
        setForceRefresh((c) => c + 1);
      }
    },
    [noteIds],
  );

  // Reconcile React state after pull() updates SQLite.
  // Called by useRealtimeSync on window focus to catch missed realtime events.
  const handlePullCompleted = useCallback(async () => {
    const notes = await getNotesByCreationOrder();
    const freshIds = notes.map((n) => n.id);
    const freshSet = new Set(freshIds);

    notes.forEach((note, index) => {
      if (!contentCache.current.has(note.id)) {
        const theme = getValidThemeOrDefault(note.theme, index);
        initNoteInCache(note.id, note.content ?? '', theme);
      }
    });

    for (const id of contentCache.current.keys()) {
      if (!freshSet.has(id)) {
        removeNoteFromCache(id);
      }
    }

    if (freshIds.length === 0) {
      const id = await createNote('Untitled', DEFAULT_THEME);
      initNoteInCache(id, '', DEFAULT_THEME);
      setNoteIds([id]);
      setActiveIndex(0);
    } else {
      setNoteIds(freshIds);
      setActiveIndex((prev) => Math.min(prev, freshIds.length - 1));
      setForceRefresh((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { handleNoteDirty } = useRealtimeSync({
    onRemoteChange: handleRemoteChange,
    onPullCompleted: handlePullCompleted,
  });

  const { contentCache, latestContents, handleChangeText, flushNote } = useAutosave({
    onNoteDirty: handleNoteDirty,
  });

  const initNoteInCache = (id: string, content: string, theme: ThemeMode) => {
    contentCache.current.set(id, content);
    latestContents.current.set(id, content);
    noteThemes.current.set(id, theme);
  };

  const removeNoteFromCache = (id: string) => {
    contentCache.current.delete(id);
    latestContents.current.delete(id);
    noteThemes.current.delete(id);
  };

  // Initialize database and load notes
  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();

        // Pull pre-existing notes from Supabase
        await pull();

        // Cleanup old deleted notes (local + cloud)
        await cleanupOldDeletedNotes(7);
        await cleanupOldDeletedNotesRemote(7).catch(console.error);

        const notes = await getNotesByCreationOrder();

        if (notes.length > 0) {
          const ids = notes.map((n) => n.id);

          notes.forEach((note, index) => {
            const theme = getValidThemeOrDefault(note.theme, index);
            initNoteInCache(note.id, note.content ?? '', theme);

            if (!note.theme || !themeOrder.includes(note.theme as ThemeMode)) {
              updateNoteTheme(note.id, theme);
            }
          });

          setNoteIds(ids);
        } else {
          const id = await createNote('Untitled', DEFAULT_THEME);
          initNoteInCache(id, '', DEFAULT_THEME);
          setNoteIds([id]);
        }

        setIsInitialized(true);
        await getCurrentWindow().show();
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    init();
  }, []);

  // Listen to window resize
  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll to active index when it changes
  useEffect(() => {
    if (!scrollRef.current || activeIndex < 0 || activeIndex >= noteIds.length) {
      return;
    }

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          left: activeIndex * width,
          behavior: 'smooth',
        });
      }
    }, SCROLL_TO_ACTIVE_DELAY_MS);
  }, [activeIndex, noteIds.length, width]);

  function getThemeForNote(noteId: string | undefined): ThemeMode {
    if (!noteId) {
      return DEFAULT_THEME;
    }
    return noteThemes.current.get(noteId) ?? DEFAULT_THEME;
  }

  const activeNoteId = noteIds[activeIndex];
  const activeTheme = getThemeForNote(activeNoteId);
  const activeColors = palettes[activeTheme];

  const handleAddNote = useCallback(async () => {
    const currentTheme = getThemeForNote(noteIds[activeIndex]);
    const currentThemeIndex = themeOrder.indexOf(currentTheme);
    const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];

    const id = await createNote('Untitled', nextTheme);
    initNoteInCache(id, '', nextTheme);
    handleNoteDirty(id);

    setNoteIds((prev) => {
      const next = [...prev, id];
      setActiveIndex(next.length - 1);
      return next;
    });
  }, [noteIds, activeIndex, handleNoteDirty]);

  const handleDeleteNote = useCallback(async () => {
    const noteId = noteIds[activeIndex];
    if (!noteId) {
      return;
    }

    flushNote(noteId);
    await deleteNote(noteId);
    handleNoteDirty(noteId);
    removeNoteFromCache(noteId);

    const remaining = noteIds.filter((id) => id !== noteId);

    if (remaining.length === 0) {
      const newId = await createNote('Untitled', DEFAULT_THEME);
      initNoteInCache(newId, '', DEFAULT_THEME);
      setNoteIds([newId]);
      setActiveIndex(0);
    } else {
      const newIndex = activeIndex >= remaining.length ? remaining.length - 1 : activeIndex;
      setNoteIds(remaining);
      setActiveIndex(newIndex);
    }
  }, [noteIds, activeIndex, flushNote, handleNoteDirty]);

  const handleThemeChange = useCallback(
    async (theme: ThemeMode) => {
      const noteId = noteIds[activeIndex];
      if (!noteId) return;
      noteThemes.current.set(noteId, theme);
      setScrollBackground(null);
      setForceRefresh((c) => c + 1);
      await updateNoteTheme(noteId, theme);
      handleNoteDirty(noteId);
    },
    [noteIds, activeIndex, handleNoteDirty],
  );

  // Handle scroll detection to update active index and interpolate background color
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const scrollLeft = scrollRef.current.scrollLeft;

    // Interpolate background color between adjacent notes during scroll
    if (width > 0 && noteIds.length > 1) {
      const floatIndex = scrollLeft / width;
      const leftIndex = Math.max(0, Math.min(Math.floor(floatIndex), noteIds.length - 1));
      const rightIndex = Math.min(leftIndex + 1, noteIds.length - 1);
      const t = floatIndex - leftIndex;

      const leftBg = palettes[getThemeForNote(noteIds[leftIndex])].background;
      const rightBg = palettes[getThemeForNote(noteIds[rightIndex])].background;
      setScrollBackground(lerpColor(leftBg, rightBg, t));
    }

    const newIndex = Math.round(scrollLeft / width);

    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < noteIds.length) {
      flushNote(noteIds[activeIndex]);
      setActiveIndex(newIndex);
    }
  }, [width, activeIndex, noteIds, flushNote]);

  // Brief CSS transition for background color during dot-click navigation only.
  // During swipes, handleScroll updates color at ~60fps so the transition would cause visible lag.
  const animateBgRef = useRef(false);
  const animateBgTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleDotPress = useCallback(
    (index: number) => {
      if (index >= 0 && index < noteIds.length && index !== activeIndex) {
        flushNote(noteIds[activeIndex]);
        animateBgRef.current = true;
        clearTimeout(animateBgTimer.current);
        animateBgTimer.current = setTimeout(() => {
          animateBgRef.current = false;
        }, BG_ANIMATION_DURATION_MS);
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ left: index * width, behavior: 'instant' });
        }
        setActiveIndex(index);
      }
    },
    [noteIds, activeIndex, width, flushNote],
  );

  const dotColors = noteIds.map((id) => {
    const theme = getThemeForNote(id);
    return palettes[theme].accent;
  });

  if (!isInitialized) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transition: animateBgRef.current ? 'background-color 200ms ease' : 'none',
        backgroundColor: (() => {
          const bg = scrollBackground ?? activeColors.background;
          return translucent ? hexToRgba(bg, 0.4) : bg;
        })(),
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          height: '28px',
          userSelect: 'none',
          flexShrink: 0,
        }}
      />
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          flex: 1,
          width: '100%',
          scrollbarWidth: 'none',
        }}
        onScroll={handleScroll}
      >
        {noteIds.map((id) => {
          const itemTheme = getThemeForNote(id);
          const itemColors = palettes[itemTheme];
          const cachedContent = contentCache.current.get(id);

          return (
            <NotePage
              key={`${id}-${forceRefresh}`}
              noteId={id}
              content={cachedContent ?? ''}
              onChangeText={handleChangeText}
              width={width}
              colors={itemColors}
              translucent={translucent}
            />
          );
        })}
      </div>

      <NoteControls
        dotColors={dotColors}
        activeIndex={activeIndex}
        activeTheme={activeTheme}
        onDeleteNote={handleDeleteNote}
        onAddNote={handleAddNote}
        onDotPress={handleDotPress}
        onThemeChange={handleThemeChange}
        hovered={hovered}
        translucent={translucent}
        onToggleTranslucent={handleToggleTranslucent}
      />
    </div>
  );
}
