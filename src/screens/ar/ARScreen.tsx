import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import {
  Box,
  ChevronLeft,
  Cuboid,
  Image as ImageIcon,
  RefreshCcw,
  TriangleAlert,
} from 'lucide-react-native';
import { ScreenErrorBoundary, Skeleton } from '@/components/ui';
import ARInstructionModal from '@/components/ARInstructionModal';
import { useScreenReady } from '@/hooks/useScreenReady';
import { ARService } from '@/services';
import { API_BASE_URL } from '@/config';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import { useTabBarScroll } from '@/navigation/TabBarScrollContext';
import type {
  ARFolder,
  ARModel,
  BottomTabParamList,
  MainStackParamList,
} from '@/types';
import {
  getBrowsableEnvironments,
  getLevelStars,
  getModelLevel,
  getModelStableId,
  getModelsForEnvironment,
  type AREnvironmentView,
} from './ar.data';
import { ARScannerModule } from './ARScannerModule';
import { useTheme } from '@/theme';

function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;
  const horizontalPadding = isTablet
    ? (isLandscape ? 18 : (isLargeTablet ? 28 : 24))
    : scale(16);
  const maxContentWidth = isLargeTablet ? 980 : isTablet ? 820 : width;
  const availableWidth = width - horizontalPadding * 2;
  const contentWidth = isLandscape ? availableWidth : Math.min(availableWidth, maxContentWidth);
  const gap = isTablet ? 16 : scale(12);
  const numColumns = isLandscape ? 2 : (isLargeTablet ? 3 : isTablet ? 2 : 2);
  const cardWidth = (contentWidth - gap * (numColumns - 1)) / numColumns;
  const isCompactCard = cardWidth < 240;
  const worldCardHeight = isTablet
    ? (isLandscape
      ? Math.max(Math.min(cardWidth * 0.62, 320), 200)
      : Math.max(Math.min(cardWidth * 0.75, 340), 220))
    : Math.max(cardWidth * 0.97, 165);
  const modelPreviewHeight = isTablet ? Math.min(cardWidth * 0.55, 170) : verticalScale(93);
  return {
    isTablet,
    isLargeTablet,
    isLandscape,
    contentWidth,
    horizontalPadding,
    gap,
    numColumns,
    cardWidth,
    isCompactCard,
    worldCardHeight,
    modelPreviewHeight,
  };
}

const LEGACY_GRADIENT_MAP: Record<string, [string, string]> = {
  'from-coral to-coral/70': ['#FF6B6B', '#FF8E8E'],
  'from-secondary to-secondary/70': ['#6C4CFF', '#8B72FF'],
  'from-orchid to-orchid/70': ['#DA70D6', '#E890E8'],
  'from-teal to-teal/70': ['#0EA5A4', '#3CBFBE'],
  'from-accent to-accent/70': ['#FF9F43', '#FFB56D'],
  'from-gray-300 to-gray-100': ['#9CA3AF', '#D1D5DB'],
};

type ARNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'AR'>,
  StackNavigationProp<MainStackParamList>
>;

const REFERENCE_IMAGE_ASSETS_BY_MODEL: Record<string, string> = {
  bear: 'reference_bear_page.jpg',
};

const isAndroid = Platform.OS === 'android';
const androidCardBorder = {
  borderWidth: 1,
  borderColor: 'rgba(17,24,39,0.06)',
};
const galleryHeroEntering = isAndroid
  ? FadeIn.duration(180)
  : ZoomIn.duration(600).springify();
const getGalleryCardEntering = (index: number) =>
  isAndroid
    ? FadeIn.delay(index * 50).duration(180)
    : FadeInDown.delay(index * 100).duration(600).springify();
const galleryLayoutTransition = isAndroid ? undefined : LinearTransition.springify();

function getPreviewUri(model: ARModel) {
  if (model.previewUrl) {
    return model.previewUrl;
  }
  if (model.previewImage) {
    const raw = String(model.previewImage);
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw;
    }
  }
  const modelId = model._id || model.id;
  return modelId ? ARService.getPreviewImageUrl(modelId) : null;
}

