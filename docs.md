# AR Scan — Complete 10/10 Production Roadmap
# ARCore + Filament (Unity NOT needed)
# Current: 6/10 → Target: 10/10

---

## API Data Available

### Models API: GET /api/modals-3d
```
{
  id: "Bear",           // model identifier
  name: "Bear",
  file: "modals/Bear/Bear.glb",
  preview_image: "modals/Bear/Adventurer.png",  // sirf Bear ke paas hai
  audios: [
    {
      gridfsId: "695240090029b2e1d47ce04d",
      language: "Bengali",
      level: "Advanced",
      filename: "Bengali-Advanced-Bear.mp3",
      url: "/api/modals-3d/audio/695240090029b2e1d47ce04d"
    },
    ...
  ]
}
```
- Model GLB download: GET /api/modals-3d/{id}/file
- Preview image: GET /api/modals-3d/{id}/preview
- Audio stream: GET /api/modals-3d/audio/{gridfsId}
- Audios list: GET /api/modals-3d/{id}/audios
- 5 models: Bear (33 audios), Dog (12), Dolphin (14), Elephant (37), Wolf (22)
- 11 languages: Bengali, English (India/UK/US), Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu
- 3 levels: Basic, Intermediate, Advanced

---

## Reference UI (Target Design)
Based on reference screenshot:
```
+--------------------------------------------------+
| [<Back]                    Live Coloring: ON [X]  |
|                                                   |
| [Translate]                              [Menu]   |
|  [zh] [A]                                         |
|                                                   |
|              +--3D MODEL--+                       |
|              |  (Dolphin)  |                       |
|              |  animated   |                       |
|              +------------+                        |
|         (on top of scanned page)                   |
|                                                    |
| [Let's Spell]              [o Toggle Colours]      |
+--------------------------------------------------+
```

### UI Elements Needed:
1. Back button (top-left)
2. Close (X) button (top-right)
3. "Live Coloring: ON/OFF" toggle (top-right)
4. "Toggle Colours" switch (bottom-right) — original vs live-colored
5. Menu/Settings button (right-side)
6. "Let's Spell" button (bottom-left) — plays audio
7. Model name display
8. Language selector (in menu)
9. Level selector (in menu - Basic/Intermediate/Advanced)

---

## PHASE 1: Scanner UI Overhaul (6 → 7.0)

### 1.1 Complete Scanner Layout Redesign
**File:** `android/app/src/main/res/layout/activity_ar_scanner.xml`

Current layout has ONLY: FragmentContainer + instruction TextView
Need to add ALL UI controls:

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout>

    <!-- AR Fragment -->
    <FragmentContainerView id="@+id/arFragmentContainer" />

    <!-- TOP BAR -->
    <!-- Back Button (top-left) -->
    <ImageButton id="@+id/btnBack" />

    <!-- Model Name (top-center) -->
    <TextView id="@+id/modelNameText" />

    <!-- Live Coloring Toggle (top-right) -->
    <LinearLayout id="@+id/liveColoringContainer">
        <TextView text="Live Coloring:" />
        <Switch id="@+id/switchLiveColoring" />
    </LinearLayout>

    <!-- Close Button (top-right corner) -->
    <ImageButton id="@+id/btnClose" />

    <!-- RIGHT SIDE -->
    <!-- Menu Button -->
    <ImageButton id="@+id/btnMenu" />

    <!-- BOTTOM BAR -->
    <!-- Let's Spell / Audio Button (bottom-left) -->
    <com.google.android.material.floatingactionbutton.FloatingActionButton
        id="@+id/btnAudio" />
    <TextView id="@+id/audioLabel" text="Let's Spell" />

    <!-- Toggle Colours (bottom-right) -->
    <LinearLayout id="@+id/toggleColoursContainer">
        <Switch id="@+id/switchToggleColours" />
        <TextView text="Toggle Colours" />
    </LinearLayout>

    <!-- Instruction Text (bottom-center) -->
    <TextView id="@+id/instructionText" />

    <!-- Loading Overlay -->
    <FrameLayout id="@+id/loadingOverlay" visibility="gone">
        <ProgressBar id="@+id/loadingProgress" />
        <TextView id="@+id/loadingText" />
    </FrameLayout>

    <!-- Audio Menu Drawer (slides from right) -->
    <LinearLayout id="@+id/audioDrawer" visibility="gone">
        <!-- Language Selector -->
        <!-- Level Selector -->
        <!-- Play/Pause/Volume controls -->
    </LinearLayout>

