package com.ilifelearn.ar

import android.net.Uri
import android.util.Base64
import android.content.Intent
import com.google.ar.core.ArCoreApk
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

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
            animationsJson: String?
    ) {
        val intent = Intent(reactContext, ARActivity::class.java)
        intent.putExtra("modelPath", modelPath)
        if (!modelName.isNullOrBlank()) intent.putExtra("modelName", modelName)
        if (!audiosJson.isNullOrBlank()) intent.putExtra("audiosJson", audiosJson)
        if (!animationsJson.isNullOrBlank()) intent.putExtra("animationsJson", animationsJson)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun setAnimation(index: Int) {
        ARActivityHolder.activity?.runOnUiThread { ARActivityHolder.activity?.playAnimation(index) }
    }

    @ReactMethod
    fun openARFromBase64(
            modelBase64: String,
            modelName: String?,
            audiosJson: String?,
            animationsJson: String?,
            promise: Promise
    ) {
        try {
            val bytes = Base64.decode(modelBase64, Base64.DEFAULT)
            val output = File(reactContext.cacheDir, "custom_model_${System.currentTimeMillis()}.glb")
            FileOutputStream(output).use { it.write(bytes) }

            val intent = Intent(reactContext, ARActivity::class.java)
            intent.putExtra("modelPath", Uri.fromFile(output).toString())
            if (!modelName.isNullOrBlank()) intent.putExtra("modelName", modelName)
            if (!audiosJson.isNullOrBlank()) intent.putExtra("audiosJson", audiosJson)
            if (!animationsJson.isNullOrBlank()) intent.putExtra("animationsJson", animationsJson)
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
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(launchIntent)
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
