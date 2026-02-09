import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createConversation,
  getConversations,
  createMessage,
  getMessages,
} from "@/lib/database";

export default function Index() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const convos = getConversations();
    let id: string;
    if (convos.length > 0) {
      id = (convos[0] as any).id;
    } else {
      id = createConversation();
    }
    setConversationId(id);
    setMessages(getMessages(id) as any[]);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", handleKeyboardShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", handleKeyboardHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleKeyboardShow = (_event: KeyboardEvent) => {
    setIsKeyboardVisible(true);
  };

  const handleKeyboardHide = (_event: KeyboardEvent) => {
    setIsKeyboardVisible(false);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId) return;
    createMessage(conversationId, trimmed);
    setMessages(getMessages(conversationId) as any[]);
    setText("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((msg) => (
            <Text key={msg.id} style={styles.messageText}>
              {msg.content}
            </Text>
          ))}
        </ScrollView>

        {isKeyboardVisible && (
          <Pressable style={styles.dismissButton} onPress={Keyboard.dismiss}>
            <Text style={styles.dismissText}>Dismiss keyboard</Text>
          </Pressable>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type here..."
            placeholderTextColor="#888"
            value={text}
            onChangeText={setText}
          />
          <Pressable style={styles.sendButton} onPress={handleSubmit}>
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageText: {
    color: "#fff",
    fontSize: 16,
    paddingVertical: 4,
  },
  dismissButton: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 6,
    backgroundColor: "#3a3f47",
    borderRadius: 8,
  },
  dismissText: {
    color: "#fff",
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#3a3f47",
    color: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0a84ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