function normalizeReferenceSource(value: string) {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('/')
  ) {
    return value;
  }
  // Treat paths with a slash as API-relative, otherwise assume an app asset name.
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

function getReferenceImageSource(model: ARModel) {
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
    return normalizeReferenceSource(String(rawReference));
  }

  const key = (model.name || model.id || model._id || '').toString().trim().toLowerCase();
  if (key && REFERENCE_IMAGE_ASSETS_BY_MODEL[key]) {
    return REFERENCE_IMAGE_ASSETS_BY_MODEL[key];
  }
  return null;
}

function getEnvironmentColors(environment: AREnvironmentView) {
  if (environment.gradient && LEGACY_GRADIENT_MAP[environment.gradient]) {
    return [...LEGACY_GRADIENT_MAP[environment.gradient]];
  }
  if (environment.colors?.length) {
    return [...environment.colors];
  }
  return ['#6C4CFF', '#8B72FF'];
}

function ARLoading() {
  const { colors } = useTheme();
  const { contentWidth, gap, cardWidth, worldCardHeight } = useResponsiveLayout();
  
  return (
    <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
      <View style={{ width: contentWidth, alignSelf: 'center' }}>
        <Skeleton 
          width={contentWidth} 
          height={verticalScale(100)} 
          borderRadius={moderateScale(20)}
          style={{ marginTop: verticalScale(8), marginBottom: verticalScale(14) }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton 
              key={i}
              width={cardWidth} 
              height={worldCardHeight} 
              borderRadius={moderateScale(20)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ARError({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.errorRoot, { backgroundColor: colors.background }]}>
      <View style={styles.errorIconWrap}>
        <TriangleAlert size={moderateScale(40)} color="#EF4444" strokeWidth={2.2} />
      </View>
      <Text style={[styles.errorTitle, { color: colors.text }]}>Oops! Something went wrong</Text>
      <Text style={[styles.errorCopy, { color: colors.textSecondary }]}>
        We could not load the AR environments right now.
      </Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={styles.errorButton}>
        <RefreshCcw size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
        <Text style={styles.errorButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function EnvironmentGallery({
  environments,
  models,
  onEnvironmentSelect,
  refreshing,
  onRefresh,
  topInset,
  bottomInset,
  onScroll,
}: {
  environments: AREnvironmentView[];
  models: ARModel[];
  onEnvironmentSelect: (environment: AREnvironmentView) => void;
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  bottomInset: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { isTablet, contentWidth, gap, cardWidth, worldCardHeight, isCompactCard } = useResponsiveLayout();
  const emojiSize = isCompactCard ? scale(42) : scale(48);
  const emojiRadius = isCompactCard ? moderateScale(14) : moderateScale(16);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        { paddingBottom: bottomInset },
        isTablet && { alignItems: 'center' },
      ]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }>
      <Animated.View
        entering={galleryHeroEntering}
        style={[styles.worldHeroShadow, { marginTop: verticalScale(8), width: contentWidth, alignSelf: 'center' }]}>
        <View style={styles.worldHero}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8557', '#FF9F43', '#87A274', '#3DAA8E', '#0EA5A4']}
            locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) }}>
            <View style={styles.worldHeroIconWrap}>
              <Box size={moderateScale(22)} color="#fff" strokeWidth={2.1} />
            </View>
            <Text style={styles.worldHeroTitle}>AR Worlds</Text>
          </View>
          <Text style={styles.worldHeroCopy}>
            Explore 3D models in augmented reality!{'\n'}Pick a world and start learning.
          </Text>
        </View>
      </Animated.View>

      <View style={[styles.worldGrid, { width: contentWidth, alignSelf: 'center', gap }]}>
        {environments.map((environment, index) => {
          const modelCount = getModelsForEnvironment(environment, models).length;
          return (
            <Animated.View
              key={environment._id}
              entering={getGalleryCardEntering(index)}
              layout={galleryLayoutTransition}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onEnvironmentSelect(environment)}
                style={[styles.worldCardWrap, { width: cardWidth, height: worldCardHeight }]}>
                <View style={[styles.worldCard, isCompactCard && { padding: moderateScale(14) }]}>
                  <LinearGradient
                    colors={getEnvironmentColors(environment)}
                    locations={getEnvironmentColors(environment).length === 2 ? [0, 1] : [0, 0.5, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.worldCountBadge}>
                    <Text style={styles.worldCountText}>📦 {modelCount}</Text>
                  </View>

                  <View style={[styles.worldEmojiBubble, { width: emojiSize, height: emojiSize, borderRadius: emojiRadius }]}>
                    <Text style={styles.worldEmoji}>{environment.emoji || '📦'}</Text>
                  </View>

                  <Text
                    style={[styles.worldName, isCompactCard && { fontSize: moderateScale(14) }]}
                    numberOfLines={1}>
                    {environment.name || environment.folderName}
                  </Text>

                  <Text
                    style={[styles.worldDescription, isCompactCard && { fontSize: moderateScale(10), lineHeight: moderateScale(14) }]}
                    numberOfLines={2}>
                    {environment.description || `Explore ${modelCount} amazing 3D models`}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ModelGallery({
  environment,
  models,
  onBack,
  onOpenModel,
  onScanModel,
  refreshing,
  onRefresh,
  topInset,
  bottomInset,
  onScroll,
}: {
  environment: AREnvironmentView;
  models: ARModel[];
  onBack: () => void;
  onOpenModel: (model: ARModel, opts?: { openPainter?: boolean; initialPaintMode?: string }) => void;
  onScanModel: (model: ARModel) => void;
  refreshing: boolean;
  onRefresh: () => void;
  topInset: number;
  bottomInset: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const { colors } = useTheme();
  const gradientColors = getEnvironmentColors(environment);
  const { isTablet, contentWidth, gap, cardWidth, modelPreviewHeight } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.modelScreenContent,
        { paddingBottom: bottomInset },
        isTablet && { alignItems: 'center' },
      ]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }>
      <Animated.View
        entering={galleryHeroEntering}
        style={[styles.modelsHeroShadow, { marginTop: verticalScale(8), width: contentWidth, alignSelf: 'center' }]}>
        <View style={styles.modelsHero}>
          <LinearGradient
            colors={['#DA70D6', '#A35EEA', '#6C4CFF', '#5B6EEC', '#4A90D9']}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modelsHeroTopRow}>
            <View style={styles.modelsHeroLeft}>
              <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={styles.backButton}>
                <ChevronLeft size={moderateScale(20)} color="#fff" strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={styles.modelsHeroCopyWrap}>
                <View style={styles.modelsHeroHeadingRow}>
                  <Cuboid size={moderateScale(20)} color="#fff" strokeWidth={2} />
                  <Text style={styles.modelsHeroTitle}>3D Models</Text>
                </View>
                <Text style={styles.modelsHeroSubtitle} numberOfLines={1}>
                  {(environment.name || environment.folderName)} • {models.length} models
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onBack} activeOpacity={0.75} style={styles.worldsButton}>
              <Text style={styles.worldsButtonText}>Worlds</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {!models.length ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconBubble, { backgroundColor: colors.card }]}>
            <Box size={moderateScale(36)} color={colors.textTertiary} strokeWidth={2} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Models Available</Text>
          <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
            No 3D models found for {environment.name || environment.folderName}.
          </Text>
          <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backToWorldsButton}>
            <ChevronLeft size={moderateScale(16)} color="#fff" strokeWidth={2.2} />
            <Text style={styles.backToWorldsText}>Back to Environments</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.modelsContent, { width: contentWidth, alignSelf: 'center' }]}>
          <Text style={[styles.modelsCountText, { color: colors.textSecondary }]}>
            <Text style={[styles.modelsCountStrong, { color: colors.text }]}>{models.length}</Text> models available
          </Text>

          <View style={[styles.modelsGrid, { gap }]}>
            {models.map((model, index) => {
              const previewUri = getPreviewUri(model);
              const referenceSource = getReferenceImageSource(model);
              const displayUri = referenceSource
                ? normalizeReferenceForDisplay(referenceSource)
                : previewUri;
              const level = getModelLevel(model);
              const stars = getLevelStars(level);

              return (
                <Animated.View
                  key={getModelStableId(model, index)}
                  entering={getGalleryCardEntering(index)}
                  layout={galleryLayoutTransition}
                  style={[styles.modelCardWrap, { width: cardWidth, backgroundColor: colors.card }]}>
                  <View style={styles.modelGradient}>
                    <LinearGradient
                      colors={gradientColors}
                      locations={gradientColors.length === 2 ? [0, 1] : [0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[styles.modelPreviewShell, { height: modelPreviewHeight }]}>
                      {displayUri ? (
                        <Image
                          source={{ uri: displayUri }}
                          style={styles.modelPreviewImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.modelFallbackEmoji}>{model.icon || environment.emoji || '🎨'}</Text>
                      )}
                    </View>

                    <View style={styles.modelInfoRow}>
                      <Text style={styles.modelName} numberOfLines={1}>
                        {model.name}
                      </Text>
                      <View style={styles.modelStarsBadge}>
                        <Text style={styles.modelStarsText}>{stars}</Text>
                      </View>
                    </View>

                    <View style={styles.modelActionsColumn}>
                      <View style={styles.modelActionsRow}>
                        <TouchableOpacity
                          onPress={() => onOpenModel(model)}
                          activeOpacity={0.85}
                          style={styles.primaryAction}>
                          <Cuboid size={moderateScale(14)} color="#121826" strokeWidth={2.1} />
                          <Text style={styles.primaryActionText}>3D</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() =>
                            onOpenModel(model, {
                              openPainter: true,
                              initialPaintMode: 'target',
                            })
                          }
                          activeOpacity={0.85}
                          style={styles.secondaryAction}>
                          <ImageIcon size={moderateScale(14)} color="#fff" strokeWidth={2.1} />
                          <Text style={styles.secondaryActionText}>Sheet</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => onScanModel(model)}
                        activeOpacity={0.85}
                        style={styles.scanAction}>
                        <Box size={moderateScale(14)} color="#fff" strokeWidth={2.1} />
                        <Text style={styles.scanActionText}>AR Scan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ARScreenContent() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ARNavigationProp>();
  const screenReady = useScreenReady();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const { tabBarTranslateY } = useTabBarScroll();
  const lastScrollY = useRef(0);
  const [instructionVisible, setInstructionVisible] = useState(false);
  const [scanningModel, setScanningModel] = useState<ARModel | null>(null);

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

  const models = useMemo(() => (modelsQuery.data || []) as ARModel[], [modelsQuery.data]);
  const environments = useMemo(
    () => getBrowsableEnvironments((foldersQuery.data || []) as ARFolder[], models),
    [foldersQuery.data, models],
  );
  const selectedEnvironment = useMemo(
    () => environments.find(environment => environment._id === selectedEnvironmentId) || null,
    [environments, selectedEnvironmentId],
  );
  const environmentModels = useMemo(
    () => getModelsForEnvironment(selectedEnvironment, models),
    [models, selectedEnvironment],
  );

  const loading = !screenReady || modelsQuery.isPending || foldersQuery.isPending;
  const refreshing = modelsQuery.isRefetching || foldersQuery.isRefetching;
  const hasError = modelsQuery.isError || foldersQuery.isError;
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const bottomInset = tabBarHeight + verticalScale(12);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const diff = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 0) {
        tabBarTranslateY.value = 0;
        return;
      }
      if (diff > 0) {
        tabBarTranslateY.value = tabBarHeight;
      } else if (diff < -2) {
        tabBarTranslateY.value = 0;
      }
    },
    [tabBarTranslateY, tabBarHeight],
  );

  useEffect(() => {
    if (
      !selectedEnvironmentId &&
      environments.length === 1 &&
      environments[0].matchMode === 'all'
    ) {
      setSelectedEnvironmentId(environments[0]._id);
    }
  }, [environments, selectedEnvironmentId]);

  const refreshAll = () => {
    modelsQuery.refetch();
    foldersQuery.refetch();
  };

  const handleOpenModel = (
    model: ARModel,
    opts?: { openPainter?: boolean; initialPaintMode?: string },
  ) => {
    navigation.navigate('ARViewer', {
      modelId: getModelStableId(model),
      environmentId: selectedEnvironment?._id,
      openPainter: opts?.openPainter,
      initialPaintMode: opts?.initialPaintMode === 'target' ? 'target' : 'model',
    });
  };

  const startActualScan = async (model: ARModel) => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'AR Scan is currently available on Android only.');
      return;
    }

    try {
      const supported = await ARScannerModule.isARSupported();
      if (!supported) {
        Alert.alert('Not Supported', 'ARCore is not available on this device.');
        return;
      }

      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Camera Permission', 'Camera permission is required for AR Scan.');
        return;
      }

      const modelId = model._id || model.id || (model as any).name;
      if (!modelId) {
        Alert.alert('Error', 'Model ID not found.');
        return;
      }

      const modelFileUrl = ARService.getModelFileUrl(modelId);
      const referenceImageUrl =
        getReferenceImageSource(model) || ARService.getPreviewImageUrl(modelId);

      // Fetch audios for this model
      let audiosJson: string | undefined;
      try {
        const audiosResponse = await ARService.getModelAudios(modelId);
        if (audiosResponse.audios?.length) {
          const audiosWithUrls = audiosResponse.audios.map(a => ({
            ...a,
            audioUrl: ARService.getAudioStreamUrlById(a.gridfsId),
          }));
          audiosJson = JSON.stringify(audiosWithUrls);
        }
      } catch {
        // Audio fetch failed — scanner will work without audio
      }

      await ARScannerModule.startScannerDynamic(
        modelFileUrl,
        referenceImageUrl,
        model.name || 'model',
        audiosJson,
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to launch AR Scanner.');
    }
  };

  const handleScanModel = (model: ARModel) => {
    setScanningModel(model);
    setInstructionVisible(true);
  };

  if (loading) {
    return <ARLoading />;
  }

  if (hasError && !models.length) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <ARError
          onRetry={() => {
            modelsQuery.refetch();
            foldersQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <>
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? 'light-content' : 'dark-content'} />
      {selectedEnvironment ? (
        <ModelGallery
          environment={selectedEnvironment}
          models={environmentModels}
          onBack={() => setSelectedEnvironmentId(null)}
          onOpenModel={handleOpenModel}
          onScanModel={handleScanModel}
          refreshing={refreshing}
          onRefresh={refreshAll}
          topInset={insets.top}
          bottomInset={bottomInset}
          onScroll={handleScroll}
        />
      ) : (
        <EnvironmentGallery
          environments={environments}
          models={models}
          onEnvironmentSelect={environment => setSelectedEnvironmentId(environment._id)}
          refreshing={refreshing}
          onRefresh={refreshAll}
          topInset={insets.top}
          bottomInset={bottomInset}
          onScroll={handleScroll}
        />
      )}
     
    </SafeAreaView>
    
     <ARInstructionModal
        visible={instructionVisible}
        onClose={() => setInstructionVisible(false)}
        onStartScan={() => {
          setInstructionVisible(false);
          if (scanningModel) {
            startActualScan(scanningModel);
          }
        }}
      />
    </>
  );
}

