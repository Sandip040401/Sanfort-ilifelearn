// WebVR main screen – fetches folders from API, Facebook/Blinkit-grade perf
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Globe, RefreshCw} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import {ScreenErrorBoundary, Skeleton} from '@/components/ui';
import {WebVRService} from '@/services/webvr.service';
import type {WebVRStackParamList} from '@/types';

type Nav = StackNavigationProp<WebVRStackParamList, 'WebVRHome'>;

// ── Stable constants (computed once at module load) ────────────────────
const {width: SCREEN_W} = Dimensions.get('window');
const H_PAD = scale(20);
const IS_TABLET = SCREEN_W >= 600;
const CARD_HEIGHT = verticalScale(140);
const CARD_MARGIN_BOTTOM = verticalScale(14);
const ITEM_HEIGHT = CARD_HEIGHT + CARD_MARGIN_BOTTOM;
const CARD_BORDER_RADIUS = moderateScale(20);

// Pre-computed gradient start/end to avoid re-creation
const GRADIENT_START = {x: 0, y: 0} as const;
const GRADIENT_END = {x: 1, y: 1} as const;
const HEADER_GRADIENT = ['#3D2799', '#5439CC', '#6C4CFF'] as const;
const HEADER_LOCATIONS = [0, 0.5, 1] as const;
const BANNER_GRADIENT = ['#4F46E5', '#5D49F2', '#6C4CFF', '#8354FF', '#9B5CFF'] as const;
const BANNER_LOCATIONS = [0, 0.25, 0.5, 0.75, 1] as const;

// ── Predefined environment metadata ────────────────────────────────────
const ENVIRONMENTS: ReadonlyArray<{
  name: string;
  gradient: readonly [string, string];
  description: string;
}> = [
  {name: 'Phonics Fun',         gradient: ['#FF6B6B', '#FF8E8E'], description: 'Learn sounds and letters with playful words'},
  {name: 'Numbers',             gradient: ['#4ECDC4', '#6CD9D6'], description: 'Count and play with numbers'},
  {name: 'My Body',             gradient: ['#E8A2AF', '#F0B8C7'], description: 'Discover your amazing body parts'},
  {name: 'Underwater World',    gradient: ['#45B7D1', '#7DD3E6'], description: 'Dive into the ocean depths'},
  {name: 'Fruits & Vegetables', gradient: ['#45B7D1', '#7DD3E6'], description: 'Healthy and colorful treats'},
  {name: 'Wild Animals',        gradient: ['#FECA57', '#FED76B'], description: 'Meet amazing creatures of the wild'},
  {name: 'Amphibians',          gradient: ['#FF6B6B', '#FF8E8E'], description: 'Learn about frogs, toads, and more'},
  {name: 'Farm Animals',        gradient: ['#4ECDC4', '#6CD9D6'], description: 'Discover life on the farm'},
  {name: 'Transportation',      gradient: ['#E8A2AF', '#F0B8C7'], description: 'Cars, planes, and everything that moves!'},
  {name: 'Space Adventure',     gradient: ['#FECA57', '#FED76B'], description: 'Planets, stars, and astronauts'},
  {name: 'Extinct Animals',     gradient: ['#FF6B6B', '#FF8E8E'], description: 'Discover animals from the past'},
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
}

// ── Stable key extractor ───────────────────────────────────────────────
const keyExtractor = (item: FolderItem) => item._id;

