import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  image?: string;
}

export const loadMessages = async (): Promise<Message[]> => {
  try {
    const stored = await AsyncStorage.getItem('messages');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
};

export const saveMessages = async (messages: Message[]): Promise<void> => {
  try {
    await AsyncStorage.setItem('messages', JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving messages:', error);
  }
};
