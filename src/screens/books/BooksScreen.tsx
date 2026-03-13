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
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Layers3,
  PlayCircle,
} from 'lucide-react-native';
import ScreenErrorBoundary from '@/components/ui/ScreenErrorBoundary';
import {useTheme} from '@/theme';
import type {BooksStackParamList} from '@/types';
import {GRADE_OPTIONS} from './books.data';

const H_PAD = scale(20);
const CARD_GAP = scale(14);

const RESOURCE_PILLS = [
  {label: 'Concepts', Icon: Layers3},
  {label: 'Videos', Icon: PlayCircle},
  {label: 'Ebooks', Icon: FileText},
] as const;

const FLOW_STEPS = [
  {id: '01', title: 'Choose grade', caption: 'Start by level', Icon: BookOpen},
  {id: '02', title: 'Open subject', caption: 'Pick one stream', Icon: Layers3},
  {id: '03', title: 'Explore library', caption: 'Read, watch, practise', Icon: FileText},
] as const;

const rootBackgroundStyle = {backgroundColor: '#3D2799'} as const;

function BooksScreenContent() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<BooksStackParamList>>();
  const {width} = useWindowDimensions();

  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width - scale(48), scale(760)) : width;
  const cardWidth = isTablet
    ? (contentWidth - H_PAD * 2 - CARD_GAP) / 2
    : contentWidth - H_PAD * 2;

  const handleGradePress = (grade: typeof GRADE_OPTIONS[number]) => {
    navigation.navigate('Subjects', {
      gradeKey: grade.key,
      gradeName: grade.name,
      gradeColors: [...grade.colors],
    });
  };

  return (
    <View style={[styles.root, rootBackgroundStyle]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + verticalScale(60),
          },
        ]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + verticalScale(14),
            },
          ]}>
          <LinearGradient
            colors={['#35239A', '#5038CC', '#6C4CFF']}
            locations={[0, 0.5, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.headerInner, {width: contentWidth - H_PAD * 2}]}>
            <View style={styles.headerTopRow}>
              <View style={styles.modulePill}>
                <BookOpen size={moderateScale(16)} color="#fff" strokeWidth={2} />
                <Text style={styles.modulePillText}>Books</Text>
              </View>

              <View style={styles.livePill}>
                <Text style={styles.livePillText}>Live Library</Text>
              </View>
            </View>

            <Text style={styles.headerTitle}>Explore Grade Books</Text>
            <Text style={styles.headerSub}>
              Structured reading journeys with concepts, videos and ebooks grouped by level.
            </Text>

            <View style={styles.statsBar}>
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
            </View>
          </View>

          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View style={styles.content}>
          <View style={[styles.contentInner, {width: contentWidth - H_PAD * 2}]}>
            <View style={styles.featureSection}>
              <View style={styles.featureSectionHeader}>
                <Text style={styles.featureSectionEyebrow}>Featured Journey</Text>
                <Text style={[styles.featureSectionTitle, {color: colors.text}]}>
                  One flow, all resources
                </Text>
                <Text style={[styles.featureSectionSub, {color: colors.textSecondary}]}>
                  A cleaner reading path from grade to subject to concepts, videos and ebooks.
                </Text>
              </View>

              <View style={styles.featureCard}>
                <LinearGradient
                  colors={['#FFFFFF', '#FBF8FF', '#F6F1FF']}
                  locations={[0, 0.5, 1]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.featureTopRow, isTablet && styles.featureTopRowTablet]}>
                  <View style={styles.featureLead}>
                    <View style={styles.featureIconWrap}>
                      <LinearGradient
                        colors={['#4F46E5', '#6640E9', '#7C3AED']}
                        locations={[0, 0.5, 1]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={StyleSheet.absoluteFill}
                      />
                      <BookOpen size={moderateScale(26)} color="#fff" strokeWidth={1.8} />
                    </View>

                    <View style={styles.featureLeadCopy}>
                      <View style={styles.featureBadge}>
                        <View style={styles.featureBadgeDot} />
                        <Text style={styles.featureBadgeText}>Guided Flow</Text>
                      </View>
                      <Text style={styles.featureTitle}>Move from level to library without friction</Text>
                      <Text style={styles.featureSub}>
                        Start with the right grade, open a subject, then browse every learning format from the
                        same connected experience.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.featureMetaCard, isTablet ? styles.featureMetaCardTablet : styles.featureMetaCardMobile]}>
                    <Text style={styles.featureMetaLabel}>Live content path</Text>
                    <Text style={styles.featureMetaValue}>3 steps</Text>
                    <Text style={styles.featureMetaSub}>Structured for fast navigation</Text>
                  </View>
                </View>

                <View style={styles.featureStepsRow}>
                  {FLOW_STEPS.map(step => (
                    <View key={step.id} style={styles.featureStepCard}>
                      <View style={styles.featureStepIconWrap}>
                        <step.Icon size={moderateScale(14)} color="#5B34F2" strokeWidth={2.1} />
                      </View>
                      <View style={styles.featureStepCopy}>
                        <Text style={styles.featureStepTitle}>{step.title}</Text>
                        <Text style={styles.featureStepCaption}>{step.caption}</Text>
                      </View>
                      <Text style={styles.featureStepNumber}>{step.id}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.featureFooter}>
                  <Text style={styles.featureFooterLabel}>Included formats</Text>
                  <View style={styles.featurePillsRow}>
                    {RESOURCE_PILLS.map(item => {
                      const Icon = item.Icon;

                      return (
                        <View key={item.label} style={styles.featurePill}>
                          <Icon size={moderateScale(12)} color="#5B34F2" strokeWidth={2} />
                          <Text style={styles.featurePillText}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.featureDecorLarge} />
                <View style={styles.featureDecorSmall} />
              </View>
            </View>

            <Text style={[styles.sectionTitle, {color: colors.text}]}>
              Choose A Level
            </Text>
            <Text style={[styles.sectionSub, {color: colors.textSecondary}]}>
              Start with the right learning stage and open the matching subject library.
            </Text>

            <View style={[styles.gradeGrid, isTablet && styles.gradeGridTablet]}>
              {GRADE_OPTIONS.map(grade => {
                const Icon = grade.icon;

                return (
                  <TouchableOpacity
                    key={grade.key}
                    activeOpacity={0.88}
                    onPress={() => handleGradePress(grade)}
                    style={[
                      styles.cardTouchable,
                      {
                        width: cardWidth,
                      },
                    ]}>
                    <View style={styles.gradeCard}>
                      <LinearGradient
                        colors={grade.colors as unknown as string[]}
                        locations={[0, 1]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardIconWrap}>
                          <Icon size={moderateScale(24)} color="#fff" strokeWidth={1.9} />
                        </View>

                        <View style={styles.cardArrowWrap}>
                          <ArrowRight size={moderateScale(18)} color="#fff" strokeWidth={2.5} />
                        </View>
                      </View>

                      <Text style={styles.gradeName}>{grade.name}</Text>
                      <Text style={styles.gradeSubtitle}>{grade.subtitle}</Text>
                      <Text style={styles.gradeDescription}>{grade.description}</Text>

                      <View style={styles.cardBottomRow}>
                        <View style={styles.subjectPill}>
                          <Text style={styles.subjectPillText}>{grade.subjects} Subjects</Text>
                        </View>
                        <Text style={styles.gradeStatsLabel}>{grade.statsLabel}</Text>
                      </View>

                      <View style={styles.decorCircle1} />
                      <View style={styles.decorCircle2} />
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
    marginTop: verticalScale(18),
    marginBottom: verticalScale(8),
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
    shadowOffset: {width: 0, height: verticalScale(10)},
  },
  featureTopRow: {
    gap: verticalScale(14),
    marginBottom: verticalScale(16),
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
    shadowOffset: {width: 0, height: verticalScale(6)},
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
  featureSub: {
    color: '#6B6485',
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    maxWidth: '94%',
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
  featureStepIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(13),
    backgroundColor: '#EFE8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
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
  featureStepCaption: {
    color: '#7A7393',
    fontSize: moderateScale(11),
    lineHeight: moderateScale(16),
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
    fontSize: moderateScale(16),
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
  cardTouchable: {
    marginBottom: CARD_GAP,
  },
  gradeCard: {
    borderRadius: moderateScale(22),
    padding: moderateScale(18),
    minHeight: verticalScale(192),
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  cardIconWrap: {
    width: scale(50),
    height: scale(50),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardArrowWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeName: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(4),
  },
  gradeSubtitle: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.84)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: verticalScale(10),
  },
  gradeDescription: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.82)',
    lineHeight: moderateScale(18),
    maxWidth: '86%',
  },
  cardBottomRow: {
    marginTop: verticalScale(18),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: scale(10),
  },
  subjectPill: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  subjectPillText: {
    color: '#fff',
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  gradeStatsLabel: {
    flex: 1,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.84)',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  decorCircle1: {
    position: 'absolute',
    width: scale(84),
    height: scale(84),
    borderRadius: scale(42),
    top: verticalScale(-24),
    right: scale(-20),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    bottom: verticalScale(-18),
    right: scale(36),
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
