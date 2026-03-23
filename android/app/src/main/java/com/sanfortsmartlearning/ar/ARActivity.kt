package com.sanfortsmartlearning.ar

import android.app.Dialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
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

        setupTapListener()
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
            
            // Reduced size for landscape to match reference image
            val w = if (landscape) 110 else 160
            val h = if (landscape) 55 else 75
            
            layoutParams = FrameLayout.LayoutParams(dp(w), dp(h)).apply {
                gravity = Gravity.BOTTOM or Gravity.END
                val margin = if (landscape) dp(4) else dp(15)
                val bottom = if (landscape) dp(12) else dp(15)
                setMargins(0, 0, margin, bottom)
            }
            scaleType = ImageView.ScaleType.FIT_CENTER
        }
        parent.addView(logo)
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
            val p = if (landscape) dp(8) else dp(15)
            setPadding(p, p, p, p)
            setOnClickListener { showAnimationModal() }
            
            val inner = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                
                // Icon
                addView(ImageView(this@ARActivity).apply {
                    setImageResource(android.R.drawable.ic_menu_slideshow)
                    setColorFilter(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(dp(28), dp(28))
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
            bottomBar.addView(Space(this).apply { layoutParams = LinearLayout.LayoutParams(dp(15), 0) })
        }

        // Audio Pill
        val audioBtn = FrameLayout(this).apply {
            val p = if (landscape) dp(8) else dp(15)
            setPadding(p, p, p, p)
            setOnClickListener { showAudioModal() }
            
            // Highlight if audio is playing
            if (isAudioPlaying) {
                background = pillDrawable("#00C096")
            }

            val inner = LinearLayout(this@ARActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                
                // Unicode Music Note Icon
                addView(TextView(this@ARActivity).apply {
                    text = "♪"
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
                    setTypeface(null, Typeface.BOLD)
                    includeFontPadding = false
                    gravity = Gravity.CENTER
                    translationY = dp(-4).toFloat()
                    layoutParams = LinearLayout.LayoutParams(dp(28), dp(28))
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
            
            val steps = listOf(
                "1. Move phone to find a flat surface.",
                "2. Tap on white dots to place the model.",
                "3. One finger to move, two to rotate/scale.",
                "4. Use bottom bar for Audio and Animations."
            )
            
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

            inner.addView(createToggleRow("Gesture Mode", isGestureEnabled) { enabled ->
                isGestureEnabled = enabled
                activeTransformNode?.let { node ->
                    node.translationController.isEnabled = enabled
                    node.rotationController.isEnabled = enabled
                    node.scaleController.isEnabled = enabled
                }
            })

            if (allAnimations.size > 1) {
                inner.addView(createLabel("Change Animation"))
                val animNames = allAnimations.map { it.name }
                inner.addView(createSpinnerPill(animNames, selectedAnimationName) { name ->
                    selectedAnimationName = name
                    allAnimations.find { it.name == name }?.let { playAnimation(it) }
                    showAnimationModal() // Refresh
                })
            }

            val isPaused = activeModelAnimator?.isPaused == true
            inner.addView(Button(this@ARActivity).apply {
                text = if (isPaused) "Resume Animation" else "Pause Animation"
                background = roundedRectDrawable(if (isPaused) "#00C096" else "#FF4B4B", dp(12))
                setTextColor(Color.WHITE)
                setOnClickListener {
                    activeModelAnimator?.let {
                        if (it.isPaused) it.resume() else it.pause()
                        showAnimationModal()
                    }
                }
            }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { 
                setMargins(0, dp(16), 0, 0)
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
                                refreshBottomBarContent()
                            }
                        }
                        setOnCompletionListener {
                            isAudioPlaying = false
                            refreshBottomBarContent()
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
