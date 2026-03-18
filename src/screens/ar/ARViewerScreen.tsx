import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
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
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import {WebView} from 'react-native-webview';
import Video, {type VideoRef} from 'react-native-video';
import {
  Brush,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Cuboid,
  Grid2X2,
  Image as ImageIcon,
  Menu,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Minus,
} from 'lucide-react-native';
import {ARService} from '@/services';
import {API_BASE_URL} from '@/config';
import type {ARAudioTrack, ARModel, MainStackParamList} from '@/types';
import {
  type AREnvironmentView,
  getBrowsableEnvironments,
  getModelsForEnvironment,
  getModelStableId,
  sortLanguages,
  sortLevels,
} from './ar.data';
import {buildARViewerHtml, buildColorSheetHtml} from './arViewerHtml';
import {openModelInAR, openModelInARFromBase64} from './nativeAR';

type ARViewerRouteProp = RouteProp<MainStackParamList, 'ARViewer'>;
type ARViewerNavigationProp = StackNavigationProp<MainStackParamList, 'ARViewer'>;

const LIGHTING_OPTIONS = [
  {name: 'sunset', label: '🌅 Sunset', bgColors: ['#1a0a2e', '#4a1c5c', '#d4576b', '#f4a460'] as string[]},
  {name: 'dawn', label: '🌄 Dawn', bgColors: ['#0d1b2a', '#1b263b', '#e63946', '#ffbe0b'] as string[]},
  {name: 'night', label: '🌙 Night', bgColors: ['#0b1226', '#07102a', '#0a0e1a', '#0b1226'] as string[]},
  {name: 'warehouse', label: '🏢 Studio', bgColors: ['#2d3436', '#4a4a4a', '#636e72', '#2d3436'] as string[]},
  {name: 'forest', label: '🌲 Forest', bgColors: ['#0a1d10', '#1a3c28', '#2d5a3d', '#4a7c59'] as string[]},
  {name: 'apartment', label: '🏠 Room', bgColors: ['#f5f5dc', '#d4c4a8', '#c9b896', '#f5f5dc'] as string[]},
];

const COLOR_SWATCHES = ['#ff0000', '#00b894', '#0984e3', '#fdcb6e', '#6c5ce7', '#e17055', '#00cec9', '#fd79a8'];
const TARGET_ASSETS: Record<string, string> = {
  Bear: 'https://i.ibb.co/HfV3WzxQ/Bear.jpg',
  Dog: 'https://i.ibb.co/1fM6PTmP/Dog.jpg',
  Dolphin: 'https://i.ibb.co/cStPr4fY/Dolphin.jpg',
  Elephant: 'https://i.ibb.co/p6WG1hLc/Elephant.jpg',
  Wolf: 'https://i.ibb.co/35LpnYGX/Wolf.jpg',
};

const REFERENCE_IMAGE_ASSETS_BY_MODEL: Record<string, string> = {
  bear: 'reference_bear_page.jpg',
};

function normalizeReferenceSource(value: string) {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('/')
  ) {
    return value;
  }
  if (value.includes('/')) {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
    return `${base}${value.replace(/^\/+/, '')}`;
  }
  return value;
}

function resolvePreviewReference(model: ARModel, value: string) {
  const raw = value.trim();
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('file://')) {
    return raw;
  }
  const modelId = model._id || model.id;
  return modelId ? ARService.getPreviewImageUrl(modelId) : normalizeReferenceSource(raw);
}

function normalizeReferenceForDisplay(value: string) {
  const normalized = normalizeReferenceSource(value);
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('file://')
  ) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`;
  }
  return Platform.OS === 'android'
    ? `file:///android_asset/${normalized}`
    : normalized;
}

