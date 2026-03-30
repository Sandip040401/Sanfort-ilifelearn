import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  NativeModules,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import { WebView } from 'react-native-webview';
import Video, { type VideoRef } from 'react-native-video';
import {
  ChevronLeft,
  CheckCircle2,
  Image as ImageIcon,
  Lightbulb,
  Menu,
  Palette,
  Pause,
  Play,
  Plus,
  Search,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Minus,
  Eraser,
} from 'lucide-react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { ARService } from '@/services';
import ARInstructionModal from '@/components/ARInstructionModal';
import type { ARAudioTrack, ARModel, MainStackParamList } from '@/types';
import {
  type AREnvironmentView,
  getBrowsableEnvironments,
  getModelsForEnvironment,
  getModelStableId,
  sortLanguages,
  sortLevels,
} from './ar.data';
import { buildARViewerHtml, buildColorSheetHtml } from './arViewerHtml';
import { openModelInAR, openModelInARFromBase64 } from './nativeAR';
import {
  normalizeReferenceForDisplay,
  getReferenceImageSource,
} from './ar.reference';
import ARIcon from '@/components/icons/ARIcon';
import AnimationIcon from '@/components/icons/AnimationIcon';
import Rotate360Icon from '@/components/icons/Rotate360Icon';

type ARViewerRouteProp = RouteProp<MainStackParamList, 'ARViewer'>;
type ARViewerNavigationProp = StackNavigationProp<MainStackParamList, 'ARViewer'>;

const LIGHTING_OPTIONS = [
  { name: 'sunset', label: 'Sunset', bgColors: ['#1a0a2e', '#4a1c5c', '#d4576b', '#f4a460'] as string[] },
  { name: 'dawn', label: 'Dawn', bgColors: ['#0d1b2a', '#1b263b', '#e63946', '#ffbe0b'] as string[] },
  { name: 'night', label: 'Night', bgColors: ['#0b1226', '#07102a', '#0a0e1a', '#0b1226'] as string[] },
  { name: 'warehouse', label: 'Studio', bgColors: ['#2d3436', '#4a4a4a', '#636e72', '#2d3436'] as string[] },
  { name: 'forest', label: 'Forest', bgColors: ['#0a1d10', '#1a3c28', '#2d5a3d', '#4a7c59'] as string[] },
  { name: 'apartment', label: 'Room', bgColors: ['#f5f5dc', '#d4c4a8', '#c9b896', '#f5f5dc'] as string[] },
];

const CustomSlider = ({
  value,
  min,
  max,
  onChange,
  color = '#6C4CFF',
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  color?: string;
}) => {
  const [trackWidth, setTrackWidth] = useState(0);

  const handleGesture = (event: any) => {
    if (trackWidth <= 0) return;
    const { x } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, x / trackWidth));
    const newVal = Math.round(min + ratio * (max - min));
    onChange(newVal);
  };

  const filling = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <PanGestureHandler
      onGestureEvent={handleGesture}
      onHandlerStateChange={(e) => {
        if (e.nativeEvent.state === State.ACTIVE || e.nativeEvent.state === State.BEGAN) {
          handleGesture(e);
        }
      }}
      activeOffsetX={[-5, 5]}
      failOffsetY={[-20, 20]}
    >
      <View
        style={styles.customSliderContainer}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}>
        <View style={styles.customSliderTrack}>
          <View style={[styles.customSliderFill, { width: `${filling}%`, backgroundColor: color }]} />
        </View>
        <View style={[styles.customSliderThumb, { left: `${filling}%`, backgroundColor: '#fff' }]} />
      </View>
    </PanGestureHandler>
  );
};

const COLOR_SWATCHES = ['#ff0000', '#00b894', '#0984e3', '#fdcb6e', '#6c5ce7', '#e17055', '#00cec9', '#fd79a8'];
const TARGET_ASSETS: Record<string, string> = {
  Bear: 'https://i.ibb.co/HfV3WzxQ/Bear.jpg',
  Dog: 'https://i.ibb.co/1fM6PTmP/Dog.jpg',
  Dolphin: 'https://i.ibb.co/cStPr4fY/Dolphin.jpg',
  Elephant: 'https://i.ibb.co/p6WG1hLc/Elephant.jpg',
  Wolf: 'https://i.ibb.co/35LpnYGX/Wolf.jpg',
};

const AUDIO_BUFFER_CONFIG = {
  minBufferMs: 700,
  maxBufferMs: 6000,
  bufferForPlaybackMs: 120,
  bufferForPlaybackAfterRebufferMs: 250,
  cacheSizeMB: 80,
} as const;


function ModelPreviewImage({
  thumbnailUri,
  previewUri,
  fallbackIcon,
  style,
  resizeMode = 'cover'
}: {
  thumbnailUri?: string | null;
  previewUri?: string | null;
  fallbackIcon: string;
  style: any;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}) {
  const [currentUri, setCurrentUri] = useState<string | null>(thumbnailUri || null);
  const [failedThumbnail, setFailedThumbnail] = useState(false);

  useEffect(() => {
    setCurrentUri(thumbnailUri || null);
    setFailedThumbnail(false);
  }, [thumbnailUri]);

  const handleError = () => {
    if (!failedThumbnail && previewUri && previewUri !== thumbnailUri) {
      setCurrentUri(previewUri);
      setFailedThumbnail(true);
    } else {
      setCurrentUri(null);
    }
  };

  if (!currentUri) {
    return <Text style={styles.assetThumbEmoji}>{fallbackIcon}</Text>;
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
    />
  );
}


