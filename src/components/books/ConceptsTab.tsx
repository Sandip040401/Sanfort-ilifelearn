import React, { startTransition, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import {
  BookOpen,
  Box,
  ChevronRight,
  Images,
  PlayCircle,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import type { ConceptsResponse, FlatTopic } from '@/types';
import { flattenTopics } from '@/screens/books/books.utils';
import { withAlpha } from '@/screens/books/books.data';
import { useTabBarHideOnScroll } from '@/navigation/useTabBarHideOnScroll';

const PAGE_SIZE = 10;

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

type ConceptsTabProps = {
  data: ConceptsResponse;
  subjectColor: string;
  bottomInset: number;
  headerContent?: React.ReactNode;
  tabBarContent?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectTopic: (topic: FlatTopic) => void;
  filterPrefix?: string;
};

export default function ConceptsTab({
  data,
  subjectColor,
  bottomInset,
  headerContent,
  tabBarContent,
  refreshing,
  onRefresh,
  onSelectTopic,
  filterPrefix = 'Vol',
}: ConceptsTabProps) {
  const { colors, isDark } = useTheme();
  const { onScroll } = useTabBarHideOnScroll();
  const [selectedVolume, setSelectedVolume] = useState<'all' | number>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const activeFilterTextStyle = useMemo(
    () => [styles.filterChipTextActive, { color: '#fff' }],
    [],
  );
  const inactiveFilterTextStyle = useMemo(
    () => [styles.filterChipText, { color: colors.text }],
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
        { paddingBottom: bottomInset + verticalScale(24) },
      ]}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          {headerContent}
          {tabBarContent}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Concepts & Topics
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Open any topic to preview concept sheets, videos and linked worksheets.
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
        <View style={[styles.emptyState, { backgroundColor: colors.surface }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: withAlpha(subjectColor, 0.10) }]}>
            <BookOpen size={moderateScale(26)} color={subjectColor} strokeWidth={2} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No topics yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            This subject does not have concept topics for the selected volume.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onSelectTopic(item)}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : withAlpha(subjectColor, 0.2),
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              marginHorizontal: scale(20),
            },
          ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardOverline, { color: subjectColor }]} numberOfLines={1}>
              {item.conceptTitle}
            </Text>
            {!!item.keyword && (
              <View style={[styles.keywordBadge, { backgroundColor: getKeywordStyles(item.keyword).bg, borderColor: getKeywordStyles(item.keyword).border }]}>
                 <Text style={[styles.keywordBadgeText, { color: getKeywordStyles(item.keyword).text }]} numberOfLines={1}>
                    {item.keyword}
                 </Text>
              </View>
            )}
          </View>
          
          <View style={styles.cardBody}>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              
              {(item.images.length > 0 || item.videos.length > 0 || !!item.ar?.length) && (
                <View style={styles.metricsRow}>
                  {item.images.length > 0 && (
                    <View style={[styles.metricPill, { backgroundColor: withAlpha(subjectColor, 0.08), borderColor: withAlpha(subjectColor, 0.16) }]}>
                      <Images size={moderateScale(12)} color={subjectColor} strokeWidth={2.2} />
                      <Text allowFontScaling={false} style={[styles.metricText, { color: subjectColor }]}>
                        {item.images.length} Concept Sheet{item.images.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {item.videos.length > 0 && (
                    <View style={styles.metricPillBlue}>
                      <PlayCircle size={moderateScale(12)} color="#2563EB" strokeWidth={2.2} />
                      <Text allowFontScaling={false} style={styles.metricTextBlue}>
                        {item.videos.length} Video{item.videos.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {item.ar && item.ar.length > 0 && (
                    <View style={[styles.metricPill, { backgroundColor: withAlpha('#7C3AED', 0.08), borderColor: withAlpha('#7C3AED', 0.16) }]}>
                      <Box size={moderateScale(12)} color="#7C3AED" strokeWidth={2.2} />
                      <Text allowFontScaling={false} style={styles.metricTextPurple}>
                        AR
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={[styles.openIconWrap, { backgroundColor: withAlpha(subjectColor, 0.1) }]}>
              <ChevronRight size={moderateScale(20)} color={subjectColor} strokeWidth={2.5} />
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
    borderRadius: moderateScale(18),
    borderWidth: 1,
    padding: moderateScale(14),
    marginBottom: verticalScale(10),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
    gap: scale(8),
  },
  cardOverline: {
    flex: 1,
    fontSize: moderateScale(10),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(16),
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(10),
  },
  metricsRow: {
    flexDirection: 'row',
    gap: scale(8),
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    borderWidth: 1,
  },
  metricPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    backgroundColor: 'rgba(37,99,235,0.08)',
    borderColor: 'rgba(37,99,235,0.18)',
  },
  metricText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  metricTextBlue: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#2563EB',
  },
  metricTextPurple: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#7C3AED',
  },
  keywordBadge: {
    borderRadius: moderateScale(6),
    borderWidth: 1,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
  },
  keywordBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  openIconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
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
