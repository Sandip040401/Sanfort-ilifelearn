package com.sanfortsmartlearning.ar

import android.app.Dialog
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.Window
import android.view.WindowManager
import android.widget.*
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ImageView
import android.widget.SeekBar
import android.widget.ImageButton
import android.widget.Button
import android.widget.ScrollView
import android.widget.Space
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.TrackingState
import com.google.ar.sceneform.AnchorNode
import com.google.ar.sceneform.Node
import com.google.ar.sceneform.Scene
import com.google.ar.sceneform.animation.ModelAnimator
import com.google.ar.sceneform.collision.Box
import com.google.ar.sceneform.math.Quaternion
import com.google.ar.sceneform.math.Vector3
import com.google.ar.sceneform.rendering.Color as SfColor
import com.google.ar.sceneform.rendering.Light
import com.google.ar.sceneform.rendering.Material
import com.google.ar.sceneform.rendering.MaterialFactory
import com.google.ar.sceneform.rendering.ModelRenderable
import com.google.ar.sceneform.rendering.RenderableInstance
import com.google.ar.sceneform.rendering.Texture
import com.google.ar.sceneform.ux.*
import org.json.JSONArray
import kotlin.math.abs
import kotlin.math.tan

// ---------------------------------------------------------------------------
//  Simple data holders (no Gson / Moshi dependency)
// ---------------------------------------------------------------------------
data class AudioEntry(
        val gridfsId: String,
        val language: String,
        val level: String,
        val audioUrl: String
)

data class AnimationEntry(
    val index: Int,
    val name: String,
    val duration: Float,
)

class ARActivity : AppCompatActivity() {

    private lateinit var arFragment: ARFloorTrackingFragment
    private var modelPath: String? = null
    private var originalModelPath: String? = null
    private var modelName: String? = null

    // Audio list passed from RN
    private var allAudios: List<AudioEntry> = emptyList()
    private var selectedLanguage: String? = null
    private var selectedLevel: String? = null

    // Animation names passed from RN (JS fallback if Sceneform reports 0)
    private var jsAnimations: List<String> = emptyList()

    // Scene state
    private var activeAnchorNode: AnchorNode? = null
    private var activeTransformNode: TransformableNode? = null
    private var isModelLoading = false
    private var currentRenderable: ModelRenderable? = null
    private var preloadedRenderableTemplate: ModelRenderable? = null
    private var isRenderablePreloadInFlight = false
    private var currentInstance: RenderableInstance? = null
    private var currentAnimIndex = 0
    private var showRealTexture = true
    private var hideColorMode = false
    private var flatColorMaterial: Material? = null
    private var flatColorTexture: Texture? = null
    private var flatTextureBuildInFlight = false
    private var materialSnapshot: MaterialSnapshot? = null
    private var paintedRenderableTemplate: ModelRenderable? = null
    private var realRenderableTemplate: ModelRenderable? = null
    private var renderableSwapInFlight = false
    private var lastMaxDimension: Float = 0f

    // Ordering constants (matching ModelViewer.tsx)
    private val LANGUAGE_ORDER =
            listOf(
                    "English (India)",
                    "English (US)",
                    "English (UK)",
                    "Hindi",
                    "Marathi",
                    "Malayalam",
                    "Punjabi",
                    "Guajarati",
                    "Telegu",
                    "Kannada",
                    "Tamil",
                    "Odia",
                    "Bengali"
            )
    private val LEVEL_ORDER = listOf("basic", "intermediate", "advance", "advanced")

    private var selectedAnimationName: String = "Select Animation"

    // Custom Types handling
    private var modelType: String? = null
    private data class PartEntry(val id: String, val name: String, val url: String, val audioUrl: String?)
    private var modelParts: List<PartEntry> = emptyList()
    private var currentPartId: String? = null
    private val activeAnimators = mutableListOf<android.animation.ObjectAnimator>()

    // Audio list from models
    private var allAnimations: List<AnimationEntry> = emptyList()

    // Audio (MediaPlayer)
    private var mediaPlayer: MediaPlayer? = null
    private var isAudioPlaying = false

    // drawer state
    private var isDrawerOpen = false
    private var currentTab = "Audio" // "Audio", "Animation"
    private var isGestureEnabled = true
    private var audioDialog: Dialog? = null
    private var animationDialog: Dialog? = null
    private var audioDialogRoot: LinearLayout? = null
    private var animationDialogRoot: LinearLayout? = null

    // UI refs
    private lateinit var rootLayout: FrameLayout
    private lateinit var drawerLayout: LinearLayout
    private lateinit var drawerContent: LinearLayout
    private lateinit var bottomBar: LinearLayout
    private lateinit var headerBar: LinearLayout
    private lateinit var tabContainer: LinearLayout
    private lateinit var animPill: FrameLayout
    private lateinit var audioPill: FrameLayout
    private var safeAreaTop = 0
    private var autoPlacementListenerAttached = false
    private var lastAutoPlacementAttemptTimeMs = 0L
    private var moveTouchListenerAttached = false
    private var activeMovePointerId = MotionEvent.INVALID_POINTER_ID
    private var isManualMoveArmed = false
    private var isManualMoveInProgress = false
    private var dragStartX = 0f
    private var dragStartY = 0f
    private var lastDragHitResult: HitResult? = null

    // Floor scanning overlay
    private var scanningOverlay: LinearLayout? = null
    private var scanningDot: View? = null
    private var firstPlaneDetectedTimeMs = 0L
    private val minScanDisplayTimeMs = 1800L  // Show grid for at least 1.8s before auto-placing
    private val autoPlacementListener = Scene.OnUpdateListener {
        attemptAutoPlacementOnFloor()
    }
    private val modelMoveTouchListener = Scene.OnPeekTouchListener { _, motionEvent ->
        handleManualMoveTouch(motionEvent)
    }
    private data class AutoPlacementCandidate(
            val hitResult: HitResult,
            val score: Float,
    )
    private val autoPlacementSamplePoints =
            listOf(
                    Pair(0.50f, 0.50f),
                    Pair(0.50f, 0.44f),
                    Pair(0.50f, 0.56f),
                    Pair(0.42f, 0.50f),
                    Pair(0.58f, 0.50f),
                    Pair(0.36f, 0.56f),
                    Pair(0.64f, 0.56f),
            )
    private val autoPlacementMinDistanceMeters = 0.45f
    private val autoPlacementMaxDistanceMeters = 2.8f
    private val autoPlacementMinUpAlignment = 0.70f
    private val minTargetModelLongestSideMeters = 0.16f
    private val maxTargetModelLongestSideMeters = 0.55f
    private val targetScreenFillRatio = 0.30f

    private data class MaterialSnapshot(
            val instanceMaterials: List<Material?>,
            val submeshMaterials: List<Material?>,
            val rootMaterial: Material?
    )

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ─────────────────────────────────────────────────────────────────────────
    //  Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        modelPath = intent.getStringExtra("modelPath")
        originalModelPath = intent.getStringExtra("originalModelPath")
        modelName = intent.getStringExtra("modelName") ?: "3D Model"
        modelType = intent.getStringExtra("modelType")
        hideColorMode = intent.getBooleanExtra("hideColorMode", false)

