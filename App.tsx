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
  StatusBar,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { GemmaInference } from './src/inference/GemmaInference';
import { DownloadModal } from './src/components/DownloadModal';
import {
  MODEL_PATH,
  checkModelExists,
  downloadModel,
  handleNetworkError,
} from './src/utils/modelUtils';
import {
  Message,
  loadMessages as loadStoredMessages,
  saveMessages as saveStoredMessages,
} from './src/utils/messageUtils';
import { darkTheme } from './src/utils/theme';

const cameraIcon = require('./assets/camera.png');

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [bytesWritten, setBytesWritten] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(0);
    setBytesWritten(0);
    setTotalBytes(0);
    setDownloadError(null);

    try {
      await downloadModel(progress => {
        setDownloadProgress(progress.progress);
        setBytesWritten(progress.bytesWritten);
        setTotalBytes(progress.totalBytes);
      });
      setDownloading(false);
      return true;
    } catch (error) {
      const errorMessage = handleNetworkError(error);
      setDownloadError(errorMessage);
      setDownloading(false);
      return false;
    }
  };

  const initModel = useCallback(async () => {
    try {
      console.log('Initializing model...');
      const modelExists = await checkModelExists();

      if (!modelExists) {
        console.log('Model not found, starting download...');
        const downloaded = await handleDownload();
        if (!downloaded) {
          console.error('Model download failed');
          return;
        }
      }

      if (!MODEL_PATH) throw new Error('MODEL_PATH is null');

      console.log('Loading model into inference engine...');
      await GemmaInference.initialize(MODEL_PATH);
      setModelReady(true);
      console.log('Model ready!');
    } catch (error) {
      console.error('Model initialization failed:', error);
      const errorMessage = handleNetworkError(error);
      setDownloadError(errorMessage);
      setModelReady(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const stored = await loadStoredMessages();
    setMessages(stored);
  }, []);

  const saveMessages = async (newMessages: Message[]) => {
    await saveStoredMessages(newMessages);
  };

  useEffect(() => {
    loadMessages();
    initModel();
  }, [initModel, loadMessages]);

  const pickImage = () => {
    launchImageLibrary({ mediaType: 'photo' }, response => {
      if (response.assets?.[0]?.uri) {
        setSelectedImage(response.assets[0].uri);
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() && !selectedImage) return;
    if (!modelReady) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      image: selectedImage || undefined,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    await saveMessages(updatedMessages);

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

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      await saveMessages(finalMessages);
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={darkTheme.headerBackground} />
      <DownloadModal
        visible={downloading || downloadError !== null}
        downloading={downloading}
        downloadProgress={downloadProgress}
        bytesWritten={bytesWritten}
        totalBytes={totalBytes}
        downloadError={downloadError}
        onRetry={retryDownload}
      />

      <View style={styles.main}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>LAI - Gemma 3N E2B</Text>
          {!modelReady && !downloading && (
            <Text style={styles.statusBadge}>Initializing...</Text>
          )}
        </View>

        <FlatList
          data={messages}
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

        {loading && <ActivityIndicator size="large" color={darkTheme.primary} />}

        <View style={styles.inputContainer}>
          {selectedImage && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage }} style={styles.preview} />
              <TouchableOpacity onPress={() => setSelectedImage(null)}>
                <Text style={styles.removeImg}>X</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message Gemma..."
              placeholderTextColor={darkTheme.textPlaceholder}
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
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  main: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: darkTheme.border,
    backgroundColor: darkTheme.headerBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    color: darkTheme.textPrimary,
  },
  statusBadge: {
    fontSize: 12,
    color: darkTheme.statusText,
    fontWeight: '500',
  },
  messageList: {
    padding: 15,
    paddingBottom: 20,
  },
  message: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  userMsg: {
    alignSelf: 'flex-end',
    backgroundColor: darkTheme.userMessage,
  },
  aiMsg: {
    alignSelf: 'flex-start',
    backgroundColor: darkTheme.aiMessage,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
    color: darkTheme.textPrimary,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: darkTheme.textPrimary,
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: darkTheme.border,
    padding: 12,
    paddingBottom: 20,
    backgroundColor: darkTheme.background,
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  preview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  removeImg: {
    fontSize: 20,
    color: darkTheme.danger,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: darkTheme.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 120,
    backgroundColor: darkTheme.inputBackground,
    color: darkTheme.textPrimary,
    fontSize: 15,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: darkTheme.textSecondary,
  },
  sendBtn: {
    backgroundColor: darkTheme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendBtnDisabled: {
    backgroundColor: darkTheme.disabled,
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default App;
