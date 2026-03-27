package com.sanfortsmartlearning.ar

import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.sceneform.ux.ArFragment
import com.google.ar.sceneform.ux.InstructionsController

/**
 * AR fragment tuned for markerless floor/plane placement.
 * This is used by "3D Color & Place" flow (not image/marker scan flow).
 */
class ARFloorTrackingFragment : ArFragment() {
    override fun onCreateSessionConfig(session: Session): Config {
        val config =
                super.onCreateSessionConfig(session).apply {
                    focusMode = Config.FocusMode.AUTO
                    updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                    lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
                    planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                    instantPlacementMode = Config.InstantPlacementMode.LOCAL_Y_UP
                    depthMode =
                            if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
                                Config.DepthMode.AUTOMATIC
                            } else {
                                Config.DepthMode.DISABLED
                            }
                }

        instructionsController.setEnabled(InstructionsController.TYPE_PLANE_DISCOVERY, true)
        instructionsController.setVisible(InstructionsController.TYPE_PLANE_DISCOVERY, true)
        return config
    }
}
