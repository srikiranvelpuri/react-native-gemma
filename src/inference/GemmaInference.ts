import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

interface GemmaModuleInterface {
  loadModel(modelPath: string): Promise<string>;
  generate(prompt: string): Promise<string>;
  generateWithImage(prompt: string, imagePath: string): Promise<string>;
  unloadModel(): Promise<string>;
}

const { GemmaModule } = NativeModules as { GemmaModule: GemmaModuleInterface };

export class GemmaInference {
  private static modelPath: string = '';
  private static isInitialized: boolean = false;

  static async initialize(modelPath: string): Promise<void> {
    try {
      // Model will be copied from assets to app's internal storage
      this.modelPath = modelPath;

      console.log('Loading model from:', this.modelPath);

      // The native module will handle copying from assets if needed
      const result = await GemmaModule.loadModel(this.modelPath);
      this.isInitialized = true;
      console.log('✅ Model loaded:', result);
    } catch (error: any) {
      console.error('❌ Model initialization failed:', error.message || error);
      this.isInitialized = false;
      throw new Error(
        `Failed to initialize Gemma model: ${error.message || error}`,
      );
    }
  }

  static async generate(
    prompt: string,
    imagePath?: string | null,
  ): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('Model not initialized. Call initialize() first.');
      }

      if (!prompt || prompt.trim().length === 0) {
        throw new Error('Prompt cannot be empty');
      }

      console.log(
        '🤖 Generating response for:',
        prompt.substring(0, 50) + '...',
      );

      let response: string;
      if (imagePath && imagePath.trim().length > 0) {
        // Verify image exists
        const imageExists = await RNFS.exists(imagePath);
        if (!imageExists) {
          throw new Error(`Image not found at path: ${imagePath}`);
        }
        console.log('IMAGE_PATH', imagePath);
        const cleanPath = imagePath?.startsWith('file:///')
          ? imagePath?.substring(7)
          : imagePath;
        console.log('CLEAN_IMAGE_PATH', cleanPath);
        response = await GemmaModule.generateWithImage(prompt, cleanPath);
      } else {
        response = await GemmaModule.generate(prompt);
      }

      console.log('✅ Response generated successfully');
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      console.error('❌ Generation failed:', errorMessage);
      throw new Error(`Generation failed: ${errorMessage}`);
    }
  }

  static async unload(): Promise<void> {
    try {
      if (this.isInitialized) {
        await GemmaModule.unloadModel();
        this.isInitialized = false;
        console.log('✅ Model unloaded successfully');
      } else {
        console.log('ℹ️ Model was not loaded');
      }
    } catch (error: any) {
      console.error('❌ Failed to unload model:', error.message || error);
      throw error;
    }
  }

  static isModelLoaded(): boolean {
    return this.isInitialized;
  }

  static getModelPath(): string {
    return this.modelPath;
  }
}
