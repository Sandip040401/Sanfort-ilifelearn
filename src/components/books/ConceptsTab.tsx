import React, {startTransition, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Images,
  PlayCircle,
} from 'lucide-react-native';
import {useTheme} from '@/theme';
import type {ConceptsResponse, FlatTopic} from '@/types';
import {flattenTopics} from '@/screens/books/books.utils';
import {withAlpha} from '@/screens/books/books.data';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';

const PAGE_SIZE = 10;

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

export default function ConceptsTab({
  data,
  subjectColor,
  bottomInset,
  headerContent,
  refreshing,
  onRefresh,
  onSelectTopic,
  filterPrefix,
}: {
  data: ConceptsResponse;
  subjectColor: string;
  bottomInset: number;
  headerContent?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectTopic: (topic: FlatTopic) => void;
  filterPrefix?: string;
}) {
  const {colors, isDark} = useTheme();
  const {onScroll} = useTabBarHideOnScroll();
  const [selectedVolume, setSelectedVolume] = useState<'all' | number>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const accentTextColor = useMemo(
    () => getContrastText(subjectColor),
    [subjectColor],
  );
  const activeFilterTextStyle = useMemo(
    () => [styles.filterChipTextActive, {color: '#fff'}],
    [],
  );
  const inactiveFilterTextStyle = useMemo(
    () => [styles.filterChipText, {color: colors.text}],
    [colors.text],
  );

  const volumeNumbers = useMemo(
    () =>
      Array.from(new Set(data.concepts.map(concept => concept.volumeNumber)))
        .filter(Boolean)
        .sort((left, right) => left - right),
    [data.concepts],
  );

  const topics = useMemo(() => {
    const flattened = flattenTopics(data.concepts, subjectColor, data.arSheets);
    if (selectedVolume === 'all') {
      return flattened;
    }

    return flattened.filter(topic => topic.volumeNumber === selectedVolume);
  }, [data.arSheets, data.concepts, selectedVolume, subjectColor]);

  const visibleTopics = useMemo(
    () => topics.slice(0, visibleCount),
    [topics, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedVolume, topics.length]);

  const handleEndReached = () => {
    if (visibleCount >= topics.length) {
      return;
    }

    setVisibleCount(current => Math.min(current + PAGE_SIZE, topics.length));
  };
  const handleVolumeSelect = (volume: 'all' | number) => {
    if (selectedVolume === volume) {
      return;
    }

    startTransition(() => {
      setSelectedVolume(volume);
    });
  };

  return (
    <FlatList
      data={visibleTopics}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      updateCellsBatchingPeriod={16}
      removeClippedSubviews
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.45}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={subjectColor}
          colors={[subjectColor]}
          progressBackgroundColor="#FFFFFF"
        />
      }
      contentContainerStyle={[
        styles.contentContainer,
        {paddingBottom: bottomInset + verticalScale(24)},
      ]}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {headerContent}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>
              Concepts & Topics
            </Text>
            <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
              Open any topic to preview images, videos and linked worksheets.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              <Pressable
                onPress={() => handleVolumeSelect('all')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      selectedVolume === 'all'
                        ? subjectColor
                        : colors.surface,
                    borderColor:
                      selectedVolume === 'all'
                        ? subjectColor
                        : colors.border,
                  },
                ]}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={selectedVolume === 'all' ? activeFilterTextStyle : inactiveFilterTextStyle}>
                  All Weeks
                </Text>
              </Pressable>

              {volumeNumbers.map(volume => {
                const selected = selectedVolume === volume;

                return (
                  <Pressable
                    key={volume}
                    onPress={() => handleVolumeSelect(volume)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: selected ? subjectColor : colors.surface,
                        borderColor: selected ? subjectColor : colors.border,
                      },
                    ]}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={selected ? activeFilterTextStyle : inactiveFilterTextStyle}>
                      {filterPrefix || 'Vol'} {volume}
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
          <View style={[styles.emptyIconWrap, {backgroundColor: withAlpha(subjectColor, 0.10)}]}>
            <BookOpen size={moderateScale(26)} color={subjectColor} strokeWidth={2} />
          </View>
          <Text style={[styles.emptyTitle, {color: colors.text}]}>No topics yet</Text>
          <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
            This subject does not have concept topics for the selected volume.
          </Text>
        </View>
      }
      renderItem={({item, index}) => (
        <Pressable
          onPress={() => onSelectTopic(item)}
          style={({pressed}) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : withAlpha(subjectColor, 0.14),
              opacity: pressed ? 0.96 : 1,
              marginHorizontal: scale(20),
            },
        ]}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.cardOverline, {color: subjectColor}]}>
                {item.conceptTitle} • {filterPrefix || 'Vol'} {item.volumeNumber}
              </Text>
              <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.cardMeta, {color: colors.textSecondary}]}>
                Topic {index + 1}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View
              style={[
                styles.metricPill,
                styles.metricPillNeutral,
                {borderColor: withAlpha(subjectColor, 0.16)},
              ]}>
              <Images size={moderateScale(14)} color={subjectColor} strokeWidth={2} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.metricText, {color: subjectColor}]}>
                {item.images.length} images
              </Text>
            </View>

            <View style={[styles.metricPill, styles.metricPillBlue]}>
              <PlayCircle size={moderateScale(14)} color="#2563EB" strokeWidth={2} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.metricText, styles.metricTextBlue]}>
                {item.videos.length} videos
              </Text>
            </View>

            {/* Sheets metric removed */}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.footerCopy}>
              {item.keyword ? (
                <Text style={[styles.keyword, {color: colors.textSecondary}]} numberOfLines={1}>
                  Keyword:{' '}
                  <Text style={[styles.keywordValue, {color: colors.text}]}>
                    {item.keyword}
                  </Text>
                </Text>
              ) : (
                <Text style={[styles.resourceHint, {color: colors.textSecondary}]}>
                  Ready to open this topic
                </Text>
              )}
            </View>

            <View style={[styles.openButton, {backgroundColor: subjectColor}]}>
              <Text
                allowFontScaling={false}
                style={[styles.openButtonText, {color: '#fff'}]}>
                Open
              </Text>
              <ChevronRight size={moderateScale(16)} color="#fff" strokeWidth={2.4} />
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 0,
  },
  listHeader: {
    marginBottom: verticalScale(12),
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
  filterRow: {
    gap: scale(8),
    paddingRight: scale(20),
    paddingBottom: verticalScale(4),
  },
  filterChip: {
    borderRadius: moderateScale(999),
    borderWidth: 1,
    minHeight: verticalScale(46),
    paddingHorizontal: scale(16),
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
  card: {
    borderRadius: moderateScale(22),
    borderWidth: 1,
    padding: moderateScale(16),
    marginBottom: verticalScale(12),
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardOverline: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: verticalScale(4),
  },
  cardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  cardMeta: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: verticalScale(14),
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(999),
    borderWidth: 1,
  },
  metricPillNeutral: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  metricPillBlue: {
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderColor: 'rgba(37,99,235,0.18)',
  },
  metricPillAmber: {
    backgroundColor: 'rgba(217,119,6,0.08)',
    borderColor: 'rgba(217,119,6,0.18)',
  },
  metricText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  metricTextBlue: {
    color: '#2563EB',
  },
  metricTextAmber: {
    color: '#D97706',
  },
  keyword: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  keywordValue: {
    fontWeight: '700',
  },
  resourceHint: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  cardFooter: {
    marginTop: verticalScale(14),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  footerCopy: {
    flex: 1,
    minWidth: 0,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    minWidth: scale(86),
    justifyContent: 'center',
  },
  openButtonText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#fff',
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
