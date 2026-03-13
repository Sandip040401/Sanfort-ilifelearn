// WebVR folder detail – topics/assets, Facebook-grade perf
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
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowLeft, Play, Glasses} from 'lucide-react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {useTheme} from '@/theme';
import {Skeleton} from '@/components/ui';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';
import {WebVRService} from '@/services/webvr.service';
import type {WebVRAsset} from '@/components/WebVRViewerModal';
import type {WebVRStackParamList} from '@/types';

// Lazy import modal – only loaded when user actually taps a topic
const loadWebVRViewerModal = () => import('@/components/WebVRViewerModal');
const LazyWebVRViewerModal = React.lazy(
  loadWebVRViewerModal,
);

type RouteParams = RouteProp<WebVRStackParamList, 'WebVRFolder'>;

// ── Stable constants ───────────────────────────────────────────────────
const GRADIENT_START = {x: 0, y: 0} as const;
const GRADIENT_END = {x: 1, y: 1} as const;
const TOPIC_CARD_HEIGHT = verticalScale(90);
const TOPIC_CARD_MARGIN = verticalScale(12);
const ITEM_HEIGHT = TOPIC_CARD_HEIGHT + TOPIC_CARD_MARGIN;
const PREPARE_BUFFER_CONFIG = {
  minBufferMs: 1200,
  maxBufferMs: 8000,
  bufferForPlaybackMs: 250,
  bufferForPlaybackAfterRebufferMs: 500,
  cacheSizeMB: 160,
} as const;
const LANGUAGE_ORDER = [
  'english (india)', 'english (us)', 'english (uk)',
  'hindi', 'marathi', 'malayalam', 'punjabi',
  'gujarati', 'telugu', 'kannada', 'tamil', 'odia', 'bengali',
] as const;
const DIFFICULTY_ORDER = ['basic', 'intermediate', 'advance', 'advanced'] as const;

const keyExtractor = (item: any) => item._id;
const getItemLayout = (_data: unknown, index: number) => ({
  length: ITEM_HEIGHT,
  offset: ITEM_HEIGHT * index,
  index,
});

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

const pickDefaultAudioUrl = (item: WebVRAsset | null): string => {
  const entries = item?.webvr?.filter(media => media.type === 'audio' && !!media.url) ?? [];
  if (!entries.length) return '';

  const byLanguage: Record<string, Record<string, string>> = {};
  for (const media of entries) {
    const language = norm(media.language ?? media.keyword) || 'default';
    const rawDifficulty = norm(media.difficulty ?? media.level);
    const difficulty = rawDifficulty || 'basic';
    (byLanguage[language] ??= {})[difficulty] = media.url;
  }

  const languages = Object.keys(byLanguage).sort((a, b) => {
    const ai = LANGUAGE_ORDER.indexOf(a as (typeof LANGUAGE_ORDER)[number]);
    const bi = LANGUAGE_ORDER.indexOf(b as (typeof LANGUAGE_ORDER)[number]);
    const safeAi = ai === -1 ? 999 : ai;
    const safeBi = bi === -1 ? 999 : bi;
    return safeAi === safeBi ? a.localeCompare(b) : safeAi - safeBi;
  });
  const selectedLanguage = languages.includes('english (india)') ? 'english (india)' : languages[0];
  const difficulties = Object.keys(byLanguage[selectedLanguage] || {}).sort((a, b) => {
    const ai = DIFFICULTY_ORDER.indexOf(a as (typeof DIFFICULTY_ORDER)[number]);
    const bi = DIFFICULTY_ORDER.indexOf(b as (typeof DIFFICULTY_ORDER)[number]);
    const safeAi = ai === -1 ? 999 : ai;
    const safeBi = bi === -1 ? 999 : bi;
    return safeAi === safeBi ? a.localeCompare(b) : safeAi - safeBi;
  });
  const selectedDifficulty = difficulties.includes('basic') ? 'basic' : difficulties[0];

  return byLanguage[selectedLanguage]?.[selectedDifficulty] || entries[0]?.url || '';
};

const getVideoUrl = (item: WebVRAsset | null): string =>
  item?.webvr?.find(media => media.type === 'video' && !!media.url)?.url || '';

const WebVRAssetWarmup = React.memo(function WebVRAssetWarmup({
  asset,
}: {
  asset: WebVRAsset;
}) {
  const videoUrl = useMemo(() => getVideoUrl(asset), [asset]);
  const audioUrl = useMemo(() => pickDefaultAudioUrl(asset), [asset]);

  return (
    <View pointerEvents="none" style={styles.mediaWarmupHost}>
      {!!videoUrl && (
        <Video
          key={`warm-video-${asset._id ?? asset.title ?? videoUrl}`}
          source={{
            uri: videoUrl,
            shouldCache: true,
            minLoadRetryCount: 2,
            bufferConfig: PREPARE_BUFFER_CONFIG,
          }}
          style={styles.mediaWarmupNode}
          paused={false}
          muted
          repeat={false}
          playInBackground={false}
        />
      )}
      {!!audioUrl && (
        <Video
          key={`warm-audio-${asset._id ?? asset.title ?? audioUrl}`}
          source={{uri: audioUrl, shouldCache: true, minLoadRetryCount: 2}}
          style={styles.mediaWarmupNode}
          paused={false}
          muted
          volume={0}
          repeat={false}
          playInBackground={false}
        />
      )}
    </View>
  );
});