        if (modelType == "multiple-glb" && !modelPath.isNullOrBlank()) {
            try {
                val arr = JSONArray(modelPath)
                val list = mutableListOf<PartEntry>()
                for(i in 0 until arr.length()){
                    val obj = arr.getJSONObject(i)
                    list.add(PartEntry(obj.optString("id"), obj.optString("name"), obj.optString("url"), obj.optString("audioUrl")))
                }
                modelParts = list
                if (modelParts.isNotEmpty()) {
                    currentPartId = modelParts[0].id
                    modelPath = modelParts[0].url
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // For exported custom models, start in kid-painted look and allow switching to real model.
        if (!originalModelPath.isNullOrBlank()) {
            showRealTexture = false
        }
        if (hideColorMode) {
            showRealTexture = true
        }

        // Parse audio list from JSON
        intent.getStringExtra("audiosJson")?.let { json ->
            try {
                val arr = JSONArray(json)
                allAudios =
                        (0 until arr.length()).map { i ->
                            val o = arr.getJSONObject(i)
                            AudioEntry(
                                    gridfsId = o.optString("gridfsId"),
                                    language = o.optString("language"),
                                    level = o.optString("level"),
                                    audioUrl = o.optString("audioUrl")
                            )
                        }
                // Default selection (following order)
                val rawLangs = allAudios.map { it.language }.distinct()
                if (rawLangs.isNotEmpty()) {
                    val langs =
                            rawLangs.sortedWith { a, b ->
                                val idxA =
                                        LANGUAGE_ORDER.indexOfFirst {
                                            it.equals(a, ignoreCase = true)
                                        }
                                val idxB =
                                        LANGUAGE_ORDER.indexOfFirst {
                                            it.equals(b, ignoreCase = true)
                                        }
                                when {
                                    idxA != -1 && idxB != -1 -> idxA.compareTo(idxB)
                                    idxA != -1 -> -1
                                    idxB != -1 -> 1
                                    else -> a.compareTo(b, ignoreCase = true)
                                }
                            }
                    selectedLanguage = langs[0]

                    val rawLevels =
                            allAudios
                                    .filter { it.language == selectedLanguage }
                                    .map { it.level }
                                    .distinct()
                    if (rawLevels.isNotEmpty()) {
                        val levels =
                                rawLevels.sortedWith { a, b ->
                                    val idxA =
                                            LEVEL_ORDER.indexOfFirst {
                                                it.equals(a, ignoreCase = true)
                                            }
                                    val idxB =
                                            LEVEL_ORDER.indexOfFirst {
                                                it.equals(b, ignoreCase = true)
                                            }
                                    when {
                                        idxA != -1 && idxB != -1 -> idxA.compareTo(idxB)
                                        idxA != -1 -> -1
                                        idxB != -1 -> 1
                                        else -> a.compareTo(b, ignoreCase = true)
                                    }
                                }
                        selectedLevel = levels[0]
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Parse JS animation names (fallback)
        intent.getStringExtra("animationsJson")?.let { json ->
            try {
                val arr = JSONArray(json)
                jsAnimations = (0 until arr.length()).map { i -> arr.getString(i) }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Build AR root layout
        rootLayout = FrameLayout(this)
        rootLayout.id = View.generateViewId()
        setContentView(rootLayout)

        arFragment = ARFloorTrackingFragment()
        supportFragmentManager.beginTransaction().replace(rootLayout.id, arFragment).commitNow()

        // Configure Lighting for Sceneform Maintained (Filament)
        rootLayout.post {
            val sceneView = arFragment.arSceneView ?: return@post

            try {
                val scene = sceneView.scene

                // 1. Primary Directional Light (The Sun)
                val sun =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(100000f)
                                .setColor(SfColor(1.0f, 1.0f, 1.0f))
                                .setShadowCastingEnabled(false)
                                .build()
                val sunNode = Node()
                sunNode.light = sun
                sunNode.setParent(scene)
                sunNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 1.0f, 0.0f), -45f)

                // Disable shadow receiving on the floor right from the start
                arFragment.arSceneView.planeRenderer.isShadowReceiver = false

                // 2. Top Light (Sky Fill)
                val skyLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(50000f)
                                .setColor(SfColor(1.0f, 1.0f, 1.0f))
                                .build()
                val skyNode = Node()
                skyNode.light = skyLight
                skyNode.setParent(scene)
                skyNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 0.0f, 0.0f), -90f)

                // 3. Bottom Light (Ground Fill)
                val groundLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(50000f)
                                .setColor(SfColor(1.0f, 1.0f, 1.0f))
                                .build()
                val groundNode = Node()
                groundNode.light = groundLight
                groundNode.setParent(scene)
                groundNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 0.0f, 0.0f), 90f)

                // 4. Back rim light for depth separation
                val rimLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(30000f)
                                .setColor(SfColor(1.0f, 1.0f, 1.0f))
                                .build()
                val rimNode = Node()
                rimNode.light = rimLight
                rimNode.setParent(scene)
                rimNode.localRotation = Quaternion.axisAngle(Vector3(-0.3f, 1.0f, -0.8f), 135f)

                // 5. Set exposure and dynamic resolution
                sceneView.renderer?.let { renderer ->
                    // Use a safer way to set dynamic resolution if previous way failed
                    try {
                        renderer.setDynamicResolutionEnabled(true)
                    } catch (e: Exception) {}
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        ARActivityHolder.activity = this

        // Setup Safe Area handling
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { _, insets ->
            val safeInsets =
                    insets.getInsets(
                            WindowInsetsCompat.Type.statusBars() or
                                    WindowInsetsCompat.Type.displayCutout()
                    )
            safeAreaTop = safeInsets.top
            updateHeaderPadding()
            insets
        }

        // Set status bar icons to white (Light contents)
        WindowCompat.getInsetsController(window, rootLayout).isAppearanceLightStatusBars = false

        // All overlay views go into DecorView — renders ABOVE the SurfaceView
        val decor = window.decorView as FrameLayout
        buildPillHeader(decor)
        buildBottomBar(decor)
        buildLogo(decor)
        // Separate modals are now Dialog based, requested by user
        // buildDrawer(decor) -- Removed shared drawer

        buildScanningOverlay(decor)

        setupTapListener()
        attachManualMoveTouchListener()
        preloadModelRenderable()
        rootLayout.post {
            attachAutoPlacementListener()
            attachManualMoveTouchListener()
            // Make plane renderer visible so floor grid is clear during scanning
            try {
                arFragment.arSceneView?.planeRenderer?.let { renderer ->
                    renderer.isVisible = true
                    renderer.isEnabled = true
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        prepareAudio()
    }

    private fun updateHeaderPadding() {
        if (!::headerBar.isInitialized) return
        val landscape = isLandscape()
        val topPad = if (landscape) dp(15) else (safeAreaTop + dp(8))
        val sidePad = if (landscape) dp(15) else dp(16)
        headerBar.setPadding(sidePad, topPad, sidePad, dp(8))
    }

    private fun isLandscape() = resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
    private fun isTablet() = resources.configuration.smallestScreenWidthDp >= 600

    override fun onPause() {
        super.onPause()
        arFragment.arSceneView.pause()
        if (isAudioPlaying) mediaPlayer?.pause()
    }

    override fun onResume() {
        super.onResume()
        arFragment.arSceneView.resume()
        if (isAudioPlaying) mediaPlayer?.start()
        if (preloadedRenderableTemplate == null && !isRenderablePreloadInFlight) {
            preloadModelRenderable()
        }
        rootLayout.post {
            attachAutoPlacementListener()
            attachManualMoveTouchListener()
        }
    }

    override fun onDestroy() {
        detachAutoPlacementListener()
        detachManualMoveTouchListener()
        super.onDestroy()
        ARActivityHolder.activity = null
        preloadedRenderableTemplate = null
        mediaPlayer?.release()
        mediaPlayer = null
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  UI
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildPillHeader(parent: FrameLayout) {
        headerBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        updateHeaderPadding()

        ViewCompat.setOnApplyWindowInsetsListener(headerBar) { _, insets ->
            val safeInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout())
            safeAreaTop = safeInsets.top
            updateHeaderPadding()
            insets
        }

        refreshHeaderContent()
        parent.addView(headerBar, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun refreshHeaderContent() {
        if (!::headerBar.isInitialized) return
        headerBar.removeAllViews()
        val landscape = isLandscape()
        val btnPadH = if (landscape) dp(14) else dp(12)
        val btnPadV = if (landscape) dp(8) else dp(8)
        val textSize = if (landscape) 16f else 18f
        val nameTextSize = if (landscape) 13f else 15f

        // 1. Exit Pill
        val exitPill = FrameLayout(this).apply {
            background = pillDrawable("#55000000")
            setPadding(btnPadH, btnPadV, btnPadH, btnPadV)
            setOnClickListener { finish() }
            addView(TextView(this@ARActivity).apply {
                text = "✕"; setTextColor(Color.WHITE); setTextSize(TypedValue.COMPLEX_UNIT_SP, textSize)
            })
        }
        headerBar.addView(exitPill)

        headerBar.addView(Space(this).apply { layoutParams = LinearLayout.LayoutParams(0, 0, 1f) })

        // 2. Name Pill
        val namePill = FrameLayout(this).apply {
            background = pillDrawable("#88000000")
            setPadding(dp(16), btnPadV, dp(16), btnPadV)
            addView(TextView(this@ARActivity).apply {
                text = modelName; setTextColor(Color.WHITE); setTypeface(null, Typeface.BOLD)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, nameTextSize)
            })
        }
        headerBar.addView(namePill)

        headerBar.addView(Space(this).apply { layoutParams = LinearLayout.LayoutParams(0, 0, 1f) })

        // 3. Instruction Pill
        val instructionPill = FrameLayout(this).apply {
            background = pillDrawable("#55000000")
            setPadding(btnPadH, btnPadV, btnPadH, btnPadV)
            setOnClickListener { showInstructions() }
            addView(TextView(this@ARActivity).apply {
                text = "ⓘ"; setTextColor(Color.WHITE); setTextSize(TypedValue.COMPLEX_UNIT_SP, textSize)
            })
        }
        headerBar.addView(instructionPill)
    }



    private fun buildBottomBar(parent: FrameLayout) {
        bottomBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#99000000"))
                cornerRadius = dp(30).toFloat()
            }
        }
        refreshBottomBarContent()

        val lp = FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.START
            setMargins(dp(20), 0, 0, dp(20))
        }
        parent.addView(bottomBar, lp)
    }

    private fun buildLogo(parent: FrameLayout) {
        val landscape = isLandscape()
        val logo = ImageView(this).apply {
            tag = "company_logo"
            setImageResource(resources.getIdentifier("sanfort_logo", "drawable", packageName))
            
            // Reduced size for portrait to be more consistent with landscape
            val w = if (landscape) 110 else 125
            val h = if (landscape) 55 else 60
            
            layoutParams = FrameLayout.LayoutParams(dp(w), dp(h)).apply {
                gravity = Gravity.BOTTOM or Gravity.END
                val margin = if (landscape) dp(4) else dp(10)
                val bottom = if (landscape) dp(12) else dp(10)
                setMargins(0, 0, margin, bottom)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        parent.addView(logo)
    }

    private fun buildScanningOverlay(parent: FrameLayout) {
        val overlay = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            tag = "scanning_overlay"
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#CC000000"))
                cornerRadius = dp(25).toFloat()
            }
            setPadding(dp(20), dp(12), dp(20), dp(12))

            // Pulsing dot indicator
            val dot = View(this@ARActivity).apply {
                val size = dp(10)
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    rightMargin = dp(10)
                }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#00E5CC"))
                }
                val pulseAnim = android.animation.ObjectAnimator.ofFloat(this, "alpha", 1f, 0.3f, 1f)
                pulseAnim.duration = 1200
                pulseAnim.repeatCount = android.animation.ValueAnimator.INFINITE
                pulseAnim.start()
            }
            scanningDot = dot
            addView(dot)

            // Text container
            val textContainer = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.VERTICAL

                addView(TextView(this@ARActivity).apply {
                    text = "Scanning floor..."
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setTypeface(null, Typeface.BOLD)
                })

                addView(TextView(this@ARActivity).apply {
                    text = "Move your phone slowly"
                    setTextColor(Color.parseColor("#AAFFFFFF"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    val params = LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT)
                    params.topMargin = dp(2)
                    layoutParams = params
                })
            }
            addView(textContainer)
        }

        val lp = FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            bottomMargin = dp(90)
        }
        parent.addView(overlay, lp)
        scanningOverlay = overlay
    }

    private fun hideScanningOverlay() {
        scanningOverlay?.let { overlay ->
            overlay.animate()
                .alpha(0f)
                .setDuration(400)
                .withEndAction {
                    overlay.visibility = View.GONE
                }
                .start()
        }
    }

    private fun refreshBottomBarContent() {
        if (!::bottomBar.isInitialized) return
        bottomBar.removeAllViews()
        val landscape = isLandscape()
        val btnPadH = if (landscape) dp(22) else dp(20)
        val btnPadV = if (landscape) dp(12) else dp(10)
        val labelSize = if (landscape) 15f else 13f

        // Animation Pill
        val animBtn = FrameLayout(this).apply {
            val p = if (landscape) dp(8) else dp(11)
            setPadding(p, p, p, p)
            setOnClickListener { showAnimationModal() }
            
            val inner = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                
                // Animation Icon (Running Person)
                addView(ImageView(this@ARActivity).apply {
                    val resId = resources.getIdentifier("ic_anim_run", "drawable", packageName)
                    if (resId != 0) setImageResource(resId) else setImageResource(android.R.drawable.ic_menu_slideshow)
                    setColorFilter(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(if (landscape) dp(32) else dp(26), if (landscape) dp(32) else dp(26))
                })
                
                if (landscape) {
                    addView(TextView(this@ARActivity).apply { 
                        text = " Animation"; setTextColor(Color.WHITE); setTypeface(null, Typeface.BOLD)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, labelSize); setPadding(dp(8), 0, 0, 0)
                    })
                }
            }
            addView(inner)
        }

        if (landscape) {
            val divider = View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(1), dp(16)).apply { setMargins(dp(10), 0, dp(10), 0) }
                setBackgroundColor(Color.parseColor("#44FFFFFF"))
            }
            bottomBar.addView(animBtn)
            bottomBar.addView(divider)
        } else {
            bottomBar.addView(animBtn)
            bottomBar.addView(Space(this).apply { layoutParams = LinearLayout.LayoutParams(dp(10), 0) })
        }

        // Audio Pill
        val audioBtn = FrameLayout(this).apply {
            val p = if (landscape) dp(8) else dp(11)
            setPadding(p, p, p, p)
            setOnClickListener { showAudioModal() }
            
            // Highlight if audio is playing
            if (isAudioPlaying) {
                background = pillDrawable("#00C096")
            }

            val inner = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                
                // Custom Audio Volume Icon
                addView(ImageView(this@ARActivity).apply {
                    val resId = resources.getIdentifier("ic_audio_volume", "drawable", packageName)
                    if (resId != 0) setImageResource(resId) else setImageResource(android.R.drawable.ic_lock_silent_mode_off)
                    setColorFilter(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(if (landscape) dp(32) else dp(26), if (landscape) dp(32) else dp(26))
                })
                
                if (landscape) {
                    addView(TextView(this@ARActivity).apply { 
                        text = " Audio"; setTextColor(Color.WHITE); setTypeface(null, Typeface.BOLD)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, labelSize); setPadding(dp(8), 0, 0, 0)
                    })
                }
            }
            addView(inner)
        }

