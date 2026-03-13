package com.ilifelearn.ar

import android.graphics.Bitmap
import android.graphics.Color
import android.media.Image
import com.google.ar.core.Frame
import com.google.ar.core.exceptions.NotYetAvailableException
import kotlin.math.max
import kotlin.math.roundToInt

object CameraColorSampler {
  fun sampleDominantColor(frame: Frame): Int? {
    return sampleDominantColor(frame, null)
  }

  fun sampleDominantColor(frame: Frame, preferredPointsPx: List<Pair<Float, Float>>?): Int? {
    val image = try {
      frame.acquireCameraImage()
    } catch (_: NotYetAvailableException) {
      return null
    }

    return try {
      sampleDominantColor(image, preferredPointsPx)
    } finally {
      image.close()
    }
  }

  fun sampleRegionBitmap(
      frame: Frame,
      minX: Int,
      minY: Int,
      maxX: Int,
      maxY: Int,
      outputSize: Int,
  ): Bitmap? {
    val image = try {
      frame.acquireCameraImage()
    } catch (_: NotYetAvailableException) {
      return null
    }

    return try {
      sampleRegionBitmap(image, minX, minY, maxX, maxY, outputSize)
    } finally {
      image.close()
    }
  }

  fun sampleQuadBitmap(
      frame: Frame,
      cornersPx: List<Pair<Float, Float>>,
      outputSize: Int,
  ): Bitmap? {
    val image = try {
      frame.acquireCameraImage()
    } catch (_: NotYetAvailableException) {
      return null
    }

    return try {
      sampleQuadBitmap(image, cornersPx, outputSize)
    } finally {
      image.close()
    }
  }

  fun sampleCenterBitmap(
      frame: Frame,
      outputSize: Int,
      widthRatio: Float,
      heightRatio: Float,
  ): Bitmap? {
    val image = try {
      frame.acquireCameraImage()
    } catch (_: NotYetAvailableException) {
      return null
    }

    return try {
      val safeWidthRatio = widthRatio.coerceIn(0.12f, 0.90f)
      val safeHeightRatio = heightRatio.coerceIn(0.12f, 0.90f)
      val halfWidth = ((image.width * safeWidthRatio) * 0.5f).roundToInt().coerceAtLeast(1)
      val halfHeight = ((image.height * safeHeightRatio) * 0.5f).roundToInt().coerceAtLeast(1)
      val centerX = image.width / 2
      val centerY = image.height / 2
      sampleRegionBitmap(
          image = image,
          minX = centerX - halfWidth,
          minY = centerY - halfHeight,
          maxX = centerX + halfWidth,
          maxY = centerY + halfHeight,
          outputSize = outputSize,
      )
    } finally {
      image.close()
    }
  }

