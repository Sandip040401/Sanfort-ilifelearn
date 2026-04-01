import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  ArrowLeft,
  Box,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  Tag,
} from 'lucide-react-native';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import MediaViewer, { type MediaViewerPayload } from '@/components/MediaViewer';
import KidLoadingAnimation from '@/components/books/KidLoadingAnimation';
import { useScreenReady } from '@/hooks/useScreenReady';
import { useTheme } from '@/theme';
import { useAuth } from '@/store';
import { BooksService } from '@/services';
import { normalizeConceptsPayload } from './books.utils';
import type { BooksStackParamList, MainStackParamList } from '@/types';
import { useTabBarHideOnScroll } from '@/navigation/useTabBarHideOnScroll';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import { withAlpha } from './books.data';
import { getYouTubeThumbnailUrl, isYouTubeUrl } from '@/utils/video';

type TopicRouteProp = RouteProp<BooksStackParamList, 'TopicDetail'>;
type TopicNavigationProp = StackNavigationProp<MainStackParamList & BooksStackParamList>;

type ResourceKind = 'image' | 'video' | 'document';



const getFileLabelFromUrl = (url: string, fallback: string) => {
  if (!url) return fallback;
  try {
    const trimmed = url.split('?')[0]?.split('#')[0] ?? '';
    const parts = trimmed.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return fallback;
    const decoded = decodeURIComponent(last);
    return decoded.replace(/\.[a-z0-9]+$/i, '') || fallback;
  } catch {
    return fallback;
  }
};

