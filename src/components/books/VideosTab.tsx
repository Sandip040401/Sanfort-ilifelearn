import React, {startTransition, useMemo, useState} from 'react';
import {
  FlatList,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronRight, Clapperboard, PlayCircle} from 'lucide-react-native';
import {useTheme} from '@/theme';
import type {VideoVolume} from '@/types';
import MediaViewer, {type MediaViewerPayload} from '@/components/MediaViewer';
import {withAlpha} from '@/screens/books/books.data';
import {getTotalVideoCount} from '@/screens/books/books.utils';
import {getYouTubeThumbnailUrl, isYouTubeUrl} from '@/utils/video';

const PAGE_SIZE = 8;

export default function VideosTab({
  videoVolumes,
  accentColor,
  bottomInset,
  headerContent,
  refreshing,
  onRefresh,
}: {
  videoVolumes: VideoVolume[];
  accentColor: string;
  bottomInset: number;
  headerContent?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const {colors} = useTheme();
  const {width} = useWindowDimensions();
  const [selectedVolumeId, setSelectedVolumeId] = useState<'all' | string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedMedia, setSelectedMedia] = useState<MediaViewerPayload | null>(null);
  const isTablet = width >= 768;
  const activeFilterTextStyle = styles.filterChipTextActive;
  const inactiveFilterTextStyle = useMemo(
    () => [styles.filterChipText, {color: colors.textSecondary}],
    [colors.textSecondary],
  );
  const accentFilterTextStyle = useMemo(
    () => [styles.filterChipText, {color: accentColor}],
    [accentColor],
  );

  const cards = useMemo(() => {
    const sourceVolumes = selectedVolumeId === 'all'
      ? videoVolumes
      : videoVolumes.filter(volume => volume.id === selectedVolumeId);

    return sourceVolumes.flatMap(volume =>
      volume.topics.map((topic, index) => ({
        id: `${volume.id}-${topic.id}-${index}`,
        title: topic.title,
        volumeId: volume.id,
        volumeTitle: volume.title,
        videos: topic.videos,
      })),
    );
  }, [selectedVolumeId, videoVolumes]);

  const totalVideoCount = useMemo(() => getTotalVideoCount(videoVolumes), [videoVolumes]);
  const visibleCards = useMemo(
    () => cards.slice(0, visibleCount),
    [cards, visibleCount],
  );

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cards.length, selectedVolumeId]);

  const handleEndReached = () => {
    if (visibleCount >= cards.length) {
      return;
    }

    setVisibleCount(current => Math.min(current + PAGE_SIZE, cards.length));
  };
  const handleVolumeSelect = (volumeId: 'all' | string) => {
    if (selectedVolumeId === volumeId) {
      return;
    }

    startTransition(() => {
      setSelectedVolumeId(volumeId);
    });
  };

  return (
    <>
      <FlatList
        data={visibleCards}
        keyExtractor={item => item.id}
        numColumns={isTablet ? 2 : 1}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.45}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor="#FFFFFF"
          />
        }
        contentContainerStyle={[
          styles.contentContainer,
          {paddingBottom: bottomInset + verticalScale(24)},
        ]}
        columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {headerContent}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, {color: colors.text}]}>Video Lessons</Text>
              <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
                Watch guided explanations for each volume and topic.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filtersRow}>
                <Pressable
                  onPress={() => handleVolumeSelect('all')}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        selectedVolumeId === 'all'
                          ? accentColor
                          : withAlpha(accentColor, 0.08),
                      borderColor:
                        selectedVolumeId === 'all'
                          ? accentColor
                          : withAlpha(accentColor, 0.16),
                    },
                  ]}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={selectedVolumeId === 'all' ? activeFilterTextStyle : accentFilterTextStyle}>
                    All Videos ({totalVideoCount})
                  </Text>
                </Pressable>

                {videoVolumes.map(volume => {
                  const selected = selectedVolumeId === volume.id;
                  const count = volume.topics.reduce(
                    (total, topic) => total + topic.videos.length,
                    0,
                  );

                  return (
                    <Pressable
                      key={volume.id}
                      onPress={() => handleVolumeSelect(volume.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selected ? accentColor : colors.surface,
                          borderColor: selected ? accentColor : colors.border,
                        },
                      ]}>
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={selected ? activeFilterTextStyle : inactiveFilterTextStyle}>
                        {volume.title} ({count})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, {backgroundColor: colors.surface}]}>
            <View style={[styles.emptyIconWrap, {backgroundColor: withAlpha(accentColor, 0.10)}]}>
              <Clapperboard size={moderateScale(26)} color={accentColor} strokeWidth={2} />
            </View>
            <Text style={[styles.emptyTitle, {color: colors.text}]}>No video lessons yet</Text>
            <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
              Videos will appear here once this subject has published lessons.
            </Text>
          </View>
        }
        renderItem={({item}) => {
          const primaryVideo = item.videos[0];
          const posterUrl = primaryVideo ? getYouTubeThumbnailUrl(primaryVideo) : null;
          const youtubeVideo = primaryVideo ? isYouTubeUrl(primaryVideo) : false;

          return (
            <Pressable
              onPress={() => {
                if (primaryVideo) {
                  setSelectedMedia({
                    type: 'video',
                    url: primaryVideo,
                    title: item.title,
                  });
                }
              }}
              style={({pressed}) => [
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: withAlpha(accentColor, 0.14),
                  opacity: pressed ? 0.96 : 1,
                  marginHorizontal: isTablet ? 0 : scale(20),
                },
              ]}>
              {posterUrl ? (
                <ImageBackground
                  source={{uri: posterUrl}}
                  resizeMode="cover"
                  style={styles.poster}
                  imageStyle={styles.posterImage}>
                  <LinearGradient
                    colors={['rgba(15,23,42,0.10)', 'rgba(15,23,42,0.78)']}
                    locations={[0, 1]}
                    style={styles.posterOverlay}>
                    <View style={[styles.posterTypeBadge, styles.posterTypeBadgeDark]}>
                      <Text allowFontScaling={false} style={styles.posterTypeBadgeText}>
                        {youtubeVideo ? 'YouTube' : 'Video'}
                      </Text>
                    </View>

                    <View style={styles.posterPlayButton}>
                      <PlayCircle size={moderateScale(38)} color="#fff" strokeWidth={1.8} />
                    </View>

                    <View style={styles.posterFooterRow}>
                      <Text allowFontScaling={false} style={styles.posterHint}>
                        Tap to watch full lesson
                      </Text>
                      <View style={styles.posterBadge}>
                        <Text allowFontScaling={false} style={styles.posterBadgeText}>
                          {item.videos.length} videos
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              ) : (
                <LinearGradient
                  colors={['#111827', '#1F2937']}
                  locations={[0, 1]}
                  style={styles.poster}>
                  <View style={styles.posterOverlay}>
                    <View style={[styles.posterTypeBadge, {backgroundColor: withAlpha(accentColor, 0.92)}]}>
                      <Text allowFontScaling={false} style={styles.posterTypeBadgeText}>
                        Lesson
                      </Text>
                    </View>
                    <View style={styles.posterPlayButton}>
                      <PlayCircle size={moderateScale(42)} color="#fff" strokeWidth={1.8} />
                    </View>
                    <View style={styles.posterFooterRow}>
                      <Text allowFontScaling={false} style={styles.posterHint}>
                        Tap to watch full lesson
                      </Text>
                      <View style={styles.posterBadge}>
                        <Text allowFontScaling={false} style={styles.posterBadgeText}>
                          {item.videos.length} videos
                        </Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              )}

              <Text allowFontScaling={false} style={[styles.cardEyebrow, {color: accentColor}]}>
                {item.volumeTitle}
              </Text>
              <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.cardFooter}>
                <Text allowFontScaling={false} style={[styles.cardMeta, {color: colors.textSecondary}]}>
                  {youtubeVideo ? 'Open in YouTube-style player' : 'Tap to watch lesson'}
                </Text>
                <ChevronRight size={moderateScale(18)} color={accentColor} strokeWidth={2.4} />
              </View>
            </Pressable>
          );
        }}
      />

      <MediaViewer media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 0,
  },
  listHeader: {
    marginBottom: verticalScale(14),
  },
  sectionBlock: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(18),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  sectionSubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    marginBottom: verticalScale(16),
  },
  filtersRow: {
    gap: scale(8),
    paddingRight: scale(20),
  },
  filterChip: {
    borderRadius: moderateScale(999),
    borderWidth: 1,
    minHeight: verticalScale(46),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  filterChipTextActive: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },
  columnWrapper: {
    gap: scale(12),
  },
  card: {
    flex: 1,
    minHeight: verticalScale(248),
    borderRadius: moderateScale(22),
    padding: moderateScale(14),
    borderWidth: 1,
    marginBottom: verticalScale(12),
  },
  poster: {
    height: verticalScale(172),
    borderRadius: moderateScale(18),
    marginBottom: verticalScale(12),
    overflow: 'hidden',
  },
  posterImage: {
    borderRadius: moderateScale(18),
  },
  posterOverlay: {
    flex: 1,
    padding: moderateScale(12),
    justifyContent: 'space-between',
  },
  posterTypeBadge: {
    alignSelf: 'flex-start',
    minHeight: verticalScale(28),
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterTypeBadgeDark: {
    backgroundColor: 'rgba(15,23,42,0.78)',
  },
  posterTypeBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  posterPlayButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  posterHint: {
    flex: 1,
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  cardEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: verticalScale(6),
  },
  posterBadge: {
    minHeight: verticalScale(28),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(15,23,42,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
  },
  cardTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(6),
  },
  cardMeta: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: verticalScale(10),
    paddingTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: verticalScale(32),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(22),
  },
  emptyIconWrap: {
    width: scale(56),
    height: scale(56),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  emptySubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    textAlign: 'center',
  },
});