function getReferenceImageSource(model?: ARModel | null) {
  if (!model) return null;
  const previewValue = (model as any).preview_image || model.previewImage;
  if (previewValue) {
    return resolvePreviewReference(model, String(previewValue));
  }
  const rawReference =
    (model as any).referenceImageUrl ||
    (model as any).referenceUrl ||
    (model as any).referenceImage ||
    (model as any).reference_image ||
    (model as any).targetImageUrl ||
    (model as any).targetImage ||
    (model as any).sheetImage ||
    (model as any).sheetUrl ||
    (model as any).arSheet ||
    (model as any).arSheetUrl ||
    (model as any).coloringPage ||
    (model as any).coloringPageUrl ||
    (model as any).colorSheet ||
    (model as any).colorSheetUrl ||
    (model as any).reference;
  if (rawReference) {
    return String(rawReference);
  }
  const key = (model.name || model.id || model._id || '').toString().trim().toLowerCase();
  if (key && REFERENCE_IMAGE_ASSETS_BY_MODEL[key]) {
    return REFERENCE_IMAGE_ASSETS_BY_MODEL[key];
  }
  return null;
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
        active ? {backgroundColor: color, borderColor: color} : styles.panelButtonInactive,
      ]}>
      <Text style={[styles.panelButtonText, active && styles.panelButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ARViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ARViewerNavigationProp>();
  const route = useRoute<ARViewerRouteProp>();
  const {modelId, environmentId, openPainter = false, initialPaintMode = 'model'} = route.params;

  const webViewRef = useRef<WebView>(null);
  const sheetWebViewRef = useRef<WebView>(null);
  const audioRef = useRef<VideoRef>(null);

  const [loadingModel, setLoadingModel] = useState(true);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [environment, setEnvironment] = useState('sunset');
  const [autoRotate, setAutoRotate] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showLeftMenu, setShowLeftMenu] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [animations, setAnimations] = useState<string[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [paintMode, setPaintMode] = useState<'model' | 'target'>('model');
  const [paintingEnabled, setPaintingEnabled] = useState(false);
  const [textureDisplayMode, setTextureDisplayMode] = useState<'original' | 'model-paint' | 'target-paint'>('original');
  const [targetTextureDataUrl, setTargetTextureDataUrl] = useState<string | null>(null);
  const [showTargetPainter, setShowTargetPainter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [volume] = useState(100);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [showBrushControls, setShowBrushControls] = useState(false);
  const [brushColor, setBrushColor] = useState(COLOR_SWATCHES[0] || '#ff0000');
  const [brushSize, setBrushSize] = useState(12);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  const modelsQuery = useQuery({
    queryKey: ['ar-models'],
    queryFn: async () => {
      const response = await ARService.getAllModels();
      return response.modals || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const foldersQuery = useQuery({
    queryKey: ['ar-folders'],
    queryFn: async () => {
      const response = await ARService.getFolders();
      return response.data?.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const audioQuery = useQuery({
    queryKey: ['ar-model-audios', modelId],
    queryFn: () => ARService.getModelAudios(modelId),
    enabled: !!modelId,
    staleTime: 1000 * 60 * 5,
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

  const availableAudios = useMemo(
    () => (audioQuery.data?.audios || []) as ARAudioTrack[],
    [audioQuery.data?.audios],
  );

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

  const selectedAudio = useMemo(
    () =>
      availableAudios.find(
        audio => audio.language === selectedLanguage && audio.level === selectedLevel,
      ) || null,
    [availableAudios, selectedLanguage, selectedLevel],
  );

  useEffect(() => {
    if (!uniqueLanguages.length) {
      setSelectedLanguage(null);
      setSelectedLevel(null);
      return;
    }
    setSelectedLanguage(current => (current && uniqueLanguages.includes(current) ? current : uniqueLanguages[0]));
  }, [uniqueLanguages]);

  useEffect(() => {
    if (!uniqueLevels.length) {
      setSelectedLevel(null);
      return;
    }
    setSelectedLevel(current => (current && uniqueLevels.includes(current) ? current : uniqueLevels[0]));
  }, [uniqueLevels]);

  useEffect(() => {
    setLoadingModel(true);
    setViewerError(null);
    setProgress(0);
    setShowLeftMenu(false);
    setShowRightPanel(false);
    setAudioPlaying(false);
    setAssetSearchTerm('');
    setPaintingEnabled(false);
    setTextureDisplayMode('original');
    setTargetTextureDataUrl(null);
    setShowTargetPainter(false);
    setPaintMode('model');
    setBrushColor(COLOR_SWATCHES[0] || '#ff0000');
    setBrushSize(12);
    setIsExporting(false);
    setExportStatusText('');
  }, [modelId]);

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
    sendToWebView({type: 'enablePaint', value: paintingEnabled});
    if (textureDisplayMode === 'original') {
      sendToWebView({type: 'showOriginalTexture'});
      return;
    }
    if (textureDisplayMode === 'model-paint') {
      sendToWebView({type: 'showPaintTexture'});
      return;
    }
    if (textureDisplayMode === 'target-paint') {
      if (targetTextureDataUrl) {
        sendToWebView({type: 'applyTargetTexture', dataUrl: targetTextureDataUrl});
      }
    }
  }, [loadingModel, paintingEnabled, targetTextureDataUrl, textureDisplayMode]);

  const modelUrl = useMemo(
    () => (currentModel ? ARService.getModelFileUrl(getModelStableId(currentModel)) : ''),
    [currentModel],
  );

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
    if (!selectedAudio?.gridfsId) {
      return undefined;
    }
    const uri = ARService.getAudioStreamUrlById(selectedAudio.gridfsId) || '';
    return uri ? {uri} : undefined;
  }, [selectedAudio?.gridfsId]);

  const currentLighting =
    LIGHTING_OPTIONS.find(item => item.name === environment) || LIGHTING_OPTIONS[0];

  const viewerLoading = modelsQuery.isPending || foldersQuery.isPending || !currentModel;
  const topBarTop = insets.top + verticalScale(4);
  const topBarHeight = verticalScale(44);
  const webViewTop = topBarTop + topBarHeight + verticalScale(4);
  const bottomBarHeight = insets.bottom + verticalScale(68);

  const sendToWebView = (payload: object) => {
    webViewRef.current?.postMessage(JSON.stringify(payload));
  };

  const sendToSheetWebView = (payload: object) => {
    sheetWebViewRef.current?.postMessage(JSON.stringify(payload));
  };

  useEffect(() => {
    sendToWebView({type: 'setBrushColor', value: brushColor});
    sendToSheetWebView({type: 'setBrushColor', value: brushColor});
  }, [brushColor]);

  useEffect(() => {
    sendToWebView({type: 'setBrushSize', value: brushSize});
    sendToSheetWebView({type: 'setBrushSize', value: brushSize});
  }, [brushSize]);

  const handleWebMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
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
        setViewerError(data.message || 'Failed to load model');
        setLoadingModel(false);
        setIsExporting(false);
      }
    } catch {}
  };

  const handleRetry = () => {
    setLoadingModel(true);
    setViewerError(null);
    setProgress(0);
    webViewRef.current?.reload();
  };

  const toggleAudio = () => {
    if (!selectedAudio) {
      return;
    }
    setAudioPlaying(current => !current);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    const nextLevels = sortLevels(
      [...new Set(availableAudios.filter(audio => audio.language === language).map(audio => audio.level))],
    );
    setSelectedLevel(nextLevels[0] || null);
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
        audios: availableAudios.map(audio => ({
          gridfsId: audio.gridfsId,
          language: audio.language,
          level: audio.level,
        })),
        animations,
      });
    } catch (error: any) {
      setViewerError(error?.message || 'Unable to export custom AR model');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenAR = async () => {
    if (!currentModel || !modelUrl) {
      return;
    }
    if (textureDisplayMode !== 'original') {
      setIsExporting(true);
      setExportStatusText('Preparing Custom AR Model...');
      sendToWebView({type: 'exportGLB'});
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

      <View style={[styles.topBar, {top: topBarTop, height: topBarHeight}]}>
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

        <Text numberOfLines={1} style={styles.topBarTitle}>
          {currentModel.name || '3D Model'}
        </Text>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={() => {
              const next = !wireframe;
              setWireframe(next);
              sendToWebView({type: 'toggleWireframe', value: next});
            }}
            style={[
              styles.iconPill,
              wireframe && styles.iconPillActive,
            ]}>
            <Grid2X2 size={moderateScale(15)} color="#fff" strokeWidth={2.1} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const next = !autoRotate;
              setAutoRotate(next);
              sendToWebView({type: 'toggleRotate', value: next});
            }}
            style={[
              styles.iconPill,
              autoRotate && styles.iconPillActive,
            ]}>
            <RefreshCw size={moderateScale(15)} color="#fff" strokeWidth={2.1} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.viewerShell, {marginTop: webViewTop, marginBottom: bottomBarHeight}]}>
        <WebView
          ref={webViewRef}
          source={{html: viewerHtml, baseUrl: 'https://learn-api.eduzon.ai'}}
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
            const {url} = request;
            return url.startsWith('http') || url.startsWith('about:') || url.startsWith('data:');
          }}
          onMessage={handleWebMessage}
          onLoadEnd={() => {
            setTimeout(() => {
              setLoadingModel(current => (viewerError ? current : false));
            }, 10000);
          }}
          onError={() => setLoadingModel(false)}
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
          playInBackground
          playWhenInactive
          audioOutput="speaker"
          ignoreSilentSwitch="ignore"
        />
      )}

      {!showLeftMenu && (
        <TouchableOpacity
          onPress={() => {
            setShowLeftMenu(true);
            setShowRightPanel(false);
          }}
          activeOpacity={0.8}
          style={styles.sideToggleLeft}>
          <Menu size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
          <Text style={styles.sideToggleText}>Menu</Text>
        </TouchableOpacity>
      )}

      {!showRightPanel && (
        <TouchableOpacity
          onPress={() => {
            setShowRightPanel(true);
            setShowLeftMenu(false);
          }}
          activeOpacity={0.8}
          style={styles.sideToggleRight}>
          <Settings2 size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
          <Text style={styles.sideToggleText}>Controls</Text>
        </TouchableOpacity>
      )}

      {showLeftMenu && (
        <View style={[styles.sidePanel, {left: scale(8), top: webViewTop, bottom: bottomBarHeight - verticalScale(8)}]}>
          <View style={styles.sidePanelHeader}>
            <View style={styles.sidePanelTitleRow}>
              <View style={styles.sidePanelIconBubble}>
                <Cuboid size={moderateScale(16)} color="#6C4CFF" strokeWidth={2} />
              </View>
              <Text style={styles.sidePanelTitle}>Menu</Text>
            </View>
            <TouchableOpacity onPress={() => setShowLeftMenu(false)}>
              <ChevronLeft size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sidePanelScroll} showsVerticalScrollIndicator={false}>
            {renderSection('Paint Mode', '🎨', (
              <View style={styles.panelButtonRow}>
                <PanelButton
                  label="🎲 3D Paint"
                  active={paintMode === 'model'}
                  onPress={() => {
                    setPaintMode('model');
                    setPaintingEnabled(true);
                    setTextureDisplayMode('model-paint');
                    setBrushColor(COLOR_SWATCHES[0] || '#ff0000');
                    sendToWebView({type: 'enablePaint', value: true});
                    sendToWebView({type: 'showPaintTexture'});
                  }}
                  color="#6C4CFF"
                />
                <PanelButton
                  label="🖼️ Sheet"
                  active={paintMode === 'target'}
                  onPress={() => {
                    setPaintMode('target');
                    setPaintingEnabled(false);
                    sendToWebView({type: 'enablePaint', value: false});
                    setShowTargetPainter(true);
                  }}
                  color="#DA70D6"
                />
              </View>
            ))}

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
                  const previewUri = (() => {
                    if (model.previewUrl) {
                      return model.previewUrl;
                    }
                    if (model.previewImage) {
                      const raw = String(model.previewImage);
                      if (raw.startsWith('http://') || raw.startsWith('https://')) {
                        return raw;
                      }
                    }
                    const previewModelId = model._id || model.id;
                    return previewModelId ? ARService.getPreviewImageUrl(previewModelId) : null;
                  })();

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
                          {previewUri ? (
                            <Image source={{uri: previewUri}} resizeMode="contain" style={styles.assetThumbImage} />
                          ) : (
                            <Text style={styles.assetThumbEmoji}>{currentEnvironment.emoji || '🎨'}</Text>
                          )}
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

      {showRightPanel && (
        <View style={[styles.sidePanel, {right: scale(8), top: webViewTop, bottom: bottomBarHeight - verticalScale(8)}]}>
          <View style={styles.sidePanelHeader}>
            <View style={styles.sidePanelTitleRow}>
              <View style={[styles.sidePanelIconBubble, styles.sidePanelIconBubblePink]}>
                <Settings2 size={moderateScale(16)} color="#DA70D6" strokeWidth={2} />
              </View>
              <Text style={styles.sidePanelTitle}>Controls</Text>
            </View>
            <TouchableOpacity onPress={() => setShowRightPanel(false)}>
              <ChevronRight size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sidePanelScroll} showsVerticalScrollIndicator={false}>
            {renderSection('Display Texture', '🎨', (
              <View style={styles.panelButtonRow}>
                <PanelButton
                  label="Original"
                  active={textureDisplayMode === 'original'}
                  onPress={() => {
                    setTextureDisplayMode('original');
                    setPaintingEnabled(false);
                    sendToWebView({type: 'enablePaint', value: false});
                    sendToWebView({type: 'showOriginalTexture'});
                  }}
                  color="#555"
                />
                {paintMode === 'model' && (
                  <PanelButton
                    label="3D Paint"
                    active={textureDisplayMode === 'model-paint'}
                    onPress={() => {
                      setTextureDisplayMode('model-paint');
                      setPaintingEnabled(true);
                      sendToWebView({type: 'enablePaint', value: true});
                      sendToWebView({type: 'showPaintTexture'});
                    }}
                    color="#FF9F43"
                  />
                )}
                {paintMode === 'target' && (
                  <PanelButton
                    label="Sheet"
                    active={textureDisplayMode === 'target-paint'}
                    onPress={() => {
                      setPaintingEnabled(false);
                      sendToWebView({type: 'enablePaint', value: false});
                      if (targetTextureDataUrl) {
                        setTextureDisplayMode('target-paint');
                        sendToWebView({type: 'applyTargetTexture', dataUrl: targetTextureDataUrl});
                        return;
                      }
                      setShowTargetPainter(true);
                    }}
                    color="#DA70D6"
                  />
                )}
              </View>
            ))}

            {renderSection('Audio', '🔊', (
              <View>
                <View style={styles.audioTrackCard}>
                  <Text style={styles.audioTrackText} numberOfLines={1}>
                    {selectedAudio
                      ? selectedAudio.audioName || selectedAudio.filename || selectedAudio.gridfsId
                      : 'No audio available'}
                  </Text>
                </View>

                {!!uniqueLanguages.length && (
                  <>
                    <Text style={styles.controlSubLabel}>Language</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlRow}>
                      {uniqueLanguages.map(language => (
                        <TouchableOpacity
                          key={language}
                          onPress={() => handleLanguageChange(language)}
                          style={[
                            styles.choiceChip,
                            selectedLanguage === language && styles.choiceChipTeal,
                          ]}>
                          <Text style={styles.choiceChipText}>{language}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {!!uniqueLevels.length && (
                  <>
                    <Text style={styles.controlSubLabel}>Level</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlRow}>
                      {uniqueLevels.map(level => (
                        <TouchableOpacity
                          key={level}
                          onPress={() => handleLevelChange(level)}
                          style={[
                            styles.choiceChip,
                            selectedLevel === level && styles.choiceChipPink,
                          ]}>
                          <Text style={styles.choiceChipText}>{level}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                <View style={styles.audioFooterRow}>
                  <TouchableOpacity
                    onPress={toggleAudio}
                    style={[
                      styles.audioPlayButton,
                      audioPlaying && styles.audioPlayButtonActive,
                    ]}>
                    {audioPlaying ? (
                      <Pause size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
                    ) : (
                      <Play size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>
                  {volume === 0 ? (
                    <VolumeX size={moderateScale(16)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  ) : volume < 50 ? (
                    <Volume1 size={moderateScale(16)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  ) : (
                    <Volume2 size={moderateScale(16)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
                  )}
                  <Text style={styles.volumeText}>{volume}%</Text>
                </View>
              </View>
            ))}

            {renderSection('Animation', '🎬', (
              <View>
                {!!animations.length && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlRow}>
                    {animations.map((animation, index) => (
                      <TouchableOpacity
                        key={`${animation}-${index}`}
                        onPress={() => {
                          setSelectedAnimation(animation);
                          sendToWebView({type: 'setAnimation', value: animation});
                          NativeModules.ARNativeModule?.setAnimation?.(index);
                        }}
                        style={[
                          styles.choiceChip,
                          selectedAnimation === animation && styles.choiceChipPink,
                        ]}>
                        <Text style={styles.choiceChipText}>{animation}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.panelButtonRow}>
                  <TouchableOpacity
                    onPress={() => {
                      const next = !isPlaying;
                      setIsPlaying(next);
                      sendToWebView({type: 'togglePlay', value: next});
                    }}
                    style={[
                      styles.largeControlButton,
                      isPlaying && styles.largeControlButtonPink,
                    ]}>
                    {isPlaying ? (
                      <Pause size={moderateScale(14)} color="#fff" strokeWidth={2.2} />
                    ) : (
                      <Play size={moderateScale(14)} color="#fff" strokeWidth={2.2} />
                    )}
                    <Text style={styles.largeControlButtonText}>{isPlaying ? 'Pause' : 'Play'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {renderSection('Lighting', '💡', (
              <View style={styles.lightingGrid}>
                {LIGHTING_OPTIONS.map(light => (
                  <TouchableOpacity
                    key={light.name}
                    onPress={() => setEnvironment(light.name)}
                    activeOpacity={0.75}
                    style={[
                      styles.lightingChip,
                      environment === light.name && styles.lightingChipActive,
                    ]}>
                    <LinearGradient colors={light.bgColors} locations={[0, 0.33, 0.67, 1]} style={styles.lightingSwatch} />
                    <Text style={styles.lightingChipText}>{light.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.bottomBar, {paddingBottom: insets.bottom + verticalScale(8)}]}>
        <View style={styles.bottomBarRow}>
          {!!availableAudios.length && (
            <TouchableOpacity
              onPress={toggleAudio}
              style={[
                styles.bottomIconButton,
                audioPlaying && styles.bottomIconButtonPrimary,
              ]}>
              {audioPlaying ? (
                <Pause size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
              ) : (
                <Play size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          )}

          {selectedAudio && (
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomInfoMeta} numberOfLines={1}>
                {selectedLanguage} • {selectedLevel}
              </Text>
              <Text style={styles.bottomInfoTitle} numberOfLines={1}>
                {selectedAudio.audioName || selectedAudio.filename || selectedAudio.gridfsId}
              </Text>
            </View>
          )}

          {paintingEnabled && (
            <TouchableOpacity
              onPress={() => setShowBrushControls(current => !current)}
              style={[
                styles.bottomIconButton,
                showBrushControls && styles.bottomIconButtonSecondary,
              ]}>
              <Brush size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              setPaintMode('target');
              setPaintingEnabled(false);
              setShowBrushControls(false);
              setShowTargetPainter(true);
            }}
            style={styles.bottomIconButtonSecondary}>
            <ImageIcon size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleOpenAR}
            style={styles.arButton}>
            <Cuboid size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
            <Text style={styles.arButtonText}>AR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showBrushControls && (
        <View style={[styles.brushPanel, {bottom: insets.bottom + verticalScale(78)}]}>
          <View style={styles.brushHeader}>
          <Text style={styles.brushTitle}>🖌️ Brush Settings</Text>
            <TouchableOpacity onPress={() => setShowBrushControls(false)}>
              <X size={moderateScale(20)} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <Text style={styles.controlSubLabel}>Color</Text>
          <View style={styles.colorRow}>
            {COLOR_SWATCHES.map(color => (
              <TouchableOpacity
                key={color}
                onPress={() => setBrushColor(color)}
                style={[
                  styles.colorSwatch,
                  {backgroundColor: color},
                  brushColor === color && styles.colorSwatchActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.controlSubLabel}>Size: {brushSize}px</Text>
          <View style={styles.brushSizeRow}>
            <TouchableOpacity
              onPress={() => setBrushSize(current => Math.max(1, current - 4))}
              style={styles.brushSizeButton}>
              <Minus size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
            <View style={styles.brushTrack}>
              <View style={[styles.brushFill, {width: `${(brushSize / 128) * 100}%`, backgroundColor: brushColor}]} />
            </View>
            <TouchableOpacity
              onPress={() => setBrushSize(current => Math.min(128, current + 4))}
              style={styles.brushSizeButton}>
              <Plus size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <View style={styles.brushActionsRow}>
            <PanelButton
              label="Clear"
              active={false}
              onPress={() => {
                sendToWebView({type: 'clearPaint'});
                sendToSheetWebView({type: 'clear'});
              }}
              color="#EF4444"
            />
            <PanelButton
              label="Original"
              active={false}
              onPress={() => {
                setTextureDisplayMode('original');
                setPaintingEnabled(false);
                sendToWebView({type: 'enablePaint', value: false});
                sendToWebView({type: 'showOriginalTexture'});
              }}
              color="#3B82F6"
            />
          </View>
        </View>
      )}

      {showTargetPainter && (
        <View style={styles.targetPainterOverlay}>
          <View style={[styles.targetPainterHeader, {paddingTop: insets.top + verticalScale(8)}]}>
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
              source={{html: colorSheetHtml, baseUrl: targetUrl}}
              style={styles.targetPainterWebView}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              onShouldStartLoadWithRequest={(request) => {
                const {url} = request;
                return (
                  url.startsWith('http') ||
                  url.startsWith('about:') ||
                  url.startsWith('data:') ||
                  url.startsWith('file:')
                );
              }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'textureReady') {
                    setTargetTextureDataUrl(data.dataUrl);
                    sendToWebView({type: 'applyTargetTexture', dataUrl: data.dataUrl});
                    setTextureDisplayMode('target-paint');
                    setShowTargetPainter(false);
                    setPaintMode('target');
                    setPaintingEnabled(false);
                    setShowBrushControls(false);
                  } else if (data.type === 'log') {
                    console.log('[SheetWebView]', data.message);
                  } else if (data.type === 'error') {
                    if ((data.message || '').includes('Export failed')) {
                      setShowTargetPainter(false);
                    } else {
                      setViewerError(data.message || 'Coloring sheet failed');
                    }
                  }
                } catch {}
              }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.targetPainterColors}>
            <View style={styles.targetPainterColorsRow}>
              {COLOR_SWATCHES.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setBrushColor(color)}
                  style={[
                    styles.targetPainterColorSwatch,
                    {backgroundColor: color},
                    brushColor === color && styles.targetPainterColorSwatchActive,
                  ]}
                />
              ))}
            </View>
          </ScrollView>

          <View style={[styles.targetPainterFooter, {paddingBottom: insets.bottom + verticalScale(12)}]}>
            <TouchableOpacity
              onPress={() => setShowTargetPainter(false)}
              style={styles.targetPainterSecondary}>
              <Text style={styles.targetPainterSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => sendToSheetWebView({type: 'export'})}
              style={styles.targetPainterPrimary}>
              <Text style={styles.targetPainterPrimaryText}>Apply To Model</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: 'rgba(20,20,40,0.85)',
    borderRadius: moderateScale(16),
    paddingHorizontal: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    marginHorizontal: scale(6),
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#fff',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  iconPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(8),
    padding: moderateScale(5),
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
    zIndex: 40,
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
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(8),
    marginRight: scale(6),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  choiceChipTeal: {
    backgroundColor: '#0EA5A4',
  },
  choiceChipPink: {
    backgroundColor: '#DA70D6',
  },
  choiceChipText: {
    fontSize: moderateScale(11),
    color: '#fff',
    fontWeight: '500',
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
    gap: scale(6),
  },
  lightingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lightingChipActive: {
    backgroundColor: 'rgba(108,76,255,0.4)',
    borderColor: 'rgba(108,76,255,0.5)',
  },
  lightingSwatch: {
    width: scale(22),
    height: scale(22),
    borderRadius: moderateScale(6),
  },
  lightingChipText: {
    fontSize: moderateScale(11),
    color: '#fff',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(8),
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
  arButton: {
    backgroundColor: 'rgba(14,165,164,0.5)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(14,165,164,0.3)',
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
  brushTrack: {
    flex: 1,
    height: verticalScale(6),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: moderateScale(3),
    overflow: 'hidden',
  },
  brushFill: {
    height: '100%',
    borderRadius: moderateScale(3),
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
  targetPainterColors: {
    marginBottom: verticalScale(8),
  },
  targetPainterColorsRow: {
    flexDirection: 'row',
    gap: scale(8),
    paddingHorizontal: scale(16),
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
    marginTop: verticalScale(12),
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  exportCopy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
});
