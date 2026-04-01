import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import FastImage from 'react-native-fast-image';
import Animated, {
  FadeInLeft,
  FadeInRight,
  Layout,
} from 'react-native-reanimated';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import { Skeleton } from '@/components/ui';
import { useTheme } from '@/theme';
import type { BooksStackParamList, SubjectBookSummary } from '@/types';
import { useTabBarHideOnScroll } from '@/navigation/useTabBarHideOnScroll';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import { BooksService } from '@/services/books.service';
import { useAuth } from '@/store';

const H_PAD = scale(20);
const CARD_GAP = scale(14);

type GradeDesign = {
  name: string;
  subtitle: string;
  description: string;
  image: string;
  gradient: [string, string];
  darkGradient: [string, string];
  accent: string;
  border: string;
  darkBorder: string;
};

type GradeGroup = {
  _id: string;
  category: string;
  books: SubjectBookSummary[];
  design: GradeDesign;
  baseName: string;
};

const DESIGN_MAP: Record<string, GradeDesign> = {
  'SAN Toddler': {
    name: 'SAN Toddler',
    subtitle: '2–3 Years',
    description: 'Nurturing curiosity in the earliest steps.',
    image: 'https://www.sanfortschools.com/wp-content/uploads/2024/05/image-16-1.webp',
    gradient: ['#FFF1F1', '#FFE4E4'],
    darkGradient: ['#3D1E1E', '#2D1616'],
    accent: '#EF4444',
    border: '#FEE2E2',
    darkBorder: '#5D2E2E',
  },
  'SAN Learner': {
    name: 'SAN Learner',
    subtitle: '3–4 Years',
    description: 'Where playing and learning go hand in hand.',
    image: 'https://www.sanfortschools.com/wp-content/uploads/2024/08/SAN-LEARNER.jpg',
    gradient: ['#F0F9FF', '#E0F2FE'],
    darkGradient: ['#1E2D3D', '#16232D'],
    accent: '#0EA5E9',
    border: '#E0F2FE',
    darkBorder: '#2E3E5D',
  },
  'SAN Junior': {
    name: 'SAN Junior',
    subtitle: '4–5 Years',
    description: 'Developing skills for a brighter future.',
    image: 'https://www.sanfortschools.com/wp-content/uploads/2024/07/DSC_0887-scaled-e1721393030714.jpg',
    gradient: ['#FFFAF5', '#FFF1E6'],
    darkGradient: ['#3D2E1E', '#2D2316'],
    accent: '#F97316',
    border: '#FFEDD5',
    darkBorder: '#5D462E',
  },
  'SAN Senior': {
    name: 'SAN Senior',
    subtitle: '5–6 Years',
    description: 'Preparing little leaders for school years.',
    image: 'https://www.sanfortschools.com/wp-content/uploads/2024/07/DSC_0868-scaled-e1721393135916.jpg',
    gradient: ['#F0FDF4', '#DCFCE7'],
    darkGradient: ['#1E3D2E', '#162D23'],
    accent: '#22C55E',
    border: '#DCFCE7',
    darkBorder: '#2E5D46',
  },
};

const GRADE_SEQUENCE = ['SAN Toddler', 'SAN Learner', 'SAN Junior', 'SAN Senior'] as const;
const PRIVILEGED_ROLES = new Set(['teacher', 'super-admin', 'admin']);

const rootBackgroundStyle = { backgroundColor: '#3D2799' } as const;