// ── Skeleton shimmer for loading state ─────────────────────────────────
const SKELETON_DATA = [0, 1, 2, 3, 4, 5] as const;

const TopicSkeleton = React.memo(function TopicSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {SKELETON_DATA.map(i => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton
            width={scale(56)}
            height={scale(56)}
            borderRadius={moderateScale(14)}
          />
          <View style={styles.skeletonText}>
            <Skeleton
              width="70%"
              height={verticalScale(14)}
              borderRadius={moderateScale(6)}
            />
            <Skeleton
              width="90%"
              height={verticalScale(10)}
              borderRadius={moderateScale(4)}
              style={styles.skeletonLine2}
            />
            <Skeleton
              width={scale(80)}
              height={verticalScale(18)}
              borderRadius={moderateScale(8)}
              style={styles.skeletonLine3}
            />
          </View>
        </View>
      ))}
    </View>
  );
});

// ── Memoized topic card ────────────────────────────────────────────────
const TopicCard = React.memo(function TopicCard({
  item,
  onPress,
  onPressIn,
  accentColor,
  cardBg,
  textColor,
  textSecondary,
}: {
  item: any;
  onPress: (item: any) => void;
  onPressIn: (item: any) => void;
  accentColor: string;
  cardBg: string;
  textColor: string;
  textSecondary: string;
}) {
  const handlePress = useCallback(() => onPress(item), [item, onPress]);
  const handlePressIn = useCallback(() => onPressIn(item), [item, onPressIn]);

  const hasVideo = useMemo(
    () => item.webvr?.some((w: any) => w.type === 'video'),
    [item.webvr],
  );
  const hasAudio = useMemo(
    () => item.webvr?.some((w: any) => w.type === 'audio'),
    [item.webvr],
  );

  const iconBg = useMemo(() => accentColor + '18', [accentColor]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.topicCard, {backgroundColor: cardBg}]}
      onPressIn={handlePressIn}
      onPress={handlePress}>
      <View style={[styles.topicIconWrap, {backgroundColor: iconBg}]}>
        <Text style={styles.topicIcon}>{item.icon || '📚'}</Text>
      </View>
      <View style={styles.topicInfo}>
        <Text style={[styles.topicTitle, {color: textColor}]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text
          style={[styles.topicDesc, {color: textSecondary}]}
          numberOfLines={2}>
          {item.description || 'Explore this immersive learning experience'}
        </Text>
        {(hasVideo || hasAudio) && (
          <View style={styles.badgeRow}>
            {hasVideo && (
              <View style={styles.videoBadge}>
                <Play size={10} color="#1E40AF" strokeWidth={2.5} />
                <Text style={styles.videoBadgeText}>Video</Text>
              </View>
            )}
            {hasAudio && (
              <View style={styles.immersiveBadge}>
                <Glasses size={10} color="#065F46" strokeWidth={2.5} />
                <Text style={styles.immersiveBadgeText}>Immersive</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ── Main screen ────────────────────────────────────────────────────────
export default function WebVRFolderScreen() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const {folderId, folderName, gradientColors} = route.params;
  const {width: screenWidth} = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const contentMaxWidth = isTablet ? Math.min(screenWidth * 0.85, 720) : undefined;

  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<WebVRAsset | null>(null);
  const [warmupAsset, setWarmupAsset] = useState<WebVRAsset | null>(null);
  const [modalEverOpened, setModalEverOpened] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const [bg1, bg2] = gradientColors || ['#0EA5E9', '#38BDF8'];
  const gradientArr = useMemo(() => [bg1, bg2], [bg1, bg2]);

  const fetchTopics = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await WebVRService.getContent(folderId);
      if (!mountedRef.current) return;
      const data = response?.data?.data || response?.data || {};
      setTopics(data.topics || []);
    } catch {
      if (!mountedRef.current) return;
      setError(true);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [folderId]);

  // Deferred fetch after navigation animation
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchTopics();
    });
    return () => task.cancel();
  }, [fetchTopics]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadWebVRViewerModal().catch(() => {});
    });
    return () => task.cancel();
  }, []);

  // Stable callbacks
  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleTopicPressIn = useCallback((item: WebVRAsset) => {
    setWarmupAsset(prev => (prev?._id === item._id ? prev : item));
  }, []);

  const handleTopicPress = useCallback((item: any) => {
    setWarmupAsset(item);
    setSelectedAsset(item);
    setModalEverOpened(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setWarmupAsset(null);
    setSelectedAsset(null);
  }, []);

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<any>) => (
        <TopicCard
          item={item}
          onPress={handleTopicPress}
          onPressIn={handleTopicPressIn}
          accentColor={bg1}
          cardBg={colors.card}
          textColor={colors.text}
          textSecondary={colors.textSecondary}
        />
      ),
    [handleTopicPress, handleTopicPressIn, bg1, colors.card, colors.text, colors.textSecondary],
  );

  // Memoized styles
  const contentStyle = useMemo(
    () => ({
      padding: scale(16),
      paddingBottom: insets.bottom + verticalScale(90),
    }),
    [insets.bottom],
  );

  const headerPadding = useMemo(
    () => ({paddingTop: insets.top + verticalScale(10)}),
    [insets.top],
  );

  const countText = useMemo(() => {
    if (loading) return 'Loading...';
    return `${topics.length} experience${topics.length !== 1 ? 's' : ''}`;
  }, [loading, topics.length]);

  // Memoized empty component
  const EmptyComponent = useMemo(
    () => (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={[styles.emptyTitle, {color: colors.text}]}>
          No experiences available
        </Text>
        <Text style={[styles.emptyDesc, {color: colors.textSecondary}]}>
          Content coming soon
        </Text>
      </View>
    ),
    [colors.text, colors.textSecondary],
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={[styles.header, headerPadding]}>
        <LinearGradient
          colors={gradientArr}
          locations={[0, 1]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}>
          <ArrowLeft size={20} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {folderName}
          </Text>
          <Text style={styles.headerSub}>{countText}</Text>
        </View>
        <View style={[styles.curve, {backgroundColor: colors.background}]} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={[styles.skeletonContainer, contentMaxWidth ? {width: contentMaxWidth, alignSelf: 'center'} : undefined]}>
          <TopicSkeleton />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>
            Failed to load
          </Text>
          <Text style={[styles.emptyDesc, {color: colors.textSecondary}]}>
            Check your connection and try again
          </Text>
          <TouchableOpacity
            onPress={fetchTopics}
            style={[styles.retryBtn, {backgroundColor: bg1}]}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={topics}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[contentStyle, contentMaxWidth ? {width: contentMaxWidth, alignSelf: 'center'} : undefined]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyComponent}
          // ── FlatList perf tuning ──
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          updateCellsBatchingPeriod={50}
        />
      )}

      {warmupAsset && !selectedAsset && (
        <WebVRAssetWarmup
          asset={warmupAsset}
        />
      )}

      {/* Lazy modal – only mounted after first topic tap */}
      {modalEverOpened && (
        <React.Suspense fallback={null}>
          <LazyWebVRViewerModal
            visible={!!selectedAsset}
            onClose={handleModalClose}
            assetTitle={selectedAsset?.title || ''}
            folderName={folderName}
            assetData={selectedAsset}
          />
        </React.Suspense>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  mediaWarmupHost: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -100,
    left: -100,
  },
  mediaWarmupNode: {
    position: 'absolute',
    width: 32,
    height: 32,
    top: 0,
    left: 0,
    opacity: 0,
  },

  header: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(30),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flexWrap: 'wrap',
    overflow: 'hidden',
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
  headerInfo: {flex: 1},
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(2),
  },
  headerSub: {
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },

  // ── Skeleton ──
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(8),
  },
  skeletonWrap: {gap: verticalScale(12)},
  skeletonRow: {
    flexDirection: 'row',
    gap: scale(12),
    padding: moderateScale(14),
  },
  skeletonText: {flex: 1, gap: verticalScale(6)},
  skeletonLine2: {marginTop: verticalScale(2)},
  skeletonLine3: {marginTop: verticalScale(4)},

  // ── Topic card ──
  topicCard: {
    flexDirection: 'row',
    borderRadius: moderateScale(16),
    marginBottom: TOPIC_CARD_MARGIN,
    padding: moderateScale(14),
    gap: scale(12),
    minHeight: TOPIC_CARD_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: verticalScale(3)},
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(8),
      },
      android: {elevation: 3},
    }),
  },
  topicIconWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicIcon: {fontSize: moderateScale(28)},
  topicInfo: {flex: 1},
  topicTitle: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    marginBottom: verticalScale(3),
  },
  topicDesc: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(17),
    marginBottom: verticalScale(6),
  },
  badgeRow: {
    flexDirection: 'row',
    gap: scale(6),
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    backgroundColor: '#DBEAFE',
  },
  videoBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: '#1E40AF',
  },
  immersiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(8),
    backgroundColor: '#D1FAE5',
  },
  immersiveBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: '#065F46',
  },

  emptyIcon: {
    fontSize: moderateScale(48),
    marginBottom: verticalScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: verticalScale(4),
  },
  emptyDesc: {
    fontSize: moderateScale(13),
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: verticalScale(16),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(10),
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: moderateScale(13),
  },
});
