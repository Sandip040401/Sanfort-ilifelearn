package com.sanfortsmartlearning.ar

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.ar.sceneform.AnchorNode
import com.google.ar.sceneform.Node
import com.google.ar.sceneform.animation.ModelAnimator
import com.google.ar.sceneform.math.Quaternion
import com.google.ar.sceneform.math.Vector3
import com.google.ar.sceneform.rendering.Color as SfColor
import com.google.ar.sceneform.rendering.Light
import com.google.ar.sceneform.rendering.ModelRenderable
import com.google.ar.sceneform.rendering.RenderableInstance
import com.google.ar.sceneform.ux.*
import org.json.JSONArray

// ---------------------------------------------------------------------------
//  Simple data holders (no Gson / Moshi dependency)
// ---------------------------------------------------------------------------
data class AudioEntry(
        val gridfsId: String,
        val language: String,
        val level: String,
        val audioUrl: String
)

data class AnimationEntry(val name: String, val duration: Float)

class ARActivity : AppCompatActivity() {

    private lateinit var arFragment: ArFragment
    private var modelPath: String? = null
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
    private var currentInstance: RenderableInstance? = null
    private var currentAnimIndex = 0

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

    private var activeModelAnimator: android.animation.ObjectAnimator? = null
    private var selectedAnimationName: String = "Select Animation"

    // Audio list from models
    private var allAnimations: List<AnimationEntry> = emptyList()

    // Audio (MediaPlayer)
    private var mediaPlayer: MediaPlayer? = null
    private var isAudioPlaying = false

    // drawer state
    private var isDrawerOpen = false
    private var currentTab = "Audio" // "Audio", "Animation"

    // UI refs
    private lateinit var rootLayout: FrameLayout
    private lateinit var drawerLayout: LinearLayout
    private lateinit var drawerContent: LinearLayout
    private lateinit var headerBar: LinearLayout
    private lateinit var tabContainer: LinearLayout
    private var safeAreaTop = 0

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    // ─────────────────────────────────────────────────────────────────────────
    //  Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        modelPath = intent.getStringExtra("modelPath")
        modelName = intent.getStringExtra("modelName") ?: "3D Model"

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

        arFragment = ArFragment()
        supportFragmentManager.beginTransaction().replace(rootLayout.id, arFragment).commitNow()

        // Configure Lighting for Sceneform Maintained (Filament)
        rootLayout.post {
            val sceneView = arFragment.arSceneView ?: return@post

            try {
                val scene = sceneView.scene

                // 1. Primary Directional Light (The Sun) — balanced warm light
                val sun =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(3500f)
                                .setColor(SfColor(1.0f, 0.97f, 0.93f))
                                .setShadowCastingEnabled(true)
                                .build()
                val sunNode = Node()
                sunNode.light = sun
                sunNode.setParent(scene)
                sunNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 0.8f, 0.3f), -50f)

                // Disable shadow receiving on the floor right from the start
                arFragment.arSceneView.planeRenderer.isShadowReceiver = false

