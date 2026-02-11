import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createConversation,
  deleteConversation,
  getConversationsByCreationOrder,
  updateNoteContent,
  updateNoteTheme,
  type ThemeMode,
} from '@/lib/database';
import { palettes, themeOrder, type Colors } from '@/lib/theme';
import ThemePicker from '@/components/ThemePicker';
import NotePage from '@/components/NotePage';
import DotIndicator from '@/components/DotIndicator';
import AddNoteButton from '@/components/AddNoteButton';
import DeleteNoteButton from '@/components/DeleteNoteButton';

export default function Index() {
  const { width } = useWindowDimensions();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [noteIds, setNoteIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [themeVersion, setThemeVersion] = useState(0);
  const contentCache = useRef(new Map<string, string>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latestContents = useRef(new Map<string, string>());
  const noteThemes = useRef(new Map<string, ThemeMode>());
  const flatListRef = useRef<FlatList>(null);
  const suppressKeyboardRef = useRef(false);

  // Initialize: load all conversations
  useEffect(() => {
    const convos = getConversationsByCreationOrder();
    if (convos.length > 0) {
      const ids = convos.map((c) => c.id);
      for (let i = 0; i < convos.length; i++) {
        const c = convos[i];
        contentCache.current.set(c.id, c.content ?? '');
        latestContents.current.set(c.id, c.content ?? '');
        const theme = c.theme as ThemeMode | null;
        if (theme && themeOrder.includes(theme)) {
          noteThemes.current.set(c.id, theme);
        } else {
          // Assign spread across themeOrder for legacy notes with null theme
          const assigned = themeOrder[i % themeOrder.length];
          noteThemes.current.set(c.id, assigned);
          updateNoteTheme(c.id, assigned);
        }
      }
      setNoteIds(ids);
    } else {
      const id = createConversation('Untitled', 'dark');
      contentCache.current.set(id, '');
      latestContents.current.set(id, '');
      noteThemes.current.set(id, 'dark');
      setNoteIds([id]);
    }
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (_e: KeyboardEvent) => {
      if (suppressKeyboardRef.current) {
        Keyboard.dismiss();
        return;
      }
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, (_e: KeyboardEvent) =>
      setIsKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Flush saves on background / unmount
  useEffect(() => {
    const flushAll = () => {
      for (const [noteId, timer] of saveTimers.current.entries()) {
        clearTimeout(timer);
        const text = latestContents.current.get(noteId);
        if (text !== undefined) {
          updateNoteContent(noteId, text);
        }
      }
      saveTimers.current.clear();
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') flushAll();
    });

    return () => {
      sub.remove();
      flushAll();
    };
  }, []);

  // Derive active colors from the active note's theme
  const activeNoteId = noteIds[activeIndex];
  const activeTheme = activeNoteId ? (noteThemes.current.get(activeNoteId) ?? 'dark') : 'dark';
  const activeColors = palettes[activeTheme];

  const insets = useSafeAreaInsets();
  const DOT_INDICATOR_HEIGHT = 23; // paddingVertical 8 + dot 7 + paddingVertical 8
  const BOTTOM_BAR_HEIGHT = 54; // button ~48 + paddingBottom 6
  const contentPaddingTop = insets.top + DOT_INDICATOR_HEIGHT;
  const contentPaddingBottom = insets.bottom + BOTTOM_BAR_HEIGHT;

  const handleChangeText = useCallback((noteId: string, text: string) => {
    contentCache.current.set(noteId, text);
    latestContents.current.set(noteId, text);

    const existing = saveTimers.current.get(noteId);
    if (existing) clearTimeout(existing);

    saveTimers.current.set(
      noteId,
      setTimeout(() => {
        updateNoteContent(noteId, text);
        saveTimers.current.delete(noteId);
      }, 300),
    );
  }, []);

  const flushNote = useCallback((noteId: string) => {
    const timer = saveTimers.current.get(noteId);
    if (timer) {
      clearTimeout(timer);
      saveTimers.current.delete(noteId);
      const text = latestContents.current.get(noteId);
      if (text !== undefined) {
        updateNoteContent(noteId, text);
      }
    }
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
      if (newIndex !== activeIndex && noteIds[activeIndex]) {
        flushNote(noteIds[activeIndex]);
      }
      setActiveIndex(newIndex);
      setTimeout(() => {
        suppressKeyboardRef.current = false;
      }, 120);
    },
    [width, activeIndex, noteIds, flushNote],
  );

  const handleAddNote = useCallback(() => {
    // Pick next theme in rotation from current page's theme
    const currentTheme = noteIds[activeIndex]
      ? (noteThemes.current.get(noteIds[activeIndex]) ?? 'dark')
      : 'dark';
    const currentThemeIndex = themeOrder.indexOf(currentTheme);
    const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];

    const id = createConversation('Untitled', nextTheme);
    contentCache.current.set(id, '');
    latestContents.current.set(id, '');
    noteThemes.current.set(id, nextTheme);
    setThemeVersion((v) => v + 1);
    setNoteIds((prev) => {
      const next = [...prev, id];
      // Scroll to new note after state update
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: next.length - 1, animated: true });
        setActiveIndex(next.length - 1);
      }, 50);
      return next;
    });
  }, [noteIds, activeIndex]);

  const handleDeleteNote = useCallback(() => {
    const noteId = noteIds[activeIndex];
    if (!noteId) return;

    // Flush any pending save
    flushNote(noteId);

    // Soft-delete in database
    deleteConversation(noteId);

    // Clean up caches
    contentCache.current.delete(noteId);
    latestContents.current.delete(noteId);
    noteThemes.current.delete(noteId);

    const remaining = noteIds.filter((id) => id !== noteId);

    if (remaining.length === 0) {
      // Last note deleted — create a fresh blank one
      const newId = createConversation('Untitled', 'dark');
      contentCache.current.set(newId, '');
      latestContents.current.set(newId, '');
      noteThemes.current.set(newId, 'dark');
      setNoteIds([newId]);
      setActiveIndex(0);
    } else {
      const newIndex = activeIndex >= remaining.length ? remaining.length - 1 : activeIndex;
      setNoteIds(remaining);
      setActiveIndex(newIndex);
    }
    setThemeVersion((v) => v + 1);
  }, [noteIds, activeIndex, flushNote]);

  const handleThemeChange = useCallback(
    (theme: ThemeMode) => {
      const noteId = noteIds[activeIndex];
      if (!noteId) return;
      noteThemes.current.set(noteId, theme);
      updateNoteTheme(noteId, theme);
      setThemeVersion((v) => v + 1);
    },
    [noteIds, activeIndex],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const itemTheme = noteThemes.current.get(item) ?? 'dark';
      const itemColors = palettes[itemTheme];
      return (
        <NotePage
          noteId={item}
          initialContent={contentCache.current.get(item) ?? ''}
          onChangeText={handleChangeText}
          width={width}
          colors={itemColors}
          contentPaddingTop={contentPaddingTop}
          contentPaddingBottom={contentPaddingBottom}
        />
      );
    },
    [handleChangeText, width, contentPaddingTop, contentPaddingBottom],
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

  // Build dot accent colors array
  const dotColors = noteIds.map((id) => palettes[noteThemes.current.get(id) ?? 'dark'].accent);

  const styles = makeStyles(activeColors);

  return (
    <View style={styles.outerContainer}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex1}>
          <FlatList
            ref={flatListRef}
            data={noteIds}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={themeVersion}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => {
              suppressKeyboardRef.current = true;
              Keyboard.dismiss();
            }}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            getItemLayout={getItemLayout}
            style={StyleSheet.absoluteFill}
          />

          <SafeAreaView style={styles.chromeOverlay} pointerEvents="box-none">
            <DotIndicator dotColors={dotColors} activeIndex={activeIndex} />

            <View style={styles.flex1} pointerEvents="none" />

            {isKeyboardVisible && (
              <Pressable style={styles.dismissButton} onPress={Keyboard.dismiss}>
                <Text style={styles.dismissArrow}>↓</Text>
              </Pressable>
            )}

            {!isKeyboardVisible && (
              <View style={styles.bottomBar}>
                <View style={styles.deleteButtonContainer}>
                  <DeleteNoteButton onPress={handleDeleteNote} colors={activeColors} />
                </View>
                <View style={styles.themePickerContainer}>
                  <ThemePicker currentTheme={activeTheme} onSelectTheme={handleThemeChange} />
                </View>
                <View style={styles.addButtonContainer}>
                  <AddNoteButton onPress={handleAddNote} colors={activeColors} />
                </View>
              </View>
            )}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    flex1: {
      flex: 1,
    },
    chromeOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    dismissButton: {
      alignSelf: 'center',
      width: 36,
      height: 36,
      borderRadius: 18,
      marginBottom: 6,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissArrow: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 20,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    deleteButtonContainer: {
      flex: 1,
      alignItems: 'flex-start',
    },
    themePickerContainer: {
      flex: 1,
      alignItems: 'center',
    },
    addButtonContainer: {
      flex: 1,
      alignItems: 'flex-end',
    },
  });
