package com.sanfortsmartlearning.ar

import android.net.Uri
import android.util.Base64
import android.content.Intent
import com.google.ar.core.ArCoreApk
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.URL
import org.json.JSONArray

class ARModule(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext) {

    companion object {
        var reactContext: ReactApplicationContext? = null
    }

    init {
        ARModule.reactContext = reactContext
    }

    override fun getName() = "ARNativeModule"

    @ReactMethod
    fun openAR(
            modelPath: String,
            modelName: String?,
            audiosJson: String?,
            animationsJson: String?,
            modelType: String?,
            hideColorMode: Boolean?,
            childName: String?
    ) {
        Thread {
            val resolvedModelPath =
                runCatching { resolveModelPathForAR(modelPath, modelName, modelType) }
                    .onFailure {
                        android.util.Log.w("ARModule", "Model prefetch failed. Falling back to original model path.", it)
                    }
                    .getOrDefault(modelPath)

            val intent = Intent(reactContext, ARActivity::class.java).apply {
                putExtra("modelPath", resolvedModelPath)
                if (!modelName.isNullOrBlank()) putExtra("modelName", modelName)
                if (!audiosJson.isNullOrBlank()) putExtra("audiosJson", audiosJson)
                if (!animationsJson.isNullOrBlank()) putExtra("animationsJson", animationsJson)
                if (!modelType.isNullOrBlank()) putExtra("modelType", modelType)
                if (hideColorMode == true) putExtra("hideColorMode", true)
                if (!childName.isNullOrBlank()) putExtra("childName", childName)
            }
            launchIntent(intent)
        }.start()
    }

    @ReactMethod
    fun setAnimation(index: Int) {
        ARActivityHolder.activity?.runOnUiThread { ARActivityHolder.activity?.playAnimation(index) }
    }

