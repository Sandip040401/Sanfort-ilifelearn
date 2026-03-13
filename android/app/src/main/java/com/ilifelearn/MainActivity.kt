package com.ilifelearn

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "iLifeLearn"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Install SplashScreen (Android 12+)
    val splash = installSplashScreen()

    // Hold splash for ~1s (smooth brand reveal)
    var keepSplashOn = true
    splash.setKeepOnScreenCondition { keepSplashOn }
    Handler(Looper.getMainLooper()).postDelayed({
      keepSplashOn = false
    }, 1000)

    // Fade out when leaving splash
    splash.setOnExitAnimationListener { provider ->
      val v: View = provider.view
      v.animate()
        .alpha(0f)
        .setDuration(250)
        .withEndAction { provider.remove() }
        .start()
    }

    // Pass null — prevents crash when Android recreates activity after process kill
    super.onCreate(null)

    // Edge-to-edge: draw content under status & nav bars
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // Control system bar icon appearance (dark icons on light UI)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    controller.isAppearanceLightStatusBars = true
    controller.isAppearanceLightNavigationBars = true
  }
}
