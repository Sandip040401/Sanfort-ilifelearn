package com.ilifelearn.ar

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
      // Keep model lighting stable; ambient estimation can flicker to very dark on real devices.
      lightEstimationMode = Config.LightEstimationMode.DISABLED
      planeFindingMode = Config.PlaneFindingMode.DISABLED
    }
    buildImageDatabase(session)?.let { database ->
      config.augmentedImageDatabase = database
      isImageTrackingEnabled = true
    } ?: run {
      isImageTrackingEnabled = false
      Log.w(logTag, "Image tracking disabled until a high-quality reference image is provided.")
    }

    instructionsController.setEnabled(InstructionsController.TYPE_PLANE_DISCOVERY, false)
    instructionsController.setVisible(InstructionsController.TYPE_PLANE_DISCOVERY, false)
    arSceneView.planeRenderer.isVisible = false
    return config
  }

  fun setTrackingArguments(referenceImageAsset: String) {
    arguments = bundleOf(ARG_REFERENCE_IMAGE_ASSET to referenceImageAsset)
  }

  fun isTrackingReady(): Boolean = isImageTrackingEnabled

  private fun buildImageDatabase(session: Session): AugmentedImageDatabase? {
    val referenceAsset = arguments?.getString(ARG_REFERENCE_IMAGE_ASSET) ?: DEFAULT_REFERENCE_ASSET
    val bitmap = loadBitmapFromAsset(referenceAsset) ?: return null
    return try {
      AugmentedImageDatabase(session).apply {
        addImage(REFERENCE_IMAGE_NAME, bitmap)
      }
    } catch (error: ImageInsufficientQualityException) {
      Log.e(logTag, "Reference image quality is too low for ARCore tracking: $referenceAsset", error)
      null
    } catch (error: Exception) {
      Log.e(logTag, "Failed to build augmented image database for $referenceAsset", error)
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
  }
}
