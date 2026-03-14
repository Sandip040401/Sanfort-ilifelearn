package com.ilifelearn.ar

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.animation.AccelerateDecelerateInterpolator
import android.app.ActivityManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.SystemClock
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.animation.LinearInterpolator
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ilifelearn.R
import com.google.ar.core.ArCoreApk
import com.google.ar.core.AugmentedImage
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import com.google.ar.core.TrackingState
import com.google.ar.sceneform.AnchorNode
import com.google.ar.sceneform.ArSceneView
import com.google.ar.sceneform.Node
import com.google.ar.sceneform.Scene
import com.google.ar.sceneform.collision.Box
import com.google.ar.sceneform.animation.ModelAnimator
import com.google.ar.sceneform.math.Quaternion
import com.google.ar.sceneform.math.Vector3
import com.google.ar.sceneform.rendering.Light
import com.google.ar.sceneform.rendering.Material
import com.google.ar.sceneform.rendering.MaterialFactory
import com.google.ar.sceneform.rendering.ModelRenderable
import com.google.ar.sceneform.rendering.RenderableInstance
import com.google.ar.sceneform.rendering.ShapeFactory
import com.google.ar.sceneform.rendering.Texture
import com.google.ar.sceneform.ux.TransformableNode
import java.io.IOException
import java.util.ArrayDeque
import java.util.Collections
import java.util.WeakHashMap
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sqrt

class ARScannerActivity : AppCompatActivity() {
  private lateinit var instructionText: TextView
  private lateinit var arFragment: ARImageTrackingFragment
  private lateinit var scaleGestureDetector: ScaleGestureDetector

  private var sharedRenderable: ModelRenderable? = null
  private var lastTintUpdateTimeMs: Long = 0L
  private var sceneListenerAttached = false
  private var peekTouchListenerAttached = false
  private var firstTrackDetectedTimeMs: Long = 0L
  private var lastTintVector: FloatArray? = null
  private var lastAcceptedSampleColor: Int? = null
  private var lastAcceptedSampleTimeMs: Long = 0L
  private var pendingSampleColor: Int? = null
  private var pendingSampleStreak: Int = 0
  private var lastTintDebugLogTimeMs: Long = 0L
  private var lastSampleMissLogTimeMs: Long = 0L
  private var lastTextureApplyTimeMs: Long = 0L
  private var lastTextureSignature: Int? = null
  private var lastTextureStats: TextureStats? = null
  private var pendingTextureSignature: Int? = null
  private var pendingTextureStreak: Int = 0
  private var textureMaterialBuildInFlight = false
  private var hasAppliedPageTexture = false
  private var lastTextureMissLogTimeMs: Long = 0L
  private var lastTextureDebugLogTimeMs: Long = 0L
  private var loggedTintMaterialAttach = false
  private var loggedMissingTintTemplate = false
  private var liveTintMaterialTemplate: Material? = null
  private var lastTwoPointerAngleDegrees: Float? = null
  private var lastFrameProcessingTimeMs: Long = 0L
  private var lastFrameWorkDurationMs: Long = 0L
  private var performanceReliefUntilMs: Long = 0L
  private var lastAcceptedTextureBitmap: Bitmap? = null
  private val materialTextureBindingCache = WeakHashMap<Material, Int>()
  private val materialPbrInitialized = Collections.newSetFromMap(WeakHashMap<Material, Boolean>())
  private var lastSampledPageQuad: List<Pair<Float, Float>>? = null
  private var lastSampledPageQuadTimeMs: Long = 0L
  private var stablePageQuadStreak: Int = 0
  private val resizedSubjectMaskBySize = mutableMapOf<Int, BooleanArray>()
  private val resizedReferencePixelsBySize = mutableMapOf<Int, IntArray>()
  private val fullPageSubjectMaskBySize = mutableMapOf<Int, BooleanArray>()
  private val fullPageReferencePixelsBySize = mutableMapOf<Int, IntArray>()
  private var referenceSubjectMaskTemplate: SubjectMaskTemplate? = null
  private var requestedReferenceImageAsset: String = ARImageTrackingFragment.DEFAULT_REFERENCE_ASSET
  private var requestedModelAsset: String = DEFAULT_MODEL_ASSET
  private lateinit var performanceProfile: PerformanceProfile
  private val pendingColorConsensusBySize = mutableMapOf<Int, IntArray>()

  private val trackedNodes = mutableMapOf<Int, TrackedImageNode>()
  private var lastTrackingActiveTimeMs: Long = 0L
  private var modelEverCreated = false

  private val onUpdateListener = Scene.OnUpdateListener {
    onARFrameUpdate()
  }

  private val onPeekTouchListener = Scene.OnPeekTouchListener { _, motionEvent ->
    handleGestureTouch(motionEvent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_ar_scanner)

    instructionText = findViewById(R.id.instructionText)

    if (!isARCoreSupported()) {
      finish()
      return
    }
    performanceProfile = detectPerformanceProfile()

    requestedReferenceImageAsset =
        intent.getStringExtra(EXTRA_REFERENCE_IMAGE_ASSET)
            ?: ARImageTrackingFragment.DEFAULT_REFERENCE_ASSET
    requestedModelAsset = intent.getStringExtra(EXTRA_MODEL_ASSET) ?: DEFAULT_MODEL_ASSET
    setupGestureDetectors()
    prepareTintMaterialTemplate()

    val existingFragment = supportFragmentManager.findFragmentByTag(AR_FRAGMENT_TAG)
    arFragment = if (existingFragment is ARImageTrackingFragment) {
      existingFragment
    } else {
      runCatching {
            ARImageTrackingFragment().also { fragment ->
              fragment.setTrackingArguments(requestedReferenceImageAsset)
              supportFragmentManager
                  .beginTransaction()
                  .replace(R.id.arFragmentContainer, fragment, AR_FRAGMENT_TAG)
                  .commitNow()
            }
          }
          .getOrElse {
            Toast.makeText(this, "Unable to start AR scanner fragment.", Toast.LENGTH_LONG).show()
            finish()
            return
          }
    }
    arFragment.setTrackingArguments(requestedReferenceImageAsset)

    android.util.Log.i(
        "ARScannerActivity",
        "Performance profile tier=${performanceProfile.tier} " +
            "textureSample=${performanceProfile.textureSampleSizePx} " +
            "textureInterval=${performanceProfile.textureRefreshIntervalMs}ms " +
            "colorInterval=${performanceProfile.colorRefreshIntervalMs}ms",
    )

    loadRenderable(requestedModelAsset)
    window.decorView.post { attachSceneUpdateListenerIfReady() }
  }

  override fun onResume() {
    super.onResume()
    window.decorView.post { attachSceneUpdateListenerIfReady() }
  }

  override fun onDestroy() {
    trackedNodes.values.forEach {
      it.animator?.cancel()
      it.floatAnimator?.cancel()
      it.anchorNode.anchor?.detach()
      it.anchorNode.setParent(null)
    }
    trackedNodes.clear()
    if (::arFragment.isInitialized && sceneListenerAttached) {
      arFragment.arSceneView?.scene?.removeOnUpdateListener(onUpdateListener)
      sceneListenerAttached = false
    }
    if (::arFragment.isInitialized && peekTouchListenerAttached) {
      runCatching { arFragment.arSceneView?.scene?.removeOnPeekTouchListener(onPeekTouchListener) }
      peekTouchListenerAttached = false
    }
    super.onDestroy()
  }

  private fun attachSceneUpdateListenerIfReady() {
    if (sceneListenerAttached || !::arFragment.isInitialized) {
      return
    }
    val scene = arFragment.arSceneView?.scene ?: return
    scene.addOnUpdateListener(onUpdateListener)
    sceneListenerAttached = true
    if (!peekTouchListenerAttached) {
      scene.addOnPeekTouchListener(onPeekTouchListener)
      peekTouchListenerAttached = true
    }
  }

  private fun isARCoreSupported(): Boolean {
    val availability = ArCoreApk.getInstance().checkAvailability(this)
    if (!availability.isSupported) {
      Toast.makeText(this, "ARCore is not supported on this device.", Toast.LENGTH_LONG).show()
      return false
    }
    return true
  }

  private fun detectPerformanceProfile(): PerformanceProfile {
    val activityManager = getSystemService(ACTIVITY_SERVICE) as? ActivityManager
    val memoryClassMb = activityManager?.memoryClass ?: 0
    val lowRam = activityManager?.isLowRamDevice ?: false
    val cores = Runtime.getRuntime().availableProcessors().coerceAtLeast(1)

    val tier =
        when {
          lowRam || memoryClassMb in 1..256 || cores <= 4 -> PerformanceTier.LOW
          memoryClassMb >= 512 && cores >= 8 -> PerformanceTier.HIGH
          else -> PerformanceTier.MEDIUM
        }

    return when (tier) {
      PerformanceTier.LOW ->
          PerformanceProfile(
              tier = tier,
              colorRefreshIntervalMs = 130L,
              textureRefreshIntervalMs = 220L,
              minTextureApplyIntervalMs = 250L,
              textureSampleSizePx = 128,
          )
      PerformanceTier.MEDIUM ->
          PerformanceProfile(
              tier = tier,
              colorRefreshIntervalMs = 100L,
              textureRefreshIntervalMs = 160L,
              minTextureApplyIntervalMs = 180L,
              textureSampleSizePx = 192,
          )
      PerformanceTier.HIGH ->
          PerformanceProfile(
              tier = tier,
              colorRefreshIntervalMs = 80L,
              textureRefreshIntervalMs = 120L,
              minTextureApplyIntervalMs = 140L,
              textureSampleSizePx = 256,
          )
    }
  }

  private fun colorRefreshIntervalMs(): Long = performanceProfile.colorRefreshIntervalMs

  private fun textureRefreshIntervalMs(inPerformanceRelief: Boolean): Long {
    return if (inPerformanceRelief) {
      (performanceProfile.textureRefreshIntervalMs * 3L).coerceAtMost(450L)
    } else {
      performanceProfile.textureRefreshIntervalMs
    }
  }

  private fun minTextureApplyIntervalMs(inPerformanceRelief: Boolean): Long {
    return if (inPerformanceRelief) {
      (performanceProfile.minTextureApplyIntervalMs * 3L).coerceAtMost(550L)
    } else {
      performanceProfile.minTextureApplyIntervalMs
    }
  }

  private fun textureSampleSizePx(inPerformanceRelief: Boolean): Int {
    return if (inPerformanceRelief) {
      (performanceProfile.textureSampleSizePx * 2 / 3).coerceAtLeast(80)
    } else {
      performanceProfile.textureSampleSizePx
    }
  }

  private fun loadRenderable(modelAsset: String) {
    instructionText.text = "Loading 3D model..."
    val assetUri = android.net.Uri.parse("file:///android_asset/$modelAsset")
    val assetExists =
        runCatching {
              assets.open(modelAsset).use { stream -> stream.available() > 0 }
            }
            .getOrElse {
              if (it is IOException) {
                android.util.Log.e("ARScannerActivity", "Model asset missing in APK assets: $modelAsset", it)
              }
              false
            }
    if (!assetExists) {
      loadFallbackRenderable()
      instructionText.text =
          "Model asset missing. Add $requestedModelAsset in assets. Tracking status: ${instructionForTrackingState()}"
      return
    }

    val loadFuture =
        ModelRenderable.builder()
            .setSource(this, assetUri)
            .setIsFilamentGltf(true)
            .setAsyncLoadEnabled(true)
            .setRegistryId("asset://$modelAsset")
            .build()

    loadFuture
        .thenAccept { renderable: ModelRenderable ->
          android.util.Log.i("ARScannerActivity", "Loaded model renderable from $assetUri")
          sharedRenderable = renderable
          instructionText.text = instructionForTrackingState()
        }
        .exceptionally { error: Throwable ->
          runOnUiThread {
            loadFallbackRenderable()
            instructionText.text =
                "Model load failed. Check $requestedModelAsset format. Tracking status: ${instructionForTrackingState()}"
          }
          android.util.Log.e("ARScannerActivity", "Failed to load model: $requestedModelAsset", error)
          null
        }
  }

  private fun loadFallbackRenderable() {
    MaterialFactory.makeOpaqueWithColor(
            this,
            com.google.ar.sceneform.rendering.Color(android.graphics.Color.parseColor("#D9B38C")),
        )
        .thenAccept { material ->
          sharedRenderable = ShapeFactory.makeSphere(0.06f, Vector3.zero(), material)
          instructionText.text =
          "Fallback model active. Add $requestedModelAsset in assets for production."
        }
  }

  private fun prepareTintMaterialTemplate() {
    MaterialFactory.makeOpaqueWithColor(
            this,
            com.google.ar.sceneform.rendering.Color(android.graphics.Color.WHITE),
        )
        .thenAccept { material ->
          runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
          runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
          liveTintMaterialTemplate = material
          android.util.Log.i("ARScannerActivity", "Tint material template is ready.")
        }
        .exceptionally { error ->
          android.util.Log.w("ARScannerActivity", "Failed to prepare tint material template.", error)
          null
        }
  }

  private fun instructionForTrackingState(): String {
    return if (arFragment.isTrackingReady()) {
      "Print the image & place flat on table. Hold phone above it at 45° angle."
    } else {
      "Reference image missing/low quality. Add assets/$requestedReferenceImageAsset."
    }
  }

  private fun onARFrameUpdate() {
    val frameWorkStartMs = SystemClock.elapsedRealtime()
    val now = SystemClock.elapsedRealtime()
    if ((now - lastFrameProcessingTimeMs) < FRAME_PROCESS_INTERVAL_MS) {
      return
    }
    lastFrameProcessingTimeMs = now

    if (!::arFragment.isInitialized) {
      return
    }

    val sceneView = arFragment.arSceneView ?: return
    val scene = sceneView.scene ?: return
    val frame = sceneView.arFrame ?: return
    val renderable = sharedRenderable ?: return

    var anyTracking = false
    frame.getUpdatedTrackables(AugmentedImage::class.java).forEach { image ->
      when (image.trackingState) {
        TrackingState.TRACKING -> {
          anyTracking = true
          lastTrackingActiveTimeMs = now
          if (!trackedNodes.containsKey(image.index)) {
            if (trackedNodes.isEmpty()) {
              firstTrackDetectedTimeMs = now
            }
            trackedNodes[image.index] = createTrackedNode(image, renderable, scene)
            modelEverCreated = true
            instructionText.text =
                "Page detected! Color the bear with crayons to see colors on 3D model."
          } else {
            // Smoothly update anchor position for existing tracked node
            val trackedNode = trackedNodes[image.index]
            if (trackedNode != null) {
              smoothUpdateAnchorPose(trackedNode, image)
              // Ensure model is visible when tracking resumes
              if (!trackedNode.modelNode.isEnabled) {
                trackedNode.modelNode.isEnabled = true
              }
              // Retry animation start if renderableInstance wasn't ready at creation
              if (trackedNode.animator == null) {
                ensureTrackedNodeAnimation(trackedNode)
              }
            }
          }
        }

        TrackingState.STOPPED -> {
          // Only remove if tracking has been lost for a long time
          val trackedNode = trackedNodes[image.index]
          if (trackedNode != null) {
            val timeSinceLastTracking = now - lastTrackingActiveTimeMs
            if (timeSinceLastTracking > TRACKING_GRACE_PERIOD_MS) {
              removeTrackedNode(image.index)
            }
            // Don't hide - keep model visible at last known position
          }
        }
        TrackingState.PAUSED -> {
          // Keep model visible at last known good position during PAUSED
          anyTracking = trackedNodes.containsKey(image.index)
        }
      }
    }

    // Also check: if we have nodes but none are currently updating, still keep them alive
    if (trackedNodes.isNotEmpty() && !anyTracking) {
      val timeSinceLastTracking = now - lastTrackingActiveTimeMs
      if (timeSinceLastTracking > TRACKING_GRACE_PERIOD_MS && lastTrackingActiveTimeMs > 0L) {
        // Only clean up after extended tracking loss
        trackedNodes.keys.toList().forEach { removeTrackedNode(it) }
      }
    }

    if (trackedNodes.isNotEmpty()) {
      applyLiveTint(frame, sceneView)
    } else if (!modelEverCreated || (now - lastTrackingActiveTimeMs) > TRACKING_GRACE_PERIOD_MS) {
      lastTintVector = null
      lastAcceptedSampleColor = null
      lastAcceptedSampleTimeMs = 0L
      pendingSampleColor = null
      pendingSampleStreak = 0
      lastTextureStats = null
      pendingTextureSignature = null
      pendingTextureStreak = 0
      hasAppliedPageTexture = false
      textureMaterialBuildInFlight = false
      lastTextureSignature = null
      lastTextureApplyTimeMs = 0L
      firstTrackDetectedTimeMs = 0L
      lastAcceptedTextureBitmap = null
      lastSampledPageQuad = null
      lastSampledPageQuadTimeMs = 0L
      stablePageQuadStreak = 0
      pendingColorConsensusBySize.clear()
      fullPageSubjectMaskBySize.clear()
      fullPageReferencePixelsBySize.clear()
    }

    lastFrameWorkDurationMs = (SystemClock.elapsedRealtime() - frameWorkStartMs).coerceAtLeast(0L)
    if (lastFrameWorkDurationMs >= HIGH_FRAME_WORK_DURATION_MS) {
      performanceReliefUntilMs = SystemClock.elapsedRealtime() + PERFORMANCE_RELIEF_WINDOW_MS
    }
    applyAnimationPerformanceRelief(SystemClock.elapsedRealtime())
  }