  private fun sampleDominantColor(
      image: Image,
      preferredPointsPx: List<Pair<Float, Float>>?,
  ): Int? {
    val usingPreferredPoints = !preferredPointsPx.isNullOrEmpty()
    val centerX = image.width / 2
    val centerY = image.height / 2
    val offsetX =
        if (usingPreferredPoints) {
          (image.width * 0.008f).toInt().coerceAtLeast(2)
        } else {
          (image.width * 0.05f).toInt().coerceAtLeast(4)
        }
    val offsetY =
        if (usingPreferredPoints) {
          (image.height * 0.008f).toInt().coerceAtLeast(2)
        } else {
          (image.height * 0.05f).toInt().coerceAtLeast(4)
        }

    val samplePoints =
        preferredPointsPx
            ?.takeIf { it.isNotEmpty() }
            ?.flatMap { (x, y) ->
              val px = x.roundToInt()
              val py = y.roundToInt()
              listOf(
                  px to py,
                  px - offsetX / 2 to py,
                  px + offsetX / 2 to py,
                  px to py - offsetY / 2,
                  px to py + offsetY / 2,
              )
            }
            ?.ifEmpty { null }
            ?: listOf(
                centerX to centerY,
                centerX - offsetX to centerY,
                centerX + offsetX to centerY,
                centerX to centerY - offsetY,
                centerX to centerY + offsetY,
                centerX - offsetX to centerY - offsetY,
                centerX + offsetX to centerY - offsetY,
                centerX - offsetX to centerY + offsetY,
                centerX + offsetX to centerY + offsetY,
            )

    val weightedSamples = mutableListOf<WeightedColorSample>()

    samplePoints.forEach { (x, y) ->
      val safeX = x.coerceIn(0, image.width - 1)
      val safeY = y.coerceIn(0, image.height - 1)
      val rgb = readRgbAt(image, safeX, safeY)
      val luma = (0.2126f * rgb.first) + (0.7152f * rgb.second) + (0.0722f * rgb.third)
      if (luma < MIN_VALID_SAMPLE_LUMA) {
        return@forEach
      }
      val hsv = FloatArray(3)
      Color.RGBToHSV(rgb.first, rgb.second, rgb.third, hsv)
      if (usingPreferredPoints && hsv[2] < MIN_VALID_SAMPLE_BRIGHTNESS) {
        return@forEach
      }
      if (usingPreferredPoints && hsv[1] < MIN_VALID_SAMPLE_SATURATION_PREFERRED) {
        if (hsv[2] > MAX_VALID_PREFERRED_BRIGHTNESS_FOR_LOW_SATURATION) {
          return@forEach
        }
      }

      val weight =
          if (usingPreferredPoints) {
            0.12f + (hsv[1] * 2.8f) + (hsv[2] * 0.45f)
          } else {
            1f
          }
      weightedSamples +=
          WeightedColorSample(
              red = rgb.first,
              green = rgb.second,
              blue = rgb.third,
              saturation = hsv[1],
              value = hsv[2],
              weight = weight,
          )
    }

    if (weightedSamples.isEmpty()) {
      if (usingPreferredPoints) {
        return sampleRelaxedPreferredColor(image, samplePoints)
      }
      return averageRgb(samplePoints.map { (x, y) ->
        val safeX = x.coerceIn(0, image.width - 1)
        val safeY = y.coerceIn(0, image.height - 1)
        readRgbAt(image, safeX, safeY)
      })
    }

    val effectiveSamples =
        if (usingPreferredPoints && weightedSamples.size >= 4) {
          val sorted = weightedSamples.sortedByDescending { it.weight * (0.6f + it.saturation + it.value) }
          val keepCount = max(MIN_EFFECTIVE_SAMPLE_COUNT, (sorted.size * 0.28f).toInt())
          sorted.take(keepCount)
        } else {
          weightedSamples
        }

    var redAcc = 0f
    var greenAcc = 0f
    var blueAcc = 0f
    var weightAcc = 0f
    effectiveSamples.forEach { sample ->
      redAcc += sample.red * sample.weight
      greenAcc += sample.green * sample.weight
      blueAcc += sample.blue * sample.weight
      weightAcc += sample.weight
    }

    val samples = weightAcc.coerceAtLeast(1f)
    return Color.rgb(
        (redAcc / samples).roundToInt().coerceIn(0, 255),
        (greenAcc / samples).roundToInt().coerceIn(0, 255),
        (blueAcc / samples).roundToInt().coerceIn(0, 255),
    )
  }

  private fun sampleRelaxedPreferredColor(
      image: Image,
      samplePoints: List<Pair<Int, Int>>,
  ): Int? {
    val relaxedSamples =
        samplePoints.mapNotNull { (x, y) ->
          val safeX = x.coerceIn(0, image.width - 1)
          val safeY = y.coerceIn(0, image.height - 1)
          val rgb = readRgbAt(image, safeX, safeY)
          val luma = (0.2126f * rgb.first) + (0.7152f * rgb.second) + (0.0722f * rgb.third)
          if (luma < MIN_VALID_SAMPLE_LUMA) {
            return@mapNotNull null
          }
          val hsv = FloatArray(3)
          Color.RGBToHSV(rgb.first, rgb.second, rgb.third, hsv)
          if (hsv[1] < 0.08f && hsv[2] > 0.82f) {
            return@mapNotNull null
          }
          rgb
        }
    if (relaxedSamples.isEmpty()) {
      return null
    }
    return averageRgb(relaxedSamples)
  }

