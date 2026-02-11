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
import AddNoteButton from '@/components/AddNoteButton';
import DeleteNoteButton from '@/components/DeleteNoteButton';
import DotIndicator from '@/components/DotIndicator';
import NotePage from '@/components/NotePage';
import ThemePicker from '@/components/ThemePicker';

const AUTOSAVE_DELAY_MS = 300;
const SCROLL_ANIMATION_DELAY_MS = 50;
const KEYBOARD_SUPPRESS_DELAY_MS = 120;
const DOT_INDICATOR_HEIGHT = 23;
const BOTTOM_BAR_HEIGHT = 54;
const DEFAULT_THEME: ThemeMode = 'dark';

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

  useEffect(() => {
    const convos = getConversationsByCreationOrder();

    if (convos.length > 0) {
      const ids = convos.map((c) => c.id);

      convos.forEach((convo, index) => {
        const content = convo.content ?? '';
        contentCache.current.set(convo.id, content);
        latestContents.current.set(convo.id, content);

        const theme = getValidThemeOrAssignDefault(convo.theme, index);
        noteThemes.current.set(convo.id, theme);

        if (!convo.theme || !themeOrder.includes(convo.theme as ThemeMode)) {
          updateNoteTheme(convo.id, theme);
        }
      });

      setNoteIds(ids);
    } else {
      const id = createConversation('Untitled', DEFAULT_THEME);
      contentCache.current.set(id, '');
      latestContents.current.set(id, '');
      noteThemes.current.set(id, DEFAULT_THEME);
      setNoteIds([id]);
    }
  }, []);

  function getValidThemeOrAssignDefault(
    themeValue: string | null,
    fallbackIndex: number,
  ): ThemeMode {
    if (themeValue && themeOrder.includes(themeValue as ThemeMode)) {
      return themeValue as ThemeMode;
    }
    return themeOrder[fallbackIndex % themeOrder.length];
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (_e: KeyboardEvent) => {
      if (suppressKeyboardRef.current) {
        Keyboard.dismiss();
        return;
      }
      setIsKeyboardVisible(true);
    };

    const handleKeyboardHide = (_e: KeyboardEvent) => {
      setIsKeyboardVisible(false);
    };

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const flushAllPendingSaves = () => {
      for (const [noteId, timer] of saveTimers.current.entries()) {
        clearTimeout(timer);
        const text = latestContents.current.get(noteId);
        if (text !== undefined) {
          updateNoteContent(noteId, text);
        }
      }
      saveTimers.current.clear();
    };

    const handleAppStateChange = (state: string) => {
      if (state === 'background') {
        flushAllPendingSaves();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      sub.remove();
      flushAllPendingSaves();
    };
  }, []);

  const insets = useSafeAreaInsets();

  const activeNoteId = noteIds[activeIndex];
  const activeTheme = getThemeForNote(activeNoteId);
  const activeColors = palettes[activeTheme];

  const contentPaddingTop = insets.top + DOT_INDICATOR_HEIGHT;
  const contentPaddingBottom = insets.bottom + BOTTOM_BAR_HEIGHT;

  function getThemeForNote(noteId: string | undefined): ThemeMode {
    if (!noteId) {
      return DEFAULT_THEME;
    }
    return noteThemes.current.get(noteId) ?? DEFAULT_THEME;
  }

  const handleChangeText = useCallback((noteId: string, text: string) => {
    contentCache.current.set(noteId, text);
    latestContents.current.set(noteId, text);

    const existing = saveTimers.current.get(noteId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      updateNoteContent(noteId, text);
      saveTimers.current.delete(noteId);
    }, AUTOSAVE_DELAY_MS);

    saveTimers.current.set(noteId, timer);
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
      }, KEYBOARD_SUPPRESS_DELAY_MS);
    },
    [width, activeIndex, noteIds, flushNote],
  );

  const handleAddNote = useCallback(() => {
    const currentTheme = getThemeForNote(noteIds[activeIndex]);
    const currentThemeIndex = themeOrder.indexOf(currentTheme);
    const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];

    const id = createConversation('Untitled', nextTheme);

    contentCache.current.set(id, '');
    latestContents.current.set(id, '');
    noteThemes.current.set(id, nextTheme);

    setThemeVersion((v) => v + 1);
    setNoteIds((prev) => {
      const next = [...prev, id];

      setTimeout(() => {
        const lastIndex = next.length - 1;
        flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true });
        setActiveIndex(lastIndex);
      }, SCROLL_ANIMATION_DELAY_MS);

      return next;
    });
  }, [noteIds, activeIndex]);

  const handleDeleteNote = useCallback(() => {
    const noteId = noteIds[activeIndex];
    if (!noteId) {
      return;
    }

    flushNote(noteId);
    deleteConversation(noteId);

    contentCache.current.delete(noteId);
    latestContents.current.delete(noteId);
    noteThemes.current.delete(noteId);

    const remaining = noteIds.filter((id) => id !== noteId);

    if (remaining.length === 0) {
      const newId = createConversation('Untitled', DEFAULT_THEME);
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
      const itemTheme = getThemeForNote(item);
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
