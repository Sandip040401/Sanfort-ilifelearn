import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {ArrowLeft, ChevronRight, Layers3} from 'lucide-react-native';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import {useTheme} from '@/theme';
import type {BooksStackParamList} from '@/types';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';
import {getGradeMeta, SUBJECT_OPTIONS, withAlpha} from './books.data';

const H_PAD = scale(20);
const CARD_GAP = scale(14);

type SubjectsRouteProp = RouteProp<BooksStackParamList, 'Subjects'>;
type BooksNavigationProp = StackNavigationProp<BooksStackParamList>;

function SubjectsScreenContent() {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const navigation = useNavigation<BooksNavigationProp>();
  const route = useRoute<SubjectsRouteProp>();
  const [refreshing, setRefreshing] = React.useState(false);
  const {gradeKey, gradeName, gradeColors} = route.params;
  const {width} = useWindowDimensions();
  const cardText = isDark ? '#1B1533' : colors.text;
  const cardSubText = isDark ? '#5B547A' : colors.textSecondary;
  const cardMetaText = isDark ? '#6B618C' : colors.textSecondary;
  const gradeMeta = getGradeMeta(gradeKey);
  const headerColors = gradeColors.length >= 2
    ? gradeColors
    : [...(gradeMeta?.colors ?? ['#2563EB', '#60A5FA'])];
  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width - scale(32), scale(920)) : width;
  const cardWidth = isTablet
    ? (contentWidth - H_PAD * 2 - CARD_GAP) / 2
    : contentWidth - H_PAD * 2;
  const isNarrowCard = cardWidth < scale(320);
  const bottomContentInset = insets.bottom + verticalScale(24);
  const cardHeight = isTablet
    ? Math.max(verticalScale(270), Math.min(verticalScale(340), cardWidth * 1.2))
    : undefined;

  const handleRefresh = () => {
    setRefreshing(true);

    // Subjects are local right now; keep pull-to-refresh ready for future API sync.
    setTimeout(() => {
      setRefreshing(false);
    }, 650);
  };

  return (
    <View style={[styles.root, {backgroundColor: headerColors[0]}]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            progressViewOffset={insets.top + verticalScale(14)}
            tintColor="#FFFFFF"
            colors={[gradeMeta?.accent ?? headerColors[0]]}
            progressBackgroundColor="#F8F5FF"
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            backgroundColor: colors.background,
            paddingBottom: bottomContentInset,
          },
        ]}>
        <View style={[styles.header, {paddingTop: insets.top + verticalScale(12)}]}>
          <LinearGradient
            colors={headerColors}
            locations={headerColors.length === 2 ? [0, 1] : [0, 0.5, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.headerInner, {width: contentWidth - H_PAD * 2}]}>
            <View style={styles.headerTopRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.goBack()}
                style={styles.backButton}>
                <ArrowLeft size={moderateScale(20)} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>

              <View style={styles.headerBadge}>
                <Layers3 size={moderateScale(16)} color="#fff" strokeWidth={2} />
                <Text style={styles.headerBadgeText}>Books Library</Text>
              </View>
            </View>

            <Text style={styles.headerEyebrow}>
              {gradeMeta?.subtitle ?? 'Learning stage'}
            </Text>
            <Text style={styles.headerTitle}>{gradeName}</Text>
            <Text style={styles.headerSubtitle}>
              Open a subject library with live concepts, lesson videos and ebook resources for this stage.
            </Text>

            {/* <View style={styles.headerStats}>
              <View style={styles.headerStatItem}>
                <Text style={styles.headerStatValue}>4</Text>
                <Text style={styles.headerStatLabel}>Subjects</Text>
              </View>
              <View style={styles.headerStatDivider} />
              <View style={styles.headerStatItem}>
                <Text style={styles.headerStatValue}>3</Text>
                <Text style={styles.headerStatLabel}>Formats</Text>
              </View>
              <View style={styles.headerStatDivider} />
              <View style={styles.headerStatItem}>
                <Text style={styles.headerStatValue}>Live</Text>
                <Text style={styles.headerStatLabel}>API Feed</Text>
              </View>
            </View> */}
          </View>

          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View style={styles.content}>
          <View style={[styles.contentInner, {width: contentWidth - H_PAD * 2}]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionEyebrow}>Learning Streams</Text>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Choose your subject</Text>
                <Text style={[styles.sectionSubtitle, {color: colors.textSecondary}]}>
                  Each subject opens a focused library for {gradeName} with concepts, videos and ebooks.
                </Text>
              </View>

              <View style={styles.sectionCountPill}>
                <Text style={styles.sectionCountText}>4 subjects</Text>
              </View>
            </View>

            <View style={[styles.grid, isTablet && styles.gridTablet]}>
            {SUBJECT_OPTIONS.map(subject => {
              const Icon = subject.icon;

                return (
                  <TouchableOpacity
                    key={subject.key}
                    activeOpacity={0.88}
                    style={[styles.subjectCardWrap, {width: cardWidth}]}
                    onPress={() =>
                      navigation.navigate('SubjectContent', {
                        gradeKey,
                        gradeName,
                        subjectKey: subject.key,
                        subjectName: subject.name,
                        subjectColor: subject.color,
                      })
                    }>
                    <View
                      style={[
                        styles.subjectCard,
                        cardHeight ? {height: cardHeight} : undefined,
                        {
                          borderColor: withAlpha(subject.color, 0.14),
                        },
                      ]}>
                    <LinearGradient
                      colors={['#FFFFFF', subject.soft]}
                      locations={[0, 1]}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.subjectTopRow}>
                      <LinearGradient
                        colors={subject.colors as unknown as string[]}
                        locations={[0, 1]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={styles.subjectIconWrap}>
                        <Icon size={moderateScale(22)} color="#fff" strokeWidth={2} />
                      </LinearGradient>

                      <View
                        style={[
                          styles.subjectArrowWrap,
                          {backgroundColor: withAlpha(subject.color, 0.10)},
                        ]}>
                        <ChevronRight size={moderateScale(18)} color={subject.color} strokeWidth={2.5} />
                      </View>
                    </View>

                    <Text style={[styles.subjectEyebrow, {color: subject.color}]}>
                      {subject.badge}
                    </Text>
                    <Text
                      style={[styles.subjectName, {color: cardText}]}
                      numberOfLines={2}
                      ellipsizeMode="tail">
                      {subject.name}
                    </Text>
                    <Text
                      style={[styles.subjectDescription, {color: cardSubText}]}
                      numberOfLines={3}
                      ellipsizeMode="tail">
                      {subject.description}
                    </Text>

                    <View
                      style={[
                        styles.subjectFooter,
                        isTablet && styles.subjectFooterFixed,
                        isNarrowCard && styles.subjectFooterCompact,
                      ]}>
                      <View
                        style={[
                          styles.subjectBadge,
                          {backgroundColor: withAlpha(subject.color, 0.10)},
                          isNarrowCard && styles.subjectBadgeCompact,
                        ]}>
                        <Text style={[styles.subjectBadgeText, {color: subject.color}]}>
                          Open {subject.shortName.toLowerCase()}
                        </Text>
                      </View>
                      <Text
                        style={[styles.subjectMeta, {color: cardMetaText}, isNarrowCard && styles.subjectMetaCompact]}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        Live content
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.subjectGlow,
                        {backgroundColor: withAlpha(subject.color, 0.08)},
                      ]}
                    />
                  </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function SubjectsScreen() {
  return (
    <ScreenErrorBoundary>
      <SubjectsScreenContent />
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
  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(28),
    alignItems: 'center',
  },
  headerInner: {
    alignSelf: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  backButton: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#fff',
  },
  headerEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.74)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: verticalScale(6),
  },
  headerTitle: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(4),
  },
  headerSubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    color: 'rgba(255,255,255,0.82)',
    maxWidth: '92%',
  },
  headerStats: {
    marginTop: verticalScale(18),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: moderateScale(18),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  headerStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#fff',
  },
  headerStatLabel: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.75)',
  },
  headerStatDivider: {
    width: 1,
    height: verticalScale(28),
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginHorizontal: scale(8),
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
    paddingTop: verticalScale(14),
    alignItems: 'center',
  },
  contentInner: {
    alignSelf: 'center',
  },
  sectionHeader: {
    marginBottom: verticalScale(18),
  },
  sectionCopy: {
    marginBottom: verticalScale(10),
  },
  sectionEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: '#6D5BAA',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: verticalScale(4),
  },
  sectionCountPill: {
    alignSelf: 'flex-start',
    borderRadius: moderateScale(999),
    backgroundColor: '#F3EEFF',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderWidth: 1,
    borderColor: '#E7DDFF',
  },
  sectionCountText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#5B34F2',
  },
  sectionTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  sectionSubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  grid: {
    flexDirection: 'column',
    paddingTop: verticalScale(4),
  },
  gridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  subjectCardWrap: {
    marginBottom: CARD_GAP,
  },
  subjectCard: {
    minHeight: verticalScale(196),
    borderRadius: moderateScale(22),
    padding: moderateScale(18),
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#28145B',
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(14),
    shadowOffset: {width: 0, height: verticalScale(8)},
  },
  subjectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(14),
  },
  subjectIconWrap: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectArrowWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectEyebrow: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: verticalScale(8),
  },
  subjectName: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(8),
  },
  subjectDescription: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    flex: 1,
  },
  subjectFooter: {
    marginTop: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(8),
  },
  subjectFooterFixed: {
    marginTop: 'auto',
  },
  subjectFooterCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: verticalScale(8),
  },
  subjectBadge: {
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(7),
  },
  subjectBadgeCompact: {
    alignSelf: 'flex-start',
  },
  subjectBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  subjectMeta: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    flexShrink: 1,
  },
  subjectMetaCompact: {
    alignSelf: 'flex-start',
  },
  subjectGlow: {
    position: 'absolute',
    width: scale(108),
    height: scale(108),
    borderRadius: scale(54),
    top: verticalScale(-26),
    right: scale(-24),
  },
});
