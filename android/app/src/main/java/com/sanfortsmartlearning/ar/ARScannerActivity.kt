package com.sanfortsmartlearning.ar

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
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import android.widget.HorizontalScrollView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import android.app.Dialog
import android.view.Gravity
import android.view.WindowManager
import com.sanfortsmartlearning.R
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
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
  private var lastSingleFingerX: Float = 0f
  private var lastSingleFingerY: Float = 0f
  private var isSingleFingerRotating = false

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
  private var lastBuiltTexture: Texture? = null  // cached for instant toggle restore
  private val materialTextureBindingCache = WeakHashMap<Material, Int>()
  private val materialPbrInitialized = Collections.newSetFromMap(WeakHashMap<Material, Boolean>())
  private var lastSampledPageQuad: List<Pair<Float, Float>>? = null
  private var lastSampledPageQuadTimeMs: Long = 0L
  private var stablePageQuadStreak: Int = 0
  private var hasDetectedUserColoring = false
  private val resizedSubjectMaskBySize = mutableMapOf<Int, BooleanArray>()
  private val resizedReferencePixelsBySize = mutableMapOf<Int, IntArray>()
  private val fullPageSubjectMaskBySize = mutableMapOf<Int, BooleanArray>()
  private val fullPageReferencePixelsBySize = mutableMapOf<Int, IntArray>()
  private var referenceSubjectMaskTemplate: SubjectMaskTemplate? = null
  private var requestedReferenceImageAsset: String = ARImageTrackingFragment.DEFAULT_REFERENCE_ASSET
  private var requestedModelAsset: String = DEFAULT_MODEL_ASSET
  private var referenceImageFilePath: String? = null
  private lateinit var performanceProfile: PerformanceProfile
  private val pendingColorConsensusBySize = mutableMapOf<Int, IntArray>()

  private val trackedNodes = mutableMapOf<Int, TrackedImageNode>()
  private var lastTrackingActiveTimeMs: Long = 0L
  private var modelEverCreated = false

  // ── Phase 1: UI Controls ──
  private lateinit var btnBack: ImageButton
  private lateinit var btnClose: ImageButton
  private lateinit var btnMenu: ImageButton
  private lateinit var btnAudio: ImageButton
  private lateinit var audioLabel: TextView
  private lateinit var modelNameText: TextView
  private lateinit var liveColoringLabel: TextView
  private lateinit var liveColoringStatus: TextView
  private lateinit var liveColoringContainer: LinearLayout
  private lateinit var toggleColoursContainer: LinearLayout
  private lateinit var toggleModeLabel: TextView
  private lateinit var switchToggleColours: Switch
  private lateinit var loadingOverlay: View
  private lateinit var loadingText: TextView
  private var isLiveColoringEnabled = true
  private var showOriginalColors = false
  private var modelName: String? = null

  // ── Phase 2: Audio ──
  private var mediaPlayer: MediaPlayer? = null
  private var isAudioPlaying = false
  private var allAudios: List<ScannerAudioEntry> = emptyList()
  private var selectedLanguage: String = "English (India)"
  private var selectedLevel: String = "Basic"

  // ── Performance: Background Threading + Object Pooling ──
  private val samplingScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
  private var isSamplingInFlight = false
  private val bitmapPool = mutableMapOf<Long, Bitmap>()
  private val intArrayPool = mutableMapOf<Int, IntArray>()
  private val intArrayPoolSecondary = mutableMapOf<Int, IntArray>()
  private var postProcessingApplied = false

  // ── GPU Texture Processing (Phase 3: replaces CPU bitmap pipeline) ──
  private var gpuTextureProcessor: GpuTextureProcessor? = null
  private var gpuProcessorInitialized = false
  private var gpuMaskUploaded = false
  private var gpuReferenceUploaded = false
  private var cameraTextureId: Int = -1
  private var lastCpuParitySampleTimeMs = 0L
  private var lastCpuParityApplyTimeMs = 0L
  private var lastAcceptedTextureSource: String? = null

  // ── Phase 4: Quality Hardening — white balance & lighting normalization ──
  private var whiteBalanceGainR = 1.0f
  private var whiteBalanceGainG = 1.0f
  private var whiteBalanceGainB = 1.0f
  private var lastWhiteBalanceUpdateMs = 0L
  private val whiteBalanceSampleR = FloatArray(WHITE_BALANCE_SAMPLE_COUNT)
  private val whiteBalanceSampleG = FloatArray(WHITE_BALANCE_SAMPLE_COUNT)
  private val whiteBalanceSampleB = FloatArray(WHITE_BALANCE_SAMPLE_COUNT)
  private var whiteBalanceSampleIndex = 0
  private var whiteBalanceSamplesCollected = 0

  // ── Phase 5: Production Telemetry ──
  private var telemetryGpuFrameCount = 0L
  private var telemetryCpuFrameCount = 0L
  private var telemetryDroppedFrameCount = 0L
  private var telemetryTotalFrameTimeMs = 0L
  private var telemetryMaxFrameTimeMs = 0L
  private var telemetryLastReportMs = 0L
  private var consecutiveGlErrors = 0

  // ── Phase 6: Non-AR Fallback Mode (model on solid background when tracking lost) ──
  // Uses a large blue plane in the AR scene to cover the camera feed,
  // with the 3D model positioned in front of it. Single SurfaceView, no conflicts.
  private var isInFallbackMode = false
  private var fallbackBgNode: Node? = null
  private var fallbackModelNode: Node? = null
  private var fallbackRotationAnimator: ValueAnimator? = null
  private var fallbackRotationDegrees: Float = 0f
  private var fallbackUserYaw: Float = 0f       // user drag rotation (Y axis)
  private var fallbackUserPitch: Float = 0f     // user drag rotation (X axis)
  private var fallbackUserScale: Float = 1f     // pinch-to-zoom multiplier
  private var fallbackLastTouchX: Float = 0f
  private var fallbackLastTouchY: Float = 0f
  private var fallbackIsDragging: Boolean = false
  // Fixed camera snapshot — locks position so model doesn't jitter
  private var fallbackCameraPos: Vector3? = null
  private var fallbackCameraForward: Vector3? = null
  private var fallbackCameraRotation: Quaternion? = null

  private val onUpdateListener = Scene.OnUpdateListener {
    onARFrameUpdate()
  }

  private val onPeekTouchListener = Scene.OnPeekTouchListener { _, motionEvent ->
    handleGestureTouch(motionEvent)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_ar_scanner)

    // ── Bind all views ──
    instructionText = findViewById(R.id.instructionText)
    btnBack = findViewById(R.id.btnBack)
    btnClose = findViewById(R.id.btnClose)
    btnMenu = findViewById(R.id.btnMenu)
    btnAudio = findViewById(R.id.btnAudio)
    audioLabel = findViewById(R.id.audioLabel)
    modelNameText = findViewById(R.id.modelNameText)
    liveColoringLabel = findViewById(R.id.liveColoringLabel)
    liveColoringStatus = findViewById(R.id.liveColoringStatus)
    liveColoringContainer = findViewById(R.id.liveColoringContainer)
    toggleColoursContainer = findViewById(R.id.toggleColoursContainer)
    toggleModeLabel = findViewById(R.id.toggleModeLabel)
    switchToggleColours = findViewById(R.id.switchToggleColours)
    loadingOverlay = findViewById(R.id.loadingOverlay)
    loadingText = findViewById(R.id.loadingText)

    // ── Setup UI buttons ──
    setupUIControls()

    if (!isARCoreSupported()) {
      finish()
      return
    }
    performanceProfile = detectPerformanceProfile()

    // Support both file paths (dynamic/downloaded) and asset names (bundled)
    val modelFilePath = intent.getStringExtra(EXTRA_MODEL_FILE_PATH)
    referenceImageFilePath = intent.getStringExtra(EXTRA_REFERENCE_IMAGE_FILE_PATH)

    requestedReferenceImageAsset =
        intent.getStringExtra(EXTRA_REFERENCE_IMAGE_ASSET)
            ?: ARImageTrackingFragment.DEFAULT_REFERENCE_ASSET
    requestedModelAsset = intent.getStringExtra(EXTRA_MODEL_ASSET) ?: DEFAULT_MODEL_ASSET

    // Model name from intent
    modelName = intent.getStringExtra("modelName")
    if (!modelName.isNullOrBlank()) {
      modelNameText.text = modelName
      modelNameText.visibility = View.VISIBLE
    }

    // Parse audio data from intent
    parseAudioData()

    setupGestureDetectors()
    prepareTintMaterialTemplate()

    // Determine reference image source: file path takes priority over asset name
    val referenceImageSource = referenceImageFilePath ?: requestedReferenceImageAsset

    val existingFragment = supportFragmentManager.findFragmentByTag(AR_FRAGMENT_TAG)
    arFragment = if (existingFragment is ARImageTrackingFragment) {
      existingFragment
    } else {
      runCatching {
            ARImageTrackingFragment().also { fragment ->
              fragment.setTrackingArguments(referenceImageSource)
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
    arFragment.setTrackingArguments(referenceImageSource)

    android.util.Log.i(
        "ARScannerActivity",
        "Performance profile tier=${performanceProfile.tier} " +
            "textureSample=${performanceProfile.textureSampleSizePx} " +
            "textureInterval=${performanceProfile.textureRefreshIntervalMs}ms " +
            "colorInterval=${performanceProfile.colorRefreshIntervalMs}ms",
    )

    showLoading("Getting your 3D friend ready...")

    // Load model: file path takes priority over asset name
    if (modelFilePath != null) {
      loadRenderableFromFile(modelFilePath)
    } else {
      loadRenderable(requestedModelAsset)
    }
    window.decorView.post { attachSceneUpdateListenerIfReady() }
  }

  override fun onResume() {
    super.onResume()
    window.decorView.post { attachSceneUpdateListenerIfReady() }
  }

  override fun onPause() {
    super.onPause()
    // Stop audio when app goes to background
    if (isAudioPlaying) {
      mediaPlayer?.pause()
      isAudioPlaying = false
      runCatching { audioLabel.text = "Let's Spell" }
    }
  }

  override fun onDestroy() {
    // Cleanup fallback mode resources
    cleanupFallbackScene()
    isInFallbackMode = false

    gpuTextureProcessor?.release()
    gpuTextureProcessor = null
    gpuProcessorInitialized = false
    samplingScope.cancel()
    bitmapPool.clear()
    intArrayPool.clear()
    intArrayPoolSecondary.clear()
    mediaPlayer?.release()
    mediaPlayer = null
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

  // ══════════════════════════════════════════════════════════════════
  //  Phase 1: UI Controls Setup
  // ══════════════════════════════════════════════════════════════════

  private fun setupUIControls() {
    val density = resources.displayMetrics.density

    // ── Top gradient overlay for readability ──
    val topGradient = findViewById<View>(R.id.topGradient)
    topGradient.background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.parseColor("#CC000000"), Color.parseColor("#00000000"))
    )

    // ── Back button — compact round gradient ──
    btnBack.background = createGradientCircleDrawable("#FF6B6B", "#EE5A24")
    btnBack.elevation = 6f * density
    btnBack.setOnClickListener { finish() }

    // ── Close button — compact round gradient ──
    btnClose.background = createGradientCircleDrawable("#A55EEA", "#8854D0")
    btnClose.elevation = 6f * density
    btnClose.setOnClickListener { finish() }

    // ── Menu button — hidden ──
    btnMenu.visibility = View.GONE

    // ── Model name badge — compact gradient pill ──
    modelNameText.background = createGradientPillDrawable("#6C5CE7", "#A55EEA", 16f)
    modelNameText.elevation = 6f * density
    modelNameText.setShadowLayer(4f, 0f, 2f, Color.parseColor("#40000000"))

    // ── Live coloring status badge — compact glass pill ──
    liveColoringContainer.background = createGradientPillDrawable("#2D3436", "#636E72", 12f)
    liveColoringContainer.elevation = 4f * density
    val liveColoringDot = findViewById<View>(R.id.liveColoringDot)
    val dotDrawable = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.parseColor("#00E676"))
    }
    liveColoringDot.background = dotDrawable

    // ── Bottom panel — compact frosted glass gradient ──
    val bottomPanelBg = findViewById<View>(R.id.bottomPanelBg)
    bottomPanelBg.background = GradientDrawable(
        GradientDrawable.Orientation.BOTTOM_TOP,
        intArrayOf(Color.parseColor("#E6111111"), Color.parseColor("#CC1A1A2E"))
    ).apply { cornerRadii = floatArrayOf(16f * density, 16f * density, 16f * density, 16f * density, 0f, 0f, 0f, 0f) }

    // ── Audio button container — compact gradient card ──
    val audioContainer = findViewById<LinearLayout>(R.id.audioButtonContainer)
    audioContainer.background = createGradientPillDrawable("#00B894", "#00CEC9", 12f)
    audioContainer.elevation = 4f * density

    // ── Audio icon — compact colorful circle ──
    btnAudio.background = createGradientCircleDrawable("#FFEAA7", "#FDCB6E")
    audioContainer.setOnClickListener { showAudioSettingsSheet() }

    // ── Toggle container — compact gradient card ──
    toggleColoursContainer.elevation = 4f * density

    // ── Toggle switch styling ──
    switchToggleColours.thumbTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#00E5FF"))
    switchToggleColours.trackTintList = android.content.res.ColorStateList(
        arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
        intArrayOf(Color.parseColor("#8000E5FF"), Color.parseColor("#4DFFFFFF"))
    )
    switchToggleColours.setOnCheckedChangeListener { _, isChecked ->
      setLiveColoringEnabled(isChecked)
    }

    // Sync UI with initial state
    showOriginalColors = !isLiveColoringEnabled
    updateLiveColoringToggleUi(isLiveColoringEnabled)

    // ── Draw crisp vector icons ──
    drawBackArrowIcon(btnBack)
    drawCloseIcon(btnClose)
    drawMusicIcon(btnAudio)

    // ── Instruction text warm styling ──
    instructionText.setShadowLayer(4f, 0f, 2f, Color.parseColor("#60000000"))
  }

  /** Gradient circle drawable for round buttons */
  private fun createGradientCircleDrawable(colorStart: String, colorEnd: String): GradientDrawable {
    return GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor(colorStart), Color.parseColor(colorEnd))
    ).apply {
      shape = GradientDrawable.OVAL
      setStroke((1.5f * resources.displayMetrics.density).toInt(), Color.parseColor("#30FFFFFF"))
    }
  }

  /** Gradient pill drawable for rounded cards */
  private fun createGradientPillDrawable(colorStart: String, colorEnd: String, radiusDp: Float): GradientDrawable {
    val radiusPx = radiusDp * resources.displayMetrics.density
    return GradientDrawable(
        GradientDrawable.Orientation.LEFT_RIGHT,
        intArrayOf(Color.parseColor(colorStart), Color.parseColor(colorEnd))
    ).apply {
      cornerRadius = radiusPx
      setStroke((1f * resources.displayMetrics.density).toInt(), Color.parseColor("#20FFFFFF"))
    }
  }

  private fun setLiveColoringEnabled(enabled: Boolean) {
    if (isLiveColoringEnabled == enabled) {
      // Still keep UI in sync
      updateLiveColoringToggleUi(enabled)
      return
    }

    isLiveColoringEnabled = enabled
    showOriginalColors = !enabled
    // Increment generation so any in-flight async texture builds are discarded on arrival
    textureResetGeneration++
    textureMaterialBuildInFlight = false
    isSamplingInFlight = false
    if (!enabled) {
      hasDetectedUserColoring = false
    }
    updateLiveColoringToggleUi(enabled)

    // ── INSTANT TOGGLE: synchronous, no async calls, bulletproof ──
    trackedNodes.values.forEach { trackedNode ->
      trackedNode.modelNode.isEnabled = true
      if (!enabled) {
        // OFF → force true original look from per-node snapshots captured at first placement.
        restoreOriginalMaterials(trackedNode)
        val hasOriginalSnapshot =
            trackedNode.originalMaterials.isNotEmpty() ||
                trackedNode.originalSubmeshMaterials.isNotEmpty() ||
                trackedNode.originalRenderableMaterial != null

        // Safety fallback for devices/assets where snapshots were unavailable.
        if (!hasOriginalSnapshot) {
          val freshRenderable = sharedRenderable?.makeCopy()
          if (freshRenderable != null) {
            trackedNode.modelNode.renderable = freshRenderable
            trackedNode.renderable = freshRenderable
            trackedNode.renderableInstance = trackedNode.modelNode.renderableInstance
            trackedNode.originalMaterials = captureOriginalMaterials(trackedNode.renderableInstance)
            trackedNode.originalSubmeshMaterials = captureRenderableMaterials(freshRenderable)
            trackedNode.originalRenderableMaterial =
                runCatching { freshRenderable.material.makeCopy() }.getOrNull()
          }
        } else {
          trackedNode.renderableInstance = trackedNode.modelNode.renderableInstance
        }
        trackedNode.usesTintMaterial = false
        trackedNode.tintApplied = false
        trackedNode.lastSolidTintColor = null
        hasAppliedPageTexture = false
      } else {
        // ON → apply cached texture instantly + replay celebration
        val cachedTexture = lastBuiltTexture
        val cachedBitmap = lastAcceptedTextureBitmap
        var applied = false

        if (cachedTexture != null) {
          // Strategy 1: Try all texture binding methods on every material slot directly
          val ri = trackedNode.modelNode.renderableInstance
          val matCount = ri?.materialsCount ?: 0
          for (i in 0 until matCount) {
            val mat = runCatching { ri?.getMaterial(i) }.getOrNull() ?: continue
            // Try every known binding — at least one will stick
            runCatching { mat.setTexture(MaterialFactory.MATERIAL_TEXTURE, cachedTexture) }
            runCatching { mat.setBaseColorTexture(cachedTexture) }
            runCatching { mat.setTexture("baseColorMap", cachedTexture) }
            runCatching { mat.setFloat4(MaterialFactory.MATERIAL_COLOR, 1f, 1f, 1f, 1f) }
            runCatching { mat.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
            runCatching { mat.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.85f) }
            applied = true
          }
          val subCount = trackedNode.renderable.submeshCount
          for (i in 0 until subCount) {
            val mat = runCatching { trackedNode.renderable.getMaterial(i) }.getOrNull() ?: continue
            runCatching { mat.setTexture(MaterialFactory.MATERIAL_TEXTURE, cachedTexture) }
            runCatching { mat.setBaseColorTexture(cachedTexture) }
            runCatching { mat.setTexture("baseColorMap", cachedTexture) }
            runCatching { mat.setFloat4(MaterialFactory.MATERIAL_COLOR, 1f, 1f, 1f, 1f) }
            runCatching { mat.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
            runCatching { mat.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.85f) }
            applied = true
          }
        }

        if (applied) {
          trackedNode.usesTintMaterial = true
          trackedNode.tintApplied = true
          trackedNode.lastSolidTintColor = null
          hasAppliedPageTexture = true
          lastTextureApplyTimeMs = SystemClock.elapsedRealtime()
        } else if (cachedBitmap != null && !cachedBitmap.isRecycled) {
          // Build texture from cached bitmap (async but fast)
          val stats = computeTextureStats(cachedBitmap)
          applyPageTextureToTrackedNodes(cachedBitmap, stats.signature, stats, "toggle-restore")
        } else {
          // Truly nothing cached — let live pipeline pick it up
          hasAppliedPageTexture = false
          lastTextureApplyTimeMs = 0L
          trackedNode.usesTintMaterial = false
          trackedNode.tintApplied = false
        }

        // Replay magic celebration on toggle ON (kids love it!)
        spawnMagicCelebration(trackedNode.anchorNode, trackedNode.baseScale)
        hapticFeedback("medium")
      }

      // Keep skeletal animation alive after every mode switch.
      restartTrackedNodeAnimation(trackedNode)
    }
  }

  private fun updateLiveColoringToggleUi(enabled: Boolean) {
    if (switchToggleColours.isChecked != enabled) {
      switchToggleColours.isChecked = enabled
    }
    switchToggleColours.jumpDrawablesToCurrentState()

    liveColoringLabel.text = "Look"
    liveColoringStatus.text = if (enabled) "Color" else "Real"
    liveColoringStatus.setTextColor(
        if (enabled) Color.parseColor("#00E676") else Color.parseColor("#FF5252")
    )

    // Button shows the action users can take next.
    toggleModeLabel.text = if (enabled) "Real Look" else "Color Fun"
    toggleModeLabel.contentDescription =
        if (enabled) "Switch to real look" else "Switch to color mode"
    toggleColoursContainer.background =
        if (enabled) {
          createGradientPillDrawable("#00B894", "#00CEC9", 12f)
        } else {
          createGradientPillDrawable("#6C5CE7", "#A55EEA", 12f)
        }

    // Update the glowing dot color
    val dotBg = findViewById<View>(R.id.liveColoringDot)?.background
    if (dotBg is GradientDrawable) {
      dotBg.setColor(if (enabled) Color.parseColor("#00E676") else Color.parseColor("#FF5252"))
    }
  }

  private fun restartTrackedNodeAnimation(trackedNode: TrackedImageNode) {
    if (!ENABLE_MODEL_ANIMATION) {
      return
    }
    // Renderable/material swaps can invalidate animator target instance.
    trackedNode.animator?.cancel()
    trackedNode.animator = null
    trackedNode.animationPaused = false
    trackedNode.renderableInstance =
        trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance
    ensureTrackedNodeAnimation(trackedNode)
  }

  private fun createCircleButtonDrawable(colorString: String): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.parseColor(colorString))
      setStroke(2, Color.parseColor("#40FFFFFF"))
    }
  }

  private fun createPillButtonDrawable(colorString: String): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.parseColor(colorString))
      setStroke(1, Color.parseColor("#30FFFFFF"))
      cornerRadius = 100f
    }
  }

  private fun createRoundedRectDrawable(colorString: String, radiusDp: Float): GradientDrawable {
    val radiusPx = radiusDp * resources.displayMetrics.density
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      setColor(Color.parseColor(colorString))
      cornerRadius = radiusPx
    }
  }

  private fun drawTextOnButton(button: ImageButton, text: String, fontSize: Float = 28f) {
    val size = 44
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint().apply {
      color = Color.WHITE
      textSize = fontSize
      isAntiAlias = true
      textAlign = android.graphics.Paint.Align.CENTER
      setShadowLayer(3f, 0f, 1f, Color.parseColor("#60000000"))
    }
    val yPos = (canvas.height / 2f) - ((paint.descent() + paint.ascent()) / 2f)
    canvas.drawText(text, canvas.width / 2f, yPos, paint)
    button.setImageBitmap(bitmap)
    button.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
  }

  /** Draw a bold back arrow icon with shadow for depth */
  private fun drawBackArrowIcon(button: ImageButton) {
    val sizePx = (32 * resources.displayMetrics.density).toInt()
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint().apply {
      color = Color.WHITE
      isAntiAlias = true
      style = android.graphics.Paint.Style.STROKE
      strokeWidth = sizePx * 0.09f
      strokeCap = android.graphics.Paint.Cap.ROUND
      strokeJoin = android.graphics.Paint.Join.ROUND
      setShadowLayer(sizePx * 0.04f, 0f, sizePx * 0.02f, Color.parseColor("#40000000"))
    }
    val cx = sizePx / 2f
    val cy = sizePx / 2f
    val arrowSize = sizePx * 0.20f
    val path = android.graphics.Path().apply {
      moveTo(cx + arrowSize * 0.25f, cy - arrowSize)
      lineTo(cx - arrowSize * 0.55f, cy)
      lineTo(cx + arrowSize * 0.25f, cy + arrowSize)
    }
    canvas.drawPath(path, paint)
    button.setImageBitmap(bitmap)
    button.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
  }

  /** Draw a bold close (X) icon with shadow */
  private fun drawCloseIcon(button: ImageButton) {
    val sizePx = (32 * resources.displayMetrics.density).toInt()
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint().apply {
      color = Color.WHITE
      isAntiAlias = true
      style = android.graphics.Paint.Style.STROKE
      strokeWidth = sizePx * 0.08f
      strokeCap = android.graphics.Paint.Cap.ROUND
      setShadowLayer(sizePx * 0.04f, 0f, sizePx * 0.02f, Color.parseColor("#40000000"))
    }
    val cx = sizePx / 2f
    val cy = sizePx / 2f
    val arm = sizePx * 0.17f
    canvas.drawLine(cx - arm, cy - arm, cx + arm, cy + arm, paint)
    canvas.drawLine(cx + arm, cy - arm, cx - arm, cy + arm, paint)
    button.setImageBitmap(bitmap)
    button.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
  }

  /** Draw a colorful music note icon with depth */
  private fun drawMusicIcon(button: ImageButton) {
    val sizePx = (22 * resources.displayMetrics.density).toInt()
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = android.graphics.Canvas(bitmap)
    val paint = android.graphics.Paint().apply {
      color = Color.parseColor("#2D3436")
      isAntiAlias = true
      style = android.graphics.Paint.Style.FILL
      setShadowLayer(sizePx * 0.03f, 0f, sizePx * 0.015f, Color.parseColor("#40000000"))
    }
    val cx = sizePx / 2f
    val cy = sizePx / 2f
    val unit = sizePx * 0.065f

    // Note head (oval) — dark on yellow background
    val ovalRect = android.graphics.RectF(
        cx - unit * 2.2f, cy + unit * 1.0f,
        cx + unit * 0.3f, cy + unit * 3.3f,
    )
    canvas.save()
    canvas.rotate(-20f, ovalRect.centerX(), ovalRect.centerY())
    canvas.drawOval(ovalRect, paint)
    canvas.restore()

    // Stem
    val stemPaint = android.graphics.Paint(paint).apply {
      style = android.graphics.Paint.Style.STROKE
      strokeWidth = unit * 0.9f
      strokeCap = android.graphics.Paint.Cap.ROUND
    }
    canvas.drawLine(cx + unit * 0.2f, cy + unit * 1.5f, cx + unit * 0.2f, cy - unit * 3.5f, stemPaint)

    // Flag — curved
    val flagPaint = android.graphics.Paint(paint).apply {
      style = android.graphics.Paint.Style.FILL
    }
    val flagPath = android.graphics.Path().apply {
      moveTo(cx + unit * 0.2f, cy - unit * 3.5f)
      quadTo(cx + unit * 3.2f, cy - unit * 2.5f, cx + unit * 1.8f, cy - unit * 0.5f)
      lineTo(cx + unit * 1.0f, cy - unit * 0.8f)
      quadTo(cx + unit * 2.5f, cy - unit * 2.2f, cx + unit * 0.2f, cy - unit * 2.8f)
      close()
    }
    canvas.drawPath(flagPath, flagPaint)

    button.setImageBitmap(bitmap)
    button.scaleType = android.widget.ImageView.ScaleType.CENTER_INSIDE
  }

  private fun restoreAllOriginalMaterials() {
    trackedNodes.values.forEach { node ->
      // Apply originals directly (no makeCopy — faster, instant)
      val renderableInstance = node.renderableInstance ?: node.modelNode.renderableInstance
      val instanceOriginals = node.originalMaterials
      if (renderableInstance != null && instanceOriginals.isNotEmpty()) {
        val applyCount = min(renderableInstance.materialsCount, instanceOriginals.size)
        for (i in 0 until applyCount) {
          runCatching { renderableInstance.setMaterial(i, instanceOriginals[i]) }
        }
      }

      val submeshOriginals = node.originalSubmeshMaterials
      val submeshCount = node.renderable.submeshCount
      if (submeshOriginals.isNotEmpty() && submeshCount > 0) {
        val applyCount = min(submeshCount, submeshOriginals.size)
        for (i in 0 until applyCount) {
          runCatching { node.renderable.setMaterial(i, submeshOriginals[i]) }
        }
      }

      node.originalRenderableMaterial?.let { originalMaterial ->
        runCatching { node.renderable.material = originalMaterial }
        runCatching { node.modelNode.renderable = node.renderable }
      }

      node.usesTintMaterial = false
      node.tintApplied = false
    }
  }

  private fun showLoading(text: String) {
    loadingOverlay.visibility = View.VISIBLE
    loadingText.text = text
  }

  private fun hideLoading() {
    loadingOverlay.visibility = View.GONE
  }

  // ══════════════════════════════════════════════════════════════════
  //  Phase 2: Audio System
  // ══════════════════════════════════════════════════════════════════

  private fun parseAudioData() {
    intent.getStringExtra("audiosJson")?.let { json ->
      runCatching {
        val arr = JSONArray(json)
        allAudios = (0 until arr.length()).map { i ->
          val o = arr.getJSONObject(i)
          ScannerAudioEntry(
              language = o.optString("language", ""),
              level = o.optString("level", ""),
              audioName = o.optString("audioName", modelName ?: ""),
              audioUrl = o.optString("audioUrl", ""),
          )
        }
      }.onFailure {
        android.util.Log.w("ARScannerActivity", "Failed to parse audios JSON", it)
      }
    }
    // Hide audio button if no audios available
    if (allAudios.isEmpty()) {
      findViewById<LinearLayout>(R.id.audioButtonContainer).visibility = View.GONE
    }
  }

  private fun toggleAudio() {
    if (isAudioPlaying) {
      mediaPlayer?.pause()
      isAudioPlaying = false
      audioLabel.text = "Let's Spell"
    } else {
      playCurrentAudio()
    }
  }

  private fun playCurrentAudio() {
    val entry = allAudios.firstOrNull {
      it.language.equals(selectedLanguage, ignoreCase = true) &&
          it.level.equals(selectedLevel, ignoreCase = true)
    } ?: allAudios.firstOrNull() ?: return

    if (entry.audioUrl.isBlank()) return

    mediaPlayer?.release()
    mediaPlayer = null

    runCatching {
      mediaPlayer = MediaPlayer().apply {
        setDataSource(entry.audioUrl)
        prepareAsync()
        setOnPreparedListener {
          it.start()
          isAudioPlaying = true
          audioLabel.text = "Playing..."
        }
        setOnCompletionListener {
          isAudioPlaying = false
          audioLabel.text = "Let's Spell"
        }
        setOnErrorListener { _, _, _ ->
          isAudioPlaying = false
          audioLabel.text = "Let's Spell"
          true
        }
      }
    }.onFailure {
      android.util.Log.w("ARScannerActivity", "Audio playback failed", it)
    }
  }

  // ── Audio Settings Bottom Sheet ──
  private fun showAudioSettingsSheet() {
    if (allAudios.isEmpty()) {
      Toast.makeText(this, "No audio available", Toast.LENGTH_SHORT).show()
      return
    }

    val density = resources.displayMetrics.density
    val dp = { v: Float -> (v * density).toInt() }

    val dialog = Dialog(this, android.R.style.Theme_Translucent_NoTitleBar)
    dialog.window?.apply {
      setDimAmount(0.4f)
      setGravity(Gravity.BOTTOM)
      setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT)
      addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
      attributes.windowAnimations = android.R.style.Animation_InputMethod
    }

    // ── Root container ──
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.parseColor("#1A1A2E"))
      setPadding(dp(24f), dp(12f), dp(24f), dp(28f))
    }
    // Round top corners
    val rootBg = GradientDrawable().apply {
      setColor(Color.parseColor("#1A1A2E"))
      cornerRadii = floatArrayOf(dp(24f).toFloat(), dp(24f).toFloat(), dp(24f).toFloat(), dp(24f).toFloat(), 0f, 0f, 0f, 0f)
    }
    root.background = rootBg

    // ── Handle bar ──
    val handle = View(this).apply {
      val handleBg = GradientDrawable().apply {
        setColor(Color.parseColor("#44FFFFFF"))
        cornerRadius = dp(3f).toFloat()
      }
      background = handleBg
    }
    val handleParams = LinearLayout.LayoutParams(dp(48f), dp(5f)).apply {
      gravity = android.view.Gravity.CENTER_HORIZONTAL
      bottomMargin = dp(16f)
    }
    root.addView(handle, handleParams)

    // ── Title row with close button ──
    val titleRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = android.view.Gravity.CENTER_VERTICAL
    }
    val title = TextView(this).apply {
      text = "Audio Settings"
      setTextColor(Color.WHITE)
      textSize = 20f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
    }
    titleRow.addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

    val closeBtn = TextView(this).apply {
      text = "\u2715"
      setTextColor(Color.WHITE)
      textSize = 18f
      gravity = android.view.Gravity.CENTER
      val closeBg = GradientDrawable().apply {
        setColor(Color.parseColor("#2D2D44"))
        cornerRadius = dp(16f).toFloat()
      }
      background = closeBg
      setPadding(dp(10f), dp(6f), dp(10f), dp(6f))
      setOnClickListener { dialog.dismiss() }
    }
    titleRow.addView(closeBtn, LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ))

    val titleRowParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = dp(20f) }
    root.addView(titleRow, titleRowParams)

    // ── Unique languages ──
    val languages = allAudios.map { it.language }.distinct().sorted()
    if (selectedLanguage.isBlank() || languages.none { it.equals(selectedLanguage, ignoreCase = true) }) {
      selectedLanguage = languages.firstOrNull() ?: ""
    }

    // ── Language label ──
    val langLabel = TextView(this).apply {
      text = "Language"
      setTextColor(Color.parseColor("#B0B0B0"))
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      letterSpacing = 0.06f
    }
    val langLabelParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { bottomMargin = dp(10f) }
    root.addView(langLabel, langLabelParams)

    // ── Language chips scroll ──
    val langScroll = HorizontalScrollView(this).apply {
      isHorizontalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
    }
    val langRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
    }

    // ── Level label + chips (will be rebuilt when language changes) ──
    val levelLabel = TextView(this).apply {
      text = "Level"
      setTextColor(Color.parseColor("#B0B0B0"))
      textSize = 13f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      letterSpacing = 0.06f
    }
    val levelLabelParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(18f); bottomMargin = dp(10f) }

    val levelScroll = HorizontalScrollView(this).apply {
      isHorizontalScrollBarEnabled = false
      overScrollMode = View.OVER_SCROLL_NEVER
    }
    val levelRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
    }
    levelScroll.addView(levelRow)

    // ── Play button ──
    val playBtn = TextView(this).apply {
      text = if (isAudioPlaying) "Stop" else "Play Audio"
      setTextColor(Color.WHITE)
      textSize = 16f
      setTypeface(typeface, android.graphics.Typeface.BOLD)
      gravity = android.view.Gravity.CENTER
      setPadding(0, dp(14f), 0, dp(14f))
      background = GradientDrawable(
          GradientDrawable.Orientation.LEFT_RIGHT,
          intArrayOf(Color.parseColor("#00B894"), Color.parseColor("#00CEC9"))
      ).apply { cornerRadius = dp(16f).toFloat() }
    }

    fun buildLevelChips() {
      levelRow.removeAllViews()
      val levels = allAudios
          .filter { it.language.equals(selectedLanguage, ignoreCase = true) }
          .map { it.level }.distinct().sorted()
      if (selectedLevel.isBlank() || levels.none { it.equals(selectedLevel, ignoreCase = true) }) {
        selectedLevel = levels.firstOrNull() ?: ""
      }
      levels.forEachIndexed { idx, level ->
        val chip = TextView(this).apply {
          text = level.replaceFirstChar { it.uppercase() }
          setTextColor(Color.WHITE)
          textSize = 13f
          setTypeface(typeface, android.graphics.Typeface.BOLD)
          gravity = android.view.Gravity.CENTER
          setPadding(dp(18f), dp(10f), dp(18f), dp(10f))
          val isSelected = level.equals(selectedLevel, ignoreCase = true)
          background = GradientDrawable().apply {
            cornerRadius = dp(12f).toFloat()
            if (isSelected) {
              setColor(Color.parseColor("#E040FB"))
            } else {
              setColor(Color.parseColor("#2D2D44"))
              setStroke(dp(1f), Color.parseColor("#40FFFFFF"))
            }
          }
        }
        val chipParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { if (idx > 0) marginStart = dp(8f) }
        chip.setOnClickListener {
          selectedLevel = level
          buildLevelChips()
        }
        levelRow.addView(chip, chipParams)
      }
    }

    fun buildLanguageChips() {
      langRow.removeAllViews()
      languages.forEachIndexed { idx, lang ->
        val chip = TextView(this).apply {
          text = lang
          setTextColor(Color.WHITE)
          textSize = 13f
          setTypeface(typeface, android.graphics.Typeface.BOLD)
          gravity = android.view.Gravity.CENTER
          setPadding(dp(18f), dp(10f), dp(18f), dp(10f))
          val isSelected = lang.equals(selectedLanguage, ignoreCase = true)
          background = GradientDrawable().apply {
            cornerRadius = dp(12f).toFloat()
            if (isSelected) {
              setColor(Color.parseColor("#6C5CE7"))
            } else {
              setColor(Color.parseColor("#2D2D44"))
              setStroke(dp(1f), Color.parseColor("#40FFFFFF"))
            }
          }
        }
        val chipParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { if (idx > 0) marginStart = dp(8f) }
        chip.setOnClickListener {
          selectedLanguage = lang
          buildLanguageChips()
          buildLevelChips()
        }
        langRow.addView(chip, chipParams)
      }
    }

    buildLanguageChips()
    langScroll.addView(langRow)
    val langScrollParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    )
    root.addView(langScroll, langScrollParams)

    root.addView(levelLabel, levelLabelParams)
    buildLevelChips()
    val levelScrollParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    )
    root.addView(levelScroll, levelScrollParams)

    // ── Play button ──
    val playParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(24f) }
    playBtn.setOnClickListener {
      if (isAudioPlaying) {
        mediaPlayer?.pause()
        isAudioPlaying = false
        audioLabel.text = "Let's Spell"
        playBtn.text = "Play Audio"
      } else {
        playCurrentAudio()
        dialog.dismiss()
      }
    }
    root.addView(playBtn, playParams)

    dialog.setContentView(root)
    dialog.show()
  }

  // ══════════════════════════════════════════════════════════════════
  //  Performance: Object Pooling
  // ══════════════════════════════════════════════════════════════════

  fun getPooledBitmap(w: Int, h: Int): Bitmap {
    val key = (w.toLong() shl 32) or h.toLong()
    val existing = bitmapPool[key]
    if (existing != null && !existing.isRecycled && existing.width == w && existing.height == h) {
      return existing
    }
    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    bitmapPool[key] = bitmap
    return bitmap
  }

  fun getPooledIntArray(size: Int): IntArray {
    return intArrayPool.getOrPut(size) { IntArray(size) }
  }

  fun getSecondaryPooledIntArray(size: Int): IntArray {
    return intArrayPoolSecondary.getOrPut(size) { IntArray(size) }
  }

  // ══════════════════════════════════════════════════════════════════
  //  Post-Processing: Bloom + FXAA + Tone Mapping via Filament
  // ══════════════════════════════════════════════════════════════════

  private fun applyPostProcessing() {
    if (postProcessingApplied) return
    if (!::arFragment.isInitialized) return

    val sceneView = arFragment.arSceneView ?: return
    val renderer = sceneView.renderer ?: return

    runCatching {
      // Access Filament View through reflection for post-processing
      val rendererClass = renderer.javaClass
      val filamentViewField = rendererClass.getDeclaredField("filamentView")
          ?: rendererClass.superclass?.getDeclaredField("filamentView")
      filamentViewField?.isAccessible = true
      val filamentView = filamentViewField?.get(renderer)

      if (filamentView != null) {
        val viewClass = filamentView.javaClass

        // Enable FXAA anti-aliasing
        runCatching {
          val aaEnum = Class.forName("com.google.android.filament.View\$AntiAliasing")
          val fxaaValue = aaEnum.enumConstants?.find { it.toString() == "FXAA" }
          if (fxaaValue != null) {
            val setAA = viewClass.getMethod("setAntiAliasing", aaEnum)
            setAA.invoke(filamentView, fxaaValue)
            android.util.Log.i("ARScannerActivity", "FXAA anti-aliasing enabled")
          }
        }

        // Bloom and MSAA disabled — too GPU-heavy for smooth AR on mid-range devices.
        // FXAA above is lightweight and sufficient for clean edges.

        postProcessingApplied = true
        android.util.Log.i("ARScannerActivity", "Post-processing pipeline applied successfully")
      }
    }.onFailure { error ->
      android.util.Log.w("ARScannerActivity", "Post-processing setup failed (non-critical): ${error.message}")
      postProcessingApplied = true // don't retry
    }
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
    // Apply post-processing (FXAA, Bloom, MSAA) once scene is ready
    applyPostProcessing()
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
              colorRefreshIntervalMs = 80L,    // was 120
              textureRefreshIntervalMs = 120L,  // was 180
              minTextureApplyIntervalMs = 140L, // was 200
              textureSampleSizePx = 224,        // was 192 → sharper colors
          )
      PerformanceTier.MEDIUM ->
          PerformanceProfile(
              tier = tier,
              colorRefreshIntervalMs = 55L,    // was 80
              textureRefreshIntervalMs = 80L,  // was 120
              minTextureApplyIntervalMs = 90L, // was 140
              textureSampleSizePx = 320,       // was 256 → noticeably sharper
          )
      PerformanceTier.HIGH ->
          PerformanceProfile(
              tier = tier,
              colorRefreshIntervalMs = 40L,    // was 60
              textureRefreshIntervalMs = 55L,  // was 80
              minTextureApplyIntervalMs = 65L, // was 100
              textureSampleSizePx = 448,       // was 384 → high quality colors
          )
    }
  }

  private fun colorRefreshIntervalMs(): Long {
    return when (performanceProfile.tier) {
      PerformanceTier.LOW -> 200L    // aggressive throttle for smooth rendering
      PerformanceTier.MEDIUM -> 140L
      PerformanceTier.HIGH -> 100L
    }
  }

  private fun textureRefreshIntervalMs(inPerformanceRelief: Boolean): Long {
    val baseInterval = when (performanceProfile.tier) {
      PerformanceTier.LOW -> 350L    // very conservative — rendering takes priority
      PerformanceTier.MEDIUM -> 220L
      PerformanceTier.HIGH -> 150L
    }
    return if (inPerformanceRelief) {
      (baseInterval * 2L).coerceAtMost(700L)
    } else {
      baseInterval
    }
  }

  private fun minTextureApplyIntervalMs(inPerformanceRelief: Boolean): Long {
    return if (inPerformanceRelief) {
      (performanceProfile.minTextureApplyIntervalMs * 2L).coerceAtMost(400L)
    } else {
      performanceProfile.minTextureApplyIntervalMs
    }
  }

  private fun textureSampleSizePx(inPerformanceRelief: Boolean): Int {
    // Small textures = fast CPU processing. Colors are clean from background rejection, not size.
    // LINEAR_MIPMAP_LINEAR smooths them on the 3D model.
    val baseSize = when (performanceProfile.tier) {
      PerformanceTier.LOW -> 72
      PerformanceTier.MEDIUM -> 88
      PerformanceTier.HIGH -> 104
    }
    return if (inPerformanceRelief) {
      (baseSize * 2 / 3).coerceAtLeast(56)
    } else {
      baseSize
    }
  }

  private fun gpuCpuParityRefreshIntervalMs(inPerformanceRelief: Boolean): Long {
    val baseInterval =
        when (performanceProfile.tier) {
          PerformanceTier.LOW -> 500L    // was 650
          PerformanceTier.MEDIUM -> 350L // was 460
          PerformanceTier.HIGH -> 240L   // was 320
        }
    return if (inPerformanceRelief) {
      (baseInterval * 3L / 2L).coerceAtMost(700L)
    } else {
      baseInterval
    }
  }

  private fun shouldPreferCpuParitySample(nowMs: Long, inPerformanceRelief: Boolean): Boolean {
    if (!ENABLE_GPU_TEXTURE_PIPELINE) return false
    if (!hasDetectedUserColoring && lastAcceptedTextureBitmap == null) return false
    return (nowMs - lastCpuParitySampleTimeMs) >= gpuCpuParityRefreshIntervalMs(inPerformanceRelief)
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
          seedRenderableTint(renderable)
          sharedRenderable = renderable
          instructionText.text = instructionForTrackingState()
          hideLoading()
        }
        .exceptionally { error: Throwable ->
          runOnUiThread {
            loadFallbackRenderable()
            hideLoading()
            instructionText.text =
                "Model load failed. Check $requestedModelAsset format. Tracking status: ${instructionForTrackingState()}"
          }
          android.util.Log.e("ARScannerActivity", "Failed to load model: $requestedModelAsset", error)
          null
        }
  }

  private fun loadRenderableFromFile(filePath: String) {
    instructionText.text = "Loading 3D model..."
    val file = java.io.File(filePath)
    if (!file.exists()) {
      loadFallbackRenderable()
      instructionText.text = "Model file not found: $filePath"
      return
    }

    val fileUri = android.net.Uri.fromFile(file)
    val loadFuture =
        ModelRenderable.builder()
            .setSource(this, fileUri)
            .setIsFilamentGltf(true)
            .setAsyncLoadEnabled(true)
            .setRegistryId("file://$filePath")
            .build()

    loadFuture
        .thenAccept { renderable: ModelRenderable ->
          android.util.Log.i("ARScannerActivity", "Loaded model renderable from file: $filePath")
          seedRenderableTint(renderable)
          sharedRenderable = renderable
          instructionText.text = instructionForTrackingState()
          hideLoading()
        }
        .exceptionally { error: Throwable ->
          runOnUiThread {
            loadFallbackRenderable()
            hideLoading()
            instructionText.text = "Model load failed from file. Tracking status: ${instructionForTrackingState()}"
          }
          android.util.Log.e("ARScannerActivity", "Failed to load model from file: $filePath", error)
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
      "Place the coloring page on a flat surface and point camera at it!"
    } else {
      "Oops! Could not load the coloring page. Please try again."
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

    // ── In fallback mode: reposition model relative to current camera each frame ──
    if (isInFallbackMode) {
      // Track camera each frame so model stays in front of wherever camera is
      val cam = scene.camera
      fallbackCameraPos = Vector3(cam.worldPosition.x, cam.worldPosition.y, cam.worldPosition.z)
      fallbackCameraForward = Vector3(cam.forward.x, cam.forward.y, cam.forward.z)
      fallbackCameraRotation = Quaternion(cam.worldRotation.x, cam.worldRotation.y, cam.worldRotation.z, cam.worldRotation.w)
      updateFallbackPositions()

      frame.getUpdatedTrackables(AugmentedImage::class.java).forEach { image ->
        if (image.trackingState == TrackingState.TRACKING && isImageFullyTracked(image)) {
          lastTrackingActiveTimeMs = now
          exitFallbackMode()
          if (!trackedNodes.containsKey(image.index)) {
            trackedNodes[image.index] = createTrackedNode(image, renderable, scene)
            modelEverCreated = true
          }
          val name = modelName?.takeIf { it.isNotBlank() } ?: "model"
          instructionText.text =
              "Great! Now color your ${name.lowercase()} with crayons and watch it come alive!"
        }
      }
      return
    }

    var anyTracking = false
    frame.getUpdatedTrackables(AugmentedImage::class.java).forEach { image ->
      when (image.trackingState) {
        TrackingState.TRACKING -> {
          // CRITICAL: Check if image is ACTUALLY visible in camera (FULL_TRACKING)
          // vs just remembered position (LAST_KNOWN_POSE).
          // ARCore keeps reporting TRACKING even when camera moves away!
          val isFullyVisible = isImageFullyTracked(image)

          if (isFullyVisible) {
            anyTracking = true
            lastTrackingActiveTimeMs = now

            if (isInFallbackMode) {
              exitFallbackMode()
            }

            // Detect sheet switch
            val existingNode = trackedNodes[image.index]
            if (existingNode != null) {
              val oldPos = existingNode.anchorNode.worldPosition
              val newPos = Vector3(image.centerPose.tx(), image.centerPose.ty(), image.centerPose.tz())
              val dx = newPos.x - oldPos.x
              val dy = newPos.y - oldPos.y
              val dz = newPos.z - oldPos.z
              val jumpDistSq = (dx * dx) + (dy * dy) + (dz * dz)
              if (jumpDistSq > SHEET_SWITCH_DISTANCE_SQ) {
                android.util.Log.i("ARScannerActivity", "Sheet switch detected (dist=${sqrt(jumpDistSq)}m). Recreating node.")
                removeTrackedNode(image.index)
              }
            }

            if (!trackedNodes.containsKey(image.index)) {
              if (trackedNodes.isEmpty()) {
                firstTrackDetectedTimeMs = now
              }
              trackedNodes[image.index] = createTrackedNode(image, renderable, scene)
              modelEverCreated = true
              val name = modelName?.takeIf { it.isNotBlank() } ?: "model"
              instructionText.text =
                  "Great! Now color your ${name.lowercase()} with crayons and watch it come alive!"
            } else {
              val trackedNode = trackedNodes[image.index]
              if (trackedNode != null) {
                smoothUpdateAnchorPose(trackedNode, image)
                if (!trackedNode.modelNode.isEnabled) {
                  val shouldShow = !isLiveColoringEnabled || hasAppliedPageTexture
                  if (shouldShow) {
                    trackedNode.modelNode.isEnabled = true
                  }
                }
                if (trackedNode.animator == null) {
                  ensureTrackedNodeAnimation(trackedNode)
                }
              }
            }
          } else {
            // TRACKING but LAST_KNOWN_POSE — image NOT visible in camera
            // Treat same as PAUSED: after grace period, enter fallback
            val timeSinceLastTracking = now - lastTrackingActiveTimeMs
            if (timeSinceLastTracking > FALLBACK_GRACE_PERIOD_MS && trackedNodes.containsKey(image.index)) {
              android.util.Log.i("ARScannerActivity", "Image LAST_KNOWN_POSE for ${timeSinceLastTracking}ms — entering fallback")
              removeTrackedNode(image.index)
              if (!isInFallbackMode && modelEverCreated) {
                enterFallbackMode()
              }
            } else {
              anyTracking = trackedNodes.containsKey(image.index)
            }
          }
        }

        TrackingState.STOPPED -> {
          val trackedNode = trackedNodes[image.index]
          if (trackedNode != null) {
            val timeSinceLastTracking = now - lastTrackingActiveTimeMs
            if (timeSinceLastTracking > FALLBACK_GRACE_PERIOD_MS) {
              removeTrackedNode(image.index)
              if (!isInFallbackMode && modelEverCreated) {
                enterFallbackMode()
              }
            }
          }
        }
        TrackingState.PAUSED -> {
          val timeSinceLastTracking = now - lastTrackingActiveTimeMs
          if (timeSinceLastTracking > FALLBACK_GRACE_PERIOD_MS && trackedNodes.containsKey(image.index)) {
            removeTrackedNode(image.index)
            if (!isInFallbackMode && modelEverCreated) {
              enterFallbackMode()
            }
          } else {
            anyTracking = trackedNodes.containsKey(image.index)
          }
        }
      }
    }

    // Batch cleanup: nodes exist but none actively tracking
    if (trackedNodes.isNotEmpty() && !anyTracking) {
      val timeSinceLastTracking = now - lastTrackingActiveTimeMs
      if (timeSinceLastTracking > FALLBACK_GRACE_PERIOD_MS && lastTrackingActiveTimeMs > 0L) {
        trackedNodes.keys.toList().forEach { removeTrackedNode(it) }
        if (!isInFallbackMode && modelEverCreated) {
          enterFallbackMode()
        }
      }
    }

    if (trackedNodes.isNotEmpty()) {
      // Phase 5: Frame budget check — skip texture work if already over budget
      if (isOverFrameBudget(frameWorkStartMs)) {
        telemetryDroppedFrameCount++
      } else if (!isSamplingInFlight) {
        val samplingStartMs = SystemClock.elapsedRealtime()
        if (ENABLE_GPU_TEXTURE_PIPELINE) {
          val gpuBitmap = tryGpuSampleTexture(frame, sceneView)
          if (gpuBitmap != null) {
            processSampledTextureAsync(
                sampledBitmap = gpuBitmap,
                sampleStartMs = samplingStartMs,
                source = "gpu",
                isGpuSample = true,
            )
          }
        } else {
          val sampledBitmap = quickSampleTextureBitmap(frame, sceneView)
          if (sampledBitmap != null) {
            processSampledTextureAsync(
                sampledBitmap = sampledBitmap,
                sampleStartMs = samplingStartMs,
                source = "cpu",
                isGpuSample = false,
            )
          } else {
            applyLiveTintFallback(frame, sceneView)
          }
        }
      }
      // Phase 5: Enforce bitmap pool limits to prevent OOM
      enforceBitmapPoolLimit()
    } else if (!isInFallbackMode && (!modelEverCreated || (now - lastTrackingActiveTimeMs) > TRACKING_GRACE_PERIOD_MS)) {
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
      lastBuiltTexture = null
      lastSampledPageQuad = null
      lastSampledPageQuadTimeMs = 0L
      stablePageQuadStreak = 0
      pendingColorConsensusBySize.clear()
      fullPageSubjectMaskBySize.clear()
      fullPageReferencePixelsBySize.clear()
      hasDetectedUserColoring = false
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
    resetLiveColoringStateForNewTarget()
    val anchorNode = AnchorNode(image.createAnchor(image.centerPose)).apply { setParent(scene) }

    val nodeRenderable = renderableSource.makeCopy()
    nodeRenderable.isShadowCaster = true
    nodeRenderable.isShadowReceiver = true

    val targetSizeMeters = max(image.extentX, image.extentZ) * PAGE_FIT_RATIO
    val modelBounds = estimateModelBounds(nodeRenderable)
    val modelUnitSize = modelBounds.horizontalSize
    val baseScale =
        (targetSizeMeters / modelUnitSize).coerceIn(MIN_MODEL_SCALE, MAX_MODEL_SCALE)
    // Model faces the same direction as the printed image on the sheet.
    // The anchor node already inherits the image's world rotation from ARCore,
    // so the model's local yaw just needs the standard offset for the GLB facing direction.
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
    val originalSubmeshMaterials = captureRenderableMaterials(nodeRenderable)
    val originalRenderableMaterial =
        runCatching { nodeRenderable.material.makeCopy() }.getOrNull()
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
        originalSubmeshMaterials = originalSubmeshMaterials,
        originalRenderableMaterial = originalRenderableMaterial,
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
    // Add directional light for realistic shadows (once per scene)
    addDirectionalLight(scene)
    // Add ground shadow plane below model for grounded look
    addGroundShadowPlane(anchorNode, image.extentX, image.extentZ)

    // Keep model visible immediately — show neutral white while page texture loads.
    trackedNode.modelNode.isEnabled = true
    if (isLiveColoringEnabled) {
      // Synchronously attach white material so model never appears black
      val template = liveTintMaterialTemplate
      if (template != null) {
        val whiteMaterial = template.makeCopy()
        applyTintToMaterial(whiteMaterial, 0.95f, 0.95f, 0.93f, 0f)
        attachMaterialToTrackedNode(trackedNode, whiteMaterial)
        trackedNode.tintMaterial = whiteMaterial  // pre-cache for instant toggle
        trackedNode.tintApplied = true
        trackedNode.lastSolidTintColor = android.graphics.Color.rgb(242, 242, 237)
      } else {
        // Fallback async path if template not ready yet
        applySolidTintToTrackedNode(trackedNode, 0.95f, 0.95f, 0.93f, "initial")
      }
    }
    // Pre-build tint material for instant toggle even if coloring is currently OFF
    if (trackedNode.tintMaterial == null) {
      val template = liveTintMaterialTemplate
      if (template != null) {
        trackedNode.tintMaterial = template.makeCopy()
      } else {
        // Build async and cache for later toggle use
        MaterialFactory.makeOpaqueWithColor(this, com.google.ar.sceneform.rendering.Color(1f, 1f, 1f))
            .thenAccept { mat ->
              runCatching { mat.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
              runCatching { mat.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.72f) }
              trackedNode.tintMaterial = mat
            }
      }
    }
    // Start float/animation immediately so model appears alive from the start.
    ensureTrackedNodeAnimation(trackedNode)

    // Boom pop-in animation for child-friendly wow effect
    trackedNode.modelNode.localScale = Vector3(0.01f, 0.01f, 0.01f)
    ValueAnimator.ofFloat(0f, 1f).apply {
      duration = 700L
      interpolator = android.view.animation.OvershootInterpolator(1.6f)
      addUpdateListener { anim ->
        val progress = anim.animatedValue as Float
        val currentScale = baseScale * progress
        trackedNode.modelNode.localScale = Vector3(currentScale, currentScale, currentScale)
      }
      start()
    }
    hapticFeedback("medium")

    // Magic celebration burst — stars + sparkles around model (like the dolphin app!)
    spawnMagicCelebration(anchorNode, baseScale)

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
    val targetRotation = Quaternion(
        image.centerPose.qx(),
        image.centerPose.qy(),
        image.centerPose.qz(),
        image.centerPose.qw(),
    )
    val currentRotation = trackedNode.anchorNode.worldRotation
    val rotationDot = kotlin.math.abs(
        (currentRotation.x * targetRotation.x) +
            (currentRotation.y * targetRotation.y) +
            (currentRotation.z * targetRotation.z) +
            (currentRotation.w * targetRotation.w),
    )
    val rotationDelta = 1f - rotationDot

    // Calculate movement distance — if very small, skip update entirely (micro-jitter)
    val dx = newPosition.x - oldPosition.x
    val dy = newPosition.y - oldPosition.y
    val dz = newPosition.z - oldPosition.z
    val distSq = (dx * dx) + (dy * dy) + (dz * dz)
    val shouldUpdatePosition = distSq >= ANCHOR_JITTER_THRESHOLD_SQ
    val shouldUpdateRotation = rotationDelta >= ANCHOR_ROTATION_JITTER_THRESHOLD
    if (!shouldUpdatePosition && !shouldUpdateRotation) {
      return
    }

    // Lerp between old and new position for smooth movement
    if (shouldUpdatePosition) {
      trackedNode.anchorNode.worldPosition = Vector3(
          oldPosition.x + dx * ANCHOR_SMOOTHING_ALPHA,
          oldPosition.y + dy * ANCHOR_SMOOTHING_ALPHA,
          oldPosition.z + dz * ANCHOR_SMOOTHING_ALPHA,
      )
    }
    if (shouldUpdateRotation) {
      trackedNode.anchorNode.worldRotation =
          Quaternion.slerp(currentRotation, targetRotation, ANCHOR_ROTATION_SMOOTHING_ALPHA)
    }
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

  private var directionalLightAdded = false

  private fun addDirectionalLight(scene: Scene) {
    if (directionalLightAdded) return
    directionalLightAdded = true

    // Sun-like directional light for realistic shadows
    val sunLight =
        Light.builder(Light.Type.DIRECTIONAL)
            .setColor(com.google.ar.sceneform.rendering.Color(1f, 0.96f, 0.92f))
            .setIntensity(DIRECTIONAL_LIGHT_INTENSITY)
            .setShadowCastingEnabled(true)
            .build()

    Node().apply {
      setParent(scene)
      localPosition = Vector3(0f, 2f, -1f)
      localRotation = Quaternion.lookRotation(Vector3(0.15f, -1f, 0.3f), Vector3.up())
      light = sunLight
    }

    // Secondary fill light from opposite side for balanced illumination
    val fillDirLight =
        Light.builder(Light.Type.DIRECTIONAL)
            .setColor(com.google.ar.sceneform.rendering.Color(0.94f, 0.96f, 1f))
            .setIntensity(DIRECTIONAL_LIGHT_INTENSITY * 0.5f)  // was 0.4 → stronger fill
            .setShadowCastingEnabled(false)
            .build()

    Node().apply {
      setParent(scene)
      localPosition = Vector3(0f, 1.5f, 1f)
      localRotation = Quaternion.lookRotation(Vector3(-0.2f, -0.8f, -0.5f), Vector3.up())
      light = fillDirLight
    }
  }

  private fun addGroundShadowPlane(anchorNode: AnchorNode, extentX: Float, extentZ: Float) {
    // Transparent plane below model that receives shadows for grounded look
    MaterialFactory.makeTransparentWithColor(
            this,
            com.google.ar.sceneform.rendering.Color(0f, 0f, 0f, 0f),
        )
        .thenAccept { material ->
          val radius = max(extentX, extentZ) * 0.6f
          val shadowPlane = ShapeFactory.makeCylinder(radius, 0.001f, Vector3.zero(), material)
          shadowPlane.isShadowReceiver = true
          shadowPlane.isShadowCaster = false

          Node().apply {
            setParent(anchorNode)
            localPosition = Vector3(0f, -0.001f, 0f)
            renderable = shadowPlane
          }
        }
  }

  /**
   * Magic celebration: spawn colorful star/sparkle particles around the model.
   * Each particle is a tiny colored sphere that flies outward, floats up, and fades.
   * Lightweight — uses simple shapes, auto-removes after animation completes.
   */
  private fun spawnMagicCelebration(anchorNode: AnchorNode, modelScale: Float) {
    val particleColors = intArrayOf(
        Color.parseColor("#FFD700"), // gold star
        Color.parseColor("#FF69B4"), // pink
        Color.parseColor("#00E5FF"), // cyan
        Color.parseColor("#76FF03"), // lime
        Color.parseColor("#FFD700"), // gold
        Color.parseColor("#FF6D00"), // orange
        Color.parseColor("#E040FB"), // purple
        Color.parseColor("#FFFFFF"), // white sparkle
        Color.parseColor("#FFD700"), // gold
        Color.parseColor("#00E5FF"), // cyan
        Color.parseColor("#FF69B4"), // pink
        Color.parseColor("#FFFFFF"), // white
    )
    val random = java.util.Random()
    val radius = modelScale * 2.5f  // spread radius around model
    val particleSize = modelScale * 0.08f  // tiny spheres

    for (i in particleColors.indices) {
      val colorInt = particleColors[i]
      val delay = (i * 60L)  // stagger particle spawns for cascade effect

      // Random position in a ring around the model
      val angle = (i.toFloat() / particleColors.size) * 2f * Math.PI.toFloat() +
          (random.nextFloat() * 0.5f)
      val startX = kotlin.math.cos(angle.toDouble()).toFloat() * radius * 0.3f
      val startY = modelScale * (0.5f + random.nextFloat() * 1.5f)
      val startZ = kotlin.math.sin(angle.toDouble()).toFloat() * radius * 0.3f
      val endX = kotlin.math.cos(angle.toDouble()).toFloat() * radius
      val endY = startY + modelScale * (1.0f + random.nextFloat() * 1.5f)
      val endZ = kotlin.math.sin(angle.toDouble()).toFloat() * radius

      android.os.Handler(mainLooper).postDelayed({
        if (isFinishing || isDestroyed) return@postDelayed
        MaterialFactory.makeOpaqueWithColor(
            this,
            com.google.ar.sceneform.rendering.Color(colorInt),
        ).thenAccept { material ->
          val size = particleSize * (0.6f + random.nextFloat() * 0.8f)
          val particleRenderable = ShapeFactory.makeSphere(size, Vector3.zero(), material)
          particleRenderable.isShadowCaster = false
          particleRenderable.isShadowReceiver = false

          val particleNode = Node().apply {
            setParent(anchorNode)
            localPosition = Vector3(startX, startY, startZ)
            renderable = particleRenderable
          }

          // Animate: fly outward + float up + scale down (fade)
          ValueAnimator.ofFloat(0f, 1f).apply {
            duration = (800L + random.nextInt(600)).toLong()
            interpolator = android.view.animation.DecelerateInterpolator(1.5f)
            addUpdateListener { anim ->
              val t = anim.animatedValue as Float
              val x = startX + (endX - startX) * t
              val y = startY + (endY - startY) * t
              val z = startZ + (endZ - startZ) * t
              particleNode.localPosition = Vector3(x, y, z)
              // Scale down as it rises (sparkle fading)
              val fadeScale = 1f - (t * t * 0.8f)
              particleNode.localScale = Vector3(fadeScale, fadeScale, fadeScale)
            }
            addListener(object : android.animation.AnimatorListenerAdapter() {
              override fun onAnimationEnd(animation: android.animation.Animator) {
                particleNode.setParent(null)
              }
            })
            start()
          }
        }
      }, delay)
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
      originals += instance.getMaterial(materialIndex).makeCopy()
    }
    return originals
  }

  private fun captureRenderableMaterials(renderable: ModelRenderable): MutableList<Material> {
    val submeshCount = renderable.submeshCount
    if (submeshCount <= 0) {
      return mutableListOf()
    }
    val originals = mutableListOf<Material>()
    for (submeshIndex in 0 until submeshCount) {
      originals += renderable.getMaterial(submeshIndex).makeCopy()
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
    if (trackedNode.originalSubmeshMaterials.isEmpty() && trackedNode.renderable.submeshCount > 0) {
      trackedNode.originalSubmeshMaterials = captureRenderableMaterials(trackedNode.renderable)
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
    val genAtTint = textureResetGeneration
    MaterialFactory.makeOpaqueWithColor(this, com.google.ar.sceneform.rendering.Color(colorInt))
        .thenAccept { generatedMaterial ->
          // Discard if toggle changed during async build
          if (genAtTint != textureResetGeneration || !isLiveColoringEnabled) {
            trackedNode.tintMaterial = generatedMaterial  // cache for future use
            trackedNode.tintBuildInFlight = false
            return@thenAccept
          }
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
    val renderableInstance = trackedNode.modelNode.renderableInstance ?: trackedNode.renderableInstance
    val originals = trackedNode.originalMaterials
    if (renderableInstance != null && originals.isNotEmpty()) {
      val applyCount = min(renderableInstance.materialsCount, originals.size)
      for (materialIndex in 0 until applyCount) {
        renderableInstance.setMaterial(materialIndex, originals[materialIndex].makeCopy())
      }
    }
    val submeshOriginals = trackedNode.originalSubmeshMaterials
    val submeshCount = trackedNode.renderable.submeshCount
    if (submeshOriginals.isNotEmpty() && submeshCount > 0) {
      val applyCount = min(submeshCount, submeshOriginals.size)
      for (materialIndex in 0 until applyCount) {
        trackedNode.renderable.setMaterial(materialIndex, submeshOriginals[materialIndex].makeCopy())
      }
    }
    trackedNode.originalRenderableMaterial?.let { originalMaterial ->
      runCatching { trackedNode.renderable.material = originalMaterial.makeCopy() }
      runCatching { trackedNode.modelNode.renderable = trackedNode.renderable }
    }
    trackedNode.usesTintMaterial = false
    trackedNode.tintApplied = false
  }

  private fun choosePreferredAnimationIndex(renderableInstance: RenderableInstance): Int {
    val count = renderableInstance.animationCount
    if (count <= 0) {
      return 0
    }

    val animations =
        (0 until count).map { index ->
          val animation = runCatching { renderableInstance.getAnimation(index) }.getOrNull()
          val name = animation?.name.orEmpty()
          val duration = runCatching { animation?.duration ?: 0f }.getOrDefault(0f)
          Triple(index, name, duration)
        }

    // 1) Prefer known “alive” animation names.
    for (hint in PREFERRED_ANIMATION_NAME_HINTS) {
      val matched =
          animations.firstOrNull { (_, name, duration) ->
            duration > MIN_ANIMATION_DURATION_SEC && name.contains(hint, ignoreCase = true)
          }
      if (matched != null) {
        return matched.first
      }
    }

    // 2) Fallback to the longest valid clip (helps for models with generic names).
    val longestPlayable =
        animations
            .filter { (_, _, duration) -> duration > MIN_ANIMATION_DURATION_SEC }
            .maxByOrNull { (_, _, duration) -> duration }
    if (longestPlayable != null) {
      return longestPlayable.first
    }

    // 3) Last resort: first animation entry.
    return 0
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

    val preferredIndex = choosePreferredAnimationIndex(renderableInstance)

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
    // Gentle floating bob — visible but smooth. ±1.2cm at baseScale=1.
    val amplitude = (trackedNode.baseScale * 0.012f).coerceIn(0.005f, 0.025f)
    return ValueAnimator.ofFloat(-amplitude, amplitude).apply {
      duration = 3200L  // was 2800 → slower, smoother, dreamy float
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

  // ══════════════════════════════════════════════════════════════════
  //  Phase 6: Non-AR Fallback Mode
  //  Uses a large blue plane INSIDE the existing ArSceneView to cover
  //  the camera feed, with the 3D model positioned in front of it.
  //  Single SurfaceView — no z-ordering conflicts.
  // ══════════════════════════════════════════════════════════════════

  private fun enterFallbackMode() {
    if (isInFallbackMode) return
    val sceneView = arFragment.arSceneView ?: return
    val scene = sceneView.scene ?: return
    val renderable = sharedRenderable ?: return

    isInFallbackMode = true

    // Reset gesture state
    fallbackUserYaw = 0f
    fallbackUserPitch = 0f
    fallbackUserScale = 1f
    fallbackIsDragging = false

    // Snapshot camera — freeze position for stable rendering
    val camera = scene.camera
    fallbackCameraPos = Vector3(camera.worldPosition.x, camera.worldPosition.y, camera.worldPosition.z)
    fallbackCameraForward = Vector3(camera.forward.x, camera.forward.y, camera.forward.z)
    fallbackCameraRotation = Quaternion(camera.worldRotation.x, camera.worldRotation.y, camera.worldRotation.z, camera.worldRotation.w)

    runCatching { sceneView.planeRenderer?.isVisible = false }

    // Hide AR UI
    runOnUiThread {
      liveColoringContainer.visibility = View.GONE
      findViewById<View>(R.id.bottomPanelBg).visibility = View.GONE
      findViewById<LinearLayout>(R.id.bottomPanelContent).visibility = View.GONE
      runCatching {
        arFragment.view?.let { fragView ->
          if (fragView is android.view.ViewGroup) {
            for (i in 0 until fragView.childCount) {
              val child = fragView.getChildAt(i)
              if (child !is com.google.ar.sceneform.ArSceneView) child.visibility = View.GONE
            }
          }
        }
      }
      val name = modelName?.takeIf { it.isNotBlank() } ?: "model"
      instructionText.text = "Point camera at the coloring page to see ${name.lowercase()} in AR!"
      instructionText.visibility = View.VISIBLE
      modelNameText.visibility = if (!modelName.isNullOrBlank()) View.VISIBLE else View.GONE
    }

    // Blue background plane (covers camera feed)
    MaterialFactory.makeOpaqueWithColor(this,
        com.google.ar.sceneform.rendering.Color(Color.parseColor("#1B2559"))
    ).thenAccept { bgMat ->
      if (!isInFallbackMode) return@thenAccept
      val bgRenderable = ShapeFactory.makeCube(Vector3(200f, 200f, 0.001f), Vector3.zero(), bgMat)
      bgRenderable.isShadowCaster = false
      bgRenderable.isShadowReceiver = false
      fallbackBgNode = Node().apply {
        setParent(scene)
        this.renderable = bgRenderable
      }
      updateFallbackPositions()
    }

    // Model with original textures, centered via pivot node
    val nodeRenderable = renderable.makeCopy()
    nodeRenderable.isShadowCaster = false
    nodeRenderable.isShadowReceiver = false
    val modelBounds = estimateModelBounds(nodeRenderable)
    val modelMaxDim = max(modelBounds.horizontalSize, max(modelBounds.sizeY, modelBounds.sizeZ)).coerceAtLeast(0.01f)
    val fitScale = FALLBACK_MODEL_VIEW_SIZE / modelMaxDim

    // Pivot node: model child offset by -center so rotation is around visual center
    fallbackModelNode = Node().apply { setParent(scene) }
    Node().apply {
      setParent(fallbackModelNode)
      this.renderable = nodeRenderable
      localScale = Vector3(fitScale, fitScale, fitScale)
      localPosition = Vector3(
          -modelBounds.centerX * fitScale,
          -modelBounds.centerY * fitScale,
          -modelBounds.centerZ * fitScale,
      )
    }

    updateFallbackPositions()

    // Skeletal animation
    val ri = fallbackModelNode?.children?.firstOrNull()?.renderableInstance
    if (ri != null && ri.animationCount > 0) {
      runCatching {
        val anim = ModelAnimator.ofAnimation(ri, pickBestAnimationIndex(ri))
        anim.interpolator = LinearInterpolator()
        if (anim.duration > 0L) anim.duration = (anim.duration / ANIMATION_PLAYBACK_SPEED).toLong().coerceAtLeast(280L)
        anim.repeatCount = ValueAnimator.INFINITE
        anim.start()
      }
    }
  }

  /** Updates fallback model + bg positions at frozen camera snapshot. */
  private fun updateFallbackPositions() {
    if (!isInFallbackMode) return
    val cameraPos = fallbackCameraPos ?: return
    val forward = fallbackCameraForward ?: return
    val camRotation = fallbackCameraRotation ?: return

    // Background plane behind model
    fallbackBgNode?.let { bg ->
      bg.worldPosition = Vector3(
          cameraPos.x + forward.x * FALLBACK_BG_DISTANCE,
          cameraPos.y + forward.y * FALLBACK_BG_DISTANCE,
          cameraPos.z + forward.z * FALLBACK_BG_DISTANCE,
      )
      bg.worldRotation = camRotation
    }

    // Model: fixed at snapshot position, only user touch rotates it
    fallbackModelNode?.let { model ->
      model.worldPosition = Vector3(
          cameraPos.x + forward.x * FALLBACK_MODEL_DISTANCE,
          cameraPos.y + forward.y * FALLBACK_MODEL_DISTANCE,
          cameraPos.z + forward.z * FALLBACK_MODEL_DISTANCE,
      )
      val yawQ = Quaternion.axisAngle(Vector3.up(), fallbackUserYaw)
      val pitchQ = Quaternion.axisAngle(Vector3.right(), fallbackUserPitch)
      model.worldRotation = Quaternion.multiply(camRotation, Quaternion.multiply(yawQ, pitchQ))
      model.localScale = Vector3(fallbackUserScale, fallbackUserScale, fallbackUserScale)
    }
  }

  /**
   * Check if the image is truly visible to the camera (FULL_TRACKING),
   * as opposed to ARCore just remembering its position (LAST_KNOWN_POSE).
   */
  private fun isImageFullyTracked(image: AugmentedImage): Boolean {
    return runCatching {
      image.trackingMethod == AugmentedImage.TrackingMethod.FULL_TRACKING
    }.getOrDefault(true) // default true for older ARCore versions without trackingMethod
  }

  private fun exitFallbackMode() {
    if (!isInFallbackMode) return
    isInFallbackMode = false
    android.util.Log.i("ARScannerActivity", "Exiting fallback mode (tracking resumed)")

    cleanupFallbackScene()

    // Restore AR plane visualizations
    runCatching { arFragment.arSceneView?.planeRenderer?.isVisible = true }

    // Restore AR UI elements
    runOnUiThread {
      liveColoringContainer.visibility = View.VISIBLE
      findViewById<View>(R.id.bottomPanelBg).visibility = View.VISIBLE
      findViewById<LinearLayout>(R.id.bottomPanelContent).visibility = View.VISIBLE
      // Restore ArFragment's scanning overlay children
      runCatching {
        arFragment.view?.let { fragView ->
          if (fragView is android.view.ViewGroup) {
            for (i in 0 until fragView.childCount) {
              fragView.getChildAt(i).visibility = View.VISIBLE
            }
          }
        }
      }
      val name = modelName?.takeIf { it.isNotBlank() } ?: "model"
      instructionText.text =
          "Great! Now color your ${name.lowercase()} with crayons and watch it come alive!"
    }
  }

  private fun cleanupFallbackScene() {
    fallbackRotationAnimator?.cancel()
    fallbackRotationAnimator = null

    // Cleanup pivot and its child model node
    fallbackModelNode?.let { pivot ->
      pivot.children.toList().forEach { child ->
        child.renderable = null
        child.setParent(null)
      }
      pivot.setParent(null)
    }
    fallbackModelNode = null

    // Cleanup background plane node
    fallbackBgNode?.let {
      it.renderable = null
      it.setParent(null)
    }
    fallbackBgNode = null

    fallbackCameraPos = null
    fallbackCameraForward = null
    fallbackCameraRotation = null
  }

  private fun pickBestAnimationIndex(ri: RenderableInstance): Int {
    return choosePreferredAnimationIndex(ri)
  }

  private var textureResetGeneration = 0

  private fun resetLiveColoringStateForNewTarget() {
    // Remove ALL old tracked nodes so previous model colors don't leak
    trackedNodes.keys.toList().forEach { removeTrackedNode(it) }
    textureResetGeneration++
    hasAppliedPageTexture = false
    textureMaterialBuildInFlight = false
    lastTextureSignature = null
    lastTextureApplyTimeMs = 0L
    lastTextureStats = null
    pendingTextureSignature = null
    pendingTextureStreak = 0
    lastAcceptedTextureBitmap = null
    lastBuiltTexture = null
    lastSampledPageQuad = null
    lastSampledPageQuadTimeMs = 0L
    stablePageQuadStreak = 0
    pendingColorConsensusBySize.clear()
    fullPageSubjectMaskBySize.clear()
    fullPageReferencePixelsBySize.clear()
    hasDetectedUserColoring = false
    lastCpuParitySampleTimeMs = 0L
    lastCpuParityApplyTimeMs = 0L
    lastAcceptedTextureSource = null
    // Clear ALL caches to prevent previous model's colors leaking to new model
    resizedSubjectMaskBySize.clear()
    resizedReferencePixelsBySize.clear()
    referenceSubjectMaskTemplate = null
    materialTextureBindingCache.clear()
    materialPbrInitialized.clear()
    bitmapPool.clear()
    intArrayPool.clear()
    intArrayPoolSecondary.clear()
    // Reset GPU texture processor state for new target
    gpuTextureProcessor?.resetPreviousFrame()
    gpuMaskUploaded = false
    gpuReferenceUploaded = false
    // Phase 4: Reset white balance for new scene/lighting
    whiteBalanceSamplesCollected = 0
    whiteBalanceSampleIndex = 0
    whiteBalanceGainR = 1.0f; whiteBalanceGainG = 1.0f; whiteBalanceGainB = 1.0f
    // Reset tint state so new model gets fresh tint
    lastTintVector = null
    lastAcceptedSampleColor = null
    lastAcceptedSampleTimeMs = 0L
    pendingSampleColor = null
    pendingSampleStreak = 0
    lastTintUpdateTimeMs = 0L
    lastTintDebugLogTimeMs = 0L
    lastSampleMissLogTimeMs = 0L
    lastTextureDebugLogTimeMs = 0L
    lastTextureMissLogTimeMs = 0L
    loggedTintMaterialAttach = false
    loggedMissingTintTemplate = false
  }

  // ══════════════════════════════════════════════════════════════════
  //  Phase 3: GPU-accelerated texture sampling
  // ══════════════════════════════════════════════════════════════════

  /**
   * Try GPU-accelerated frame processing. Returns classified bitmap if GPU is available
   * and sampling is due, null otherwise (caller falls back to CPU path).
   */
  private fun tryGpuSampleTexture(frame: Frame, sceneView: ArSceneView): Bitmap? {
    if (!ENABLE_GPU_TEXTURE_PIPELINE) return null
    if (!isLiveColoringEnabled || showOriginalColors) return null
    val now = SystemClock.elapsedRealtime()
    val colorRefreshIntervalMs = colorRefreshIntervalMs()
    if (now - lastTintUpdateTimeMs < colorRefreshIntervalMs) return null
    lastTintUpdateTimeMs = now
    if (textureMaterialBuildInFlight) return null
    val inPerformanceRelief = now < performanceReliefUntilMs
    val textureRefreshIntervalMs = textureRefreshIntervalMs(inPerformanceRelief)
    if ((now - lastTextureApplyTimeMs) < textureRefreshIntervalMs && hasAppliedPageTexture) {
      return null
    }

    // Lazy-init GPU processor on first call (must be on GL thread)
    if (!gpuProcessorInitialized) {
      gpuProcessorInitialized = true
      try {
        val texId = extractCameraTextureId(sceneView)
        if (texId > 0) {
          cameraTextureId = texId
          val outputSize = textureSampleSizePx(inPerformanceRelief).coerceIn(128, 512)
          val processor = GpuTextureProcessor()
          processor.initialize(outputSize)
          if (processor.isInitialized()) {
            gpuTextureProcessor = processor
            android.util.Log.i("ARScannerActivity", "GPU texture processor initialized (camTex=$texId, size=$outputSize)")
          } else {
            processor.release()
            android.util.Log.w("ARScannerActivity", "GPU texture processor init failed, using CPU fallback")
          }
        } else {
          android.util.Log.w("ARScannerActivity", "Camera texture ID not found, using CPU fallback")
        }
      } catch (e: Exception) {
        android.util.Log.w("ARScannerActivity", "GPU init error, using CPU fallback", e)
      }
    }

    val processor = gpuTextureProcessor ?: return null
    if (cameraTextureId <= 0) return null

    // Upload subject mask once
    if (!gpuMaskUploaded) {
      val outputSize = processor.getOutputSize().coerceIn(128, 512)
      val mask = getFullPageSubjectMask(outputSize)
      processor.uploadSubjectMask(mask, outputSize, outputSize)
      gpuMaskUploaded = true
    }
    if (!gpuReferenceUploaded) {
      val outputSize = processor.getOutputSize().coerceIn(128, 512)
      val referencePixels = getFullPageReferencePixels(outputSize)
      processor.uploadReferenceTexture(referencePixels, outputSize, outputSize)
      gpuReferenceUploaded = true
    }

    // Compute homography: output UV [0,1] → camera texture UV [0,1]
    // Use image-pixel corners for stability checks and texture-normalized corners for GPU sampling.
    val trackedNode = trackedNodes.values.firstOrNull() ?: return null
    val pageCornersRaw = collectTrackedPageCorners(frame, sceneView, trackedNode) ?: return null
    if (pageCornersRaw.size < 4) return null
    val rawCorners = pageCornersRaw.take(4)
    val pageCorners = insetQuadCorners(rawCorners, PAGE_QUAD_INSET_RATIO)

    val nowQuad = SystemClock.elapsedRealtime()
    if (!isPageQuadStableForSampling(pageCorners, nowQuad)) return null

    val textureCornersRaw = collectTrackedPageTextureCorners(frame, sceneView, trackedNode) ?: return null
    if (textureCornersRaw.size < 4) return null
    val textureCorners = insetQuadCorners(textureCornersRaw.take(4), PAGE_QUAD_INSET_RATIO)
    val homography = computeGpuHomography(textureCorners) ?: return null

    return try {
      // Use rawOutput=true so GPU only does fast homography projection (camera→page UV mapping).
      // Color classification (skin detection, boost, white balance) is handled by CPU's
      // sanitizeSampledTexture() which produces the correct/proven color mapping.
      val result = processor.processFrame(
          cameraTextureId = cameraTextureId,
          homography = homography,
          blendAlpha = 1.0f,  // No GPU temporal blending — CPU sanitizer handles it
          minSat = MIN_DRAWING_SATURATION,
          minChroma = MIN_DRAWING_CHROMA.toFloat() / 255f,
          whiteBalanceGainR = 1.0f,  // No GPU white balance — CPU handles it
          whiteBalanceGainG = 1.0f,
          whiteBalanceGainB = 1.0f,
          rawOutput = true,  // Raw camera pixels only — no GPU classification
      )
      if (result != null) {
        consecutiveGlErrors = 0
      }
      result
    } catch (e: Exception) {
      // Phase 5: GL error recovery — disable GPU after repeated failures
      consecutiveGlErrors++
      android.util.Log.w("ARScannerActivity", "GPU processFrame error (#$consecutiveGlErrors)", e)
      if (consecutiveGlErrors >= MAX_CONSECUTIVE_GL_ERRORS) {
        android.util.Log.e("ARScannerActivity", "GPU disabled after $MAX_CONSECUTIVE_GL_ERRORS consecutive errors")
        processor.release()
        gpuTextureProcessor = null
        gpuProcessorInitialized = true // don't retry init
      }
      null
    }
  }

  /**
   * Extract ARCore camera texture ID from Sceneform's ArSceneView via reflection.
   * The camera feed is rendered as a GL_TEXTURE_EXTERNAL_OES texture.
   */
  private fun extractCameraTextureId(sceneView: ArSceneView): Int {
    return try {
      // Sceneform 1.23.0 (Thomas Gorisse fork) stores camera texture in cameraStream
      val field = sceneView.javaClass.getDeclaredField("cameraStream")
      field.isAccessible = true
      val cameraStream = field.get(sceneView) ?: return -1
      val texIdField = cameraStream.javaClass.getDeclaredField("cameraTextureId")
      texIdField.isAccessible = true
      texIdField.getInt(cameraStream)
    } catch (_: Exception) {
      try {
        // Fallback: try session's camera texture name
        val session = sceneView.session ?: return -1
        val field = session.javaClass.getDeclaredField("cameraTextureName")
        field.isAccessible = true
        field.getInt(session)
      } catch (_: Exception) {
        -1
      }
    }
  }

  /**
   * Compute homography matrix for GPU shader: maps output texture UV [0,1] → camera texture UV [0,1].
   * Returns a float[9] (column-major for GLSL mat3), or null on failure.
   */
  private fun computeGpuHomography(
      textureCornersUv: List<Pair<Float, Float>>,
  ): FloatArray? {
    if (textureCornersUv.size < 4) return null
    // Solve homography directly in camera texture UV space.
    val tl = textureCornersUv[0]
    val tr = textureCornersUv[1]
    val br = textureCornersUv[2]
    val bl = textureCornersUv[3]

    // Build the 8x8 system (same as CameraColorSampler.computeUnitSquareToQuadHomography)
    val points = arrayOf(
        Triple(0.0, 0.0, tl), Triple(1.0, 0.0, tr),
        Triple(1.0, 1.0, br), Triple(0.0, 1.0, bl),
    )
    val a = Array(8) { DoubleArray(8) }
    val b = DoubleArray(8)
    var row = 0
    points.forEach { (u, v, dst) ->
      val x = dst.first.toDouble()
      val y = dst.second.toDouble()
      a[row][0] = u; a[row][1] = v; a[row][2] = 1.0
      a[row][3] = 0.0; a[row][4] = 0.0; a[row][5] = 0.0
      a[row][6] = -u * x; a[row][7] = -v * x; b[row] = x
      row++
      a[row][0] = 0.0; a[row][1] = 0.0; a[row][2] = 0.0
      a[row][3] = u; a[row][4] = v; a[row][5] = 1.0
      a[row][6] = -u * y; a[row][7] = -v * y; b[row] = y
      row++
    }
    val solved = solveLinearSystem8(a, b) ?: return null
    // Return as column-major float[9] for GLSL mat3
    // GLSL mat3 is column-major: [col0.x, col0.y, col0.z, col1.x, col1.y, col1.z, col2.x, col2.y, col2.z]
    // Our homography H maps (u,v,1) → (x',y',w'): [h00 h01 h02; h10 h11 h12; h20 h21 1]
    return floatArrayOf(
        solved[0].toFloat(), solved[3].toFloat(), solved[6].toFloat(), // column 0
        solved[1].toFloat(), solved[4].toFloat(), solved[7].toFloat(), // column 1
        solved[2].toFloat(), solved[5].toFloat(), 1f,                  // column 2
    )
  }

  private fun solveLinearSystem8(matrix: Array<DoubleArray>, rhs: DoubleArray): DoubleArray? {
    val n = 8
    for (pivot in 0 until n) {
      var bestRow = pivot
      var bestAbs = kotlin.math.abs(matrix[pivot][pivot])
      for (candidate in (pivot + 1) until n) {
        val absValue = kotlin.math.abs(matrix[candidate][pivot])
        if (absValue > bestAbs) { bestAbs = absValue; bestRow = candidate }
      }
      if (bestAbs < 1e-9) return null
      if (bestRow != pivot) {
        val tmpRow = matrix[pivot]; matrix[pivot] = matrix[bestRow]; matrix[bestRow] = tmpRow
        val tmpRhs = rhs[pivot]; rhs[pivot] = rhs[bestRow]; rhs[bestRow] = tmpRhs
      }
      val pivotValue = matrix[pivot][pivot]
      for (col in pivot until n) { matrix[pivot][col] /= pivotValue }
      rhs[pivot] /= pivotValue
      for (r in 0 until n) {
        if (r == pivot) continue
        val factor = matrix[r][pivot]
        if (kotlin.math.abs(factor) < 1e-12) continue
        for (col in pivot until n) { matrix[r][col] -= factor * matrix[pivot][col] }
        rhs[r] -= factor * rhs[pivot]
      }
    }
    return rhs
  }

  // ══════════════════════════════════════════════════════════════════
  //  Phase 4: White Balance / Lighting Normalization
  // ══════════════════════════════════════════════════════════════════

  /**
   * Update white balance gains by sampling near-white pixels from the page.
   * This corrects for Environmental HDR blue/warm tint on paper.
   * Called periodically during texture sampling.
   */
  private fun updateWhiteBalance(pixels: IntArray, mask: BooleanArray, width: Int) {
    val now = SystemClock.elapsedRealtime()
    if (now - lastWhiteBalanceUpdateMs < WHITE_BALANCE_UPDATE_INTERVAL_MS) return
    lastWhiteBalanceUpdateMs = now

    // Collect near-white pixels (paper) — these should be neutral white
    var sumR = 0.0f; var sumG = 0.0f; var sumB = 0.0f; var count = 0
    val hsv = FloatArray(3)
    val step = (pixels.size / 200).coerceAtLeast(1)
    for (i in pixels.indices step step) {
      if (mask.getOrElse(i) { false }) continue // skip subject, use background paper
      val px = pixels[i]
      val r = Color.red(px); val g = Color.green(px); val b = Color.blue(px)
      Color.colorToHSV(px, hsv)
      // Near-white paper pixel: low saturation, high brightness
      if (hsv[1] < 0.10f && hsv[2] > 0.70f && hsv[2] < 0.98f) {
        sumR += r; sumG += g; sumB += b; count++
        if (count >= 60) break
      }
    }
    if (count < 10) return // not enough white samples

    val avgR = sumR / count
    val avgG = sumG / count
    val avgB = sumB / count
    // Target is neutral grey (equal R=G=B); compute gains to neutralize color cast
    val avgAll = (avgR + avgG + avgB) / 3f
    if (avgAll < 50f) return // too dark to calibrate

    val newGainR = (avgAll / avgR).coerceIn(WHITE_BALANCE_MIN_GAIN, WHITE_BALANCE_MAX_GAIN)
    val newGainG = (avgAll / avgG).coerceIn(WHITE_BALANCE_MIN_GAIN, WHITE_BALANCE_MAX_GAIN)
    val newGainB = (avgAll / avgB).coerceIn(WHITE_BALANCE_MIN_GAIN, WHITE_BALANCE_MAX_GAIN)

    // Smooth update using ring buffer
    val idx = whiteBalanceSampleIndex % WHITE_BALANCE_SAMPLE_COUNT
    whiteBalanceSampleR[idx] = newGainR
    whiteBalanceSampleG[idx] = newGainG
    whiteBalanceSampleB[idx] = newGainB
    whiteBalanceSampleIndex++
    whiteBalanceSamplesCollected = min(whiteBalanceSamplesCollected + 1, WHITE_BALANCE_SAMPLE_COUNT)

    // Average over collected samples for stability
    var sR = 0f; var sG = 0f; var sB = 0f
    for (j in 0 until whiteBalanceSamplesCollected) {
      sR += whiteBalanceSampleR[j]; sG += whiteBalanceSampleG[j]; sB += whiteBalanceSampleB[j]
    }
    whiteBalanceGainR = sR / whiteBalanceSamplesCollected
    whiteBalanceGainG = sG / whiteBalanceSamplesCollected
    whiteBalanceGainB = sB / whiteBalanceSamplesCollected
  }

  /** Apply white balance correction to a single pixel. Returns corrected color int. */
  private fun applyWhiteBalance(colorInt: Int): Int {
    if (whiteBalanceSamplesCollected < 3) return colorInt // not enough calibration data
    val r = (Color.red(colorInt) * whiteBalanceGainR).roundToInt().coerceIn(0, 255)
    val g = (Color.green(colorInt) * whiteBalanceGainG).roundToInt().coerceIn(0, 255)
    val b = (Color.blue(colorInt) * whiteBalanceGainB).roundToInt().coerceIn(0, 255)
    return Color.rgb(r, g, b)
  }

  // ══════════════════════════════════════════════════════════════════
  //  Phase 5: Production Telemetry & Guardrails
  // ══════════════════════════════════════════════════════════════════

  /** Record frame timing telemetry and log periodic reports. */
  private fun recordFrameTelemetry(durationMs: Long, isGpu: Boolean) {
    if (isGpu) telemetryGpuFrameCount++ else telemetryCpuFrameCount++
    telemetryTotalFrameTimeMs += durationMs
    if (durationMs > telemetryMaxFrameTimeMs) telemetryMaxFrameTimeMs = durationMs
    if (durationMs > FRAME_BUDGET_MS) telemetryDroppedFrameCount++

    val now = SystemClock.elapsedRealtime()
    if (now - telemetryLastReportMs >= TELEMETRY_REPORT_INTERVAL_MS) {
      telemetryLastReportMs = now
      val totalFrames = telemetryGpuFrameCount + telemetryCpuFrameCount
      val avgMs = if (totalFrames > 0) telemetryTotalFrameTimeMs / totalFrames else 0L
      android.util.Log.i("ARTelemetry",
          "frames=$totalFrames gpu=$telemetryGpuFrameCount cpu=$telemetryCpuFrameCount " +
          "dropped=$telemetryDroppedFrameCount avg=${avgMs}ms max=${telemetryMaxFrameTimeMs}ms " +
          "tier=${performanceProfile.tier} wb=(${String.format("%.2f", whiteBalanceGainR)}," +
          "${String.format("%.2f", whiteBalanceGainG)},${String.format("%.2f", whiteBalanceGainB)})")
      // Reset for next window
      telemetryTotalFrameTimeMs = 0L
      telemetryMaxFrameTimeMs = 0L
      telemetryDroppedFrameCount = 0L
      telemetryGpuFrameCount = 0L
      telemetryCpuFrameCount = 0L
    }
  }

  /** Enforce bitmap pool size limit to prevent OOM. */
  private fun enforceBitmapPoolLimit() {
    if (bitmapPool.size > MAX_BITMAP_POOL_SIZE) {
      val keysToRemove = bitmapPool.keys.toList().take(bitmapPool.size - MAX_BITMAP_POOL_SIZE)
      keysToRemove.forEach { key ->
        bitmapPool.remove(key)?.let { bmp ->
          if (!bmp.isRecycled) bmp.recycle()
        }
      }
    }
  }

  /** Check if we should skip this frame to stay within frame budget. */
  private fun isOverFrameBudget(frameStartMs: Long): Boolean {
    val elapsed = SystemClock.elapsedRealtime() - frameStartMs
    return elapsed > FRAME_BUDGET_MS * 2 // allow 2x budget before skipping
  }

  // ══════════════════════════════════════════════════════════════════
  //  CPU Fallback: texture sampling (used when GPU is not available)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Fast camera sampling on the GL/main thread. Returns a raw bitmap (not sanitized)
   * that can be processed on a background thread. Returns null if sampling is not due
   * or the page is not visible.
   */
  private fun quickSampleTextureBitmap(frame: Frame, sceneView: ArSceneView): Bitmap? {
    if (!isLiveColoringEnabled || showOriginalColors) return null
    val now = SystemClock.elapsedRealtime()
    val colorRefreshIntervalMs = colorRefreshIntervalMs()
    if (now - lastTintUpdateTimeMs < colorRefreshIntervalMs) return null
    lastTintUpdateTimeMs = now
    if (textureMaterialBuildInFlight) return null
    val inPerformanceRelief = now < performanceReliefUntilMs
    val textureRefreshIntervalMs = textureRefreshIntervalMs(inPerformanceRelief)
    val textureSampleSize = textureSampleSizePx(inPerformanceRelief)
    if ((now - lastTextureApplyTimeMs) < textureRefreshIntervalMs && hasAppliedPageTexture) {
      return null
    }
    return sampleTrackedPageTexture(frame, sceneView, textureSampleSize)
  }

  private fun processSampledTextureAsync(
      sampledBitmap: Bitmap,
      sampleStartMs: Long,
      source: String,
      isGpuSample: Boolean,
  ) {
    isSamplingInFlight = true
    val generationAtStart = textureResetGeneration
    samplingScope.launch {
      try {
        // Bail early if toggle changed while we were queued
        if (generationAtStart != textureResetGeneration) return@launch
        val processedBitmap = sanitizeSampledTexture(sampledBitmap)
        if (processedBitmap != null) {
          // Check again after heavy processing
          if (generationAtStart != textureResetGeneration) return@launch
          val stats = computeTextureStats(processedBitmap)
          val nowBg = SystemClock.elapsedRealtime()
          recordFrameTelemetry(nowBg - sampleStartMs, isGpu = isGpuSample)
          if (shouldAcceptTextureUpdate(stats, nowBg, source, isGpuSample)) {
            val sig = stats.signature
            val changed = isTextureSignatureSignificantlyChanged(lastTextureSignature, sig)
            val ageMs = nowBg - lastTextureApplyTimeMs
            if (!textureMaterialBuildInFlight &&
                (!hasAppliedPageTexture || changed || ageMs >= FORCE_TEXTURE_MATERIAL_REFRESH_MS)
            ) {
              withContext(Dispatchers.Main) {
                // Final guard: discard if toggle changed during async work
                if (generationAtStart != textureResetGeneration) return@withContext
                applyPageTextureToTrackedNodes(processedBitmap, sig, stats, source)
              }
            }
          }
        }
      } catch (e: Exception) {
        android.util.Log.w("ARScannerActivity", "${source.uppercase()} sampling error", e)
      } finally {
        isSamplingInFlight = false
      }
    }
  }

  /**
   * Lightweight fallback: when texture sampling misses (page not visible etc.),
   * fall back to solid tint from a single-color page sample. Runs on main thread.
   */
  private fun applyLiveTintFallback(frame: Frame, sceneView: ArSceneView) {
    if (!isLiveColoringEnabled || showOriginalColors) return
    val now = SystemClock.elapsedRealtime()
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
    if (!ENABLE_SOLID_TINT_FALLBACK) return

    val trackedSampleColor = sampleTrackedPageColor(frame, sceneView)
    if (trackedSampleColor == null && (now - lastSampleMissLogTimeMs) >= 1200L) {
      lastSampleMissLogTimeMs = now
    }
    val sampledColor =
        trackedSampleColor?.let { stabilizeSampledColor(it, now) }
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
    if (!isTintSignificantlyChanged(smoothedTint, lastTintVector)) return

    lastTintVector = smoothedTint
    hasAppliedPageTexture = false
    trackedNodes.values.forEach { trackedNode ->
      applySolidTintToTrackedNode(trackedNode, smoothedTint[0], smoothedTint[1], smoothedTint[2], "live")
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

  private fun shouldAcceptTextureUpdate(
      candidateStats: TextureStats,
      nowMs: Long,
      source: String,
      isGpuSample: Boolean,
  ): Boolean {
    val previousStats = lastTextureStats ?: return true
    val candidateSignature = candidateStats.signature
    val previousSignature = previousStats.signature
    val delta = colorDistanceRgb(previousSignature, candidateSignature)
    val changedRatio = computeGridChangedRatio(previousStats.gridColors, candidateStats.gridColors)

    // Only reject if nearly ALL grid cells changed drastically at once — full hand covering
    if (changedRatio >= HAND_OCCLUSION_CHANGE_RATIO && delta >= HAND_OCCLUSION_MIN_DELTA) {
      return false
    }

    // Very aggressive spike: huge color jump in a very short window — likely full occlusion
    if (delta >= MAX_TEXTURE_SPIKE_DELTA && (nowMs - lastTextureApplyTimeMs) <= MAX_TEXTURE_SPIKE_WINDOW_MS) {
      return false
    }

    // Reject transient "white flash" frames that suddenly lose too much colored coverage.
    val coloredCellDrop = previousStats.coloredCellCount - candidateStats.coloredCellCount
    if (coloredCellDrop >= MAX_TEXTURE_COLORED_CELL_DROP &&
        changedRatio >= WHITE_FLASH_REJECT_CHANGE_RATIO
    ) {
      return false
    }

    // After a CPU-parity correction, ignore unstable GPU frames briefly unless they are
    // very close to the last accepted texture. This prevents GPU/CPU alternation blinking.
    val recentCpuParityLock =
        isGpuSample &&
            (nowMs - lastCpuParityApplyTimeMs) <= GPU_AFTER_CPU_PARITY_HOLD_MS &&
            lastAcceptedTextureSource == TEXTURE_SOURCE_CPU_PARITY
    if (recentCpuParityLock) {
      val candidateCloseToCpuParity =
          changedRatio <= GPU_AFTER_CPU_PARITY_MAX_CHANGED_RATIO &&
              coloredCellDrop <= GPU_AFTER_CPU_PARITY_MAX_COLORED_DROP &&
              delta <= GPU_AFTER_CPU_PARITY_MAX_SIGNATURE_DELTA
      if (!candidateCloseToCpuParity) {
        return false
      }
    }

    // CPU parity frames are the correctness anchor. If one arrives, prefer keeping it.
    if (source == TEXTURE_SOURCE_CPU_PARITY) {
      return true
    }

    // Accept all other updates — pixel-level skin/occluder rejection in sanitizeSampledTexture
    // handles partial hand presence, so frame-level gating should be minimal.
    return true
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
    // Use full page corners — the 3D model's UVs are mapped to the full page layout
    // (bear body sits at UV ~0.23-0.78 / ~0.31-0.84 within the page).
    // Cropping to the bear region breaks the UV alignment.
    val insetPageCorners = insetQuadCorners(pageCorners, PAGE_QUAD_INSET_RATIO)
    val now = SystemClock.elapsedRealtime()
    if (!isPageQuadStableForSampling(insetPageCorners, now)) {
      return null
    }
    val output = outputSizePx.coerceIn(48, 160)
    val pooledPixels = getPooledIntArray(output * output)
    val pooledBitmap = getPooledBitmap(output, output)
    return runCatching {
          CameraColorSampler.sampleQuadBitmap(
              frame = frame,
              cornersPx = insetPageCorners,
              outputSize = output,
              reusablePixels = pooledPixels,
              reusableBitmap = pooledBitmap,
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
    // Guard: don't apply colored texture if live coloring was toggled OFF
    if (!isLiveColoringEnabled || showOriginalColors) return
    if (textureMaterialBuildInFlight) {
      return
    }
    textureMaterialBuildInFlight = true
    val capturedGeneration = textureResetGeneration

    val sampler =
        Texture.Sampler.builder()
            .setMinFilter(Texture.Sampler.MinFilter.LINEAR_MIPMAP_LINEAR) // smooth at all angles
            .setMagFilter(Texture.Sampler.MagFilter.LINEAR) // smooth color transitions, no blocky pixels
            .setWrapMode(Texture.Sampler.WrapMode.CLAMP_TO_EDGE)
            .build()

    Texture.builder()
        .setSource(bitmap)
        .setSampler(sampler)
        .build()
        .thenAccept { texture ->
          // Discard stale texture if toggle changed or a new sheet was scanned
          if (capturedGeneration != textureResetGeneration || !isLiveColoringEnabled) {
            textureMaterialBuildInFlight = false
            lastBuiltTexture = texture  // still cache for future toggle ON
            return@thenAccept
          }
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
            lastBuiltTexture = texture  // cache for instant toggle restore
            lastTextureSignature = signature
            lastTextureStats = textureStats
            lastTextureApplyTimeMs = SystemClock.elapsedRealtime()
            lastAcceptedTextureBitmap = bitmap
            lastAcceptedTextureSource = source
            if (source == TEXTURE_SOURCE_CPU_PARITY) {
              lastCpuParityApplyTimeMs = lastTextureApplyTimeMs
            }
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
    val genAtBuild = textureResetGeneration
    MaterialFactory.makeOpaqueWithTexture(this, texture)
        .thenAccept { generatedMaterial ->
          // Discard if toggle changed while async build was in progress
          if (genAtBuild != textureResetGeneration || !isLiveColoringEnabled) {
            trackedNode.tintBuildInFlight = false
            trackedNode.tintMaterial = generatedMaterial  // still cache for future use
            return@thenAccept
          }
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
          runCatching { generatedMaterial.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.95f) }
          runCatching { generatedMaterial.setFloat("reflectance", 0.04f) }
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
      // Fully diffuse: no metallic sheen, high roughness, near-zero reflectance
      // so environmental HDR lighting does NOT tint the sampled crayon colors.
      runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
      runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.95f) }
      runCatching { material.setFloat("reflectance", 0.04f) }
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
      return TextureStats(0, intArrayOf(), 0)
    }
    val pixelCount = bitmap.width * bitmap.height
    val bitmapPixels = getPooledIntArray(pixelCount)
    bitmap.getPixels(bitmapPixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)

    val grid = TEXTURE_STATS_GRID
    val gridColors = getPooledIntArray(grid * grid)
    var redAcc = 0
    var greenAcc = 0
    var blueAcc = 0
    var sampleCount = 0
    var coloredCellCount = 0

    for (row in 0 until grid) {
      val y = ((row.toFloat() / (grid - 1).toFloat()) * (bitmap.height - 1)).roundToInt()
      for (col in 0 until grid) {
        val x = ((col.toFloat() / (grid - 1).toFloat()) * (bitmap.width - 1)).roundToInt()
        val pixel = bitmapPixels[(y * bitmap.width) + x]
        gridColors[(row * grid) + col] = pixel
        if (!isTextureGridCellWhite(pixel)) {
          coloredCellCount += 1
        }
        redAcc += android.graphics.Color.red(pixel)
        greenAcc += android.graphics.Color.green(pixel)
        blueAcc += android.graphics.Color.blue(pixel)
        sampleCount += 1
      }
    }

    if (sampleCount <= 0) {
      return TextureStats(0, gridColors, coloredCellCount)
    }
    val avgR = (redAcc / sampleCount).coerceIn(0, 255)
    val avgG = (greenAcc / sampleCount).coerceIn(0, 255)
    val avgB = (blueAcc / sampleCount).coerceIn(0, 255)
    val signature = (avgR shl 16) or (avgG shl 8) or avgB
    return TextureStats(signature, gridColors, coloredCellCount)
  }

  private fun isTextureGridCellWhite(colorInt: Int): Boolean {
    val hsv = FloatArray(3)
    Color.colorToHSV(colorInt, hsv)
    return hsv[1] <= 0.10f && hsv[2] >= 0.84f
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
    return projectLocalOffsetsToCameraCoordinates(
        frame = frame,
        sceneView = sceneView,
        trackedNode = trackedNode,
        sampleOffsets = sampleOffsets,
        outputCoordinates = Coordinates2d.IMAGE_PIXELS,
    )
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
    return projectLocalOffsetsToCameraCoordinates(
        frame = frame,
        sceneView = sceneView,
        trackedNode = trackedNode,
        sampleOffsets = cornerOffsets,
        outputCoordinates = Coordinates2d.IMAGE_PIXELS,
    )
  }

  private fun collectTrackedPageTextureCorners(
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
    return projectLocalOffsetsToCameraCoordinates(
        frame = frame,
        sceneView = sceneView,
        trackedNode = trackedNode,
        sampleOffsets = cornerOffsets,
        outputCoordinates = Coordinates2d.TEXTURE_NORMALIZED,
    )
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

  private fun projectLocalOffsetsToCameraCoordinates(
      frame: Frame,
      sceneView: ArSceneView,
      trackedNode: TrackedImageNode,
      sampleOffsets: List<Pair<Float, Float>>,
      outputCoordinates: Coordinates2d,
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
    val outputCoords = FloatArray(writtenSamples * 2)
    return runCatching {
          frame.transformCoordinates2d(
              Coordinates2d.VIEW,
              input,
              outputCoordinates,
              outputCoords,
          )
          (0 until writtenSamples).map { index ->
            outputCoords[index * 2] to outputCoords[(index * 2) + 1]
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

  private fun sanitizeSampledTexture(bitmap: Bitmap): Bitmap? {
    val outputWidth = bitmap.width
    val outputHeight = bitmap.height
    if (outputWidth <= 0 || outputHeight <= 0) return bitmap
    if (outputWidth != outputHeight) return bitmap

    val subjectMask = getFullPageSubjectMask(outputWidth)
    val referencePixels = getFullPageReferencePixels(outputWidth)
    val totalPixels = outputWidth * outputHeight
    val currentPixels = getPooledIntArray(totalPixels)
    bitmap.getPixels(currentPixels, 0, outputWidth, 0, 0, outputWidth, outputHeight)

    val previousBitmap =
        lastAcceptedTextureBitmap?.takeIf { it.width == outputWidth && it.height == outputHeight }
    val previousPixels =
        previousBitmap?.let {
          getSecondaryPooledIntArray(totalPixels).also { buffer ->
            it.getPixels(buffer, 0, outputWidth, 0, 0, outputWidth, outputHeight)
          }
        }

    // ── Single optimized pass: classify each pixel ──
    // ONE HSV conversion per pixel (was 3x: isLikelyUserDrawingPixel + isLikelySkinTone + inline)
    // On LOW tier: process every 2nd pixel in each row (skip odd columns, fill from left neighbor)
    val hsv = FloatArray(3)
    var coloredCount = 0
    var skinPixelCount = 0
    val hasMask = subjectMask.isNotEmpty()
    val hasRef = referencePixels.isNotEmpty()
    val hasPrev = previousPixels != null
    val pixelStep = if (performanceProfile.tier == PerformanceTier.LOW) 2 else 1

    for (index in 0 until totalPixels step pixelStep) {
      val camPixel = currentPixels[index]
      val red = Color.red(camPixel)
      val green = Color.green(camPixel)
      val blue = Color.blue(camPixel)

      // Single HSV conversion for ALL checks below
      Color.colorToHSV(camPixel, hsv)
      val hue = hsv[0]
      val sat = hsv[1]
      val value = hsv[2]
      val chroma = max(red, max(green, blue)) - min(red, min(green, blue))

      // 1) Very dark pixel → shadow/outline → WHITE
      if (value < 0.15f) {
        currentPixels[index] = android.graphics.Color.WHITE
        continue
      }

      val previous = if (hasPrev) previousPixels!![index] else 0
      val hasPrevPixel = hasPrev
      val insideMask = if (hasMask) subjectMask.getOrElse(index) { true } else true

      // 2) Skin tone → hand is covering the page → use previous frame or WHITE
      if (isLikelySkinToneHsv(hsv, red, green, blue)) {
        skinPixelCount++
        currentPixels[index] = if (hasPrevPixel) previous else android.graphics.Color.WHITE
        continue
      }

      // 2b) Hand shadow / edge / crayon body detection
      //     Warm brownish pixels outside bear body = hand shadow or crayon stick
      val isHandOrObject = hue in 5f..50f && sat in 0.08f..0.55f && value in 0.15f..0.65f &&
          red > green && red > blue && chroma < 50
      if (isHandOrObject && !insideMask) {
        skinPixelCount++
        currentPixels[index] = if (hasPrevPixel) previous else android.graphics.Color.WHITE
        continue
      }

      // 3) Neutral occluder check (inline — saves HSV call)
      //    Catches crayon body, shadows, dark objects on the page
      val isOccluder = (value in 0.05f..0.55f && sat <= 0.22f) || value < 0.08f

      // 4) Grey/neutral background → WHITE
      //    OUTSIDE subject mask: strict rejection (forest/background elements)
      //    INSIDE subject mask: lenient (keep faint crayon strokes)
      if (!insideMask) {
        // Outside bear body — aggressively reject non-vivid pixels
        if (value < 0.55f && sat <= 0.25f && chroma <= 45) {
          currentPixels[index] = android.graphics.Color.WHITE
          continue
        }
        if (sat < 0.08f && value >= 0.70f) {
          currentPixels[index] = android.graphics.Color.WHITE
          continue
        }
      } else {
        // Inside bear body — only reject truly grey/dark pixels, keep crayon colors
        if (value < 0.50f && sat <= 0.20f && chroma <= 35) {
          currentPixels[index] = android.graphics.Color.WHITE
          continue
        }
        if (value < 0.28f && sat <= 0.35f && chroma < 18) {
          currentPixels[index] = android.graphics.Color.WHITE
          continue
        }
      }

      // 5) Near-white / uncolored paper → WHITE
      if (sat < 0.06f && value >= 0.78f && chroma <= 25) {
        currentPixels[index] = android.graphics.Color.WHITE
        continue
      }

      // 6) Determine if user-colored (inline — saves 2 extra HSV calls per pixel)
      val reference = if (hasRef) referencePixels.getOrNull(index) else null
      val userColored = !isOccluder && isDrawingPixelFast(sat, value, chroma, camPixel, reference)

      if (!insideMask && !userColored) {
        val previousColored = hasPrevPixel && !isOccluder &&
            isDrawingPixelFastFromColor(previous, reference)
        currentPixels[index] = if (previousColored) previous else android.graphics.Color.WHITE
        continue
      }

      if (userColored) {
        coloredCount++
        val boosted = boostDrawingPixel(camPixel)
        currentPixels[index] =
            if (hasPrevPixel) blendRgb(previous, boosted, TEXTURE_BLEND_ALPHA) else boosted
      } else {
        val previousColored = hasPrevPixel && !isOccluder &&
            isDrawingPixelFastFromColor(previous, reference)
        currentPixels[index] = if (previousColored) previous else android.graphics.Color.WHITE
      }
    }

    // If hand/skin covers too much of the page, reject this frame entirely
    // and keep the previous clean frame
    val skinRatio = if (totalPixels > 0) skinPixelCount.toFloat() / (totalPixels / pixelStep).toFloat() else 0f
    if (skinRatio >= HAND_OCCLUSION_SKIN_RATIO && previousBitmap != null && !previousBitmap.isRecycled) {
      return previousBitmap
    }

    // Fill skipped pixels from left neighbor (LOW tier pixel-skipping)
    if (pixelStep > 1) {
      for (y in 0 until outputHeight) {
        val rowStart = y * outputWidth
        for (x in 1 until outputWidth step 2) {
          val idx = rowStart + x
          if (idx < totalPixels) {
            currentPixels[idx] = currentPixels[idx - 1]
          }
        }
      }
    }

    val hasUserColoring = coloredCount >= MIN_COLORED_PIXELS_FOR_TEXTURE
    if (hasUserColoring) {
      hasDetectedUserColoring = true
      // Skip fillWhiteHoles on LOW/MEDIUM tier — saves ~2-4ms per frame
      if (performanceProfile.tier == PerformanceTier.HIGH) {
        fillWhiteHoles(currentPixels, subjectMask, outputWidth, outputHeight)
      }
    }

    if ((now() - lastTextureDebugLogTimeMs) >= 2000L) {
      android.util.Log.i(
          "ARScannerActivity",
          "Texture sanitize: coloredPx=$coloredCount hasColoring=$hasUserColoring size=${outputWidth}x${outputHeight}",
      )
    }

    bitmap.setPixels(currentPixels, 0, outputWidth, 0, 0, outputWidth, outputHeight)
    return bitmap
  }

  /**
   * Fast skin-tone check using pre-computed HSV and RGB values (no re-allocation).
   * Phase 4: Widened ranges to cover diverse skin tones (light to dark complexions).
   */
  private fun isLikelySkinToneHsv(hsv: FloatArray, red: Int, green: Int, blue: Int): Boolean {
    val hue = hsv[0]
    val sat = hsv[1]
    val value = hsv[2]
    // Wider skin detection — Indian skin tones range from light brown to dark brown.
    // HSV: hue 8-42 (warm/yellowish), sat 0.10-0.50, value 0.18-0.92
    val hsvSkinMatch = hue in 8f..42f && sat in 0.10f..0.50f && value in 0.18f..0.92f
    val delta = red - green
    // Skin: red > green > blue, moderate spread. Crayons have stronger chroma.
    val rgbSkinMatch =
        red in 60..245 && green in 35..215 && blue in 20..180 &&
            red > green && red > blue && delta in 8..60
    if (!(hsvSkinMatch && rgbSkinMatch)) {
      return false
    }
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))
    // If high saturation + high chroma → likely vivid crayon, NOT skin
    val likelyWarmCrayon = sat >= 0.12f && chroma >= 30
    return !likelyWarmCrayon
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

  // Phase 4: Reusable HSV array for occluder check to avoid per-call allocation
  private val occluderHsv = FloatArray(3)
  private fun isLikelyNeutralOccluder(colorInt: Int): Boolean {
    Color.colorToHSV(colorInt, occluderHsv)
    return isNeutralOccluderHsv(occluderHsv)
  }

  /** Fast neutral-occluder check using pre-computed HSV (no allocation) */
  private fun isNeutralOccluderHsv(hsv: FloatArray): Boolean {
    val value = hsv[2]
    val saturation = hsv[1]
    return (value in 0.05f..0.55f && saturation <= 0.22f) || value < 0.08f
  }

  // Reusable HSV array for isLikelyUserDrawingPixel — avoids per-pixel allocation
  private val drawingPixelHsv = FloatArray(3)

  private fun isLikelyUserDrawingPixel(cameraPixel: Int, referencePixel: Int?): Boolean {
    if (isLikelySkinTone(cameraPixel) || isLikelyNeutralOccluder(cameraPixel)) {
      return false
    }

    android.graphics.Color.colorToHSV(cameraPixel, drawingPixelHsv)
    val saturation = drawingPixelHsv[1]
    val value = drawingPixelHsv[2]
    val red = android.graphics.Color.red(cameraPixel)
    val green = android.graphics.Color.green(cameraPixel)
    val blue = android.graphics.Color.blue(cameraPixel)
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))

    // Accept only crayon-like pixels: sufficiently colorful and not too dark.
    if (referencePixel == null) {
      if (saturation < MIN_DRAWING_SATURATION || value < MIN_DRAWING_VALUE || chroma < MIN_DRAWING_CHROMA) {
        return false
      }
      return true
    }

    val deltaSq = colorDistanceSq(cameraPixel, referencePixel)
    if (deltaSq < DELTA_COLORED_THRESHOLD_SQ) {
      return false
    }

    // Pixel differs from reference — but is it actually CRAYON COLOR or just lighting variation?
    // Grey/neutral pixels that differ from reference are lighting/shadow artifacts, not coloring.
    // Require meaningful color: saturation AND chroma above thresholds.
    if (saturation < MIN_DRAWING_SATURATION_WITH_REF && chroma < MIN_DRAWING_CHROMA_WITH_REF) {
      return false
    }
    // Very dark pixels are shadows, not crayon strokes
    if (value < 0.10f) {
      return false
    }
    // Near-white pixels are paper/lighting glare, not coloring
    if (saturation < 0.03f && value > 0.88f) {
      return false
    }

    return true
  }

  /** Fast drawing-pixel check using pre-computed HSV values (no extra Color.colorToHSV call) */
  private fun isDrawingPixelFast(sat: Float, value: Float, chroma: Int, cameraPixel: Int, referencePixel: Int?): Boolean {
    if (referencePixel == null) {
      return sat >= MIN_DRAWING_SATURATION && value >= MIN_DRAWING_VALUE && chroma >= MIN_DRAWING_CHROMA
    }
    val deltaSq = colorDistanceSq(cameraPixel, referencePixel)
    if (deltaSq < DELTA_COLORED_THRESHOLD_SQ) return false
    if (sat < MIN_DRAWING_SATURATION_WITH_REF && chroma < MIN_DRAWING_CHROMA_WITH_REF) return false
    if (value < 0.10f) return false
    if (sat < 0.03f && value > 0.88f) return false
    return true
  }

  /** Full drawing-pixel check from a color int (used for previous-frame check, infrequent) */
  private val fastCheckHsv = FloatArray(3)
  private fun isDrawingPixelFastFromColor(colorInt: Int, referencePixel: Int?): Boolean {
    Color.colorToHSV(colorInt, fastCheckHsv)
    val r = Color.red(colorInt); val g = Color.green(colorInt); val b = Color.blue(colorInt)
    val chroma = max(r, max(g, b)) - min(r, min(g, b))
    // Skip skin/occluder checks for previous frame (already passed when it was current)
    return isDrawingPixelFast(fastCheckHsv[1], fastCheckHsv[2], chroma, colorInt, referencePixel)
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

  // Reusable HSV array for boost to avoid per-pixel allocation
  private val boostHsv = FloatArray(3)
  private fun boostDrawingPixel(colorInt: Int): Int {
    Color.colorToHSV(colorInt, boostHsv)
    if (boostHsv[1] <= 0.02f && boostHsv[2] >= 0.88f) {
      return colorInt
    }
    // Vivid boost — make crayon colors pop on the 3D model (match GPU shader strength)
    val satBoost = if (boostHsv[1] < 0.25f) 1.50f else if (boostHsv[1] < 0.45f) 1.35f else 1.22f
    val valBoost = if (boostHsv[2] < 0.40f) 1.25f else if (boostHsv[2] < 0.65f) 1.15f else 1.06f
    boostHsv[1] = (boostHsv[1] * satBoost).coerceIn(0f, 1f)
    boostHsv[2] = ((boostHsv[2] * valBoost) + 0.04f).coerceIn(0f, 1f)
    return Color.HSVToColor(Color.alpha(colorInt), boostHsv)
  }

  // Reusable HSV array for fillWhiteHoles
  private val fillHoleHsv = FloatArray(3)

  private fun fillWhiteHoles(
      pixels: IntArray,
      mask: BooleanArray,
      width: Int,
      height: Int,
  ) {
    if (width < 3 || height < 3) return
    // Step size 1 for small textures, 2 for larger — reduces iterations
    val step = if (width <= 96) 1 else 2
    for (y in 1 until height - 1 step step) {
      val rowIndex = y * width
      for (x in 1 until width - 1 step step) {
        val idx = rowIndex + x
        if (!mask.getOrElse(idx) { true }) continue
        val px = pixels[idx]
        // Fast near-white check without HSV — avoid expensive Color.colorToHSV per pixel
        val r = Color.red(px); val g = Color.green(px); val b = Color.blue(px)
        val maxC = max(r, max(g, b)); val minC = min(r, min(g, b))
        if (maxC < 215 || (maxC - minC) > 26) continue // not near-white, skip
        var count = 0; var rAcc = 0; var gAcc = 0; var bAcc = 0
        // Check 4 neighbors inline (no IntArray allocation)
        for (n in intArrayOf(idx - 1, idx + 1, idx - width, idx + width)) {
          if (n < 0 || n >= pixels.size) continue
          if (!mask.getOrElse(n) { true }) continue
          val nc = pixels[n]
          val nr = Color.red(nc); val ng = Color.green(nc); val nb = Color.blue(nc)
          val nMax = max(nr, max(ng, nb)); val nMin = min(nr, min(ng, nb))
          if (nMax >= 215 && (nMax - nMin) <= 26) continue // neighbor is also white
          rAcc += nr; gAcc += ng; bAcc += nb; count++
        }
        if (count >= 2) {
          pixels[idx] = Color.rgb(rAcc / count, gAcc / count, bAcc / count)
        }
      }
    }
  }

  // Reusable HSV array for skin tone check — avoids per-pixel allocation
  private val skinToneHsv = FloatArray(3)

  private fun isLikelySkinTone(colorInt: Int): Boolean {
    android.graphics.Color.colorToHSV(colorInt, skinToneHsv)
    return isLikelySkinToneHsv(
        skinToneHsv,
        android.graphics.Color.red(colorInt),
        android.graphics.Color.green(colorInt),
        android.graphics.Color.blue(colorInt),
    )
  }

  private fun getReferenceSubjectMask(outputSize: Int): BooleanArray? {
    resizedSubjectMaskBySize[outputSize]?.let { return it }
    val template = loadReferenceSubjectMaskTemplate() ?: return null
    if (template.width <= 0 || template.height <= 0) {
      return null
    }
    val scaledMask = BooleanArray(outputSize * outputSize)
    val denomU = (template.pageMaxU - template.pageMinU).coerceAtLeast(0.001f)
    val denomV = (template.pageMaxV - template.pageMinV).coerceAtLeast(0.001f)
    for (row in 0 until outputSize) {
      val v = row.toFloat() / (outputSize - 1).toFloat()
      if (v < template.pageMinV || v > template.pageMaxV) {
        continue
      }
      val sourceY =
          (((v - template.pageMinV) / denomV) * (template.height - 1))
              .roundToInt()
              .coerceIn(0, template.height - 1)
      for (col in 0 until outputSize) {
        val u = col.toFloat() / (outputSize - 1).toFloat()
        if (u < template.pageMinU || u > template.pageMaxU) {
          continue
        }
        val sourceX =
            (((u - template.pageMinU) / denomU) * (template.width - 1))
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
        if (referenceImageFilePath != null) {
          runCatching { BitmapFactory.decodeFile(referenceImageFilePath) }.getOrNull()
        } else {
          runCatching {
                assets.open(requestedReferenceImageAsset).use { stream ->
                  BitmapFactory.decodeStream(stream)
                }
              }
              .getOrNull()
        }
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
    // Prefer seeded flood-fill from known bear anchor points; fallback to best connected component.
    val component =
        buildSeededReferenceSubjectMask(pixels, width, height)
            ?: selectBestSubjectComponent(subjectCandidates, width, height)
            ?: return null
    var minX = width
    var maxX = 0
    var minY = height
    var maxY = 0
    var areaCount = 0
    for (index in component.indices) {
      if (!component[index]) continue
      areaCount += 1
      val x = index % width
      val y = index / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }

    if (areaCount <= MIN_SUBJECT_MASK_PIXELS || minX >= maxX || minY >= maxY) {
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

    val normalizedAreaCount = normalizedMask.count { it }
    if (normalizedAreaCount <= MIN_SUBJECT_MASK_PIXELS) {
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
    val totalPixels = (width * height).coerceAtLeast(1)
    // Merge masks from ALL seed points — ensures head, body, legs all get covered
    // even if separated by dark outlines
    val mergedMask = BooleanArray(totalPixels)
    var totalArea = 0

    SUBJECT_MASK_SEED_POINTS.forEach { (u, v) ->
      val seedX = (u * (width - 1)).roundToInt().coerceIn(0, width - 1)
      val seedY = (v * (height - 1)).roundToInt().coerceIn(0, height - 1)
      val mask = floodFillReferenceSubjectRegion(pixels, width, height, seedX, seedY) ?: return@forEach
      val area = mask.count { it }
      if (area >= MIN_SUBJECT_MASK_PIXELS) {
        // Only merge if this region is reasonably sized (not a tiny noise patch)
        for (i in mask.indices) {
          if (mask[i] && !mergedMask[i]) {
            mergedMask[i] = true
            totalArea++
          }
        }
      }
    }

    if (totalArea < MIN_SUBJECT_MASK_PIXELS) {
      return null
    }
    val areaRatio = totalArea.toFloat() / totalPixels.toFloat()
    if (areaRatio > SUBJECT_COMPONENT_MAX_AREA_RATIO) {
      return null
    }
    return mergedMask
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
      val isFillable = isReferenceSubjectFillPixel(pixels[index])
      if (!isFillable) {
        // Bridge: try to jump across 1-2 pixel dark outlines
        // If a neighbor on the OTHER side of this dark pixel is fillable, include this pixel
        val x = index % width
        val y = index / width
        var canBridge = false
        // Check if any 2-step neighbor is a fill pixel (bridge across 1px outline)
        val bridgeOffsets = intArrayOf(
            if (x >= 2) -2 else Int.MIN_VALUE,
            if (x <= width - 3) 2 else Int.MIN_VALUE,
            if (y >= 2) -(width * 2) else Int.MIN_VALUE,
            if (y <= height - 3) (width * 2) else Int.MIN_VALUE,
        )
        for (offset in bridgeOffsets) {
          if (offset == Int.MIN_VALUE) continue
          val bridgeTarget = index + offset
          if (bridgeTarget in pixels.indices && isReferenceSubjectFillPixel(pixels[bridgeTarget])) {
            canBridge = true
            break
          }
        }
        if (!canBridge) continue
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

  private fun applyNeutralPaperBase(trackedNode: TrackedImageNode) {
    val red = (android.graphics.Color.red(DEFAULT_NEUTRAL_BEAR_COLOR) / 255f).coerceIn(0f, 1f)
    val green = (android.graphics.Color.green(DEFAULT_NEUTRAL_BEAR_COLOR) / 255f).coerceIn(0f, 1f)
    val blue = (android.graphics.Color.blue(DEFAULT_NEUTRAL_BEAR_COLOR) / 255f).coerceIn(0f, 1f)
    applySolidTintToTrackedNode(trackedNode, red, green, blue, "neutral")
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

  private var lastHapticTimeMs: Long = 0L

  private fun hapticFeedback(type: String = "light") {
    val now = SystemClock.elapsedRealtime()
    if (now - lastHapticTimeMs < 80) return // throttle haptics
    lastHapticTimeMs = now

    val vibrator = if (Build.VERSION.SDK_INT >= 31) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    } ?: return

    if (Build.VERSION.SDK_INT >= 26) {
      when (type) {
        "light" -> vibrator.vibrate(VibrationEffect.createOneShot(12, 35))
        "medium" -> vibrator.vibrate(VibrationEffect.createOneShot(20, 70))
      }
    }
  }

  private fun setupGestureDetectors() {
    scaleGestureDetector =
        ScaleGestureDetector(
            this,
            object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
              override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
                hapticFeedback("light")
                return true
              }
              override fun onScale(detector: ScaleGestureDetector): Boolean {
                val incrementalFactor =
                    detector.scaleFactor.coerceIn(MIN_PINCH_STEP_FACTOR, MAX_PINCH_STEP_FACTOR)

                // Fallback mode: pinch to zoom the 3D model
                if (isInFallbackMode) {
                  fallbackUserScale = (fallbackUserScale * incrementalFactor).coerceIn(0.3f, 4f)
                  updateFallbackPositions()
                  return true
                }

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
    // ── Fallback mode: separate touch handling (rotate + pinch zoom) ──
    if (isInFallbackMode) {
      return handleFallbackTouch(motionEvent)
    }

    val scaleGestureHandled = scaleGestureDetector.onTouchEvent(motionEvent)
    var rotationHandled = false

    when (motionEvent.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        // Start single-finger drag rotation
        lastSingleFingerX = motionEvent.x
        lastSingleFingerY = motionEvent.y
        isSingleFingerRotating = true
      }

      MotionEvent.ACTION_POINTER_DOWN -> {
        // Switch to two-finger mode (pinch/rotate)
        isSingleFingerRotating = false
        if (motionEvent.pointerCount >= 2) {
          lastTwoPointerAngleDegrees = computeTwoPointerAngleDegrees(motionEvent)
        }
      }

      MotionEvent.ACTION_MOVE -> {
        if (motionEvent.pointerCount >= 2) {
          // Two-finger rotation (classic)
          isSingleFingerRotating = false
          val currentAngle = computeTwoPointerAngleDegrees(motionEvent)
          val previousAngle = lastTwoPointerAngleDegrees
          if (currentAngle != null && previousAngle != null) {
            val rawDelta = currentAngle - previousAngle
            val normalizedDelta = normalizeRotationDelta(rawDelta)
            if (abs(normalizedDelta) >= MIN_ROTATION_DELTA_DEGREES) {
              hapticFeedback("light")
              trackedNodes.values.forEach { trackedNode ->
                trackedNode.userYawDegrees += normalizedDelta * ROTATION_GESTURE_SENSITIVITY
                applyUserTransform(trackedNode)
              }
              rotationHandled = true
            }
          }
          lastTwoPointerAngleDegrees = currentAngle
        } else if (isSingleFingerRotating && trackedNodes.isNotEmpty()) {
          // Single-finger horizontal drag → rotate model (easy for kids!)
          val dx = motionEvent.x - lastSingleFingerX
          if (abs(dx) >= SINGLE_FINGER_ROTATION_MIN_PX) {
            val rotationDelta = dx * SINGLE_FINGER_ROTATION_SENSITIVITY
            trackedNodes.values.forEach { trackedNode ->
              trackedNode.userYawDegrees += rotationDelta
              applyUserTransform(trackedNode)
            }
            rotationHandled = true
          }
          lastSingleFingerX = motionEvent.x
          lastSingleFingerY = motionEvent.y
        }
      }

      MotionEvent.ACTION_POINTER_UP,
      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> {
        isSingleFingerRotating = false
        if (motionEvent.pointerCount < 2) {
          lastTwoPointerAngleDegrees = null
        }
      }
    }

    return scaleGestureHandled || rotationHandled
  }

  /** Touch handling for fallback (non-AR) mode: single-finger rotate, pinch to zoom. */
  private fun handleFallbackTouch(motionEvent: MotionEvent): Boolean {
    // Pinch-to-zoom
    scaleGestureDetector.onTouchEvent(motionEvent)

    when (motionEvent.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        fallbackLastTouchX = motionEvent.x
        fallbackLastTouchY = motionEvent.y
        fallbackIsDragging = true
      }

      MotionEvent.ACTION_MOVE -> {
        if (motionEvent.pointerCount == 1 && fallbackIsDragging) {
          val dx = motionEvent.x - fallbackLastTouchX
          val dy = motionEvent.y - fallbackLastTouchY
          // Horizontal drag → rotate around Y axis (smooth sensitivity for kids)
          fallbackUserYaw += dx * 0.4f
          // Vertical drag → tilt around X axis (clamped so model doesn't flip)
          fallbackUserPitch = (fallbackUserPitch + dy * 0.3f).coerceIn(-60f, 60f)
          fallbackLastTouchX = motionEvent.x
          fallbackLastTouchY = motionEvent.y
          updateFallbackPositions()
        } else if (motionEvent.pointerCount >= 2) {
          fallbackIsDragging = false
        }
      }

      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        fallbackIsDragging = false
      }
    }
    return true
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
    // Prefer reference-derived bear-only mask so forest/ground/background never bleed into 3D UV.
    // Fallback to full-page mask only if reference mask extraction fails.
    val fullMask = getReferenceSubjectMask(outputSize) ?: BooleanArray(outputSize * outputSize) { true }
    fullPageSubjectMaskBySize[outputSize] = fullMask
    return fullMask
  }

  /** Returns true when a reference-image pixel is the near-white paper/bear-body color of a
   *  coloring page (not a colored forest/background area). Used to recover areas that the
   *  flood-fill missed (e.g. thin legs or paws). */
  private fun isReferencePageWhiteArea(colorInt: Int): Boolean {
    val hsv = FloatArray(3)
    Color.colorToHSV(colorInt, hsv)
    val red = Color.red(colorInt)
    val green = Color.green(colorInt)
    val blue = Color.blue(colorInt)
    val average = (red + green + blue) / 3
    val chroma = max(red, max(green, blue)) - min(red, min(green, blue))
    // Widened thresholds to include more of the bear body (cream/off-white/light grey)
    return hsv[1] <= REFERENCE_FILL_MAX_SATURATION &&
        hsv[2] >= REFERENCE_FILL_MIN_BRIGHTNESS &&
        chroma <= REFERENCE_FILL_MAX_CHROMA &&
        average >= REFERENCE_FILL_MIN_AVERAGE_RGB
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
      var originalSubmeshMaterials: MutableList<Material>,
      var originalRenderableMaterial: Material?,
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

  data class ScannerAudioEntry(
      val language: String,
      val level: String,
      val audioName: String,
      val audioUrl: String,
  )

  data class TextureStats(
      val signature: Int,
      val gridColors: IntArray,
      val coloredCellCount: Int,
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
    // GPU raw sampling + CPU classification had coordinate/color mismatch issues.
    // CPU pipeline (CameraColorSampler + sanitizeSampledTexture) produces proven-correct colors.
    // Performance is acceptable with optimized intervals (5-12ms per frame on background thread).
    private const val ENABLE_GPU_TEXTURE_PIPELINE = false
    private const val TEXTURE_SOURCE_CPU_PARITY = "cpu-parity"
    private const val AR_FRAGMENT_TAG = "ar_scanner_fragment"
    const val EXTRA_REFERENCE_IMAGE_ASSET = "referenceImageAsset"
    const val EXTRA_MODEL_ASSET = "modelAsset"
    const val EXTRA_MODEL_FILE_PATH = "modelFilePath"
    const val EXTRA_REFERENCE_IMAGE_FILE_PATH = "referenceImageFilePath"
    private const val DEFAULT_MODEL_ASSET = "bear.glb"
    private val PREFERRED_ANIMATION_NAME_HINTS =
        listOf(
            "idle",
            "walk",
            "run",
            "breath",
            "breathe",
            "loop",
            "anim",
            "action",
            "take",
            "mixamo",
        )
    private const val MIN_ANIMATION_DURATION_SEC = 0.08f
    private const val FRAME_PROCESS_INTERVAL_MS = 50L           // ~20fps texture processing, rendering stays at 60fps
    private const val COLOR_REFRESH_INTERVAL_MS = 55L           // was 80 → faster live color response
    private const val TEXTURE_REFRESH_INTERVAL_MS = 55L         // was 80 → faster texture updates
    private const val TEXTURE_REFRESH_INTERVAL_MS_RELIEF = 200L // was 300 → less noticeable slowdown in relief
    private const val MIN_TEXTURE_APPLY_INTERVAL_MS = 70L       // was 100 → faster texture application
    private const val MIN_TEXTURE_APPLY_INTERVAL_MS_RELIEF = 280L // was 400
    private const val FORCE_TEXTURE_MATERIAL_REFRESH_MS = 280L  // was 400 → quicker forced refresh
    private const val TEXTURE_HOLD_AFTER_SAMPLE_MISS_MS = 12000L  // was 10000 → hold texture longer when page not visible
    private const val DELTA_COLORED_THRESHOLD_SQ = 450   // was 800 (~28 RGB) → now ~21 RGB; detects lighter crayon strokes
    // Minimum color saturation/chroma for a pixel to be considered "user colored" even when
    // it differs from the reference. Prevents lighting/shadow artifacts from being treated as coloring.
    private const val MIN_DRAWING_SATURATION_WITH_REF = 0.04f  // was 0.06 → detect lighter/pastel crayon colors
    private const val MIN_DRAWING_CHROMA_WITH_REF = 8          // was 12 → detect subtle blue/green strokes
    private const val MIN_COLORED_PIXELS_FOR_TEXTURE = 3
    private const val TEXTURE_ONLY_WARMUP_MS = 120L  // was 200 → faster initial texture apply
    private const val TRACKING_GRACE_PERIOD_MS = 5000L
    // Grace period before transitioning to non-AR fallback view (shorter = more responsive)
    private const val FALLBACK_GRACE_PERIOD_MS = 400L
    // Fallback mode: distance of background plane from camera (must cover entire FOV)
    private const val FALLBACK_BG_DISTANCE = 12f
    // Fallback mode: distance of 3D model from camera
    private const val FALLBACK_MODEL_DISTANCE = 0.80f
    // Fallback mode: virtual size of the model in fallback view (meters)
    private const val FALLBACK_MODEL_VIEW_SIZE = 0.18f
    // If tracked image position jumps more than ~15cm, assume different physical sheet
    private const val SHEET_SWITCH_DISTANCE_SQ = 0.0225f  // 0.15m squared
    private const val ANCHOR_SMOOTHING_ALPHA = 0.22f             // was 0.35 → smoother position lerp (less jitter)
    private const val ANCHOR_JITTER_THRESHOLD_SQ = 0.0000008f   // was 0.000002 → ~0.9mm threshold (tighter deadzone)
    private const val ANCHOR_ROTATION_SMOOTHING_ALPHA = 0.18f   // was 0.30 → smoother rotation (less wobble)
    private const val ANCHOR_ROTATION_JITTER_THRESHOLD = 0.0004f // was 0.0008 → tighter rotation deadzone
    private const val PAGE_FIT_RATIO = 0.22f
    private const val PAGE_MODEL_OFFSET_X_RATIO = 0.0f
    private const val PAGE_MODEL_OFFSET_Z_RATIO = -0.08f
    private const val DEFAULT_MODEL_UNIT_SIZE = 1f
    private const val DEFAULT_MODEL_HEIGHT_UNITS = 1f
    private const val BASE_MODEL_PITCH_DEGREES = 0f
    private const val BASE_MODEL_ROLL_DEGREES = 0f
    private const val DEFAULT_USER_YAW_DEGREES = 0f
    private const val SURFACE_LIFT_EPSILON = 0.0015f
    private const val MIN_MODEL_SCALE = 0.02f
    private const val MAX_MODEL_SCALE = 0.25f
    private const val DIRECTIONAL_LIGHT_INTENSITY = 1800f  // was 1400 → brighter sun, better shadows
    private const val FILL_LIGHT_KEY_INTENSITY = 1500f    // was 1200 → brighter key light
    private const val FILL_LIGHT_BACK_INTENSITY = 1100f   // was 900 → reduce dark backside
    private const val FILL_LIGHT_SIDE_INTENSITY = 850f    // was 680 → more even side lighting
    private const val FILL_LIGHT_RADIUS = 3.2f            // was 2.8 → wider light coverage
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
    private const val SINGLE_FINGER_ROTATION_SENSITIVITY = 0.35f  // degrees per pixel of horizontal drag
    private const val SINGLE_FINGER_ROTATION_MIN_PX = 3f          // minimum drag distance to trigger rotation
    private const val MIN_COLORING_SATURATION = 0.025f  // was 0.03 → detect more subtle coloring
    private const val MIN_COLORING_BRIGHTNESS = 0.04f   // was 0.05 → accept slightly darker strokes
    private const val TINT_SMOOTHING_ALPHA = 0.60f   // was 0.78 → smoother color transitions (less jumpy)
    private const val MIN_TINT_DELTA = 0.018f        // was 0.025 → more responsive to subtle color changes
    private const val BASE_EMISSIVE_BOOST = 0.42f             // was 0.35 → colors glow slightly more on model
    private const val EXTRA_EMISSIVE_BOOST_DARK_SCENES = 0.65f // was 0.55 → better in dark environments
    private const val MAX_EMISSIVE_VALUE = 1.55f               // was 1.40 → allow more vivid emission
    private const val COLOR_HOLD_ON_NOISE_MS = 500L      // was 700 → faster recovery from noise
    private const val MIN_MATERIAL_REBUILD_INTERVAL_MS = 120L // was 180 → faster material rebuilds
    private const val ANIMATION_PLAYBACK_SPEED = 0.72f
    private const val MIN_SURFACE_OFFSET_RATIO = 0.02f
    private const val MAX_SURFACE_OFFSET_RATIO = 0.34f
    private const val MIN_SURFACE_OFFSET_METERS = 0.001f
    private const val MAX_SURFACE_OFFSET_METERS = 0.060f
    private const val SURFACE_CONTACT_BIAS_METERS = 0.003f
    private const val PAGE_COLOR_SAMPLE_CENTER_Z_RATIO = 0.0f
    private const val PAGE_TEXTURE_SAMPLE_SIZE_PX = 88    // small for fast CPU processing
    private const val PAGE_TEXTURE_SAMPLE_SIZE_PX_RELIEF = 64
    private const val PAGE_QUAD_INSET_RATIO = 0.030f
    private const val PAGE_TEXTURE_SAMPLE_PADDING_RATIO = 0.015f
    private const val SUBJECT_SAMPLE_POINT_KEEP_RATIO = 0.55f
    private const val SUBJECT_TEXTURE_POINT_KEEP_RATIO = 0.92f
    private const val SUBJECT_TEXTURE_MIN_SAMPLE_POINTS = 20
    private const val SUBJECT_TEXTURE_INSET_RATIO_X = 0.03f
    private const val SUBJECT_TEXTURE_INSET_RATIO_Y = 0.04f
    // Do not shrink the subject mask; erosion was clipping head/legs and causing white patches.
    private const val SUBJECT_MASK_EROSION_RADIUS_PX = 0
    private const val TEXTURE_BLEND_ALPHA = 0.88f  // was 0.72 → 88% new frame, much sharper colors (less blur from old frames)
    // Increased so vivid sketch colors are not wrongly rejected as skin
    private const val SKIN_REJECT_MIN_DELTA = 55
    private const val HAND_OCCLUSION_SKIN_RATIO = 0.05f  // 5% skin pixels → reject entire frame (hand on page)
    private const val MIN_PENDING_SAMPLE_STREAK = 1
    private const val MIN_ACCEPTED_COLOR_SWITCH_DELTA = 28
    private const val PENDING_COLOR_MATCH_DELTA = 18
    private const val MIN_PENDING_TEXTURE_STREAK = 1
    private const val MIN_PENDING_TEXTURE_STREAK_LOCAL = 1
    private const val PENDING_TEXTURE_MATCH_DELTA = 14
    private const val MAX_TEXTURE_SPIKE_DELTA = 240     // was 200 → only reject very extreme spikes
    private const val MAX_TEXTURE_SPIKE_WINDOW_MS = 400L // was 600 → shorter spike detection window
    private const val MAX_TEXTURE_COLORED_CELL_DROP = 5
    private const val WHITE_FLASH_REJECT_CHANGE_RATIO = 0.30f
    private const val GPU_AFTER_CPU_PARITY_HOLD_MS = 800L  // was 1100 → faster GPU recovery after CPU parity
    private const val GPU_AFTER_CPU_PARITY_MAX_CHANGED_RATIO = 0.22f
    private const val GPU_AFTER_CPU_PARITY_MAX_COLORED_DROP = 2
    private const val GPU_AFTER_CPU_PARITY_MAX_SIGNATURE_DELTA = 34
    // Very high — texture updates are NOT blocked during active drawing
    private const val HAND_OCCLUSION_CHANGE_RATIO = 0.95f
    private const val HAND_OCCLUSION_MIN_DELTA = 200
    private const val LOCAL_SKETCH_MAX_CHANGE_RATIO = 0.45f
    private const val GRID_CELL_CHANGE_DELTA = 34
    private const val TEXTURE_STATS_GRID = 8  // was 6 → finer grid for better color change detection
    private const val ENABLE_MODEL_ANIMATION = true
    private const val ENABLE_SOLID_TINT_FALLBACK = false
    private const val HIGH_FRAME_WORK_DURATION_MS = 14L    // aggressive — enter relief quickly to keep rendering smooth
    private const val PERFORMANCE_RELIEF_WINDOW_MS = 800L  // longer relief = more time for smooth rendering
    private const val CENTER_TEXTURE_FALLBACK_WIDTH_RATIO = 0.22f
    private const val CENTER_TEXTURE_FALLBACK_HEIGHT_RATIO = 0.18f
    private const val MIN_TEXTURE_SIGNATURE_DELTA = 3  // was 4 → detect smaller color changes faster
    private const val MATERIAL_BINDING_BASE_COLOR = 0
    private const val MATERIAL_BINDING_SCENEFORM_TEXTURE = 1
    private const val MATERIAL_BINDING_BASE_COLOR_MAP = 2
    private const val MATERIAL_BINDING_BASE_COLOR_TEXTURE_NAME = 3
    private const val MATERIAL_BINDING_ALBEDO = 4
    private const val REFERENCE_MASK_TARGET_WIDTH_PX = 512
    private const val REFERENCE_SUBJECT_MAX_SATURATION = 0.15f
    private const val REFERENCE_SUBJECT_MIN_BRIGHTNESS = 0.80f
    private const val REFERENCE_SUBJECT_MAX_BRIGHTNESS = 1.0f
    private const val REFERENCE_SUBJECT_MAX_CHROMA = 45
    private const val REFERENCE_SUBJECT_MIN_AVERAGE_RGB = 185
    // Fill thresholds for the uncolored bear body — allows cream/off-white.
    // Sandy ground (sat≈0.41), green trees (sat≈0.56), sky (sat≈0.45) still fail.
    private const val REFERENCE_FILL_MIN_BRIGHTNESS = 0.68f
    private const val REFERENCE_FILL_MAX_BRIGHTNESS = 1.0f
    private const val REFERENCE_FILL_MAX_SATURATION = 0.25f
    private const val REFERENCE_FILL_MAX_CHROMA = 55
    private const val REFERENCE_FILL_MIN_AVERAGE_RGB = 155
    private const val MIN_SUBJECT_MASK_PIXELS = 600
    private const val MIN_FULL_PAGE_SUBJECT_COVERAGE_RATIO = 0.08f
    private const val SUBJECT_COMPONENT_MAX_AREA_RATIO = 0.70f
    private const val SUBJECT_COMPONENT_TARGET_AREA_RATIO = 0.22f
    private const val SUBJECT_COMPONENT_TARGET_BBOX_FILL_RATIO = 0.50f
    private const val SUBJECT_COMPONENT_CENTER_WEIGHT = 1.45f
    private const val SUBJECT_COMPONENT_AREA_WEIGHT = 2.0f
    private const val SUBJECT_COMPONENT_COMPACTNESS_WEIGHT = 0.85f
    private const val SUBJECT_COMPONENT_BORDER_PENALTY = 0.55f
    private const val PAGE_QUAD_MAX_MOTION_PX = 18.0f       // was 14 → allow slightly more motion (less rejected frames)
    private const val PAGE_QUAD_MAX_SPEED_PX_PER_MS = 0.24f  // was 0.18 → allow faster hand movement
    private const val MIN_STABLE_PAGE_QUAD_STREAK = 1
    private const val MIN_TRACKED_PAGE_AREA_PX = 4200f
    private const val MIN_TRACKED_PAGE_EDGE_PX = 34f
    private const val MAX_TRACKED_PAGE_EDGE_RATIO = 3.9f
    private const val MIN_PIXEL_COLOR_CONSENSUS = 1
    private const val MAX_PIXEL_COLOR_CONSENSUS = 3
    private const val MAX_FRAME_OCCLUSION_RATIO = 0.55f
    private const val OCCLUSION_PREVIOUS_DELTA_THRESHOLD_SQ = 2200
    private const val OCCLUSION_REFERENCE_DELTA_THRESHOLD_SQ = 2600
    private const val MIN_DRAWING_SATURATION = 0.035f  // was 0.05 → detect lighter pastel crayon marks
    private const val MIN_DRAWING_VALUE = 0.12f        // was 0.15 → allow slightly darker crayon strokes
    private const val MIN_DRAWING_CHROMA = 7           // was 10 → detect subtle blue/green crayon
    private const val MAX_REFERENCE_HUE_SHIFT_DEGREES = 8f
    private const val MAX_REFERENCE_SAT_SHIFT = 0.08f
    private const val MAX_REFERENCE_VALUE_SHIFT = 0.10f
    private const val USE_DIRECT_SUBJECT_TEXTURE = true
    // Phase 4: White balance
    private const val WHITE_BALANCE_UPDATE_INTERVAL_MS = 350L  // was 500 → more responsive to lighting changes
    private const val WHITE_BALANCE_SAMPLE_COUNT = 24         // was 16 → more samples = more stable balance
    private const val WHITE_BALANCE_MAX_GAIN = 1.25f
    private const val WHITE_BALANCE_MIN_GAIN = 0.80f
    // Phase 5: Telemetry
    private const val TELEMETRY_REPORT_INTERVAL_MS = 10_000L
    private const val FRAME_BUDGET_MS = 16L
    private const val MAX_BITMAP_POOL_SIZE = 8
    private const val MAX_CONSECUTIVE_GL_ERRORS = 5
    private val SUBJECT_MASK_SEED_POINTS =
        listOf(
            // Head / face area (top-right of bear on most coloring pages)
            0.62f to 0.30f,  // head top
            0.65f to 0.35f,  // head center
            0.68f to 0.38f,  // snout/face
            0.60f to 0.28f,  // ear area
            0.58f to 0.32f,  // forehead
            // Upper body / neck
            0.55f to 0.35f,  // neck
            0.50f to 0.38f,  // upper back
            0.50f to 0.40f,  // upper body
            // Center body
            0.48f to 0.48f,  // center body left
            0.52f to 0.48f,  // center body right
            0.50f to 0.52f,  // center body
            0.46f to 0.55f,  // belly left
            0.54f to 0.55f,  // belly right
            // Lower body
            0.44f to 0.60f,  // left mid-body
            0.56f to 0.60f,  // right mid-body
            0.50f to 0.65f,  // lower center body
            0.48f to 0.70f,  // lower body
            // Legs
            0.38f to 0.75f,  // front left leg
            0.42f to 0.78f,  // front left leg lower
            0.58f to 0.75f,  // front right leg
            0.62f to 0.78f,  // front right leg lower
            0.35f to 0.65f,  // rear left leg
            0.65f to 0.65f,  // rear right leg
            // Tail area (top-left)
            0.35f to 0.35f,  // tail/rump
            0.38f to 0.40f,  // rump
            // Extra coverage for mirrored/flipped orientations
            0.35f to 0.30f,  // head if bear faces left
            0.38f to 0.35f,  // head if bear faces left
            0.32f to 0.38f,  // snout if bear faces left
        )
    private val DEFAULT_TINT_FALLBACK_COLOR = android.graphics.Color.parseColor("#EDEDED")
    private val DEFAULT_NEUTRAL_BEAR_COLOR = android.graphics.Color.parseColor("#F2F2EE")
  }
}