  private fun createTrackedNode(
      image: AugmentedImage,
      renderableSource: ModelRenderable,
      scene: Scene,
  ): TrackedImageNode {
    val anchorNode = AnchorNode(image.createAnchor(image.centerPose)).apply { setParent(scene) }

    val nodeRenderable = renderableSource.makeCopy()
    nodeRenderable.isShadowCaster = false
    nodeRenderable.isShadowReceiver = false

    val targetSizeMeters = max(image.extentX, image.extentZ) * PAGE_FIT_RATIO
    val modelBounds = estimateModelBounds(nodeRenderable)
    val modelUnitSize = modelBounds.horizontalSize
    val baseScale =
        (targetSizeMeters / modelUnitSize).coerceIn(MIN_MODEL_SCALE, MAX_MODEL_SCALE)
    val baseRotation = composeModelRotation(DEFAULT_USER_YAW_DEGREES)
    val baseSurfaceOffsetY = computeSurfaceOffsetY(modelBounds, baseRotation, baseScale)
    // Center the model on the page by counteracting the GLB's internal geometry offset.
    // computeSurfaceOffsetY already handles Y; we fix X and Z here.
    val rotatedModelCenter = Quaternion.rotateVector(
        baseRotation,
        Vector3(modelBounds.centerX, modelBounds.centerY, modelBounds.centerZ),
    )
    android.util.Log.i(
        "ARScannerActivity",
        "Model bounds size=(${modelBounds.sizeX}, ${modelBounds.sizeY}, ${modelBounds.sizeZ}) " +
            "center=(${modelBounds.centerX}, ${modelBounds.centerY}, ${modelBounds.centerZ}) " +
            "baseScale=$baseScale baseOffsetY=$baseSurfaceOffsetY rotatedCenter=$rotatedModelCenter",
    )

    val modelNode =
        TransformableNode(arFragment.transformationSystem).apply {
          setParent(anchorNode)
          renderable = nodeRenderable
          isEnabled = true

          localPosition =
              Vector3(
                  image.extentX * PAGE_MODEL_OFFSET_X_RATIO - rotatedModelCenter.x * baseScale,
                  baseSurfaceOffsetY,
                  image.extentZ * PAGE_MODEL_OFFSET_Z_RATIO - rotatedModelCenter.z * baseScale,
              )
          localScale = Vector3(baseScale, baseScale, baseScale)
          localRotation = baseRotation

          translationController.isEnabled = false
          rotationController.isEnabled = false
          scaleController.isEnabled = false
          select()
        }

    // Keep color faithful to page paint; avoid extra synthetic lights that shift hue.
    val tintLightNode: Node? = null
    val renderableInstance = modelNode.renderableInstance
    tuneRenderableMaterials(renderableInstance)
    val originalMaterials = captureOriginalMaterials(renderableInstance)
    modelNode.localScale = Vector3(baseScale, baseScale, baseScale)
    modelNode.localPosition =
        Vector3(
            image.extentX * PAGE_MODEL_OFFSET_X_RATIO - rotatedModelCenter.x * baseScale,
            baseSurfaceOffsetY,
            image.extentZ * PAGE_MODEL_OFFSET_Z_RATIO - rotatedModelCenter.z * baseScale,
        )

    val trackedNode =
        TrackedImageNode(
        anchorNode = anchorNode,
        modelNode = modelNode,
        renderable = nodeRenderable,
        renderableInstance = renderableInstance,
        animator = null,
        animationPaused = false,
        floatAnimator = null,
        floatAnimatorPaused = false,
        basePositionY = baseSurfaceOffsetY,
        originalMaterials = originalMaterials,
        tintMaterial = null,
        usesTintMaterial = false,
        imageExtentX = image.extentX,
        imageExtentZ = image.extentZ,
        baseScale = baseScale,
        modelBounds = modelBounds,
        userScaleMultiplier = 1f,
        userYawDegrees = DEFAULT_USER_YAW_DEGREES,
        tintApplied = false,
        tintBuildInFlight = false,
        lastSolidTintColor = null,
        lastMaterialBuildTimeMs = 0L,
        tintLightNode = tintLightNode,
    )
    android.util.Log.i(
        "ARScannerActivity",
        "Renderable diagnostics instanceNull=${modelNode.renderableInstance == null} " +
            "instanceMaterials=${modelNode.renderableInstance?.materialsCount ?: -1} " +
            "submeshes=${nodeRenderable.submeshCount}",
    )
    // Show a neutral, non-GLB color immediately to avoid startup flicker while first texture is preparing.
    applyFallbackTint(trackedNode)
    // Start float/animation immediately so model appears alive from the start.
    ensureTrackedNodeAnimation(trackedNode)
    return trackedNode
  }

  /**
   * Smoothly interpolate the anchor position instead of snapping.
   * This prevents the model from jittering on each frame update.
   * We keep the existing anchor and just lerp the world position to avoid
   * creating a new anchor every frame (which is expensive).
   */
  private fun smoothUpdateAnchorPose(trackedNode: TrackedImageNode, image: AugmentedImage) {
    val oldPosition = trackedNode.anchorNode.worldPosition
    val newPosition = Vector3(
        image.centerPose.tx(),
        image.centerPose.ty(),
        image.centerPose.tz(),
    )

    // Calculate movement distance — if very small, skip update entirely (micro-jitter)
    val dx = newPosition.x - oldPosition.x
    val dy = newPosition.y - oldPosition.y
    val dz = newPosition.z - oldPosition.z
    val distSq = (dx * dx) + (dy * dy) + (dz * dz)
    if (distSq < ANCHOR_JITTER_THRESHOLD_SQ) {
      return
    }

    // Lerp between old and new position for smooth movement
    trackedNode.anchorNode.worldPosition = Vector3(
        oldPosition.x + dx * ANCHOR_SMOOTHING_ALPHA,
        oldPosition.y + dy * ANCHOR_SMOOTHING_ALPHA,
        oldPosition.z + dz * ANCHOR_SMOOTHING_ALPHA,
    )
  }

