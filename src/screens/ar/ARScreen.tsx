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
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  FlatList,
  Dimensions,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation, useFocusEffect } from '@react-navigation/native';
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
  Search,
  Scan,
  X,
} from 'lucide-react-native';
import { ScreenErrorBoundary, Skeleton } from '@/components/ui';
import ARInstructionModal from '@/components/ARInstructionModal';
import { useScreenReady } from '@/hooks/useScreenReady';
import { ARService } from '@/services';
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
import {
  normalizeReferenceSource,
  normalizeReferenceForDisplay,
  getReferenceImageSource,
} from './ar.reference';
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
  const modelPreviewHeight = isTablet ? Math.min(cardWidth * 0.55, 170) : verticalScale(67);
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

const { width: SCREEN_W } = Dimensions.get('window');
const headerIconEntering = isAndroid ? FadeIn.duration(180) : ZoomIn.duration(600).springify();
const headerCopyEntering = isAndroid ? FadeIn.duration(180) : FadeInUp.duration(600).springify();

// -- Premium Design Constants (WebVR Style) --
const ENVIRONMENTS: ReadonlyArray<{
  name: string;
  gradient: readonly [string, string];
  description: string;
  image: any;
}> = [
  { name: 'Phonics Fun', gradient: ['#FF6B6B', '#FF8E8E'], description: 'Learn sounds and letters with playful words', image: require('@/assets/images/environments/ar/phonics.webp') },
  { name: 'Numbers', gradient: ['#4ECDC4', '#6CD9D6'], description: 'Count and play with numbers', image: require('@/assets/images/environments/ar/numbers.webp') },
  { name: 'My Body', gradient: ['#E8A2AF', '#F0B8C7'], description: 'Discover your amazing body parts', image: require('@/assets/images/environments/ar/my-body.webp') },
  { name: 'Underwater World', gradient: ['#3A8DFF', '#45B7D1'], description: 'Dive into the ocean depths', image: require('@/assets/images/environments/ar/underwater.webp') },
  { name: 'Fruits & Vegetables', gradient: ['#F97316', '#FBBF24'], description: 'Healthy and colorful treats', image: require('@/assets/images/environments/ar/fruits-vegetables.webp') },
  { name: 'Wild Animals', gradient: ['#84CC16', '#BEF264'], description: 'Meet amazing creatures of the wild', image: require('@/assets/images/environments/ar/wild-animals.webp') },
  { name: 'Amphibians', gradient: ['#10B981', '#6EE7B7'], description: 'Learn about frogs, toads, and more', image: require('@/assets/images/environments/ar/amphibians.webp') },
  { name: 'Farm Animals', gradient: ['#F59E0B', '#FCD34D'], description: 'Discover life on the farm', image: require('@/assets/images/environments/ar/farm-animals.webp') },
  { name: 'Transportation', gradient: ['#6366F1', '#A5B4FC'], description: 'Cars, planes, and everything that moves!', image: require('@/assets/images/environments/ar/transportation.webp') },
  { name: 'Space Adventure', gradient: ['#4F46E5', '#818CF8'], description: 'Planets, stars, and astronauts', image: require('@/assets/images/environments/ar/space.webp') },
  { name: 'Extinct Animals', gradient: ['#94A3B8', '#CBD5E1'], description: 'Discover animals from the past', image: require('@/assets/images/environments/ar/extinct-animals.webp') },
];

const ENV_MAP = new Map(ENVIRONMENTS.map(e => [e.name, e]));

function normalizeWorldName(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  if (s.includes('phonics')) return 'Phonics Fun';
  if (s.includes('number')) return 'Numbers';
  if (s.includes('body')) return 'My Body';
  if (s.includes('underwater')) return 'Underwater World';
  if (s.includes('fruit') || s.includes('vegetable')) return 'Fruits & Vegetables';
  if (s.includes('wild')) return 'Wild Animals';
  if (s.includes('amphibian')) return 'Amphibians';
  if (s.includes('farm')) return 'Farm Animals';
  if (s.includes('transport')) return 'Transportation';
  if (s.includes('space')) return 'Space Adventure';
  if (s.includes('extinct')) return 'Extinct Animals';
  return raw;
}
const H_PAD = scale(16);
const GAP = scale(12);
const CARD_MARGIN_BOTTOM = verticalScale(12);
const CARD_BORDER_RADIUS = moderateScale(20);
const GRADIENT_START = { x: 0, y: 0 } as const;
const GRADIENT_END = { x: 1, y: 0 } as const;