  private fun averageRgb(samples: List<Triple<Int, Int, Int>>): Int {
    if (samples.isEmpty()) {
      return Color.BLACK
    }
    var redAcc = 0f
    var greenAcc = 0f
    var blueAcc = 0f
    samples.forEach { rgb ->
      redAcc += rgb.first.toFloat()
      greenAcc += rgb.second.toFloat()
      blueAcc += rgb.third.toFloat()
    }
    val count = samples.size.toFloat().coerceAtLeast(1f)
    return Color.rgb(
        (redAcc / count).roundToInt().coerceIn(0, 255),
        (greenAcc / count).roundToInt().coerceIn(0, 255),
        (blueAcc / count).roundToInt().coerceIn(0, 255),
    )
  }

  private fun sampleRegionBitmap(
      image: Image,
      minX: Int,
      minY: Int,
      maxX: Int,
      maxY: Int,
      outputSize: Int,
  ): Bitmap? {
    val safeMinX = minX.coerceIn(0, image.width - 1)
    val safeMinY = minY.coerceIn(0, image.height - 1)
    val safeMaxX = maxX.coerceIn(0, image.width - 1)
    val safeMaxY = maxY.coerceIn(0, image.height - 1)
    if (safeMaxX <= safeMinX || safeMaxY <= safeMinY) {
      return null
    }

    val output = outputSize.coerceIn(48, 192)
    val regionWidth = (safeMaxX - safeMinX).coerceAtLeast(1)
    val regionHeight = (safeMaxY - safeMinY).coerceAtLeast(1)
    val pixels = IntArray(output * output)

    for (row in 0 until output) {
      val sourceY = safeMinY + ((row.toFloat() / (output - 1).toFloat()) * regionHeight.toFloat())
      for (col in 0 until output) {
        val sourceX = safeMinX + ((col.toFloat() / (output - 1).toFloat()) * regionWidth.toFloat())
        val rgb = readRgbBilinear(image, sourceX, sourceY, safeMinX, safeMinY, safeMaxX, safeMaxY)
        pixels[row * output + col] = Color.rgb(rgb.first, rgb.second, rgb.third)
      }
    }

    return Bitmap.createBitmap(pixels, output, output, Bitmap.Config.ARGB_8888)
  }

  private fun sampleQuadBitmap(
      image: Image,
      cornersPx: List<Pair<Float, Float>>,
      outputSize: Int,
  ): Bitmap? {
    if (cornersPx.size < 4) {
      return null
    }

    val tl = cornersPx[0]
    val tr = cornersPx[1]
    val br = cornersPx[2]
    val bl = cornersPx[3]
    val homography = computeUnitSquareToQuadHomography(tl, tr, br, bl)
    val output = outputSize.coerceIn(48, 160)
    val pixels = IntArray(output * output)

    for (row in 0 until output) {
      val v = if (output <= 1) 0f else row.toFloat() / (output - 1).toFloat()
      for (col in 0 until output) {
        val u = if (output <= 1) 0f else col.toFloat() / (output - 1).toFloat()
        val sourcePoint =
            homography?.project(u, v) ?: run {
              // Fallback to bilinear interpolation if homography solve fails.
              val x = bilinearScalar(tl.first, tr.first, br.first, bl.first, u, v)
              val y = bilinearScalar(tl.second, tr.second, br.second, bl.second, u, v)
              x to y
            }
        val sourceX = sourcePoint.first
        val sourceY = sourcePoint.second
        val rgb =
            readRgbBilinear(
                image = image,
                sourceX = sourceX,
                sourceY = sourceY,
                minX = 0,
                minY = 0,
                maxX = image.width - 1,
                maxY = image.height - 1,
            )
        pixels[(row * output) + col] = Color.rgb(rgb.first, rgb.second, rgb.third)
      }
    }
    return Bitmap.createBitmap(pixels, output, output, Bitmap.Config.ARGB_8888)
  }

