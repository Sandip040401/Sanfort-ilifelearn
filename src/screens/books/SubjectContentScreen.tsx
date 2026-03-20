import React, {startTransition, useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {useQuery} from '@tanstack/react-query';
import {ArrowLeft, RefreshCcw} from 'lucide-react-native';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import ConceptsTab from '@/components/books/ConceptsTab';
import VideosTab from '@/components/books/VideosTab';
import EbooksTab from '@/components/books/EbooksTab';
import {BooksService} from '@/services';
import {useScreenReady} from '@/hooks/useScreenReady';
import {useTheme} from '@/theme';
import type {BooksStackParamList} from '@/types';
import {getGradeMeta, getSubjectMeta, withAlpha} from './books.data';
import {flattenTopics, getTotalVideoCount, normalizeConceptsPayload} from './books.utils';

type SubjectContentRouteProp = RouteProp<BooksStackParamList, 'SubjectContent'>;
type BooksNavigationProp = StackNavigationProp<BooksStackParamList>;

type TabKey = 'concepts' | 'videos' | 'ebooks';
const H_PAD = scale(20);

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

function SubjectContentScreenContent() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BooksNavigationProp>();
  const route = useRoute<SubjectContentRouteProp>();
  const {gradeKey, gradeName, subjectColor, subjectKey, subjectName} = route.params;
  const {width} = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<TabKey>('concepts');
  const screenReady = useScreenReady();

  const gradeMeta = getGradeMeta(gradeKey);
  const subjectMeta = getSubjectMeta(subjectKey);
  const headerColors = useMemo(
    () => (subjectMeta?.colors ?? [subjectColor, gradeMeta?.colors?.[1] ?? '#60A5FA']) as string[],
    [gradeMeta?.colors, subjectColor, subjectMeta?.colors],
  );
  const isTablet = width >= 768;
  const contentWidth = isTablet
    ? Math.min(width - H_PAD * 2, scale(920))
    : width - H_PAD * 2;

  const booksQuery = useQuery({
    queryKey: ['books-content', gradeKey, subjectKey],
    queryFn: async () => {
      const response = await BooksService.getConceptsForHome(gradeKey, subjectKey);
      return normalizeConceptsPayload(response.data?.data ?? response.data, {
        gradeKey,
        gradeName,
        subjectKey,
        subjectName,
        subjectColor,
      });
    },
  });

  const stats = useMemo(() => {
    if (!booksQuery.data) {
      return {
        concepts: 0,
        videos: 0,
        ebooks: 0,
      };
    }

    return {
      concepts: flattenTopics(
        booksQuery.data.concepts,
        subjectColor,
        booksQuery.data.arSheets,
      ).length,
      videos: getTotalVideoCount(booksQuery.data.videoVolumes),
      ebooks: booksQuery.data.ebooks.reduce(
        (total, ebook) => total + ebook.volumes.length,
        0,
      ),
    };
  }, [booksQuery.data, subjectColor]);

  const tabs = useMemo(
    () => [
      {key: 'concepts' as const, label: 'Concepts', count: stats.concepts},
      {key: 'videos' as const, label: 'Videos', count: stats.videos},
      {key: 'ebooks' as const, label: 'Ebooks', count: stats.ebooks},
    ],
    [stats.concepts, stats.ebooks, stats.videos],
  );

  const accent = subjectColor;
  const subjectDisplayName = booksQuery.data?.subject.name || subjectName;
  const contentBottomInset = insets.bottom + verticalScale(24);
  const activeTabButtonStyle: ViewStyle = useMemo(
    () => ({
      backgroundColor: accent,
      borderColor: accent,
    }),
    [accent],
  );
  const activeCountStyle: ViewStyle = useMemo(
    () => ({
      backgroundColor: accent,
    }),
    [accent],
  );
  const activeCountTextStyle: TextStyle = useMemo(
    () => ({
      color: '#fff',
    }),
    [],
  );
  const inactiveCountStyle: ViewStyle = useMemo(
    () => ({
      backgroundColor: withAlpha(colors.text, 0.18),
    }),
    [colors.text],
  );
  const inactiveCountTextStyle: TextStyle = useMemo(
    () => ({
      color: colors.text,
    }),
    [colors.text],
  );
  const inactiveTabTextStyle: TextStyle = useMemo(
    () => ({
      color: colors.text,
      opacity: 0.8,
    }),
    [colors.text],
  );
  const heroPaddingStyle: ViewStyle = useMemo(
    () => ({
      paddingTop: insets.top + verticalScale(12),
    }),
    [insets.top],
  );
  const heroSectionWidthStyle: ViewStyle = useMemo(
    () => ({
      width: '100%',
      alignSelf: 'stretch',
    }),
    [],
  );
  const heroInnerWidthStyle: ViewStyle = useMemo(
    () => ({
      width: contentWidth,
      alignSelf: 'center',
    }),
    [contentWidth],
  );
  const tabsShellStyle: ViewStyle = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderColor: colors.border,
    }),
    [colors.border, colors.surface],
  );
  const refreshContent = () => {
    booksQuery.refetch();
  };
  const handleTabPress = useCallback(
    (tabKey: TabKey) => {
      if (tabKey === activeTab) {
        return;
      }

      startTransition(() => {
        setActiveTab(tabKey);
      });
    },
    [activeTab],
  );
  const headerContent = useMemo(
    () => (
      <>
        <View style={[styles.heroSection, heroPaddingStyle, heroSectionWidthStyle]}>
          <LinearGradient
            colors={headerColors}
            locations={[0, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.heroInner, heroInnerWidthStyle]}>
            <View style={styles.heroTopRow}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.heroIconButton}>
                <ArrowLeft size={moderateScale(20)} color="#fff" strokeWidth={2.2} />
              </Pressable>

              <View style={styles.heroPill}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.heroPillText}>
                  {gradeName}
                </Text>
              </View>
            </View>

            <Text allowFontScaling={false} style={styles.heroEyebrow}>
              {subjectMeta?.badge || 'Live subject library'}
            </Text>
            <Text style={styles.heroTitle}>{subjectDisplayName}</Text>
            <Text style={styles.heroSubtitle}>
              Browse concepts, guided video lessons and ebooks from one focused learning space.
            </Text>

            {/* <View style={[styles.summaryRow, isTablet && styles.summaryRowTablet]}>
              {tabs.map(tab => (
                <View key={tab.key} style={styles.summaryCard}>
                  <Text allowFontScaling={false} style={styles.summaryValue}>
                    {tab.count}
                  </Text>
                  <Text allowFontScaling={false} style={styles.summaryLabel}>
                    {tab.label}
                  </Text>
                </View>
              ))}
            </View> */}
          </View>
          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View style={[styles.toolbarWrap, heroInnerWidthStyle]}>
          <View style={[styles.tabsShell, tabsShellStyle]}>
            {tabs.map(tab => {
              const selected = activeTab === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  style={[
                    styles.tabButton,
                    selected ? activeTabButtonStyle : styles.tabButtonIdle,
                  ]}>
                  <View style={styles.tabButtonContent}>
                    <View
                      style={[
                        styles.tabCount,
                        selected ? activeCountStyle : inactiveCountStyle,
                      ]}>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.tabCountText,
                        selected ? activeCountTextStyle : inactiveCountTextStyle,
                      ]}>
                      {tab.count}
                    </Text>
                  </View>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.tabText,
                      selected
                        ? {color: '#fff'}
                        : inactiveTabTextStyle,
                    ]}>
                    {tab.label}
                  </Text>
                </View>
                </Pressable>
              );
            })}
          </View>

          <Text allowFontScaling={false} style={[styles.toolbarHint, {color: colors.textSecondary}]}>
            Pull to refresh inside the active tab
          </Text>
        </View>
      </>
    ),
    [
      accent,
      activeCountStyle,
      activeTab,
      activeTabButtonStyle,
      colors.text,
      colors.textSecondary,
      gradeName,
      headerColors,
      heroInnerWidthStyle,
      heroPaddingStyle,
      heroSectionWidthStyle,
      handleTabPress,
      inactiveCountStyle,
      inactiveCountTextStyle,
      inactiveTabTextStyle,
      isTablet,
      navigation,
      subjectDisplayName,
      subjectMeta?.badge,
      tabs,
      tabsShellStyle,
    ],
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <View style={styles.contentArea}>
        {booksQuery.isPending ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.stateTitle, {color: colors.text}]}>Loading subject content…</Text>
            <Text style={[styles.stateSubtitle, {color: colors.textSecondary}]}>
              Fetching concepts, videos and ebook volumes.
            </Text>
          </View>
        ) : booksQuery.isError ? (
          <View style={styles.centerState}>
            <View style={[styles.retryIconWrap, {backgroundColor: withAlpha(accent, 0.10)}]}>
              <RefreshCcw size={moderateScale(26)} color={accent} strokeWidth={2} />
            </View>
            <Text style={[styles.stateTitle, {color: colors.text}]}>Unable to load this subject</Text>
            <Text style={[styles.stateSubtitle, {color: colors.textSecondary}]}>
              Try again to refetch content for {subjectName.toLowerCase()}.
            </Text>

            <Pressable
              onPress={() => booksQuery.refetch()}
              style={[styles.retryButton, {backgroundColor: accent}]}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : !screenReady ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.stateTitle, {color: colors.text}]}>Preparing this screen…</Text>
            <Text style={[styles.stateSubtitle, {color: colors.textSecondary}]}>
              Finalizing the layout before showing the subject library.
            </Text>
          </View>
        ) : activeTab === 'concepts' ? (
          <ConceptsTab
            data={booksQuery.data}
            subjectColor={accent}
            bottomInset={contentBottomInset}
            headerContent={headerContent}
            refreshing={booksQuery.isRefetching}
            onRefresh={refreshContent}
            onSelectTopic={topic =>
              navigation.navigate('TopicDetail', {
                topic,
                subjectColor: accent,
                subjectName: subjectDisplayName,
                gradeName: booksQuery.data.grade.name || gradeName,
              })
            }
          />
        ) : activeTab === 'videos' ? (
          <VideosTab
            videoVolumes={booksQuery.data.videoVolumes}
            accentColor={accent}
            bottomInset={contentBottomInset}
            headerContent={headerContent}
            refreshing={booksQuery.isRefetching}
            onRefresh={refreshContent}
          />
        ) : (
          <EbooksTab
            ebooks={booksQuery.data.ebooks}
            // arSheets={booksQuery.data.arSheets}
            accentColor={accent}
            bottomInset={contentBottomInset}
            headerContent={headerContent}
            refreshing={booksQuery.isRefetching}
            onRefresh={refreshContent}
          />
        )}
      </View>
    </View>
  );
}