const HEADER_RAINBOW_COLORS = ['#FF6B6B', '#FF8557', '#FF9F43', '#87A274', '#3DAA8E', '#0EA5A4'] as const;
const HEADER_MODELS_COLORS = ['#DA70D6', '#A35EEA', '#6C4CFF', '#5B6EEC', '#4A90D9'] as const;

function getPreviewUri(model: ARModel) {
  const modelId = model._id || model.id || (model as any).id;

  // 1. Prioritize Thumbnail route from API
  if (modelId) {
    return ARService.getThumbnailImageUrl(String(modelId));
  }

  // 2. Fallbacks to model data properties
  const thumbnail = (model as any).thumbnail || (model as any).thumbnail_url || (model as any).preview_image;
  if (thumbnail) {
    const raw = String(thumbnail);
    if (raw.startsWith('http')) return raw;
    return normalizeReferenceSource(raw);
  }

  if (model.previewUrl) return model.previewUrl;

  if (model.previewImage) {
    const raw = String(model.previewImage);
    if (raw.startsWith('http')) return raw;
    return normalizeReferenceSource(raw);
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
  onScroll: (e: any) => void;
}) {
  const { colors } = useTheme();
  const { isTablet, isCompactCard } = useResponsiveLayout();
  const emojiSize = isCompactCard ? scale(42) : scale(48);
  const emojiRadius = isCompactCard ? moderateScale(14) : moderateScale(16);

  const headerPaddingTop = useMemo(
    () => ({ paddingTop: topInset + verticalScale(16) }),
    [topInset]
  );

  const ListHeader = useMemo(() => (
    <>
      <View style={[styles.headerMain, headerPaddingTop]}>
        <LinearGradient
          colors={HEADER_RAINBOW_COLORS as unknown as string[]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={headerIconEntering}
          style={styles.bannerIconWrap}>
          <Box size={moderateScale(24)} color="#fff" strokeWidth={1.8} />
        </Animated.View>
        <Animated.View entering={headerCopyEntering} style={{ flex: 1 }}>
          <Text style={styles.headerTitleMain}>AR Worlds</Text>
          <Text style={styles.headerSubMain}>
            Explore 3D models in augmented reality!
          </Text>
        </Animated.View>
        <View style={[styles.curve, { backgroundColor: colors.background }]} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.text }]}>Environments</Text>
        <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>
          {environments.length} available
        </Text>
      </View>
    </>
  ), [colors.background, colors.text, colors.textSecondary, environments.length, headerPaddingTop]);

  const renderItem = useCallback(({ item, index }: { item: AREnvironmentView, index: number }) => {
    const modelCount = getModelsForEnvironment(item, models).length;
    const worldName = item.name || item.folderName;
    const normalizedName = normalizeWorldName(worldName);
    const envMatch = ENV_MAP.get(normalizedName);
    const cardColors = getEnvironmentColors(item);

    return (
      <Animated.View
        entering={getGalleryCardEntering(index)}
        layout={galleryLayoutTransition}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onEnvironmentSelect(item)}
          style={[styles.worldCardWrap, { width: (SCREEN_W - H_PAD * 2 - GAP) / 2 }]}>
          <View style={styles.worldCard}>
            {envMatch?.image && (
              <Image
                source={envMatch.image}
                style={styles.worldCardImage}
                resizeMode="cover"
              />
            )}

            <View style={styles.worldCardContent}>
              <LinearGradient
                colors={cardColors}
                locations={cardColors.length === 2 ? [0, 1] : [0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text
                style={styles.worldName}
                numberOfLines={1}>
                {worldName}
              </Text>

              <Text
                style={styles.worldDescription}
                numberOfLines={1}>
                {item.description || `Explore ${modelCount} models`}
              </Text>
            </View>

            <View style={[styles.worldCountBadge, { backgroundColor: item.accentSoft, borderColor: item.accent + '33' }]}>
              <Box size={moderateScale(12)} color={item.accent} strokeWidth={2} />
              <Text style={[styles.worldCountText, { color: item.accent }]}>{modelCount}</Text>
            </View>
            <View style={styles.cardDecor1} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [models, onEnvironmentSelect]);

  return (
    <FlatList
      data={environments}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }
    />
  );
}

function ModelPreviewImage({
  thumbnailUri,
  previewUri,
  fallbackIcon,
  style,
  resizeMode = 'contain'
}: { 
  thumbnailUri?: string | null; 
  previewUri?: string | null; 
  fallbackIcon: string;
  style: any;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}) {
  const [currentUri, setCurrentUri] = useState<string | null>(thumbnailUri || null);
  const [failedThumbnail, setFailedThumbnail] = useState(false);

  const handleError = () => {
    if (!failedThumbnail && previewUri && previewUri !== thumbnailUri) {
      setCurrentUri(previewUri);
      setFailedThumbnail(true);
    } else {
      setCurrentUri(null);
    }
  };

  if (!currentUri) {
    return <Text style={styles.modelFallbackEmoji}>{fallbackIcon}</Text>;
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

function ModelGallery({
  environment,
  models,
  onBack,
  onOpenModel,
  onScanModel,
  refreshing,
  onRefresh,
  searchQuery,
  onSearchChange,
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
  searchQuery: string;
  onSearchChange: (text: string) => void;
  topInset: number;
  bottomInset: number;
  onScroll: (e: any) => void;
}) {
  const { colors, isDark } = useTheme();
  const gradientColors = getEnvironmentColors(environment);
  const { modelPreviewHeight } = useResponsiveLayout();

  const headerPaddingTop = useMemo(
    () => ({ paddingTop: topInset + verticalScale(10) }),
    [topInset]
  );

  const ListHeader = useMemo(() => (
    <>
      <View style={[styles.headerGallery, headerPaddingTop]}>
        <LinearGradient
          colors={HEADER_MODELS_COLORS as unknown as string[]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          onPress={onBack}
          style={styles.bannerIconWrap}
          activeOpacity={0.7}>
          <ChevronLeft size={moderateScale(24)} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitleMain} numberOfLines={1}>
            {(environment.name || environment.folderName)}
          </Text>
          <Text style={styles.headerSubMain}>
            {models.length} models
          </Text>
        </View>

        <View style={[styles.curve, { backgroundColor: colors.background }]} />
      </View>

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
        <>
          <View style={[styles.searchContainer, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
          }]}>
            <Search size={moderateScale(18)} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search models..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange('')}>
                <X size={moderateScale(18)} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modelsGridHeader}>
            <Text style={[styles.modelsCountText, { color: colors.textSecondary }]}>
              <Text style={[styles.modelsCountStrong, { color: colors.text }]}>{models.length}</Text> models available
            </Text>
          </View>
        </>
      )}
    </>
  ), [colors.background, colors.card, colors.text, colors.textSecondary, colors.textTertiary, environment, models.length, headerPaddingTop, onBack, searchQuery, onSearchChange]);

  const renderItem = useCallback(({ item, index }: { item: ARModel, index: number }) => {
    const modelId = item._id || item.id || (item as any).id;
    const thumbnailUri = getPreviewUri(item); // Returns the /thumbnail endpoint
    const previewUri = modelId ? ARService.getPreviewImageUrl(String(modelId)) : null;

    const referenceSource = getReferenceImageSource(item);
    const referenceUri = referenceSource ? normalizeReferenceForDisplay(referenceSource) : null;

    const level = getModelLevel(item);
    const stars = getLevelStars(level);

    return (
      <Animated.View
        entering={getGalleryCardEntering(index)}
        layout={galleryLayoutTransition}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onOpenModel(item)}
          style={[styles.modelCardWrap, { width: (SCREEN_W - H_PAD * 2 - GAP) / 2, backgroundColor: colors.card }]}>
          <View style={styles.modelGradient}>
            <LinearGradient
              colors={gradientColors}
              locations={gradientColors.length === 2 ? [0, 1] : [0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.modelPreviewShell, { height: modelPreviewHeight }]}>
              <ModelPreviewImage
                thumbnailUri={thumbnailUri}
                previewUri={previewUri || referenceUri}
                fallbackIcon={item.icon || environment.emoji || '🎨'}
                style={styles.modelPreviewImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.modelInfoRow}>
              <Text style={styles.modelName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.modelStarsBadge}>
                <Text style={styles.modelStarsText}>{stars}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colors.card, environment.emoji, gradientColors, modelPreviewHeight, onOpenModel, onScanModel]);

  return (
    <FlatList
      data={models}
      keyExtractor={(item, index) => getModelStableId(item, index)}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeader}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6C4CFF"
          colors={['#6C4CFF', '#DA70D6']}
          progressViewOffset={topInset + verticalScale(8)}
        />
      }
    />
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
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [selectedModelForOptions, setSelectedModelForOptions] = useState<ARModel | null>(null);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['62%'], []);

  // Force-close sheet helper — dismiss + forceClose + clear state
  const closeSheet = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    bottomSheetModalRef.current?.forceClose();
    setSelectedModelForOptions(null);
  }, []);

  // Auto-dismiss sheet when navigating away from this screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        bottomSheetModalRef.current?.dismiss();
        bottomSheetModalRef.current?.forceClose();
        setSelectedModelForOptions(null);
      };
    }, []),
  );

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

  const filteredModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return environmentModels;
    const q = modelSearchQuery.toLowerCase().trim();
    return environmentModels.filter(m => m.name?.toLowerCase().includes(q));
  }, [environmentModels, modelSearchQuery]);

  useEffect(() => {
    setModelSearchQuery('');
  }, [selectedEnvironmentId]);

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
    closeSheet();
    navigation.navigate('ARViewer', {
      modelId: getModelStableId(model),
      environmentId: selectedEnvironment?._id,
      openPainter: opts?.openPainter,
      initialPaintMode: opts?.initialPaintMode === 'target' ? 'target' : 'model',
    });
  };

  const openModelOptions = useCallback((model: ARModel) => {
    setSelectedModelForOptions(model);
    // Use requestAnimationFrame to ensure the state update is processed
    // before presenting the modal for a smoother transition
    requestAnimationFrame(() => {
      bottomSheetModalRef.current?.present();
    });
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        enableTouchThrough={false}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    []
  );

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
    } finally {
      closeSheet();
    }
  };

  const handleScanModel = (model: ARModel) => {
    closeSheet();
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
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? 'light-content' : 'dark-content'} />
      {selectedEnvironment ? (
        <ModelGallery
          environment={selectedEnvironment}
          models={filteredModels}
          onBack={() => setSelectedEnvironmentId(null)}
          onOpenModel={openModelOptions}
          onScanModel={handleScanModel}
          refreshing={refreshing}
          onRefresh={refreshAll}
          searchQuery={modelSearchQuery}
          onSearchChange={setModelSearchQuery}
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

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#C4C4C4', width: scale(48), height: verticalScale(5), borderRadius: moderateScale(3) }}
        backgroundStyle={{
          backgroundColor: colors.card,
          borderTopLeftRadius: moderateScale(28),
          borderTopRightRadius: moderateScale(28),
        }}>
        <BottomSheetView style={styles.sheetContent}>
          {selectedModelForOptions && (
            <ARModelOptionsSheet
              model={selectedModelForOptions}
              onView3D={() => handleOpenModel(selectedModelForOptions)}
              onViewSheet={() => handleOpenModel(selectedModelForOptions, { openPainter: true, initialPaintMode: 'target' })}
              onScan={() => handleScanModel(selectedModelForOptions)}
            />
          )}
        </BottomSheetView>
      </BottomSheetModal>

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
    </View>
  );
}