  private fun readRgbBilinear(
      image: Image,
      sourceX: Float,
      sourceY: Float,
      minX: Int,
      minY: Int,
      maxX: Int,
      maxY: Int,
  ): Triple<Int, Int, Int> {
    val x0 = sourceX.toInt().coerceIn(minX, maxX)
    val y0 = sourceY.toInt().coerceIn(minY, maxY)
    val x1 = (x0 + 1).coerceIn(minX, maxX)
    val y1 = (y0 + 1).coerceIn(minY, maxY)

    val fx = (sourceX - x0.toFloat()).coerceIn(0f, 1f)
    val fy = (sourceY - y0.toFloat()).coerceIn(0f, 1f)

    val c00 = readRgbAt(image, x0, y0)
    val c10 = readRgbAt(image, x1, y0)
    val c01 = readRgbAt(image, x0, y1)
    val c11 = readRgbAt(image, x1, y1)

    val red = bilinearChannel(c00.first, c10.first, c01.first, c11.first, fx, fy)
    val green = bilinearChannel(c00.second, c10.second, c01.second, c11.second, fx, fy)
    val blue = bilinearChannel(c00.third, c10.third, c01.third, c11.third, fx, fy)
    return Triple(red, green, blue)
  }

  private fun bilinearChannel(
      c00: Int,
      c10: Int,
      c01: Int,
      c11: Int,
      fx: Float,
      fy: Float,
  ): Int {
    val top = (c00 * (1f - fx)) + (c10 * fx)
    val bottom = (c01 * (1f - fx)) + (c11 * fx)
    return ((top * (1f - fy)) + (bottom * fy)).roundToInt().coerceIn(0, 255)
  }

  private fun bilinearScalar(
      q00: Float,
      q10: Float,
      q11: Float,
      q01: Float,
      u: Float,
      v: Float,
  ): Float {
    val top = (q00 * (1f - u)) + (q10 * u)
    val bottom = (q01 * (1f - u)) + (q11 * u)
    return (top * (1f - v)) + (bottom * v)
  }

  private fun computeUnitSquareToQuadHomography(
      tl: Pair<Float, Float>,
      tr: Pair<Float, Float>,
      br: Pair<Float, Float>,
      bl: Pair<Float, Float>,
  ): Homography? {
    val points =
        arrayOf(
            Triple(0.0, 0.0, tl),
            Triple(1.0, 0.0, tr),
            Triple(1.0, 1.0, br),
            Triple(0.0, 1.0, bl),
        )

    val a = Array(8) { DoubleArray(8) }
    val b = DoubleArray(8)
    var row = 0
    points.forEach { (u, v, dst) ->
      val x = dst.first.toDouble()
      val y = dst.second.toDouble()

      a[row][0] = u
      a[row][1] = v
      a[row][2] = 1.0
      a[row][3] = 0.0
      a[row][4] = 0.0
      a[row][5] = 0.0
      a[row][6] = -u * x
      a[row][7] = -v * x
      b[row] = x
      row += 1

      a[row][0] = 0.0
      a[row][1] = 0.0
      a[row][2] = 0.0
      a[row][3] = u
      a[row][4] = v
      a[row][5] = 1.0
      a[row][6] = -u * y
      a[row][7] = -v * y
      b[row] = y
      row += 1
    }

    val solved = solveLinearSystem(a, b) ?: return null
    return Homography(
        h00 = solved[0].toFloat(),
        h01 = solved[1].toFloat(),
        h02 = solved[2].toFloat(),
        h10 = solved[3].toFloat(),
        h11 = solved[4].toFloat(),
        h12 = solved[5].toFloat(),
        h20 = solved[6].toFloat(),
        h21 = solved[7].toFloat(),
        h22 = 1f,
    )
  }