function PanelButton({
  label,
  active,
  onPress,
  color = '#6C4CFF',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.panelButton,
        active ? { backgroundColor: color, borderColor: color } : styles.panelButtonInactive,
      ]}>
      <Text style={[styles.panelButtonText, active && styles.panelButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ARViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ARViewerNavigationProp>();
  const route = useRoute<ARViewerRouteProp>();
  const { modelId, environmentId, openPainter = false, initialPaintMode = 'model' } = route.params;

  const webViewRef = useRef<WebView>(null);
  const sheetWebViewRef = useRef<WebView>(null);
  const audioRef = useRef<VideoRef>(null);
  const loadEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loadingModel, setLoadingModel] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [animations, setAnimations] = useState<string[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [environment, setEnvironment] = useState('sunset');
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [activeControlCategory, setActiveControlCategory] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<ARAudioTrack | null>(null);
  const [availableAudios, setAvailableAudios] = useState<ARAudioTrack[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [paintingEnabled, setPaintingEnabled] = useState(false);
  const [brushColor, setBrushColor] = useState(COLOR_SWATCHES[0]);
  const [brushSize, setBrushSize] = useState(32);
  const [showTargetPainter, setShowTargetPainter] = useState(false);
  const [targetTextureDataUrl, setTargetTextureDataUrl] = useState<string | null>(null);
  const [textureDisplayMode, setTextureDisplayMode] = useState<'original' | 'model-paint' | 'target-paint'>('original');
  const [, setPaintMode] = useState<'model' | 'target'>('model');
  const [isExporting, setIsExporting] = useState(false);
  const [instructionVisible, setInstructionVisible] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [isEraser, setIsEraser] = useState(false);
  const [sheetBrushSize, setSheetBrushSize] = useState(5);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioSyncPending, setAudioSyncPending] = useState(false);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // ── Responsive: tablet + landscape detection ──
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  // Short-side method: phones always have shortSide <600px; tablets ≥600px
  const shortSide = Math.min(winW, winH);
  const isTablet = shortSide >= 600;
  const isLargeTablet = shortSide >= 900;
  // Snap: tablets have the height for a normal 50% sheet; only phone-landscape needs 88%
  const snapPoints = useMemo(
    () => [isTablet
      ? (isLandscape ? '55%' : '45%')   // tablet: always relaxed
      : (isLandscape ? '88%' : '45%')], // phone landscape: near-full
    [isLandscape, isTablet],
  );
  // Panel width for coloring sheet side panel
  const tpPanelWidth = isLargeTablet ? scale(300) : isTablet ? scale(250) : scale(200);
  // Whether to use side-panel layout for coloring sheet
  // Tablets (any orientation) + phones in landscape get the side layout
  const useSidePanelLayout = isLandscape || isTablet;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  useEffect(() => {
    return () => {
      if (loadEndTimeoutRef.current) {
        clearTimeout(loadEndTimeoutRef.current);
      }
    };
  }, []);

  // Pause audio when app goes to background
  const audioPlayingBeforeBg = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        audioPlayingBeforeBg.current = audioPlaying;
        if (audioPlaying) setAudioPlaying(false);
      } else if (nextState === 'active' && audioPlayingBeforeBg.current) {
        setAudioPlaying(true);
        setAudioSyncPending(true);
      }
    });
    return () => sub.remove();
  }, [audioPlaying]);

  const modelsQuery = useQuery({
    queryKey: ['ar-models'],
    queryFn: async () => {
      const response = await ARService.getAllModels();
      return response.modals || [];
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  const foldersQuery = useQuery({
    queryKey: ['ar-folders'],
    queryFn: async () => {
      const response = await ARService.getFolders();
      return response.data?.data?.data || [];
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  const audioQuery = useQuery({
    queryKey: ['ar-model-audios', modelId],
    queryFn: () => ARService.getModelAudios(modelId),
    enabled: !!modelId,
    staleTime: 0,
    refetchInterval: 30000,
  });

  const models = useMemo(() => (modelsQuery.data || []) as ARModel[], [modelsQuery.data]);
  const environments = useMemo(
    () => getBrowsableEnvironments((foldersQuery.data || []) as any[], models),
    [foldersQuery.data, models],
  );

  const currentModel = useMemo(
    () => models.find(model => getModelStableId(model) === modelId) || null,
    [modelId, models],
  );

  const modelUrl = useMemo(() => {
    if (!currentModel) return '';
    const m = currentModel as any;
    if (m.type === 'multiple-glb' && m.parts && m.parts.length > 0) {
      const baseUrl = ARService.getModelFileUrl(getModelStableId(currentModel));
      const partsConfig = m.parts.flatMap((p: any) => {
        const rawFile = typeof p?.file === 'string' ? p.file : '';
        const filename = rawFile.split('/').pop();
        if (!filename) {
          return [];
        }
        return [{
          id: p.partId,
          name: p.name,
          url: `${baseUrl}?part=${encodeURIComponent(filename)}`,
          audioUrl: p.audio?.gridfsId ? ARService.getAudioStreamUrlById(p.audio.gridfsId) : null
        }];
      });
      if (!partsConfig.length) {
        return baseUrl;
      }
      return JSON.stringify(partsConfig);
    }
    return ARService.getModelFileUrl(getModelStableId(currentModel));
  }, [currentModel]);

  const currentEnvironment = useMemo<AREnvironmentView | null>(() => {
    const byId = environments.find(env => env._id === environmentId);
    if (byId) {
      return byId;
    }
    if (!currentModel) {
      return null;
    }
    return environments.find(env => getModelsForEnvironment(env, [currentModel]).length > 0) || null;
  }, [currentModel, environmentId, environments]);
  const hideColorMode = useMemo(() => {
    const raw = `${currentEnvironment?.name || ''} ${currentEnvironment?.folderName || ''}`
      .trim()
      .toLowerCase();
    return raw.includes('body') || raw.includes('number');
  }, [currentEnvironment]);

  const environmentsWithAssets = useMemo(
    () => environments.filter(env => getModelsForEnvironment(env, models).length > 0),
    [environments, models],
  );

  const currentEnvModels = useMemo(
    () => getModelsForEnvironment(currentEnvironment, models),
    [currentEnvironment, models],
  );

  const filteredEnvModels = useMemo(() => {
    const query = assetSearchTerm.trim().toLowerCase();
    if (!query) {
      return currentEnvModels;
    }
    return currentEnvModels.filter(model => model.name?.toLowerCase().includes(query));
  }, [assetSearchTerm, currentEnvModels]);

  useEffect(() => {
    setAvailableAudios((audioQuery.data?.audios || []) as ARAudioTrack[]);
  }, [audioQuery.data?.audios]);

  const uniqueLanguages = useMemo(
    () => sortLanguages([...new Set(availableAudios.map(audio => audio.language))]),
    [availableAudios],
  );

  const uniqueLevels = useMemo(() => {
    if (!selectedLanguage) {
      return [];
    }
    return sortLevels(
      [...new Set(availableAudios.filter(audio => audio.language === selectedLanguage).map(audio => audio.level))],
    );
  }, [availableAudios, selectedLanguage]);

  useEffect(() => {
    setSelectedAudio(
      availableAudios.find(
        audio => audio.language === selectedLanguage && audio.level === selectedLevel,
      ) || null,
    );
  }, [availableAudios, selectedLanguage, selectedLevel]);

  useEffect(() => {
    if (!uniqueLanguages.length) {
      setSelectedLanguage('');
      setSelectedLevel('');
      return;
    }
    setSelectedLanguage(current => (current && uniqueLanguages.includes(current) ? current : uniqueLanguages[0]));
  }, [uniqueLanguages]);

  useEffect(() => {
    if (!uniqueLevels.length) {
      setSelectedLevel('');
      return;
    }
    setSelectedLevel(current => (current && uniqueLevels.includes(current) ? current : uniqueLevels[0]));
  }, [uniqueLevels]);

  useEffect(() => {
    setLoadingModel(true);
    setViewerError(null);
    setProgress(0);
    if (loadEndTimeoutRef.current) {
      clearTimeout(loadEndTimeoutRef.current);
      loadEndTimeoutRef.current = null;
    }
    setShowLeftMenu(false);
    setAudioPlaying(false);
    setAudioReady(false);
    setAudioSyncPending(false);
    setAssetSearchTerm('');
    setPaintingEnabled(false);
    setTextureDisplayMode('original');
    setTargetTextureDataUrl(null);
    setShowTargetPainter(false);
    setPaintMode('model');
    setBrushColor(COLOR_SWATCHES[0] || '#ff0000');
    setBrushSize(32);
    setIsExporting(false);
    setExportStatusText('');
    setActiveControlCategory(null);
    setSelectedPartId(null);
    bottomSheetModalRef.current?.dismiss();
  }, [modelId]);

  useEffect(() => {
    if (loadingModel) return;
    const isSpecialType = (currentModel as any)?.type === 'multiple-animation-execution' || (currentModel as any)?.type === 'multiple-glb';
    if (isSpecialType) {
      setAutoRotate(false);
      setAudioPlaying(true);
      setAudioSyncPending(true);
      sendToWebView({ type: 'toggleRotate', value: false });
      if ((currentModel as any)?.type === 'multiple-animation-execution') {
        sendToWebView({ type: 'playAllAnimations', value: isPlaying });
      } else if ((currentModel as any)?.type === 'multiple-glb' && !selectedPartId) {
        const parts = (currentModel as any).parts || [];
        if (parts.length > 0) {
          setSelectedPartId(parts[0].partId);
        }
      }
    } else {
      setAutoRotate(true);
      sendToWebView({ type: 'toggleRotate', value: true });
    }
  }, [isPlaying, loadingModel, currentModel, selectedPartId]);

  useEffect(() => {
    if (!openPainter) {
      return;
    }
    if (initialPaintMode === 'target') {
      setPaintMode('target');
      setShowTargetPainter(true);
      return;
    }
    setPaintMode('model');
    setPaintingEnabled(true);
    setTextureDisplayMode('model-paint');
  }, [initialPaintMode, openPainter, modelId]);

  useEffect(() => {
    if (loadingModel) {
      return;
    }
    sendToWebView({ type: 'enablePaint', value: paintingEnabled });
    if (textureDisplayMode === 'original') {
      sendToWebView({ type: 'showOriginalTexture' });
      return;
    }
    if (textureDisplayMode === 'model-paint') {
      sendToWebView({ type: 'showPaintTexture' });
      return;
    }
    if (textureDisplayMode === 'target-paint') {
      if (targetTextureDataUrl) {
        sendToWebView({ type: 'applyTargetTexture', dataUrl: targetTextureDataUrl });
      }
    }
  }, [loadingModel, paintingEnabled, targetTextureDataUrl, textureDisplayMode]);

  const viewerHtml = useMemo(
    () => (modelUrl ? buildARViewerHtml(modelUrl) : ''),
    [modelUrl],
  );

  const targetUrl = useMemo(() => {
    const referenceSource = getReferenceImageSource(currentModel);
    if (referenceSource) {
      return normalizeReferenceForDisplay(referenceSource);
    }
    const modelName = currentModel?.name || '';
    const exact = TARGET_ASSETS[modelName];
    if (exact) {
      return exact;
    }
    const matchedKey = Object.keys(TARGET_ASSETS).find(
      key => key.toLowerCase() === modelName.toLowerCase(),
    );
    if (matchedKey) {
      return TARGET_ASSETS[matchedKey];
    }
    return Object.values(TARGET_ASSETS)[0] || '';
  }, [currentModel]);

  const colorSheetHtml = useMemo(
    () => buildColorSheetHtml(targetUrl),
    [targetUrl],
  );

  const audioSource = useMemo(() => {
    const isMultiGlb = (currentModel as any)?.type === 'multiple-glb';
    if (isMultiGlb && selectedPartId) {
      const parts = (currentModel as any)?.parts || [];
      const part = parts.find((p: any) => p.partId === selectedPartId);
      if (part?.audio?.gridfsId) {
        const uri = ARService.getAudioStreamUrlById(part.audio.gridfsId);
        return uri ? {
          uri,
          shouldCache: true,
          minLoadRetryCount: 3,
          bufferConfig: AUDIO_BUFFER_CONFIG,
        } : undefined;
      }
    }
    if (!selectedAudio?.gridfsId) {
      return undefined;
    }
    const uri = ARService.getAudioStreamUrlById(selectedAudio.gridfsId) || '';
    return uri ? {
      uri,
      shouldCache: true,
      minLoadRetryCount: 3,
      bufferConfig: AUDIO_BUFFER_CONFIG,
    } : undefined;
  }, [currentModel, selectedPartId, selectedAudio?.gridfsId]);

  const currentLighting =
    LIGHTING_OPTIONS.find(item => item.name === environment) || LIGHTING_OPTIONS[0];

  const viewerLoading = modelsQuery.isPending || foldersQuery.isPending || !currentModel;
  const isSpecialType = (currentModel as any)?.type === 'multiple-animation-execution' || (currentModel as any)?.type === 'multiple-glb';
  const topBarTop = insets.top + verticalScale(4);
  const topBarHeight = verticalScale(44);
  const webViewTop = topBarTop + topBarHeight;
  // Landscape (phone): slim icon-only bar to give 3D model more vertical space
  // Tablets: always keep full bar with labels, even in landscape
  const bottomBarHeight = (!isTablet && isLandscape)
    ? insets.bottom + verticalScale(48)
    : insets.bottom + verticalScale(83);

  const openCategory = useCallback((category: string) => {
    if (category === 'sheet') {
      setShowTargetPainter(true);
      return;
    }
    setActiveControlCategory(category);
    bottomSheetModalRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsAt={-1} appearsAt={0} opacity={0.3} />
    ),
    [],
  );

  const sendToWebView = (payload: object) => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  };

  const sendToSheetWebView = (payload: object) => {
    sheetWebViewRef.current?.postMessage(JSON.stringify(payload));
  };

  useEffect(() => {
    if (!audioSource) {
      setAudioReady(false);
      setAudioSyncPending(false);
      return;
    }
    setAudioReady(false);
    if (audioPlaying) {
      setAudioSyncPending(true);
    }
  }, [audioPlaying, audioSource]);

  useEffect(() => {
    if (!audioSyncPending || !audioPlaying || !audioReady) {
      return;
    }
    try {
      audioRef.current?.seek(0);
    } catch {
      // ignore seek failures on unloaded streams
    }
    if (isSpecialType) {
      if (!isPlaying) {
        setIsPlaying(true);
      }
      sendToWebView({ type: 'playAllAnimations' });
      sendToWebView({ type: 'togglePlay', value: true });
    } else {
      const activeAnimation = selectedAnimation || animations[0];
      if (activeAnimation) {
        sendToWebView({ type: 'setAnimation', value: activeAnimation });
      }
    }
    setAudioSyncPending(false);
  }, [
    animations,
    audioPlaying,
    audioReady,
    audioSyncPending,
    isPlaying,
    isSpecialType,
    selectedAnimation,
  ]);

  useEffect(() => {
    if (!loadingModel && selectedPartId) {
      sendToWebView({ type: 'switchPart', id: selectedPartId });
      setAudioPlaying(true);
      setAudioSyncPending(true);
    }
  }, [selectedPartId, loadingModel]);

  useEffect(() => {
    sendToWebView({ type: 'setBrushColor', value: brushColor });
    sendToSheetWebView({ type: 'setBrushColor', value: brushColor });
  }, [brushColor]);

  useEffect(() => {
    sendToWebView({ type: 'setBrushSize', value: brushSize });
  }, [brushSize]);

  useEffect(() => {
    sendToSheetWebView({ type: 'setBrushSize', value: sheetBrushSize });
  }, [sheetBrushSize]);

  useEffect(() => {
    sendToSheetWebView({ type: 'setEraser', value: isEraser });
  }, [isEraser]);

  const handleWebMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        if (loadEndTimeoutRef.current) {
          clearTimeout(loadEndTimeoutRef.current);
          loadEndTimeoutRef.current = null;
        }
        setLoadingModel(false);
        setProgress(100);
        return;
      }
      if (data.type === 'progress') {
        setProgress(Number(data.percent) || 0);
        return;
      }
      if (data.type === 'animations') {
        const list = Array.isArray(data.list) ? data.list : [];
        setAnimations(list);
        if (list.length > 0) {
          setSelectedAnimation(list[0]);
        }
        return;
      }
      if (data.type === 'exportStatus') {
        setExportStatusText(data.status || '');
        return;
      }
      if (data.type === 'glbData') {
        handleExportedGLB(data.base64);
        return;
      }
      if (data.type === 'error') {
        if (loadEndTimeoutRef.current) {
          clearTimeout(loadEndTimeoutRef.current);
          loadEndTimeoutRef.current = null;
        }
        setViewerError(data.message || 'Failed to load model');
        setLoadingModel(false);
        setIsExporting(false);
      }
    } catch { }
  };

  const handleRetry = () => {
    setLoadingModel(true);
    setViewerError(null);
    setProgress(0);
    webViewRef.current?.reload();
  };

  const toggleAudio = () => {
    if (!audioSource) {
      return;
    }
    const next = !audioPlaying;
    setAudioPlaying(next);
    setAudioSyncPending(next);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    const nextLevels = sortLevels(
      [...new Set(availableAudios.filter(audio => audio.language === language).map(audio => audio.level))],
    );
    setSelectedLevel(nextLevels[0] || '');
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
  };

  const handleExportedGLB = async (base64: string) => {
    if (!currentModel) {
      setIsExporting(false);
      return;
    }
    try {
      setExportStatusText('Opening AR...');
      await openModelInARFromBase64({
        modelBase64: base64,
        modelName: currentModel.name,
        originalModelUrl: modelUrl,
        audios: availableAudios.map(audio => ({
          gridfsId: audio.gridfsId,
          language: audio.language,
          level: audio.level,
        })),
        animations,
        modelType: (currentModel as any)?.type,
        hideColorMode,
      });
    } catch (error: any) {
      setViewerError(error?.message || 'Unable to export custom AR model');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenAR = () => {
    setInstructionVisible(true);
  };

  const proceedToAR = async () => {
    if (!currentModel || !modelUrl) {
      return;
    }
    if (textureDisplayMode !== 'original') {
      setIsExporting(true);
      setExportStatusText('Preparing Custom AR Model...');
      sendToWebView({ type: 'exportGLB' });
      return;
    }
    await openModelInAR({
      modelUrl,
      modelName: currentModel.name,
      audios: availableAudios.map(audio => ({
        gridfsId: audio.gridfsId,
        language: audio.language,
        level: audio.level,
      })),
      animations,
      modelType: (currentModel as any)?.type,
      hideColorMode,
    });
  };

  const switchModel = (nextModelId: string, nextEnvironmentId?: string) => {
    navigation.replace('ARViewer', {
      modelId: nextModelId,
      environmentId: nextEnvironmentId || currentEnvironment?._id,
    });
  };

  const renderSection = (title: string, icon: string, children: React.ReactNode) => (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionLabel}>
        {icon} {title}
      </Text>
      {children}
    </View>
  );

  if (viewerLoading) {
    return (
      <View style={styles.loadingRootDark}>
        <ActivityIndicator size="large" color="#6C4CFF" />
      </View>
    );
  }

  if (!currentModel) {
    return (
      <View style={styles.loadingRootDark}>
        <Text style={styles.notFoundText}>Model not found</Text>
      </View>
    );
  }

  const progressLabel = progress > 0 ? `Loading... ${progress}%` : 'Loading model...';

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <LinearGradient colors={currentLighting.bgColors} locations={[0, 0.33, 0.67, 1]} style={StyleSheet.absoluteFill} />

      <View style={[styles.topBar, { top: topBarTop, height: topBarHeight }]}>
        <TouchableOpacity
          onPress={() => {
            setAudioPlaying(false);
            navigation.goBack();
          }}
          activeOpacity={0.75}
          style={styles.backPill}>
          <ChevronLeft size={moderateScale(16)} color="#fff" strokeWidth={2.4} />
          <Text style={styles.backPillText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.topBarTitle}>
          <Text numberOfLines={1} style={styles.topBarTitleText}>
            {currentModel.name || '3D Model'}
          </Text>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={() => {
              const next = !autoRotate;
              setAutoRotate(next);
              sendToWebView({ type: 'toggleRotate', value: next });
            }}
            style={[
              styles.iconPill,
              autoRotate && styles.iconPillActive,
            ]}>
            <Rotate360Icon width={moderateScale(30)} height={moderateScale(30)} color="#fff" strokeWidth={2.1} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.viewerShell, { marginTop: webViewTop, marginBottom: bottomBarHeight }]}>
        <WebView
          ref={webViewRef}
          source={{ html: viewerHtml, baseUrl: 'https://learn-api.eduzon.ai' }}
          style={styles.webView}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          mixedContentMode="always"
          allowFileAccess
          allowUniversalAccessFromFileURLs
          cacheEnabled
          scalesPageToFit={Platform.OS !== 'ios'}
          startInLoadingState={false}
          onShouldStartLoadWithRequest={(request) => {
            const { url } = request;
            return url.startsWith('http') || url.startsWith('about:') || url.startsWith('data:');
          }}
          onMessage={handleWebMessage}
          onLoadEnd={() => {
            if (loadEndTimeoutRef.current) {
              clearTimeout(loadEndTimeoutRef.current);
            }
            loadEndTimeoutRef.current = setTimeout(() => {
              setLoadingModel(current => (viewerError ? current : false));
            }, 10000);
          }}
          onError={() => {
            if (loadEndTimeoutRef.current) {
              clearTimeout(loadEndTimeoutRef.current);
              loadEndTimeoutRef.current = null;
            }
            setLoadingModel(false);
          }}
        />

        {loadingModel && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#6C4CFF" />
            <Text style={styles.overlayTitle}>Loading 3D Model...</Text>
            <Text style={styles.overlayCopy}>{progressLabel}</Text>
          </View>
        )}

        {!!viewerError && (
          <View style={styles.overlay}>
            <Text style={styles.overlayTitle}>Viewer Error</Text>
            <Text style={styles.overlayCopy}>{viewerError}</Text>
            <TouchableOpacity onPress={handleRetry} style={styles.retryPill}>
              <Text style={styles.retryPillText}>Reload Viewer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {audioSource && (
        <Video
          ref={audioRef}
          source={audioSource}
          style={styles.hiddenAudio}
          paused={!audioPlaying}
          repeat
          volume={volume / 100}
          playInBackground={false}
          playWhenInactive={false}
          audioOutput="speaker"
          ignoreSilentSwitch="ignore"
          progressUpdateInterval={250}
          onLoadStart={() => setAudioReady(false)}
          onLoad={() => setAudioReady(true)}
          onError={() => {
            setAudioReady(false);
            setAudioSyncPending(false);
          }}
        />
      )}

      {!showLeftMenu && (
        <TouchableOpacity
          onPress={() => {
            setShowLeftMenu(true);
            bottomSheetModalRef.current?.dismiss();
          }}
          activeOpacity={0.8}
          style={styles.sideToggleLeft}>
          <Menu size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
          <Text style={styles.sideToggleText}>Menu</Text>
        </TouchableOpacity>
      )}

      {showLeftMenu && (
        <View style={[styles.sidePanel, { left: scale(8), top: webViewTop + verticalScale(3), bottom: bottomBarHeight + verticalScale(3) }]}>
          <View style={styles.sidePanelHeader}>
            <View style={styles.sidePanelTitleRow}>
              <View style={styles.sidePanelIconBubble}>
                <ARIcon width={moderateScale(16)} height={moderateScale(16)} color="#6C4CFF" strokeWidth={2} />
              </View>
              <Text style={styles.sidePanelTitle}>Menu</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLeftMenu(false)}>
              <ChevronLeft size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sidePanelScroll} showsVerticalScrollIndicator={false}>
            {/* {renderSection('Paint Mode', '🎨', (
              <View style={styles.panelButtonRow}>
                <PanelButton
                  label="🎲 3D Paint"
                  active={paintMode === 'model'}
                  onPress={() => {
                    setPaintMode('model');
                    setPaintingEnabled(true);
                    setTextureDisplayMode('model-paint');
                    setBrushColor(COLOR_SWATCHES[0] || '#ff0000');
                    sendToWebView({ type: 'enablePaint', value: true });
                    sendToWebView({ type: 'showPaintTexture' });
                  }}
                  color="#6C4CFF"
                />
                <PanelButton
                  label="🖼️ Sheet"
                  active={paintMode === 'target'}
                  onPress={() => {
                    setPaintMode('target');
                    setPaintingEnabled(false);
                    sendToWebView({ type: 'enablePaint', value: false });
                    setShowTargetPainter(true);
                  }}
                  color="#DA70D6"
                />
              </View>
            ))} */}

            {renderSection('World', '🌍', (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {environmentsWithAssets.map(env => {
                  const isSelected = env._id === currentEnvironment?._id;
                  return (
                    <TouchableOpacity
                      key={env._id}
                      onPress={() => {
                        const nextModels = getModelsForEnvironment(env, models);
                        if (nextModels.length > 0) {
                          switchModel(getModelStableId(nextModels[0]), env._id);
                        }
                      }}
                      activeOpacity={0.75}
                      style={[
                        styles.worldChip,
                        isSelected && styles.worldChipActive,
                      ]}>
                      <Text style={styles.worldChipText}>{env.name || env.folderName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ))}

            {currentEnvironment &&
              renderSection(`Assets(${filteredEnvModels.length})`, '📦', (
                <View>
                  <View style={styles.searchShell}>
                    <Search size={moderateScale(14)} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
                    <TextInput
                      value={assetSearchTerm}
                      onChangeText={setAssetSearchTerm}
                      placeholder="Search assets..."
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={styles.searchInput}
                    />
                  </View>

                  {filteredEnvModels.map(model => {
                    const isSelected = getModelStableId(model) === modelId;
                    const assetModelId = model._id || model.id || (model as any).id;
                    const thumbnailUri = assetModelId ? ARService.getThumbnailImageUrl(String(assetModelId)) : null;
                    const previewUri = assetModelId ? ARService.getPreviewImageUrl(String(assetModelId)) : null;

                    return (
                      <TouchableOpacity
                        key={getModelStableId(model)}
                        onPress={() => {
                          if (!isSelected) {
                            switchModel(getModelStableId(model), currentEnvironment._id);
                          }
                        }}
                        activeOpacity={0.75}
                        style={[
                          styles.assetRow,
                          isSelected && styles.assetRowActive,
                        ]}>
                        <View style={styles.assetThumb}>
                          <ModelPreviewImage
                            thumbnailUri={thumbnailUri}
                            previewUri={previewUri}
                            fallbackIcon={currentEnvironment.emoji || '🎨'}
                            style={styles.assetThumbImage}
                            resizeMode="cover"
                          />
                        </View>
                        <Text numberOfLines={1} style={styles.assetName}>
                          {model.name}
                        </Text>
                        {isSelected && (
                          <CheckCircle2 size={moderateScale(16)} color="#6C4CFF" strokeWidth={2.2} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {!isSpecialType && (
        <View style={[styles.paintSwitchContainer, { bottom: verticalScale(bottomBarHeight + verticalScale(3)) }]}>
          <Text style={styles.paintSwitchTopLabel}>Real Texture</Text>
          <TouchableOpacity
            onPress={() => {
              const next = textureDisplayMode !== 'original';
              if (next) {
                setTextureDisplayMode('original');
                setPaintingEnabled(false);
                sendToWebView({ type: 'enablePaint', value: false });
                sendToWebView({ type: 'showOriginalTexture' });
              } else {
                setTextureDisplayMode('model-paint');
                setPaintingEnabled(true);
                sendToWebView({ type: 'enablePaint', value: true });
                sendToWebView({ type: 'showPaintTexture' });
              }
            }}
            activeOpacity={0.8}
            style={[styles.paintSwitch, textureDisplayMode === 'original' && styles.paintSwitchActiveHighlight]}>
            <View style={[styles.paintSwitchThumb, textureDisplayMode === 'original' && styles.paintSwitchThumbActive]} />
            <Text style={styles.paintSwitchLabel}>
              {textureDisplayMode === 'original' ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={handleOpenAR}
        style={[styles.arButton, { bottom: verticalScale(bottomBarHeight) }]}>
        <ARIcon width={moderateScale(22)} height={moderateScale(22)} color="#fff" strokeWidth={2.5} />
        <Text style={styles.arButtonText}>AR</Text>
      </TouchableOpacity>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + verticalScale((isLandscape && !isTablet) ? 4 : 8) }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.controlBarContent}>
          {[
            { id: 'animation', label: 'Animation', icon: AnimationIcon },
            ...(paintingEnabled && !isSpecialType ? [{ id: 'paint', label: 'Paint', icon: Palette }] : []),
            { id: 'audio', label: 'Audio', icon: Volume2 },
            { id: 'lighting', label: 'Lighting', icon: Lightbulb },
            ...(!isSpecialType ? [{ id: 'sheet', label: 'Coloring Sheet', icon: ImageIcon }] : []),
          ].map(cat => {
            const isTabActive = activeControlCategory === cat.id;
            const isStatusActive = (cat.id === 'audio' && audioPlaying) || (cat.id === 'paint' && paintingEnabled);
            // Compact (one-line) only on phone landscape; tablets always show normal labels
            const compact = isLandscape && !isTablet;
            const isActive = isTabActive || isStatusActive;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => openCategory(cat.id)}
                style={[
                  compact ? styles.controlBarItemCompact : styles.controlBarItem,
                  (compact && isActive) && styles.controlBarItemCompactActive
                ]}>
                <View style={[
                  compact ? styles.controlIconWrapCompact : styles.controlIconWrap,
                  (!compact && isActive) && styles.controlIconWrapActive
                ]}>
                  <cat.icon
                    size={isTablet ? moderateScale(22) : compact ? moderateScale(14) : moderateScale(20)}
                    color="#fff"
                    strokeWidth={compact ? 2 : 1.5}
                  />
                </View>
                <Text style={[
                  styles.controlLabel,
                  isTablet && { fontSize: moderateScale(10) },
                  compact && styles.controlLabelCompact,
                  (compact && isActive) && styles.controlLabelCompactActive
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        onDismiss={() => setActiveControlCategory(null)}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.3)', width: scale(40) }}
        backgroundStyle={{ backgroundColor: 'rgb(20,20,40)', borderTopLeftRadius: moderateScale(24), borderTopRightRadius: moderateScale(24) }}>
        <BottomSheetScrollView
          style={styles.sheetContent}
          contentContainerStyle={styles.sheetContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {activeControlCategory === 'animation' && (
            <View style={styles.sheetInner}>
              <Text style={styles.sheetTitle}>
                {(currentModel as any)?.type === 'multiple-glb' ? 'Explore Parts' : 'Animations'}
              </Text>

              {/* Multiple GLB: Part Selection */}
              {(currentModel as any)?.type === 'multiple-glb' && (
                <View style={[styles.chipRow, styles.sheetRow, { paddingBottom: verticalScale(16) }]}>
                  {((currentModel as any).parts || []).map((part: any) => (
                    <TouchableOpacity
                      key={part.partId}
                      onPress={() => {
                        setSelectedPartId(part.partId);
                      }}
                      style={[
                        styles.choiceChip,
                        (selectedPartId === part.partId || (!selectedPartId && part.partId === (currentModel as any).parts[0]?.partId)) && styles.choiceChipTeal,
                      ]}>
                      <Text style={styles.choiceChipText}>{part.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Standard List/Multiple Animation List */}
              {(currentModel as any)?.type !== 'multiple-animation-execution' && (currentModel as any)?.type !== 'multiple-glb' && (
                <View style={[styles.chipRow, styles.sheetRow]}>
                  {animations.map((animation, idx) => (
                    <TouchableOpacity
                      key={animation}
                      onPress={() => {
                        setSelectedAnimation(animation);
                        sendToWebView({ type: 'setAnimation', value: animation });
                        NativeModules.ARNativeModule?.setAnimation?.(idx);
                      }}
                      style={[
                        styles.choiceChip,
                        selectedAnimation === animation && styles.choiceChipTeal,
                      ]}>
                      <Text style={styles.choiceChipText}>{animation}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Common Play/Pause Toggle for special types */}
              {((currentModel as any)?.type === 'multiple-animation-execution' || (currentModel as any)?.type === 'multiple-glb') && (
                <View style={styles.playPauseControlRow}>
                  <TouchableOpacity
                    style={[styles.playPauseBtn, isPlaying && styles.playPauseBtnActive]}
                    onPress={() => {
                      const next = !isPlaying;
                      setIsPlaying(next);
                      sendToWebView({ type: 'togglePlay', value: next });
                    }}
                  >
                    {isPlaying ? <Pause size={moderateScale(28)} color="#fff" /> : <Play size={moderateScale(28)} color="#fff" />}
                    <Text style={styles.playPauseBtnText}>{isPlaying ? 'Pause' : 'Play'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {activeControlCategory === 'audio' && (
            <View style={styles.sheetInner}>
              <Text style={styles.sheetTitle}>Audio Settings</Text>
              <View style={styles.audioSheetContent}>
                <View style={[styles.audioPlayButton, audioPlaying && styles.audioPlayButtonActive, { alignSelf: 'center', marginBottom: verticalScale(16) }]}>
                  <TouchableOpacity onPress={toggleAudio}>
                    {audioPlaying ? <Pause size={moderateScale(32)} color="#fff" /> : <Play size={moderateScale(32)} color="#fff" />}
                  </TouchableOpacity>
                </View>

                {!!uniqueLanguages.length && (
                  <>
                    <Text style={styles.controlSubLabel}>Language</Text>
                    <View style={[styles.chipRow, styles.sheetRow]}>
                      {uniqueLanguages.map(lang => (
                        <TouchableOpacity
                          key={lang}
                          onPress={() => handleLanguageChange(lang)}
                          style={[styles.choiceChip, selectedLanguage === lang && styles.choiceChipTeal]}>
                          <Text style={styles.choiceChipText}>{lang}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {!!uniqueLevels.length && (
                  <>
                    <Text style={styles.controlSubLabel}>Level</Text>
                    <View style={[styles.chipRow, styles.sheetRow]}>
                      {uniqueLevels.map(level => (
                        <TouchableOpacity
                          key={level}
                          onPress={() => handleLevelChange(level)}
                          style={[styles.choiceChip, selectedLevel === level && styles.choiceChipPink]}>
                          <Text style={styles.choiceChipText}>{level}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <View style={styles.audioVolumeRow}>
                  {volume === 0 ? (
                    <VolumeX size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  ) : volume < 50 ? (
                    <Volume1 size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  ) : (
                    <Volume2 size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  )}
                  <CustomSlider
                    value={volume}
                    min={0}
                    max={100}
                    onChange={setVolume}
                    color="#0EA5A4"
                  />
                  <Text style={styles.volumeText}>{volume}%</Text>
                </View>
              </View>
            </View>
          )}

          {activeControlCategory === 'lighting' && (
            <View style={styles.sheetInner}>
              <Text style={styles.sheetTitle}>Environment Lighting</Text>
              <View style={styles.lightingGrid}>
                {LIGHTING_OPTIONS.map(light => (
                  <TouchableOpacity
                    key={light.name}
                    onPress={() => setEnvironment(light.name)}
                    style={[styles.lightingChip, environment === light.name && styles.lightingChipActive]}>
                    <LinearGradient colors={light.bgColors} style={styles.lightingSwatch} />
                    <Text style={styles.lightingChipText}>{light.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeControlCategory === 'paint' && (
            <View style={styles.sheetInner}>

              <View style={styles.brushHeader}>
                <Text style={styles.brushTitle}>🖌️ Brush Settings</Text>
              </View>

              <Text style={styles.controlSubLabel}>Color</Text>
              <View style={styles.colorRow}>
                {COLOR_SWATCHES.map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setBrushColor(color)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      brushColor === color && styles.colorSwatchActive,
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.controlSubLabel}>Size: {brushSize}px</Text>
              <View style={styles.brushSizeRow}>
                <TouchableOpacity
                  onPress={() => setBrushSize(current => Math.max(1, current - 2))}
                  style={styles.brushSizeButton}>
                  <Minus size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
                <View style={styles.customSliderContainer}>
                  <CustomSlider
                    value={brushSize}
                    min={1}
                    max={50}
                    onChange={setBrushSize}
                    color={brushColor}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setBrushSize(current => Math.min(50, current + 2))}
                  style={styles.brushSizeButton}>
                  <Plus size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              <View style={styles.brushActionsRow}>
                <PanelButton
                  label="Clear"
                  active={false}
                  onPress={() => {
                    sendToWebView({ type: 'clearPaint' });
                    sendToSheetWebView({ type: 'clear' });
                  }}
                  color="#EF4444"
                />
                <PanelButton
                  label="Original"
                  active={false}
                  onPress={() => {
                    setTextureDisplayMode('original');
                    setPaintingEnabled(false);
                    sendToWebView({ type: 'enablePaint', value: false });
                    sendToWebView({ type: 'showOriginalTexture' });
                  }}
                  color="#3B82F6"
                />
              </View>
            </View>
          )}

          {activeControlCategory === 'sheet' && (
            <View style={styles.sheetInner}>
              <Text style={styles.sheetTitle}>Coloring Sheet</Text>
              <Text style={styles.sheetSub}>Apply a 2D drawing as a texture to the model</Text>
              <TouchableOpacity
                onPress={() => {
                  bottomSheetModalRef.current?.dismiss();
                  setShowTargetPainter(true);
                }}
                style={styles.sheetPrimaryButton}>
                <ImageIcon size={moderateScale(20)} color="#fff" />
                <Text style={styles.sheetPrimaryButtonText}>Open Painter</Text>
              </TouchableOpacity>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

      <ARInstructionModal
        visible={instructionVisible}
        onClose={() => setInstructionVisible(false)}
        onStartScan={() => {
          setInstructionVisible(false);
          proceedToAR();
        }}
      />

      {showTargetPainter && (
        useSidePanelLayout ? (
          // ── LANDSCAPE / TABLET: Procreate-style side-panel + full canvas ─
          <View style={[styles.targetPainterOverlay, { flexDirection: 'row' }]}>

            {/* Left control panel */}
            <View style={[styles.tpPanel, {
              width: tpPanelWidth,
              paddingTop: insets.top + verticalScale(4),
              paddingBottom: insets.bottom + verticalScale(8),
              paddingLeft: insets.left + scale(10),
            }]}>

              {/* Header */}
              <View style={styles.tpPanelHeader}>
                <View style={styles.tpPanelTitleRow}>
                  <Text style={styles.tpPanelTitle}>🖼️ Sheet</Text>
                </View>
                <TouchableOpacity onPress={() => setShowTargetPainter(false)} style={styles.targetPainterClose}>
                  <X size={moderateScale(17)} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.tpPanelScroll} showsVerticalScrollIndicator={false}>

                {/* Eraser toggle */}
                <TouchableOpacity
                  onPress={() => setIsEraser(!isEraser)}
                  style={[styles.tpEraserRow, isEraser && styles.tpEraserRowActive]}>
                  <Eraser size={moderateScale(14)} color={isEraser ? '#fff' : 'rgba(255,255,255,0.7)'} strokeWidth={2} />
                  <Text style={[styles.tpEraserLabel, isEraser && { color: '#fff' }]}>Eraser</Text>
                </TouchableOpacity>

                {/* Palette label */}
                <Text style={styles.tpSectionLabel}>Palette</Text>

                {/* Color grid — 4 × 2 */}
                <View style={styles.tpColorGrid}>
                  {COLOR_SWATCHES.map(color => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => { setBrushColor(color); setIsEraser(false); }}
                      style={[
                        styles.tpColorSwatch,
                        { backgroundColor: color },
                        (!isEraser && brushColor === color) && styles.tpColorSwatchActive,
                      ]}
                    />
                  ))}
                </View>

                {/* Brush Size */}
                <Text style={[styles.tpSectionLabel, { marginTop: verticalScale(10) }]}>
                  Size · {sheetBrushSize}px
                </Text>
                {/* Preview dot */}
                <View style={styles.tpBrushPreviewRow}>
                  <View style={[styles.tpBrushPreviewDot, {
                    width: Math.max(6, sheetBrushSize * 2.2),
                    height: Math.max(6, sheetBrushSize * 2.2),
                    backgroundColor: isEraser ? 'rgba(255,255,255,0.35)' : brushColor,
                    borderRadius: 99,
                  }]} />
                </View>
                <View style={[styles.targetPainterSizeRow, { marginTop: verticalScale(6), marginBottom: verticalScale(13) }]}>
                  <TouchableOpacity
                    onPress={() => setSheetBrushSize(v => Math.max(1, v - 2))}
                    style={styles.targetPainterSizeBtn}>
                    <Minus size={moderateScale(13)} color="#fff" strokeWidth={2.2} />
                  </TouchableOpacity>
                  <View style={styles.targetPainterSliderWrap}>
                    <CustomSlider
                      value={sheetBrushSize}
                      min={1}
                      max={50}
                      onChange={setSheetBrushSize}
                      color={isEraser ? '#6C4CFF' : brushColor}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => setSheetBrushSize(v => Math.min(50, v + 2))}
                    style={styles.targetPainterSizeBtn}>
                    <Plus size={moderateScale(13)} color="#fff" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

              </ScrollView>

              {/* Action buttons at bottom of panel */}
              <View style={styles.tpPanelFooter}>
                <TouchableOpacity onPress={() => setShowTargetPainter(false)} style={styles.tpCancelBtn}>
                  <Text style={styles.targetPainterSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => sendToSheetWebView({ type: 'export' })} style={styles.tpApplyBtn}>
                  <CheckCircle2 size={moderateScale(14)} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.targetPainterPrimaryText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right: full-height canvas */}
            <View style={[styles.tpCanvas, { paddingRight: insets.right + scale(8), paddingTop: insets.top + verticalScale(4), paddingBottom: insets.bottom + verticalScale(4) }]}>
              <View style={styles.tpCanvasInner}>
                <WebView
                  ref={sheetWebViewRef}
                  source={{ html: colorSheetHtml, baseUrl: targetUrl }}
                  style={styles.targetPainterWebView}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  allowFileAccess
                  allowUniversalAccessFromFileURLs
                  onShouldStartLoadWithRequest={(request) => {
                    const { url } = request;
                    return url.startsWith('http') || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('file:');
                  }}
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === 'textureReady') {
                        setTargetTextureDataUrl(data.dataUrl);
                        sendToWebView({ type: 'applyTargetTexture', dataUrl: data.dataUrl });
                        setTextureDisplayMode('target-paint');
                        setShowTargetPainter(false);
                        setPaintMode('target');
                        setPaintingEnabled(false);
                      } else if (data.type === 'log') {
                        console.log('[SheetWebView]', data.message);
                      } else if (data.type === 'error') {
                        if ((data.message || '').includes('Export failed')) {
                          setShowTargetPainter(false);
                        } else {
                          setViewerError(data.message || 'Coloring sheet failed');
                        }
                      }
                    } catch { }
                  }}
                />
              </View>
            </View>
          </View>
        ) : (
          // ── PORTRAIT: original stacked layout ───────────────────────────
          <View style={styles.targetPainterOverlay}>
            <View style={[styles.targetPainterHeader, { paddingTop: insets.top + verticalScale(8) }]}>
              <Text style={styles.targetPainterTitle}>🖼️ Coloring Sheet</Text>
              <TouchableOpacity
                onPress={() => setShowTargetPainter(false)}
                style={styles.targetPainterClose}>
                <X size={moderateScale(20)} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.targetPainterBody}>
              <WebView
                ref={sheetWebViewRef}
                source={{ html: colorSheetHtml, baseUrl: targetUrl }}
                style={styles.targetPainterWebView}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowFileAccess
                allowUniversalAccessFromFileURLs
                onShouldStartLoadWithRequest={(request) => {
                  const { url } = request;
                  return url.startsWith('http') || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('file:');
                }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'textureReady') {
                      setTargetTextureDataUrl(data.dataUrl);
                      sendToWebView({ type: 'applyTargetTexture', dataUrl: data.dataUrl });
                      setTextureDisplayMode('target-paint');
                      setShowTargetPainter(false);
                      setPaintMode('target');
                      setPaintingEnabled(false);
                    } else if (data.type === 'log') {
                      console.log('[SheetWebView]', data.message);
                    } else if (data.type === 'error') {
                      if ((data.message || '').includes('Export failed')) {
                        setShowTargetPainter(false);
                      } else {
                        setViewerError(data.message || 'Coloring sheet failed');
                      }
                    }
                  } catch { }
                }}
              />
            </View>

            <View style={styles.targetPainterControls}>
              <View style={styles.targetPainterControlsHeader}>
                <Text style={styles.targetPainterLabel}>Palette</Text>
              </View>
              <View style={styles.targetPainterColorsRow}>
                <TouchableOpacity
                  onPress={() => setIsEraser(!isEraser)}
                  style={[styles.targetPainterEraserBtn, isEraser && styles.targetPainterEraserBtnActive]}>
                  <Eraser size={moderateScale(18)} color={isEraser ? '#fff' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
                <View style={styles.vDivider} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.targetPainterColors}>
                  <View style={styles.targetPainterColorsInner}>
                    {COLOR_SWATCHES.map(color => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => { setBrushColor(color); setIsEraser(false); }}
                        style={[
                          styles.targetPainterColorSwatch,
                          { backgroundColor: color },
                          (!isEraser && brushColor === color) && styles.targetPainterColorSwatchActive,
                        ]}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.targetPainterSizeHeader}>
                <Text style={styles.targetPainterLabel}>Brush Size: {sheetBrushSize}px</Text>
              </View>
              <View style={styles.targetPainterSizeRow}>
                <TouchableOpacity
                  onPress={() => setSheetBrushSize(current => Math.max(1, current - 1))}
                  style={styles.targetPainterSizeBtn}>
                  <Minus size={moderateScale(15)} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
                <View style={styles.targetPainterSliderWrap}>
                  <CustomSlider
                    value={sheetBrushSize}
                    min={1}
                    max={50}
                    onChange={setSheetBrushSize}
                    color={isEraser ? '#6C4CFF' : brushColor}
                  />
                </View>
                <TouchableOpacity
                  onPress={() => setSheetBrushSize(current => Math.min(50, current + 2))}
                  style={styles.targetPainterSizeBtn}>
                  <Plus size={moderateScale(15)} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.targetPainterFooter, { paddingBottom: insets.bottom + verticalScale(12) }]}>
              <TouchableOpacity
                onPress={() => setShowTargetPainter(false)}
                style={styles.targetPainterSecondary}>
                <Text style={styles.targetPainterSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => sendToSheetWebView({ type: 'export' })}
                style={styles.targetPainterPrimary}>
                <Text style={styles.targetPainterPrimaryText}>Apply To Model</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      )}

      {isExporting && (
        <View style={styles.exportOverlay}>
          <ActivityIndicator size="large" color="#DA70D6" />
          <Text style={styles.exportTitle}>{exportStatusText || 'Preparing AR...'}</Text>
          <Text style={styles.exportCopy}>Please keep the app open</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Landscape Coloring Sheet (tp = targetPainter landscape) ────────────
  tpPanel: {
    width: scale(200),
    backgroundColor: 'rgba(14,14,30,0.97)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'column',
  },
  tpPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: verticalScale(0),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tpPanelTitleRow: {
    flex: 1,
  },
  tpPanelTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#fff',
  },
  tpPanelScroll: {
    flex: 1,
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(8),
  },
  tpEraserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(8),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tpEraserRowActive: {
    backgroundColor: '#6C4CFF',
    borderColor: '#6C4CFF',
  },
  tpEraserLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tpSectionLabel: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: verticalScale(6),
  },
  tpColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(7),
  },
  tpColorSwatch: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tpColorSwatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  tpBrushPreviewRow: {
    alignItems: 'center',
    justifyContent: 'center',
    height: verticalScale(28),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: moderateScale(8),
    marginBottom: verticalScale(2),
  },
  tpBrushPreviewDot: {
    // width/height/borderRadius/backgroundColor applied inline
  },
  tpPanelFooter: {
    gap: verticalScale(6),
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tpCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tpApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(5),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(10),
    backgroundColor: '#6C4CFF',
  },
  tpCanvas: {
    flex: 1,
  },
  tpCanvasInner: {
    flex: 1,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  // ── end landscape painter styles ───────────────────────────────────────

  root: {
    flex: 1,
    backgroundColor: '#0b1226',
  },
  loadingRootDark: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b1226',
  },
  notFoundText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
  },
  topBar: {
    position: 'absolute',
    left: scale(8),
    right: scale(8),
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(10),
  },
  backPill: {
    backgroundColor: '#6C4CFF',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  backPillText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: '#fff',
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    marginRight: scale(40)

  },
  topBarTitleText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#fff',
    backgroundColor: 'rgba(20,20,40,0.85)',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: 'auto',
    alignSelf: 'center'
  },

  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  iconPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(8),
    padding: moderateScale(2),
  },
  iconPillActive: {
    backgroundColor: 'rgba(108,76,255,0.6)',
  },
  viewerShell: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11,18,38,0.78)',
    paddingHorizontal: scale(24),
    zIndex: 50,
  },
  overlayTitle: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#fff',
  },
  overlayCopy: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  retryPill: {
    marginTop: verticalScale(14),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
  },
  retryPillText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#121826',
  },
  hiddenAudio: {
    position: 'absolute',
    width: 40,
    height: 40,
    left: -100,
    top: -100,
    opacity: 0,
  },
  sideToggleLeft: {
    position: 'absolute',
    left: scale(10),
    top: '45%',
    zIndex: 25,
    backgroundColor: 'rgba(20,20,40,0.9)',
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    gap: verticalScale(6),
  },
  sideToggleRight: {
    position: 'absolute',
    right: scale(10),
    top: '45%',
    zIndex: 25,
    backgroundColor: 'rgba(20,20,40,0.9)',
    borderRadius: moderateScale(14),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    gap: verticalScale(6),
  },
  sideToggleText: {
    fontSize: moderateScale(9),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  sidePanel: {
    position: 'absolute',
    zIndex: 45,
    width: '72%',
    maxWidth: scale(280),
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  sidePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(14),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sidePanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  sidePanelIconBubble: {
    width: scale(30),
    height: scale(30),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(108,76,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidePanelIconBubblePink: {
    backgroundColor: 'rgba(218,112,214,0.3)',
  },
  sidePanelTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
  },
  sidePanelScroll: {
    flex: 1,
    padding: moderateScale(12),
  },
  sectionCard: {
    padding: moderateScale(12),
    borderRadius: moderateScale(14),
    marginBottom: verticalScale(10),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: {
    marginBottom: verticalScale(8),
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  worldChip: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(10),
    marginRight: scale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  worldChipActive: {
    backgroundColor: '#6C4CFF',
    borderColor: '#6C4CFF',
  },
  worldChipText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: '#fff',
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    marginBottom: verticalScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(12),
    color: '#fff',
    paddingVertical: 0,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    padding: moderateScale(8),
    borderRadius: moderateScale(10),
    marginBottom: verticalScale(4),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  assetRowActive: {
    backgroundColor: 'rgba(108,76,255,0.3)',
    borderColor: 'rgba(108,76,255,0.5)',
  },
  assetThumb: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  assetThumbImage: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(6),
  },
  assetThumbEmoji: {
    fontSize: moderateScale(16),
  },
  assetName: {
    flex: 1,
    fontSize: moderateScale(13),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  audioTrackCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: moderateScale(10),
    padding: moderateScale(8),
    marginBottom: verticalScale(10),
  },
  audioTrackText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
  },
  controlSubLabel: {
    marginBottom: verticalScale(4),
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  controlRow: {
    marginBottom: verticalScale(10),
  },
  choiceChip: {
    paddingHorizontal: scale(11),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  choiceChipTeal: {
    backgroundColor: '#0EA5A4',
  },
  choiceChipPink: {
    backgroundColor: '#DA70D6',
  },
  choiceChipText: {
    fontSize: moderateScale(12),
    color: '#fff',
    fontWeight: '600',
  },
  audioFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  audioPlayButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(10),
    padding: moderateScale(8),
  },
  audioPlayButtonActive: {
    backgroundColor: '#0EA5A4',
  },
  volumeText: {
    fontSize: moderateScale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  panelButtonRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  largeControlButton: {
    flex: 1,
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(4),
  },
  largeControlButtonPink: {
    backgroundColor: '#DA70D6',
  },
  largeControlButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#fff',
  },
  lightingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    paddingVertical: verticalScale(10),
  },
  lightingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: '45%',
  },
  lightingChipActive: {
    backgroundColor: 'rgba(108,76,255,0.4)',
    borderColor: 'rgba(108,76,255,0.5)',
  },
  lightingSwatch: {
    width: scale(36),
    height: scale(32),
    borderRadius: moderateScale(8),
  },
  lightingChipText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#fff',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(9),
    paddingTop: verticalScale(4),
    backgroundColor: 'rgba(20,20,40,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  bottomIconButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(12),
    padding: moderateScale(10),
  },
  bottomIconButtonPrimary: {
    backgroundColor: '#6C4CFF',
  },
  bottomIconButtonSecondary: {
    backgroundColor: 'rgba(218,112,214,0.4)',
    borderRadius: moderateScale(12),
    padding: moderateScale(10),
    borderWidth: 1,
    borderColor: 'rgba(218,112,214,0.3)',
  },
  bottomInfo: {
    flex: 1,
  },
  bottomInfoMeta: {
    fontSize: moderateScale(11),
    color: 'rgba(255,255,255,0.7)',
  },
  bottomInfoTitle: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  paintSwitchContainer: {
    position: 'absolute',
    left: scale(10),
    zIndex: 40,
    alignItems: 'center',
    gap: verticalScale(4),
  },
  paintSwitchTopLabel: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'capitalize',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  paintSwitch: {
    width: scale(65),
    height: verticalScale(28),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(20,20,40,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  paintSwitchActiveHighlight: {
    backgroundColor: 'rgba(108,76,255,0.3)',
    borderColor: 'rgba(108,76,255,0.5)',
  },
  paintSwitchThumb: {
    width: scale(22),
    height: scale(22),
    borderRadius: moderateScale(11),
    backgroundColor: '#fff',
  },
  paintSwitchThumbActive: {
    transform: [{ translateX: scale(37) }],
    backgroundColor: '#6C4CFF',
  },
  paintSwitchLabel: {
    position: 'absolute',
    right: scale(8),
    fontSize: moderateScale(8),
    fontWeight: '900',
    color: '#fff',
  },
  paintSwitchText: {
    fontSize: moderateScale(14),
    color: '#fff',
    fontWeight: '600',
  },
  paintSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginBottom: verticalScale(20),
  },
  brushSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
  },
  brushSettingsText: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  sheetPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    backgroundColor: '#6C4CFF',
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    marginTop: verticalScale(10),
  },
  sheetPrimaryButtonText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  controlBarContent: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    gap: scale(24),
    marginHorizontal: 'auto'
  },
  controlBarItem: {
    alignItems: 'center',
    gap: verticalScale(6),
  },
  controlIconWrap: {
    width: scale(43),
    height: scale(43),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlIconWrapActive: {
    backgroundColor: 'rgba(108,76,255,0.25)',
    borderColor: '#6C4CFF',
  },
  // Landscape compact variants
  controlBarItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(20),
  },
  controlBarItemCompactActive: {
    backgroundColor: '#6C4CFF',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlIconWrapCompact: {
    width: scale(22),
    height: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabelCompact: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  controlLabelCompactActive: {
    color: '#fff',
    fontWeight: '800',
  },
  controlLabel: {
    fontSize: moderateScale(9),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(10),
  },
  sheetContentContainer: {
    paddingBottom: verticalScale(24),
  },
  sheetInner: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(16),
  },
  sheetSub: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: verticalScale(20),
  },
  sheetRow: {
    marginBottom: verticalScale(20),
  },
  audioSheetContent: {
    paddingBottom: verticalScale(20),
  },
  audioVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginTop: verticalScale(16),
  },
  volumeSlider: {
    flex: 1,
    height: verticalScale(4),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
  },
  customSliderContainer: {
    flex: 1,
    height: verticalScale(30),
    justifyContent: 'center',
    position: 'relative',
  },
  customSliderTrack: {
    height: verticalScale(4),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  customSliderFill: {
    height: '100%',
  },
  customSliderThumb: {
    position: 'absolute',
    width: moderateScale(16),
    height: moderateScale(16),
    borderRadius: moderateScale(8),
    marginLeft: -moderateScale(8),
    top: verticalScale(7),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  arButton: {
    backgroundColor: 'rgba(14,165,164)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(7),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.3)',
    position: 'absolute',

    right: scale(10),
    zIndex: 45,
  },
  arButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  brushPanel: {
    position: 'absolute',
    left: scale(8),
    right: scale(8),
    zIndex: 45,
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  brushHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  brushTitle: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginBottom: verticalScale(12),
  },
  colorSwatch: {
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  brushSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(12),
  },
  brushSizeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(8),
    padding: moderateScale(6),
  },
  brushActionsRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  panelButton: {
    flex: 1,
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    alignItems: 'center',
  },
  panelButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  panelButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
    color: '#fff',
  },
  panelButtonTextActive: {
    fontWeight: '700',
  },
  targetPainterOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(11,18,38,0.97)',
  },
  targetPainterHeader: {
    paddingHorizontal: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  targetPainterTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#fff',
  },
  targetPainterClose: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(10),
    padding: moderateScale(8),
  },
  targetPainterBody: {
    flex: 1,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    marginHorizontal: scale(12),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
  },
  targetPainterWebView: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  targetPainterControls: {
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(10),
  },
  targetPainterColors: {
    flex: 1,
    marginLeft: scale(4),
  },
  targetPainterColorsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingRight: scale(16),
  },
  targetPainterColorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetPainterEraserBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  targetPainterEraserBtnActive: {
    backgroundColor: '#6C4CFF',
    borderColor: '#6C4CFF',
  },
  vDivider: {
    width: 1,
    height: verticalScale(24),
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: scale(10),
  },
  targetPainterControlsHeader: {
    marginBottom: verticalScale(8),
  },
  targetPainterSizeHeader: {
    marginTop: verticalScale(14),
    marginBottom: verticalScale(8),
    marginLeft: scale(12),
  },
  targetPainterLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  targetPainterSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  targetPainterSizeBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  targetPainterSliderWrap: {
    flex: 1,
    height: verticalScale(30),
    justifyContent: 'center',
  },
  targetPainterColorSwatch: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  targetPainterColorSwatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  targetPainterFooter: {
    paddingHorizontal: scale(12),
    flexDirection: 'row',
    gap: scale(8),
  },
  targetPainterSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(44),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  targetPainterSecondaryText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#fff',
  },
  targetPainterPrimary: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(44),
    borderRadius: moderateScale(12),
    backgroundColor: '#6C4CFF',
  },
  targetPainterPrimaryText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: '#fff',
  },
  exportOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11,18,38,0.85)',
    paddingHorizontal: scale(24),
  },
  exportTitle: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  exportCopy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  playPauseControlRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(20),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: verticalScale(10),
  },
  playPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: scale(30),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: scale(150),
  },
  playPauseBtnActive: {
    backgroundColor: '#6C4CFF',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playPauseBtnText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