function ARModelOptionsSheet({
  model,
  onView3D,
  onViewSheet,
  onScan,
}: {
  model: ARModel;
  onView3D: () => void;
  onViewSheet: () => void;
  onScan: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.sheetInner}>
      <Text style={[styles.sheetTitle, { color: colors.text }]}>{model.name}</Text>
      <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
        Choose how to explore this model
      </Text>

      <View style={styles.sheetActions}>
        <TouchableOpacity activeOpacity={0.85} onPress={onView3D} style={styles.sheetButtonWrap}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetButtonGradient}
          />
          <View style={styles.sheetButtonTexts}>
            <Text style={styles.sheetButtonTitle}>3D View</Text>
            <Text style={styles.sheetButtonSub}>Spin & explore the 3D model</Text>
          </View>
          <View style={styles.sheetButtonArrow}>
            <Text style={styles.sheetButtonArrowText}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} onPress={onViewSheet} style={styles.sheetButtonWrap}>
          <LinearGradient
            colors={['#f093fb', '#f5576c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetButtonGradient}
          />
          <View style={styles.sheetButtonTexts}>
            <Text style={styles.sheetButtonTitle}>Coloring Sheet</Text>
            <Text style={styles.sheetButtonSub}>Color the page with crayons</Text>
          </View>
          <View style={styles.sheetButtonArrow}>
            <Text style={styles.sheetButtonArrowText}>›</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} onPress={onScan} style={styles.sheetButtonWrap}>
          <LinearGradient
            colors={['#11998e', '#38ef7d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sheetButtonGradient}
          />
          <View style={styles.sheetButtonTexts}>
            <Text style={styles.sheetButtonTitle}>AR Scan</Text>
            <Text style={styles.sheetButtonSub}>Bring your coloring to life!</Text>
          </View>
          <View style={styles.sheetButtonArrow}>
            <Text style={styles.sheetButtonArrowText}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
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
  headerMain: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(30),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    overflow: 'hidden',
  },
  headerGallery: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(30),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    overflow: 'hidden',
  },
  headerTitleMain: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
  },
  headerSubMain: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,1)',
  },
  headerTitleGallery: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
  },
  headerSubGallery: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
  },
  curve: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: verticalScale(10),
    borderTopLeftRadius: moderateScale(16),
    borderTopRightRadius: moderateScale(16),
  },
  bannerIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: scale(4),
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginBottom: verticalScale(10),
    marginTop: verticalScale(14),
  },
  section: {
    fontSize: moderateScale(20),
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: moderateScale(12),
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: GAP,
    paddingHorizontal: H_PAD,
  },
  backBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerInfo: { flex: 1 },
  worldsButtonInHeader: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modelsGridHeader: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(14),
  },
  worldCardWrap: {
    marginBottom: CARD_MARGIN_BOTTOM,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: verticalScale(4) },
          shadowOpacity: 0.15,
          shadowRadius: moderateScale(8),
        }),
  },
  worldCard: {
    height: verticalScale(150),
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  worldCardImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transform: [{ translateY: -11 }],
  },
  worldCardContent: {
    zIndex: 2,
    padding: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingBottom: moderateScale(14),
  },
  worldCountBadge: {
    position: 'absolute',
    top: moderateScale(6),
    right: moderateScale(6),
    borderRadius: moderateScale(20),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderWidth: 1,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  worldCountText: {
    fontSize: moderateScale(10.5),
    fontWeight: '800',
    lineHeight: moderateScale(14),
  },
  worldName: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: '#fff',
    marginBottom: verticalScale(1),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  worldDescription: {
    fontSize: moderateScale(9),
    color: 'rgba(255,255,255,0.95)',
    lineHeight: moderateScale(13),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardDecor1: {
    position: 'absolute',
    top: verticalScale(-30),
    right: scale(-30),
    width: scale(110),
    height: scale(110),
    borderRadius: scale(55),
    backgroundColor: 'rgba(255,255,255,0.12)',
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
  sheetContent: {
    flex: 1,
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(20),
  },
  sheetInner: {
    alignItems: 'center',
    paddingTop: verticalScale(8),
  },
  sheetTitle: {
    fontSize: moderateScale(24),
    fontWeight: '900',
    marginBottom: verticalScale(4),
    letterSpacing: 0.3,
  },
  sheetSub: {
    fontSize: moderateScale(13),
    fontWeight: '500',
    marginBottom: verticalScale(22),
    opacity: 0.65,
  },
  sheetActions: {
    width: '100%',
    gap: verticalScale(12),
  },
  sheetButtonWrap: {
    height: verticalScale(76),
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  sheetButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetButtonTexts: {
    flex: 1,
  },
  sheetButtonTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
    letterSpacing: 0.2,
  },
  sheetButtonSub: {
    fontSize: moderateScale(11.5),
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  sheetButtonArrow: {
    width: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: scale(8),
  },
  sheetButtonArrowText: {
    fontSize: moderateScale(20),
    color: '#fff',
    fontWeight: '700',
    marginTop: -verticalScale(1),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: H_PAD,
    marginTop: verticalScale(16),
    marginBottom: verticalScale(6),
    paddingHorizontal: scale(14),
    height: verticalScale(48),
    borderRadius: moderateScale(24),
    borderWidth: 1,
    gap: scale(10),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(14),
    padding: 0,
    height: '100%',
  },
});