  private fun solveLinearSystem(matrix: Array<DoubleArray>, rhs: DoubleArray): DoubleArray? {
    val n = rhs.size
    for (pivot in 0 until n) {
      var bestRow = pivot
      var bestAbs = kotlin.math.abs(matrix[pivot][pivot])
      for (candidate in (pivot + 1) until n) {
        val absValue = kotlin.math.abs(matrix[candidate][pivot])
        if (absValue > bestAbs) {
          bestAbs = absValue
          bestRow = candidate
        }
      }
      if (bestAbs < 1e-9) {
        return null
      }

      if (bestRow != pivot) {
        val tmpRow = matrix[pivot]
        matrix[pivot] = matrix[bestRow]
        matrix[bestRow] = tmpRow
        val tmpRhs = rhs[pivot]
        rhs[pivot] = rhs[bestRow]
        rhs[bestRow] = tmpRhs
      }

      val pivotValue = matrix[pivot][pivot]
      for (col in pivot until n) {
        matrix[pivot][col] /= pivotValue
      }
      rhs[pivot] /= pivotValue

      for (row in 0 until n) {
        if (row == pivot) continue
        val factor = matrix[row][pivot]
        if (kotlin.math.abs(factor) < 1e-12) continue
        for (col in pivot until n) {
          matrix[row][col] -= factor * matrix[pivot][col]
        }
        rhs[row] -= factor * rhs[pivot]
      }
    }
    return rhs
  }

  private data class Homography(
      val h00: Float,
      val h01: Float,
      val h02: Float,
      val h10: Float,
      val h11: Float,
      val h12: Float,
      val h20: Float,
      val h21: Float,
      val h22: Float,
  ) {
    fun project(u: Float, v: Float): Pair<Float, Float> {
      val denominator = (h20 * u) + (h21 * v) + h22
      if (kotlin.math.abs(denominator) < 1e-6f) {
        return 0f to 0f
      }
      val x = ((h00 * u) + (h01 * v) + h02) / denominator
      val y = ((h10 * u) + (h11 * v) + h12) / denominator
      return x to y
    }
  }

  private fun readRgbAt(image: Image, x: Int, y: Int): Triple<Int, Int, Int> {
    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]

    val yValue =
        yPlane.buffer.get(y * yPlane.rowStride + x * yPlane.pixelStride).toInt() and 0xFF

    val uvX = x / 2
    val uvY = y / 2
    val uValue =
        (uPlane.buffer.get(uvY * uPlane.rowStride + uvX * uPlane.pixelStride).toInt() and 0xFF) -
            128
    val vValue =
        (vPlane.buffer.get(uvY * vPlane.rowStride + uvX * vPlane.pixelStride).toInt() and 0xFF) -
            128

    val red = (yValue + 1.370705f * vValue).roundToInt().coerceIn(0, 255)
    val green = (yValue - 0.337633f * uValue - 0.698001f * vValue).roundToInt().coerceIn(0, 255)
    val blue = (yValue + 1.732446f * uValue).roundToInt().coerceIn(0, 255)
    return Triple(red, green, blue)
  }

  private data class WeightedColorSample(
      val red: Int,
      val green: Int,
      val blue: Int,
      val saturation: Float,
      val value: Float,
      val weight: Float,
  )

  private const val MIN_VALID_SAMPLE_LUMA = 16f
  private const val MIN_VALID_SAMPLE_BRIGHTNESS = 0.03f
  private const val MIN_VALID_SAMPLE_SATURATION_PREFERRED = 0.03f
  private const val MAX_VALID_PREFERRED_BRIGHTNESS_FOR_LOW_SATURATION = 0.80f
  private const val MIN_EFFECTIVE_SAMPLE_COUNT = 3
}
