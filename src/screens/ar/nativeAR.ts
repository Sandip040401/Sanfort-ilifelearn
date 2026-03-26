import {Linking, NativeModules, Platform} from 'react-native';
import {ARService} from '@/services';

export interface NativeARAudio {
  gridfsId: string;
  language: string;
  level: string;
  audioUrl: string;
}

function buildAudiosJson(audios?: Array<{gridfsId: string; language: string; level: string}>) {
  const audiosWithUrl: NativeARAudio[] | undefined = audios?.map(audio => ({
    ...audio,
    audioUrl: ARService.getAudioStreamUrlById(audio.gridfsId),
  }));
  return audiosWithUrl ? JSON.stringify(audiosWithUrl) : null;
}

function getSceneViewerIntent(modelUrl: string, modelName: string) {
  return `intent://arvr.google.com/scene-viewer/1.2?mode=ar_preferred&file=${encodeURIComponent(modelUrl)}&title=${encodeURIComponent(modelName)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;end;`;
}

export async function openModelInAR(params: {
  modelUrl: string;
  modelName: string;
  audios?: Array<{gridfsId: string; language: string; level: string}>;
  animations?: string[];
  modelType?: string;
}) {
  const {modelUrl, modelName, audios, animations, modelType} = params;

  if (Platform.OS === 'android' && NativeModules.ARNativeModule?.openAR) {
    NativeModules.ARNativeModule.openAR(
      modelUrl,
      modelName,
      buildAudiosJson(audios),
      animations?.length ? JSON.stringify(animations) : null,
      modelType || null,
    );
    return;
  }

  if (Platform.OS === 'android') {
    const httpsUrl = `https://arvr.google.com/scene-viewer/1.2?file=${encodeURIComponent(modelUrl)}&mode=ar_preferred&title=${encodeURIComponent(modelName)}`;
    try {
      await Linking.openURL(getSceneViewerIntent(modelUrl, modelName));
      return;
    } catch {
      await Linking.openURL(httpsUrl);
      return;
    }
  }

  await Linking.openURL(modelUrl);
}

export async function openModelInARFromBase64(params: {
  modelBase64: string;
  modelName: string;
  originalModelUrl?: string;
  audios?: Array<{gridfsId: string; language: string; level: string}>;
  animations?: string[];
  modelType?: string;
}) {
  const {modelBase64, modelName, originalModelUrl, audios, animations, modelType} = params;

  if (Platform.OS === 'android' && NativeModules.ARNativeModule?.openARFromBase64) {
    await NativeModules.ARNativeModule.openARFromBase64(
      modelBase64,
      modelName,
      originalModelUrl || null,
      buildAudiosJson(audios),
      animations?.length ? JSON.stringify(animations) : null,
      modelType || null,
    );
    return;
  }

  throw new Error('Custom AR export is only available on native Android builds.');
}