        bottomBar.addView(audioBtn)

        if (modelType != "multiple-glb" && modelType != "multiple-animation-execution") {
            if (landscape) {
                bottomBar.addView(View(this).apply {
                    layoutParams = LinearLayout.LayoutParams(dp(1), dp(16)).apply {
                        setMargins(dp(10), 0, dp(10), 0)
                    }
                    setBackgroundColor(Color.parseColor("#44FFFFFF"))
                })
            } else {
                bottomBar.addView(Space(this).apply {
                    layoutParams = LinearLayout.LayoutParams(dp(10), 0)
                })
            }
        }

        if (!hideColorMode && !originalModelPath.isNullOrBlank()) {
            val textureBtn = FrameLayout(this).apply {
                val p = if (landscape) dp(8) else dp(10)
                setPadding(p, p, p, p)
                background = pillDrawable(if (showRealTexture) "#0EA5A4" else "#6C4CFF")
                setOnClickListener { toggleTextureMode() }
                contentDescription = if (showRealTexture) "Switch to color mode" else "Switch to real texture"

                addView(LinearLayout(this@ARActivity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    addView(TextView(this@ARActivity).apply {
                        text = if (landscape) {
                            if (showRealTexture) "Color Fun" else "Real Look"
                        } else {
                            if (showRealTexture) "Color" else "Real"
                        }
                        setTextColor(Color.WHITE)
                        setTypeface(null, Typeface.BOLD)
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, if (landscape) labelSize else 11f)
                    })
                })
            }
            bottomBar.addView(textureBtn)
        }
    }

    private fun toggleTextureMode() {
        if (activeTransformNode == null || currentRenderable == null) {
            Toast.makeText(this, "Tap on surface to place model first", Toast.LENGTH_SHORT).show()
            return
        }
        setRealTextureEnabled(!showRealTexture)
    }

    private fun setRealTextureEnabled(enabled: Boolean) {
        showRealTexture = enabled
        if (!originalModelPath.isNullOrBlank()) {
            swapRenderableForMode(enabled)
            refreshBottomBarContent()
            return
        }
        if (enabled) {
            applyRealTextureMaterials()
        } else {
            applyFlatColorMaterials()
        }
        refreshBottomBarContent()
    }

    private fun swapRenderableForMode(showReal: Boolean) {
        val node = activeTransformNode ?: return
        val cachedTemplate = if (showReal) realRenderableTemplate else paintedRenderableTemplate
        if (cachedTemplate != null) {
            applyRenderableTemplate(node, cachedTemplate)
            return
        }

        val targetPath = if (showReal) originalModelPath else modelPath
        if (targetPath.isNullOrBlank() || renderableSwapInFlight) {
            return
        }

        renderableSwapInFlight = true
        ModelRenderable.builder()
                .setSource(this, Uri.parse(targetPath))
                .setIsFilamentGltf(true)
                .setAsyncLoadEnabled(true)
                .build()
                .thenAccept { loaded ->
                    runOnUiThread {
                        renderableSwapInFlight = false
                        for (i in 0 until loaded.submeshCount) {
                            runCatching { loaded.getMaterial(i).setFloat("reflectance", 0.4f) }
                        }
                        if (showReal) {
                            realRenderableTemplate = runCatching { loaded.makeCopy() }.getOrNull() ?: loaded
                        } else {
                            paintedRenderableTemplate = runCatching { loaded.makeCopy() }.getOrNull() ?: loaded
                        }
                        if (showRealTexture != showReal) {
                            return@runOnUiThread
                        }
                        applyRenderableTemplate(node, loaded)
                    }
                }
                .exceptionally {
                    runOnUiThread {
                        renderableSwapInFlight = false
                        Toast.makeText(this, "Could not switch look. Try again.", Toast.LENGTH_SHORT).show()
                    }
                    null
                }
    }

    private fun applyRenderableTemplate(node: TransformableNode, sourceRenderable: ModelRenderable) {
        val renderable = runCatching { sourceRenderable.makeCopy() }.getOrNull() ?: sourceRenderable
        runCatching { node.renderable = renderable }
        ensureStableCollisionShape(node, renderable)
        currentRenderable = renderable
        currentInstance = node.renderableInstance
        
        // Update allAnimations for the new instance
        val instance = currentInstance
        val count = instance?.animationCount ?: 0
        if (count > 0) {
            allAnimations = (0 until count).map { i ->
                val anim = instance!!.getAnimation(i)
                AnimationEntry(
                        i,
                        anim.name.takeIf { it.isNotBlank() } ?: "Anim ${i + 1}",
                        anim.duration
                )
            }
        }
        
        cacheMaterialSnapshot(renderable, currentInstance)
        reapplyTransform(node, renderable)
        restartCurrentAnimation()
    }

    private fun reapplyTransform(node: TransformableNode, renderable: ModelRenderable) {
        val collisionShape = resolveRenderableCollisionBox(renderable)
        val size = collisionShape.size
        val maxDim = maxOf(size.x, maxOf(size.y, size.z)).coerceAtLeast(0.01f)

        // Adjust scale if units/size changed significantly between models
        if (lastMaxDimension > 0f && abs(maxDim - lastMaxDimension) > 0.01f) {
            val ratio = lastMaxDimension / maxDim
            val oldScale = node.localScale
            node.localScale = Vector3(oldScale.x * ratio, oldScale.y * ratio, oldScale.z * ratio)
        }
        lastMaxDimension = maxDim

        // Re-apply grounding (Y offset) based on the new renderable size and current scale
        val currentScale = node.localScale.x
        val centerOffset = collisionShape?.center?.y ?: 0f
        val yOffset = (size.y / 2f - centerOffset) * currentScale
        
        val currentPos = node.localPosition
        node.localPosition = Vector3(currentPos.x, yOffset, currentPos.z)
    }

    private fun resolveRenderableCollisionBox(renderable: ModelRenderable): Box {
        val sourceBox = renderable.collisionShape as? Box
        val rawSize = sourceBox?.size

        val baseX = sanitizeCollisionAxis(rawSize?.x)
        val baseY = sanitizeCollisionAxis(rawSize?.y)
        val baseZ = sanitizeCollisionAxis(rawSize?.z)
        val maxDim = maxOf(baseX, maxOf(baseY, baseZ)).coerceAtLeast(0.12f)
        val minAxis = (maxDim * 0.12f).coerceAtLeast(0.08f)

        val size = Vector3(
                baseX.coerceAtLeast(minAxis),
                baseY.coerceAtLeast(minAxis),
                baseZ.coerceAtLeast(minAxis)
        )
        val center = sourceBox?.center?.let(::sanitizeCollisionCenter) ?: Vector3.zero()
        return Box(size, center)
    }

    private fun sanitizeCollisionAxis(value: Float?): Float {
        if (value == null || !value.isFinite()) {
            return 1f
        }
        return abs(value).coerceAtLeast(0.001f)
    }

    private fun sanitizeCollisionCenter(center: Vector3): Vector3 {
        return Vector3(
                center.x.takeIf { it.isFinite() } ?: 0f,
                center.y.takeIf { it.isFinite() } ?: 0f,
                center.z.takeIf { it.isFinite() } ?: 0f
        )
    }

    private fun ensureStableCollisionShape(node: Node, renderable: ModelRenderable): Box {
        val collisionBox = resolveRenderableCollisionBox(renderable)
        node.collisionShape = collisionBox.makeCopy()
        return collisionBox
    }

    private fun cacheMaterialSnapshot(renderable: ModelRenderable, instance: RenderableInstance?) {
        val instanceCount = instance?.materialsCount ?: 0
        val instanceMaterials = MutableList<Material?>(instanceCount) { null }
        for (i in 0 until instanceCount) {
            // No need to copy again if we're just storing the original state
            instanceMaterials[i] = runCatching { instance?.getMaterial(i)?.makeCopy() }.getOrNull()
        }

        val submeshCount = renderable.submeshCount
        val submeshMaterials = MutableList<Material?>(submeshCount) { null }
        for (i in 0 until submeshCount) {
            submeshMaterials[i] = runCatching { renderable.getMaterial(i).makeCopy() }.getOrNull()
        }

        val rootMaterial = runCatching { renderable.material.makeCopy() }.getOrNull()
        materialSnapshot = MaterialSnapshot(
                instanceMaterials = instanceMaterials,
                submeshMaterials = submeshMaterials,
                rootMaterial = rootMaterial
        )
    }

    private fun applyRealTextureMaterials() {
        val node = activeTransformNode ?: return

        val templateCopy = runCatching { paintedRenderableTemplate?.makeCopy() }.getOrNull()
        if (templateCopy != null) {
            runCatching { node.renderable = templateCopy }
            ensureStableCollisionShape(node, templateCopy)
            currentRenderable = templateCopy
            currentInstance = node.renderableInstance
            cacheMaterialSnapshot(templateCopy, currentInstance)
            reapplyTransform(node, templateCopy)
            restartCurrentAnimation()
            return
        }

        val renderable = currentRenderable ?: return
        val instance = currentInstance
        val snapshot = materialSnapshot ?: return

        val instanceCount = instance?.materialsCount ?: 0
        for (i in 0 until instanceCount) {
            val original = snapshot.instanceMaterials.getOrNull(i) ?: continue
            // We can reuse the original material if we don't plan to modify it further here
            runCatching { instance?.setMaterial(i, original) }
        }

        val submeshCount = renderable.submeshCount
        for (i in 0 until submeshCount) {
            val original = snapshot.submeshMaterials.getOrNull(i) ?: continue
            runCatching { renderable.setMaterial(i, original) }
        }

        snapshot.rootMaterial?.let { root ->
            runCatching { renderable.material = root }
        }
        runCatching { node.renderable = renderable }
        ensureStableCollisionShape(node, renderable)
        currentInstance = node.renderableInstance
        reapplyTransform(node, renderable)
        restartCurrentAnimation()
    }

    private fun applyFlatColorMaterials() {
        val renderable = currentRenderable ?: return
        val instance = currentInstance

        val baseMaterial = flatColorMaterial
        val solidTexture = flatColorTexture
        if (baseMaterial != null && solidTexture != null) {
            val applyWith = { targetMaterial: Material ->
                val sharedMat = targetMaterial.makeCopy()
                configureFlatMaterial(sharedMat, solidTexture)
                
                val submeshCount = renderable.submeshCount
                for (i in 0 until submeshCount) {
                    runCatching { renderable.setMaterial(i, sharedMat) }
                }

                val instanceCount = instance?.materialsCount ?: 0
                for (i in 0 until instanceCount) {
                    runCatching { instance?.setMaterial(i, sharedMat) }
                }

                runCatching { renderable.material = sharedMat }
                runCatching { activeTransformNode?.renderable = renderable }
                activeTransformNode?.let { ensureStableCollisionShape(it, renderable) }
                currentInstance = activeTransformNode?.renderableInstance ?: currentInstance
                activeTransformNode?.let { reapplyTransform(it, renderable) }
                restartCurrentAnimation()
            }
            applyWith(baseMaterial)
            return
        }

        if (flatColorMaterial == null) {
            MaterialFactory.makeOpaqueWithColor(this, SfColor(0.96f, 0.95f, 1f))
                    .thenAccept { generated ->
                        runOnUiThread {
                            flatColorMaterial = generated
                            if (!showRealTexture) {
                                applyFlatColorMaterials()
                            }
                        }
                    }
                    .exceptionally { null }
        }

        if (flatColorTexture == null) {
            buildFlatTextureAsync()
        }
    }

    private fun buildFlatTextureAsync() {
        if (flatTextureBuildInFlight) return
        flatTextureBuildInFlight = true

        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.parseColor("#FFF4F4F6"))
        }

        Texture.builder()
                .setSource(bitmap)
                .build()
                .thenAccept { texture ->
                    runOnUiThread {
                        flatTextureBuildInFlight = false
                        flatColorTexture = texture
                        if (!showRealTexture) {
                            applyFlatColorMaterials()
                        }
                    }
                }
                .exceptionally {
                    runOnUiThread { flatTextureBuildInFlight = false }
                    null
                }
    }

    private fun configureFlatMaterial(material: Material, texture: Texture) {
        runCatching { applyTextureToMaterialCompat(material, texture) }
        runCatching { material.setFloat4(MaterialFactory.MATERIAL_COLOR, 1f, 1f, 1f, 1f) }
        runCatching { material.setFloat4("baseColorTint", 1f, 1f, 1f, 1f) }
        runCatching { material.setFloat4("baseColorFactor", 1f, 1f, 1f, 1f) }
        runCatching { material.setFloat("reflectance", 0.05f) }
        runCatching { material.setFloat(MaterialFactory.MATERIAL_METALLIC, 0f) }
        runCatching { material.setFloat(MaterialFactory.MATERIAL_ROUGHNESS, 0.95f) }
    }

    private fun applyTextureToMaterialCompat(material: Material, texture: Texture): Boolean {
        val attempts = listOf<() -> Unit>(
                { material.setBaseColorTexture(texture) },
                { material.setTexture(MaterialFactory.MATERIAL_TEXTURE, texture) },
                { material.setTexture("baseColorMap", texture) },
                { material.setTexture("baseColorTexture", texture) },
                { material.setTexture("albedo", texture) }
        )
        attempts.forEach { apply ->
            if (runCatching { apply(); true }.getOrDefault(false)) {
                return true
            }
        }
        return false
    }



    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        updateHeaderPadding()
        refreshHeaderContent()
        refreshBottomBarContent()
        
        // Refresh Logo (re-layout for size)
        val decor = window.decorView as FrameLayout
        for (i in 0 until decor.childCount) {
            val v = decor.getChildAt(i)
            if (v is ImageView && v.tag == "company_logo") {
                decor.removeView(v)
                break
            }
        }
        buildLogo(decor)

        if (::bottomBar.isInitialized) {
            bottomBar.layoutParams = (bottomBar.layoutParams as FrameLayout.LayoutParams).apply {
                val margin = dp(20)
                setMargins(margin, 0, 0, margin)
            }
        }
    }

    private fun showInstructions() {
        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(24), dp(24), dp(24))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#EE1A1A1A"))
                cornerRadius = dp(24).toFloat()
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            
            // Title
            addView(TextView(this@ARActivity).apply {
                text = "How to use AR"
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                setTypeface(null, Typeface.BOLD)
                setPadding(0, 0, 0, dp(16))
            })
            
            val steps = if (hideColorMode) {
                listOf(
                    "1. Move phone to find a flat surface.",
                    "2. Tap on white dots to place the model.",
                    "3. One finger to move, two to rotate/scale.",
                    "4. Use bottom bar for Audio and Animations."
                )
            } else {
                listOf(
                    "1. Move phone to find a flat surface.",
                    "2. Tap on white dots to place the model.",
                    "3. One finger to move, two to rotate/scale.",
                    "4. Use bottom bar for Audio and Animations.",
                    "5. Toggle Real Texture / Color from bottom controls."
                )
            }
            
            steps.forEach { step ->
                addView(TextView(this@ARActivity).apply {
                    text = step
                    setTextColor(Color.parseColor("#E0E0E0"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    setPadding(0, dp(4), 0, dp(4))
                })
            }
            
            // Got it button
            addView(TextView(this@ARActivity).apply {
                text = "Got it"
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(dp(20), dp(12), dp(20), dp(12))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#6C4CFF"))
                    cornerRadius = dp(12).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                    topMargin = dp(24)
                }
                setOnClickListener { dialog.dismiss() }
            })
        }
        
        dialog.setContentView(content)
        dialog.window?.let { window ->
            window.setLayout((resources.displayMetrics.widthPixels * 0.85).toInt(), WRAP_CONTENT)
            window.setBackgroundDrawableResource(android.R.color.transparent)
            val params = window.attributes
            params.windowAnimations = android.R.style.Animation_Dialog // Basic fade
            window.attributes = params
        }
        dialog.show()
    }

    private fun showAudioModal() {
        animationDialog?.dismiss() // Ensure only one at a time
        
        if (audioDialog?.isShowing == true && audioDialogRoot != null) {
            populateAudioModalContent(audioDialogRoot!!)
            return
        }

        val dialog = Dialog(this)
        audioDialog = dialog
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(30))
            background = roundedRectDrawable("#F2141828", dp(24))
        }
        audioDialogRoot = root
        populateAudioModalContent(root)
        
        dialog.setContentView(root)
        styleDialog(dialog)
        dialog.show()
    }

    private fun populateAudioModalContent(root: LinearLayout) {
        root.removeAllViews()
        val landscape = isLandscape()
        val titleSize = if (landscape) 16f else 18f
        
        // Title Row with Close Button
        val titleBar = LinearLayout(this@ARActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(15))
        }

        titleBar.addView(TextView(this@ARActivity).apply {
            text = "Audio Settings"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, titleSize)
            setTypeface(null, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
        })

        titleBar.addView(ImageButton(this@ARActivity).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener { audioDialog?.dismiss() }
        })

        root.addView(titleBar)

        if (activeAnchorNode != null) {
            val scroll = ScrollView(this@ARActivity)
            val inner = LinearLayout(this@ARActivity).apply { orientation = LinearLayout.VERTICAL }
            
            // Level
            inner.addView(createLabel("Level"))
            val levels = getDistinctOrderedLevels()
            inner.addView(createSpinnerPill(levels, selectedLevel ?: "Select Level") {
                selectedLevel = it
                reloadAudio()
                showAudioModal() // Refresh
            })

            // Language
            inner.addView(createLabel("Language"))
            val langs = getDistinctOrderedLangs()
            inner.addView(createSpinnerPill(langs, selectedLanguage ?: "Select Language") {
                selectedLanguage = it
                selectedLevel = getDistinctOrderedLevels().firstOrNull() ?: ""
                reloadAudio()
                showAudioModal() // Refresh
            })

            // Audio controls
            val audioRow = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                background = roundedRectDrawable("#22FFFFFF", dp(16))
                setPadding(dp(12), dp(12), dp(12), dp(12))
            }
            val playBtn = ImageButton(this@ARActivity).apply {
                background = roundedRectDrawable("#00C096", dp(8))
                setImageResource(if (isAudioPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play)
                setColorFilter(Color.WHITE)
                setOnClickListener {
                    toggleAudio()
                    showAudioModal() // Refresh UI
                }
            }
            audioRow.addView(playBtn, LinearLayout.LayoutParams(dp(44), dp(44)))
            
            audioRow.addView(ImageView(this@ARActivity).apply {
                setImageResource(android.R.drawable.ic_lock_silent_mode_off)
                setColorFilter(Color.GRAY)
                setPadding(dp(12), 0, dp(8), 0)
            })

            val volumeBar = SeekBar(this@ARActivity).apply {
                layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                progress = 100
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(p0: SeekBar?, p1: Int, p2: Boolean) {
                        val vol = p1 / 100f
                        mediaPlayer?.setVolume(vol, vol)
                    }
                    override fun onStartTrackingTouch(p0: SeekBar?) {}
                    override fun onStopTrackingTouch(p0: SeekBar?) {}
                })
            }
            audioRow.addView(volumeBar)
            inner.addView(audioRow, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { 
                setMargins(0, dp(20), 0, 0)
            })

            scroll.addView(inner)
            root.addView(scroll)
        } else {
            root.addView(TextView(this@ARActivity).apply {
                text = "Tap on surface to place model first"
                setTextColor(Color.GRAY)
                setPadding(0, dp(20), 0, 0)
                gravity = Gravity.CENTER
            })
        }
    }

    private fun showAnimationModal() {
        audioDialog?.dismiss() // Ensure only one at a time
        
        if (animationDialog?.isShowing == true && animationDialogRoot != null) {
            populateAnimationModalContent(animationDialogRoot!!)
            return
        }

        val dialog = Dialog(this)
        animationDialog = dialog
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(30))
            background = roundedRectDrawable("#F2141828", dp(24))
        }
        animationDialogRoot = root
        populateAnimationModalContent(root)

        dialog.setContentView(root)
        styleDialog(dialog)
        dialog.show()
    }

    private fun populateAnimationModalContent(root: LinearLayout) {
        root.removeAllViews()
        val landscape = isLandscape()
        val titleSize = if (landscape) 16f else 18f
        
        // Title Row with Close Button
        val titleBar = LinearLayout(this@ARActivity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(15))
        }

        titleBar.addView(TextView(this@ARActivity).apply {
            text = "Animations"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, titleSize)
            setTypeface(null, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
        })

        titleBar.addView(ImageButton(this@ARActivity).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(Color.WHITE)
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener { animationDialog?.dismiss() }
        })

        root.addView(titleBar)

        if (activeAnchorNode != null) {
            val scroll = ScrollView(this@ARActivity)
            val inner = LinearLayout(this@ARActivity).apply { orientation = LinearLayout.VERTICAL }

            if (modelType == "multiple-glb" && modelParts.isNotEmpty()) {
                inner.addView(createLabel("Change Part"))
                val partNames = modelParts.map { it.name }
                val currentPartName = modelParts.find { it.id == currentPartId }?.name ?: partNames[0]
                inner.addView(createSpinnerPill(partNames, currentPartName) { name ->
                    val selectedPart = modelParts.find { it.name == name }
                    if (selectedPart != null && selectedPart.id != currentPartId) {
                        currentPartId = selectedPart.id
                        modelPath = selectedPart.url
                        reloadModelForPart()
                    }
                })
            } else {
                inner.addView(createToggleRow("Gesture Mode", isGestureEnabled) { enabled ->
                    isGestureEnabled = enabled
                    activeTransformNode?.let { node ->
                        node.translationController.isEnabled = false
                        node.rotationController.isEnabled = enabled
                        node.scaleController.isEnabled = enabled
                    }
                })

                if (allAnimations.size > 1 && modelType != "multiple-animation-execution") {
                    inner.addView(createLabel("Change Animation"))
                    val animNames = allAnimations.map { it.name }
                    inner.addView(createSpinnerPill(animNames, selectedAnimationName) { name ->
                        allAnimations
                            .firstOrNull { it.name == name }
                            ?.let { selected ->
                                selectedAnimationName = selected.name
                                playAnimation(selected)
                            }
                    })
                }

                val isPaused = activeAnimators.isNotEmpty() && activeAnimators.all { it.isPaused }
                inner.addView(Button(this@ARActivity).apply {
                    text = if (isPaused) "Resume Animation" else "Pause Animation"
                    background = roundedRectDrawable(if (isPaused) "#00C096" else "#FF4B4B", dp(12))
                    setTextColor(Color.WHITE)
                    setOnClickListener {
                        activeAnimators.forEach {
                            if (it.isPaused) it.resume() else it.pause()
                        }
                        showAnimationModal()
                    }
                }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { 
                    setMargins(0, dp(16), 0, 0)
                })
            }

            scroll.addView(inner)
            root.addView(scroll)
        } else {
            root.addView(TextView(this@ARActivity).apply {
                text = "Tap on surface to place model first"
                setTextColor(Color.GRAY)
                setPadding(0, dp(20), 0, 0)
                gravity = Gravity.CENTER
            })
        }
    }



    private fun styleDialog(dialog: Dialog) {
        val landscape = isLandscape()
        val tablet = isTablet()
        dialog.window?.let { window ->
            val screenW = resources.displayMetrics.widthPixels
            // Constraints width and gravity for Side-Docking in landscape or tablet
            val w = if (landscape || tablet) 
                dp(340).coerceAtMost((screenW * 0.45).toInt()) 
            else 
                (screenW * 0.9).toInt()
                
            window.setLayout(w, WRAP_CONTENT)
            window.setBackgroundDrawableResource(android.R.color.transparent)
            val params = window.attributes
            
            if (landscape || tablet) {
                params.gravity = Gravity.BOTTOM or Gravity.START
                params.x = dp(20) // Floating from left edge
                params.y = dp(100) // Floating 100dp from bottom edge (above the bottom bar)
            } else {
                params.gravity = Gravity.BOTTOM
                params.x = 0
                params.y = dp(20)
            }
            window.attributes = params
        }
    }



    private fun updateRotation(rx: Float, ry: Float, rz: Float) {
        activeTransformNode?.let { node ->
            val current = node.localRotation
            val axis = Quaternion.eulerAngles(Vector3(rx, ry, rz))
            node.localRotation = Quaternion.multiply(current, axis)
        }
    }

    private fun pillDrawable(color: String) =
            GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(100).toFloat()
                setColor(Color.parseColor(color))
            }

    private fun roundedRectDrawable(color: String, rad: Int) =
            GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = rad.toFloat()
                setColor(Color.parseColor(color))
            }

    private fun createLabel(txt: String) =
            TextView(this).apply {
                text = txt
                setTextColor(Color.GRAY)
                val textSize = if (isLandscape()) 11f else 12f
                setTextSize(TypedValue.COMPLEX_UNIT_SP, textSize)
                setPadding(0, dp(8), 0, dp(4))
            }

    private fun createSpinnerPill(
            options: List<String>,
            selected: String,
            onSelect: (String) -> Unit
    ): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = roundedRectDrawable("#33FFFFFF", dp(12))
            setPadding(dp(16), dp(12), dp(16), dp(12))
            gravity = Gravity.CENTER_VERTICAL
            setOnClickListener {
                val popup = PopupMenu(this@ARActivity, it)
                options.forEach { popup.menu.add(it) }
                popup.setOnMenuItemClickListener { item ->
                    onSelect(item.title.toString())
                    true
                }
                popup.show()
            }

            addView(
                    TextView(this@ARActivity).apply {
                        text = selected
                        setTextColor(Color.WHITE)
                        layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                    }
            )
            addView(
                    TextView(this@ARActivity).apply {
                        text = "▼"
                        setTextColor(Color.GRAY)
                    }
            )
        }
    }

    private fun createToggleRow(
            label: String,
            initial: Boolean,
            onToggle: (Boolean) -> Unit
    ): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, dp(8))
            addView(
                    TextView(this@ARActivity).apply {
                        text = label
                        setTextColor(Color.WHITE)
                        layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                    }
            )
            addView(
                    Switch(this@ARActivity).apply {
                        isChecked = initial
                        setOnCheckedChangeListener { _, b -> onToggle(b) }
                    }
            )
        }
    }

    private fun createAxisSlider(label: String, onVal: (Float) -> Unit): LinearLayout {
        val row =
                LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }
        row.addView(
                TextView(this).apply {
                    text = label
                    setTextColor(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(dp(60), WRAP_CONTENT)
                }
        )
        row.addView(
                SeekBar(this).apply {
                    max = 100
                    progress = 50
                    layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                    setOnSeekBarChangeListener(
                            object : SeekBar.OnSeekBarChangeListener {
                                var last = 50
                                override fun onProgressChanged(p0: SeekBar?, p1: Int, p2: Boolean) {
                                    val diff = (p1 - last).toFloat()
                                    onVal(diff * 2f)
                                    last = p1
                                }
                                override fun onStartTrackingTouch(p0: SeekBar?) {}
                                override fun onStopTrackingTouch(p0: SeekBar?) {}
                            }
                    )
                }
        )
        return row
    }

    private fun getDistinctOrderedLevels(): List<String> {
        val raw =
                allAudios
                        .filter { it.language == selectedLanguage }
                        .map { it.level }
                        .distinct()
                        .filterNotNull()
        return raw.sortedWith { a, b ->
            val idxA = LEVEL_ORDER.indexOfFirst { it.equals(a, ignoreCase = true) }
            val idxB = LEVEL_ORDER.indexOfFirst { it.equals(b, ignoreCase = true) }
            idxA.compareTo(idxB)
        }
    }

    private fun getDistinctOrderedLangs(): List<String> {
        val raw = allAudios.map { it.language }.distinct().filterNotNull()
        return raw.sortedWith { a, b ->
            val idxA = LANGUAGE_ORDER.indexOfFirst { it.equals(a, ignoreCase = true) }
            val idxB = LANGUAGE_ORDER.indexOfFirst { it.equals(b, ignoreCase = true) }
            idxA.compareTo(idxB)
        }
    }

    private fun setupTapListener() {
        arFragment.setOnTapArPlaneListener { hitResult, _, _ ->
            if (isModelLoading) return@setOnTapArPlaneListener

            if (activeAnchorNode != null) {
                val newAnchor = hitResult.createAnchor()
                activeAnchorNode?.anchor?.detach()
                activeAnchorNode?.anchor = newAnchor
                activeTransformNode?.select()
                return@setOnTapArPlaneListener
            }

            loadAndPlaceModel(hitResult)
        }
    }

    private fun attachAutoPlacementListener() {
        if (autoPlacementListenerAttached) {
            return
        }
        val scene = arFragment.arSceneView?.scene ?: return
        scene.addOnUpdateListener(autoPlacementListener)
        autoPlacementListenerAttached = true
    }

    private fun detachAutoPlacementListener() {
        if (!autoPlacementListenerAttached || !::arFragment.isInitialized) {
            return
        }
        arFragment.arSceneView?.scene?.removeOnUpdateListener(autoPlacementListener)
        autoPlacementListenerAttached = false
    }

    private fun attachManualMoveTouchListener() {
        if (moveTouchListenerAttached) {
            return
        }
        val scene = arFragment.arSceneView?.scene ?: return
        scene.addOnPeekTouchListener(modelMoveTouchListener)
        moveTouchListenerAttached = true
    }

    private fun detachManualMoveTouchListener() {
        if (!moveTouchListenerAttached || !::arFragment.isInitialized) {
            return
        }
        arFragment.arSceneView?.scene?.removeOnPeekTouchListener(modelMoveTouchListener)
        moveTouchListenerAttached = false
        resetManualMoveState()
    }

    private fun manualMoveTouchSlopPx(): Float = resources.displayMetrics.density * 12f

    private fun handleManualMoveTouch(motionEvent: MotionEvent): Boolean {
        if (activeTransformNode == null || !isGestureEnabled || isModelLoading) {
            if (motionEvent.actionMasked == MotionEvent.ACTION_UP ||
                            motionEvent.actionMasked == MotionEvent.ACTION_CANCEL
            ) {
                resetManualMoveState()
            }
            return false
        }

        when (motionEvent.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                activeMovePointerId = motionEvent.getPointerId(0)
                dragStartX = motionEvent.x
                dragStartY = motionEvent.y
                isManualMoveArmed = true
                isManualMoveInProgress = false
                lastDragHitResult = null
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                resetManualMoveState()
            }

            MotionEvent.ACTION_MOVE -> {
                if (!isManualMoveArmed || motionEvent.pointerCount != 1) {
                    return false
                }
                val pointerIndex = motionEvent.findPointerIndex(activeMovePointerId)
                if (pointerIndex < 0) {
                    resetManualMoveState()
                    return false
                }

                val x = motionEvent.getX(pointerIndex)
                val y = motionEvent.getY(pointerIndex)
                val dragDistance = maxOf(abs(x - dragStartX), abs(y - dragStartY))
                if (!isManualMoveInProgress && dragDistance < manualMoveTouchSlopPx()) {
                    return false
                }

                val hitResult = findManualMoveHit(x, y) ?: return isManualMoveInProgress
                isManualMoveInProgress = true
                lastDragHitResult = hitResult
                moveModelToHit(hitResult)
                return true
            }

            MotionEvent.ACTION_POINTER_UP -> {
                val pointerId = motionEvent.getPointerId(motionEvent.actionIndex)
                if (pointerId == activeMovePointerId) {
                    return finishManualMove()
                }
            }

            MotionEvent.ACTION_UP -> {
                return finishManualMove()
            }

            MotionEvent.ACTION_CANCEL -> {
                val handled = isManualMoveInProgress
                resetManualMoveState()
                return handled
            }
        }
        return false
    }

    private fun finishManualMove(): Boolean {
        val handled = isManualMoveInProgress
        if (handled) {
            lastDragHitResult?.let { reanchorModelToHit(it) }
        }
        resetManualMoveState()
        return handled
    }

    private fun resetManualMoveState() {
        activeMovePointerId = MotionEvent.INVALID_POINTER_ID
        isManualMoveArmed = false
        isManualMoveInProgress = false
        lastDragHitResult = null
    }

    private fun findManualMoveHit(screenX: Float, screenY: Float): HitResult? {
        val frame = arFragment.arSceneView?.arFrame ?: return null
        frame.hitTest(screenX, screenY).forEach { hit ->
            val plane = hit.trackable as? Plane ?: return@forEach
            if (plane.trackingState != TrackingState.TRACKING || !plane.isPoseInPolygon(hit.hitPose)) {
                return@forEach
            }
            if (plane.type != Plane.Type.HORIZONTAL_UPWARD_FACING) {
                return@forEach
            }
            return hit
        }
        return null
    }

    private fun moveModelToHit(hitResult: HitResult) {
        val node = activeTransformNode ?: return
        val collisionShape = currentRenderable?.let { resolveRenderableCollisionBox(it) } ?: return
        val currentScale = node.localScale.x
        val yOffset = (collisionShape.size.y / 2f - collisionShape.center.y) * currentScale
        val pose = hitResult.hitPose
        node.worldPosition = Vector3(pose.tx(), pose.ty() + yOffset, pose.tz())
    }

    private fun reanchorModelToHit(hitResult: HitResult) {
        val anchorNode = activeAnchorNode ?: return
        val node = activeTransformNode ?: return
        val newAnchor = runCatching { hitResult.createAnchor() }.getOrNull() ?: return
        val collisionShape = currentRenderable?.let { resolveRenderableCollisionBox(it) }
        val currentScale = node.localScale.x
        val yOffset =
                collisionShape?.let { (it.size.y / 2f - it.center.y) * currentScale }
                        ?: node.localPosition.y

        runCatching { anchorNode.anchor?.detach() }
        anchorNode.anchor = newAnchor
        node.localPosition = Vector3(0f, yOffset, 0f)
        node.select()
    }

    private fun attemptAutoPlacementOnFloor() {
        if (!::arFragment.isInitialized || activeAnchorNode != null || isModelLoading) {
            return
        }
        if (preloadedRenderableTemplate == null) {
            preloadModelRenderable()
            return
        }

        val now = SystemClock.elapsedRealtime()
        if (now - lastAutoPlacementAttemptTimeMs < 180L) {
            return
        }
        lastAutoPlacementAttemptTimeMs = now

        val sceneView = arFragment.arSceneView
        val frame = sceneView.arFrame ?: return
        if (frame.camera.trackingState != TrackingState.TRACKING) {
            return
        }

        val width = sceneView.width.toFloat()
        val height = sceneView.height.toFloat()
        if (width <= 0f || height <= 0f) {
            return
        }

        val hitResult = findBestAutoPlacementHit(frame, width, height) ?: return

        // Track when floor was first detected — show grid for a minimum time
        if (firstPlaneDetectedTimeMs == 0L) {
            firstPlaneDetectedTimeMs = now
            // Update overlay text to show floor detected
            runOnUiThread {
                scanningOverlay?.let { overlay ->
                    // Find the text container (second child after the dot)
                    val textContainer = (overlay as ViewGroup).let { vg ->
                        (0 until vg.childCount)
                            .map { vg.getChildAt(it) }
                            .filterIsInstance<LinearLayout>()
                            .firstOrNull()
                    }
                    textContainer?.let { tc ->
                        val textViews = (0 until tc.childCount)
                            .map { tc.getChildAt(it) }
                            .filterIsInstance<TextView>()
                        if (textViews.isNotEmpty()) {
                            textViews[0].text = "Floor detected!"
                            textViews[0].setTextColor(Color.parseColor("#00E5CC"))
                        }
                        if (textViews.size > 1) {
                            textViews[1].text = "Placing 3D model..."
                        }
                    }
                }
            }
        }

        // Wait for minimum scan display time so user sees the grid
        if (now - firstPlaneDetectedTimeMs < minScanDisplayTimeMs) {
            return
        }

        loadAndPlaceModel(hitResult)
    }

    private fun findBestAutoPlacementHit(
            frame: com.google.ar.core.Frame,
            width: Float,
            height: Float,
    ): HitResult? {
        // Keep auto-placement aligned with the visible center reticle.
        // If center has a valid hit, always prefer it to avoid "reticle here, model there".
        val centerOnlyHit =
                findBestAutoPlacementHitForSamples(
                        frame = frame,
                        width = width,
                        height = height,
                        samples = listOf(Pair(0.50f, 0.50f)),
                )
        if (centerOnlyHit != null) {
            return centerOnlyHit
        }

        return findBestAutoPlacementHitForSamples(
                frame = frame,
                width = width,
                height = height,
                samples = autoPlacementSamplePoints,
        )
    }

    private fun findBestAutoPlacementHitForSamples(
            frame: com.google.ar.core.Frame,
            width: Float,
            height: Float,
            samples: List<Pair<Float, Float>>,
    ): HitResult? {
        var bestPlane: AutoPlacementCandidate? = null

        for ((nx, ny) in samples) {
            val screenX = width * nx
            val screenY = height * ny

            frame.hitTest(screenX, screenY).forEach { hit ->
                val distance = hit.distance
                if (distance < autoPlacementMinDistanceMeters || distance > autoPlacementMaxDistanceMeters) {
                    return@forEach
                }
                val centerScore = abs(nx - 0.5f) + abs(ny - 0.5f)
                val closePenalty = if (distance < 0.60f) (0.60f - distance) * 2.3f else 0f

                when (val trackable = hit.trackable) {
                    is Plane -> {
                        if (trackable.trackingState != TrackingState.TRACKING ||
                                        !trackable.isPoseInPolygon(hit.hitPose)
                        ) {
                            return@forEach
                        }
                        if (trackable.type != Plane.Type.HORIZONTAL_UPWARD_FACING) {
                            return@forEach
                        }
                        val planeBias = -0.30f
                        // Prefer closer + center-ish surfaces; table usually wins over far floor.
                        val score = distance + centerScore * 2.5f + closePenalty + planeBias
                        if (bestPlane == null || score < bestPlane!!.score) {
                            bestPlane = AutoPlacementCandidate(hit, score)
                        }
                    }
                }
            }
        }

        // Stable placement only: reject depth/point anchors to prevent model drifting.
        return bestPlane?.hitResult
    }

    private fun getHitUpAlignment(hitResult: HitResult): Float {
        return runCatching {
                    val yAxis = hitResult.hitPose.getYAxis()
                    abs(yAxis.getOrElse(1) { 0f })
                }
                .getOrDefault(0f)
    }

    private fun preloadModelRenderable() {
        if (preloadedRenderableTemplate != null || isRenderablePreloadInFlight) {
            return
        }
        val path = modelPath ?: return
        isRenderablePreloadInFlight = true
        ModelRenderable.builder()
                .setSource(this, buildModelUri(path))
                .setIsFilamentGltf(true)
                .setAsyncLoadEnabled(true)
                .build()
                .thenAccept { renderable ->
                    runOnUiThread {
                        isRenderablePreloadInFlight = false
                        configureRenderableForScene(renderable)
                        preloadedRenderableTemplate = renderable
                    }
                }
                .exceptionally { error ->
                    runOnUiThread {
                        isRenderablePreloadInFlight = false
                        android.util.Log.e("ARActivity", "Model preload failed: $path", error)
                    }
                    null
                }
    }

    private fun configureRenderableForScene(renderable: ModelRenderable) {
        renderable.isShadowCaster = true
        renderable.isShadowReceiver = true
        // Tune material PBR properties for more vivid rendering.
        for (i in 0 until renderable.submeshCount) {
            runCatching {
                val material = renderable.getMaterial(i)
                material.setFloat("reflectance", 0.4f)
            }
        }
    }

    private fun buildModelUri(path: String): Uri {
        val trimmed = path.trim()
        return when {
            trimmed.startsWith("file://") ||
                    trimmed.startsWith("content://") ||
                    trimmed.startsWith("http://") ||
                    trimmed.startsWith("https://") -> Uri.parse(trimmed)
            else -> Uri.fromFile(java.io.File(trimmed))
        }
    }

    private fun resolvePlacementTargetLongestSideMeters(hitResult: HitResult): Float {
        val distanceMeters =
                hitResult.distance
                        .coerceAtLeast(0.25f)
                        .coerceAtMost(autoPlacementMaxDistanceMeters)
        val cameraFovDegrees =
                runCatching { arFragment.arSceneView.scene.camera.verticalFovDegrees }
                        .getOrDefault(60f)
                        .coerceIn(35f, 85f)
        val halfFovRad = Math.toRadians(cameraFovDegrees.toDouble() / 2.0)
        val visibleHeightMeters = (2.0 * distanceMeters.toDouble() * tan(halfFovRad)).toFloat()
        val targetByScreen = visibleHeightMeters * targetScreenFillRatio
        return targetByScreen.coerceIn(minTargetModelLongestSideMeters, maxTargetModelLongestSideMeters)
    }

    private fun resolveModelScaleProfileMultiplier(maxDimension: Float): Float {
        val adaptiveMultiplier =
                when {
                    maxDimension >= 6f -> 2.00f
                    maxDimension >= 3f -> 1.55f
                    maxDimension >= 1.8f -> 1.25f
                    maxDimension >= 0.9f -> 1.00f
                    maxDimension >= 0.35f -> 0.82f
                    else -> 0.62f
                }

        val identifier = (modelName ?: "").trim().lowercase()
        val profileMultiplier =
                when {
                    identifier.contains("elephant") -> 0.56f
                    identifier.contains("bear") -> 0.60f
                    identifier.contains("dolphin") -> 1.70f
                    identifier.contains("apple") -> 1.15f
                    identifier.contains("dog") -> 1.35f
                    identifier.contains("wolf") -> 1.30f
                    identifier.contains("mybody") || identifier.contains("my body") -> 1.35f
                    else -> null
                }

        return profileMultiplier ?: adaptiveMultiplier
    }

    private fun resolveBaseScaleUpperBound(distanceMeters: Float): Float {
        return when {
            distanceMeters <= 0.55f -> 0.18f
            distanceMeters <= 0.85f -> 0.24f
            distanceMeters <= 1.40f -> 0.30f
            else -> 0.36f
        }
    }

    private fun loadAndPlaceModel(hitResult: HitResult) {
        if (isModelLoading) {
            return
        }

        preloadedRenderableTemplate?.let { cached ->
            val renderableForPlacement =
                    runCatching { cached.makeCopy() }.getOrNull() ?: cached
            // makeCopy can succeed but the copy may fail when creating a Filament instance,
            // so wrap placement in try-catch and fall back to a fresh model load.
            try {
                placeModel(hitResult, renderableForPlacement)
            } catch (e: Exception) {
                android.util.Log.w("ARActivity", "Copied renderable failed, loading fresh model", e)
                preloadedRenderableTemplate = null
                loadFreshModel(hitResult)
            }
            return
        }

        if (isRenderablePreloadInFlight) {
            return
        }

        loadFreshModel(hitResult)
    }

    private fun loadFreshModel(hitResult: HitResult) {
        val path = modelPath ?: return
        isModelLoading = true
        ModelRenderable.builder()
                .setSource(this, buildModelUri(path))
                .setIsFilamentGltf(true)
                .setAsyncLoadEnabled(true)
                .build()
                .thenAccept { renderable ->
                    runOnUiThread {
                        isModelLoading = false
                        configureRenderableForScene(renderable)
                        preloadedRenderableTemplate =
                                runCatching { renderable.makeCopy() }.getOrNull()
                        try {
                            placeModel(hitResult, renderable)
                        } catch (e: Exception) {
                            android.util.Log.e("ARActivity", "Fresh renderable also failed", e)
                            android.widget.Toast.makeText(
                                            this,
                                            "Failed to place 3D model",
                                            android.widget.Toast.LENGTH_SHORT
                                    )
                                    .show()
                        }
                    }
                }
                .exceptionally { error ->
                    runOnUiThread {
                        isModelLoading = false
                        android.widget.Toast.makeText(
                                        this,
                                        "Failed to load 3D model",
                                        android.widget.Toast.LENGTH_SHORT
                                )
                                .show()
                    }
                    android.util.Log.e("ARActivity", "Model load failed: $path", error)
                    null
                }
    }

    private fun reloadModelForPart() {
        val path = modelPath ?: return
        isModelLoading = true
        android.util.Log.d("ARActivity", "reloadModelForPart: $path")
        ModelRenderable.builder()
                .setSource(this, buildModelUri(path))
                .setIsFilamentGltf(true)
                .setAsyncLoadEnabled(true)
                .build()
                .thenAccept { renderable ->
                    runOnUiThread {
                        isModelLoading = false
                        configureRenderableForScene(renderable)

                        try {
                            activeTransformNode?.renderable = renderable
                            activeTransformNode?.let { ensureStableCollisionShape(it, renderable) }
                        } catch (e: Exception) {
                            android.util.Log.e("ARActivity", "Failed to set part renderable", e)
                            android.widget.Toast.makeText(this@ARActivity, "Failed to load part", android.widget.Toast.LENGTH_SHORT).show()
                            return@runOnUiThread
                        }
                        currentRenderable = renderable
                        currentInstance = activeTransformNode?.renderableInstance
                        cacheMaterialSnapshot(renderable, currentInstance)

                        if (!showRealTexture) applyFlatColorMaterials()

                        activeTransformNode?.let { reapplyTransform(it, renderable) }

                        val instance = activeTransformNode?.renderableInstance
                        val count = instance?.animationCount ?: 0
                        allAnimations = (0 until count).map { i ->
                            val anim = instance!!.getAnimation(i)
                            AnimationEntry(
                                i,
                                anim.name.takeIf { it.isNotBlank() } ?: "Anim ${i + 1}",
                                anim.duration
                            )
                        }

                        if (allAnimations.isNotEmpty()) playAnimation(allAnimations[0])
                        reloadAudio()
                        refreshBottomBarContent()
                        animationDialog?.dismiss()
                    }
                }
                .exceptionally { error ->
                    runOnUiThread {
                        isModelLoading = false
                        android.util.Log.e("ARActivity", "Part load failed: $path", error)
                        android.widget.Toast.makeText(this@ARActivity, "Failed to load part", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    null
                }
    }

    private fun placeModel(hitResult: com.google.ar.core.HitResult, renderable: ModelRenderable) {
        detachAutoPlacementListener()
        // Hide scanning overlay and AR surface scanning dots once placed for a cleaner view
        hideScanningOverlay()
        arFragment.arSceneView.planeRenderer.setVisible(false)
        runCatching {
            arFragment.instructionsController.setEnabled(
                    InstructionsController.TYPE_PLANE_DISCOVERY,
                    false,
            )
            arFragment.instructionsController.setVisible(
                    InstructionsController.TYPE_PLANE_DISCOVERY,
                    false,
            )
            arFragment.instructionsController.isEnabled = false
        }

        val anchorNode =
                AnchorNode(hitResult.createAnchor()).apply {
                    setParent(arFragment.arSceneView.scene)
                }
        val node =
                TransformableNode(arFragment.transformationSystem).apply {
                    this.renderable = renderable
                    val collisionShape = ensureStableCollisionShape(this, renderable)
                    this.setParent(anchorNode)
                    this.select()

                    // Calculate the model's actual physical dimension
                    val size = collisionShape.size
                    val maxDimension = maxOf(size.x, maxOf(size.y, size.z)).coerceAtLeast(0.01f)
                    val targetLongestSideMeters = resolvePlacementTargetLongestSideMeters(hitResult)
                    val profileMultiplier = resolveModelScaleProfileMultiplier(maxDimension)
                    val adjustedTargetLongestSideMeters =
                            (targetLongestSideMeters * profileMultiplier)
                                    .coerceIn(
                                            minTargetModelLongestSideMeters * 0.75f,
                                            maxTargetModelLongestSideMeters * 1.35f,
                                    )
                    val baseScaleUpperBound = resolveBaseScaleUpperBound(hitResult.distance)

                    // Normalize all assets to a consistent physical size in AR regardless of authoring units.
                    val baseScale =
                            (adjustedTargetLongestSideMeters / maxDimension)
                                    .coerceIn(0.015f, baseScaleUpperBound)
                    val minScale = (baseScale * 0.45f).coerceAtLeast(0.008f)
                    val maxScale =
                            (baseScale * 2.6f)
                                    .coerceAtLeast(baseScale + 0.06f)
                                    .coerceAtMost(baseScaleUpperBound * 2.9f)
                                    .coerceAtLeast(minScale * 1.5f)

                    this.getScaleController()?.setMinScale(minScale)
                    this.getScaleController()?.setMaxScale(maxScale)
                    // Moderate sensitivity for smooth pinch zoom.
                    this.getScaleController()?.setSensitivity(0.35f)
                    // Small elasticity for natural feel at limits
                    this.getScaleController()?.setElasticity(0.05f)
                    this.translationController.isEnabled = false
                    this.rotationController.isEnabled = isGestureEnabled
                    this.scaleController.isEnabled = isGestureEnabled

                    lastMaxDimension = maxDimension
                    this.localScale = Vector3(baseScale, baseScale, baseScale)
                    this.localRotation = Quaternion.identity()

                    // Shift the model so its bottom face sits on the plane
                    // instead of floating (anchor is at ground)
                    val centerOffset = collisionShape.center.y
                    val yOffset = (size.y / 2f - centerOffset) * baseScale
                    this.localPosition = Vector3(0f, yOffset, 0f)
                }

        activeAnchorNode = anchorNode
        activeTransformNode = node
        currentRenderable = renderable
        paintedRenderableTemplate = runCatching { renderable.makeCopy() }.getOrNull() ?: renderable
        if (originalModelPath.isNullOrBlank()) {
            realRenderableTemplate = runCatching { renderable.makeCopy() }.getOrNull() ?: renderable
        }
        currentInstance = node.renderableInstance
        cacheMaterialSnapshot(renderable, currentInstance)
        if (!showRealTexture) {
            applyFlatColorMaterials()
        }

        // Collect animations
        val instance = node.renderableInstance
        val count = instance?.animationCount ?: 0
        allAnimations =
                (0 until count).map { i ->
                    val anim = instance!!.getAnimation(i)
                    AnimationEntry(
                            i,
                            anim.name.takeIf { it.isNotBlank() } ?: "Anim ${i + 1}",
                            anim.duration
                    )
                }

        if (allAnimations.isNotEmpty()) {
            selectedAnimationName = allAnimations[0].name
        }

        var lastSelectTime = 0L
        arFragment.arSceneView.scene.addOnUpdateListener {
            val now = System.currentTimeMillis()
            if (activeTransformNode != null &&
                            !activeTransformNode!!.isSelected &&
                            (now - lastSelectTime > 500)
            ) {
                activeTransformNode!!.select()
                lastSelectTime = now
            }
        }

        // Auto play first animation and audio
        if (allAnimations.isNotEmpty()) playAnimation(allAnimations[0])
        reloadAudio()
        refreshBottomBarContent()
    }

    fun playAnimation(index: Int) {
        if (allAnimations.isNotEmpty()) {
            val safeIdx = index.coerceIn(0, allAnimations.size - 1)
            playAnimation(allAnimations[safeIdx])
        }
    }

    fun playAnimation(anim: AnimationEntry) {
        selectedAnimationName = anim.name
        val instance = currentInstance ?: return
        
        activeAnimators.forEach { it.cancel() }
        activeAnimators.clear()

        if (modelType == "multiple-animation-execution") {
            allAnimations.forEach { a ->
                val animator = ModelAnimator.ofAnimation(instance, a.index)
                animator.apply {
                    repeatCount = android.animation.ValueAnimator.INFINITE
                    duration = (a.duration * 1000f).toLong()
                    startDelay = 0L
                    start()
                }
                activeAnimators.add(animator)
            }
        } else {
            val animator = ModelAnimator.ofAnimation(instance, anim.index)
            animator.apply {
                repeatCount = android.animation.ValueAnimator.INFINITE
                duration = (anim.duration * 1000f).toLong()
                startDelay = 0L
                start()
            }
            activeAnimators.add(animator)
        }
    }

    private fun restartCurrentAnimation() {
        val animEntry = if (modelType == "multiple-animation-execution") {
            allAnimations.getOrNull(0) // Just to trigger the execution block
        } else {
            allAnimations.find { it.name == selectedAnimationName } ?: allAnimations.getOrNull(0)
        }
        
        animEntry?.let { playAnimation(it) }
    }

    private fun sendAnimationList(names: List<String>) {
        if (names.isEmpty()) return
        val arr = Arguments.createArray()
        names.forEach { arr.pushString(it) }
        ARModule.reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onARAnimations", arr)
    }

    private fun sendCurrentAnimationIndex(index: Int) {
        ARModule.reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onARAnimationChanged", index)
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Audio
    // ─────────────────────────────────────────────────────────────────────────

    private fun currentAudioUrl(): String? {
        if (modelType == "multiple-glb") {
            val part = modelParts.firstOrNull { it.id == currentPartId }
            return part?.audioUrl?.ifBlank { null }
        }
        val lang = selectedLanguage ?: return null
        val level = selectedLevel ?: return null
        val entry =
                allAudios.firstOrNull { it.language == lang && it.level == level } ?: return null
        return entry.audioUrl.ifBlank { null }
    }

    private fun prepareAudio() {
        reloadAudio()
    }

    private fun reloadAudio() {
        val url = currentAudioUrl()

        // Stop existing player
        if (isAudioPlaying) {
            mediaPlayer?.pause()
            isAudioPlaying = false
        }
        mediaPlayer?.release()
        mediaPlayer = null

        url ?: return
        try {
            mediaPlayer =
                    MediaPlayer().apply {
                        setDataSource(url)
                        if (modelType == "multiple-animation-execution" || modelType == "multiple-glb") {
                            isLooping = true
                        }
                        prepareAsync()
                        setOnPreparedListener {
                            if (activeAnchorNode != null) {
                                it.start()
                                isAudioPlaying = true
                                refreshBottomBarContent()
                            }
                        }
                        setOnCompletionListener {
                            if (!isLooping) {
                                isAudioPlaying = false
                                refreshBottomBarContent()
                            }
                        }
                    }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun toggleAudio() {
        val player = mediaPlayer ?: run { 
            reloadAudio()
            return
        }
        if (isAudioPlaying) {
            player.pause()
            isAudioPlaying = false
        } else {
            player.start()
            isAudioPlaying = true
        }
        refreshBottomBarContent()
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Widget helpers
    // ─────────────────────────────────────────────────────────────────────────

    private fun makeTextBtn(label: String, onClick: () -> Unit): TextView {
        return TextView(this).apply {
            text = label
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setTypeface(null, Typeface.BOLD)
            setPadding(dp(10), dp(6), dp(10), dp(6))
            setBackgroundColor(Color.parseColor("#556C4CFF"))
            layoutParams =
                    LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.WRAP_CONTENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                            )
                            .apply { marginEnd = dp(8) }
            setOnClickListener { onClick() }
        }
    }

    private fun makeChip(label: String, active: Boolean, onClick: () -> Unit): TextView {
        val bg = if (active) "#DA70D6" else "#446C4CFF"
        return TextView(this).apply {
            text = label
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            setTypeface(null, if (active) Typeface.BOLD else Typeface.NORMAL)
            setPadding(dp(10), dp(5), dp(10), dp(5))
            setBackgroundColor(Color.parseColor(bg))
            layoutParams =
                    LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.WRAP_CONTENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                            )
                            .apply { marginEnd = dp(5) }
            setOnClickListener { onClick() }
        }
    }

    private fun makePlaceholderChip(text: String): TextView {
        return makeChip(text, false) {}.apply { isEnabled = false }
    }
}

fun TransformableNode.animateScaleTo(target: Vector3, durationMs: Long) {
    val animator = android.animation.ObjectAnimator()
    animator.setObjectValues(this.localScale, target)
    animator.setEvaluator { fraction, start, end ->
        Vector3.lerp(start as Vector3, end as Vector3, fraction)
    }
    animator.duration = durationMs
    animator.addUpdateListener { this.localScale = it.animatedValue as Vector3 }
    animator.start()
}
