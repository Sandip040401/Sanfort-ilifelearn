// WebVR main screen – fetches folders from API, Facebook/Blinkit-grade perf
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {RefreshCw} from 'lucide-react-native';
import WebVRIcon from '@/components/icons/WebVRIcon';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import {ScreenErrorBoundary, Skeleton} from '@/components/ui';
import {useQuery} from '@tanstack/react-query';
import {WebVRService} from '@/services/webvr.service';
import {TAB_BAR_HEIGHT} from '@/navigation/CustomTabBar';
import {useTabBarScroll} from '@/navigation/TabBarScrollContext';
import {useModals} from '@/store';
import Animated, {FadeIn, FadeInUp, LinearTransition, ZoomIn} from 'react-native-reanimated';
import type {WebVRStackParamList} from '@/types';

type Nav = StackNavigationProp<WebVRStackParamList, 'WebVRHome'>;

// ── Stable constants (computed once at module load) ────────────────────
const H_PAD = scale(16);
const GAP = scale(10);
const CARD_HEIGHT = verticalScale(150);
const CARD_MARGIN_BOTTOM = verticalScale(12);
const CARD_BORDER_RADIUS = moderateScale(20);

// ── Responsive layout hook ─────────────────────────────────────────────
function useWebVRLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  // Use the SHORT side to detect tablet — a phone in landscape has width>768
  // but its short side is always ~360-430px. Tablets always have short side ≥600.
  const shortSide = Math.min(width, height);
  const isTablet = shortSide >= 600;
  const isLargeTablet = shortSide >= 900;
  const availableWidth = width - H_PAD * 2;
  const gap = GAP;
  // Phone landscape: 4 cols if card ≥130 px wide, otherwise 3
  const numColumns = isTablet
    ? (isLargeTablet ? 3 : 2)
    : isLandscape
      ? ((availableWidth - gap * 3) / 4 >= 130 ? 4 : 3)
      : 2;
  const cardWidth = (availableWidth - gap * (numColumns - 1)) / numColumns;
  return { numColumns, cardWidth, gap };
}

// Pre-computed gradient start/end to avoid re-creation
const GRADIENT_START = {x: 0, y: 0} as const;
const GRADIENT_END = {x: 1, y: 1} as const;
const HEADER_GRADIENT = ['#3D2799', '#5439CC', '#6C4CFF'] as const;
const HEADER_LOCATIONS = [0, 0.5, 1] as const;
const isAndroid = Platform.OS === 'android';
const androidCardBorder = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(17,24,39,0.08)',
} as const;
const headerIconEntering = isAndroid ? FadeIn.duration(180) : ZoomIn.duration(600).springify();
const headerCopyEntering = isAndroid ? FadeIn.duration(180) : FadeInUp.duration(600).springify();
const getFolderCardEntering = (index: number) =>
  isAndroid
    ? FadeIn.delay(index * 50).duration(180)
    : ZoomIn.delay(index * 80).duration(600).springify();
const folderCardLayout = isAndroid ? undefined : LinearTransition.springify();

// ── Predefined environment metadata ────────────────────────────────────
const ENVIRONMENTS: ReadonlyArray<{
  name: string;
  gradient: readonly [string, string];
  description: string;
  image: any;
}> = [
  {name: 'Phonics Fun',         gradient: ['#FF6B6B', '#FF8E8E'], description: 'Learn sounds and letters with playful words', image: require('@/assets/images/environments/webvr/phonics.webp')},
  {name: 'Numbers',             gradient: ['#4ECDC4', '#6CD9D6'], description: 'Count and play with numbers',                 image: require('@/assets/images/environments/webvr/numbers.webp')},
  {name: 'My Body',             gradient: ['#E8A2AF', '#F0B8C7'], description: 'Discover your amazing body parts',          image: require('@/assets/images/environments/webvr/my-body.webp')},
  {name: 'Underwater World',    gradient: ['#3A8DFF', '#45B7D1'], description: 'Dive into the ocean depths',                image: require('@/assets/images/environments/webvr/underwater.webp')},
  {name: 'Fruits & Vegetables', gradient: ['#F97316', '#FBBF24'], description: 'Healthy and colorful treats',               image: require('@/assets/images/environments/webvr/fruits-vegetables.webp')},
  {name: 'Wild Animals',        gradient: ['#84CC16', '#BEF264'], description: 'Meet amazing creatures of the wild',        image: require('@/assets/images/environments/webvr/wild-animals.webp')},
  {name: 'Amphibians',          gradient: ['#10B981', '#6EE7B7'], description: 'Learn about frogs, toads, and more',        image: require('@/assets/images/environments/webvr/amphibians.webp')},
  {name: 'Farm Animals',        gradient: ['#F59E0B', '#FCD34D'], description: 'Discover life on the farm',                 image: require('@/assets/images/environments/webvr/farm-animals.webp')},
  {name: 'Transportation',      gradient: ['#6366F1', '#A5B4FC'], description: 'Cars, planes, and everything that moves!',  image: require('@/assets/images/environments/webvr/transportation.webp')},
  {name: 'Space Adventure',     gradient: ['#4F46E5', '#818CF8'], description: 'Planets, stars, and astronauts',            image: require('@/assets/images/environments/webvr/space.webp')},
  {name: 'Extinct Animals',     gradient: ['#94A3B8', '#CBD5E1'], description: 'Discover animals from the past',            image: require('@/assets/images/environments/webvr/extinct-animals.webp')},
];