                // 2. Add Ambient Fill Lights to match Three.js
                // Top Light — cool sky fill
                val skyLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(1800f)
                                .setColor(SfColor(0.92f, 0.95f, 1.0f))
                                .build()
                val skyNode = Node()
                skyNode.light = skyLight
                skyNode.setParent(scene)
                skyNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 0.0f, 0.0f), -90f)

                // Bottom Light (fill to avoid pitch-black undersides)
                val groundLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(1000f)
                                .setColor(SfColor(1.0f, 0.98f, 0.95f))
                                .build()
                val groundNode = Node()
                groundNode.light = groundLight
                groundNode.setParent(scene)
                groundNode.localRotation = Quaternion.axisAngle(Vector3(1.0f, 0.0f, 0.0f), 90f)

                // 3. Back rim light for depth separation
                val rimLight =
                        Light.builder(Light.Type.DIRECTIONAL)
                                .setIntensity(600f)
                                .setColor(SfColor(0.98f, 0.96f, 1.0f))
                                .build()
                val rimNode = Node()
                rimNode.light = rimLight
                rimNode.setParent(scene)
                rimNode.localRotation = Quaternion.axisAngle(Vector3(-0.3f, 1.0f, -0.8f), 135f)

                // 4. Set exposure and dynamic resolution
                sceneView.renderer?.let { renderer ->
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
        buildDrawer(decor)

        setupTapListener()
        prepareAudio()
    }

    private fun updateHeaderPadding() {
        if (::headerBar.isInitialized) {
            // Ensure there's enough space for status bar and punch-hole camera
            // Typical status bar is ~24-32dp. We add 16dp extra margin for clarity.
            val topPadding = if (safeAreaTop > 0) safeAreaTop + dp(16) else dp(64)
            headerBar.setPadding(dp(16), topPadding, dp(16), dp(8))
        }
    }

    override fun onPause() {
        super.onPause()
        arFragment.arSceneView.pause()
        if (isAudioPlaying) mediaPlayer?.pause()
    }

    override fun onResume() {
        super.onResume()
        arFragment.arSceneView.resume()
        if (isAudioPlaying) mediaPlayer?.start()
    }

    override fun onDestroy() {
        super.onDestroy()
        ARActivityHolder.activity = null
        mediaPlayer?.release()
        mediaPlayer = null
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  UI
    // ─────────────────────────────────────────────────────────────────────────

    private fun buildPillHeader(parent: FrameLayout) {
        headerBar =
                LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    // Use a safer fallback initially
                    setPadding(dp(16), dp(60), dp(16), dp(8))
                }

        // Handle insets specifically for the headerBar as well
        ViewCompat.setOnApplyWindowInsetsListener(headerBar) { _, insets ->
            val safeInsets =
                    insets.getInsets(
                            WindowInsetsCompat.Type.statusBars() or
                                    WindowInsetsCompat.Type.displayCutout()
                    )
            safeAreaTop = safeInsets.top
            updateHeaderPadding()
            insets
        }

        // 1. Exit Pill
        val exitPill =
                FrameLayout(this).apply {
                    background = pillDrawable("#55000000")
                    setPadding(dp(12), dp(8), dp(12), dp(8))
                    setOnClickListener { finish() }
                    addView(
                            TextView(this@ARActivity).apply {
                                text = "✕"
                                setTextColor(Color.WHITE)
                                setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                            }
                    )
                }
        headerBar.addView(exitPill)

        // 2. Name Pill (Center)
        val centerSpace = Space(this).apply { layoutParams = LinearLayout.LayoutParams(0, 0, 1f) }
        headerBar.addView(centerSpace)

        val namePill =
                FrameLayout(this).apply {
                    background = pillDrawable("#88000000")
                    setPadding(dp(24), dp(8), dp(24), dp(8))
                    addView(
                            TextView(this@ARActivity).apply {
                                text = modelName
                                setTextColor(Color.WHITE)
                                setTypeface(null, Typeface.BOLD)
                                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                            }
                    )
                }
        headerBar.addView(namePill)

        val rightSpace = Space(this).apply { layoutParams = LinearLayout.LayoutParams(0, 0, 1f) }
        headerBar.addView(rightSpace)

        // 3. Settings Pill
        val settingsPill =
                FrameLayout(this).apply {
                    background = pillDrawable("#55000000")
                    setPadding(dp(12), dp(8), dp(12), dp(8))
                    setOnClickListener { toggleDrawer() }
                    addView(
                            TextView(this@ARActivity).apply {
                                text = "⚙"
                                setTextColor(Color.WHITE)
                                setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                            }
                    )
                }
        headerBar.addView(settingsPill)

        parent.addView(headerBar, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    }

    private fun buildDrawer(parent: FrameLayout) {
        if (::drawerLayout.isInitialized && drawerLayout.parent != null) {
            refreshTabs()
            refreshDrawer()
            return
        }

        drawerLayout =
                LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    background = roundedRectDrawable("#F2141828", dp(24))
                    setPadding(dp(16), dp(12), dp(16), dp(24))
                    visibility = View.GONE
                }

        tabContainer =
                LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    background = pillDrawable("#336C4CFF")
                    setPadding(dp(4), dp(4), dp(4), dp(4))
                }
        drawerLayout.addView(
                tabContainer,
                LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                    bottomMargin = dp(16)
                }
        )

        drawerContent = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        drawerLayout.addView(drawerContent)

        val lp =
                FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                    gravity = Gravity.BOTTOM
                    setMargins(dp(8), dp(8), dp(8), dp(8))
                }
        parent.addView(drawerLayout, lp)

        refreshTabs()
        refreshDrawer()
    }

    private fun refreshTabs() {
        if (!::tabContainer.isInitialized) return
        tabContainer.removeAllViews()
        val tabs = listOf("Audio", "Animation")
        tabs.forEach { tabName ->
            val tabView =
                    TextView(this).apply {
                        text = tabName
                        setTextColor(if (currentTab == tabName) Color.WHITE else Color.GRAY)
                        gravity = Gravity.CENTER
                        setPadding(dp(12), dp(8), dp(12), dp(8))
                        layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                        if (currentTab == tabName) {
                            background = roundedRectDrawable("#AA6C4CFF", dp(16))
                        }
                        setOnClickListener {
                            currentTab = tabName
                            refreshTabs()
                            refreshDrawer()
                        }
                    }
            tabContainer.addView(tabView)
        }
    }

    private fun refreshDrawer() {
        runOnUiThread {
            if (!::drawerContent.isInitialized) return@runOnUiThread
            drawerContent.removeAllViews()
            when (currentTab) {
                "Audio" -> buildAudioTab()
                "Animation" -> buildAnimationTab()
            }
        }
    }

    private fun buildAudioTab() {
        // Level
        drawerContent.addView(createLabel("Level"))
        val levels = getDistinctOrderedLevels()
        drawerContent.addView(
                createSpinnerPill(levels, selectedLevel ?: "Select Level") {
                    selectedLevel = it
                    reloadAudio()
                    refreshDrawer()
                }
        )

        // Language
        drawerContent.addView(createLabel("Language"))
        val langs = getDistinctOrderedLangs()
        drawerContent.addView(
                createSpinnerPill(langs, selectedLanguage ?: "Select Language") {
                    selectedLanguage = it
                    selectedLevel = getDistinctOrderedLevels().firstOrNull() ?: ""
                    reloadAudio()
                    refreshDrawer()
                }
        )

        // Audio Track (using the model name or list of tracks if applicable)
        drawerContent.addView(createLabel("Audio Track"))
        val tracks =
                listOf(modelName ?: "Track") // Assuming 1 track per model for now, or use allAudios
        drawerContent.addView(
                createSpinnerPill(tracks, modelName ?: "Track") { /* handle track change */}
        )

        // Audio controls row (ONLY if model is mounted)
        if (activeAnchorNode != null) {
            val audioRow =
                    LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.CENTER_VERTICAL
                        background = roundedRectDrawable("#22FFFFFF", dp(16))
                        setPadding(dp(12), dp(12), dp(12), dp(12))
                    }

            val playBtn =
                    ImageButton(this).apply {
                        background = roundedRectDrawable("#00C096", dp(8))
                        setImageResource(
                                if (isAudioPlaying) android.R.drawable.ic_media_pause
                                else android.R.drawable.ic_media_play
                        )
                        setColorFilter(Color.WHITE)
                        setPadding(dp(8), dp(8), dp(8), dp(8))
                        layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
                        setOnClickListener {
                            toggleAudio()
                            refreshDrawer()
                        }
                    }
            audioRow.addView(playBtn)

            val volumeIcon =
                    TextView(this).apply {
                        text = "🔊"
                        setPadding(dp(12), 0, dp(8), 0)
                    }
            audioRow.addView(volumeIcon)

            val volumeBar =
                    SeekBar(this).apply {
                        layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
                        progress = (mediaPlayer?.let { 100 } ?: 100)
                        setOnSeekBarChangeListener(
                                object : SeekBar.OnSeekBarChangeListener {
                                    override fun onProgressChanged(
                                            p0: SeekBar?,
                                            p1: Int,
                                            p2: Boolean
                                    ) {
                                        val vol = p1 / 100f
                                        mediaPlayer?.setVolume(vol, vol)
                                    }
                                    override fun onStartTrackingTouch(p0: SeekBar?) {}
                                    override fun onStopTrackingTouch(p0: SeekBar?) {}
                                }
                        )
                    }
            audioRow.addView(volumeBar)

            drawerContent.addView(
                    audioRow,
                    LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                        topMargin = dp(16)
                    }
            )
        } else {
            drawerContent.addView(
                    TextView(this).apply {
                        text = "Tap on surface to place model to play audio"
                        setTextColor(Color.GRAY)
                        setPadding(0, dp(16), 0, 0)
                        gravity = Gravity.CENTER
                    }
            )
        }
    }

    private fun buildAnimationTab() {
        if (activeAnchorNode != null) {
            // Gesture Mode Toggle
            val gestureRow =
                    createToggleRow("Gesture Mode", true) { enabled ->
                        activeTransformNode?.let { node ->
                            node.translationController.isEnabled = enabled
                            node.rotationController.isEnabled = enabled
                            node.scaleController.isEnabled = enabled
                        }
                    }
            drawerContent.addView(gestureRow)

            // Animation selection if multiple available
            if (allAnimations.size > 1) {
                drawerContent.addView(createLabel("Change Animation"))
                val animNames = allAnimations.map { it.name }
                drawerContent.addView(
                        createSpinnerPill(animNames, selectedAnimationName) { name ->
                            selectedAnimationName = name
                            allAnimations.find { it.name == name }?.let { playAnimation(it) }
                            refreshDrawer()
                        }
                )
            }

            // Toggle Animation Button
            val animBtn =
                    Button(this).apply {
                        val isPaused = activeModelAnimator?.isPaused == true
                        text = if (isPaused) "Resume Animation" else "Pause Animation"
                        background =
                                roundedRectDrawable(
                                        if (isPaused) "#FF4BC24B" else "#FFFF4B4B",
                                        dp(12)
                                )
                        setTextColor(Color.WHITE)
                        setOnClickListener {
                            activeModelAnimator?.let {
                                if (it.isPaused) it.resume() else it.pause()
                                refreshDrawer()
                            }
                        }
                    }
            drawerContent.addView(
                    animBtn,
                    LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                        topMargin = dp(12)
                    }
            )

            // Reset Rotation Button
            val fixBtn =
                    Button(this).apply {
                        text = "Reset Rotation"
                        background = roundedRectDrawable("#33FFFFFF", dp(12))
                        setTextColor(Color.WHITE)
                        setOnClickListener {
                            activeTransformNode?.localRotation = Quaternion.identity()
                            refreshDrawer()
                        }
                    }
            drawerContent.addView(
                    fixBtn,
                    LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
                        topMargin = dp(12)
                    }
            )

            // Manual Rotations
            drawerContent.addView(createLabel("Manual Rotation"))
            drawerContent.addView(createAxisSlider("X Axis") { deg -> updateRotation(deg, 0f, 0f) })
            drawerContent.addView(createAxisSlider("Y Axis") { deg -> updateRotation(0f, deg, 0f) })
            drawerContent.addView(createAxisSlider("Z Axis") { deg -> updateRotation(0f, 0f, deg) })
        } else {
            drawerContent.addView(
                    TextView(this).apply {
                        text = "Tap on surface to place model to see animations"
                        setTextColor(Color.GRAY)
                        setPadding(0, dp(16), 0, 0)
                        gravity = Gravity.CENTER
                    }
            )
        }
    }

    private fun toggleDrawer() {
        isDrawerOpen = !isDrawerOpen
        drawerLayout.visibility = if (isDrawerOpen) View.VISIBLE else View.GONE
    }

    private fun updateRotation(rx: Float, ry: Float, rz: Float) {
        activeTransformNode?.let { node ->
            val current = node.localRotation
            val axis = Quaternion.eulerAngles(Vector3(rx, ry, rz))
            node.localRotation = Quaternion.multiply(current, axis)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  UI Helpers
    // ─────────────────────────────────────────────────────────────────────────

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
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
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

            val path = modelPath ?: return@setOnTapArPlaneListener
            isModelLoading = true
            ModelRenderable.builder()
                    .setSource(this, Uri.parse(path))
                    .setIsFilamentGltf(true)
                    .setAsyncLoadEnabled(true)
                    .build()
                    .thenAccept { renderable ->
                        runOnUiThread {
                            isModelLoading = false
                            renderable.isShadowCaster = true
                            renderable.isShadowReceiver = true
                            // Tune material PBR properties for more vivid rendering
                            for (i in 0 until renderable.submeshCount) {
                                runCatching {
                                    val material = renderable.getMaterial(i)
                                    material.setFloat("reflectance", 0.4f)
                                }
                            }
                            placeModel(hitResult, renderable)
                        }
                    }
                    .exceptionally { error ->
                        runOnUiThread {
                            isModelLoading = false
                            android.widget.Toast.makeText(this, "Failed to load 3D model", android.widget.Toast.LENGTH_SHORT).show()
                        }
                        android.util.Log.e("ARActivity", "Model load failed: $path", error)
                        null
                    }
        }
    }

    private fun placeModel(hitResult: com.google.ar.core.HitResult, renderable: ModelRenderable) {
        // Hide AR surface scanning dots once placed for a cleaner view
        arFragment.arSceneView.planeRenderer.setVisible(false)

        val anchorNode =
                AnchorNode(hitResult.createAnchor()).apply {
                    setParent(arFragment.arSceneView.scene)
                }
        val node =
                TransformableNode(arFragment.transformationSystem).apply {
                    this.renderable = renderable
                    this.setParent(anchorNode)
                    this.select()

                    // Calculate the model's actual physical dimension
                    val collisionShape =
                            renderable.collisionShape as? com.google.ar.sceneform.collision.Box
                    val size = collisionShape?.size ?: Vector3(1f, 1f, 1f)
                    val maxDimension = maxOf(size.x, maxOf(size.y, size.z)).coerceAtLeast(0.01f)

                    // Cap the maximum scale so the model physically never gets larger than ~1.5
                    // meters in the real world
                    // This creates a natural "screen size" limit without breaking AR coordinate
                    // depth
                    val dynamicMaxScale = (1.5f / maxDimension).coerceIn(1.0f, 10.0f)

                    // Relax the pinch-to-zoom limits to allow much smaller/larger zooming
                    this.getScaleController()?.setMinScale(0.25f)
                    this.getScaleController()?.setMaxScale(dynamicMaxScale)
                    // Lower the sensitivity to make the zooming feel more natural (less jumpy)
                    this.getScaleController()?.setSensitivity(0.1f)
                    // Disable elasticity so it stops scaling immediately at the limit instead of
                    // "bouncing" through 0.0 scale and flipping
                    this.getScaleController()?.setElasticity(0.0f)

                    this.localScale = Vector3(0.3f, 0.3f, 0.3f)
                    this.localRotation = Quaternion.identity()
                }

        activeAnchorNode = anchorNode
        activeTransformNode = node
        currentInstance = node.renderableInstance

        // Collect animations
        val instance = node.renderableInstance
        val count = instance?.animationCount ?: 0
        allAnimations =
                (0 until count).map { i ->
                    val anim = instance!!.getAnimation(i)
                    AnimationEntry(
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
        refreshDrawer()
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
        activeModelAnimator?.cancel()
        val animator = ModelAnimator.ofAnimation(instance, anim.name)
        animator.apply {
            duration = (anim.duration * 1000f).toLong()
            start()
        }
        activeModelAnimator = animator
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
                        prepareAsync()
                        setOnPreparedListener {
                            if (activeAnchorNode != null) {
                                it.start()
                                isAudioPlaying = true
                                refreshDrawer()
                            }
                        }
                        setOnCompletionListener {
                            isAudioPlaying = false
                            refreshDrawer()
                        }
                    }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun toggleAudio() {
        val player = mediaPlayer ?: return run { reloadAudio() }
        if (isAudioPlaying) {
            player.pause()
            isAudioPlaying = false
            refreshDrawer()
        } else {
            player.start()
            isAudioPlaying = true
            refreshDrawer()
        }
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
