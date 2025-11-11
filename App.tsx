import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { GemmaInference } from './src/inference/GemmaInference';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  image?: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

const MODEL_URL =
  'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4.litertlm?download=true';
const MODEL_NAME = 'gemma3n.litertlm';

const MODELS_PATH = `${RNFS.DocumentDirectoryPath}/models`;
const MODEL_PATH = `${MODELS_PATH}/${MODEL_NAME}`;
const AUTH = 'DGcJdsXFviAtKytYDLoaFvrmdUAyMYAHca';

const cameraIcon = require('./assets/camera.png');

const App = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const checkModelExists = async (): Promise<boolean> => {
    try {
      const exists = await RNFS.exists(MODEL_PATH);
      console.log(`Model exists at ${MODEL_PATH}: ${exists}`);
      return exists;
    } catch (error) {
      console.error('Error checking model:', error);
      return false;
    }
  };

  const downloadModel = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      // Ensure directory exists
      const dirExists = await RNFS.exists(MODELS_PATH);
      if (!dirExists) {
        console.log('📁 Creating models directory...');
        await RNFS.mkdir(MODELS_PATH);
      }

      console.log('⬇️ Starting model download...');
      const downloadResult = RNFS.downloadFile({
        fromUrl: MODEL_URL,
        toFile: MODEL_PATH,
        headers: {
          Authorization: `Bearer hf_${AUTH}`,
        },
        progress: res => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          setDownloadProgress(progress);
          console.log(`Download progress: ${progress.toFixed(1)}%`);
        },
        progressDivider: 1,
      });

      const result = await downloadResult.promise;

      if (result.statusCode === 200) {
        console.log('✅ Model downloaded successfully');
        setDownloading(false);
        return true;
      } else {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('❌ Download error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Download failed';
      setDownloadError(errorMessage);
      setDownloading(false);
      return false;
    }
  };

  const initModel = useCallback(async () => {
    try {
      console.log('🔄 Initializing model...');
      const modelExists = await checkModelExists();

      if (!modelExists) {
        console.log('📥 Model not found, starting download...');
        const downloaded = await downloadModel();
        if (!downloaded) {
          console.error('❌ Model download failed');
          return;
        }
      }

      if (!MODEL_PATH) throw new Error('MODEL_PATH is null');

      console.log('🚀 Loading model into inference engine...');
      await GemmaInference.initialize(MODEL_PATH);
      setModelReady(true);
      console.log('✅ Model ready!');
    } catch (error) {
      console.error('❌ Model initialization failed:', error);
      setDownloadError(
        error instanceof Error ? error.message : 'Initialization failed',
      );
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('chats');
      if (stored) {
        const parsed = JSON.parse(stored);
        setChats(parsed);
        if (parsed.length > 0) setActiveChat(parsed[0].id);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  }, []);

  useEffect(() => {
    loadChats();
    initModel();
  }, [initModel, loadChats]);

  const saveChats = async (newChats: Chat[]) => {
    await AsyncStorage.setItem('chats', JSON.stringify(newChats));
    setChats(newChats);
  };

  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
    };
    const updated = [newChat, ...chats];
    saveChats(updated);
    setActiveChat(newChat.id);
    setSidebarOpen(false);
  };

  const pickImage = () => {
    launchImageLibrary({ mediaType: 'photo' }, response => {
      if (response.assets?.[0]?.uri) {
        setSelectedImage(response.assets[0].uri);
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;
    if (!activeChat || !modelReady) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      image: selectedImage || undefined,
    };

    const updatedChats = chats.map(chat =>
      chat.id === activeChat
        ? {
            ...chat,
            messages: [...chat.messages, userMsg],
            title: chat.messages.length === 0 ? input.slice(0, 30) : chat.title,
          }
        : chat,
    );

    saveChats(updatedChats);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const response = await GemmaInference.generate(input, selectedImage);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'ai',
      };

      const finalChats = updatedChats.map(chat =>
        chat.id === activeChat
          ? { ...chat, messages: [...chat.messages, aiMsg] }
          : chat,
      );
      saveChats(finalChats);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryDownload = () => {
    setDownloadError(null);
    initModel();
  };

  const activeMessages = chats.find(c => c.id === activeChat)?.messages || [];

  return (
    <View style={styles.container}>
      {/* Download Modal */}
      <Modal
        visible={downloading || downloadError !== null}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {downloading ? (
              <>
                <Text style={styles.modalTitle}>Downloading Model</Text>
                <Text style={styles.modalSubtitle}>
                  Please wait until the AI model is downloaded...
                </Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${downloadProgress}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {downloadProgress.toFixed(1)}%
                  </Text>
                </View>
                <ActivityIndicator
                  size="large"
                  color="#007AFF"
                  style={styles.spinner}
                />
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Download Failed</Text>
                <Text style={styles.errorText}>{downloadError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={retryDownload}
                >
                  <Text style={styles.retryText}>Retry Download</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={sidebarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSidebarOpen(false)}
      >
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPressOut={() => setSidebarOpen(false)}
        >
          <View style={styles.sidebarModal}>
            <TouchableOpacity style={styles.newChatBtn} onPress={createNewChat}>
              <Text style={styles.newChatText}>+ New Chat</Text>
            </TouchableOpacity>
            <FlatList
              data={chats}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.chatItem,
                    activeChat === item.id && styles.activeChatItem,
                  ]}
                  onPress={() => {
                    setActiveChat(item.id);
                    setSidebarOpen(false);
                  }}
                >
                  <Text style={styles.chatTitle}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.main}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSidebarOpen(!sidebarOpen)}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LAI - Gemma 3N E2B</Text>
          {!modelReady && !downloading && (
            <Text style={styles.statusBadge}>Initializing...</Text>
          )}
        </View>

        <FlatList
          data={activeMessages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View
              style={[
                styles.message,
                item.sender === 'user' ? styles.userMsg : styles.aiMsg,
              ]}
            >
              {item.image && (
                <Image source={{ uri: item.image }} style={styles.msgImage} />
              )}
              <Text
                style={
                  item.sender === 'user' ? styles.userText : styles.msgText
                }
              >
                {item.text}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.messageList}
        />

        {loading && <ActivityIndicator size="large" color="#007AFF" />}

        <View style={styles.inputContainer}>
          {selectedImage && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.preview} />
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Text style={styles.removeImg}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message Gemma..."
              multiline
              editable={modelReady}
            />
            <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
              <Image
                style={styles.icon}
                resizeMode="contain"
                source={cameraIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={sendMessage}
              style={[
                styles.sendBtn,
                (!modelReady || loading) && styles.sendBtnDisabled,
              ]}
              disabled={loading || !modelReady}
            >
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  main: { flex: 1, backgroundColor: '#fff' },
  menuIcon: { fontSize: 24, marginRight: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  statusBadge: { fontSize: 12, color: '#007AFF', fontWeight: '500' },
  messageList: { padding: 15 },
  message: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 10 },
  userMsg: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  aiMsg: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  msgText: { fontSize: 15, color: '#000' },
  userText: { fontSize: 15, color: '#fff' },
  msgImage: { width: 200, height: 200, borderRadius: 8, marginBottom: 8 },
  inputContainer: { borderTopWidth: 1, borderTopColor: '#eee', padding: 10 },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  preview: { width: 60, height: 60, borderRadius: 8, marginRight: 8 },
  removeImg: { fontSize: 20, color: '#ff3b30' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  iconBtn: { padding: 8 },
  icon: { width: 24, height: 24 },
  sendBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendText: { color: '#fff', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: { width: '100%', marginBottom: 20 },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#007AFF', borderRadius: 4 },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
  },
  spinner: { marginTop: 10 },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
  },
  sidebarModal: {
    width: 250,
    backgroundColor: '#1a1a1a',
    padding: 10,
    height: '100%',
  },
  newChatBtn: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  newChatText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chatItem: { padding: 12, borderRadius: 6, marginBottom: 4 },
  activeChatItem: { backgroundColor: '#2a2a2a' },
  chatTitle: { color: '#ddd', fontSize: 14 },
});

export default App;