const getKeywordStyles = (keyword: string = '') => {
  const k = keyword.trim();
  switch (k) {
    case 'English':
      return { bg: '#DBEAFE', text: '#1D4ED8', border: '#BAE6FD' };
    case 'Numeracy':
      return { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0' };
    case 'Hindi':
      return { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' };
    case 'EVS':
      return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
    case 'Conceptual Learning':
      return { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' };
    case 'Other Concepts':
      return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    default:
      return { bg: '#FCE7F3', text: '#BE185D', border: '#FBCFE8' };
  }
};

function TopicScreenContent() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { onScroll } = useTabBarHideOnScroll();
  const navigation = useNavigation<TopicNavigationProp>();
  const route = useRoute<TopicRouteProp>();
  const { topic: initialTopic, subjectColor, subjectName, gradeName, gradeKey, subjectKey } = route.params;
  const { width: windowWidth } = useWindowDimensions();
  const [selectedMedia, setSelectedMedia] = useState<MediaViewerPayload | null>(null);
  const screenReady = useScreenReady();
  
  const role = user?.role?.toLowerCase();
  const isStaff = role === 'teacher' || role === 'super-admin' || role === 'admin';

  const safeAccent = subjectColor && subjectColor.startsWith('#')
    ? subjectColor
    : colors.primary || '#F97316';
    
  const bottomContentInset = TAB_BAR_HEIGHT + insets.bottom + verticalScale(24);

  const { data: topicData, isPending } = useQuery({
    queryKey: ['topic-detail', initialTopic.id],
    queryFn: async () => {
      // Re-fetching the subject to get the absolute latest for this topic
      const isSanfort = gradeName?.toLowerCase()?.includes('san');
      let book: any = {};
      if (isSanfort) {
        const response = await BooksService.getGradeById(subjectKey || '');
        const data = response.data as any;
        book = data?.book || {};
      } else {
         const response = await BooksService.getConceptsForHome(gradeKey || '', subjectKey || '');
         const data = response.data?.data ?? response.data;
         book = data || {};
      }
      
      // Find the topic in the books/weeks
      const allTopics = (book.weeks || []).flatMap((w: any) => (w.topics || []).map((t: any) => ({ ...t, volumeNumber: w.weekNumber })));
      const found = allTopics.find((t: any) => t.id === initialTopic.id || t._id === initialTopic.id);
      
      return found || initialTopic;
    },
    initialData: initialTopic,
    staleTime: 1000 * 60 * 5,
  });

  const safeTopic = {
    ...topicData,
    title: topicData?.title ?? 'Topic',
    conceptTitle: topicData?.conceptTitle ?? 'Concept',
    volumeNumber: topicData?.volumeNumber ?? 0,
    images: Array.isArray(topicData?.images) ? topicData.images : [],
    videos: Array.isArray(topicData?.videos) ? topicData.videos : [],
    arSheets: Array.isArray(topicData?.arSheets) ? topicData.arSheets : [],
    ar: Array.isArray(topicData?.ar) ? topicData.ar : [],
    keyword: topicData?.keyword ?? '',
  };

  const renderResourceSection = (
    title: string,
    items: string[],
    kind: ResourceKind,
  ) => {
    if (!items.length) {
      return null;
    }

    const gridGap = scale(12);
    // 2 columns: (total width - padding - gap) / 2
    const columnWidth = (windowWidth - scale(40) - gridGap) / 2;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title} ({items.length})
        </Text>

        <View style={styles.resourcesGrid}>
          {items.map((item, index) => {
            const thumbnailUrl = kind === 'video' ? getYouTubeThumbnailUrl(item) : null;
            const label =
              kind === 'image' || kind === 'video'
                ? `${safeTopic.title}`
                : `Worksheet ${index + 1}`;

            return (
              <TouchableOpacity
                key={`${title}-${index}`}
                activeOpacity={0.88}
                onPress={() =>
                  setSelectedMedia({
                    type: kind,
                    url: item,
                    title: `${title} ${index + 1}`,
                  })
                }
                style={[
                  styles.resourceCardGrid,
                  {
                    width: columnWidth,
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : withAlpha(safeAccent, 0.12),
                  },
                ]}>
                {kind === 'image' ? (
                  <FastImage source={{ uri: item }} resizeMode={FastImage.resizeMode.cover} style={styles.resourceImageGrid} />
                ) : kind === 'video' && thumbnailUrl ? (
                  <View style={styles.resourcePosterGrid}>
                    <FastImage
                      source={{ uri: thumbnailUrl }}
                      resizeMode={FastImage.resizeMode.cover}
                      style={[StyleSheet.absoluteFill, styles.resourcePosterImage]}
                    />
                    <LinearGradient
                      colors={['rgba(15,23,42,0.08)', 'rgba(15,23,42,0.72)']}
                      locations={[0, 1]}
                      style={styles.resourcePosterOverlay}>
                      <View style={styles.resourcePosterBadge}>
                        <Text allowFontScaling={false} style={styles.resourcePosterBadgeText}>
                          {isYouTubeUrl(item) ? 'YouTube' : 'Video'}
                        </Text>
                      </View>
                      <PlayCircle size={moderateScale(28)} color="#fff" strokeWidth={2.4} />
                    </LinearGradient>
                  </View>
                ) : (
                  <LinearGradient
                    colors={[withAlpha(safeAccent, 0.14), withAlpha(safeAccent, 0.04)]}
                    locations={[0, 1]}
                    style={styles.resourcePosterGrid}>
                    {kind === 'video' ? (
                      <PlayCircle size={moderateScale(28)} color={safeAccent} strokeWidth={2.4} />
                    ) : (
                      <FileText size={moderateScale(30)} color={safeAccent} strokeWidth={1.8} />
                    )}
                  </LinearGradient>
                )}

                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[styles.resourceLabelGrid, { color: colors.text }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderARSection = (items: any[]) => {
    if (!items.length) {
      return null;
    }

    const gridGap = scale(12);
    const columnWidth = (windowWidth - scale(40) - gridGap) / 2;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          AR Activities ({items.length})
        </Text>

        <View style={styles.resourcesGrid}>
          {items.map((ar, index) => {
            return (
              <TouchableOpacity
                key={`ar-${index}`}
                activeOpacity={0.88}
                onPress={() => {
                   if (ar.modelId) {
                      navigation.navigate('ARViewer', { modelId: ar.modelId });
                   }
                }}
                style={[
                  styles.resourceCardGrid,
                  {
                    width: columnWidth,
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : withAlpha(safeAccent, 0.12),
                  },
                ]}>
                <LinearGradient
                  colors={[withAlpha('#7C3AED', 0.14), withAlpha('#7C3AED', 0.04)]}
                  locations={[0, 1]}
                  style={styles.resourcePosterGrid}>
                  <Box size={moderateScale(32)} color="#7C3AED" strokeWidth={2} />
                </LinearGradient>

                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[styles.resourceLabelGrid, { color: colors.text }]}>
                  {`3D Experience ${index + 1}`}
                </Text>

                <View style={[styles.arBadge, { backgroundColor: withAlpha('#7C3AED', 0.1) }]}>
                  <Text style={styles.arBadgeText}>LAUNCH AR</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={[styles.root, { backgroundColor: isDark ? colors.background : safeAccent }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scrollContent,
            {
              backgroundColor: colors.background,
              paddingBottom: bottomContentInset,
            },
          ]}>
          <View style={[styles.headerOuter, { paddingTop: insets.top + verticalScale(12) }]}>
            <LinearGradient
              colors={[safeAccent, withAlpha(safeAccent, 0.85)]}
              locations={[0, 1]}
              start={{ x: 0, y: 0.2 }}
              end={{ x: 1, y: 0.8 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Decorative background elements for a premium feel */}
            <View style={styles.decorativeCircle1} />
            <View style={styles.decorativeCircle2} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroTopLeft}>
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={[
                    styles.backButton,
                    { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.2)' },
                  ]}>
                  <ArrowLeft size={moderateScale(22)} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>

                <View style={[styles.breadcrumbBadge, { justifyContent: 'center' }]}>
                  {!!gradeName && !!subjectName && (
                    <Text style={[styles.breadcrumbBranding, { color: 'rgba(255, 255, 255, 0.7)' }]} numberOfLines={1}>
                      {gradeName.toUpperCase()} • {subjectName.toUpperCase()}
                    </Text>
                  )}
                  <Text style={[styles.headerSubtitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                    {safeTopic.conceptTitle}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.heroMain}>
              {!!safeTopic.keyword && (
                <View style={styles.keywordWrapper}>
                  <Tag size={moderateScale(12)} color="rgba(255, 255, 255, 0.9)" strokeWidth={2.5} />
                  <Text style={styles.keywordTextWhite}>
                    {safeTopic.keyword}
                  </Text>
                </View>
              )}

              <Text style={styles.headerTitlePro} numberOfLines={2}>
                {safeTopic.title.match(/^\d+/)
                  ? safeTopic.title
                  : `${safeTopic.volumeNumber}. ${safeTopic.title}`}
              </Text>
            </View>

            <View style={[styles.curvePro, { backgroundColor: colors.background }]} />
          </View>

          <View style={styles.content}>
            {!isStaff && isPending ? (
              <View style={[styles.loadingCard, { backgroundColor: colors.surface, paddingVertical: verticalScale(60) }]}>
                 <KidLoadingAnimation />
              </View>
            ) : !screenReady ? (
              <View style={[styles.loadingCard, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="small" color={safeAccent} />
                <Text style={[styles.loadingCardTitle, { color: colors.text }]}>
                  Preparing topic preview…
                </Text>
                <Text style={[styles.loadingCardCopy, { color: colors.textSecondary }]}>
                  Images, videos and worksheets will appear once the transition completes.
                </Text>
              </View>
            ) : (
              <>
                <View style={{ height: verticalScale(4) }} />
                {renderResourceSection('Concept Sheets', safeTopic.images, 'image')}
                {renderResourceSection('Videos', safeTopic.videos, 'video')}
                {renderARSection(safeTopic.ar)}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      <MediaViewer media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </>
  );
}

export default function TopicScreen() {
  return (
    <ScreenErrorBoundary>
      <TopicScreenContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerOuter: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(28),
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -scale(40),
    right: -scale(20),
    width: scale(150),
    height: scale(150),
    borderRadius: scale(75),
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -scale(20),
    left: -scale(40),
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    marginTop: verticalScale(4),
  },
  heroTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    flex: 1,
  },
  backButton: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  breadcrumbBadge: {
    gap: verticalScale(1),
    flex: 1,
  },
  breadcrumbBranding: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroMain: {
    marginTop: verticalScale(4),
  },
  keywordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: verticalScale(12),
    gap: scale(6),
  },
  keywordTextWhite: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitlePro: {
    fontSize: moderateScale(25),
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: moderateScale(31),
    letterSpacing: -0.5,
    paddingBottom: verticalScale(16),
  },
  curvePro: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: verticalScale(24),
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
  },
  content: {
    paddingHorizontal: scale(20),
  },
  keywordCard: {
    borderRadius: moderateScale(22),
    padding: moderateScale(16),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
    marginBottom: verticalScale(24),
  },
  keywordIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  keywordContent: {
    flex: 1,
    gap: verticalScale(4),
  },
  keywordLabel: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  keywordBadge: {
    alignSelf: 'flex-start',
    borderRadius: moderateScale(999),
    borderWidth: 1,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
  },
  keywordBadgeText: {
    fontSize: moderateScale(13),
    fontWeight: '900',
  },
  section: {
    marginBottom: verticalScale(24),
  },
  sectionTitle: {
    fontSize: moderateScale(19),
    fontWeight: '900',
    marginBottom: verticalScale(14),
    letterSpacing: -0.2,
  },
  resourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(12),
  },
  resourceCardGrid: {
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    padding: moderateScale(10),
    marginBottom: verticalScale(6),
  },
  resourceImageGrid: {
    width: '100%',
    height: verticalScale(110),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(10),
    backgroundColor: '#F3F4F6',
  },
  resourcePosterGrid: {
    width: '100%',
    height: verticalScale(110),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resourcePosterImage: {
    borderRadius: moderateScale(18),
  },
  resourcePosterOverlay: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(8),
  },
  resourcePosterBadge: {
    position: 'absolute',
    top: verticalScale(8),
    left: scale(8),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  resourcePosterBadgeText: {
    fontSize: moderateScale(8),
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
  },
  resourceLabelGrid: {
    fontSize: moderateScale(13),
    fontWeight: '900',
    lineHeight: moderateScale(18),
    marginBottom: verticalScale(2),
  },
  resourceMetaGrid: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    opacity: 0.6,
  },
  loadingCard: {
    borderRadius: moderateScale(22),
    padding: verticalScale(32),
    alignItems: 'center',
    gap: verticalScale(12),
  },
  loadingCardTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
  },
  loadingCardCopy: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  arBadge: {
    alignSelf: 'flex-start',
    borderRadius: moderateScale(4),
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    marginTop: verticalScale(4),
  },
  arBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '900',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
});
