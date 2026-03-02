import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cleanupOldDeletedNotes,
  createNote,
  deleteNote,
  getNotesByCreationOrder,
  updateNoteTheme,
} from '@/lib/data/database';
import { cleanupOldDeletedNotesRemote, pull } from '@/lib/data/sync';
import { palettes, themeOrder, type Colors, type ThemeMode } from '@/lib/theme';
import NoteControls from '@/components/NoteControls';
import NotePage from '@/components/NotePage';
import { useAutosave } from '@/hooks/useAutosave';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const DOT_INDICATOR_HEIGHT = 23;
const BOTTOM_BAR_HEIGHT = 54;
const DEFAULT_THEME: ThemeMode = 'paper';

export default function Index() {
  const { width } = useWindowDimensions();
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // themeVersion is a cache-busting counter for FlatList's extraData.
  // Incremented when notes change (content/theme) to force re-render of all items.
  // The counter value is meaningless - only used to trigger shallow equality check.
  const [themeVersion, setThemeVersion] = useState(0);
  const noteThemes = useRef(new Map<string, ThemeMode>());
  const flatListRef = useRef<FlatList>(null);

  // Handle remote changes from realtime sync
  const handleRemoteChange = useCallback(
    (noteId: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => {
      if (event === 'DELETE') {
        // Note was deleted remotely - remove from state
        setNoteIds((prev) => prev.filter((id) => id !== noteId));
        contentCache.current.delete(noteId);
        latestContents.current.delete(noteId);
        noteThemes.current.delete(noteId);
        return;
      }

      // INSERT or UPDATE
      const isNewNote = !noteIds.includes(noteId);

      if (isNewNote) {
        // New note created remotely - full reload
        const notes = getNotesByCreationOrder();
        const ids = notes.map((n) => n.id);

        notes.forEach((note, index) => {
          const content = note.content ?? '';
          contentCache.current.set(note.id, content);
          latestContents.current.set(note.id, content);

          const theme = getValidThemeOrAssignDefault(note.theme, index);
          noteThemes.current.set(note.id, theme);
        });

        setNoteIds(ids);
      } else {
        // Existing note updated - selective reload
        const notes = getNotesByCreationOrder();
        const note = notes.find((n) => n.id === noteId);

        if (!note) {
          // Note might have been soft-deleted
          setNoteIds((prev) => prev.filter((id) => id !== noteId));
          contentCache.current.delete(noteId);
          latestContents.current.delete(noteId);
          noteThemes.current.delete(noteId);
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

        // Trigger re-render
        setThemeVersion((v) => v + 1);
      }
    },
    [noteIds],
  );

  // Setup realtime sync with remote change callback
  const { handleNoteDirty } = useRealtimeSync({
    onRemoteChange: handleRemoteChange,
  });

  const { contentCache, latestContents, handleChangeText, flushNote } = useAutosave({
    onNoteDirty: handleNoteDirty,
  });

  const { isKeyboardVisible, registerInputRef, handleTouchStart, handleMomentumScrollEnd } =
    useKeyboardNavigation({
      width,
      activeIndex,
      noteIds,
      onPageChange: setActiveIndex,
      flushNote,
    });

  useEffect(() => {
    async function init() {
      // Cleanup old deleted notes (local + cloud)
      cleanupOldDeletedNotes(7);
      cleanupOldDeletedNotesRemote(7).catch(console.error);

      // Pull remote notes and reconcile before loading local state
      await pull().catch(console.error);

      const notes = getNotesByCreationOrder();

      if (notes.length > 0) {
        const ids = notes.map((n) => n.id);

        notes.forEach((note, index) => {
          const content = note.content ?? '';
          contentCache.current.set(note.id, content);
          latestContents.current.set(note.id, content);

          const theme = getValidThemeOrAssignDefault(note.theme, index);
          noteThemes.current.set(note.id, theme);

          if (!note.theme || !themeOrder.includes(note.theme as ThemeMode)) {
            updateNoteTheme(note.id, theme);
          }
        });

        setNoteIds(ids);
      } else {
        const id = createNote('Untitled', DEFAULT_THEME);
        contentCache.current.set(id, '');
        latestContents.current.set(id, '');
        noteThemes.current.set(id, DEFAULT_THEME);
        setNoteIds([id]);
      }
    }

    init();
  }, []);

  // Re-pull from Supabase when app returns to foreground to reconcile notes
  // that were hard-deleted remotely (DELETE events are dropped by the user_id
  // filter when REPLICA IDENTITY doesn't include user_id in the payload).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      try {
        await pull();
        const notes = getNotesByCreationOrder();
        const freshIds = notes.map((n) => n.id);
        const freshSet = new Set(freshIds);

        notes.forEach((note, index) => {
          if (!contentCache.current.has(note.id)) {
            const theme = getValidThemeOrAssignDefault(note.theme, index);
            contentCache.current.set(note.id, note.content ?? '');
            latestContents.current.set(note.id, note.content ?? '');
            noteThemes.current.set(note.id, theme);
          }
        });

        for (const id of contentCache.current.keys()) {
          if (!freshSet.has(id)) {
            contentCache.current.delete(id);
            latestContents.current.delete(id);
            noteThemes.current.delete(id);
          }
        }

        if (freshIds.length === 0) {
          const id = createNote('Untitled', DEFAULT_THEME);
          contentCache.current.set(id, '');
          latestContents.current.set(id, '');
          noteThemes.current.set(id, DEFAULT_THEME);
          setNoteIds([id]);
          setActiveIndex(0);
        } else {
          setNoteIds(freshIds);
          setActiveIndex((prev) => Math.min(prev, freshIds.length - 1));
          setThemeVersion((v) => v + 1);
        }
      } catch (error) {
        console.error('Focus pull failed:', error);
      }
    });

    return () => subscription.remove();
  }, []);

  const insets = useSafeAreaInsets();

  const activeNoteId = noteIds[activeIndex];
  const activeTheme = getThemeForNote(activeNoteId);
  const activeColors = palettes[activeTheme];

  // Scroll to active index when it changes
  useEffect(() => {
    if (activeIndex >= 0 && activeIndex < noteIds.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: activeIndex,
          animated: true,
        });
      }, 100);
    }
  }, [activeIndex, noteIds.length]);

  const contentPaddingTop = insets.top + DOT_INDICATOR_HEIGHT;
  const contentPaddingBottom = insets.bottom + BOTTOM_BAR_HEIGHT;

  function getValidThemeOrAssignDefault(
    themeValue: string | null,
    fallbackIndex: number,
  ): ThemeMode {
    if (themeValue && themeOrder.includes(themeValue as ThemeMode)) {
      return themeValue as ThemeMode;
    }
    return themeOrder[fallbackIndex % themeOrder.length];
  }

  function getThemeForNote(noteId: string | undefined): ThemeMode {
    if (!noteId) {
      return DEFAULT_THEME;
    }
    return noteThemes.current.get(noteId) ?? DEFAULT_THEME;
  }

  const handleAddNote = useCallback(() => {
    const currentTheme = getThemeForNote(noteIds[activeIndex]);
    const currentThemeIndex = themeOrder.indexOf(currentTheme);
    const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];

    const id = createNote('Untitled', nextTheme);

    contentCache.current.set(id, '');
    latestContents.current.set(id, '');
    noteThemes.current.set(id, nextTheme);
    handleNoteDirty(id);

    setThemeVersion((v) => v + 1);
    setNoteIds((prev) => {
      const next = [...prev, id];
      setActiveIndex(next.length - 1);
      return next;
    });
  }, [noteIds, activeIndex, handleNoteDirty]);

  const handleDeleteNote = useCallback(() => {
    const noteId = noteIds[activeIndex];
    if (!noteId) {
      return;
    }

    flushNote(noteId);
    deleteNote(noteId);
    handleNoteDirty(noteId);

    contentCache.current.delete(noteId);
    latestContents.current.delete(noteId);
    noteThemes.current.delete(noteId);

    const remaining = noteIds.filter((id) => id !== noteId);

    if (remaining.length === 0) {
      const newId = createNote('Untitled', DEFAULT_THEME);
      contentCache.current.set(newId, '');
      latestContents.current.set(newId, '');
      noteThemes.current.set(newId, DEFAULT_THEME);
      setNoteIds([newId]);
      setActiveIndex(0);
    } else {
      const newIndex = activeIndex >= remaining.length ? remaining.length - 1 : activeIndex;
      setNoteIds(remaining);
      setActiveIndex(newIndex);
    }

    setThemeVersion((v) => v + 1);
  }, [noteIds, activeIndex, flushNote, handleNoteDirty]);

  const handleThemeChange = useCallback(
    (theme: ThemeMode) => {
      const noteId = noteIds[activeIndex];
      if (!noteId) return;
      noteThemes.current.set(noteId, theme);
      updateNoteTheme(noteId, theme);
      handleNoteDirty(noteId);
      setThemeVersion((v) => v + 1);
    },
    [noteIds, activeIndex, handleNoteDirty],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const itemTheme = getThemeForNote(item);
      const itemColors = palettes[itemTheme];
      const cachedContent = contentCache.current.get(item);

      return (
        <NotePage
          noteId={item}
          content={cachedContent ?? ''}
          onChangeText={handleChangeText}
          registerInputRef={registerInputRef}
          width={width}
          colors={itemColors}
          contentPaddingTop={contentPaddingTop}
          contentPaddingBottom={contentPaddingBottom}
          isKeyboardVisible={isKeyboardVisible}
        />
      );
    },
    [
      handleChangeText,
      registerInputRef,
      width,
      contentPaddingTop,
      contentPaddingBottom,
      isKeyboardVisible,
    ],
  );

  const keyExtractor = useCallback((item: string) => item, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<string> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const dotColors = noteIds.map((id) => {
    const theme = getThemeForNote(id);
    return palettes[theme].accent;
  });

  const styles = makeStyles(activeColors);

  return (
    <View style={styles.outerContainer}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex1}>
          <FlatList
            key={`flatlist-${noteIds.length}`}
            ref={flatListRef}
            data={noteIds}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={`${themeVersion}:${isKeyboardVisible}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            keyboardDismissMode="none"
            onTouchStart={handleTouchStart}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            getItemLayout={getItemLayout}
            style={StyleSheet.absoluteFill}
          />

          <NoteControls
            dotColors={dotColors}
            activeIndex={activeIndex}
            activeTheme={activeTheme}
            activeColors={activeColors}
            isKeyboardVisible={isKeyboardVisible}
            onDeleteNote={handleDeleteNote}
            onAddNote={handleAddNote}
            onThemeChange={handleThemeChange}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex1: {
      flex: 1,
    },
  });