// ── getItemLayout for fixed-height cards (instant scroll) ──────────────
const getItemLayout = (_data: unknown, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

// ── Memoized folder card ───────────────────────────────────────────────
const FolderCard = React.memo(function FolderCard({
  item,
  onPress,
}: {
  item: FolderItem;
  onPress: (item: FolderItem) => void;
}) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const colors = useMemo(() => [item.gradient[0], item.gradient[1]], [item.gradient]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={styles.card}
      onPress={handlePress}>
      <View style={styles.cardGradient}>
        <LinearGradient
          colors={colors}
          locations={[0, 1]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
        <View style={styles.cardDecor1} />
        <View style={styles.cardDecor2} />
      </View>
    </TouchableOpacity>
  );
});

// ── Skeleton loader (memoized) ─────────────────────────────────────────
const SKELETON_DATA = [0, 1, 2, 3, 4] as const;

const FolderSkeleton = React.memo(function FolderSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {SKELETON_DATA.map(i => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton
            width="100%"
            height={CARD_HEIGHT}
            borderRadius={CARD_BORDER_RADIUS}
          />
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

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const fetchFolders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(false);

      const response = await WebVRService.getFolders();
      if (!mountedRef.current) return;
      setFolders(parseFolders(response));
    } catch {
      if (!mountedRef.current) return;
      setError(true);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Deferred fetch after screen transition animation completes
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchFolders();
    });
    return () => task.cancel();
  }, [fetchFolders]);

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

  const handleRefresh = useCallback(() => fetchFolders(true), [fetchFolders]);
  const handleRetry = useCallback(() => fetchFolders(), [fetchFolders]);

  // Stable renderItem
  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<FolderItem>) => (
      <FolderCard item={item} onPress={handleFolderPress} />
    ),
    [handleFolderPress],
  );

  // Memoized content container style
  const contentStyle = useMemo(
    () => ({paddingBottom: insets.bottom + verticalScale(90)}),
    [insets.bottom],
  );

  // Memoized header
  const headerPaddingTop = useMemo(
    () => ({paddingTop: insets.top + verticalScale(16)}),
    [insets.top],
  );

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
          <Text style={styles.headerTitle}>WebVR</Text>
          <Text style={styles.headerSub}>
            Immersive virtual reality experiences
          </Text>
          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View style={styles.content}>
          <View style={styles.banner}>
            <LinearGradient
              colors={BANNER_GRADIENT as unknown as string[]}
              locations={BANNER_LOCATIONS as unknown as number[]}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.bannerIconWrap}>
              <Globe size={36} color="#fff" strokeWidth={1.6} />
            </View>
            <Text style={styles.bannerTitle}>Explore Virtual Worlds</Text>
            <Text style={styles.bannerDesc}>
              Step into immersive 3D environments and discover{'\n'}
              the wonders of science, history and nature
            </Text>
            <View style={styles.bannerDecor1} />
            <View style={styles.bannerDecor2} />
          </View>

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
    [colors.background, colors.text, colors.textSecondary, headerPaddingTop, loading, folders.length],
  );

  // Memoized empty component
  const EmptyComponent = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.content}>
          <FolderSkeleton />
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
  }, [loading, error, colors.text, colors.textSecondary, handleRetry]);

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <FlatList
        data={folders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={EmptyComponent}
        // ── Facebook-grade FlatList tuning ──
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
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
    borderRadius: CARD_BORDER_RADIUS,
    padding: moderateScale(24),
    marginBottom: verticalScale(16),
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#6C4CFF',
        shadowOffset: {width: 0, height: verticalScale(8)},
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(16),
      },
      android: {},
    }),
  },
  bannerIconWrap: {
    width: scale(68),
    height: scale(68),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: verticalScale(12),
  },
  bannerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(6),
    textAlign: 'center',
  },
  bannerDesc: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: moderateScale(18),
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
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: moderateScale(12),
  },

  card: {
    marginBottom: CARD_MARGIN_BOTTOM,
    marginHorizontal: H_PAD,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: verticalScale(6)},
        shadowOpacity: 0.15,
        shadowRadius: moderateScale(12),
      },
      android: {elevation: 6},
    }),
  },
  cardGradient: {
    height: CARD_HEIGHT,
    justifyContent: 'flex-end',
    padding: moderateScale(20),
    overflow: 'hidden',
  },
  cardContent: {},
  cardName: {
    fontSize: moderateScale(18),
    fontWeight: '900',
    color: '#fff',
    marginBottom: verticalScale(4),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  cardDesc: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.92)',
    lineHeight: moderateScale(17),
    fontWeight: '500',
  },
  cardDecor1: {
    position: 'absolute',
    top: verticalScale(-20),
    right: scale(-20),
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardDecor2: {
    position: 'absolute',
    top: verticalScale(10),
    right: scale(30),
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  skeletonWrap: {gap: verticalScale(12)},
  skeletonCard: {marginBottom: verticalScale(2)},

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
