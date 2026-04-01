import React from 'react';
import {
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
import type {BooksStackParamList, SubjectBookSummary} from '@/types';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';
import {TAB_BAR_HEIGHT} from '@/navigation/CustomTabBar';
import {getGradeMeta, withAlpha} from './books.data';

const H_PAD = scale(20);
const CARD_GAP = scale(14);

type SubjectsRouteProp = RouteProp<BooksStackParamList, 'Subjects'>;
type BooksNavigationProp = StackNavigationProp<BooksStackParamList>;

type SubjectThemeCardProps = {
  book: SubjectBookSummary;
  cardWidth: number;
  cardHeight?: number;
  isDark: boolean;
  isTablet: boolean;
  isNarrowCard: boolean;
  cardText: string;
  headerFallbackColor: string;
  cardColors: {
    card: string;
    surface: string;
  };
  shadowStyle: {
    shadowColor: string;
    shadowOpacity: number;
  };
  onPress: (book: SubjectBookSummary, subjectColor: string) => void;
};

const SubjectThemeCard = React.memo(function SubjectThemeCard({
  book,
  cardWidth,
  cardHeight,
  isDark,
  isTablet,
  isNarrowCard,
  cardText,
  headerFallbackColor,
  cardColors,
  shadowStyle,
  onPress,
}: SubjectThemeCardProps) {
  const subjectColor = book.design?.accent || headerFallbackColor;
  const subjectCardToneStyle = {
    borderColor: withAlpha(subjectColor, isDark ? 0.22 : 0.14),
    ...shadowStyle,
  };
  const subjectCardHeightStyle = cardHeight ? {height: cardHeight} : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      style={[styles.subjectCardWrap, {width: cardWidth}]}
      onPress={() => onPress(book, subjectColor)}>
      <View
        style={[
          styles.subjectCard,
          subjectCardHeightStyle,
          subjectCardToneStyle,
        ]}>
        <LinearGradient
          colors={isDark ? [cardColors.card, cardColors.surface] : ['#FFFFFF', '#F8F9FA']}
          locations={[0, 1]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.subjectTopRow}>
          <View style={styles.subjectLead}>
            <LinearGradient
              colors={[subjectColor, subjectColor]}
              locations={[0, 1]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.subjectIconWrap}>
              <Layers3 size={moderateScale(18)} color="#fff" strokeWidth={2} />
            </LinearGradient>
            <Text
              style={[styles.subjectName, {color: cardText}]}
              numberOfLines={2}
              ellipsizeMode="tail">
              {book.subject}
            </Text>
          </View>

          <View
            style={[
              styles.subjectArrowWrap,
              {backgroundColor: withAlpha(subjectColor, 0.10)},
            ]}>
            <ChevronRight size={moderateScale(14)} color={subjectColor} strokeWidth={2.5} />
          </View>
        </View>

        <View
          style={[
            styles.subjectFooter,
            isTablet && styles.subjectFooterFixed,
            isNarrowCard && styles.subjectFooterCompact,
          ]}>
          <View
            style={[
              styles.subjectBadge,
              {backgroundColor: withAlpha(subjectColor, 0.10)},
              isNarrowCard && styles.subjectBadgeCompact,
            ]}>
            <Text style={[styles.subjectBadgeText, {color: subjectColor}]}>
              {book.weeks?.length ? `${book.weeks.length} Weeks` : 'Explore Theme'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.subjectGlow,
            {backgroundColor: withAlpha(subjectColor, isDark ? 0.15 : 0.08)},
          ]}
        />
      </View>
    </TouchableOpacity>
  );
});

SubjectThemeCard.displayName = 'SubjectThemeCard';