  private fun seedRenderableTint(renderable: ModelRenderable) {
    val submeshCount = renderable.submeshCount
    if (submeshCount <= 0) {
      android.util.Log.w("ARScannerActivity", "Renderable has zero submeshes; cannot seed tint.")
      return
    }
    MaterialFactory.makeOpaqueWithColor(
            this,
            com.google.ar.sceneform.rendering.Color(DEFAULT_TINT_FALLBACK_COLOR),
        )
        .thenAccept { tintMaterial ->
          runCatching { tintMaterial.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
          runCatching { tintMaterial.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
          for (submeshIndex in 0 until submeshCount) {
            renderable.setMaterial(submeshIndex, tintMaterial)
          }
          android.util.Log.i(
              "ARScannerActivity",
              "Seeded renderable tint on $submeshCount submesh(es) at load time.",
          )
        }
        .exceptionally { error ->
          android.util.Log.w("ARScannerActivity", "Failed to seed renderable tint.", error)
          null
        }
  }

  private fun estimateModelBounds(renderable: ModelRenderable): ModelBounds {
    val shape = renderable.collisionShape
    if (shape is Box) {
      val size = shape.size
      val center = shape.center
      val horizontalAxis = max(size.x, size.z)
      if (horizontalAxis > 0.0001f) {
        return ModelBounds(
            horizontalSize = horizontalAxis,
            sizeX = size.x.coerceAtLeast(0.001f),
            sizeY = size.y.coerceAtLeast(0.001f),
            sizeZ = size.z.coerceAtLeast(0.001f),
            centerX = center.x,
            centerY = center.y,
            centerZ = center.z,
        )
      }
      val fallbackMaxAxis = max(size.x, max(size.y, size.z))
      if (fallbackMaxAxis > 0.0001f) {
        return ModelBounds(
            horizontalSize = fallbackMaxAxis,
            sizeX = size.x.coerceAtLeast(0.001f),
            sizeY = size.y.coerceAtLeast(0.001f),
            sizeZ = size.z.coerceAtLeast(0.001f),
            centerX = center.x,
            centerY = center.y,
            centerZ = center.z,
        )
      }
    }
    return ModelBounds(
        horizontalSize = DEFAULT_MODEL_UNIT_SIZE,
        sizeX = DEFAULT_MODEL_UNIT_SIZE,
        sizeY = DEFAULT_MODEL_HEIGHT_UNITS,
        sizeZ = DEFAULT_MODEL_UNIT_SIZE,
        centerX = 0f,
        centerY = 0f,
        centerZ = 0f,
    )
  }

  private fun addModelFillLight(parentNode: Node) {
    val keyLight =
        Light.builder(Light.Type.POINT)
            .setColor(com.google.ar.sceneform.rendering.Color(android.graphics.Color.WHITE))
            .setIntensity(FILL_LIGHT_KEY_INTENSITY)
            .setFalloffRadius(FILL_LIGHT_RADIUS)
            .build()

    Node().apply {
      setParent(parentNode)
      localPosition = Vector3(0f, 0.24f, 0.12f)
      light = keyLight
    }

    val backFillLight =
        Light.builder(Light.Type.POINT)
            .setColor(com.google.ar.sceneform.rendering.Color(android.graphics.Color.WHITE))
            .setIntensity(FILL_LIGHT_BACK_INTENSITY)
            .setFalloffRadius(FILL_LIGHT_RADIUS)
            .build()

    Node().apply {
      setParent(parentNode)
      localPosition = Vector3(0f, 0.22f, -0.22f)
      light = backFillLight
    }

    val sideFillLight =
        Light.builder(Light.Type.POINT)
            .setColor(com.google.ar.sceneform.rendering.Color(android.graphics.Color.WHITE))
            .setIntensity(FILL_LIGHT_SIDE_INTENSITY)
            .setFalloffRadius(FILL_LIGHT_RADIUS)
            .build()

    Node().apply {
      setParent(parentNode)
      localPosition = Vector3(-0.22f, 0.16f, 0.02f)
      light = sideFillLight
    }
  }

  private fun addTintLight(parentNode: Node): Node {
    val tintLightNode =
        Node().apply {
          setParent(parentNode)
          localPosition = Vector3(0f, TINT_LIGHT_HEIGHT_METERS, TINT_LIGHT_FORWARD_METERS)
        }
    tintLightNode.light = buildTintLight(DEFAULT_TINT_FALLBACK_COLOR)
    return tintLightNode
  }

  private fun buildTintLight(colorInt: Int): Light {
    return Light.builder(Light.Type.POINT)
        .setColor(com.google.ar.sceneform.rendering.Color(colorInt))
        .setIntensity(TINT_LIGHT_INTENSITY)
        .setFalloffRadius(TINT_LIGHT_RADIUS)
        .build()
  }

  private fun applyTintLightColor(trackedNode: TrackedImageNode, colorInt: Int) {
    val tintLightNode = trackedNode.tintLightNode ?: return
    tintLightNode.light = buildTintLight(colorInt)
  }

  private fun tuneRenderableMaterials(renderableInstance: RenderableInstance?) {
    val instance = renderableInstance ?: return
    val materialCount = instance.materialsCount
    if (materialCount <= 0) {
      return
    }
    for (materialIndex in 0 until materialCount) {
      val material = instance.getMaterial(materialIndex)
      runCatching { material.setFloat("metallicFactor", 0f) }
      runCatching { material.setFloat("roughnessFactor", 0.72f) }
      runCatching { material.setFloat("reflectance", 0.35f) }
      runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
      runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
    }
  }

  private fun captureOriginalMaterials(renderableInstance: RenderableInstance?): MutableList<Material> {
    val instance = renderableInstance ?: return mutableListOf()
    val materialCount = instance.materialsCount
    if (materialCount <= 0) {
      return mutableListOf()
    }
    val originals = mutableListOf<Material>()
    for (materialIndex in 0 until materialCount) {
      originals += instance.getMaterial(materialIndex)
    }
    return originals
  }

  private fun attachMaterialToTrackedNode(
      trackedNode: TrackedImageNode,
      material: Material,
  ): MaterialAttachResult {
    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance
    if (trackedNode.originalMaterials.isEmpty() && renderableInstance != null) {
      trackedNode.originalMaterials = captureOriginalMaterials(renderableInstance)
    }

    // Avoid RenderableInstance.setMaterial index mismatch crashes on some GLB assets.
    var instanceSlotsApplied = 0

    var submeshesApplied = 0
    val submeshCount = trackedNode.renderable.submeshCount
    if (submeshCount > 0) {
      for (submeshIndex in 0 until submeshCount) {
        val applied =
            runCatching {
                  trackedNode.renderable.setMaterial(submeshIndex, material)
                  true
                }
                .onFailure { error ->
                  android.util.Log.w(
                      "ARScannerActivity",
                      "Failed to set renderable submesh material at index=$submeshIndex count=$submeshCount",
                      error,
                  )
                }
                .getOrDefault(false)
        if (!applied) {
          break
        }
        submeshesApplied += 1
      }
    }

    var directRenderableApplied = 0
    runCatching {
      trackedNode.renderable.material = material
      directRenderableApplied += 1
    }
    runCatching {
      trackedNode.modelNode.renderable = trackedNode.renderable
      directRenderableApplied += 1
    }

    val anyApplied = instanceSlotsApplied > 0 || submeshesApplied > 0 || directRenderableApplied > 0
    trackedNode.usesTintMaterial = anyApplied
    return MaterialAttachResult(
        applied = anyApplied,
        instanceSlotsApplied = instanceSlotsApplied,
        submeshesApplied = submeshesApplied,
        directRenderableApplied = directRenderableApplied,
    )
  }

  private fun applySolidTintToTrackedNode(
      trackedNode: TrackedImageNode,
      red: Float,
      green: Float,
      blue: Float,
      source: String,
  ) {
    val colorInt =
        android.graphics.Color.rgb(
            (red * 255f).roundToInt().coerceIn(0, 255),
            (green * 255f).roundToInt().coerceIn(0, 255),
            (blue * 255f).roundToInt().coerceIn(0, 255),
        )
    applyTintLightColor(trackedNode, colorInt)
    if (trackedNode.lastSolidTintColor == colorInt && trackedNode.tintApplied && trackedNode.usesTintMaterial) {
      return
    }

    val inPlaceTintCount = tintExistingTrackedNodeMaterials(trackedNode, red, green, blue)
    if (inPlaceTintCount > 0) {
      trackedNode.tintApplied = true
      trackedNode.usesTintMaterial = true
      trackedNode.lastSolidTintColor = colorInt
      trackedNode.lastMaterialBuildTimeMs = SystemClock.elapsedRealtime()
      if (source == "fallback" || !loggedTintMaterialAttach) {
        loggedTintMaterialAttach = true
        android.util.Log.i(
            "ARScannerActivity",
            "Applied $source in-place tint color=#${Integer.toHexString(colorInt)} materials=$inPlaceTintCount",
        )
      }
      return
    }

    val now = SystemClock.elapsedRealtime()
    if (trackedNode.tintBuildInFlight) {
      return
    }
    if ((now - trackedNode.lastMaterialBuildTimeMs) < MIN_MATERIAL_REBUILD_INTERVAL_MS &&
        trackedNode.lastSolidTintColor != null
    ) {
      return
    }

    trackedNode.tintBuildInFlight = true
    MaterialFactory.makeOpaqueWithColor(this, com.google.ar.sceneform.rendering.Color(colorInt))
        .thenAccept { generatedMaterial ->
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }

          val attachResult = attachMaterialToTrackedNode(trackedNode, generatedMaterial)
          trackedNode.tintMaterial = generatedMaterial
          trackedNode.tintApplied = trackedNode.usesTintMaterial
          trackedNode.lastSolidTintColor = colorInt
          trackedNode.lastMaterialBuildTimeMs = SystemClock.elapsedRealtime()
          trackedNode.tintBuildInFlight = false

          if (trackedNode.tintApplied && (source == "fallback" || !loggedTintMaterialAttach)) {
            loggedTintMaterialAttach = true
            android.util.Log.i(
                "ARScannerActivity",
                "Applied $source solid tint material color=#${Integer.toHexString(colorInt)} " +
                    "instanceSlots=${attachResult.instanceSlotsApplied} " +
                    "submeshes=${attachResult.submeshesApplied} " +
                    "direct=${attachResult.directRenderableApplied}",
            )
          }
        }
        .exceptionally { error ->
          trackedNode.tintBuildInFlight = false
          android.util.Log.w("ARScannerActivity", "Failed to apply $source solid tint material.", error)
          null
        }
  }

  private fun tintExistingTrackedNodeMaterials(
      trackedNode: TrackedImageNode,
      red: Float,
      green: Float,
      blue: Float,
  ): Int {
    val emissiveBoost = computeEmissiveBoost(floatArrayOf(red, green, blue))
    var tintedCount = 0

    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance
    val instanceMaterialCount = renderableInstance?.materialsCount ?: 0
    if (instanceMaterialCount > 0) {
      for (materialIndex in 0 until instanceMaterialCount) {
        val material =
            runCatching { renderableInstance?.getMaterial(materialIndex) }
                .onFailure { error ->
                  android.util.Log.w(
                      "ARScannerActivity",
                      "Failed to read instance material at index=$materialIndex count=$instanceMaterialCount",
                      error,
                  )
                }
                .getOrNull()
                ?: break
        applyTintToMaterial(material, red, green, blue, emissiveBoost)
        tintedCount += 1
      }
    }

    if (tintedCount > 0) {
      return tintedCount
    }

    val submeshCount = trackedNode.renderable.submeshCount
    for (submeshIndex in 0 until submeshCount) {
      val material =
          runCatching { trackedNode.renderable.getMaterial(submeshIndex) }
              .onFailure { error ->
                android.util.Log.w(
                    "ARScannerActivity",
                    "Failed to read renderable material at index=$submeshIndex count=$submeshCount",
                    error,
                )
              }
              .getOrNull()
              ?: break
      applyTintToMaterial(material, red, green, blue, emissiveBoost)
      tintedCount += 1
    }
    return tintedCount
  }

  private fun ensureTintMaterialAttached(trackedNode: TrackedImageNode): Material? {
    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance

    if (trackedNode.originalMaterials.isEmpty() && renderableInstance != null) {
      trackedNode.originalMaterials = captureOriginalMaterials(renderableInstance)
    }

    if (trackedNode.tintMaterial == null) {
      val template =
          liveTintMaterialTemplate
              ?: runCatching { renderableInstance?.getMaterial(0)?.makeCopy() }.getOrNull()
              ?: run {
                if (!loggedMissingTintTemplate) {
                  loggedMissingTintTemplate = true
                  android.util.Log.w("ARScannerActivity", "Tint template unavailable; skipping tint attach.")
                }
                return null
              }
      trackedNode.tintMaterial = template.makeCopy().also { tintMaterial ->
        runCatching { tintMaterial.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
        runCatching { tintMaterial.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
      }
    }

    val tintMaterial = trackedNode.tintMaterial ?: return null
    if (!trackedNode.usesTintMaterial) {
      val materialCount = renderableInstance?.materialsCount ?: 0
      if (materialCount > 0) {
        for (materialIndex in 0 until materialCount) {
          renderableInstance?.setMaterial(materialIndex, tintMaterial)
        }
        trackedNode.usesTintMaterial = true
        if (!loggedTintMaterialAttach) {
          loggedTintMaterialAttach = true
          android.util.Log.i("ARScannerActivity", "Tint material attached to $materialCount instance slot(s).")
        }
      } else {
        val submeshCount = trackedNode.renderable.submeshCount
        if (submeshCount <= 0) {
          return null
        }
        for (submeshIndex in 0 until submeshCount) {
          trackedNode.renderable.setMaterial(submeshIndex, tintMaterial)
        }
        trackedNode.usesTintMaterial = true
        if (!loggedTintMaterialAttach) {
          loggedTintMaterialAttach = true
          android.util.Log.i("ARScannerActivity", "Tint material attached via renderable submeshes ($submeshCount).")
        }
      }
    }
    return tintMaterial
  }

  private fun restoreOriginalMaterials(trackedNode: TrackedImageNode) {
    if (!trackedNode.usesTintMaterial) {
      return
    }
    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance ?: return
    val originals = trackedNode.originalMaterials
    val applyCount = min(renderableInstance.materialsCount, originals.size)
    if (applyCount <= 0) {
      trackedNode.usesTintMaterial = false
      return
    }

    for (materialIndex in 0 until applyCount) {
      renderableInstance.setMaterial(materialIndex, originals[materialIndex])
    }
    trackedNode.usesTintMaterial = false
  }

  private fun startPreferredAnimation(renderableInstance: RenderableInstance?): ObjectAnimator? {
    if (!ENABLE_MODEL_ANIMATION) {
      return null
    }
    if (renderableInstance == null || renderableInstance.animationCount <= 0) {
      return null
    }

    val availableAnimationNames =
        (0 until renderableInstance.animationCount).map { index ->
          renderableInstance.getAnimation(index).name
        }

    val preferredIndex =
        PREFERRED_ANIMATION_NAME_HINTS
            .firstNotNullOfOrNull { animationHint ->
              (0 until renderableInstance.animationCount).firstOrNull { index ->
                renderableInstance.getAnimation(index).name.contains(animationHint, ignoreCase = true)
              }
            } ?: 0

    android.util.Log.i(
        "ARScannerActivity",
        "Available animations=${availableAnimationNames.joinToString()} selected=${availableAnimationNames.getOrNull(preferredIndex)}",
    )

    return runCatching {
          ModelAnimator.ofAnimation(renderableInstance, preferredIndex).apply {
            interpolator = LinearInterpolator()
            if (duration > 0L) {
              duration = (duration / ANIMATION_PLAYBACK_SPEED).toLong().coerceAtLeast(280L)
            }
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.RESTART
            start()
          }
        }
        .onFailure { error ->
          android.util.Log.w("ARScannerActivity", "Model animation could not start.", error)
        }
        .getOrNull()
  }

  private fun ensureTrackedNodeAnimation(trackedNode: TrackedImageNode) {
    if (!ENABLE_MODEL_ANIMATION) {
      return
    }
    trackedNode.renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance

    // Try GLB embedded animation — retry each call since renderableInstance may load async.
    if (trackedNode.animator == null) {
      trackedNode.animator = startPreferredAnimation(trackedNode.renderableInstance)
      if (trackedNode.animator != null) {
        trackedNode.animationPaused = false
      }
    }

    // Always start float/bob animation alongside GLB animation for a lively floating effect.
    if (trackedNode.floatAnimator == null) {
      trackedNode.floatAnimator = startFloatAnimation(trackedNode)
      trackedNode.floatAnimatorPaused = false
    }
  }

  private fun startFloatAnimation(trackedNode: TrackedImageNode): ValueAnimator {
    val baseY = trackedNode.basePositionY
    // Gentle floating bob — visible but smooth. ±1.5cm at baseScale=1.
    val amplitude = (trackedNode.baseScale * 0.015f).coerceIn(0.006f, 0.030f)
    return ValueAnimator.ofFloat(-amplitude, amplitude).apply {
      duration = 2800L
      interpolator = AccelerateDecelerateInterpolator()
      repeatCount = ValueAnimator.INFINITE
      repeatMode = ValueAnimator.REVERSE
      addUpdateListener { anim ->
        val offset = anim.animatedValue as Float
        val pos = trackedNode.modelNode.localPosition
        trackedNode.modelNode.localPosition = Vector3(pos.x, baseY + offset, pos.z)
      }
      start()
    }
  }

  private fun applyAnimationPerformanceRelief(nowMs: Long) {
    // Animations should NEVER be paused — they are lightweight and keep the model
    // looking alive. Only texture/color sampling is throttled during performance relief.
    // This method now only ensures animations are running if they were somehow stopped.
    if (!ENABLE_MODEL_ANIMATION || trackedNodes.isEmpty()) {
      return
    }
    trackedNodes.values.forEach { trackedNode ->
      val animator = trackedNode.animator
      if (animator != null && trackedNode.animationPaused) {
        runCatching { animator.resume() }
        trackedNode.animationPaused = false
      }
      val floatAnim = trackedNode.floatAnimator
      if (floatAnim != null && trackedNode.floatAnimatorPaused) {
        runCatching { floatAnim.resume() }
        trackedNode.floatAnimatorPaused = false
      }
    }
  }

  private fun removeTrackedNode(index: Int) {
    trackedNodes.remove(index)?.let { trackedNode ->
      trackedNode.animator?.cancel()
      trackedNode.floatAnimator?.cancel()
      trackedNode.anchorNode.anchor?.detach()
      trackedNode.anchorNode.setParent(null)
    }
  }

  private fun applyLiveTint(frame: Frame, sceneView: ArSceneView) {
    val now = SystemClock.elapsedRealtime()
    val colorRefreshIntervalMs = colorRefreshIntervalMs()
    if (now - lastTintUpdateTimeMs < colorRefreshIntervalMs) {
      return
    }
    lastTintUpdateTimeMs = now
    val inPerformanceRelief = now < performanceReliefUntilMs
    val textureRefreshIntervalMs = textureRefreshIntervalMs(inPerformanceRelief)
    val minTextureApplyIntervalMs = minTextureApplyIntervalMs(inPerformanceRelief)
    val textureSampleSize = textureSampleSizePx(inPerformanceRelief)

    if (textureMaterialBuildInFlight) {
      return
    }

    val trackedTextureBitmap =
        if ((now - lastTextureApplyTimeMs) >= textureRefreshIntervalMs || !hasAppliedPageTexture) {
          sampleTrackedPageTexture(frame, sceneView, textureSampleSize)
        } else {
          null
        }
    val sanitizedTextureBitmap = trackedTextureBitmap?.let { sanitizeSampledTexture(it) }
    if (sanitizedTextureBitmap != null) {
      val textureStats = computeTextureStats(sanitizedTextureBitmap)
      val textureSignature = textureStats.signature
      if (!shouldAcceptTextureUpdate(textureStats, now)) {
        return
      }
      val textureChanged = isTextureSignatureSignificantlyChanged(lastTextureSignature, textureSignature)
      val textureAgeMs = now - lastTextureApplyTimeMs
      if ((now - lastTextureDebugLogTimeMs) >= 900L) {
        lastTextureDebugLogTimeMs = now
        android.util.Log.i(
            "ARScannerActivity",
            "Texture sample ready signature=$textureSignature size=${sanitizedTextureBitmap.width}x${sanitizedTextureBitmap.height}",
        )
      }
      if (!textureMaterialBuildInFlight &&
          (!hasAppliedPageTexture ||
              (textureChanged && textureAgeMs >= minTextureApplyIntervalMs) ||
              textureAgeMs >= FORCE_TEXTURE_MATERIAL_REFRESH_MS)
      ) {
        applyPageTextureToTrackedNodes(sanitizedTextureBitmap, textureSignature, textureStats, "live")
      }
      return
    }
    if (firstTrackDetectedTimeMs > 0L &&
        (now - firstTrackDetectedTimeMs) < TEXTURE_ONLY_WARMUP_MS &&
        !hasAppliedPageTexture
    ) {
      return
    }
    if (hasAppliedPageTexture &&
        (now - lastTextureApplyTimeMs) <= TEXTURE_HOLD_AFTER_SAMPLE_MISS_MS
    ) {
      return
    }
    if ((now - lastTextureMissLogTimeMs) >= 1200L) {
      lastTextureMissLogTimeMs = now
      android.util.Log.w("ARScannerActivity", "Tracked page texture sampling missed; using color tint fallback.")
    }
    if (!ENABLE_SOLID_TINT_FALLBACK) {
      return
    }

    val trackedSampleColor = sampleTrackedPageColor(frame, sceneView)
    if (trackedSampleColor == null && (now - lastSampleMissLogTimeMs) >= 1200L) {
      lastSampleMissLogTimeMs = now
      android.util.Log.w("ARScannerActivity", "Tracked page color sampling missed; using fallback tint source.")
    }
    val candidateColor = trackedSampleColor
    val sampledColor =
        candidateColor?.let { stabilizeSampledColor(it, now) }
            ?: lastAcceptedSampleColor?.takeIf { (now - lastAcceptedSampleTimeMs) <= COLOR_HOLD_ON_NOISE_MS }
    if (sampledColor == null) {
      if (now - lastAcceptedSampleTimeMs > COLOR_HOLD_ON_NOISE_MS) {
        trackedNodes.values.forEach { trackedNode -> applyFallbackTint(trackedNode) }
        lastTintVector = null
        hasAppliedPageTexture = false
      }
      return
    }

    val tint = computeVisibleTint(sampledColor)
    val smoothedTint = smoothTint(tint, lastTintVector)
    if (!isTintSignificantlyChanged(smoothedTint, lastTintVector)) {
      return
    }

    lastTintVector = smoothedTint
    val red = smoothedTint[0]
    val green = smoothedTint[1]
    val blue = smoothedTint[2]
    if (now - lastTintDebugLogTimeMs >= 900L) {
      lastTintDebugLogTimeMs = now
      val trackedHex = trackedSampleColor?.let { "#${Integer.toHexString(it)}" } ?: "null"
      android.util.Log.i(
          "ARScannerActivity",
          "Live tint rgb=(${(red * 255f).toInt()}, ${(green * 255f).toInt()}, ${(blue * 255f).toInt()}) tracked=$trackedHex",
      )
    }

    hasAppliedPageTexture = false
    trackedNodes.values.forEach { trackedNode ->
      applySolidTintToTrackedNode(trackedNode, red, green, blue, "live")
    }
  }

  private fun stabilizeSampledColor(candidateColor: Int, nowMs: Long): Int? {
    if (!shouldApplyLiveTint(candidateColor)) {
      return lastAcceptedSampleColor?.takeIf { (nowMs - lastAcceptedSampleTimeMs) <= COLOR_HOLD_ON_NOISE_MS }
    }

    val previousAccepted = lastAcceptedSampleColor
    if (previousAccepted != null) {
      val delta = colorDistanceRgb(candidateColor, previousAccepted)
      if (delta >= MIN_ACCEPTED_COLOR_SWITCH_DELTA) {
        if (pendingSampleColor == null || colorDistanceRgb(candidateColor, pendingSampleColor!!) > PENDING_COLOR_MATCH_DELTA) {
          pendingSampleColor = candidateColor
          pendingSampleStreak = 1
          return previousAccepted
        }

        pendingSampleStreak += 1
        if (pendingSampleStreak < MIN_PENDING_SAMPLE_STREAK) {
          return previousAccepted
        }
      }
    }

    lastAcceptedSampleColor = candidateColor
    lastAcceptedSampleTimeMs = nowMs
    pendingSampleColor = null
    pendingSampleStreak = 0
    return candidateColor
  }

  private fun shouldAcceptTextureUpdate(candidateStats: TextureStats, nowMs: Long): Boolean {
    val previousStats = lastTextureStats ?: return true
    val candidateSignature = candidateStats.signature
    val previousSignature = previousStats.signature
    val delta = colorDistanceRgb(previousSignature, candidateSignature)
    val changedRatio = computeGridChangedRatio(previousStats.gridColors, candidateStats.gridColors)

    if (changedRatio >= HAND_OCCLUSION_CHANGE_RATIO && delta >= HAND_OCCLUSION_MIN_DELTA) {
      pendingTextureSignature = null
      pendingTextureStreak = 0
      return false
    }

    if (delta >= MAX_TEXTURE_SPIKE_DELTA && (nowMs - lastTextureApplyTimeMs) <= MAX_TEXTURE_SPIKE_WINDOW_MS) {
      pendingTextureSignature = null
      pendingTextureStreak = 0
      return false
    }

    if (delta < MIN_TEXTURE_SIGNATURE_DELTA) {
      pendingTextureSignature = null
      pendingTextureStreak = 0
      return true
    }

    if (pendingTextureSignature == null ||
        colorDistanceRgb(candidateSignature, pendingTextureSignature!!) > PENDING_TEXTURE_MATCH_DELTA
    ) {
      pendingTextureSignature = candidateSignature
      pendingTextureStreak = 1
      return false
    }

    pendingTextureStreak += 1
    val requiredStreak =
        if (changedRatio <= LOCAL_SKETCH_MAX_CHANGE_RATIO) {
          MIN_PENDING_TEXTURE_STREAK_LOCAL
        } else {
          MIN_PENDING_TEXTURE_STREAK
        }
    return pendingTextureStreak >= requiredStreak
  }

  private fun sampleTrackedPageTexture(
      frame: Frame,
      sceneView: ArSceneView,
      outputSizePx: Int,
  ): Bitmap? {
    val trackedNode = trackedNodes.values.firstOrNull() ?: return null
    val pageCornersRaw = collectTrackedPageCorners(frame, sceneView, trackedNode) ?: return null
    if (pageCornersRaw.size < 4) {
      return null
    }
    val pageCorners = pageCornersRaw.take(4)
    // Sample the FULL page — the model's UV map covers the full reference image space,
    // so supplying the full page texture makes UVs align correctly with user-colored regions.
    val insetPageCorners = insetQuadCorners(pageCorners, PAGE_QUAD_INSET_RATIO)
    val now = SystemClock.elapsedRealtime()
    if (!isPageQuadStableForSampling(insetPageCorners, now)) {
      return null
    }
    return runCatching {
          CameraColorSampler.sampleQuadBitmap(
              frame = frame,
              cornersPx = insetPageCorners,
              outputSize = outputSizePx,
          )
        }
        .onFailure { error ->
          android.util.Log.w("ARScannerActivity", "Failed to sample full page texture.", error)
        }
        .getOrNull()
  }

  private fun applyPageTextureToTrackedNodes(
      bitmap: Bitmap,
      signature: Int,
      textureStats: TextureStats,
      source: String,
  ) {
    if (textureMaterialBuildInFlight) {
      return
    }
    textureMaterialBuildInFlight = true

    val sampler =
        Texture.Sampler.builder()
            .setMinFilter(Texture.Sampler.MinFilter.LINEAR_MIPMAP_LINEAR)
            .setMagFilter(Texture.Sampler.MagFilter.LINEAR)
            .setWrapMode(Texture.Sampler.WrapMode.CLAMP_TO_EDGE)
            .build()

    Texture.builder()
        .setSource(bitmap)
        .setSampler(sampler)
        .build()
        .thenAccept { texture ->
          var appliedCount = 0
          trackedNodes.values.forEach { trackedNode ->
            val texturedMaterials =
                applyTextureToTrackedNodeMaterials(trackedNode, texture)
            if (texturedMaterials > 0) {
              trackedNode.tintApplied = true
              trackedNode.lastSolidTintColor = null
              trackedNode.lastMaterialBuildTimeMs = SystemClock.elapsedRealtime()
              trackedNode.modelNode.isEnabled = true
              ensureTrackedNodeAnimation(trackedNode)
              appliedCount += texturedMaterials
            }
          }

          textureMaterialBuildInFlight = false
          if (appliedCount > 0) {
            hasAppliedPageTexture = true
            lastTextureSignature = signature
            lastTextureStats = textureStats
            lastTextureApplyTimeMs = SystemClock.elapsedRealtime()
            lastAcceptedTextureBitmap = bitmap
            pendingTextureSignature = null
            pendingTextureStreak = 0
            android.util.Log.i(
                "ARScannerActivity",
                "Applied $source page texture in-place signature=$signature materials=$appliedCount",
            )
          } else {
            android.util.Log.w(
                "ARScannerActivity",
                "Texture apply skipped (no compatible materials). Keeping previous material state.",
            )
          }
        }
        .exceptionally { error ->
          textureMaterialBuildInFlight = false
          android.util.Log.w("ARScannerActivity", "Failed to build page texture.", error)
          null
        }
  }

  private fun applyTextureToTrackedNodeMaterials(
      trackedNode: TrackedImageNode,
      texture: Texture,
  ): Int {
    var appliedCount = 0
    var instanceAppliedCount = 0
    var submeshAppliedCount = 0

    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance
    val instanceMaterialCount = renderableInstance?.materialsCount ?: 0
    if (instanceMaterialCount > 0) {
      for (materialIndex in 0 until instanceMaterialCount) {
        val material = runCatching { renderableInstance?.getMaterial(materialIndex) }.getOrNull() ?: continue
        if (applyTextureToMaterial(material, texture)) {
          appliedCount += 1
          instanceAppliedCount += 1
        }
      }
    }

    val submeshCount = trackedNode.renderable.submeshCount
    for (submeshIndex in 0 until submeshCount) {
      val material = runCatching { trackedNode.renderable.getMaterial(submeshIndex) }.getOrNull() ?: continue
      if (applyTextureToMaterial(material, texture)) {
        appliedCount += 1
        submeshAppliedCount += 1
      }
    }

    val hasFullCoverage =
        (instanceMaterialCount > 0 && instanceAppliedCount >= instanceMaterialCount) ||
            (submeshCount > 0 && submeshAppliedCount >= submeshCount)
    if (!hasFullCoverage) {
      val generatedAppliedCount = attachOrUpdateGeneratedTextureMaterial(trackedNode, texture)
      if (generatedAppliedCount > 0) {
        appliedCount = max(appliedCount, generatedAppliedCount)
      }
    }

    trackedNode.usesTintMaterial = appliedCount > 0
    return appliedCount
  }

  private fun attachOrUpdateGeneratedTextureMaterial(
      trackedNode: TrackedImageNode,
      texture: Texture,
  ): Int {
    val existing = trackedNode.tintMaterial
    if (existing != null) {
      if (!applyTextureToMaterial(existing, texture)) {
        return 0
      }
      val attachResult = attachMaterialToTrackedNode(trackedNode, existing)
      return if (attachResult.applied) {
        max(1, attachResult.submeshesApplied + attachResult.instanceSlotsApplied + attachResult.directRenderableApplied)
      } else {
        0
      }
    }

    if (trackedNode.tintBuildInFlight) {
      return 0
    }

    trackedNode.tintBuildInFlight = true
    MaterialFactory.makeOpaqueWithTexture(this, texture)
        .thenAccept { generatedMaterial ->
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
          runCatching { generatedMaterial.setFloat("reflectance", 0.35f) }
          trackedNode.tintMaterial = generatedMaterial
          val attachResult = attachMaterialToTrackedNode(trackedNode, generatedMaterial)
          trackedNode.usesTintMaterial = attachResult.applied
          trackedNode.tintApplied = attachResult.applied
          trackedNode.tintBuildInFlight = false
          trackedNode.lastMaterialBuildTimeMs = SystemClock.elapsedRealtime()
        }
        .exceptionally { error ->
          trackedNode.tintBuildInFlight = false
          android.util.Log.w("ARScannerActivity", "Failed to create generated texture material.", error)
          null
        }

    return 0
  }

  private fun applyTextureToMaterial(material: Material, texture: Texture): Boolean {
    val cachedBinding = materialTextureBindingCache[material]
    val applied =
        if (cachedBinding != null) {
          applyTextureToMaterialWithBinding(material, texture, cachedBinding)
        } else {
          detectAndApplyTextureBinding(material, texture)
        }
    if (!applied) {
      return false
    }

    if (materialPbrInitialized.add(material)) {
      runCatching { material.setFloat4(MaterialFactory.MATERIAL_COLOR, 1f, 1f, 1f, 1f) }
      runCatching { material.setFloat4("baseColorTint", 1f, 1f, 1f, 1f) }
      runCatching { material.setFloat4("baseColorFactor", 1f, 1f, 1f, 1f) }
      runCatching { material.setFloat3("emissiveFactor", 0f, 0f, 0f) }
      runCatching { material.setFloat("emissiveStrength", 0f) }
      runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
      runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
      runCatching { material.setFloat("reflectance", 0.35f) }
    }
    return true
  }

  private fun detectAndApplyTextureBinding(material: Material, texture: Texture): Boolean {
    val bindingOrder =
        intArrayOf(
            MATERIAL_BINDING_BASE_COLOR,
            MATERIAL_BINDING_SCENEFORM_TEXTURE,
            MATERIAL_BINDING_BASE_COLOR_MAP,
            MATERIAL_BINDING_BASE_COLOR_TEXTURE_NAME,
            MATERIAL_BINDING_ALBEDO,
        )
    for (binding in bindingOrder) {
      if (applyTextureToMaterialWithBinding(material, texture, binding)) {
        materialTextureBindingCache[material] = binding
        return true
      }
    }
    return false
  }

  private fun applyTextureToMaterialWithBinding(
      material: Material,
      texture: Texture,
      binding: Int,
  ): Boolean {
    return when (binding) {
      MATERIAL_BINDING_BASE_COLOR ->
          runCatching {
                material.setBaseColorTexture(texture)
                true
              }
              .getOrDefault(false)
      MATERIAL_BINDING_SCENEFORM_TEXTURE ->
          runCatching {
                material.setTexture(MaterialFactory.MATERIAL_TEXTURE, texture)
                true
              }
              .getOrDefault(false)
      MATERIAL_BINDING_BASE_COLOR_MAP ->
          runCatching {
                material.setTexture("baseColorMap", texture)
                true
              }
              .getOrDefault(false)
      MATERIAL_BINDING_BASE_COLOR_TEXTURE_NAME ->
          runCatching {
                material.setTexture("baseColorTexture", texture)
                true
              }
              .getOrDefault(false)
      MATERIAL_BINDING_ALBEDO ->
          runCatching {
                material.setTexture("albedo", texture)
                true
              }
              .getOrDefault(false)
      else -> false
    }
  }

  private fun computeTextureStats(bitmap: Bitmap): TextureStats {
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      return TextureStats(0, intArrayOf())
    }
    val grid = TEXTURE_STATS_GRID
    val gridColors = IntArray(grid * grid)
    var redAcc = 0
    var greenAcc = 0
    var blueAcc = 0
    var sampleCount = 0

    for (row in 0 until grid) {
      val y = ((row.toFloat() / (grid - 1).toFloat()) * (bitmap.height - 1)).roundToInt()
      for (col in 0 until grid) {
        val x = ((col.toFloat() / (grid - 1).toFloat()) * (bitmap.width - 1)).roundToInt()
        val pixel = bitmap.getPixel(x, y)
        gridColors[(row * grid) + col] = pixel
        redAcc += android.graphics.Color.red(pixel)
        greenAcc += android.graphics.Color.green(pixel)
        blueAcc += android.graphics.Color.blue(pixel)
        sampleCount += 1
      }
    }

    if (sampleCount <= 0) {
      return TextureStats(0, gridColors)
    }
    val avgR = (redAcc / sampleCount).coerceIn(0, 255)
    val avgG = (greenAcc / sampleCount).coerceIn(0, 255)
    val avgB = (blueAcc / sampleCount).coerceIn(0, 255)
    val signature = (avgR shl 16) or (avgG shl 8) or avgB
    return TextureStats(signature, gridColors)
  }

  private fun computeGridChangedRatio(previous: IntArray, current: IntArray): Float {
    if (previous.isEmpty() || current.isEmpty()) {
      return 0f
    }
    val compareCount = min(previous.size, current.size)
    if (compareCount <= 0) {
      return 0f
    }

    var changedCount = 0
    for (index in 0 until compareCount) {
      if (colorDistanceRgb(previous[index], current[index]) >= GRID_CELL_CHANGE_DELTA) {
        changedCount += 1
      }
    }
    return changedCount.toFloat() / compareCount.toFloat()
  }

  private fun isTextureSignatureSignificantlyChanged(previous: Int?, current: Int): Boolean {
    val prior = previous ?: return true
    val prevR = (prior shr 16) and 0xFF
    val prevG = (prior shr 8) and 0xFF
    val prevB = prior and 0xFF
    val currR = (current shr 16) and 0xFF
    val currG = (current shr 8) and 0xFF
    val currB = current and 0xFF
    val delta = abs(currR - prevR) + abs(currG - prevG) + abs(currB - prevB)
    return delta >= MIN_TEXTURE_SIGNATURE_DELTA
  }

  private fun sampleTrackedPageColor(frame: Frame, sceneView: ArSceneView): Int? {
    val trackedNode = trackedNodes.values.firstOrNull() ?: return null
    val preferredPoints = collectTrackedImageSamplePoints(frame, sceneView, trackedNode) ?: return null
    val subjectPoints = trimSamplePointsToSubject(preferredPoints)
    return runCatching { CameraColorSampler.sampleDominantColor(frame, subjectPoints) }
        .onFailure { error ->
          android.util.Log.w("ARScannerActivity", "Failed to sample tracked page color.", error)
        }
        .getOrNull()
  }

  private fun collectTrackedImageSamplePoints(
      frame: Frame,
      sceneView: ArSceneView,
      trackedNode: TrackedImageNode,
  ): List<Pair<Float, Float>>? {
    val sampleOffsets = buildTrackedSampleOffsets(trackedNode)
    return projectLocalOffsetsToCameraImage(frame, sceneView, trackedNode, sampleOffsets)
  }

  private fun collectTrackedPageCorners(
      frame: Frame,
      sceneView: ArSceneView,
      trackedNode: TrackedImageNode,
  ): List<Pair<Float, Float>>? {
    val halfX = trackedNode.imageExtentX * 0.5f
    val halfZ = trackedNode.imageExtentZ * 0.5f
    val cornerOffsets =
        listOf(
            (-halfX to -halfZ),
            (halfX to -halfZ),
            (halfX to halfZ),
            (-halfX to halfZ),
        )
    return projectLocalOffsetsToCameraImage(frame, sceneView, trackedNode, cornerOffsets)
  }

  private fun mapQuadToBounds(
      corners: List<Pair<Float, Float>>,
      minU: Float,
      minV: Float,
      maxU: Float,
      maxV: Float,
  ): List<Pair<Float, Float>> {
    if (corners.size < 4) {
      return corners
    }
    val safeMinU = min(minU, maxU).coerceIn(0f, 1f)
    val safeMinV = min(minV, maxV).coerceIn(0f, 1f)
    val safeMaxU = max(minU, maxU).coerceIn(0f, 1f)
    val safeMaxV = max(minV, maxV).coerceIn(0f, 1f)
    val tl = mapQuadPoint(corners, safeMinU, safeMinV)
    val tr = mapQuadPoint(corners, safeMaxU, safeMinV)
    val br = mapQuadPoint(corners, safeMaxU, safeMaxV)
    val bl = mapQuadPoint(corners, safeMinU, safeMaxV)
    return listOf(tl, tr, br, bl)
  }

  private fun mapQuadPoint(
      corners: List<Pair<Float, Float>>,
      u: Float,
      v: Float,
  ): Pair<Float, Float> {
    val c = corners.take(4)
    val topX = (c[0].first * (1f - u)) + (c[1].first * u)
    val topY = (c[0].second * (1f - u)) + (c[1].second * u)
    val bottomX = (c[3].first * (1f - u)) + (c[2].first * u)
    val bottomY = (c[3].second * (1f - u)) + (c[2].second * u)
    val x = (topX * (1f - v)) + (bottomX * v)
    val y = (topY * (1f - v)) + (bottomY * v)
    return x to y
  }

  private fun insetQuadCorners(
      corners: List<Pair<Float, Float>>,
      insetRatio: Float,
  ): List<Pair<Float, Float>> {
    if (corners.size < 4) {
      return corners
    }
    val ratio = insetRatio.coerceIn(0f, 0.20f)
    val centerX = corners.map { it.first }.average().toFloat()
    val centerY = corners.map { it.second }.average().toFloat()
    val keep = 1f - ratio
    return corners.take(4).map { (x, y) ->
      val nx = centerX + ((x - centerX) * keep)
      val ny = centerY + ((y - centerY) * keep)
      nx to ny
    }
  }

  private fun projectLocalOffsetsToCameraImage(
      frame: Frame,
      sceneView: ArSceneView,
      trackedNode: TrackedImageNode,
      sampleOffsets: List<Pair<Float, Float>>,
  ): List<Pair<Float, Float>>? {
    val sceneCamera = sceneView.scene?.camera ?: return null
    if (sampleOffsets.isEmpty()) {
      return null
    }

    val viewCoords = FloatArray(sampleOffsets.size * 2)
    var writtenSamples = 0
    sampleOffsets.forEach { (offsetX, offsetZ) ->
      val localOffset = Vector3(offsetX, 0f, offsetZ)
      val worldOffset = Quaternion.rotateVector(trackedNode.anchorNode.worldRotation, localOffset)
      val worldPoint = Vector3.add(trackedNode.anchorNode.worldPosition, worldOffset)
      val screenPoint = sceneCamera.worldToScreenPoint(worldPoint)
      if (!screenPoint.x.isFinite() || !screenPoint.y.isFinite()) {
        return@forEach
      }
      viewCoords[writtenSamples * 2] = screenPoint.x
      viewCoords[(writtenSamples * 2) + 1] = screenPoint.y
      writtenSamples += 1
    }
    if (writtenSamples <= 0) {
      return null
    }

    val input = viewCoords.copyOf(writtenSamples * 2)
    val imageCoords = FloatArray(writtenSamples * 2)
    return runCatching {
          frame.transformCoordinates2d(
              Coordinates2d.VIEW,
              input,
              Coordinates2d.IMAGE_PIXELS,
              imageCoords,
          )
          (0 until writtenSamples).map { index ->
            imageCoords[index * 2] to imageCoords[(index * 2) + 1]
          }
        }
        .onFailure { error ->
          android.util.Log.w("ARScannerActivity", "Failed to project tracked sample points.", error)
        }
        .getOrNull()
  }

  private fun isPageQuadStableForSampling(
      quadCorners: List<Pair<Float, Float>>,
      nowMs: Long,
  ): Boolean {
    if (quadCorners.size < 4) {
      stablePageQuadStreak = 0
      lastSampledPageQuad = null
      lastSampledPageQuadTimeMs = nowMs
      return false
    }
    if (!isQuadGeometryValid(quadCorners)) {
      stablePageQuadStreak = 0
      lastSampledPageQuad = quadCorners
      lastSampledPageQuadTimeMs = nowMs
      return false
    }

    val previous = lastSampledPageQuad
    val elapsedMs = (nowMs - lastSampledPageQuadTimeMs).coerceAtLeast(1L)
    lastSampledPageQuad = quadCorners
    lastSampledPageQuadTimeMs = nowMs

    if (previous == null || previous.size < 4) {
      stablePageQuadStreak = 1
      // Allow first texture sample quickly so model doesn't show original GLB colors.
      return !hasAppliedPageTexture
    }

    var motionAcc = 0f
    for (index in 0 until 4) {
      val dx = quadCorners[index].first - previous[index].first
      val dy = quadCorners[index].second - previous[index].second
      motionAcc += sqrt((dx * dx) + (dy * dy))
    }
    val avgMotionPx = motionAcc / 4f
    val motionSpeedPxPerMs = avgMotionPx / elapsedMs.toFloat()
    val stable =
        avgMotionPx <= PAGE_QUAD_MAX_MOTION_PX &&
            motionSpeedPxPerMs <= PAGE_QUAD_MAX_SPEED_PX_PER_MS
    stablePageQuadStreak = if (stable) stablePageQuadStreak + 1 else 0
    return stablePageQuadStreak >= MIN_STABLE_PAGE_QUAD_STREAK
  }

  private fun isQuadGeometryValid(corners: List<Pair<Float, Float>>): Boolean {
    if (corners.size < 4) {
      return false
    }
    val area =
        kotlin.math.abs(
            polygonSignedArea(
                listOf(corners[0], corners[1], corners[2], corners[3]),
            ),
        )
    if (area < MIN_TRACKED_PAGE_AREA_PX) {
      return false
    }

    val edgeLengths =
        listOf(
            distance(corners[0], corners[1]),
            distance(corners[1], corners[2]),
            distance(corners[2], corners[3]),
            distance(corners[3], corners[0]),
        )
    val minEdge = edgeLengths.minOrNull() ?: return false
    val maxEdge = edgeLengths.maxOrNull() ?: return false
    if (minEdge < MIN_TRACKED_PAGE_EDGE_PX) {
      return false
    }
    if (maxEdge / minEdge > MAX_TRACKED_PAGE_EDGE_RATIO) {
      return false
    }

    val orientation = polygonSignedArea(corners)
    if (kotlin.math.abs(orientation) < 1e-3f) {
      return false
    }
    return true
  }

  private fun polygonSignedArea(corners: List<Pair<Float, Float>>): Float {
    var acc = 0f
    for (i in corners.indices) {
      val current = corners[i]
      val next = corners[(i + 1) % corners.size]
      acc += (current.first * next.second) - (next.first * current.second)
    }
    return 0.5f * acc
  }

  private fun distance(a: Pair<Float, Float>, b: Pair<Float, Float>): Float {
    val dx = a.first - b.first
    val dy = a.second - b.second
    return sqrt((dx * dx) + (dy * dy))
  }

  private fun buildTrackedSampleOffsets(trackedNode: TrackedImageNode): List<Pair<Float, Float>> {
    // Cover the full printable subject body (head/tail/legs), not just center area.
    val xRatios = listOf(-0.32f, -0.24f, -0.16f, -0.08f, 0f, 0.08f, 0.16f, 0.24f, 0.32f)
    val zRatios = listOf(-0.24f, -0.16f, -0.08f, 0f, 0.08f, 0.16f, 0.24f, 0.32f)
    return buildList {
      zRatios.forEach { zRatio ->
        xRatios.forEach { xRatio ->
          add((trackedNode.imageExtentX * xRatio) to (trackedNode.imageExtentZ * zRatio))
        }
      }
      add(0f to (trackedNode.imageExtentZ * PAGE_COLOR_SAMPLE_CENTER_Z_RATIO))
      add((trackedNode.imageExtentX * 0.35f) to (trackedNode.imageExtentZ * 0.05f))
      add((-trackedNode.imageExtentX * 0.35f) to (trackedNode.imageExtentZ * 0.05f))
      add((trackedNode.imageExtentX * 0.30f) to (trackedNode.imageExtentZ * -0.12f))
      add((-trackedNode.imageExtentX * 0.30f) to (trackedNode.imageExtentZ * -0.12f))
    }
  }

  private fun trimSamplePointsToSubject(
      points: List<Pair<Float, Float>>,
      keepRatio: Float = SUBJECT_SAMPLE_POINT_KEEP_RATIO,
      minimumCount: Int = 6,
  ): List<Pair<Float, Float>> {
    if (points.size <= minimumCount) {
      return points
    }

    val centerX = points.map { it.first }.average().toFloat()
    val centerY = points.map { it.second }.average().toFloat()
    val keepCount =
        (points.size * keepRatio)
            .roundToInt()
            .coerceAtLeast(minimumCount)
            .coerceAtMost(points.size)

    return points
        .asSequence()
        .map { point ->
          val dx = point.first - centerX
          val dy = point.second - centerY
          val distanceSq = (dx * dx) + (dy * dy)
          point to distanceSq
        }
        .sortedBy { it.second }
        .take(keepCount)
        .map { it.first }
        .toList()
  }

  private fun sanitizeSampledTexture(bitmap: Bitmap): Bitmap {
    val outputWidth = bitmap.width
    val outputHeight = bitmap.height
    if (outputWidth <= 0 || outputHeight <= 0) {
      return bitmap
    }
    if (outputWidth != outputHeight) {
      return bitmap
    }

    // Full-page masks: true = pixel falls inside the bear body coloring region.
    // Background (forest, sky, border) pixels will be set to WHITE so the 3D model
    // shows clean white for uncolored areas instead of the background scene colors.
    val subjectMask = getFullPageSubjectMask(outputWidth)
    val refPixels = getFullPageReferencePixels(outputWidth)

    val currentPixels = IntArray(outputWidth * outputHeight)
    bitmap.getPixels(currentPixels, 0, outputWidth, 0, 0, outputWidth, outputHeight)

    val previousBitmap =
        lastAcceptedTextureBitmap?.takeIf { it.width == outputWidth && it.height == outputHeight }
    val previousPixels =
        previousBitmap?.let {
          IntArray(outputWidth * outputHeight).also { buffer ->
            it.getPixels(buffer, 0, outputWidth, 0, 0, outputWidth, outputHeight)
          }
        }
    val colorConsensus =
        pendingColorConsensusBySize.getOrPut(outputWidth) {
          IntArray(outputWidth * outputHeight)
        }

    if (previousPixels != null) {
      val occlusionRatio = estimateOcclusionRatio(currentPixels, previousPixels, refPixels, subjectMask)
      if (occlusionRatio >= MAX_FRAME_OCCLUSION_RATIO) {
        return Bitmap.createBitmap(previousPixels, outputWidth, outputHeight, Bitmap.Config.ARGB_8888)
      }
    }

    var coloredCount = 0
    var redAcc = 0L
    var greenAcc = 0L
    var blueAcc = 0L
    for (index in currentPixels.indices) {
      if (!subjectMask[index]) continue
      val camPixel = currentPixels[index]
      val refPixel = refPixels[index]
      val isUserColored = isLikelyUserDrawingPixel(camPixel, refPixel)
      val stableUserColored = updateAndCheckColorConsensus(colorConsensus, index, isUserColored)
      if (stableUserColored) {
        redAcc += android.graphics.Color.red(camPixel)
        greenAcc += android.graphics.Color.green(camPixel)
        blueAcc += android.graphics.Color.blue(camPixel)
        coloredCount++
      }
    }

    val hasUserColoring = coloredCount >= MIN_COLORED_PIXELS_FOR_TEXTURE

    if ((now() - lastTextureDebugLogTimeMs) >= 2000L) {
      android.util.Log.i(
          "ARScannerActivity",
          "Full-page texture: colored px=$coloredCount hasColoring=$hasUserColoring",
      )
    }

    for (index in currentPixels.indices) {
      val camPixel = currentPixels[index]
      val previous = previousPixels?.get(index)

      // Outside bear body region → WHITE so model background is clean, not forest colors
      if (!subjectMask[index]) {
        currentPixels[index] = android.graphics.Color.WHITE
        continue
      }

      // Skin/hand → reject, keep previous or white
      if (isLikelySkinTone(camPixel)) {
        currentPixels[index] = previous ?: android.graphics.Color.WHITE
        continue
      }

      val refPixel = refPixels[index]
      val isUserColored = isLikelyUserDrawingPixel(camPixel, refPixel)
      val stableUserColored = updateAndCheckColorConsensus(colorConsensus, index, isUserColored)

      currentPixels[index] = if (stableUserColored) {
        // User colored here → show the crayon color faithfully
        if (previous != null) blendRgb(previous, camPixel, TEXTURE_BLEND_ALPHA) else camPixel
      } else {
        // Not colored yet → hold previous or white (uncolored bear stays white)
        previous ?: android.graphics.Color.WHITE
      }
    }

    return Bitmap.createBitmap(currentPixels, outputWidth, outputHeight, Bitmap.Config.ARGB_8888)
  }

  private fun updateAndCheckColorConsensus(
      consensus: IntArray,
      index: Int,
      isUserColored: Boolean,
  ): Boolean {
    if (index !in consensus.indices) {
      return isUserColored
    }
    if (isUserColored) {
      consensus[index] = (consensus[index] + 1).coerceAtMost(MAX_PIXEL_COLOR_CONSENSUS)
    } else {
      consensus[index] = (consensus[index] - 1).coerceAtLeast(0)
    }
    return consensus[index] >= MIN_PIXEL_COLOR_CONSENSUS
  }

  private fun estimateOcclusionRatio(
      currentPixels: IntArray,
      previousPixels: IntArray,
      referencePixels: IntArray?,
      subjectMask: BooleanArray?,
  ): Float {
    val compareCount = min(currentPixels.size, previousPixels.size)
    if (compareCount <= 0) {
      return 0f
    }
    var subjectCount = 0
    var occlusionCount = 0
    for (index in 0 until compareCount) {
      if (subjectMask != null && !subjectMask.getOrElse(index) { false }) {
        continue
      }
      val current = currentPixels[index]
      val previous = previousPixels[index]
      val ref = referencePixels?.getOrNull(index)
      subjectCount += 1

      val refDeltaSq = ref?.let { colorDistanceSq(current, it) } ?: 0
      val prevDeltaSq = colorDistanceSq(current, previous)
      val looksNeutralOccluder = isLikelyNeutralOccluder(current)
      val candidateOcclusion =
          looksNeutralOccluder &&
              prevDeltaSq >= OCCLUSION_PREVIOUS_DELTA_THRESHOLD_SQ &&
              (ref == null || refDeltaSq >= OCCLUSION_REFERENCE_DELTA_THRESHOLD_SQ)
      if (candidateOcclusion) {
        occlusionCount += 1
      }
    }
    if (subjectCount <= 0) {
      return 0f
    }
    return occlusionCount.toFloat() / subjectCount.toFloat()
  }

  private fun isLikelyNeutralOccluder(colorInt: Int): Boolean {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(colorInt, hsv)
    val value = hsv[2]
    val saturation = hsv[1]
    return (value in 0.05f..0.55f && saturation <= 0.22f) || value < 0.08f
  }

  private fun isLikelyUserDrawingPixel(cameraPixel: Int, referencePixel: Int?): Boolean {
    if (isLikelySkinTone(cameraPixel) || isLikelyNeutralOccluder(cameraPixel)) {
      return false
    }

    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(cameraPixel, hsv)
    val saturation = hsv[1]
    val value = hsv[2]
    val red = android.graphics.Color.red(cameraPixel)
    val green = android.graphics.Color.green(cameraPixel)
    val blue = android.graphics.Color.blue(cameraPixel)
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))

    // Accept only crayon-like pixels: sufficiently colorful and not too dark.
    if (saturation < MIN_DRAWING_SATURATION || value < MIN_DRAWING_VALUE || chroma < MIN_DRAWING_CHROMA) {
      return false
    }

    if (referencePixel == null) {
      return true
    }

    val deltaSq = colorDistanceSq(cameraPixel, referencePixel)
    if (deltaSq < DELTA_COLORED_THRESHOLD_SQ) {
      return false
    }

    // Reject mostly illumination-only shifts that stay close to reference hue/sat.
    val refHsv = FloatArray(3)
    android.graphics.Color.colorToHSV(referencePixel, refHsv)
    val hueShift = hueDistance(hsv[0], refHsv[0])
    val satShift = abs(saturation - refHsv[1])
    val valueShift = abs(value - refHsv[2])
    if (hueShift <= MAX_REFERENCE_HUE_SHIFT_DEGREES &&
        satShift <= MAX_REFERENCE_SAT_SHIFT &&
        valueShift <= MAX_REFERENCE_VALUE_SHIFT) {
      return false
    }

    return true
  }

