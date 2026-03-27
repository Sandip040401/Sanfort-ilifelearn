import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpenText,
  Calculator,
  FlaskConical,
  Gamepad2,
  Music4,
  Play,
  RefreshCcw,
  Search,
} from 'lucide-react-native';
import { ScreenErrorBoundary, Skeleton } from '@/components/ui';
import { useScreenReady } from '@/hooks/useScreenReady';
import { GamesService } from '@/services';
import { useTheme } from '@/theme';
import type { BottomTabParamList, MainStackParamList } from '@/types';
import { useTabBarHideOnScroll } from '@/navigation/useTabBarHideOnScroll';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import {
  GAME_CATEGORIES,
  GAME_CATEGORY_META,
  SCIENCE_FALLBACK_GAMES,
  type GameCatalogItem,
  type GameCategory,
} from './games.data';

const H_PAD = scale(20);
const GRID_COLUMN_GAP = scale(12);

type GamesNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<BottomTabParamList, 'Games'>,
  StackNavigationProp<MainStackParamList>
>;

const CATEGORY_ICONS = {
  Literacy: BookOpenText,
  Numeracy: Calculator,
  Science: FlaskConical,
  'Rhymes and Stories': Music4,
} as const;

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(42),
    overflow: 'hidden',
  },
  heroGlowOne: {
    position: 'absolute',
    top: verticalScale(40),
    right: -scale(30),
    width: scale(150),
    height: scale(150),
    borderRadius: moderateScale(75),
    backgroundColor: 'rgba(45,212,191,0.22)',
  },
  heroGlowTwo: {
    position: 'absolute',
    bottom: verticalScale(28),
    left: -scale(18),
    width: scale(116),
    height: scale(116),
    borderRadius: moderateScale(58),
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.4,
  },
  heroTitle: {
    flex: 1,
    fontSize: moderateScale(28),
    lineHeight: moderateScale(34),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: verticalScale(8),
    maxWidth: '92%',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    color: 'rgba(255,255,255,0.74)',
  },
  shadowContainer: {
    marginHorizontal: H_PAD,
    marginTop: -verticalScale(21),
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(22),
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    minHeight: verticalScale(42),
    fontSize: moderateScale(14),
  },
  heroCurve: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: verticalScale(14),
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
  },
  content: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(20),
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: moderateScale(22),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    marginBottom: verticalScale(16),
  },
  noticeTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
  noticeCopy: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  featuredWrap: {
    marginBottom: verticalScale(18),
  },
  featuredCard: {
    overflow: 'hidden',
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(14),
    minHeight: verticalScale(160),
  },
  featuredNoise: {
    position: 'absolute',
    top: verticalScale(14),
    right: scale(14),
    width: scale(96),
    height: scale(96),
    borderRadius: moderateScale(48),
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  featuredTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  featuredEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(15,23,42,0.16)',
  },
  featuredEyebrowText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#fff',
  },
  featuredIconBubble: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  featuredIconText: {
    fontSize: moderateScale(24),
  },
  featuredTitle: {
    marginTop: verticalScale(10),
    maxWidth: '82%',
    fontSize: moderateScale(24),
    lineHeight: moderateScale(29),
    fontWeight: '900',
    color: '#fff',
  },
  featuredCopy: {
    marginTop: verticalScale(10),
    maxWidth: '88%',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    color: 'rgba(255,255,255,0.76)',
  },
  featuredSkillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: verticalScale(14),
  },
  featuredSkillPill: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  featuredSkillText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#fff',
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
    marginTop: verticalScale(18),
  },
  featuredMeta: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  featuredPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(999),
    backgroundColor: '#fff',
  },
  featuredPlayText: {
    fontSize: moderateScale(12),
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionRow: {
    marginBottom: verticalScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '900',
  },
  sectionMeta: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  tabsContent: {
    gap: scale(10),
    paddingBottom: verticalScale(14),
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
    borderWidth: 1,
  },
  tabChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  tabChipEmoji: {
    fontSize: moderateScale(12),
  },
  tabChipText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  tabChipTextActive: {
    color: '#fff',
  },
  tabChipCount: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    marginLeft: scale(2),
  },
  subStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginBottom: verticalScale(18),
  },
  subStatCard: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: moderateScale(22),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(14),
    borderWidth: 1,
  },
  subStatOrb: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subStatOrbText: {
    fontSize: moderateScale(16),
  },
  subStatValue: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(20),
    fontWeight: '900',
  },
  subStatLabel: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  cardWrap: {
    marginBottom: verticalScale(14),
  },
  queueCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: moderateScale(24),
  },
  queueVisual: {
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
    justifyContent: 'space-between',
  },
  queueVisualTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueVisualBottom: {
    gap: verticalScale(3),
  },
  queueIconBubble: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cardEmoji: {
    fontSize: moderateScale(18),
  },
  queueMetaLabel: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  queueMetaTitle: {
    fontSize: moderateScale(10),
    lineHeight: moderateScale(15),
    fontWeight: '800',
    color: '#fff',
  },
  queueContent: {
    flex: 1,
    paddingLeft: scale(10),
    paddingRight: scale(10),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(8),
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(5),
  },
  categoryBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
  },
  queueTitle: {
    marginTop: verticalScale(7),
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    fontWeight: '900',
  },
  queueDesc: {
    marginTop: verticalScale(5),
    fontSize: moderateScale(10),
    lineHeight: moderateScale(15),
    minHeight: verticalScale(32),
  },
  queueSkillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
    marginTop: verticalScale(7),
  },
  queueSkillPill: {
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(5),
  },
  queueSkillText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
  },
  queuePlayCircle: {
    position: 'absolute',
    top: verticalScale(10),
    right: scale(10),
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  refreshCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginTop: verticalScale(14),
  },
  heroMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroMiniBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  emptyState: {
    marginHorizontal: H_PAD,
    marginTop: verticalScale(10),
    borderWidth: 1,
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(28),
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: scale(54),
    height: scale(54),
    borderRadius: moderateScale(27),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(18),
    fontWeight: '900',
  },
  emptyCopy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    textAlign: 'center',
  },
  skeletonRoot: {
    flex: 1,
    backgroundColor: '#F4F7FF',
  },
  skeletonHero: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(56),
    paddingBottom: verticalScale(28),
  },
  skeletonTopSpace: {
    marginTop: verticalScale(14),
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: verticalScale(18),
  },
  skeletonContent: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(16),
  },
  skeletonTabsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(18),
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(14),
    marginTop: verticalScale(18),
  },
});