</androidx.constraintlayout.widget.ConstraintLayout>
```

### 1.2 Live Coloring Toggle
**File:** `ARScannerActivity.kt`

```kotlin
// State variable
private var isLiveColoringEnabled = true

// Switch listener
switchLiveColoring.setOnCheckedChangeListener { _, isChecked ->
    isLiveColoringEnabled = isChecked
    liveColoringLabel.text = if (isChecked) "Live Coloring: ON" else "Live Coloring: OFF"
    if (!isChecked) {
        // Reset model to original material colors
        restoreOriginalMaterials()
    }
}

// In applyLiveTint() — add guard at top:
private fun applyLiveTint(...) {
    if (!isLiveColoringEnabled) return
    // ... existing tint logic
}
```

### 1.3 Toggle Colours (Original vs Colored)
**File:** `ARScannerActivity.kt`

```kotlin
// State
private var showOriginalColors = false
private val originalMaterialsMap = mutableMapOf<Int, List<Material>>()

// Save original materials when model loads:
private fun captureOriginalMaterials(renderableInstance: RenderableInstance) {
    val materials = mutableListOf<Material>()
    for (i in 0 until renderableInstance.materialCount) {
        materials.add(renderableInstance.getMaterial(i).makeCopy())
    }
    originalMaterialsMap[renderableInstance.hashCode()] = materials
}

// Toggle switch:
switchToggleColours.setOnCheckedChangeListener { _, showOriginal ->
    showOriginalColors = showOriginal
    trackedNodes.values.forEach { node ->
        if (showOriginal) {
            restoreOriginalMaterials(node)
        } else {
            // Re-apply current tint
            applyCurrentTintToNode(node)
        }
    }
}

