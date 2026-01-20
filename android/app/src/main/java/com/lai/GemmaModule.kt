package com.lai

import android.graphics.BitmapFactory
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession
import com.google.mediapipe.tasks.genai.llminference.GraphOptions
import com.google.mediapipe.framework.image.BitmapImageBuilder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class GemmaModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var model: LlmInference? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    override fun getName(): String = "GemmaModule"

    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        scope.launch {
            try {
                val modelFile = File(modelPath)

                if (!modelFile.exists()) {
                    promise.reject("LOAD_ERROR", "Model file not found at: $modelPath")
                    return@launch
                }

                if (modelFile.length() == 0L) {
                    promise.reject("LOAD_ERROR", "Model file is empty: $modelPath")
                    return@launch
                }

                android.util.Log.d("GemmaModule", "Loading model from: ${modelFile.absolutePath}")

                val options = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(modelFile.absolutePath)
                    .setMaxTokens(1000)
                    .setMaxNumImages(10)
                    .build()

                model = withContext(Dispatchers.IO) {
                    LlmInference.createFromOptions(reactApplicationContext, options)
                }

                android.util.Log.d("GemmaModule", "Model loaded successfully")
                promise.resolve("Model loaded successfully")
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "Failed to load model", e)
                promise.reject("LOAD_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun generate(prompt: String, promise: Promise) {
        if (model == null) {
            promise.reject("NO_MODEL", "Model not loaded")
            return
        }

        scope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    model!!.generateResponse(prompt)
                }
                promise.resolve(response)
            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "Generation failed", e)
                promise.reject("GENERATE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun generateWithImage(prompt: String, imagePath: String, promise: Promise) {
        if (model == null) {
            promise.reject("NO_MODEL", "Model not loaded")
            return
        }

        scope.launch {
            try {
                val imageFile = File(imagePath)
                if (!imageFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Image file does not exist at $imagePath")
                    return@launch
                }

                val bitmap = withContext(Dispatchers.IO) { 
                    BitmapFactory.decodeFile(imagePath)
                }
                
                if (bitmap == null) {
                    promise.reject("INVALID_IMAGE", "Failed to decode image")
                    return@launch
                }

                val mpImage = BitmapImageBuilder(bitmap).build()

                val response = withContext(Dispatchers.IO) {
                    val graphOptions = GraphOptions.builder()
                        .setIncludeTokenCostCalculator(true)
                        .setEnableVisionModality(true)
                        .setEnableAudioModality(false)
                        .build()

                    val sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                        .setTopK(40)
                        .setTemperature(0.8f)
                        .setGraphOptions(graphOptions)
                        .build()

                    LlmInferenceSession.createFromOptions(model!!, sessionOptions).use { session ->
                        session.addQueryChunk(prompt)
                        session.addImage(mpImage)
                        session.generateResponse()
                    }
                }

                bitmap.recycle()
                promise.resolve(response)

            } catch (e: Exception) {
                android.util.Log.e("GemmaModule", "Vision generation failed", e)
                promise.reject("GENERATE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun unloadModel(promise: Promise) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) { model?.close() }
                model = null
                promise.resolve("Model unloaded")
            } catch (e: Exception) {
                promise.reject("UNLOAD_ERROR", e.message, e)
            }
        }
    }
}