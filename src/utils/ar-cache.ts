import RNFS from 'react-native-fs';
export { RNFS };
import { Platform } from 'react-native';

const AR_MODELS_DIR = `${RNFS.DocumentDirectoryPath}/ARModels`;

/**
 * Ensures the root directory for AR models exists.
 */
export const ensureArDirectory = async () => {
  const exists = await RNFS.exists(AR_MODELS_DIR);
  if (!exists) {
    await RNFS.mkdir(AR_MODELS_DIR);
  }
};

/**
 * Returns the local path where a specific model should be stored.
 */
export const getLocalModelPath = (modelId: string) => {
  // Use a clean filename or folder
  return `${AR_MODELS_DIR}/${modelId}.glb`;
};

/**
 * Checks if a model is already downloaded locally.
 */
export const isModelDownloaded = async (modelId: string) => {
  const path = getLocalModelPath(modelId);
  return await RNFS.exists(path);
};

/**
 * Downloads a model to the local filesystem.
 */
export const downloadModel = async (
  modelId: string,
  remoteUrl: string,
  onProgress?: (progress: number) => void
) => {
  await ensureArDirectory();
  const localPath = getLocalModelPath(modelId);

  // If a temporary download exists for this model, delete it?
  // RNFS handles overwriting.

  const options: RNFS.DownloadFileOptions = {
    fromUrl: remoteUrl,
    toFile: localPath,
    progress: (res) => {
      const percentage = (res.bytesWritten / res.contentLength) * 100;
      onProgress?.(percentage);
    },
    progressDivider: 1, // Detailed progress
  };

  const result = RNFS.downloadFile(options);
  const response = await result.promise;

  if (response.statusCode === 200) {
    return `file://${localPath}`;
  } else {
    throw new Error(`Download failed with status code ${response.statusCode}`);
  }
};

/**
 * Deletes a local model to free up space.
 */
export const removeDownloadedModel = async (modelId: string) => {
  const path = getLocalModelPath(modelId);
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
};