private fun restoreOriginalMaterials(node: TrackedImageNode) {
    val originals = originalMaterialsMap[node.renderableInstance.hashCode()] ?: return
    originals.forEachIndexed { index, material ->
        node.renderableInstance.setMaterial(index, material)
    }
}
```

### 1.4 Back & Close Buttons
```kotlin
btnBack.setOnClickListener { finish() }
btnClose.setOnClickListener { finish() }
```

---

## PHASE 2: Audio System in Scanner (7.0 → 7.5)

### 2.1 Pass Audio Data to Scanner
**File:** `ARModule.kt` — update startScannerDynamic:

```kotlin
@ReactMethod
fun startScannerDynamic(
    modelUrl: String,
    referenceImageUrl: String,
    modelName: String,
    audiosJson: String?,    // NEW: audio data from API
    promise: Promise
) {
    Thread {
        try {
            // ... download model + reference image ...

            val launchIntent = Intent(reactContext, ARScannerActivity::class.java).apply {
                putExtra(EXTRA_MODEL_FILE_PATH, modelFile.absolutePath)
                putExtra(EXTRA_REFERENCE_IMAGE_FILE_PATH, referenceFile.absolutePath)
                putExtra("modelName", modelName)
                if (!audiosJson.isNullOrBlank()) putExtra("audiosJson", audiosJson)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            // ... launch ...
        }
    }.start()
}
```

**File:** `ARScannerModule.ts` — update:
```typescript
startScannerDynamic: async (
    modelUrl: string,
    referenceImageUrl: string,
    modelName: string,
    audiosJson?: string,
): Promise<boolean> => {
    return ARNativeModule.startScannerDynamic(modelUrl, referenceImageUrl, modelName, audiosJson);
},
```

**File:** `ARScreen.tsx` — pass audios:
```typescript
// Fetch audios for model
const modelId = model._id || model.id || (model as any).name;
const audiosResponse = await ARService.getModelAudios(modelId);
const audios = (audiosResponse.audios || []).map(a => ({
    ...a,
    audioUrl: ARService.getAudioStreamUrlById(a.gridfsId),
}));

await ARScannerModule.startScannerDynamic(
    modelFileUrl,
    referenceImageUrl,
    model.name || 'model',
    JSON.stringify(audios),
);
```

### 2.2 Audio Player in Scanner
**File:** `ARScannerActivity.kt` — add MediaPlayer support (copy pattern from ARActivity):

```kotlin
// Audio state
private var allAudios: List<AudioEntry> = emptyList()
private var mediaPlayer: MediaPlayer? = null
private var isAudioPlaying = false
private var selectedLanguage: String = "English (India)"
private var selectedLevel: String = "Basic"
private var modelName: String? = null

// In onCreate:
modelName = intent.getStringExtra("modelName")
modelNameText.text = modelName ?: ""

intent.getStringExtra("audiosJson")?.let { json ->
    val arr = JSONArray(json)
    allAudios = (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        AudioEntry(
            language = o.optString("language"),
            level = o.optString("level"),
            audioName = o.optString("audioName", modelName ?: ""),
            audioUrl = o.optString("audioUrl")
        )
    }
}

// Audio button (Let's Spell):
btnAudio.setOnClickListener {
    if (isAudioPlaying) {
        mediaPlayer?.pause()
        isAudioPlaying = false
    } else {
        playCurrentAudio()
    }
    updateAudioButton()
}

private fun playCurrentAudio() {
    val entry = allAudios.firstOrNull {
        it.language == selectedLanguage && it.level == selectedLevel
    } ?: allAudios.firstOrNull() ?: return

    mediaPlayer?.release()
    mediaPlayer = MediaPlayer().apply {
        setDataSource(entry.audioUrl)
        prepareAsync()
        setOnPreparedListener {
            it.start()
            isAudioPlaying = true
            updateAudioButton()
        }
        setOnCompletionListener {
            isAudioPlaying = false
            updateAudioButton()
        }
    }
}
```

### 2.3 Audio Menu Drawer
**File:** `ARScannerActivity.kt`

```kotlin
// Menu button opens drawer
btnMenu.setOnClickListener { toggleAudioDrawer() }

private fun toggleAudioDrawer() {
    audioDrawer.visibility = if (audioDrawer.visibility == View.VISIBLE)
        View.GONE else View.VISIBLE
    buildAudioDrawer()
}

private fun buildAudioDrawer() {
    // Language spinner
    val languages = allAudios.map { it.language }.distinct()
    languageSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, languages)

    // Level spinner
    val levels = allAudios.filter { it.language == selectedLanguage }.map { it.level }.distinct()
    levelSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, levels)

    // Play/Pause button
    // Volume slider
}
```

---

## PHASE 3: File Caching + Loading UX (7.5 → 8.0)

### 3.1 Smart File Caching
**File:** `ARModule.kt`

```kotlin
private fun downloadFileWithCache(urlString: String, outputFile: File): Boolean {
    // Skip download if cached and less than 24 hours old
    if (outputFile.exists()) {
        val ageMs = System.currentTimeMillis() - outputFile.lastModified()
        if (ageMs < 24 * 60 * 60 * 1000) {
            android.util.Log.i("ARModule", "Using cached: ${outputFile.name}")
            return true // cached
        }
    }
    // Download fresh
    val connection = URL(urlString).openConnection() as java.net.HttpURLConnection
    connection.connectTimeout = 15000
    connection.readTimeout = 30000

    val totalBytes = connection.contentLength.toLong()
    var downloadedBytes = 0L

    connection.inputStream.use { input ->
        FileOutputStream(outputFile).use { output ->
            val buffer = ByteArray(8192)
            var read: Int
            while (input.read(buffer).also { read = it } != -1) {
                output.write(buffer, 0, read)
                downloadedBytes += read
                // Emit progress
                emitProgress("downloading", downloadedBytes.toDouble() / totalBytes.toDouble())
            }
        }
    }
    return false // fresh download
}

private fun emitProgress(status: String, progress: Double) {
    val emitter = reactContext.getJSModule(
        com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
    )
    emitter.emit("arScanProgress", Arguments.createMap().apply {
        putString("status", status)
        putDouble("progress", progress)
    })
}
```

### 3.2 Loading Progress UI (React Native side)
**File:** `ARScreen.tsx`

```tsx
const [scanLoading, setScanLoading] = useState(false);
const [scanProgress, setScanProgress] = useState({ status: '', progress: 0 });

// Listen to progress events
useEffect(() => {
    const sub = DeviceEventEmitter.addListener('arScanProgress', (event) => {
        setScanProgress({ status: event.status, progress: event.progress });
    });
    return () => sub.remove();
}, []);