  private fun hueDistance(first: Float, second: Float): Float {
    val raw = abs(first - second)
    return min(raw, 360f - raw)
  }

  private fun computeNeutralBaseColor(referencePixels: IntArray?, subjectMask: BooleanArray?): Int {
    val refs = referencePixels ?: return DEFAULT_NEUTRAL_BEAR_COLOR
    val mask = subjectMask ?: BooleanArray(refs.size) { true }
    var redAcc = 0L
    var greenAcc = 0L
    var blueAcc = 0L
    var count = 0
    val limit = min(refs.size, mask.size)
    for (index in 0 until limit) {
      if (!mask[index]) {
        continue
      }
      val color = refs[index]
      if (!isReferenceSubjectFillPixel(color)) {
        continue
      }
      redAcc += android.graphics.Color.red(color).toLong()
      greenAcc += android.graphics.Color.green(color).toLong()
      blueAcc += android.graphics.Color.blue(color).toLong()
      count += 1
    }
    if (count <= 0) {
      return DEFAULT_NEUTRAL_BEAR_COLOR
    }
    return android.graphics.Color.rgb(
        (redAcc / count).toInt().coerceIn(0, 255),
        (greenAcc / count).toInt().coerceIn(0, 255),
        (blueAcc / count).toInt().coerceIn(0, 255),
    )
  }