// Pre-built lookup maps (O(1) instead of O(n) per item)
const ENV_MAP = new Map(ENVIRONMENTS.map(e => [e.name, e]));
const RANK = new Map(ENVIRONMENTS.map((e, i) => [e.name, i]));

const normalizeName = (raw: string): string => {
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
};

const DEFAULT_GRADIENT: [string, string] = ['#9CA3AF', '#D1D5DB'];

interface FolderItem {
  _id: string;
  folderName: string;
  name: string;
  description: string;
  gradient: [string, string];
  image?: any;
  assetCount?: number;
  accent: string;
  accentSoft: string;
}

// ── Stable key extractor ───────────────────────────────────────────────
const keyExtractor = (item: FolderItem) => item._id;

const FolderCard = React.memo(function FolderCard({
  item,
  index,
  onPress,
  cardWidth,
}: {
  item: FolderItem;
  index: number;
  onPress: (item: FolderItem) => void;
  cardWidth: number;
}) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const colors = useMemo(() => [item.gradient[0], item.gradient[1]], [item.gradient]);

  return (
    <Animated.View
      entering={getFolderCardEntering(index)}
      layout={folderCardLayout}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, { width: cardWidth }]}
        onPress={handlePress}>
        <View style={styles.cardContainer}>
            <FastImage
              source={item.image}
              style={styles.cardImage}
              resizeMode={FastImage.resizeMode.cover}
            />
          <View style={styles.cardContent}>
            <LinearGradient
              colors={colors}
              locations={[0, 1]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <View style={[styles.worldCountBadge, {borderColor: item.accent + '33'}]}>
            <WebVRIcon width={moderateScale(16)} height={moderateScale(16)} color={item.accent} />
            <Text style={[styles.worldCountText, { color: item.accent }]}>{item.assetCount ?? 0}</Text>
          </View>
          <View style={styles.cardDecor1} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Skeleton loader (memoized) ─────────────────────────────────────────
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5] as const;

const FolderSkeleton = React.memo(function FolderSkeleton({
  numColumns,
  cardWidth,
}: {
  numColumns: number;
  cardWidth: number;
}) {
  return (
    <View style={styles.skeletonGrid}>
      {SKELETON_ROWS.map(row => (
        <View key={row} style={[styles.skeletonRow, { gap: GAP }]}>
          {Array.from({ length: numColumns }).map((_, col) => (
            <Skeleton
              key={col}
              width={cardWidth}
              height={CARD_HEIGHT}
              borderRadius={CARD_BORDER_RADIUS}
            />
          ))}
        </View>
      ))}
    </View>
  );
});

// ── Data parsing (pure function, no React deps) ────────────────────────
function parseFolders(response: any): FolderItem[] {
  const raw: any[] = Array.isArray(response?.data?.data)
    ? response.data.data
    : Array.isArray(response?.data)
      ? response.data
      : [];

  const seen = new Set<string>();
  const result: FolderItem[] = [];

  for (let i = 0; i < raw.length; i++) {
    const folderList = raw[i]?.folders;
    if (!Array.isArray(folderList)) continue;

    for (let j = 0; j < folderList.length; j++) {
      const f = folderList[j];
      const fId = f?.webvrFolderId?._id;
      const fName = f?.webvrFolderId?.folderName ?? f?.webvrFolderName;
      if (!fId || !fName) continue;
      const lower = fName.toLowerCase();
      if (lower.includes('test') || lower.includes('stories')) continue;
      if (seen.has(fId)) continue;
      seen.add(fId);

      const canonical = normalizeName(fName);
      const match = ENV_MAP.get(canonical);
      result.push({
        _id: fId,
        folderName: fName,
        name: match?.name ?? fName,
        description: match?.description ?? 'Tap to explore',
        gradient: (match?.gradient ? [match.gradient[0], match.gradient[1]] : DEFAULT_GRADIENT) as [string, string],
        image: match?.image,
        assetCount: f?.webvrFolderId?.topics?.length ?? f?.webvrFolderId?.assetCount ?? 0,
        accent: match?.gradient ? match.gradient[0] : DEFAULT_GRADIENT[0],
        accentSoft: (match?.gradient ? match.gradient[0] : DEFAULT_GRADIENT[0]) + '22',
      });
    }
  }

  // Sort by predefined order
  result.sort((a, b) => (RANK.get(a.name) ?? 999) - (RANK.get(b.name) ?? 999));
  return result;
}