export default function ARScreen() {
  return (
    <ScreenErrorBoundary>
      <ARScreenContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    paddingBottom: 0,
  },
  loadingRoot: {
    flex: 1,
    paddingTop: verticalScale(16),
  },
  loadingTitle: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#121826',
  },
  loadingCopy: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(14),
    color: '#6B7280',
  },
  errorRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  errorIconWrap: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(40),
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  errorTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#121826',
    marginBottom: verticalScale(8),
  },
  errorCopy: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
  },
  errorButton: {
    marginTop: verticalScale(24),
    backgroundColor: '#6C4CFF',
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  errorButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#fff',
  },
  worldHeroShadow: {
    borderRadius: moderateScale(20),
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: verticalScale(4) },
          shadowOpacity: 0.2,
          shadowRadius: moderateScale(12),
        }),
  },
  worldHero: {
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    overflow: 'hidden',
  },
  worldHeroIconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  worldHeroTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#fff',
  },
  worldHeroCopy: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
    color: 'rgba(255,255,255,0.9)',
  },
  worldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: verticalScale(14),
    gap: scale(10),
  },
  worldCardWrap: {
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: verticalScale(3) },
          shadowOpacity: 0.15,
          shadowRadius: moderateScale(8),
        }),
  },
  worldCard: {
    flex: 1,
    padding: moderateScale(18),
    justifyContent: 'center',
  },
  worldCountBadge: {
    position: 'absolute',
    top: moderateScale(12),
    right: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  worldCountText: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: '#fff',
  },
  worldEmojiBubble: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: verticalScale(8),
  },
  worldEmoji: {
    fontSize: moderateScale(24),
  },
  worldName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: verticalScale(2),
  },
  worldDescription: {
    fontSize: moderateScale(10),
    lineHeight: moderateScale(14),
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: verticalScale(2),
  },
  modelScreenContent: {
    paddingBottom: 0,
  },
  modelsHeroShadow: {
    borderRadius: moderateScale(20),
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: verticalScale(4) },
          shadowOpacity: 0.2,
          shadowRadius: moderateScale(12),
        }),
  },
  modelsHero: {
    borderRadius: moderateScale(20),
    padding: moderateScale(20),
    overflow: 'hidden',
  },
  modelsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelsHeroLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modelsHeroCopyWrap: {
    flex: 1,
  },
  modelsHeroHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  modelsHeroTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: '#fff',
  },
  modelsHeroSubtitle: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.85)',
  },
  worldsButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  worldsButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#fff',
  },
  modelsContent: {
    paddingTop: verticalScale(16),
  },
  modelsCountText: {
    fontSize: moderateScale(13),
    color: '#6B7280',
    marginBottom: verticalScale(12),
  },
  modelsCountStrong: {
    fontWeight: '700',
    color: '#121826',
  },
  modelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  modelCardWrap: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: verticalScale(3) },
          shadowOpacity: 0.15,
          shadowRadius: moderateScale(8),
        }),
  },
  modelGradient: {
    padding: moderateScale(8),
  },
  modelPreviewShell: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    height: verticalScale(85),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  modelPreviewImage: {
    width: '100%',
    height: '100%',
  },
  modelFallbackEmoji: {
    fontSize: moderateScale(40),
  },
  modelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(6),
  },
  modelName: {
    flex: 1,
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  modelStarsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(10),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modelStarsText: {
    fontSize: moderateScale(10),
    color: '#fff',
  },
  modelActionsRow: {
    flexDirection: 'row',
    gap: scale(6),
  },
  modelActionsColumn: {
    gap: verticalScale(6),
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(6),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(4),
  },
  primaryActionText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#121826',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(10),
    paddingVertical: verticalScale(6),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  secondaryActionText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#fff',
  },
  scanAction: {
    backgroundColor: 'rgba(18,24,38,0.22)',
    borderRadius: moderateScale(10),
    minHeight: verticalScale(32),
    paddingHorizontal: scale(10),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  scanActionText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(60),
  },
  emptyIconBubble: {
    width: scale(80),
    height: scale(80),
    borderRadius: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#121826',
    marginBottom: verticalScale(8),
  },
  emptyCopy: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: verticalScale(20),
  },
  backToWorldsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(14),
    backgroundColor: '#6C4CFF',
  },
  backToWorldsText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#fff',
  },
});