function getGradeOrder(baseName: string): number {
  const index = GRADE_SEQUENCE.indexOf(baseName as (typeof GRADE_SEQUENCE)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function normalizeApiGrades(rawGrades: unknown[]): GradeGroup[] {
  const groupedGrades = new Map<string, GradeGroup>();

  rawGrades.forEach(rawGrade => {
    if (!rawGrade || typeof rawGrade !== 'object') {
      return;
    }

    const grade = rawGrade as Record<string, unknown>;
    const category = typeof grade.category === 'string' ? grade.category : '';
    const baseName = category.split(' (')[0]?.trim() || 'SAN Toddler';
    const design = DESIGN_MAP[baseName] ?? DESIGN_MAP['SAN Toddler'];
    const current = groupedGrades.get(baseName);
    if (current) {
      const mappedBook: SubjectBookSummary = {
        ...(grade as Record<string, unknown>),
        _id:
          typeof grade._id === 'string'
            ? grade._id
            : `${baseName}-${current.books.length + 1}`,
        subject: typeof grade.subject === 'string' ? grade.subject : baseName,
        design,
        baseName,
      };
      current.books.push(mappedBook);
      return;
    }

    const mappedBook: SubjectBookSummary = {
      ...(grade as Record<string, unknown>),
      _id: typeof grade._id === 'string' ? grade._id : `${baseName}-1`,
      subject: typeof grade.subject === 'string' ? grade.subject : baseName,
      design,
      baseName,
    };

    groupedGrades.set(baseName, {
      _id: baseName,
      category,
      books: [mappedBook],
      design,
      baseName,
    });
  });

  return Array.from(groupedGrades.values()).sort(
    (left, right) => getGradeOrder(left.baseName) - getGradeOrder(right.baseName),
  );
}

function getScopedGrades(
  apiGrades: GradeGroup[],
  role?: string,
  gradeName?: string,
): GradeGroup[] {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole && PRIVILEGED_ROLES.has(normalizedRole)) {
    return apiGrades;
  }

  const targetGrade = (gradeName || 'SAN Toddler').trim().toLowerCase();
  const filtered = apiGrades.filter(
    grade => grade.baseName.trim().toLowerCase() === targetGrade,
  );

  if (filtered.length > 0) {
    return filtered;
  }

  return apiGrades.length > 0 ? [apiGrades[0]] : [];
}

type GradeCardProps = {
  grade: GradeGroup;
  index: number;
  cardWidth: number;
  isDark: boolean;
  onPress: (grade: GradeGroup) => void;
};

const GradeCard = React.memo(function GradeCard({
  grade,
  index,
  cardWidth,
  isDark,
  onPress,
}: GradeCardProps) {
  const { design } = grade;
  const isEven = index % 2 === 0;
  const cardGradients = isDark ? design.darkGradient : design.gradient;
  const borderCol = isDark ? design.darkBorder : design.border;
  const subTextColor = isDark ? 'rgba(255,255,255,0.7)' : `${design.accent}CC`;
  const imageSideOffsetStyle = isEven
    ? styles.gradeImageSideLeft
    : styles.gradeImageSideRight;
  const gradeBodyPositionStyle = isEven
    ? styles.gradeCardBodyEven
    : styles.gradeCardBodyOdd;
  const gradeBadgeToneStyle = isDark
    ? styles.gradeBadgeDark
    : styles.gradeBadgeLight;
  const gradeBadgeTextToneStyle = isDark
    ? styles.gradeBadgeTextDark
    : { color: design.accent };
  const gradeCardWrapStyle = {
    width: cardWidth,
    borderColor: borderCol,
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
  };
  const unifiedGradients = isEven
    ? ['transparent', 'transparent', cardGradients[0], cardGradients[1]]
    : [cardGradients[0], cardGradients[1], 'transparent', 'transparent'];
  const unifiedLocations = isEven
    ? [0, 0.15, 0.45, 1]
    : [0, 0.53, 0.85, 1];
  const entering = isEven
    ? FadeInLeft.delay(index * 120).duration(600)
    : FadeInRight.delay(index * 120).duration(600);

  return (
    <Animated.View entering={entering} layout={Layout.springify()}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => onPress(grade)}
        style={[styles.gradeCardWrap, gradeCardWrapStyle]}>
        <View style={[styles.gradeImageSideWrap, imageSideOffsetStyle]}>
          <FastImage
            source={{ uri: design.image }}
            style={styles.gradeImageFull}
            resizeMode={FastImage.resizeMode.cover}
          />
        </View>

        <LinearGradient
          colors={unifiedGradients as string[]}
          locations={unifiedLocations}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.gradeCardInner}>
          <View style={[styles.gradeCardBody, gradeBodyPositionStyle]}>
            <Text style={[styles.gradeNameText, { color: design.accent }]}>
              {design.name}
            </Text>

            <View style={[styles.gradeBadge, gradeBadgeToneStyle]}>
              <Text style={[styles.gradeBadgeText, gradeBadgeTextToneStyle]}>
                {design.subtitle}
              </Text>
            </View>

            <Text style={[styles.gradeDescText, styles.gradeDescLeft, { color: subTextColor }]}>
              "{design.description}"
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

GradeCard.displayName = 'GradeCard';

function BooksScreenContent() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { onScroll } = useTabBarHideOnScroll();
  const navigation = useNavigation<StackNavigationProp<BooksStackParamList>>();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;
  const isLandscape = width > height;
  const isTabletLandscape = isTablet && isLandscape;
  const showTwoColumn = isTabletLandscape;
  const contentWidth = isTablet ? Math.min(width - scale(32), scale(920)) : width;
  const singleCardWidth = contentWidth - H_PAD * 2;
  const bottomContentInset = TAB_BAR_HEIGHT + insets.bottom + verticalScale(40);
  const cardWidth = showTwoColumn
    ? (contentWidth - H_PAD * 2 - CARD_GAP) / 2
    : singleCardWidth;
  const skeletonCount = showTwoColumn ? 6 : 4;
  const skeletonItems = React.useMemo(
    () => Array.from({ length: skeletonCount }, (_, idx) => idx),
    [skeletonCount],
  );

  const [grades, setGrades] = React.useState<GradeGroup[]>([]);
  const [loading, setLoading] = React.useState(true);

  const handleGradePress = React.useCallback((grade: GradeGroup) => {
    const { design } = grade;
    const colorsArr: [string, string] = [`${design.accent}DD`, `${design.accent}99`];

    navigation.navigate('Subjects', {
      gradeKey: grade._id,
      gradeName: grade.baseName,
      gradeColors: colorsArr,
      books: grade.books,
    });
  }, [navigation]);
  const gradeCards = React.useMemo(
    () =>
      grades.map((grade, index) => (
        <GradeCard
          key={grade._id}
          grade={grade}
          index={index}
          cardWidth={cardWidth}
          isDark={isDark}
          onPress={handleGradePress}
        />
      )),
    [cardWidth, grades, handleGradePress, isDark],
  );

  React.useEffect(() => {
    const preloadable = Object.values(DESIGN_MAP).map(design => ({ uri: design.image }));
    FastImage.preload(preloadable);
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const fetchGrades = async () => {
      setLoading(true);

      try {
        const response = await BooksService.getAllGrades();
        const resData = response.data as { success?: boolean; grades?: unknown[] };

        if (!isMounted) {
          return;
        }

        if (resData.success && Array.isArray(resData.grades)) {
          const normalizedGrades = normalizeApiGrades(resData.grades);
          setGrades(
            getScopedGrades(normalizedGrades, user?.role, user?.gradeName),
          );
        } else {
          setGrades([]);
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[BooksScreen] Failed to load grades', error);
        }

        if (isMounted) {
          setGrades([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchGrades();

    return () => {
      isMounted = false;
    };
  }, [user?.gradeName, user?.role]);

  return (
    <View style={[styles.root, rootBackgroundStyle]}>
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
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top - verticalScale(8),
            },
          ]}>
          <LinearGradient
            colors={['#35239A', '#5038CC', '#6C4CFF']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.headerInner, { width: contentWidth - H_PAD * 2 }]}>
            {/* <View style={styles.headerTopRow}>
              <View style={styles.modulePill}>
                <BookOpen size={moderateScale(16)} color="#fff" strokeWidth={2} />
                <Text style={styles.modulePillText}>Books</Text>
              </View>

              <View style={styles.livePill}>
                <Text style={styles.livePillText}>Live Library</Text>
              </View>
            </View> */}

            <Text style={styles.headerTitle}>Explore by Grade</Text>
            {/* <Text style={styles.headerSub}>
              Structured reading journeys with concepts, videos and ebooks grouped by level.
            </Text> */}

            {/* <View style={styles.statsBar}>
              {[
                {v: '3', l: 'Levels'},
                {v: '12', l: 'Subjects'},
                {v: 'Live', l: 'API Feed'},
              ].map((stat, index) => (
                <React.Fragment key={stat.l}>
                  {index > 0 && <View style={styles.statDiv} />}
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{stat.v}</Text>
                    <Text style={styles.statLbl}>{stat.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View> */}
          </View>

          <View style={[styles.curve, { backgroundColor: colors.background }]} />
        </View>

        <View style={styles.content}>
          <View style={[styles.contentInner, { width: contentWidth - H_PAD * 2 }]}>

{/*
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Choose Grade
            </Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Start with the right learning stage and open the matching subject library.
            </Text> */}

            <View style={[styles.gradeGrid, showTwoColumn && styles.gradeGridTablet]}>
              {loading ? (
                skeletonItems.map(item => (
                  <View
                    key={`grade-skeleton-${item}`}
                    style={[styles.gradeCardSkeletonWrap, { width: cardWidth }]}>
                    <Skeleton
                      width="100%"
                      height={verticalScale(172)}
                      borderRadius={moderateScale(24)}
                    />
                  </View>
                ))
              ) : (
                gradeCards
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function BooksScreen() {
  return (
    <ScreenErrorBoundary>
      <BooksScreenContent />
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
    paddingBottom: verticalScale(22),
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerInner: {
    alignSelf: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(9),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  modulePillText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  livePill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(9),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  livePillText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: '#fff',
    lineHeight: moderateScale(34),
    marginTop: verticalScale(24),
    marginBottom: verticalScale(15),
    maxWidth: '94%',
  },
  headerSub: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.78)',
    lineHeight: moderateScale(20),
    maxWidth: '92%',
  },
  statsBar: {
    flexDirection: 'row',
    marginTop: verticalScale(18),
    marginBottom: verticalScale(16),
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: moderateScale(18),
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statVal: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#fff',
  },
  statLbl: {
    marginTop: verticalScale(3),
    fontSize: moderateScale(10),
    color: 'rgba(255,255,255,0.72)',
  },
  statDiv: {
    width: 1,
    marginHorizontal: scale(8),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  featureSection: {
    marginBottom: verticalScale(22),
  },
  featureSectionHeader: {
    marginBottom: verticalScale(12),
  },
  featureSectionEyebrow: {
    color: '#6D5BAA',
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: verticalScale(4),
  },
  featureSectionTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  featureSectionSub: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  featureCard: {
    borderRadius: moderateScale(24),
    padding: moderateScale(18),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6DDFC',
    shadowColor: '#2D176C',
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(18),
    shadowOffset: { width: 0, height: verticalScale(10) },
  },
  featureCardCompact: {
    padding: moderateScale(16),
    borderRadius: moderateScale(20),
  },
  featureTopRow: {
    gap: verticalScale(14),
    marginBottom: verticalScale(16),
  },
  featureTopRowCompact: {
    gap: verticalScale(10),
    marginBottom: verticalScale(12),
  },
  featureTopRowTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureLead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  featureIconWrap: {
    width: scale(52),
    height: scale(52),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(14),
    shadowColor: '#6045E6',
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(12),
    shadowOffset: { width: 0, height: verticalScale(6) },
  },
  featureLeadCopy: {
    flex: 1,
  },
  featureBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: '#F1EAFF',
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  featureBadgeDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: '#7C3AED',
  },
  featureBadgeText: {
    color: '#5B34F2',
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  featureTitle: {
    color: '#17112E',
    fontSize: moderateScale(22),
    fontWeight: '800',
    lineHeight: moderateScale(28),
    marginBottom: verticalScale(6),
  },
  featureTitleCompact: {
    fontSize: moderateScale(20),
    lineHeight: moderateScale(26),
  },
  featureSub: {
    color: '#6B6485',
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    maxWidth: '94%',
  },
  featureSubCompact: {
    maxWidth: '100%',
  },
  featureMetaCard: {
    alignSelf: 'flex-start',
    borderRadius: moderateScale(18),
    backgroundColor: '#F6F1FF',
    borderWidth: 1,
    borderColor: '#E7DDFF',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
  },
  featureMetaCardMobile: {
    width: '100%',
  },
  featureMetaCardTablet: {
    width: scale(168),
  },
  featureMetaLabel: {
    color: '#7C3AED',
    fontSize: moderateScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(6),
  },
  featureMetaValue: {
    color: '#17112E',
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  featureMetaSub: {
    color: '#7A7393',
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
  },
  featureStepsRow: {
    zIndex: 1,
    gap: verticalScale(10),
  },
  featureStepsRowCompact: {
    gap: verticalScale(8),
  },
  featureStepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(124,58,237,0.06)',
    borderWidth: 1,
    borderColor: '#ECE4FF',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
  },
  featureStepCardCompact: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(10),
  },
  featureStepIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(13),
    backgroundColor: '#EFE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  featureStepIconWrapCompact: {
    width: scale(34),
    height: scale(34),
    borderRadius: moderateScale(12),
    marginRight: scale(8),
  },
  featureStepCopy: {
    flex: 1,
  },
  featureStepTitle: {
    color: '#201742',
    fontSize: moderateScale(13),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  featureStepTitleCompact: {
    fontSize: moderateScale(12),
  },
  featureStepCaption: {
    color: '#7A7393',
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
  },
  featureStepCaptionCompact: {
    fontSize: moderateScale(10),
    lineHeight: moderateScale(14),
  },
  featureStepNumber: {
    color: '#7C3AED',
    fontSize: moderateScale(10),
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: scale(10),
  },
  featureFooter: {
    zIndex: 1,
    marginTop: verticalScale(16),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    borderTopColor: '#EEE8FB',
  },
  featureFooterCompact: {
    marginTop: verticalScale(12),
  },
  featureFooterLabel: {
    color: '#6D5BAA',
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: verticalScale(10),
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  featurePillsRowCompact: {
    gap: scale(6),
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(7),
    borderWidth: 1,
    borderColor: '#E8E0FA',
  },
  featurePillText: {
    color: '#352B63',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  featureDecorLarge: {
    position: 'absolute',
    width: scale(110),
    height: scale(110),
    borderRadius: scale(55),
    right: scale(-30),
    top: verticalScale(-28),
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  featureDecorSmall: {
    position: 'absolute',
    width: scale(74),
    height: scale(74),
    borderRadius: scale(37),
    right: scale(26),
    bottom: verticalScale(-26),
    backgroundColor: 'rgba(79,70,229,0.05)',
  },
  curve: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    height: verticalScale(10),
    borderTopLeftRadius: moderateScale(18),
    borderTopRightRadius: moderateScale(18),
  },
  content: {
    paddingTop: verticalScale(14),
    paddingHorizontal: H_PAD,
    alignItems: 'center',
  },
  contentInner: {
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  sectionSub: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    marginBottom: verticalScale(16),
  },
  gradeGrid: {
    flexDirection: 'column',
    paddingTop: verticalScale(4),
  },
  gradeGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gradeCardWrap: {
    borderRadius: moderateScale(24),
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  gradeCardSkeletonWrap: {
    marginBottom: CARD_GAP,
  },
  gradeHeaderBar: {
    height: verticalScale(0), // Removed top bar for cleaner look
  },
  gradeCardInner: {
    minHeight: verticalScale(140),
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
  },
  gradeImageSideWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '55%', // Increased to ensure overlap
    overflow: 'hidden',
  },
  gradeImageSideLeft: {
    left: scale(-15),
  },
  gradeImageSideRight: {
    right: scale(-15),
  },
  gradeImageFull: {
    width: '100%',
    height: '100%',
  },
  gradeCardBody: {
    flex: 1,
    alignItems: 'flex-start',
    paddingHorizontal: scale(16),
  },
  gradeCardBodyEven: {
    paddingLeft: '48%',
    paddingRight: scale(8),
  },
  gradeCardBodyOdd: {
    paddingLeft: scale(10),
    paddingRight: '48%',
  },
  gradeNameText: {
    fontSize: moderateScale(22),
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: verticalScale(6),
  },
  gradeBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(10),
    marginBottom: verticalScale(10),
  },
  gradeBadgeDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  gradeBadgeLight: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gradeBadgeText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  gradeBadgeTextDark: {
    color: '#fff',
  },
  gradeDescText: {
    fontSize: moderateScale(12),
    fontStyle: 'italic',
    lineHeight: moderateScale(18),
  },
  gradeDescLeft: {
    textAlign: 'left',
  },
});