    @ReactMethod
    fun openARFromBase64(
            modelBase64: String,
            modelName: String?,
            originalModelPath: String?,
            audiosJson: String?,
            animationsJson: String?,
            modelType: String?,
            hideColorMode: Boolean?,
            childName: String?,
            promise: Promise
    ) {
        try {
            val bytes = Base64.decode(modelBase64, Base64.DEFAULT)
            val output = File(reactContext.cacheDir, "custom_model_${System.currentTimeMillis()}.glb")
            FileOutputStream(output).use { it.write(bytes) }

            val intent = Intent(reactContext, ARActivity::class.java)
            intent.putExtra("modelPath", Uri.fromFile(output).toString())
            if (!originalModelPath.isNullOrBlank()) intent.putExtra("originalModelPath", originalModelPath)
            if (!modelName.isNullOrBlank()) intent.putExtra("modelName", modelName)
            if (!audiosJson.isNullOrBlank()) intent.putExtra("audiosJson", audiosJson)
            if (!animationsJson.isNullOrBlank()) intent.putExtra("animationsJson", animationsJson)
            if (!modelType.isNullOrBlank()) intent.putExtra("modelType", modelType)
            if (hideColorMode == true) intent.putExtra("hideColorMode", true)
            if (!childName.isNullOrBlank()) intent.putExtra("childName", childName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(output.absolutePath)
        } catch (error: Exception) {
            promise.reject("AR_EXPORT_FAILED", error)
        }
    }

    @ReactMethod
    fun isARScannerSupported(promise: Promise) {
        try {
            val availability = ArCoreApk.getInstance().checkAvailability(reactContext)
            promise.resolve(availability.isSupported)
        } catch (error: Exception) {
            promise.reject("AR_SUPPORT_CHECK_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun checkScannerAssets(referenceImageAsset: String, modelAsset: String, promise: Promise) {
        try {
            val result = Arguments.createMap().apply {
                putBoolean("referenceImageExists", assetExists(referenceImageAsset))
                putBoolean("modelExists", assetExists(modelAsset))
            }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("AR_ASSET_CHECK_FAILED", error.message, error)
        }
    }

    @ReactMethod
    fun startScanner(referenceImageAsset: String, modelAsset: String) {
        val launchIntent = Intent(reactContext, ARScannerActivity::class.java).apply {
            putExtra(ARScannerActivity.EXTRA_REFERENCE_IMAGE_ASSET, referenceImageAsset)
            putExtra(ARScannerActivity.EXTRA_MODEL_ASSET, modelAsset)
        }
        val activity = reactContext.currentActivity
        if (activity != null) {
            activity.startActivity(launchIntent)
        } else {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(launchIntent)
        }
    }

    @ReactMethod
    fun startScannerDynamic(modelUrl: String, referenceImageUrl: String, modelName: String, audiosJson: String?, promise: Promise) {
        Thread {
            try {
                val cacheDir = File(reactContext.cacheDir, "ar_scanner_cache")
                if (!cacheDir.exists()) cacheDir.mkdirs()

                val safeName = modelName.replace("[^a-zA-Z0-9]".toRegex(), "_")

                // Handle model GLB (supporting local file:// or network http://)
                val modelFile: File = when {
                    modelUrl.startsWith("file://") || modelUrl.startsWith("/") -> {
                        val path = if (modelUrl.startsWith("file://")) modelUrl.removePrefix("file://") else modelUrl
                        val f = File(path)
                        if (!f.exists()) throw IOException("Local model file not found: $path")
                        f
                    }
                    else -> {
                        val dest = File(cacheDir, "${safeName}.glb")
                        downloadFileWithCache(modelUrl, dest)
                        dest
                    }
                }

                val isHttpReference =
                    referenceImageUrl.startsWith("http://") || referenceImageUrl.startsWith("https://")
                val isFileReference =
                    referenceImageUrl.startsWith("/") || referenceImageUrl.startsWith("file://")

                val referenceFile: File?
                val referenceAsset: String?
                if (isHttpReference) {
                    // Download reference image (with caching)
                    val downloadedReference = File(cacheDir, "${safeName}_reference.jpg")
                    downloadFileWithCache(referenceImageUrl, downloadedReference)
                    referenceFile = downloadedReference
                    referenceAsset = null
                } else if (isFileReference) {
                    val path =
                        if (referenceImageUrl.startsWith("file://")) {
                            referenceImageUrl.removePrefix("file://")
                        } else {
                            referenceImageUrl
                        }
                    val file = File(path)
                    if (!file.exists()) {
                        throw IOException("Reference image file not found: $path")
                    }
                    referenceFile = file
                    referenceAsset = null
                } else {
                    if (!assetExists(referenceImageUrl)) {
                        throw IOException("Reference image asset not found: $referenceImageUrl")
                    }
                    referenceFile = null
                    referenceAsset = referenceImageUrl
                }

                val launchIntent = Intent(reactContext, ARScannerActivity::class.java).apply {
                    putExtra(ARScannerActivity.EXTRA_MODEL_FILE_PATH, modelFile.absolutePath)
                    if (referenceFile != null) {
                        putExtra(ARScannerActivity.EXTRA_REFERENCE_IMAGE_FILE_PATH, referenceFile.absolutePath)
                    }
                    if (referenceAsset != null) {
                        putExtra(ARScannerActivity.EXTRA_REFERENCE_IMAGE_ASSET, referenceAsset)
                    }
                    putExtra("modelName", modelName)
                    if (!audiosJson.isNullOrBlank()) putExtra("audiosJson", audiosJson)
                }
                val activity = reactContext.currentActivity
                if (activity != null) {
                    activity.runOnUiThread {
                        activity.startActivity(launchIntent)
                    }
                } else {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactContext.startActivity(launchIntent)
                }

                promise.resolve(true)
            } catch (error: Exception) {
                android.util.Log.e("ARModule", "AR Scanner launch failed", error)
                promise.reject("AR_SCANNER_LAUNCH_FAILED", error.message, error)
            }
        }.start()
    }

    private fun launchIntent(intent: Intent) {
        val activity = reactContext.currentActivity
        if (activity != null) {
            activity.runOnUiThread { activity.startActivity(intent) }
        } else {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        }
    }

    private fun resolveModelPathForAR(modelPath: String, modelName: String?, modelType: String?): String {
        val trimmed = modelPath.trim()
        if (trimmed.isBlank()) {
            return modelPath
        }
        if (modelType == "multiple-glb" && trimmed.startsWith("[")) {
            return resolveMultiPartModelPath(trimmed, modelName)
        }
        return resolveSingleModelPath(trimmed, modelName)
    }

    private fun resolveMultiPartModelPath(modelPathJson: String, modelName: String?): String {
        val arr = JSONArray(modelPathJson)
        val resolved = JSONArray()
        val safeBase = sanitizeName(modelName ?: "model")
        val cacheDir = File(reactContext.cacheDir, "ar_model_cache").apply { mkdirs() }

        for (index in 0 until arr.length()) {
            val part = arr.getJSONObject(index)
            val partUrl = part.optString("url").orEmpty().trim()
            if (partUrl.isBlank()) {
                resolved.put(part)
                continue
            }
            val resolvedUrl = when {
                partUrl.startsWith("http://") || partUrl.startsWith("https://") -> {
                    val partId = sanitizeName(part.optString("id").ifBlank { "part_$index" })
                    val ext = guessModelExtension(partUrl)
                    val hash = Integer.toHexString(partUrl.hashCode())
                    val file = File(cacheDir, "${safeBase}_${partId}_$hash.$ext")
                    downloadFileWithCache(partUrl, file)
                    Uri.fromFile(file).toString()
                }
                partUrl.startsWith("/") -> Uri.fromFile(File(partUrl)).toString()
                else -> partUrl
            }
            part.put("url", resolvedUrl)
            resolved.put(part)
        }
        return resolved.toString()
    }

    private fun resolveSingleModelPath(modelPath: String, modelName: String?): String {
        return when {
            modelPath.startsWith("http://") || modelPath.startsWith("https://") -> {
                val safeBase = sanitizeName(modelName ?: "model")
                val ext = guessModelExtension(modelPath)
                val hash = Integer.toHexString(modelPath.hashCode())
                val cacheDir = File(reactContext.cacheDir, "ar_model_cache").apply { mkdirs() }
                val modelFile = File(cacheDir, "${safeBase}_$hash.$ext")
                downloadFileWithCache(modelPath, modelFile)
                Uri.fromFile(modelFile).toString()
            }
            modelPath.startsWith("/") -> Uri.fromFile(File(modelPath)).toString()
            modelPath.startsWith("file://") -> modelPath
            else -> modelPath
        }
    }

    private fun sanitizeName(raw: String): String {
        val cleaned = raw.lowercase().replace(Regex("[^a-z0-9_]"), "_").trim('_')
        return if (cleaned.isBlank()) "model" else cleaned
    }

    private fun guessModelExtension(modelUrl: String): String {
        val base = modelUrl.substringBefore('?').substringBefore('#').lowercase()
        return if (base.endsWith(".gltf")) "gltf" else "glb"
    }

    private fun downloadFileWithCache(urlString: String, outputFile: File) {
        android.util.Log.i("ARModule", "Download request: url=$urlString dest=${outputFile.name}")
        // Skip download if cached and less than 24 hours old
        if (outputFile.exists() && outputFile.length() > 0) {
            val ageMs = System.currentTimeMillis() - outputFile.lastModified()
            if (ageMs < 24 * 60 * 60 * 1000) {
                android.util.Log.i("ARModule", "Using cached: ${outputFile.name} size=${outputFile.length()} bytes")
                return
            }
        }
        val url = URL(urlString)
        val connection = url.openConnection()
        if (connection is java.net.HttpURLConnection) {
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            connection.instanceFollowRedirects = true
            val responseCode = connection.responseCode
            val contentType = connection.contentType ?: "unknown"
            android.util.Log.i("ARModule", "Download response: code=$responseCode contentType=$contentType url=$urlString")
            if (responseCode != 200) {
                throw IOException("Download failed with HTTP $responseCode for $urlString")
            }
        }
        connection.inputStream.use { input ->
            FileOutputStream(outputFile).use { output ->
                input.copyTo(output)
            }
        }
        android.util.Log.i("ARModule", "Downloaded: ${outputFile.name} size=${outputFile.length()} bytes")
    }

    private fun assetExists(assetName: String): Boolean {
        return runCatching { reactContext.assets.open(assetName).close() }.isSuccess
    }

    // Required stubs for NativeEventEmitter on the JS side
    @ReactMethod
    fun addListener(eventName: String) {
        /* no-op */
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        /* no-op */
    }
}
