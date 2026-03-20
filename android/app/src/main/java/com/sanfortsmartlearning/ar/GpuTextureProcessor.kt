package com.sanfortsmartlearning.ar

import android.graphics.Bitmap
import android.opengl.GLES11Ext
import android.opengl.GLES30
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.roundToInt

/**
 * GPU-accelerated texture processor for live AR coloring.
 *
 * Replaces the CPU-based pipeline (acquireCameraImage → YUV decode → homography → classify)
 * with a single GPU shader pass that:
 *   1. Samples the ARCore camera OES texture via homography projection
 *   2. Applies subject mask (bear body vs background)
 *   3. Classifies pixels: skin→WHITE, dark→WHITE, grey→WHITE, near-white→WHITE, colored→keep+boost
 *   4. Temporal blending with previous frame for stability
 *
 * All heavy per-pixel work runs on GPU in <1ms instead of 80-120ms on CPU.
 * Only a single glReadPixels call is needed to get the result bitmap.
 */
class GpuTextureProcessor {
    private val tag = "GpuTextureProcessor"

    // GL resources
    private var programId = 0
    private var fboId = 0
    private var fboTextureId = 0
    private var prevTextureId = 0
    private var maskTextureId = 0
    private var referenceTextureId = 0
    private var quadVao = 0
    private var quadVbo = 0
    private var outputSize = 0
    private var initialized = false
    private var hasPreviousFrame = false
    private var hasMask = false
    private var hasReference = false

    // Uniform locations
    private var uCameraTextureLoc = -1
    private var uSubjectMaskLoc = -1
    private var uReferenceTextureLoc = -1
    private var uPreviousFrameLoc = -1
    private var uHomographyLoc = -1
    private var uHasPreviousLoc = -1
    private var uHasMaskLoc = -1
    private var uHasReferenceLoc = -1
    private var uBlendAlphaLoc = -1
    private var uMinDrawingSatLoc = -1
    private var uMinDrawingChromaLoc = -1
    private var uWhiteBalanceGainLoc = -1
    private var uRawOutputLoc = -1

    // Readback buffer (reused)
    private var readbackBuffer: ByteBuffer? = null
    private var readbackPixels: IntArray? = null
    private var reusableBitmap: Bitmap? = null

    // Fullscreen quad vertices: position (x,y) + texcoord (u,v)
    private val quadVertices = floatArrayOf(
        -1f, -1f, 0f, 0f,
         1f, -1f, 1f, 0f,
        -1f,  1f, 0f, 1f,
         1f,  1f, 1f, 1f,
    )

