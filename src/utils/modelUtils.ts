import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const MODEL_URL =
  'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4.litertlm?download=true';
const MODEL_NAME = 'gemma3n.litertlm';
const AUTH = 'DGcJdsXFviAtKytYDLoaFvrmdUAyMYAHca';

// Use external storage for persistent model storage across app updates
// On Android: Use ExternalDirectoryPath (app-specific external storage, survives updates)
// On iOS: falls back to DocumentDirectory (iOS apps are sandboxed)
const BASE_PATH = Platform.OS === 'android'
  ? RNFS.ExternalDirectoryPath
  : RNFS.DocumentDirectoryPath;
const MODELS_PATH = `${BASE_PATH}/.laiModels`;
const MODEL_PATH = `${MODELS_PATH}/${MODEL_NAME}`;

export { MODEL_PATH, MODEL_URL, MODELS_PATH, AUTH };

export interface DownloadProgress {
  progress: number;
  bytesWritten: number;
  totalBytes: number;
}

export const requestStoragePermission = async (): Promise<boolean> => {
  // App-specific external storage (ExternalDirectoryPath) doesn't require permissions
  // on any Android version. It's accessible without WRITE_EXTERNAL_STORAGE permission.
  return true;
};

export const checkModelExists = async (): Promise<boolean> => {
  try {
    const exists = await RNFS.exists(MODEL_PATH);
    console.log(`Model exists at ${MODEL_PATH}: ${exists}`);
    return exists;
  } catch (error) {
    console.error('Error checking model:', error);
    return false;
  }
};

export const downloadModel = async (
  onProgress?: (progress: DownloadProgress) => void
): Promise<boolean> => {
  try {
    // Request storage permission first
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      throw new Error('Storage permission denied. Please grant permission to download the model.');
    }

    const dirExists = await RNFS.exists(MODELS_PATH);
    if (!dirExists) {
      console.log('Creating models directory...');
      await RNFS.mkdir(MODELS_PATH);
    }

    console.log('Starting model download...');
    const downloadResult = RNFS.downloadFile({
      fromUrl: MODEL_URL,
      toFile: MODEL_PATH,
      headers: {
        Authorization: `Bearer hf_${AUTH}`,
      },
      progress: res => {
        const progress = (res.bytesWritten / res.contentLength) * 100;
        console.log(`Download progress: ${progress.toFixed(1)}%`);

        if (onProgress) {
          onProgress({
            progress,
            bytesWritten: res.bytesWritten,
            totalBytes: res.contentLength,
          });
        }
      },
      progressDivider: 1,
    });

    const result = await downloadResult.promise;

    if (result.statusCode === 200) {
      console.log('Model downloaded successfully');
      return true;
    } else {
      throw new Error(`Download failed with status: ${result.statusCode}`);
    }
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
};

export const handleNetworkError = (error: unknown): string => {
  let errorMessage = 'An error occurred';

  if (error instanceof Error) {
    errorMessage = error.message;
    // Handle network-specific errors
    if (errorMessage.includes('Network request failed') ||
        errorMessage.includes('Unable to resolve host') ||
        errorMessage.includes('timeout')) {
      errorMessage = 'No internet connection. Please check your network and try again.';
    }
  }

  return errorMessage;
};