// In render, show overlay:
{scanLoading && (
    <View style={styles.scanLoadingOverlay}>
        <ActivityIndicator size="large" color="#6C4CFF" />
        <Text style={styles.scanLoadingText}>
            {scanProgress.status === 'downloading_model'
                ? `Downloading model... ${Math.round(scanProgress.progress * 100)}%`
                : scanProgress.status === 'downloading_image'
                ? `Downloading image... ${Math.round(scanProgress.progress * 100)}%`
                : 'Preparing AR Scanner...'}
        </Text>
        <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${scanProgress.progress * 100}%` }]} />
        </View>
    </View>
)}
```

### 3.3 Native Loading Overlay
**File:** `ARScannerActivity.kt`
```kotlin
// Show loading while model downloads/loads
private fun showLoading(text: String) {
    loadingOverlay.visibility = View.VISIBLE
    loadingText.text = text
}

private fun hideLoading() {
    loadingOverlay.visibility = View.GONE
}

// In loadRenderable/loadRenderableFromFile:
showLoading("Loading 3D model...")
// ... on success:
hideLoading()
```

---

## PHASE 4: Rendering Quality — Shadows & Lighting (8.0 → 8.5)

### 4.1 Enable Shadows
**File:** `ARScannerActivity.kt`

```kotlin
// When model loads (in loadRenderable thenAccept):
sharedRenderable = renderable
renderable.isShadowCaster = true
renderable.isShadowReceiver = true

// Also on each TrackedImageNode creation:
renderableInstance.isShadowCaster = true
renderableInstance.isShadowReceiver = true
```

### 4.2 Enable Light Estimation
**File:** `ARImageTrackingFragment.kt`

```kotlin
// CHANGE:
lightEstimationMode = Config.LightEstimationMode.DISABLED
// TO:
lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
```

### 4.3 Add Directional Light (Sun) + Shadow
**File:** `ARScannerActivity.kt`

```kotlin
private fun setupDirectionalLight() {
    val sunlight = Light.builder(Light.Type.DIRECTIONAL)
        .setColor(com.google.ar.sceneform.rendering.Color(1f, 0.95f, 0.9f))
        .setIntensity(1200f)
        .setShadowCastingEnabled(true)
        .build()

    val sunNode = Node().apply {
        light = sunlight
        localPosition = Vector3(0f, 1.5f, -0.5f)
        localRotation = Quaternion.lookRotation(
            Vector3(0.2f, -1f, 0.3f), Vector3.up()
        )
    }
    arFragment.arSceneView.scene.addChild(sunNode)
}

// Call in onCreate after fragment setup
```

### 4.4 Ground Shadow Plane
```kotlin
private fun addGroundShadowPlane(anchorNode: AnchorNode) {
    MaterialFactory.makeTransparentWithColor(
        this,
        com.google.ar.sceneform.rendering.Color(0f, 0f, 0f, 0f)
    ).thenAccept { material ->
        val shadowPlane = ShapeFactory.makeCylinder(0.2f, 0.001f, Vector3.zero(), material)
        shadowPlane.isShadowReceiver = true
        shadowPlane.isShadowCaster = false

        val shadowNode = Node().apply {
            renderable = shadowPlane
            localPosition = Vector3(0f, -0.001f, 0f)
        }
        anchorNode.addChild(shadowNode)
    }
}
```

---

## PHASE 5: Performance Optimization (8.5 → 9.0)

### 5.1 Background Thread Sampling
**File:** `ARScannerActivity.kt`

```kotlin
// Add to build.gradle:
// implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'

private val samplingScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

// Move heavy work off main thread:
private fun onARFrameUpdate() {
    // Quick checks on main thread
    val frame = arFragment.arSceneView.arFrame ?: return

    // Heavy sampling on background thread
    samplingScope.launch {
        val tintResult = computeTintInBackground(frame)
        val textureResult = sampleTextureInBackground(frame)

        withContext(Dispatchers.Main) {
            tintResult?.let { applyTintResult(it) }
            textureResult?.let { applyTextureResult(it) }
        }
    }
}
```

### 5.2 Object Pooling (Bitmap + IntArray)
```kotlin
// Reusable pools to avoid GC stutter
private val bitmapPool = mutableMapOf<Pair<Int,Int>, Bitmap>()
private val intArrayPool = mutableMapOf<Int, IntArray>()

private fun getPooledBitmap(w: Int, h: Int): Bitmap {
    val key = Pair(w, h)
    return bitmapPool.getOrPut(key) {
        Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    }
}

private fun getPooledIntArray(size: Int): IntArray {
    return intArrayPool.getOrPut(size) { IntArray(size) }
}

// Use everywhere instead of allocating new arrays
```

### 5.3 Material Binding Cache Fix
```kotlin
// Cache BOTH successful and failed bindings to avoid retrying
private val materialBindingSuccessCache = WeakHashMap<Material, String>() // successful property name
private val materialBindingFailCache = WeakHashMap<Material, Boolean>()   // tried and failed

private fun setTextureOnMaterial(material: Material, texture: Texture): Boolean {
    // Check cache first
    materialBindingSuccessCache[material]?.let { propName ->
        material.setTexture(propName, texture)
        return true
    }
    if (materialBindingFailCache.containsKey(material)) return false

    // Try all binding names (only on first attempt)
    for (name in TEXTURE_BINDING_NAMES) {
        try {
            material.setTexture(name, texture)
            materialBindingSuccessCache[material] = name
            return true
        } catch (_: Exception) {}
    }
    materialBindingFailCache[material] = true
    return false
}
```

---

## PHASE 6: Visual Polish (9.0 → 9.5)

### 6.1 Depth Occlusion (Model hides behind objects)
**File:** `ARImageTrackingFragment.kt`

```kotlin
// In onCreateSessionConfig:
if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
    config.depthMode = Config.DepthMode.AUTOMATIC
}
```

**File:** `ARScannerActivity.kt`
```kotlin
// In onCreate after fragment setup:
arFragment.arSceneView?.let { sceneView ->
    // Enable depth-based occlusion if supported
    sceneView.cameraStream?.depthOcclusionMode =
        CameraStream.DepthOcclusionMode.DEPTH_OCCLUSION
}
```

### 6.2 Post-Processing (Bloom + Tone Mapping + FXAA)
**File:** `ARScannerActivity.kt`

```kotlin
private fun setupPostProcessing() {
    val renderer = arFragment.arSceneView?.renderer ?: return

    // Access Filament view
    renderer.filamentView?.let { view ->
        // Anti-aliasing
        view.antiAliasing = com.google.android.filament.View.AntiAliasing.FXAA

        // MSAA
        view.multiSampleAntiAliasingOptions =
            com.google.android.filament.View.MultiSampleAntiAliasingOptions().apply {
                enabled = true
                sampleCount = 4
            }

        // Bloom
        view.bloomOptions = com.google.android.filament.View.BloomOptions().apply {
            enabled = true
            strength = 0.10f
            resolution = 360
        }
    }
}
// Call after fragment is ready
```

### 6.3 Animation Crossfade
```kotlin
private fun crossfadeToAnimation(
    renderableInstance: RenderableInstance,
    toIndex: Int,
    durationMs: Long = 400
) {
    val currentAnimator = trackedNodes.values.firstOrNull()?.animator
    currentAnimator?.let {
        ValueAnimator.ofFloat(1f, 0f).apply {
            duration = durationMs
            addUpdateListener { anim ->
                // Fade out - not directly supported, but reduce speed to 0
            }
            start()
        }
    }

    val newAnimator = ModelAnimator.ofAnimation(renderableInstance, toIndex).apply {
        duration = (renderableInstance.getAnimationDuration(toIndex) / 0.72f).toLong()
            .coerceAtLeast(280)
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.RESTART
        interpolator = LinearInterpolator()
        start()
    }
    trackedNodes.values.firstOrNull()?.animator = newAnimator
}
```

### 6.4 Haptic Feedback on Gestures
```kotlin
import android.os.VibrationEffect
import android.os.Vibrator
import android.content.Context

private fun hapticFeedback(type: String = "light") {
    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
    if (android.os.Build.VERSION.SDK_INT >= 26) {
        when (type) {
            "light" -> vibrator.vibrate(VibrationEffect.createOneShot(15, 40))
            "medium" -> vibrator.vibrate(VibrationEffect.createOneShot(25, 80))
        }
    }
}

// In onScale:
override fun onScaleBegin(detector: ScaleGestureDetector): Boolean {
    hapticFeedback("light")
    return true
}

// In rotation gesture:
// hapticFeedback("light") on significant rotation
```

---

## PHASE 7: Sceneform → SceneView Migration (9.5 → 10.0)

### 7.1 Why Migrate
- Sceneform DEPRECATED by Google (2020)
- SceneView 2.x = community maintained, actively updated
- Gives DIRECT Filament access (IBL, custom materials, advanced rendering)
- Better ARCore version support
- Same API structure — migration is straightforward

### 7.2 Dependency Change
**File:** `android/app/build.gradle`

```gradle
// REMOVE:
implementation 'com.google.ar.sceneform.ux:sceneform-ux:1.23.0'
implementation 'com.google.ar.sceneform:core:1.23.0'
implementation 'com.google.ar.sceneform:animation:1.23.0'

// ADD:
implementation 'io.github.sceneview:arsceneview:2.2.0'
```

### 7.3 Import Changes
```kotlin
// BEFORE:
import com.google.ar.sceneform.ux.ArFragment
import com.google.ar.sceneform.rendering.ModelRenderable
import com.google.ar.sceneform.AnchorNode
import com.google.ar.sceneform.Node

// AFTER:
import io.github.sceneview.ar.ArSceneView
import io.github.sceneview.ar.node.ArModelNode
import io.github.sceneview.node.ModelNode
import io.github.sceneview.ar.arcore.LightEstimationMode
```

### 7.4 Key API Changes
```kotlin
// Fragment → Direct View
// BEFORE: ArFragment in XML
// AFTER:  ArSceneView in XML directly

// Model Loading
// BEFORE:
ModelRenderable.builder()
    .setSource(context, uri)
    .setIsFilamentGltf(true)
    .build()

// AFTER:
val modelNode = ArModelNode().apply {
    loadModelGlb(
        context = this@ARScannerActivity,
        glbFileLocation = "file:///path/to/model.glb",
        autoAnimate = true,
        centerOrigin = Position(0f, 0f, 0f)
    )
}
arSceneView.addChild(modelNode)
```

### 7.5 IBL / Environment Lighting (Only possible with SceneView)
```kotlin
// Load HDR environment for realistic reflections
arSceneView.environment = HDREnvironment(
    engine = arSceneView.engine,
    iblKtxFileLocation = "environments/studio_small.ktx",
    skyboxKtxFileLocation = null // no skybox for AR
)
```

### 7.6 Advanced Material Access
```kotlin
// Direct Filament material property access
modelNode.materialInstances.forEach { material ->
    material.setFloat("roughness", 0.6f)
    material.setFloat("metallic", 0.1f)
    material.setFloat("reflectance", 0.4f)
    material.setFloat3("emissiveFactor", 0.02f, 0.02f, 0.02f)
}
```

---

## EXECUTION ORDER (Priority)

```
Week 1: Phase 1 — Scanner UI (toggles, buttons, layout)
         → Biggest UX improvement, matches reference design

Week 2: Phase 2 — Audio system in scanner
         → "Let's Spell" button, language/level selector, audio playback

Week 3: Phase 3 — Caching + Loading UX
         → No more re-downloads, progress bar

Week 4: Phase 4 — Shadows + Lighting
         → Biggest visual quality jump

Week 5: Phase 5 — Performance
         → Background threading, object pooling, 60fps

Week 6: Phase 6 — Visual Polish
         → Depth occlusion, bloom, haptics

Week 7: Phase 7 — SceneView Migration
         → Full Filament access, IBL, future-proof
```

---

## SCORE BREAKDOWN

| Phase | Score | Key Changes |
|-------|-------|------------|
| Current | 6.0 | Basic ARCore + Sceneform, bear only |
| Phase 1 | 7.0 | Full UI: toggles, buttons, matches reference |
| Phase 2 | 7.5 | Audio playback, language selection, "Let's Spell" |
| Phase 3 | 8.0 | Caching (instant load), progress bar |
| Phase 4 | 8.5 | Shadows, light estimation, directional light |
| Phase 5 | 9.0 | 60fps smooth, no GC stutter, background threading |
| Phase 6 | 9.5 | Depth occlusion, bloom, haptics, animation blend |
| Phase 7 | 10.0 | SceneView 2.x, IBL reflections, advanced materials |

---

## FILES TO MODIFY (Complete List)

### Android Native:
1. `android/app/src/main/res/layout/activity_ar_scanner.xml` — complete UI redesign
2. `android/app/src/main/java/com/ilifelearn/ar/ARScannerActivity.kt` — toggles, audio, shadows, perf
3. `android/app/src/main/java/com/ilifelearn/ar/ARImageTrackingFragment.kt` — light estimation, depth
4. `android/app/src/main/java/com/ilifelearn/ar/ARModule.kt` — caching, progress events, audio pass
5. `android/app/build.gradle` — SceneView dependency (Phase 7)

### React Native:
6. `src/screens/ar/ARScannerModule.ts` — updated bridge methods
7. `src/screens/ar/ARScreen.tsx` — loading UI, progress, audio data pass
8. `src/services/ar.service.ts` — audio fetch (already exists)

### New Files (if needed):
9. `android/app/src/main/res/drawable/` — button icons (back, close, menu, audio)
10. `android/app/src/main/res/layout/drawer_audio.xml` — audio drawer layout