    /**
     * Initialize GL resources. Must be called on the GL thread (same EGL context as Sceneform).
     */
    fun initialize(size: Int) {
        if (initialized) release()
        outputSize = size.coerceIn(64, 768)  // was 512 → allow higher resolution textures

        // Create FBO + color texture
        val fbos = IntArray(1)
        GLES30.glGenFramebuffers(1, fbos, 0)
        fboId = fbos[0]

        fboTextureId = createRgbaTexture(outputSize)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fboId)
        GLES30.glFramebufferTexture2D(
            GLES30.GL_FRAMEBUFFER, GLES30.GL_COLOR_ATTACHMENT0,
            GLES30.GL_TEXTURE_2D, fboTextureId, 0,
        )
        val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
        if (status != GLES30.GL_FRAMEBUFFER_COMPLETE) {
            Log.e(tag, "FBO incomplete: $status")
            GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
            return
        }
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)

        // Previous frame texture (for temporal blending)
        prevTextureId = createRgbaTexture(outputSize)

        // Subject mask texture (single channel, uploaded once)
        maskTextureId = createRgbaTexture(outputSize)
        referenceTextureId = createRgbaTexture(outputSize)

        // Compile shader program
        programId = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
        if (programId == 0) {
            Log.e(tag, "Failed to create shader program")
            return
        }

        // Get uniform locations
        uCameraTextureLoc = GLES30.glGetUniformLocation(programId, "uCameraTexture")
        uSubjectMaskLoc = GLES30.glGetUniformLocation(programId, "uSubjectMask")
        uReferenceTextureLoc = GLES30.glGetUniformLocation(programId, "uReferenceTexture")
        uPreviousFrameLoc = GLES30.glGetUniformLocation(programId, "uPreviousFrame")
        uHomographyLoc = GLES30.glGetUniformLocation(programId, "uHomography")
        uHasPreviousLoc = GLES30.glGetUniformLocation(programId, "uHasPrevious")
        uHasMaskLoc = GLES30.glGetUniformLocation(programId, "uHasMask")
        uHasReferenceLoc = GLES30.glGetUniformLocation(programId, "uHasReference")
        uBlendAlphaLoc = GLES30.glGetUniformLocation(programId, "uBlendAlpha")
        uMinDrawingSatLoc = GLES30.glGetUniformLocation(programId, "uMinDrawingSat")
        uMinDrawingChromaLoc = GLES30.glGetUniformLocation(programId, "uMinDrawingChroma")
        uWhiteBalanceGainLoc = GLES30.glGetUniformLocation(programId, "uWhiteBalanceGain")
        uRawOutputLoc = GLES30.glGetUniformLocation(programId, "uRawOutput")

        // Create fullscreen quad VAO
        val vaos = IntArray(1)
        GLES30.glGenVertexArrays(1, vaos, 0)
        quadVao = vaos[0]
        val vbos = IntArray(1)
        GLES30.glGenBuffers(1, vbos, 0)
        quadVbo = vbos[0]

        GLES30.glBindVertexArray(quadVao)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, quadVbo)
        val vertexBuffer = allocateFloatBuffer(quadVertices)
        GLES30.glBufferData(
            GLES30.GL_ARRAY_BUFFER,
            quadVertices.size * 4, vertexBuffer, GLES30.GL_STATIC_DRAW,
        )
        // Position attribute (location=0)
        GLES30.glEnableVertexAttribArray(0)
        GLES30.glVertexAttribPointer(0, 2, GLES30.GL_FLOAT, false, 16, 0)
        // Texcoord attribute (location=1)
        GLES30.glEnableVertexAttribArray(1)
        GLES30.glVertexAttribPointer(1, 2, GLES30.GL_FLOAT, false, 16, 8)
        GLES30.glBindVertexArray(0)

        // Readback buffers
        val byteCount = outputSize * outputSize * 4
        readbackBuffer = ByteBuffer.allocateDirect(byteCount).order(ByteOrder.LITTLE_ENDIAN)
        readbackPixels = IntArray(outputSize * outputSize)

        initialized = true
        Log.i(tag, "GPU texture processor initialized: ${outputSize}x${outputSize}")
    }

    /**
     * Upload the subject mask (bear body region). Call once per reference image, not per frame.
     * mask[i] = true means pixel i is inside the bear body.
     */
    fun uploadSubjectMask(mask: BooleanArray, width: Int, height: Int) {
        if (!initialized) return
        val pixels = IntArray(width * height)
        for (i in mask.indices) {
            pixels[i] = if (mask[i]) -1 else 0 // 0xFFFFFFFF or 0x00000000
        }
        val bitmap = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        uploadBitmapToTexture(maskTextureId, bitmap)
        bitmap.recycle()
        hasMask = true
    }

    fun uploadReferenceTexture(pixels: IntArray, width: Int, height: Int) {
        if (!initialized || pixels.isEmpty()) return
        val bitmap = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
        uploadBitmapToTexture(referenceTextureId, bitmap)
        bitmap.recycle()
        hasReference = true
    }

    /**
     * Process one frame: sample camera texture through homography, classify pixels, blend.
     *
     * @param cameraTextureId The ARCore camera OES texture ID
     * @param homography 9 floats [h00,h01,h02, h10,h11,h12, h20,h21,h22] mapping output UV→camera UV
     * @param blendAlpha Temporal blend factor (0=keep previous, 1=use new)
     * @param minSat Minimum saturation for a pixel to be considered "colored"
     * @param minChroma Minimum chroma (0-255) for "colored" classification
     * @return Classified bitmap, or null on failure
     */
    fun processFrame(
        cameraTextureId: Int,
        homography: FloatArray,
        blendAlpha: Float = 0.65f,
        minSat: Float = 0.06f,
        minChroma: Float = 12f / 255f,
        whiteBalanceGainR: Float = 1.0f,
        whiteBalanceGainG: Float = 1.0f,
        whiteBalanceGainB: Float = 1.0f,
        rawOutput: Boolean = false,
    ): Bitmap? {
        if (!initialized || programId == 0) return null

        // Save current GL state
        val prevFbo = IntArray(1)
        GLES30.glGetIntegerv(GLES30.GL_FRAMEBUFFER_BINDING, prevFbo, 0)
        val prevViewport = IntArray(4)
        GLES30.glGetIntegerv(GLES30.GL_VIEWPORT, prevViewport, 0)

        // Bind our FBO
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fboId)
        GLES30.glViewport(0, 0, outputSize, outputSize)
        GLES30.glClearColor(1f, 1f, 1f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)

        GLES30.glUseProgram(programId)

        // Bind camera OES texture to unit 0
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTextureId)
        GLES30.glUniform1i(uCameraTextureLoc, 0)

        // Bind subject mask to unit 1
        GLES30.glActiveTexture(GLES30.GL_TEXTURE1)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, maskTextureId)
        GLES30.glUniform1i(uSubjectMaskLoc, 1)

        // Bind reference texture to unit 2
        GLES30.glActiveTexture(GLES30.GL_TEXTURE2)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, referenceTextureId)
        GLES30.glUniform1i(uReferenceTextureLoc, 2)

        // Bind previous frame to unit 3
        GLES30.glActiveTexture(GLES30.GL_TEXTURE3)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, prevTextureId)
        GLES30.glUniform1i(uPreviousFrameLoc, 3)

        // Set uniforms
        GLES30.glUniformMatrix3fv(uHomographyLoc, 1, false, homography, 0)
        GLES30.glUniform1f(uHasPreviousLoc, if (hasPreviousFrame) 1f else 0f)
        GLES30.glUniform1f(uHasMaskLoc, if (hasMask) 1f else 0f)
        GLES30.glUniform1f(uHasReferenceLoc, if (hasReference) 1f else 0f)
        GLES30.glUniform1f(uBlendAlphaLoc, blendAlpha)
        GLES30.glUniform1f(uMinDrawingSatLoc, minSat)
        GLES30.glUniform1f(uMinDrawingChromaLoc, minChroma)
        GLES30.glUniform3f(uWhiteBalanceGainLoc, whiteBalanceGainR, whiteBalanceGainG, whiteBalanceGainB)
        GLES30.glUniform1f(uRawOutputLoc, if (rawOutput) 1f else 0f)

        // Draw fullscreen quad
        GLES30.glBindVertexArray(quadVao)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLE_STRIP, 0, 4)
        GLES30.glBindVertexArray(0)

        if (!rawOutput) {
            // Copy result to previous-frame texture for next frame's temporal blending
            GLES30.glActiveTexture(GLES30.GL_TEXTURE3)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, prevTextureId)
            GLES30.glCopyTexSubImage2D(
                GLES30.GL_TEXTURE_2D, 0, 0, 0, 0, 0, outputSize, outputSize,
            )
            hasPreviousFrame = true
        }

        // Read back pixels
        val buffer = readbackBuffer ?: return null
        buffer.rewind()
        GLES30.glReadPixels(
            0, 0, outputSize, outputSize,
            GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, buffer,
        )

        // Restore GL state
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, prevFbo[0])
        GLES30.glViewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3])
        GLES30.glUseProgram(0)

        // Convert RGBA bytes to ARGB bitmap (OpenGL is bottom-up, flip Y)
        val pixels = readbackPixels ?: return null
        buffer.rewind()
        for (row in 0 until outputSize) {
            val flippedRow = outputSize - 1 - row
            val rowOffset = flippedRow * outputSize
            for (col in 0 until outputSize) {
                val r = buffer.get().toInt() and 0xFF
                val g = buffer.get().toInt() and 0xFF
                val b = buffer.get().toInt() and 0xFF
                buffer.get() // skip alpha
                pixels[rowOffset + col] = (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
        }

        val bitmap = reusableBitmap?.takeIf {
            !it.isRecycled && it.width == outputSize && it.height == outputSize
        } ?: Bitmap.createBitmap(outputSize, outputSize, Bitmap.Config.ARGB_8888).also {
            reusableBitmap = it
        }
        bitmap.setPixels(pixels, 0, outputSize, 0, 0, outputSize, outputSize)
        return bitmap
    }

    /** Reset temporal blending state (e.g., when switching sheets). */
    fun resetPreviousFrame() {
        hasPreviousFrame = false
    }

    fun isInitialized(): Boolean = initialized

    fun getOutputSize(): Int = outputSize

    fun release() {
        if (programId != 0) { GLES30.glDeleteProgram(programId); programId = 0 }
        if (fboId != 0) { GLES30.glDeleteFramebuffers(1, intArrayOf(fboId), 0); fboId = 0 }
        if (fboTextureId != 0) { GLES30.glDeleteTextures(1, intArrayOf(fboTextureId), 0); fboTextureId = 0 }
        if (prevTextureId != 0) { GLES30.glDeleteTextures(1, intArrayOf(prevTextureId), 0); prevTextureId = 0 }
        if (maskTextureId != 0) { GLES30.glDeleteTextures(1, intArrayOf(maskTextureId), 0); maskTextureId = 0 }
        if (referenceTextureId != 0) { GLES30.glDeleteTextures(1, intArrayOf(referenceTextureId), 0); referenceTextureId = 0 }
        if (quadVao != 0) { GLES30.glDeleteVertexArrays(1, intArrayOf(quadVao), 0); quadVao = 0 }
        if (quadVbo != 0) { GLES30.glDeleteBuffers(1, intArrayOf(quadVbo), 0); quadVbo = 0 }
        reusableBitmap?.recycle()
        reusableBitmap = null
        initialized = false
        hasPreviousFrame = false
        hasReference = false
    }

    // ── GL Helpers ──

    private fun createRgbaTexture(size: Int): Int {
        val ids = IntArray(1)
        GLES30.glGenTextures(1, ids, 0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, ids[0])
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
        GLES30.glTexImage2D(
            GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA, size, size, 0,
            GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, null,
        )
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, 0)
        return ids[0]
    }

    private fun uploadBitmapToTexture(textureId: Int, bitmap: Bitmap) {
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, textureId)
        android.opengl.GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, bitmap, 0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, 0)
    }

    private fun createProgram(vertexSource: String, fragmentSource: String): Int {
        val vertexShader = compileShader(GLES30.GL_VERTEX_SHADER, vertexSource)
        if (vertexShader == 0) return 0
        val fragmentShader = compileShader(GLES30.GL_FRAGMENT_SHADER, fragmentSource)
        if (fragmentShader == 0) { GLES30.glDeleteShader(vertexShader); return 0 }

        val program = GLES30.glCreateProgram()
        GLES30.glAttachShader(program, vertexShader)
        GLES30.glAttachShader(program, fragmentShader)
        GLES30.glLinkProgram(program)
        val linkStatus = IntArray(1)
        GLES30.glGetProgramiv(program, GLES30.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] == 0) {
            Log.e(tag, "Program link failed: ${GLES30.glGetProgramInfoLog(program)}")
            GLES30.glDeleteProgram(program)
            GLES30.glDeleteShader(vertexShader)
            GLES30.glDeleteShader(fragmentShader)
            return 0
        }
        GLES30.glDeleteShader(vertexShader)
        GLES30.glDeleteShader(fragmentShader)
        return program
    }

    private fun compileShader(type: Int, source: String): Int {
        val shader = GLES30.glCreateShader(type)
        GLES30.glShaderSource(shader, source)
        GLES30.glCompileShader(shader)
        val compileStatus = IntArray(1)
        GLES30.glGetShaderiv(shader, GLES30.GL_COMPILE_STATUS, compileStatus, 0)
        if (compileStatus[0] == 0) {
            val typeName = if (type == GLES30.GL_VERTEX_SHADER) "vertex" else "fragment"
            Log.e(tag, "$typeName shader compile failed: ${GLES30.glGetShaderInfoLog(shader)}")
            GLES30.glDeleteShader(shader)
            return 0
        }
        return shader
    }

    private fun allocateFloatBuffer(data: FloatArray): FloatBuffer {
        return ByteBuffer.allocateDirect(data.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
            .put(data)
            .also { it.position(0) }
    }

    companion object {
        private const val VERTEX_SHADER = """#version 300 es
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTexCoord = aTexCoord;
}
"""

        private const val FRAGMENT_SHADER = """#version 300 es
#extension GL_OES_EGL_image_external_essl3 : require
precision mediump float;

uniform samplerExternalOES uCameraTexture;
uniform sampler2D uSubjectMask;
uniform sampler2D uReferenceTexture;
uniform sampler2D uPreviousFrame;
uniform mat3 uHomography;
uniform float uHasPrevious;
uniform float uHasMask;
uniform float uHasReference;
uniform float uBlendAlpha;
uniform float uMinDrawingSat;
uniform float uMinDrawingChroma;
uniform vec3 uWhiteBalanceGain;
uniform float uRawOutput;

in vec2 vTexCoord;
out vec4 fragColor;

// ── HSV conversion (standard) ──
vec3 rgb2hsv(vec3 c) {
    float cMax = max(max(c.r, c.g), c.b);
    float cMin = min(min(c.r, c.g), c.b);
    float delta = cMax - cMin;
    float h = 0.0;
    if (delta > 0.001) {
        if (cMax == c.r)      h = mod((c.g - c.b) / delta, 6.0);
        else if (cMax == c.g) h = (c.b - c.r) / delta + 2.0;
        else                  h = (c.r - c.g) / delta + 4.0;
        h = h / 6.0;
        if (h < 0.0) h += 1.0;
    }
    float s = (cMax > 0.001) ? delta / cMax : 0.0;
    return vec3(h * 360.0, s, cMax);
}

// ── Skin tone detection (tightened to avoid catching orange/warm crayons) ──
bool isSkinTone(vec3 rgb255, vec3 hsv) {
    float hue = hsv.x;
    float sat = hsv.y;
    float val_ = hsv.z;
    // Keep skin range focused so warm crayons are not rejected as hand pixels.
    bool hsvMatch = hue >= 12.0 && hue <= 32.0 &&
                    sat >= 0.14 && sat <= 0.36 &&
                    val_ >= 0.22 && val_ <= 0.88;
    // Skin tends to have moderate channel spread; crayons are usually higher-chroma.
    float r = rgb255.r; float g = rgb255.g; float b = rgb255.b;
    float delta = r - g;
    bool rgbMatch = r >= 78.0 && r <= 235.0 &&
                    g >= 48.0 && g <= 202.0 &&
                    b >= 28.0 && b <= 165.0 &&
                    r > g && r > b &&
                    delta >= 12.0 && delta <= 46.0;
    if (!(hsvMatch && rgbMatch)) {
        return false;
    }
    float chroma = max(max(r, g), b) - min(min(r, g), b);
    bool likelyWarmCrayon = sat >= 0.12 && chroma >= 32.0;
    return !likelyWarmCrayon;
}

float colorDistanceSq(vec3 a255, vec3 b255) {
    vec3 delta = a255 - b255;
    return dot(delta, delta);
}

bool isNeutralOccluder(vec3 hsv) {
    float value = hsv.z;
    float saturation = hsv.y;
    return ((value >= 0.05 && value <= 0.55 && saturation <= 0.22) || value < 0.08);
}

void main() {
    // 2. Project output UV through homography to camera texture UV
    vec3 srcCoord = uHomography * vec3(vTexCoord, 1.0);
    vec2 camUV = srcCoord.xy / srcCoord.z;
    // Clamp to valid range
    camUV = clamp(camUV, vec2(0.0), vec2(1.0));

    // 3. Sample camera (OES extension provides RGB directly — no CPU YUV conversion!)
    vec4 camColor = texture(uCameraTexture, camUV);
    vec3 rawRgb = clamp(camColor.rgb, vec3(0.0), vec3(1.0));
    vec3 rgb = rawRgb;
    vec3 rgb255 = rgb * 255.0;
    vec3 hsv = rgb2hsv(rgb);
    float sat = hsv.y;
    float val_ = hsv.z;
    float chroma = (max(max(rgb.r, rgb.g), rgb.b) - min(min(rgb.r, rgb.g), rgb.b));
    float chroma255 = chroma * 255.0;

    if (uRawOutput > 0.5) {
        fragColor = vec4(rawRgb, 1.0);
        return;
    }

    // Previous accepted texture used as hysteresis buffer.
    vec4 prevColor = (uHasPrevious > 0.5) ? texture(uPreviousFrame, vTexCoord) : vec4(1.0);

    // Subject mask gate: reject UVs outside bear region up front.
    if (uHasMask > 0.5) {
        float maskVal = texture(uSubjectMask, vTexCoord).r;
        if (maskVal < 0.5) {
            fragColor = (uHasPrevious > 0.5) ? prevColor : vec4(1.0);
            return;
        }
    }

    // 4. Reference-aware colored-pixel classification (GPU port of CPU logic)
    bool likelySkin = isSkinTone(rgb255, hsv);
    bool likelyNeutral = isNeutralOccluder(hsv);
    bool userColored = false;

    if (!likelySkin && !likelyNeutral) {
        if (uHasReference > 0.5) {
            vec3 referenceRgb255 = texture(uReferenceTexture, vTexCoord).rgb * 255.0;
            float refDeltaSq = colorDistanceSq(rgb255, referenceRgb255);
            if (refDeltaSq >= 450.0 &&
                !(sat < 0.04 && chroma255 < 8.0) &&
                val_ >= 0.10 &&
                !(sat < 0.03 && val_ > 0.88)) {
                userColored = true;
            }
        } else if (sat >= uMinDrawingSat && val_ >= 0.10 && chroma >= uMinDrawingChroma) {
            userColored = true;
        }
    }

    if (userColored) {
        // Vivid saturation boost to make colors pop on 3D model
        vec3 boosted = rgb;
        float satBoost = (sat < 0.25) ? 1.50 : (sat < 0.45) ? 1.35 : 1.22;
        float valBoost = (val_ < 0.40) ? 1.25 : (val_ < 0.65) ? 1.15 : 1.06;
        // Apply boost in HSV space
        vec3 boostedHsv = hsv;
        boostedHsv.y = min(boostedHsv.y * satBoost, 1.0);
        boostedHsv.z = min(boostedHsv.z * valBoost + 0.03, 1.0);
        // HSV to RGB
        float h = boostedHsv.x / 60.0;
        float s = boostedHsv.y;
        float v = boostedHsv.z;
        float c = v * s;
        float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));
        float m = v - c;
        vec3 rgbOut;
        if      (h < 1.0) rgbOut = vec3(c, x, 0.0);
        else if (h < 2.0) rgbOut = vec3(x, c, 0.0);
        else if (h < 3.0) rgbOut = vec3(0.0, c, x);
        else if (h < 4.0) rgbOut = vec3(0.0, x, c);
        else if (h < 5.0) rgbOut = vec3(x, 0.0, c);
        else              rgbOut = vec3(c, 0.0, x);
        boosted = rgbOut + vec3(m);

        // Temporal blend with previous frame for noise reduction
        if (uHasPrevious > 0.5) {
            fragColor = vec4(mix(prevColor.rgb, boosted, uBlendAlpha), 1.0);
        } else {
            fragColor = vec4(boosted, 1.0);
        }
        return;
    }

    // 6. Ambiguous/background/hand pixel → previous accepted texture or WHITE
    fragColor = (uHasPrevious > 0.5) ? prevColor : vec4(1.0);
}
"""
    }
}
