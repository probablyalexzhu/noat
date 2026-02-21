import AddNoteButton from '@/components/AddNoteButton';
import DeleteNoteButton from '@/components/DeleteNoteButton';
import DotIndicator from '@/components/DotIndicator';
import ThemePicker from '@/components/ThemePicker';
import type { Colors, ThemeMode } from '@/lib/theme';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type NoteControlsProps = {
  dotColors: string[];
  activeIndex: number;
  activeTheme: ThemeMode;
  activeColors: Colors;
  isKeyboardVisible: boolean;
  onDeleteNote: () => void;
  onAddNote: () => void;
  onThemeChange: (theme: ThemeMode) => void;
};

export default function NoteControls({
  dotColors,
  activeIndex,
  activeTheme,
  activeColors,
  isKeyboardVisible,
  onDeleteNote,
  onAddNote,
  onThemeChange,
}: NoteControlsProps) {
  const styles = makeStyles(activeColors);

  return (
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
            <DeleteNoteButton onPress={onDeleteNote} colors={activeColors} />
          </View>
          <View style={styles.themePickerContainer}>
            <ThemePicker currentTheme={activeTheme} onSelectTheme={onThemeChange} />
          </View>
          <View style={styles.addButtonContainer}>
            {dotColors.length < 5 && (
              <AddNoteButton onPress={onAddNote} colors={activeColors} />
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    chromeOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    flex1: {
      flex: 1,
    },
    dismissButton: {
      alignSelf: 'center',
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: -20,
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