  private fun now(): Long = SystemClock.elapsedRealtime()

  private fun computeMaskedAverageColor(
      pixels: IntArray,
      mask: BooleanArray,
  ): Int {
    if (pixels.isEmpty() || mask.isEmpty()) {
      return DEFAULT_TINT_FALLBACK_COLOR
    }
    var redAcc = 0L
    var greenAcc = 0L
    var blueAcc = 0L
    var count = 0

    val limit = min(pixels.size, mask.size)
    for (index in 0 until limit) {
      if (!mask[index]) {
        continue
      }
      val color = pixels[index]
      redAcc += android.graphics.Color.red(color).toLong()
      greenAcc += android.graphics.Color.green(color).toLong()
      blueAcc += android.graphics.Color.blue(color).toLong()
      count += 1
    }
    if (count <= 0) {
      return DEFAULT_TINT_FALLBACK_COLOR
    }
    return android.graphics.Color.rgb(
        (redAcc / count).toInt().coerceIn(0, 255),
        (greenAcc / count).toInt().coerceIn(0, 255),
        (blueAcc / count).toInt().coerceIn(0, 255),
    )
  }

  private fun blendRgb(previousColor: Int, currentColor: Int, currentAlpha: Float): Int {
    val alpha = currentAlpha.coerceIn(0f, 1f)
    val invAlpha = 1f - alpha
    val red =
        ((android.graphics.Color.red(previousColor) * invAlpha) +
                (android.graphics.Color.red(currentColor) * alpha))
            .roundToInt()
            .coerceIn(0, 255)
    val green =
        ((android.graphics.Color.green(previousColor) * invAlpha) +
                (android.graphics.Color.green(currentColor) * alpha))
            .roundToInt()
            .coerceIn(0, 255)
    val blue =
        ((android.graphics.Color.blue(previousColor) * invAlpha) +
                (android.graphics.Color.blue(currentColor) * alpha))
            .roundToInt()
            .coerceIn(0, 255)
    return android.graphics.Color.rgb(red, green, blue)
  }

