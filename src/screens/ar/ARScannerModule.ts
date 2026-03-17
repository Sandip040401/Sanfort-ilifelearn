import {NativeModules} from 'react-native';

const {ARNativeModule} = NativeModules;

export const ARScannerModule = {
  isARSupported: async (): Promise<boolean> => {
    if (!ARNativeModule?.isARScannerSupported) {
      return false;
    }
    return ARNativeModule.isARScannerSupported();
  },

  checkScannerAssets: async (
    referenceImageAsset: string,
    modelAsset: string,
  ): Promise<{referenceImageExists: boolean; modelExists: boolean}> => {
    if (!ARNativeModule?.checkScannerAssets) {
      return {referenceImageExists: false, modelExists: false};
    }
    return ARNativeModule.checkScannerAssets(referenceImageAsset, modelAsset);
  },

  startScanner: (referenceImageAsset: string, modelAsset: string): void => {
    if (!ARNativeModule?.startScanner) {
      throw new Error(
        'ARScannerModule is not linked. Build the Android app again.',
      );
    }
    ARNativeModule.startScanner(referenceImageAsset, modelAsset);
  },

  startScannerDynamic: async (
    modelUrl: string,
    referenceImageUrl: string,
    modelName: string,
    audiosJson?: string,
  ): Promise<boolean> => {
    if (!ARNativeModule?.startScannerDynamic) {
      throw new Error(
        'ARScannerModule.startScannerDynamic is not linked. Build the Android app again.',
      );
    }
    return ARNativeModule.startScannerDynamic(modelUrl, referenceImageUrl, modelName, audiosJson || null);
  },
};