export default function SubjectContentScreen() {
  return (
    <ScreenErrorBoundary>
      <SubjectContentScreenContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroSection: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(24),
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroInner: {
    alignSelf: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: verticalScale(8),
    marginBottom: verticalScale(12),
  },
  heroIconButton: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroPill: {
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    maxWidth: '65%',
    flexShrink: 1,
  },
  heroPillText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#fff',
  },
  heroEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.74)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(6),
  },
  heroTitle: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#fff',
    lineHeight: moderateScale(32),
    marginBottom: verticalScale(4),
  },
  heroSubtitle: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.82)',
    lineHeight: moderateScale(18),
    maxWidth: '94%',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(20),
  },
  summaryRowTablet: {
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  summaryValue: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#fff',
  },
  summaryLabel: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.75)',
  },
  toolbarWrap: {
    alignSelf: 'center',
    paddingTop: verticalScale(14),
  },
  tabsShell: {
    flexDirection: 'row',
    padding: scale(6),
    gap: scale(6),
    borderRadius: moderateScale(22),
    borderWidth: 1,
  },
  toolbarHint: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
  tabButton: {
    flex: 1,
    minHeight: verticalScale(44),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(6),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  tabButtonContent: {
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(2),
  },
  tabButtonIdle: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
  },
  tabCount: {
    minWidth: scale(22),
    height: verticalScale(18),
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: {
    fontSize: moderateScale(9),
    fontWeight: '800',
    color: '#fff',
  },
  contentArea: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  stateTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    textAlign: 'center',
    maxWidth: scale(260),
  },
  retryIconWrap: {
    width: scale(58),
    height: scale(58),
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    marginTop: verticalScale(18),
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(12),
  },
  retryButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: '#fff',
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
});
