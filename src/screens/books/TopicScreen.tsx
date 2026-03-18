import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  Tag,
} from 'lucide-react-native';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import MediaViewer, {type MediaViewerPayload} from '@/components/MediaViewer';
import {useScreenReady} from '@/hooks/useScreenReady';
import {useTheme} from '@/theme';
import type {BooksStackParamList} from '@/types';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';
import {withAlpha} from './books.data';
import {getYouTubeThumbnailUrl, isYouTubeUrl} from '@/utils/video';

type TopicRouteProp = RouteProp<BooksStackParamList, 'TopicDetail'>;
type TopicNavigationProp = StackNavigationProp<BooksStackParamList>;

type ResourceKind = 'image' | 'video' | 'document';

const getContrastText = (hex: string, light = '#fff', dark = '#111827') => {
  const raw = (hex || '').replace('#', '').trim();
  if (!raw) return light;
  const value = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw;
  if (value.length !== 6) return light;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return light;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L =
    0.2126 * toLinear(r) +
    0.7152 * toLinear(g) +
    0.0722 * toLinear(b);
  const contrastLight = (1.05) / (L + 0.05);
  const contrastDark = (L + 0.05) / 0.05;
  return contrastDark > contrastLight ? dark : light;
};

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

function TopicScreenContent() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const navigation = useNavigation<TopicNavigationProp>();
  const route = useRoute<TopicRouteProp>();
  const {topic, subjectColor, subjectName, gradeName} = route.params;
  const [selectedMedia, setSelectedMedia] = useState<MediaViewerPayload | null>(null);
  const screenReady = useScreenReady();
  const safeAccent = subjectColor && subjectColor.startsWith('#')
    ? subjectColor
    : colors.primary || '#F97316';
  const headerTextColor = getContrastText(safeAccent);
  const headerSubTextColor = withAlpha(headerTextColor, 0.82);
  const headerBadgeBg = headerTextColor === '#fff'
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(0,0,0,0.10)';
  const headerBadgeBorder = headerTextColor === '#fff'
    ? 'rgba(255,255,255,0.22)'
    : 'rgba(0,0,0,0.18)';
  const quickStatBg = withAlpha(headerTextColor, 0.14);
  const quickStatBorder = withAlpha(headerTextColor, 0.18);
  const quickStatLabelColor = withAlpha(headerTextColor, 0.75);
  const bottomContentInset = insets.bottom + verticalScale(24);
  const safeTopic = {
    ...topic,
    title: topic?.title ?? 'Topic',
    conceptTitle: topic?.conceptTitle ?? 'Concept',
    volumeNumber: topic?.volumeNumber ?? 0,
    images: Array.isArray(topic?.images) ? topic.images : [],
    videos: Array.isArray(topic?.videos) ? topic.videos : [],
    arSheets: Array.isArray(topic?.arSheets) ? topic.arSheets : [],
    keyword: topic?.keyword ?? '',
  };

  const renderResourceSection = (
    title: string,
    items: string[],
    kind: ResourceKind,
  ) => {
    if (!items.length) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: colors.text}]}>
          {title} ({items.length})
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.resourcesRow}>
          {items.map((item, index) => {
            const thumbnailUrl = kind === 'video' ? getYouTubeThumbnailUrl(item) : null;
            const label =
              kind === 'image' || kind === 'video'
                ? `${safeTopic.title} ${index + 1}`
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
                  styles.resourceCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: withAlpha(safeAccent, 0.14),
                  },
                ]}>
                {kind === 'image' ? (
                  <Image source={{uri: item}} resizeMode="cover" style={styles.resourceImage} />
                ) : kind === 'video' && thumbnailUrl ? (
                  <ImageBackground
                    source={{uri: thumbnailUrl}}
                    resizeMode="cover"
                    style={styles.resourcePoster}
                    imageStyle={styles.resourcePosterImage}>
                    <LinearGradient
                      colors={['rgba(15,23,42,0.08)', 'rgba(15,23,42,0.72)']}
                      locations={[0, 1]}
                      style={styles.resourcePosterOverlay}>
                      <View style={styles.resourcePosterBadge}>
                        <Text allowFontScaling={false} style={styles.resourcePosterBadgeText}>
                          {isYouTubeUrl(item) ? 'YouTube' : 'Video'}
                        </Text>
                      </View>
                      <PlayCircle size={moderateScale(36)} color="#fff" strokeWidth={1.8} />
                    </LinearGradient>
                  </ImageBackground>
                ) : (
                  <LinearGradient
                    colors={[withAlpha(safeAccent, 0.18), withAlpha(safeAccent, 0.06)]}
                    locations={[0, 1]}
                    style={styles.resourcePoster}>
                    {kind === 'video' ? (
                      <PlayCircle size={moderateScale(36)} color={safeAccent} strokeWidth={1.8} />
                    ) : (
                      <FileText size={moderateScale(30)} color={safeAccent} strokeWidth={1.8} />
                    )}
                  </LinearGradient>
                )}

                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.resourceLabel, {color: colors.text}]}>
                  {label}
                </Text>
                <Text allowFontScaling={false} style={[styles.resourceMeta, {color: colors.textSecondary}]}>
                  Tap to open
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <>
      <View style={[styles.root, {backgroundColor: safeAccent}]}>
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
          <View style={[styles.headerOuter, {paddingTop: insets.top + verticalScale(12)}]}>
            <LinearGradient
              colors={[safeAccent, withAlpha(safeAccent, 0.74)]}
              locations={[0, 1]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={StyleSheet.absoluteFillObject}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.goBack()}
              style={[
                styles.backButton,
                {backgroundColor: headerBadgeBg, borderColor: headerBadgeBorder},
              ]}>
              <ArrowLeft size={moderateScale(20)} color={headerTextColor} strokeWidth={2.2} />
            </TouchableOpacity>

            <Text style={[styles.eyebrow, {color: quickStatLabelColor}]}>
              {gradeName} • {subjectName}
            </Text>
            <Text style={[styles.headerTitle, {color: headerTextColor}]}>{safeTopic.title}</Text>
            <Text style={[styles.headerSubtitle, {color: headerSubTextColor}]}>
              {safeTopic.conceptTitle} • Volume {safeTopic.volumeNumber}
            </Text>

            {/* Quick stats removed as requested */}
            <View style={[styles.curve, {backgroundColor: colors.background}]} />
          </View>

          <View style={styles.content}>
            {!screenReady ? (
              <View style={[styles.loadingCard, {backgroundColor: colors.surface}]}>
                <ActivityIndicator size="small" color={safeAccent} />
                <Text style={[styles.loadingCardTitle, {color: colors.text}]}>
                  Preparing topic preview…
                </Text>
                <Text style={[styles.loadingCardCopy, {color: colors.textSecondary}]}>
                  Images, videos and worksheets will appear once the transition completes.
                </Text>
              </View>
            ) : (
              <>
                {!!safeTopic.keyword && (
                  <View
                    style={[
                      styles.keywordCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: withAlpha(safeAccent, 0.14),
                      },
                    ]}>
                    <View style={[styles.keywordIconWrap, {backgroundColor: withAlpha(safeAccent, 0.10)}]}>
                      <Tag size={moderateScale(18)} color={safeAccent} strokeWidth={2} />
                    </View>
                    <View style={styles.keywordContent}>
                      <Text style={[styles.keywordLabel, {color: colors.textSecondary}]}>Keyword</Text>
                      <Text style={[styles.keywordValue, {color: colors.text}]}>{safeTopic.keyword}</Text>
                    </View>
                  </View>
                )}

              

                {renderResourceSection('Images', safeTopic.images, 'image')}
                {renderResourceSection('Videos', safeTopic.videos, 'video')}
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
  },
  backButton: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: verticalScale(18),
  },
  eyebrow: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(8),
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(6),
  },
  headerSubtitle: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.82)',
  },
  quickStats: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(18),
  },
  quickStatCard: {
    flex: 1,
    borderRadius: moderateScale(18),
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  quickStatValue: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#fff',
  },
  quickStatLabel: {
    marginTop: verticalScale(3),
    fontSize: moderateScale(10),
  },
  curve: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: verticalScale(18),
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
  },
  content: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(18),
  },
  keywordCard: {
    borderRadius: moderateScale(22),
    padding: moderateScale(16),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginBottom: verticalScale(18),
  },
  keywordIconWrap: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  keywordContent: {
    flex: 1,
  },
  keywordLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(4),
  },
  keywordValue: {
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
  section: {
    marginBottom: verticalScale(18),
  },
  sectionTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginBottom: verticalScale(12),
  },
  resourcesRow: {
    gap: scale(12),
  },
  resourceCard: {
    width: scale(168),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    padding: moderateScale(12),
  },
  resourceImage: {
    width: '100%',
    height: verticalScale(120),
    borderRadius: moderateScale(16),
    marginBottom: verticalScale(12),
    backgroundColor: '#E5E7EB',
  },
  resourcePoster: {
    width: '100%',
    height: verticalScale(120),
    borderRadius: moderateScale(16),
    marginBottom: verticalScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourcePosterImage: {
    borderRadius: moderateScale(16),
  },
  resourcePosterOverlay: {
    flex: 1,
    borderRadius: moderateScale(16),
    padding: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourcePosterBadge: {
    position: 'absolute',
    top: verticalScale(10),
    left: scale(10),
    minHeight: verticalScale(24),
    paddingHorizontal: scale(8),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourcePosterBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resourceLabel: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  resourceMeta: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  loadingCard: {
    borderRadius: moderateScale(22),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(20),
    alignItems: 'center',
    gap: verticalScale(8),
  },
  loadingCardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
  loadingCardCopy: {
    textAlign: 'center',
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
});