  private fun isLikelySkinTone(colorInt: Int): Boolean {
    val red = android.graphics.Color.red(colorInt)
    val green = android.graphics.Color.green(colorInt)
    val blue = android.graphics.Color.blue(colorInt)

    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(colorInt, hsv)
    val hue = hsv[0]
    val sat = hsv[1]
    val value = hsv[2]

    // True skin tones are warm (hue 5–28°) and LOW saturation (< 0.60).
    // Orange/red crayons have hue 25–50° and saturation > 0.65 — not skin.
    // This prevents orange, red, and warm crayon colors from being rejected.
    val hsvSkinMatch = hue in 5f..28f && sat in 0.14f..0.58f && value in 0.28f..0.98f

    // RGB: red-dominant, muted (not neon). delta cap avoids flagging vivid orange.
    val delta = red - green
    val rgbSkinMatch =
        red in 100..240 &&
            green in 55..200 &&
            blue in 28..165 &&
            red > green &&
            red > blue &&
            delta in 10..85

    // Both conditions must agree — reduces false positives from bright crayon colors.
    return hsvSkinMatch && rgbSkinMatch
  }

  private fun getReferenceSubjectMask(outputSize: Int): BooleanArray? {
    resizedSubjectMaskBySize[outputSize]?.let { return it }
    val template = loadReferenceSubjectMaskTemplate() ?: return null
    if (template.width <= 0 || template.height <= 0) {
      return null
    }
    val scaledMask = BooleanArray(outputSize * outputSize)
    for (row in 0 until outputSize) {
      val sourceY =
          ((row.toFloat() / (outputSize - 1).toFloat()) * (template.height - 1))
              .roundToInt()
              .coerceIn(0, template.height - 1)
      for (col in 0 until outputSize) {
        val sourceX =
            ((col.toFloat() / (outputSize - 1).toFloat()) * (template.width - 1))
                .roundToInt()
                .coerceIn(0, template.width - 1)
        scaledMask[(row * outputSize) + col] = template.mask[(sourceY * template.width) + sourceX]
      }
    }
    val eroded = erodeMask(scaledMask, outputSize, SUBJECT_MASK_EROSION_RADIUS_PX)
    resizedSubjectMaskBySize[outputSize] = eroded
    return eroded
  }

  private fun erodeMask(mask: BooleanArray, size: Int, radius: Int): BooleanArray {
    if (radius <= 0) {
      return mask
    }
    val output = BooleanArray(mask.size)
    for (row in 0 until size) {
      for (col in 0 until size) {
        var keep = true
        loop@ for (dy in -radius..radius) {
          val y = row + dy
          if (y !in 0 until size) {
            keep = false
            break
          }
          for (dx in -radius..radius) {
            val x = col + dx
            if (x !in 0 until size || !mask[(y * size) + x]) {
              keep = false
              break@loop
            }
          }
        }
        output[(row * size) + col] = keep
      }
    }
    return output
  }