// ── Main content ───────────────────────────────────────────────────────
function WebVRContent() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const {tabBarTranslateY} = useTabBarScroll();
  const {showARWarning} = useModals();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Only trigger once when this component/screen instance mounts
    if (!hasTriggeredRef.current) {
       showARWarning();
       hasTriggeredRef.current = true;
    }
  }, [showARWarning]);


  const lastScrollY = useRef(0);
  const isTabBarHiddenRef = useRef(false);
  // Use short side for tablet detection — phones in landscape have width>768 but short side ~390px
  const isTabletDynamic = Math.min(screenWidth, screenHeight) >= 600;
  const contentWidth = isTabletDynamic ? Math.min(screenWidth * 0.85, 720) : undefined;

  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  const [manualRefresh, setManualRefresh] = useState(false);

  const foldersQuery = useQuery({
    queryKey: ['webvr-folders'],
    queryFn: async () => {
      const response = await WebVRService.getFolders();
      return parseFolders(response);
    },
    staleTime: 0,
    refetchInterval: 30000,
  });

  const folders = useMemo(() => foldersQuery.data || [], [foldersQuery.data]);
  const loading = foldersQuery.isPending;
  const error = foldersQuery.isError;
  const refreshing = manualRefresh;

  const handleRefresh = useCallback(async () => {
    setManualRefresh(true);
    await foldersQuery.refetch();
    setManualRefresh(false);
  }, [foldersQuery]);
  const handleRetry = useCallback(() => foldersQuery.refetch(), [foldersQuery]);

  // Stable callbacks
  const handleFolderPress = useCallback(
    (item: FolderItem) => {
      navigation.navigate('WebVRFolder', {
        folderId: item._id,
        folderName: item.name,
        gradientColors: item.gradient,
      });
    },
    [navigation],
  );


  const { numColumns, cardWidth } = useWebVRLayout();

  // Stable renderItem
  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<FolderItem>) => (
      <FolderCard item={item} index={index} onPress={handleFolderPress} cardWidth={cardWidth} />
    ),
    [handleFolderPress, cardWidth],
  );

  const bottomContentInset = useMemo(
    () => tabBarHeight + verticalScale(24),
    [tabBarHeight],
  );

  const contentStyle = useMemo(
    () => ({paddingBottom: bottomContentInset}),
    [bottomContentInset],
  );

  const contentMaxWidthStyle = useMemo(
    () => (contentWidth ? {width: contentWidth, alignSelf: 'center' as const, paddingHorizontal: 0} : undefined),
    [contentWidth],
  );

  // Memoized header
  const headerPaddingTop = useMemo(
    () => ({paddingTop: insets.top + verticalScale(16)}),
    [insets.top],
  );

  const containerStyle = useMemo(
    () => (contentWidth ? {width: contentWidth, alignSelf: 'center' as const} : undefined),
    [contentWidth],
  );

  const handleScroll = useCallback(
    (e: any) => {
      const y = e.nativeEvent.contentOffset.y;
      const diff = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 0) {
        if (isTabBarHiddenRef.current) {
          isTabBarHiddenRef.current = false;
          tabBarTranslateY.value = 0;
        }
        return;
      }
      if (diff > 0 && !isTabBarHiddenRef.current) {
        isTabBarHiddenRef.current = true;
        tabBarTranslateY.value = tabBarHeight;
      } else if (diff < -2 && isTabBarHiddenRef.current) {
        isTabBarHiddenRef.current = false;
        tabBarTranslateY.value = 0;
      }
    },
    [tabBarTranslateY, tabBarHeight],
  );

  useEffect(() => {
    return () => {
      tabBarTranslateY.value = 0;
    };
  }, [tabBarTranslateY]);

  const ListHeader = useMemo(
    () => (
      <>
        <View style={[styles.header, headerPaddingTop]}>
          <LinearGradient
            colors={HEADER_GRADIENT as unknown as string[]}
            locations={HEADER_LOCATIONS as unknown as number[]}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            entering={headerIconEntering}
            style={styles.bannerIconWrap}>
              <WebVRIcon width={moderateScale(46)} height={moderateScale(46)} color="#fff" />
            </Animated.View>
          <Animated.View
            entering={headerCopyEntering}
            style={containerStyle}>
            <Text style={styles.headerTitle}>WebVR</Text>
            <Text style={styles.headerSub}>
              Immersive virtual reality experiences
            </Text>
          </Animated.View>
          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View
          style={[
            styles.content,
            contentMaxWidthStyle,
          ]}>


          <View style={styles.sectionRow}>
            <Text style={[styles.section, {color: colors.text}]}>
              Environments
            </Text>
            {!loading && (
              <Text style={[styles.sectionCount, {color: colors.textSecondary}]}>
                {folders.length} available
              </Text>
            )}
          </View>
        </View>
      </>
    ),
    [
      colors.background,
      colors.text,
      colors.textSecondary,
      headerPaddingTop,
      loading,
      folders.length,
      contentMaxWidthStyle,
      containerStyle,
    ],
  );

  // Memoized empty component
  const EmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View
          style={[
            styles.content,
            contentMaxWidthStyle,
          ]}>
          <FolderSkeleton numColumns={numColumns} cardWidth={cardWidth} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>
            Failed to load environments
          </Text>
          <Text style={[styles.emptyDesc, {color: colors.textSecondary}]}>
            Check your internet connection
          </Text>
          <TouchableOpacity
            onPress={handleRetry}
            style={styles.retryBtn}
            activeOpacity={0.8}>
            <RefreshCw size={14} color="#fff" strokeWidth={2.5} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🌍</Text>
        <Text style={[styles.emptyTitle, {color: colors.text}]}>
          No environments found
        </Text>
        <Text style={[styles.emptyDesc, {color: colors.textSecondary}]}>
          Pull down to refresh
        </Text>
      </View>
    );
  }, [loading, error, colors.text, colors.textSecondary, handleRetry, contentMaxWidthStyle, numColumns, cardWidth]);

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <FlatList
        key={numColumns}
        data={folders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={contentStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyComponent}
        // ── FlatList tuning ──
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

export default function WebVRScreen() {
  return (
    <ScreenErrorBoundary>
      <WebVRContent />
    </ScreenErrorBoundary>
  );
}

// ── Styles (static, created once) ──────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1},

  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(30),
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  headerTitle: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(4),
  },
  headerSub: {
    fontSize: moderateScale(13),
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

  content: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(2),
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_BORDER_RADIUS,
    padding: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    marginBottom: verticalScale(14),
    overflow: 'hidden',
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#6C4CFF',
          shadowOffset: {width: 0, height: verticalScale(4)},
          shadowOpacity: 0.2,
          shadowRadius: moderateScale(8),
        }),
  },
  bannerIconWrap: {
    width: scale(64),
    height: scale(64),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: scale(14),
  },
  bannerTextContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(1),
  },
  bannerDesc: {
    fontSize: moderateScale(10.5),
    color: 'rgba(255,255,255,0.85)',
    lineHeight: moderateScale(14),
  },
  bannerDecor1: {
    position: 'absolute',
    top: verticalScale(-30),
    right: scale(-30),
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerDecor2: {
    position: 'absolute',
    bottom: verticalScale(-20),
    left: scale(-20),
    width: scale(70),
    height: scale(70),
    borderRadius: scale(35),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
    marginTop: verticalScale(4),
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
  card: {
    // width is now set dynamically via inline style (cardWidth from useWebVRLayout)
    marginBottom: CARD_MARGIN_BOTTOM,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    ...(isAndroid
      ? androidCardBorder
      : {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: verticalScale(4)},
          shadowOpacity: 0.12,
          shadowRadius: moderateScale(8),
        }),
  },
  cardContainer: {
    height: CARD_HEIGHT,
    justifyContent: 'flex-end',
    // padding: moderateScale(20),
    // paddingBottom: moderateScale(24),
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    transform: [{translateY: -12}],
  },
  cardContent: {
    zIndex: 2,
    padding: moderateScale(12),
    paddingVertical: moderateScale(8),
    paddingBottom: moderateScale(14),
  },
  cardName: {
    fontSize: moderateScale(14),
    fontWeight: '900',
    color: '#fff',
    marginBottom: verticalScale(1),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  cardDesc: {
    fontSize: moderateScale(9),
    color: 'rgba(255,255,255,0.95)',
    lineHeight: moderateScale(13),
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: {width: 0, height: 1},
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
  worldCountBadge: {
    position: 'absolute',
    top: moderateScale(6),
    right: moderateScale(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  worldCountText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    lineHeight: moderateScale(16),
  },

  skeletonGrid: {
    gap: verticalScale(12),
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: GAP,
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(32),
  },
  emptyIcon: {
    fontSize: moderateScale(48),
    marginBottom: verticalScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  emptyDesc: {
    fontSize: moderateScale(13),
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginTop: verticalScale(16),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(10),
    backgroundColor: '#6C4CFF',
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: moderateScale(13),
  },
});
