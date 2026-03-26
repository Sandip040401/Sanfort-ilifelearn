package com.sanfortsmartlearning.ar

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.os.bundleOf
import com.google.ar.core.AugmentedImageDatabase
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.exceptions.ImageInsufficientQualityException
import com.google.ar.sceneform.ux.ArFragment
import com.google.ar.sceneform.ux.InstructionsController
import java.io.IOException

class ARImageTrackingFragment : ArFragment() {
  private val logTag = "ARImageTrackingFragment"
  private var isImageTrackingEnabled = false

  override fun onCreateSessionConfig(session: Session): Config {
    val config = super.onCreateSessionConfig(session).apply {
      focusMode = Config.FocusMode.AUTO
      updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
      // ENVIRONMENTAL_HDR for realistic lighting (compatible with ARCore 1.31 + Sceneform 1.23)
      lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
      planeFindingMode = Config.PlaneFindingMode.DISABLED
      // Enable depth occlusion if supported (model hides behind real objects)
      if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
        depthMode = Config.DepthMode.AUTOMATIC
      }
    }
    buildImageDatabase(session)?.let { database ->
      config.augmentedImageDatabase = database
      isImageTrackingEnabled = true
    } ?: run {
      isImageTrackingEnabled = false
      Log.w(logTag, "Image tracking disabled until a high-quality reference image is provided.")
    }

    // Hide ALL scanning/instruction overlays (scan square, hand motion, etc.)
    instructionsController.setEnabled(InstructionsController.TYPE_PLANE_DISCOVERY, false)
    instructionsController.setVisible(InstructionsController.TYPE_PLANE_DISCOVERY, false)
    runCatching { instructionsController.isEnabled = false }
    arSceneView.planeRenderer.isVisible = false
    return config
  }

  fun setTrackingArguments(referenceImageAsset: String) {
    arguments = bundleOf(ARG_REFERENCE_IMAGE_ASSET to referenceImageAsset)
  }

  fun isTrackingReady(): Boolean = isImageTrackingEnabled

  private fun buildImageDatabase(session: Session): AugmentedImageDatabase? {
    val referenceSource = arguments?.getString(ARG_REFERENCE_IMAGE_ASSET) ?: DEFAULT_REFERENCE_ASSET
    val bitmap = loadBitmap(referenceSource) ?: return null
    return try {
      AugmentedImageDatabase(session).apply {
        // Provide physical width (meters) for more stable tracking; A4 page ~0.21m wide
        addImage(REFERENCE_IMAGE_NAME, bitmap, REFERENCE_IMAGE_WIDTH_METERS)
      }
    } catch (error: ImageInsufficientQualityException) {
      Log.e(logTag, "Reference image quality is too low for ARCore tracking: $referenceSource", error)
      null
    } catch (error: Exception) {
      Log.e(logTag, "Failed to build augmented image database for $referenceSource", error)
      null
    }
  }

  private fun loadBitmap(source: String): Bitmap? {
    // If source looks like a file path, load from file system
    if (source.startsWith("/") || source.startsWith("file://")) {
      return loadBitmapFromFile(source)
    }
    // Otherwise load from assets
    return loadBitmapFromAsset(source)
  }

  private fun loadBitmapFromFile(filePath: String): Bitmap? {
    val path = if (filePath.startsWith("file://")) filePath.removePrefix("file://") else filePath
    return try {
      val file = java.io.File(path)
      if (!file.exists()) {
        Log.w(logTag, "Reference image file not found: $path")
        return null
      }
      BitmapFactory.decodeFile(path)
    } catch (error: Exception) {
      Log.w(logTag, "Failed to load reference image from file: $path", error)
      null
    }
  }

  private fun loadBitmapFromAsset(assetPath: String): Bitmap? {
    return try {
      activity?.assets?.open(assetPath)?.use { stream ->
        BitmapFactory.decodeStream(stream)
      }
    } catch (error: IOException) {
      Log.w(logTag, "Reference image asset not found: $assetPath", error)
      null
    }
  }

  companion object {
    const val ARG_REFERENCE_IMAGE_ASSET = "referenceImageAsset"
    const val DEFAULT_REFERENCE_ASSET = "reference_bear_page.jpg"
    const val REFERENCE_IMAGE_NAME = "book_reference"
    // Approximate physical width of the coloring page in meters (~21cm for A4)
    private const val REFERENCE_IMAGE_WIDTH_METERS = 0.21f
  }
}