  private fun loadReferenceSubjectMaskTemplate(): SubjectMaskTemplate? {
    referenceSubjectMaskTemplate?.let { return it }
    val referenceBitmap =
        runCatching {
              assets.open(requestedReferenceImageAsset).use { stream ->
                BitmapFactory.decodeStream(stream)
              }
            }
            .getOrNull()
            ?: return null

    val targetWidth = REFERENCE_MASK_TARGET_WIDTH_PX
    val scaledHeight =
        ((referenceBitmap.height.toFloat() / referenceBitmap.width.toFloat()) * targetWidth)
            .roundToInt()
            .coerceAtLeast(1)
    val scaledBitmap = Bitmap.createScaledBitmap(referenceBitmap, targetWidth, scaledHeight, true)

    val width = scaledBitmap.width
    val height = scaledBitmap.height
    val pixels = IntArray(width * height)
    scaledBitmap.getPixels(pixels, 0, width, 0, 0, width, height)
    val subjectCandidates = BooleanArray(pixels.size)
    for (index in pixels.indices) {
      subjectCandidates[index] = isReferenceSubjectCandidate(pixels[index])
    }
    val component =
        buildSeededReferenceSubjectMask(pixels, width, height)
            ?: selectBestSubjectComponent(subjectCandidates, width, height)
            ?: return null

    var minX = width
    var maxX = 0
    var minY = height
    var maxY = 0
    for (index in component.indices) {
      if (!component[index]) {
        continue
      }
      val x = index % width
      val y = index / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    if (minX >= maxX || minY >= maxY) {
      return null
    }

    val bboxWidth = (maxX - minX + 1).coerceAtLeast(1)
    val bboxHeight = (maxY - minY + 1).coerceAtLeast(1)
    val normalizedMask = BooleanArray(bboxWidth * bboxHeight)
    val refBboxPixels = IntArray(bboxWidth * bboxHeight)
    for (row in 0 until bboxHeight) {
      val sourceY = minY + row
      for (col in 0 until bboxWidth) {
        val sourceX = minX + col
        val srcIndex = (sourceY * width) + sourceX
        normalizedMask[(row * bboxWidth) + col] = component[srcIndex]
        refBboxPixels[(row * bboxWidth) + col] = pixels[srcIndex]
      }
    }

    val areaCount = normalizedMask.count { it }
    if (areaCount <= MIN_SUBJECT_MASK_PIXELS) {
      return null
    }

    val denomX = (width - 1).coerceAtLeast(1)
    val denomY = (height - 1).coerceAtLeast(1)
    val pageMinU = (minX.toFloat() / denomX.toFloat()).coerceIn(0f, 1f)
    val pageMaxU = (maxX.toFloat() / denomX.toFloat()).coerceIn(0f, 1f)
    val pageMinV = (minY.toFloat() / denomY.toFloat()).coerceIn(0f, 1f)
    val pageMaxV = (maxY.toFloat() / denomY.toFloat()).coerceIn(0f, 1f)

    val template =
        SubjectMaskTemplate(
            width = bboxWidth,
            height = bboxHeight,
            mask = normalizedMask,
            pageMinU = pageMinU,
            pageMinV = pageMinV,
            pageMaxU = pageMaxU,
            pageMaxV = pageMaxV,
            refPixels = refBboxPixels,
        )
    referenceSubjectMaskTemplate = template
    return template
  }

  private fun selectBestSubjectComponent(
      candidates: BooleanArray,
      width: Int,
      height: Int,
  ): BooleanArray? {
    if (candidates.isEmpty() || width <= 0 || height <= 0) {
      return null
    }
    val totalPixels = candidates.size.coerceAtLeast(1)
    val centerX = (width - 1) * 0.5f
    val centerY = (height - 1) * 0.5f
    val normScale = max(width.toFloat(), height.toFloat()).coerceAtLeast(1f)
    val visited = BooleanArray(candidates.size)
    val queue = ArrayDeque<Int>()

    var bestScore = Float.MAX_VALUE
    var bestIndices: IntArray? = null

    for (start in candidates.indices) {
      if (!candidates[start] || visited[start]) {
        continue
      }
      queue.clear()
      val componentPixels = ArrayList<Int>(2048)
      var minX = width
      var maxX = 0
      var minY = height
      var maxY = 0
      var touchesBorder = false
      var sumX = 0L
      var sumY = 0L

      queue.add(start)
      visited[start] = true

      while (queue.isNotEmpty()) {
        val index = queue.removeFirst()
        if (!candidates[index]) {
          continue
        }
        componentPixels.add(index)
        val x = index % width
        val y = index / width
        sumX += x.toLong()
        sumY += y.toLong()

        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (x == 0 || x == width - 1 || y == 0 || y == height - 1) {
          touchesBorder = true
        }

        if (x > 0) {
          val left = index - 1
          if (!visited[left]) {
            visited[left] = true
            queue.add(left)
          }
        }
        if (x < width - 1) {
          val right = index + 1
          if (!visited[right]) {
            visited[right] = true
            queue.add(right)
          }
        }
        if (y > 0) {
          val top = index - width
          if (!visited[top]) {
            visited[top] = true
            queue.add(top)
          }
        }
        if (y < height - 1) {
          val bottom = index + width
          if (!visited[bottom]) {
            visited[bottom] = true
            queue.add(bottom)
          }
        }
      }

      val area = componentPixels.size
      if (area < MIN_SUBJECT_MASK_PIXELS) {
        continue
      }
      val areaRatio = area.toFloat() / totalPixels.toFloat()
      if (areaRatio > SUBJECT_COMPONENT_MAX_AREA_RATIO) {
        continue
      }
      val centroidX = sumX.toFloat() / area.toFloat()
      val centroidY = sumY.toFloat() / area.toFloat()
      val distNorm =
          (sqrt(((centroidX - centerX) * (centroidX - centerX)) + ((centroidY - centerY) * (centroidY - centerY))) /
              normScale)
              .coerceIn(0f, 1f)
      val areaPenalty = abs(areaRatio - SUBJECT_COMPONENT_TARGET_AREA_RATIO)
      val bboxWidth = (maxX - minX + 1).coerceAtLeast(1)
      val bboxHeight = (maxY - minY + 1).coerceAtLeast(1)
      val bboxFillRatio = area.toFloat() / (bboxWidth * bboxHeight).toFloat().coerceAtLeast(1f)
      val compactnessPenalty = abs(bboxFillRatio - SUBJECT_COMPONENT_TARGET_BBOX_FILL_RATIO)
      val borderPenalty = if (touchesBorder) SUBJECT_COMPONENT_BORDER_PENALTY else 0f
      val score =
          (distNorm * SUBJECT_COMPONENT_CENTER_WEIGHT) +
              (areaPenalty * SUBJECT_COMPONENT_AREA_WEIGHT) +
              (compactnessPenalty * SUBJECT_COMPONENT_COMPACTNESS_WEIGHT) +
              borderPenalty

      if (score < bestScore) {
        bestScore = score
        bestIndices = IntArray(componentPixels.size) { idx -> componentPixels[idx] }
      }
    }

    val chosen = bestIndices ?: return null
    return BooleanArray(candidates.size).also { mask ->
      chosen.forEach { index -> mask[index] = true }
    }
  }

  private fun buildSeededReferenceSubjectMask(
      pixels: IntArray,
      width: Int,
      height: Int,
  ): BooleanArray? {
    if (pixels.isEmpty() || width <= 0 || height <= 0) {
      return null
    }
    var bestMask: BooleanArray? = null
    var bestArea = 0
    val totalPixels = (width * height).coerceAtLeast(1)

    SUBJECT_MASK_SEED_POINTS.forEach { (u, v) ->
      val seedX = (u * (width - 1)).roundToInt().coerceIn(0, width - 1)
      val seedY = (v * (height - 1)).roundToInt().coerceIn(0, height - 1)
      val mask = floodFillReferenceSubjectRegion(pixels, width, height, seedX, seedY) ?: return@forEach
      val area = mask.count { it }
      if (area > bestArea) {
        bestArea = area
        bestMask = mask
      }
    }

    if (bestMask == null || bestArea < MIN_SUBJECT_MASK_PIXELS) {
      return null
    }
    val areaRatio = bestArea.toFloat() / totalPixels.toFloat()
    if (areaRatio > SUBJECT_COMPONENT_MAX_AREA_RATIO) {
      return null
    }
    return bestMask
  }

  private fun floodFillReferenceSubjectRegion(
      pixels: IntArray,
      width: Int,
      height: Int,
      seedX: Int,
      seedY: Int,
  ): BooleanArray? {
    val startIndex = (seedY * width) + seedX
    if (startIndex !in pixels.indices || !isReferenceSubjectFillPixel(pixels[startIndex])) {
      return null
    }
    val queue = ArrayDeque<Int>()
    val visited = BooleanArray(pixels.size)
    val mask = BooleanArray(pixels.size)
    queue.add(startIndex)
    visited[startIndex] = true
    var area = 0

    while (queue.isNotEmpty()) {
      val index = queue.removeFirst()
      if (!isReferenceSubjectFillPixel(pixels[index])) {
        continue
      }
      mask[index] = true
      area += 1
      val x = index % width
      val y = index / width

      if (x > 0) {
        val left = index - 1
        if (!visited[left]) {
          visited[left] = true
          queue.add(left)
        }
      }
      if (x < width - 1) {
        val right = index + 1
        if (!visited[right]) {
          visited[right] = true
          queue.add(right)
        }
      }
      if (y > 0) {
        val top = index - width
        if (!visited[top]) {
          visited[top] = true
          queue.add(top)
        }
      }
      if (y < height - 1) {
        val bottom = index + width
        if (!visited[bottom]) {
          visited[bottom] = true
          queue.add(bottom)
        }
      }
    }

    return if (area >= MIN_SUBJECT_MASK_PIXELS) mask else null
  }

  private fun isReferenceSubjectFillPixel(colorInt: Int): Boolean {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(colorInt, hsv)
    val red = android.graphics.Color.red(colorInt)
    val green = android.graphics.Color.green(colorInt)
    val blue = android.graphics.Color.blue(colorInt)
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))
    val average = (red + green + blue) / 3
    return hsv[2] >= REFERENCE_FILL_MIN_BRIGHTNESS &&
        hsv[2] <= REFERENCE_FILL_MAX_BRIGHTNESS &&
        hsv[1] <= REFERENCE_FILL_MAX_SATURATION &&
        chroma <= REFERENCE_FILL_MAX_CHROMA &&
        average >= REFERENCE_FILL_MIN_AVERAGE_RGB
  }

  private fun isReferenceSubjectCandidate(colorInt: Int): Boolean {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(colorInt, hsv)
    val red = android.graphics.Color.red(colorInt)
    val green = android.graphics.Color.green(colorInt)
    val blue = android.graphics.Color.blue(colorInt)
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))
    val average = (red + green + blue) / 3
    return hsv[1] <= REFERENCE_SUBJECT_MAX_SATURATION &&
        hsv[2] >= REFERENCE_SUBJECT_MIN_BRIGHTNESS &&
        hsv[2] <= REFERENCE_SUBJECT_MAX_BRIGHTNESS &&
        chroma <= REFERENCE_SUBJECT_MAX_CHROMA &&
        average >= REFERENCE_SUBJECT_MIN_AVERAGE_RGB
  }

  private fun shouldApplyLiveTint(sampledColor: Int): Boolean {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(sampledColor, hsv)
    return hsv[1] >= MIN_COLORING_SATURATION && hsv[2] >= MIN_COLORING_BRIGHTNESS
  }

  private fun resetTintIfNeeded(trackedNode: TrackedImageNode) {
    if (!trackedNode.tintApplied) {
      return
    }

    runCatching {
          if (trackedNode.usesTintMaterial) {
            trackedNode.tintMaterial?.let { tintMaterial ->
              resetMaterialTint(tintMaterial)
            }
            restoreOriginalMaterials(trackedNode)
          } else {
            val renderableInstance = trackedNode.renderableInstance ?: return@runCatching
            val materialCount = renderableInstance.materialsCount
            for (materialIndex in 0 until materialCount) {
              val material = renderableInstance.getMaterial(materialIndex)
              resetMaterialTint(material)
            }
          }
          trackedNode.tintApplied = false
        }
        .onFailure { error ->
          android.util.Log.w("ARScannerActivity", "Failed to reset tint to original material.", error)
        }
  }

  private fun applyTintToMaterial(
      material: Material,
      red: Float,
      green: Float,
      blue: Float,
      emissiveBoost: Float,
  ) {
    runCatching { material.setFloat4(MaterialFactory.MATERIAL_COLOR, red, green, blue, 1f) }
    runCatching { material.setFloat4("baseColorTint", red, green, blue, 1f) }
    runCatching { material.setFloat4("baseColorFactor", red, green, blue, 1f) }
    val emissiveScale = (emissiveBoost * 0.08f).coerceIn(0f, 0.12f)
    val emissiveRed = (red * emissiveScale).coerceIn(0f, MAX_EMISSIVE_VALUE)
    val emissiveGreen = (green * emissiveScale).coerceIn(0f, MAX_EMISSIVE_VALUE)
    val emissiveBlue = (blue * emissiveScale).coerceIn(0f, MAX_EMISSIVE_VALUE)
    runCatching { material.setFloat3("emissiveFactor", emissiveRed, emissiveGreen, emissiveBlue) }
    runCatching { material.setFloat("emissiveStrength", emissiveScale) }
    runCatching { material.setFloat("metallicFactor", 0f) }
    runCatching { material.setFloat("roughnessFactor", 0.72f) }
    runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
    runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
  }

  private fun applyFallbackTint(trackedNode: TrackedImageNode) {
    val fallbackTint = computeVisibleTint(DEFAULT_TINT_FALLBACK_COLOR)
    val red = fallbackTint[0]
    val green = fallbackTint[1]
    val blue = fallbackTint[2]
    applySolidTintToTrackedNode(trackedNode, red, green, blue, "fallback")
    lastTintVector = fallbackTint
  }

  private fun computeApproxSaturation(red: Float, green: Float, blue: Float): Float {
    val maxChannel = max(red, max(green, blue))
    if (maxChannel <= 0f) {
      return 0f
    }
    val minChannel = min(red, min(green, blue))
    return ((maxChannel - minChannel) / maxChannel).coerceIn(0f, 1f)
  }

  private fun resetMaterialTint(material: Material) {
    runCatching { material.setFloat4(MaterialFactory.MATERIAL_COLOR, 1f, 1f, 1f, 1f) }
    runCatching { material.setFloat4("baseColorTint", 1f, 1f, 1f, 1f) }
    runCatching { material.setFloat4("baseColorFactor", 1f, 1f, 1f, 1f) }
    runCatching { material.setFloat3("emissiveFactor", 0f, 0f, 0f) }
    runCatching { material.setFloat("emissiveStrength", 0f) }
  }

  private fun computeVisibleTint(sampledColor: Int): FloatArray {
    val hsv = FloatArray(3)
    android.graphics.Color.colorToHSV(sampledColor, hsv)
    val sourceSaturation = hsv[1]
    val sourceValue = hsv[2]
    // Boost saturation to compensate for camera desaturation and AR lighting
    hsv[1] =
        if (sourceSaturation < 0.08f) {
          (sourceSaturation * 0.9f).coerceIn(0f, 1f)
        } else {
          (sourceSaturation * 1.25f).coerceIn(0f, 1f)
        }
    // Preserve value/brightness close to original — paper colors should match 3D model
    val valueScale =
        when {
          sourceValue > 0.92f -> 0.92f
          sourceValue > 0.80f -> 0.95f
          else -> 0.98f
        }
    hsv[2] = (sourceValue * valueScale).coerceIn(0.12f, 0.97f)
    val mapped = android.graphics.Color.HSVToColor(hsv)
    return floatArrayOf(
        (android.graphics.Color.red(mapped) / 255f).coerceIn(0f, 1f),
        (android.graphics.Color.green(mapped) / 255f).coerceIn(0f, 1f),
        (android.graphics.Color.blue(mapped) / 255f).coerceIn(0f, 1f),
    )
  }

  private fun computeEmissiveBoost(tint: FloatArray): Float {
    val averageBrightness = (tint[0] + tint[1] + tint[2]) / 3f
    val darkness = (1f - averageBrightness).coerceIn(0f, 1f)
    return BASE_EMISSIVE_BOOST + (darkness * EXTRA_EMISSIVE_BOOST_DARK_SCENES)
  }

  private fun smoothTint(current: FloatArray, previous: FloatArray?): FloatArray {
    if (previous == null) {
      return current
    }

    val alpha = TINT_SMOOTHING_ALPHA
    val red = previous[0] + ((current[0] - previous[0]) * alpha)
    val green = previous[1] + ((current[1] - previous[1]) * alpha)
    val blue = previous[2] + ((current[2] - previous[2]) * alpha)
    return floatArrayOf(red.coerceIn(0f, 1f), green.coerceIn(0f, 1f), blue.coerceIn(0f, 1f))
  }

  private fun setupGestureDetectors() {
    scaleGestureDetector =
        ScaleGestureDetector(
            this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
              override fun onScale(detector: ScaleGestureDetector): Boolean {
                val incrementalFactor =
                    detector.scaleFactor.coerceIn(MIN_PINCH_STEP_FACTOR, MAX_PINCH_STEP_FACTOR)
                if (trackedNodes.isEmpty()) {
                  return false
                }
                trackedNodes.values.forEach { trackedNode ->
                  trackedNode.userScaleMultiplier =
                      (trackedNode.userScaleMultiplier * incrementalFactor)
                          .coerceIn(USER_SCALE_MIN_MULTIPLIER, USER_SCALE_MAX_MULTIPLIER)
                  applyUserTransform(trackedNode)
                }
                return true
              }
            },
        )
  }

  private fun handleGestureTouch(motionEvent: MotionEvent): Boolean {
    val scaleGestureHandled = scaleGestureDetector.onTouchEvent(motionEvent)
    var rotationHandled = false

    when (motionEvent.actionMasked) {
      MotionEvent.ACTION_POINTER_DOWN -> {
        if (motionEvent.pointerCount >= 2) {
          lastTwoPointerAngleDegrees = computeTwoPointerAngleDegrees(motionEvent)
        }
      }

      MotionEvent.ACTION_MOVE -> {
        if (motionEvent.pointerCount >= 2) {
          val currentAngle = computeTwoPointerAngleDegrees(motionEvent)
          val previousAngle = lastTwoPointerAngleDegrees
          if (currentAngle != null && previousAngle != null) {
            val rawDelta = currentAngle - previousAngle
            val normalizedDelta = normalizeRotationDelta(rawDelta)
            if (abs(normalizedDelta) >= MIN_ROTATION_DELTA_DEGREES) {
              trackedNodes.values.forEach { trackedNode ->
                trackedNode.userYawDegrees += normalizedDelta * ROTATION_GESTURE_SENSITIVITY
                applyUserTransform(trackedNode)
              }
              rotationHandled = true
            }
          }
          lastTwoPointerAngleDegrees = currentAngle
        } else {
          lastTwoPointerAngleDegrees = null
        }
      }

      MotionEvent.ACTION_POINTER_UP,
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> {
        if (motionEvent.pointerCount < 2) {
          lastTwoPointerAngleDegrees = null
        }
      }
    }

    return scaleGestureHandled || rotationHandled
  }

  private fun applyUserTransform(trackedNode: TrackedImageNode) {
    val finalScale =
        (trackedNode.baseScale * trackedNode.userScaleMultiplier).coerceIn(MIN_MODEL_SCALE, MAX_MODEL_SCALE)
    val rotation = composeModelRotation(trackedNode.userYawDegrees)
    val rotatedCenter = Quaternion.rotateVector(
        rotation,
        Vector3(trackedNode.modelBounds.centerX, trackedNode.modelBounds.centerY, trackedNode.modelBounds.centerZ),
    )

    trackedNode.modelNode.localScale = Vector3(finalScale, finalScale, finalScale)
    trackedNode.modelNode.localRotation = rotation
    trackedNode.modelNode.localPosition =
        Vector3(
            trackedNode.imageExtentX * PAGE_MODEL_OFFSET_X_RATIO - rotatedCenter.x * finalScale,
            computeSurfaceOffsetY(trackedNode.modelBounds, rotation, finalScale),
            trackedNode.imageExtentZ * PAGE_MODEL_OFFSET_Z_RATIO - rotatedCenter.z * finalScale,
        )
  }

  private fun computeSurfaceOffsetY(
      modelBounds: ModelBounds,
      rotation: Quaternion,
      modelScale: Float,
  ): Float {
    val axisX = Quaternion.rotateVector(rotation, Vector3(1f, 0f, 0f))
    val axisY = Quaternion.rotateVector(rotation, Vector3(0f, 1f, 0f))
    val axisZ = Quaternion.rotateVector(rotation, Vector3(0f, 0f, 1f))

    val halfX = modelBounds.sizeX * 0.5f
    val halfY = modelBounds.sizeY * 0.5f
    val halfZ = modelBounds.sizeZ * 0.5f

    val rotatedCenter =
        Quaternion.rotateVector(
            rotation,
            Vector3(modelBounds.centerX, modelBounds.centerY, modelBounds.centerZ),
        )

    val verticalHalfExtent =
        abs(axisX.y) * halfX + abs(axisY.y) * halfY + abs(axisZ.y) * halfZ
    val minY = rotatedCenter.y - verticalHalfExtent
    val rawSurfaceOffset = -minY * modelScale
    val biasAdjustedOffset = rawSurfaceOffset - SURFACE_CONTACT_BIAS_METERS
    val nominalHeight = (modelBounds.sizeY * modelScale).coerceAtLeast(0.0005f)
    val minAllowedOffset =
        max(MIN_SURFACE_OFFSET_METERS, nominalHeight * MIN_SURFACE_OFFSET_RATIO)
    val maxAllowedOffset =
        min(MAX_SURFACE_OFFSET_METERS, nominalHeight * MAX_SURFACE_OFFSET_RATIO)
    val groundedOffset = biasAdjustedOffset.coerceIn(minAllowedOffset, maxAllowedOffset)

    return groundedOffset + SURFACE_LIFT_EPSILON
  }

  private fun composeModelRotation(yawDegrees: Float): Quaternion {
    val basePitch = Quaternion.axisAngle(Vector3(1f, 0f, 0f), BASE_MODEL_PITCH_DEGREES)
    val baseRoll = Quaternion.axisAngle(Vector3(0f, 0f, 1f), BASE_MODEL_ROLL_DEGREES)
    val userYaw = Quaternion.axisAngle(Vector3(0f, 1f, 0f), yawDegrees)
    val flatBase = Quaternion.multiply(baseRoll, basePitch)
    return Quaternion.multiply(userYaw, flatBase)
  }

  private fun computeTwoPointerAngleDegrees(motionEvent: MotionEvent): Float? {
    if (motionEvent.pointerCount < 2) {
      return null
    }
    val dx = motionEvent.getX(1) - motionEvent.getX(0)
    val dy = motionEvent.getY(1) - motionEvent.getY(0)
    val angleRadians = atan2(dy, dx)
    return (angleRadians * (180.0 / PI)).toFloat()
  }

  private fun normalizeRotationDelta(delta: Float): Float {
    var normalized = delta
    while (normalized > 180f) normalized -= 360f
    while (normalized < -180f) normalized += 360f
    return normalized
  }

  private fun isTintSignificantlyChanged(current: FloatArray, previous: FloatArray?): Boolean {
    if (previous == null) {
      return true
    }

    val delta =
        abs(current[0] - previous[0]) +
            abs(current[1] - previous[1]) +
            abs(current[2] - previous[2])
    return delta >= MIN_TINT_DELTA
  }

  private fun colorDistanceRgb(colorA: Int, colorB: Int): Int {
    val redDelta = abs(android.graphics.Color.red(colorA) - android.graphics.Color.red(colorB))
    val greenDelta = abs(android.graphics.Color.green(colorA) - android.graphics.Color.green(colorB))
    val blueDelta = abs(android.graphics.Color.blue(colorA) - android.graphics.Color.blue(colorB))
    return redDelta + greenDelta + blueDelta
  }

  private fun colorDistanceSq(colorA: Int, colorB: Int): Int {
    val dr = android.graphics.Color.red(colorA) - android.graphics.Color.red(colorB)
    val dg = android.graphics.Color.green(colorA) - android.graphics.Color.green(colorB)
    val db = android.graphics.Color.blue(colorA) - android.graphics.Color.blue(colorB)
    return (dr * dr) + (dg * dg) + (db * db)
  }

  private fun getScaledReferencePixels(outputSize: Int): IntArray? {
    resizedReferencePixelsBySize[outputSize]?.let { return it }
    val template = loadReferenceSubjectMaskTemplate() ?: return null
    val src = template.refPixels ?: return null
    val srcW = template.width
    val srcH = template.height
    if (srcW <= 0 || srcH <= 0) return null
    val scaled = IntArray(outputSize * outputSize) { idx ->
      val row = idx / outputSize
      val col = idx % outputSize
      val srcY =
          ((row.toFloat() / (outputSize - 1).toFloat()) * (srcH - 1))
              .roundToInt()
              .coerceIn(0, srcH - 1)
      val srcX =
          ((col.toFloat() / (outputSize - 1).toFloat()) * (srcW - 1))
              .roundToInt()
              .coerceIn(0, srcW - 1)
      src[(srcY * srcW) + srcX]
    }
    resizedReferencePixelsBySize[outputSize] = scaled
    return scaled
  }

  /**
   * Returns a subject mask in FULL PAGE UV space (outputSize × outputSize covering the entire
   * reference page 0→1). Pixels within the bear body coloring region are true; all other pixels
   * (background forest, border, etc.) are false so they render as WHITE on the 3D model.
   */
  private fun getFullPageSubjectMask(outputSize: Int): BooleanArray {
    fullPageSubjectMaskBySize[outputSize]?.let { return it }
    val template = loadReferenceSubjectMaskTemplate()
        ?: return BooleanArray(outputSize * outputSize) { false }

    val fullMask = BooleanArray(outputSize * outputSize) { false }
    val denomU = (template.pageMaxU - template.pageMinU).coerceAtLeast(0.001f)
    val denomV = (template.pageMaxV - template.pageMinV).coerceAtLeast(0.001f)
    val refPixels = template.refPixels

    for (row in 0 until outputSize) {
      val v = row.toFloat() / (outputSize - 1).toFloat()
      if (v < template.pageMinV || v > template.pageMaxV) continue
      for (col in 0 until outputSize) {
        val u = col.toFloat() / (outputSize - 1).toFloat()
        if (u < template.pageMinU || u > template.pageMaxU) continue

        val uLocal = ((u - template.pageMinU) / denomU).coerceIn(0f, 1f)
        val vLocal = ((v - template.pageMinV) / denomV).coerceIn(0f, 1f)
        val maskCol = (uLocal * (template.width - 1)).roundToInt().coerceIn(0, template.width - 1)
        val maskRow = (vLocal * (template.height - 1)).roundToInt().coerceIn(0, template.height - 1)
        val maskIndex = (maskRow * template.width) + maskCol

        // A pixel belongs to the subject if the flood-fill reached it OR if the reference
        // image pixel at that location is near-white (coloring-page paper area that flood fill
        // failed to reach — e.g. thin legs, paws). Forest/background pixels are visibly colored
        // in the reference image, so they remain excluded.
        val inFloodFill = template.mask[maskIndex]
        val refPixel = refPixels?.get(maskIndex) ?: android.graphics.Color.WHITE
        val isNearWhiteInReference = isReferencePageWhiteArea(refPixel)
        fullMask[(row * outputSize) + col] = inFloodFill || isNearWhiteInReference
      }
    }
    fullPageSubjectMaskBySize[outputSize] = fullMask
    return fullMask
  }

  /** Returns true when a reference-image pixel is the near-white paper/bear-body color of a
   *  coloring page (not a colored forest/background area). Used to recover areas that the
   *  flood-fill missed (e.g. thin legs or paws). */
  private fun isReferencePageWhiteArea(colorInt: Int): Boolean {
    val red = android.graphics.Color.red(colorInt)
    val green = android.graphics.Color.green(colorInt)
    val blue = android.graphics.Color.blue(colorInt)
    val average = (red + green + blue) / 3
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))
    return average >= 155 && chroma <= 50
  }

  /**
   * Returns reference pixels in FULL PAGE UV space. Pixels within the bear body region come from
   * the reference image; pixels outside (background) are WHITE so delta comparison works correctly.
   */
  private fun getFullPageReferencePixels(outputSize: Int): IntArray {
    fullPageReferencePixelsBySize[outputSize]?.let { return it }
    val template = loadReferenceSubjectMaskTemplate()
        ?: return IntArray(outputSize * outputSize) { android.graphics.Color.WHITE }

    val refPixels = template.refPixels
        ?: return IntArray(outputSize * outputSize) { android.graphics.Color.WHITE }

    val fullRef = IntArray(outputSize * outputSize) { android.graphics.Color.WHITE }
    val denomU = (template.pageMaxU - template.pageMinU).coerceAtLeast(0.001f)
    val denomV = (template.pageMaxV - template.pageMinV).coerceAtLeast(0.001f)

    for (row in 0 until outputSize) {
      val v = row.toFloat() / (outputSize - 1).toFloat()
      if (v < template.pageMinV || v > template.pageMaxV) continue
      for (col in 0 until outputSize) {
        val u = col.toFloat() / (outputSize - 1).toFloat()
        if (u < template.pageMinU || u > template.pageMaxU) continue

        val uLocal = ((u - template.pageMinU) / denomU).coerceIn(0f, 1f)
        val vLocal = ((v - template.pageMinV) / denomV).coerceIn(0f, 1f)
        val refCol = (uLocal * (template.width - 1)).roundToInt().coerceIn(0, template.width - 1)
        val refRow = (vLocal * (template.height - 1)).roundToInt().coerceIn(0, template.height - 1)
        fullRef[(row * outputSize) + col] = refPixels[(refRow * template.width) + refCol]
      }
    }
    fullPageReferencePixelsBySize[outputSize] = fullRef
    return fullRef
  }

  data class MaterialAttachResult(
      val applied: Boolean,
      val instanceSlotsApplied: Int,
      val submeshesApplied: Int,
      val directRenderableApplied: Int,
  )

  data class TrackedImageNode(
      val anchorNode: AnchorNode,
      val modelNode: Node,
      var renderable: ModelRenderable,
      var renderableInstance: RenderableInstance?,
      var animator: ObjectAnimator?,
      var animationPaused: Boolean,
      var floatAnimator: ValueAnimator?,
      var floatAnimatorPaused: Boolean,
      val basePositionY: Float,
      var originalMaterials: MutableList<Material>,
      var tintMaterial: Material?,
      var usesTintMaterial: Boolean,
      val imageExtentX: Float,
      val imageExtentZ: Float,
      val baseScale: Float,
      val modelBounds: ModelBounds,
      var userScaleMultiplier: Float,
      var userYawDegrees: Float,
      var tintApplied: Boolean,
      var tintBuildInFlight: Boolean,
      var lastSolidTintColor: Int?,
      var lastMaterialBuildTimeMs: Long,
      var tintLightNode: Node?,
  )

  data class ModelBounds(
      val horizontalSize: Float,
      val sizeX: Float,
      val sizeY: Float,
      val sizeZ: Float,
      val centerX: Float,
      val centerY: Float,
      val centerZ: Float,
  )

  data class TextureStats(
      val signature: Int,
      val gridColors: IntArray,
  )

  data class SubjectMaskTemplate(
      val width: Int,
      val height: Int,
      val mask: BooleanArray,
      val pageMinU: Float,
      val pageMinV: Float,
      val pageMaxU: Float,
      val pageMaxV: Float,
      val refPixels: IntArray? = null,
  )

  enum class PerformanceTier {
    LOW,
    MEDIUM,
    HIGH,
  }

  data class PerformanceProfile(
      val tier: PerformanceTier,
      val colorRefreshIntervalMs: Long,
      val textureRefreshIntervalMs: Long,
      val minTextureApplyIntervalMs: Long,
      val textureSampleSizePx: Int,
  )

  companion object {
    private const val AR_FRAGMENT_TAG = "ar_scanner_fragment"
    const val EXTRA_REFERENCE_IMAGE_ASSET = "referenceImageAsset"
    const val EXTRA_MODEL_ASSET = "modelAsset"
    private const val DEFAULT_MODEL_ASSET = "bear.glb"
    private val PREFERRED_ANIMATION_NAME_HINTS = listOf("idle", "walk", "eat", "run")
    private const val FRAME_PROCESS_INTERVAL_MS = 50L
    private const val COLOR_REFRESH_INTERVAL_MS = 80L
    private const val TEXTURE_REFRESH_INTERVAL_MS = 100L
    private const val TEXTURE_REFRESH_INTERVAL_MS_RELIEF = 400L
    private const val MIN_TEXTURE_APPLY_INTERVAL_MS = 120L
    private const val MIN_TEXTURE_APPLY_INTERVAL_MS_RELIEF = 500L
    private const val FORCE_TEXTURE_MATERIAL_REFRESH_MS = 2000L
    private const val TEXTURE_HOLD_AFTER_SAMPLE_MISS_MS = 10000L
    private const val DELTA_COLORED_THRESHOLD_SQ = 1400   // euclidean distance ~37 in RGB space — catches lighter crayon strokes
    private const val MIN_COLORED_PIXELS_FOR_TEXTURE = 14
    private const val TEXTURE_ONLY_WARMUP_MS = 1200L
    private const val TRACKING_GRACE_PERIOD_MS = 5000L
    private const val ANCHOR_SMOOTHING_ALPHA = 0.25f
    private const val ANCHOR_JITTER_THRESHOLD_SQ = 0.000004f  // ~2mm movement threshold
    private const val PAGE_FIT_RATIO = 0.35f
    private const val PAGE_MODEL_OFFSET_X_RATIO = 0.0f
    private const val PAGE_MODEL_OFFSET_Z_RATIO = -0.08f
    private const val DEFAULT_MODEL_UNIT_SIZE = 1f
    private const val DEFAULT_MODEL_HEIGHT_UNITS = 1f
    private const val BASE_MODEL_PITCH_DEGREES = 0f
    private const val BASE_MODEL_ROLL_DEGREES = 0f
    private const val DEFAULT_USER_YAW_DEGREES = 180f
    private const val SURFACE_LIFT_EPSILON = 0.0015f
    private const val MIN_MODEL_SCALE = 0.02f
    private const val MAX_MODEL_SCALE = 0.38f
    private const val FILL_LIGHT_KEY_INTENSITY = 950f
    private const val FILL_LIGHT_BACK_INTENSITY = 700f
    private const val FILL_LIGHT_SIDE_INTENSITY = 520f
    private const val FILL_LIGHT_RADIUS = 2.2f
    private const val TINT_LIGHT_INTENSITY = 300f
    private const val TINT_LIGHT_RADIUS = 1.3f
    private const val TINT_LIGHT_HEIGHT_METERS = 0.19f
    private const val TINT_LIGHT_FORWARD_METERS = 0.08f
    private const val USER_SCALE_MIN_MULTIPLIER = 0.35f
    private const val USER_SCALE_MAX_MULTIPLIER = 3.2f
    private const val MIN_PINCH_STEP_FACTOR = 0.88f
    private const val MAX_PINCH_STEP_FACTOR = 1.12f
    private const val ROTATION_GESTURE_SENSITIVITY = 0.85f
    private const val MIN_ROTATION_DELTA_DEGREES = 0.35f
    private const val MIN_COLORING_SATURATION = 0.03f
    private const val MIN_COLORING_BRIGHTNESS = 0.05f
    private const val TINT_SMOOTHING_ALPHA = 0.68f
    private const val MIN_TINT_DELTA = 0.04f
    private const val BASE_EMISSIVE_BOOST = 0.28f
    private const val EXTRA_EMISSIVE_BOOST_DARK_SCENES = 0.48f
    private const val MAX_EMISSIVE_VALUE = 1.20f
    private const val COLOR_HOLD_ON_NOISE_MS = 700L
    private const val MIN_MATERIAL_REBUILD_INTERVAL_MS = 180L
    private const val ANIMATION_PLAYBACK_SPEED = 0.72f
    private const val MIN_SURFACE_OFFSET_RATIO = 0.02f
    private const val MAX_SURFACE_OFFSET_RATIO = 0.34f
    private const val MIN_SURFACE_OFFSET_METERS = 0.001f
    private const val MAX_SURFACE_OFFSET_METERS = 0.060f
    private const val SURFACE_CONTACT_BIAS_METERS = 0.003f
    private const val PAGE_COLOR_SAMPLE_CENTER_Z_RATIO = 0.0f
    private const val PAGE_TEXTURE_SAMPLE_SIZE_PX = 52
    private const val PAGE_TEXTURE_SAMPLE_SIZE_PX_RELIEF = 36
    private const val PAGE_QUAD_INSET_RATIO = 0.030f
    private const val PAGE_TEXTURE_SAMPLE_PADDING_RATIO = 0.015f
    private const val SUBJECT_SAMPLE_POINT_KEEP_RATIO = 0.55f
    private const val SUBJECT_TEXTURE_POINT_KEEP_RATIO = 0.92f
    private const val SUBJECT_TEXTURE_MIN_SAMPLE_POINTS = 20
    private const val SUBJECT_TEXTURE_INSET_RATIO_X = 0.03f
    private const val SUBJECT_TEXTURE_INSET_RATIO_Y = 0.04f
    private const val SUBJECT_MASK_EROSION_RADIUS_PX = 1
    private const val TEXTURE_BLEND_ALPHA = 0.96f
    // Increased so vivid sketch colors are not wrongly rejected as skin
    private const val SKIN_REJECT_MIN_DELTA = 55
    private const val HAND_OCCLUSION_SKIN_RATIO = 0.08f
    private const val MIN_PENDING_SAMPLE_STREAK = 2
    private const val MIN_ACCEPTED_COLOR_SWITCH_DELTA = 36
    private const val PENDING_COLOR_MATCH_DELTA = 14
    private const val MIN_PENDING_TEXTURE_STREAK = 1
    private const val MIN_PENDING_TEXTURE_STREAK_LOCAL = 1
    private const val PENDING_TEXTURE_MATCH_DELTA = 12
    private const val MAX_TEXTURE_SPIKE_DELTA = 90
    private const val MAX_TEXTURE_SPIKE_WINDOW_MS = 7000L
    // Very high — texture updates are NOT blocked during active drawing
    private const val HAND_OCCLUSION_CHANGE_RATIO = 0.95f
    private const val HAND_OCCLUSION_MIN_DELTA = 200
    private const val LOCAL_SKETCH_MAX_CHANGE_RATIO = 0.45f
    private const val GRID_CELL_CHANGE_DELTA = 34
    private const val TEXTURE_STATS_GRID = 6
    private const val ENABLE_MODEL_ANIMATION = true
    private const val ENABLE_SOLID_TINT_FALLBACK = true
    private const val HIGH_FRAME_WORK_DURATION_MS = 14L
    private const val PERFORMANCE_RELIEF_WINDOW_MS = 1500L
    private const val CENTER_TEXTURE_FALLBACK_WIDTH_RATIO = 0.22f
    private const val CENTER_TEXTURE_FALLBACK_HEIGHT_RATIO = 0.18f
    private const val MIN_TEXTURE_SIGNATURE_DELTA = 12
    private const val MATERIAL_BINDING_BASE_COLOR = 0
    private const val MATERIAL_BINDING_SCENEFORM_TEXTURE = 1
    private const val MATERIAL_BINDING_BASE_COLOR_MAP = 2
    private const val MATERIAL_BINDING_BASE_COLOR_TEXTURE_NAME = 3
    private const val MATERIAL_BINDING_ALBEDO = 4
    private const val REFERENCE_MASK_TARGET_WIDTH_PX = 420
    private const val REFERENCE_SUBJECT_MAX_SATURATION = 0.15f
    private const val REFERENCE_SUBJECT_MIN_BRIGHTNESS = 0.80f
    private const val REFERENCE_SUBJECT_MAX_BRIGHTNESS = 1.0f
    private const val REFERENCE_SUBJECT_MAX_CHROMA = 45
    private const val REFERENCE_SUBJECT_MIN_AVERAGE_RGB = 185
    // Fill thresholds for the uncolored bear body — allows cream/off-white.
    // Sandy ground (sat≈0.41), green trees (sat≈0.56), sky (sat≈0.45) still fail.
    private const val REFERENCE_FILL_MIN_BRIGHTNESS = 0.76f
    private const val REFERENCE_FILL_MAX_BRIGHTNESS = 1.0f
    private const val REFERENCE_FILL_MAX_SATURATION = 0.26f
    private const val REFERENCE_FILL_MAX_CHROMA = 60
    private const val REFERENCE_FILL_MIN_AVERAGE_RGB = 168
    private const val MIN_SUBJECT_MASK_PIXELS = 600
    private const val SUBJECT_COMPONENT_MAX_AREA_RATIO = 0.58f
    private const val SUBJECT_COMPONENT_TARGET_AREA_RATIO = 0.22f
    private const val SUBJECT_COMPONENT_TARGET_BBOX_FILL_RATIO = 0.50f
    private const val SUBJECT_COMPONENT_CENTER_WEIGHT = 1.45f
    private const val SUBJECT_COMPONENT_AREA_WEIGHT = 2.0f
    private const val SUBJECT_COMPONENT_COMPACTNESS_WEIGHT = 0.85f
    private const val SUBJECT_COMPONENT_BORDER_PENALTY = 0.55f
    private const val PAGE_QUAD_MAX_MOTION_PX = 14.0f
    private const val PAGE_QUAD_MAX_SPEED_PX_PER_MS = 0.18f
    private const val MIN_STABLE_PAGE_QUAD_STREAK = 1
    private const val MIN_TRACKED_PAGE_AREA_PX = 4200f
    private const val MIN_TRACKED_PAGE_EDGE_PX = 34f
    private const val MAX_TRACKED_PAGE_EDGE_RATIO = 3.9f
    private const val MIN_PIXEL_COLOR_CONSENSUS = 1
    private const val MAX_PIXEL_COLOR_CONSENSUS = 3
    private const val MAX_FRAME_OCCLUSION_RATIO = 0.24f
    private const val OCCLUSION_PREVIOUS_DELTA_THRESHOLD_SQ = 2200
    private const val OCCLUSION_REFERENCE_DELTA_THRESHOLD_SQ = 2600
    private const val MIN_DRAWING_SATURATION = 0.14f
    private const val MIN_DRAWING_VALUE = 0.14f
    private const val MIN_DRAWING_CHROMA = 24
    private const val MAX_REFERENCE_HUE_SHIFT_DEGREES = 22f
    private const val MAX_REFERENCE_SAT_SHIFT = 0.20f
    private const val MAX_REFERENCE_VALUE_SHIFT = 0.22f
    private val SUBJECT_MASK_SEED_POINTS =
        listOf(
            0.50f to 0.40f,  // upper body / head area
            0.48f to 0.52f,  // center-upper body
            0.52f to 0.52f,  // center-upper body right
            0.44f to 0.60f,  // left mid-body
            0.56f to 0.60f,  // right mid-body
            0.50f to 0.65f,  // lower center body
            0.48f to 0.72f,  // lower body
        )
    private val DEFAULT_TINT_FALLBACK_COLOR = android.graphics.Color.parseColor("#7A7A7A")
    private val DEFAULT_NEUTRAL_BEAR_COLOR = android.graphics.Color.parseColor("#F2F2EE")
  }
}