function inferCategory(raw: any): Exclude<GameCategory, 'All Games'> {
  const haystack = [
    raw?.category,
    raw?.title,
    raw?.name,
    raw?.topicName,
    ...(Array.isArray(raw?.skills) ? raw.skills : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    haystack.includes('math') ||
    haystack.includes('number') ||
    haystack.includes('numeracy') ||
    haystack.includes('count')
  ) {
    return 'Numeracy';
  }

  if (
    haystack.includes('rhyme') ||
    haystack.includes('story') ||
    haystack.includes('poem')
  ) {
    return 'Rhymes and Stories';
  }

  if (
    haystack.includes('science') ||
    haystack.includes('animal') ||
    haystack.includes('food') ||
    haystack.includes('physics') ||
    haystack.includes('nature')
  ) {
    return 'Science';
  }

  return 'Literacy';
}

function normalizeApiGames(rawGames: any[]): GameCatalogItem[] {
  return rawGames.reduce<GameCatalogItem[]>((games, raw, index) => {
    const title = normalizeText(raw?.title || raw?.name || `Game ${index + 1}`);
    const url = normalizeText(raw?.url || raw?.gameUrl || raw?.link);

    if (!url) {
      return games;
    }

    const category = inferCategory(raw);
    const skills = Array.isArray(raw?.skills)
      ? raw.skills.map((skill: unknown) => normalizeText(skill)).filter(Boolean)
      : [];
    const shortSkills = skills.slice(0, 3);

    games.push({
      id: normalizeText(raw?.id || raw?._id || raw?.slug || `api-game-${index}`),
      title,
      category,
      url,
      icon: normalizeText(raw?.topicIcon || raw?.icon) || undefined,
      thumbnail:
        normalizeText(raw?.thumbnail || raw?.image || raw?.coverImage || raw?.previewImage) || undefined,
      skills: shortSkills.length ? shortSkills : [category, 'Interactive'],
      description:
        normalizeText(raw?.description) ||
        `${title} is ready for quick-play learning with ${category.toLowerCase()} activities.`,
      source: 'api' as const,
      difficulty: Number(raw?.difficulty) || 1,
      difficultyLevel: normalizeText(raw?.difficultyLevel || 'Basic').replace(/^\w/, c => c.toUpperCase()),
    });

    return games;
  }, []);
}

function mergeGames(liveGames: GameCatalogItem[]) {
  const merged = new Map<string, GameCatalogItem>();

  [...SCIENCE_FALLBACK_GAMES, ...liveGames].forEach(game => {
    const key = normalizeText(game.url).toLowerCase() || normalizeText(game.id).toLowerCase();
    if (!key) {
      return;
    }

    const existing = merged.get(key);
    if (!existing || existing.source === 'fallback') {
      merged.set(key, game);
    }
  });

  return [...merged.values()].sort((left, right) => {
    if (left.category !== right.category) {
      return GAME_CATEGORIES.indexOf(left.category) - GAME_CATEGORIES.indexOf(right.category);
    }
    return left.title.localeCompare(right.title);
  });
}

function GamesSkeleton() {
  return (
    <View style={styles.skeletonRoot}>
      <View style={styles.skeletonHero}>
        <LinearGradient
          colors={['#25135F', '#39187A', '#4C1D95', '#5C35CA', '#6C4CFF']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill} />
        <Skeleton width="40%" height={18} borderRadius={999} />
        <Skeleton width="66%" height={34} borderRadius={16} style={styles.skeletonTopSpace} />
        <Skeleton width="82%" height={16} borderRadius={8} style={styles.skeletonTopSpace} />
        <View style={styles.skeletonStatsRow}>
          <Skeleton width="30%" height={74} borderRadius={22} />
          <Skeleton width="30%" height={74} borderRadius={22} />
          <Skeleton width="30%" height={74} borderRadius={22} />
        </View>
        <Skeleton width="100%" height={54} borderRadius={20} style={styles.skeletonTopSpace} />
      </View>

      <View style={styles.skeletonContent}>
        <Skeleton width="100%" height={178} borderRadius={28} />
        <View style={styles.skeletonTabsRow}>
          <Skeleton width={96} height={40} borderRadius={999} />
          <Skeleton width={112} height={40} borderRadius={999} />
          <Skeleton width={124} height={40} borderRadius={999} />
        </View>
        <View style={styles.skeletonGrid}>
          <Skeleton width="48%" height={214} borderRadius={24} />
          <Skeleton width="48%" height={214} borderRadius={24} />
          <Skeleton width="48%" height={214} borderRadius={24} />
          <Skeleton width="48%" height={214} borderRadius={24} />
        </View>
      </View>
    </View>
  );
}

const CategoryChip = React.memo(({
  category,
  active,
  count,
  meta,
  onPress,
  colors,
  idleStyle,
  textIdleStyle,
}: {
  category: string;
  active: boolean;
  count: number;
  meta: any;
  onPress: (category: any) => void;
  colors: any;
  idleStyle: any;
  textIdleStyle: any;
}) => {
  return (
    <Pressable
      onPress={() => onPress(category as any)}
      style={[
        styles.tabChip,
        active ? styles.tabChipActive : idleStyle,
      ]}>
      {meta ? (
        <Text style={styles.tabChipEmoji}>{meta.icon}</Text>
      ) : (
        <Gamepad2 size={moderateScale(14)} color={active ? '#fff' : colors.textSecondary} strokeWidth={2} />
      )}
      <Text
        style={[
          styles.tabChipText,
          active ? styles.tabChipTextActive : textIdleStyle,
        ]}>
        {category}
        <Text style={[styles.tabChipCount, { color: colors.textSecondary }, active && { color: 'rgba(255,255,255,0.88)' }]}>
          {' '}({count})
        </Text>
      </Text>
    </Pressable>
  );
});

const CategoryTabs = React.memo(({
  selectedCategory,
  onCategoryPress,
  categoryCounts,
  categoryListRef,
  onScrollFailure,
  colors,
  idleStyle,
  textIdleStyle,
}: {
  selectedCategory: string;
  onCategoryPress: (category: any) => void;
  categoryCounts: Record<string, number>;
  categoryListRef: any;
  onScrollFailure: any;
  colors: any;
  idleStyle: any;
  textIdleStyle: any;
}) => {
  return (
    <FlatList
      ref={categoryListRef}
      data={GAME_CATEGORIES}
      horizontal
      keyExtractor={item => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContent}
      initialNumToRender={GAME_CATEGORIES.length}
      onScrollToIndexFailed={onScrollFailure}
      renderItem={({ item: category }) => {
        const active = selectedCategory === category;
        const categoryMeta =
          category === 'All Games' ? null : GAME_CATEGORY_META[category];

        return (
          <CategoryChip
            category={category}
            active={active}
            count={categoryCounts[category]}
            meta={categoryMeta}
            onPress={onCategoryPress}
            colors={colors}
            idleStyle={idleStyle}
            textIdleStyle={textIdleStyle}
          />
        );
      }}
    />
  );
});

const GameCard = React.memo(({
  item,
  index,
  onPress,
  width,
  minHeight,
  visualStyle,
  colors,
}: {
  item: GameCatalogItem;
  index: number;
  onPress: (item: GameCatalogItem) => void;
  width: number;
  minHeight: any;
  visualStyle: any;
  colors: any;
}) => {
  const meta = GAME_CATEGORY_META[item.category];
  const Icon = CATEGORY_ICONS[item.category];

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={[
        styles.cardWrap,
        { width },
        index % 2 === 0
          ? { marginLeft: H_PAD, marginRight: GRID_COLUMN_GAP / 2 }
          : { marginLeft: GRID_COLUMN_GAP / 2, marginRight: H_PAD },
      ]}>
      <View
        style={[
          styles.queueCard,
          minHeight,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
          <View style={[styles.queueVisual, visualStyle]}>
            <LinearGradient
              colors={meta.gradient}
              locations={[0, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill} />
            <View style={styles.queueVisualTop}>
              <View>
                <Text style={styles.queueMetaLabel}>Difficulty</Text>
                <Text numberOfLines={1} style={styles.queueMetaTitle}>
                  {item.difficultyLevel || 'Basic'}
                </Text>
              </View>
              <View style={styles.queueIconBubble}>
                {item.icon ? (
                  <Text style={styles.cardEmoji}>{item.icon}</Text>
                ) : (
                  <Icon size={moderateScale(22)} color="#fff" strokeWidth={2} />
                )}
              </View>
            </View>
          </View>

        <View style={styles.queueContent}>
          <View style={[styles.categoryBadge, { backgroundColor: meta.accentSoft, borderColor: meta.border }]}>
            <Text style={[styles.categoryBadgeText, { color: meta.text }]}>{item.category}</Text>
          </View>

          <Text numberOfLines={1} style={[styles.queueTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text numberOfLines={2} style={[styles.queueDesc, { color: colors.textSecondary }]}>
            {item.description}
          </Text>

          <View style={[styles.queuePlayCircle, { backgroundColor: meta.accentSoft }]}>
            <Play size={moderateScale(15)} color={meta.accent} fill={meta.accent} strokeWidth={0} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

function GamesScreenContent() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { onScroll } = useTabBarHideOnScroll();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<GamesNavigationProp>();
  const screenReady = useScreenReady();
  const categoryListRef = useRef<FlatList<GameCategory>>(null);
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All Games');
  const deferredCategory = useDeferredValue(selectedCategory);
  const [searchValue, setSearchValue] = useState('');
  const deferredSearchValue = useDeferredValue(searchValue);
  const isTablet = width >= 768;
  const bottomContentInset = TAB_BAR_HEIGHT + insets.bottom + verticalScale(24);
  const gridCardWidth = useMemo(
    () => Math.max(scale(130), (width - (H_PAD * 2) - GRID_COLUMN_GAP) / 2),
    [width],
  );
  const queueVisualStyle = useMemo(
    () => ({ minHeight: isTablet ? verticalScale(60) : verticalScale(42) }),
    [isTablet],
  );
  const queueCardMinHeightStyle = useMemo(
    () => ({ minHeight: isTablet ? verticalScale(180) : verticalScale(148) }),
    [isTablet],
  );

  const liveGamesQuery = useQuery({
    queryKey: ['games-catalog'],
    queryFn: async () => {
      const response = await GamesService.getAllGames({ page: 1, limit: 200 });
      const rawPayload = response.data as any;
      const gamesArray =
        rawPayload?.data?.data ||
        rawPayload?.data ||
        rawPayload?.games ||
        [];
      return normalizeApiGames(gamesArray);
    },
    staleTime: 1000 * 60 * 5,
  });

  const spinValue = useRef(new Animated.Value(0)).current;
  const isRefreshing = liveGamesQuery.isPending || liveGamesQuery.isRefetching;

  useEffect(() => {
    if (isRefreshing) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [isRefreshing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const allGames = useMemo(
    () => mergeGames(liveGamesQuery.data ?? []),
    [liveGamesQuery.data],
  );

  const categoryCounts = useMemo(() => {
    return GAME_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = allGames.filter(g => cat === 'All Games' ? true : g.category === cat).length;
      return acc;
    }, {} as Record<string, number>);
  }, [allGames]);
  const trimmedSearch = deferredSearchValue.trim().toLowerCase();

  const filteredGames = useMemo(() => {
    return allGames.filter(game => {
      const categoryPass =
        deferredCategory === 'All Games' || game.category === deferredCategory;
      const searchPass =
        !trimmedSearch ||
        game.title.toLowerCase().includes(trimmedSearch) ||
        game.category.toLowerCase().includes(trimmedSearch) ||
        game.description.toLowerCase().includes(trimmedSearch) ||
        (game.skills || []).some(skill => skill.toLowerCase().includes(trimmedSearch));

      return categoryPass && searchPass;
    });
  }, [allGames, deferredCategory, trimmedSearch]);

  const featuredGame = useMemo(() => {
    if (selectedCategory !== 'All Games' || trimmedSearch) {
      return null;
    }

    return allGames[0] ?? null;
  }, [allGames, selectedCategory, trimmedSearch]);

  const gridGames = useMemo(
    () =>
      featuredGame
        ? filteredGames.filter(game => game.id !== featuredGame.id)
        : filteredGames,
    [featuredGame, filteredGames],
  );

  const chipIdleStyle = useMemo(
    () => ({ backgroundColor: colors.surface, borderColor: colors.border }),
    [colors.border, colors.surface],
  );
  const chipTextIdleStyle = useMemo(
    () => ({ color: colors.textSecondary }),
    [colors.textSecondary],
  );

  const centerCategoryChip = (category: GameCategory, animated = true) => {
    const index = GAME_CATEGORIES.indexOf(category);
    if (index < 0) {
      return;
    }

    requestAnimationFrame(() => {
      categoryListRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: 0.5,
      });
    });
  };

  useEffect(() => {
    centerCategoryChip(selectedCategory, false);
  }, [selectedCategory]);

  const handleCategoryScrollFailure = useCallback(({ index }: { index: number }) => {
    setTimeout(() => {
      categoryListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    }, 120);
  }, []);

  const handleCategoryPress = useCallback((category: GameCategory) => {
    centerCategoryChip(category);
    setSelectedCategory(prev => {
      if (category === prev) {
        return prev;
      }
      return category;
    });
  }, []);

  const handleOpenGame = useCallback((game: GameCatalogItem) => {
    navigation.navigate('GamePlayer', {
      gameId: game.id,
      gameTitle: game.title,
      gameUrl: game.url,
    });
  }, [navigation]);

  const handleRefresh = () => {
    if (liveGamesQuery.isPending || liveGamesQuery.isRefetching) {
      return;
    }

    liveGamesQuery.refetch();
  };

  const renderGameCard = useCallback(({ item, index }: { item: GameCatalogItem; index: number }) => (
    <GameCard
      item={item}
      index={index}
      onPress={handleOpenGame}
      width={gridCardWidth}
      minHeight={queueCardMinHeightStyle}
      visualStyle={queueVisualStyle}
      colors={colors}
    />
  ), [gridCardWidth, queueCardMinHeightStyle, queueVisualStyle, colors, handleOpenGame]);

  if (!screenReady) {
    return <GamesSkeleton />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <FlatList
        data={gridGames}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={renderGameCard}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomContentInset }}
        refreshControl={
          <RefreshControl
            refreshing={liveGamesQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.secondary]}
            progressViewOffset={insets.top + verticalScale(8)}
          />
        }
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { paddingTop: insets.top + verticalScale(14) }]}>
              <LinearGradient
                colors={['#3D2799', '#5439CC', '#6C4CFF']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill} />
              <View style={styles.heroGlowOne} />
              <View style={styles.heroGlowTwo} />

              <View style={styles.heroTopRow}>
                <Text style={styles.heroTitle}>Educational Games</Text>
                <Pressable
                  disabled={isRefreshing}
                  onPress={handleRefresh}
                  style={styles.refreshCircle}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <RefreshCcw size={moderateScale(16)} color="#fff" strokeWidth={2.4} />
                  </Animated.View>
                </Pressable>
              </View>

              <Text style={styles.heroSubtitle}>
                Dive into fun and interactive learning games designed for all grades.
              </Text>

              <View style={[styles.heroCurve, { backgroundColor: colors.background }]} />
            </View>

            <View style={styles.shadowContainer}>
              <View style={[styles.searchShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={moderateScale(18)} color={colors.textSecondary} strokeWidth={2} />
                <TextInput
                  value={searchValue}
                  onChangeText={setSearchValue}
                  placeholder="Search missions, skills or categories"
                  placeholderTextColor={colors.textSecondary + '80'}
                  style={[styles.searchInput, { color: colors.text }]}
                  returnKeyType="search"
                />
              </View>
            </View>

            <View style={styles.content}>
              {liveGamesQuery.isError && (
                <View style={[styles.noticeCard, { backgroundColor: colors.accentSurface, borderColor: colors.border }]}>
                  <Text style={[styles.noticeTitle, { color: colors.text }]}>
                    Live games couldn’t sync right now
                  </Text>
                  <Text style={[styles.noticeCopy, { color: colors.textSecondary }]}>
                    Catalog stays usable through the fallback science collection while the API recovers.
                  </Text>
                </View>
              )}

              {/* {featuredGame && (
                <Pressable onPress={() => handleOpenGame(featuredGame)} style={styles.featuredWrap}>
                  <View style={styles.featuredCard}>
                    <LinearGradient
                      colors={GAME_CATEGORY_META[featuredGame.category].gradient}
                      locations={[0, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill} />
                    <View style={styles.featuredNoise} />
                    <View style={styles.featuredTopRow}>

                      <View style={styles.featuredEyebrow}>
                        <Gamepad2 size={moderateScale(14)} color="#fff" strokeWidth={2.2} />
                        <Text style={styles.featuredEyebrowText}>Featured Launch</Text>
                      </View>
                      <View style={styles.featuredIconBubble}>
                        <Text style={styles.featuredIconText}>
                          {featuredGame.icon || GAME_CATEGORY_META[featuredGame.category].icon}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.featuredTitle}>{featuredGame.title}</Text>
                    <Text style={styles.featuredCopy} numberOfLines={2}>
                      {featuredGame.description}
                    </Text>

                    <View style={styles.featuredSkillRow}>
                      {(featuredGame.skills || []).slice(0, 3).map(skill => (
                        <View key={`${featuredGame.id}-${skill}`} style={styles.featuredSkillPill}>
                          <Text style={styles.featuredSkillText}>{skill}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.featuredFooter}>
                      <Text style={styles.featuredMeta}>{GAME_CATEGORY_META[featuredGame.category].chipLabel}</Text>
                      <View style={styles.featuredPlay}>
                        <Play size={moderateScale(16)} color="#0F172A" fill="#0F172A" strokeWidth={0} />
                        <Text style={styles.featuredPlayText}>Play now</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              )} */}

              <View style={styles.sectionRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {trimmedSearch ? 'Search Results' : 'Collections'}
                </Text>
                <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
                  {trimmedSearch
                    ? `${filteredGames.length} found for "${trimmedSearch}"`
                    : `${selectedCategory === 'All Games' ? 'All' : selectedCategory} • ${filteredGames.length} missions`}
                </Text>
              </View>

              <CategoryTabs
                selectedCategory={selectedCategory}
                onCategoryPress={handleCategoryPress}
                categoryCounts={categoryCounts}
                categoryListRef={categoryListRef}
                onScrollFailure={handleCategoryScrollFailure}
                colors={colors}
                idleStyle={chipIdleStyle}
                textIdleStyle={chipTextIdleStyle}
              />



            </View>
          </>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySurface }]}>
              <Search size={moderateScale(24)} color={colors.primaryDark} strokeWidth={2.2} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No games matched</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              Try another keyword or switch to a different collection.
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default function GamesScreen() {
  return (
    <ScreenErrorBoundary>
      <GamesScreenContent />
    </ScreenErrorBoundary>
  );
}