function SubjectsScreenContent() {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const navigation = useNavigation<BooksNavigationProp>();
  const route = useRoute<SubjectsRouteProp>();
  const {gradeKey, gradeName, gradeColors, books = []} = route.params;
  const {width, height} = useWindowDimensions();
  const isLandscape = width > height;
  const cardText = colors.text;
  const cardSubText = colors.textSecondary;
  const gradeMeta = getGradeMeta(gradeKey);
  const safeBooks = React.useMemo<SubjectBookSummary[]>(
    () =>
      books.filter(
        (book): book is SubjectBookSummary =>
          !!book && typeof book._id === 'string' && typeof book.subject === 'string',
      ),
    [books],
  );
  const headerColors = React.useMemo<[string, string]>(() => {
    if (gradeColors?.length >= 2) {
      return [gradeColors[0], gradeColors[1]];
    }

    const fallback = gradeMeta?.colors ?? ['#2563EB', '#60A5FA'];
    return [fallback[0], fallback[1]];
  }, [gradeColors, gradeMeta?.colors]);
  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width - scale(32), scale(920)) : width;
  const cardWidth = isTablet
    ? (contentWidth - H_PAD * 2 - CARD_GAP) / 2
    : contentWidth - H_PAD * 2;
  const isNarrowCard = cardWidth < scale(320);
  const bottomContentInset = TAB_BAR_HEIGHT + insets.bottom + verticalScale(32);
  const cardHeight = isLandscape
    ? Math.max(verticalScale(110), Math.min(verticalScale(140), cardWidth * 0.45))
    : (isTablet
        ? Math.max(verticalScale(170), Math.min(verticalScale(210), cardWidth * 0.95))
        : undefined);
  const subjectCardShadowStyle = React.useMemo(
    () => ({
      shadowColor: isDark ? '#000' : '#28145B',
      shadowOpacity: isDark ? 0.3 : 0.08,
    }),
    [isDark],
  );
  const handleOpenSubject = React.useCallback(
    (book: SubjectBookSummary, subjectColor: string) => {
      navigation.navigate('SubjectContent', {
        gradeKey,
        gradeName,
        subjectKey: book._id,
        subjectName: book.subject,
        subjectColor,
      });
    },
    [gradeKey, gradeName, navigation],
  );
  const subjectCards = React.useMemo(
    () =>
      safeBooks.map(book => (
        <SubjectThemeCard
          key={book._id}
          book={book}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          isDark={isDark}
          isTablet={isTablet}
          isNarrowCard={isNarrowCard}
          cardText={cardText}
          headerFallbackColor={headerColors[0]}
          cardColors={{card: colors.card, surface: colors.surface}}
          shadowStyle={subjectCardShadowStyle}
          onPress={handleOpenSubject}
        />
      )),
    [
      cardHeight,
      cardText,
      cardWidth,
      colors.card,
      colors.surface,
      handleOpenSubject,
      headerColors,
      isDark,
      isNarrowCard,
      isTablet,
      safeBooks,
      subjectCardShadowStyle,
    ],
  );

  return (
    <View style={[styles.root, {backgroundColor: headerColors[0]}]}>
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
                <Text style={styles.headerBadgeText}>Themes Library</Text>
              </View>
            </View>

            {/* <Text style={styles.headerEyebrow}>
              {gradeMeta?.subtitle ?? 'Learning stage'}
            </Text> */}
            <Text style={styles.headerTitle}>{gradeName}</Text>
            <Text style={styles.headerSubtitle}>
              Choose Your Theme
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
            <View style={[styles.grid, isTablet && styles.gridTablet]}>
              {safeBooks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyStateText, {color: cardSubText}]}>No books found.</Text>
                </View>
              ) : (
                subjectCards
              )}
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
    fontSize: moderateScale(14),
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

  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    padding: moderateScale(40),
  },
  emptyStateText: {
    marginTop: verticalScale(12),
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
    minHeight: verticalScale(110),
    borderRadius: moderateScale(20),
    padding: moderateScale(16),
    borderWidth: 1,
    overflow: 'hidden',
    shadowRadius: moderateScale(14),
    shadowOffset: {width: 0, height: verticalScale(6)},
  },
  subjectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  subjectLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(12),
  },
  subjectIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectArrowWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectEyebrow: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: verticalScale(6),
  },
  subjectName: {
    fontSize: moderateScale(19),
    fontWeight: '800',

  },
  subjectDescription: {
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
    flex: 1,
  },
  subjectFooter: {
    marginTop: verticalScale(8),
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
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    top: verticalScale(-20),
    right: scale(-20),
  },
});
