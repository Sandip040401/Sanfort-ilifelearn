import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { withTiming } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  Bell,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/store';
import { useTheme } from '@/theme';
import { useTabBarScroll } from '@/navigation/TabBarScrollContext';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import type { BottomTabParamList, MainStackParamList } from '@/types';

const H_PAD = scale(20);
const CARD_GAP = scale(12);
const COMPACT_PHONE_BREAKPOINT = 360;

type TabNav = BottomTabNavigationProp<BottomTabParamList, 'Home'>;
type MainNav = StackNavigationProp<MainStackParamList>;

const LearningThemesImg = require('@/assets/images/home_screen/Learning-Themes.webp');
const ARImg = require('@/assets/images/home_screen/AR-Image.webp');
const WebVRImg = require('@/assets/images/home_screen/WebVR.webp');
const EduGamesImg = require('@/assets/images/home_screen/Edu-Games.webp');
const HOME_IMAGE_SOURCES = [LearningThemesImg, ARImg, WebVRImg, EduGamesImg] as const;

const HEADER_GRADIENT_COLORS = ['#3D2799', '#5439CC', '#6C4CFF'];
const HERO_GRADIENT_COLORS = ['#4F46E5', '#5D49F2', '#6C4CFF', '#8354FF', '#9B5CFF'];
const GAMES_GRADIENT_COLORS = ['#4F46E5', '#6366F1', '#7E22CE'];

const GRID_ITEMS = [
  { key: 'AR' as const, label: 'Augmented Reality', sub: 'Explore interactive 3D models through AR', image: ARImg, colors: ['#0369A1', '#0EA5E9'], shadow: '#0EA5E9' },
  { key: 'WebVR' as const, label: 'WebVR', sub: 'Dive into fun and educational virtual worlds', image: WebVRImg, colors: ['#7C3AED', '#A855F7'], shadow: '#A855F7' },
] as const;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) { return 'Good Morning'; }
  if (h < 17) { return 'Good Afternoon'; }
  return 'Good Evening';
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<TabNav>();
  const mainNav = useNavigation<MainNav>();
  const { width, height } = useWindowDimensions();
  const { tabBarTranslateY } = useTabBarScroll();
  const lastScrollY = useRef(0);
  const isTabBarHidden = useRef(false);
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  const isTablet = width >= 768;
  const isLandscape = width > height;
  const useSingleToolColumn = width < COMPACT_PHONE_BREAKPOINT && !isLandscape;
  const outerHPad = isTablet && isLandscape ? scale(12) : H_PAD;
  const maxContentWidth = isTablet && !isLandscape ? width - 48 : undefined;
  const gridGap = isTablet ? 14 : CARD_GAP;
  const containerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.container,
      { paddingHorizontal: outerHPad },
      maxContentWidth ? { width: maxContentWidth, alignSelf: 'center' } : null,
    ],
    [maxContentWidth, outerHPad],
  );

  const contentContainerStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.scrollContent,
      {
        paddingBottom: tabBarHeight + 24,
        backgroundColor: colors.background,
      },
    ],
    [colors.background, tabBarHeight],
  );
  const gridLayoutStyle = useMemo<StyleProp<ViewStyle>>(
    () => [
      styles.gridRow,
      useSingleToolColumn ? styles.gridColumn : null,
      { gap: gridGap, marginBottom: gridGap },
    ],
    [gridGap, useSingleToolColumn],
  );

  useEffect(() => {
    const preloadable = HOME_IMAGE_SOURCES.reduce<{ uri: string }[]>((acc, source) => {
      const asset = Image.resolveAssetSource(source);
      if (asset?.uri) {
        acc.push({ uri: asset.uri });
      }
      return acc;
    }, []);

    if (preloadable.length > 0) {
      FastImage.preload(preloadable);
    }
  }, []);

  const animateTabBar = useCallback(
    (hide: boolean) => {
      if (isTabBarHidden.current === hide) {
        return;
      }
      isTabBarHidden.current = hide;
      tabBarTranslateY.value = withTiming(hide ? tabBarHeight : 0, { duration: 200 });
    },
    [tabBarHeight, tabBarTranslateY],
  );

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 0) {
      animateTabBar(false);
      return;
    }
    if (diff > 2) {
      // scrolling down — hide once
      animateTabBar(true);
    } else if (diff < -2) {
      // scrolling up — show
      animateTabBar(false);
    }
  }, [animateTabBar]);

  const firstName = useMemo(() => {
    const n = user?.name?.trim().split(/\s+/)[0] || 'Learner';
    return n.charAt(0).toUpperCase() + n.slice(1);
  }, [user?.name]);
  const greeting = getGreeting();
  const isUserLoaded = !!user;

  const handleNotificationsPress = useCallback(() => {
    Alert.alert('Coming Soon', 'Notifications will be available soon.');
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, { backgroundColor: colors.background }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={contentContainerStyle}>

        {/* ── Header ── */}
        <View style={[styles.headerOuter, { paddingTop: insets.top + 16 }]}>
          <LinearGradient
            colors={HEADER_GRADIENT_COLORS}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.headerContent, containerStyle]}>
            <View style={styles.headerRow}>
              <View style={styles.greetCol}>
                <Text style={styles.greetLine}>{greeting} 👋</Text>
                {isUserLoaded ? (
                  <Text style={styles.greetName}>{firstName}</Text>
                ) : (
                  <View style={styles.skeletonName} />
                )}
                <Text style={styles.greetSub}>Ready to explore today?</Text>
              </View>
              <View style={styles.headerBtns}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.iconBtn}
                  onPress={handleNotificationsPress}>
                  <Bell size={20} color="#fff" strokeWidth={1.2} />
                  <View style={styles.notiBadge} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.avatarBtn}
                  onPress={() => mainNav.navigate('Profile')}>
                  <User size={20} color="#6C4CFF" strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Commented out KPIs as requested */}
            {/* 
            <View style={styles.statsBar}>
              {[{ v: '12+', l: 'Books' }, { v: '50+', l: 'AR Models' }, { v: '30+', l: 'Games' }].map((s, i) => (
                <React.Fragment key={s.l}>
                  {i > 0 && <View style={styles.statDiv} />}
                  <View style={styles.statItem}>
                    <Text style={styles.statVal}>{s.v}</Text>
                    <Text style={styles.statLbl}>{s.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            */}
          </View>

          {/* Decorative Elements for a more "premium" feel */}
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />

          <View style={[styles.curve, { backgroundColor: colors.background }]} />
        </View>

        {/* ── Content ── */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <View style={containerStyle}>

            {/* Featured — Books */}
            <Text style={[styles.section, styles.sectionFirst, { color: colors.text }]}>Featured</Text>
            <TouchableOpacity onPress={() => tabNav.navigate('Themes')} activeOpacity={0.88}>
              <View style={styles.heroCard}>
                <LinearGradient
                  colors={HERO_GRADIENT_COLORS}
                  locations={[0, 0.25, 0.5, 0.75, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroInner}>
                  <FastImage source={LearningThemesImg} style={styles.heroImageOnly} resizeMode={FastImage.resizeMode.contain} />
                  <View style={styles.flexOne}>
                    <Text style={styles.heroTitle}>Learning Themes</Text>
                    <Text style={styles.heroSub}>Thematic curriculum for all grades</Text>
                  </View>
                </View>
                <View style={styles.decor1} /><View style={styles.decor2} />
              </View>
            </TouchableOpacity>

            {/* Grid — 2x2 on all devices */}
            <Text style={[styles.section, { color: colors.text }]}>Learning Tools</Text>
            <View style={gridLayoutStyle}>
              {GRID_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => tabNav.navigate(item.key)}
                  activeOpacity={0.88}
                  style={[styles.gridTouchable, useSingleToolColumn && styles.gridTouchableSingle]}>
                  <View style={[styles.gridCard, isTablet && styles.gridCardTablet]}>
                    <LinearGradient colors={item.colors as unknown as string[]} locations={[0, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <FastImage source={item.image} style={[styles.gridImageOnly, isTablet && styles.gridImageOnlyTablet]} resizeMode={FastImage.resizeMode.contain} />
                    <Text style={[styles.gridLabel, isTablet && styles.gridLabelTablet]}>{item.label}</Text>
                    <Text android_hyphenationFrequency="full" style={[styles.gridSub, isTablet && styles.gridSubTablet]}>{item.sub}</Text>
                    <View style={styles.gridDecor} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* AR Sheets */}
            {/* <Text style={[styles.section, { color: colors.text }]}>Worksheets</Text>
            <TouchableOpacity onPress={() => tabNav.navigate('ARSheets')} activeOpacity={0.88}>
              <View style={styles.wideCard}>
                <LinearGradient
                  colors={['#0D9488', '#10AE9A', '#14B8A6']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.wideIcon}>
                  <FileText size={28} color="#fff" strokeWidth={1.2} />
                </View>
                <View style={styles.flexOne}>
                  <Text style={styles.wideTitle}>AR Sheets</Text>
                  <Text style={styles.wideSub}>Scan worksheets with AR camera to see 3D animations live</Text>
                </View>
                <View style={styles.wideDecor} />
              </View>
            </TouchableOpacity> */}

            {/* Educational Games — Coming Soon */}
            <Text style={[styles.section, { color: colors.text }]}>Games</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => tabNav.navigate('Games')}
              style={styles.gameTouchable}
            >
              <View style={styles.wideCard}>
                <LinearGradient
                  colors={GAMES_GRADIENT_COLORS}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <FastImage source={EduGamesImg} style={styles.wideImageOnly} resizeMode={FastImage.resizeMode.contain} />
                <View style={styles.flexOne}>
                  <Text style={styles.wideTitle}>Educational Games</Text>
                  <Text style={styles.wideSub}>Fun learning games for kids</Text>
                </View>
                <View style={styles.wideDecor} />
              </View>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  flexOne: { flex: 1 },

  headerOuter: { paddingBottom: verticalScale(50), overflow: 'hidden' },
  headerContent: { zIndex: 1 }, // Ensure content stays above decors
  container: { width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetCol: { flex: 1, gap: verticalScale(1) },
  greetLine: { fontSize: moderateScale(13), color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  greetName: { fontSize: moderateScale(26), fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginVertical: verticalScale(2) },
  greetSub: { fontSize: moderateScale(13), color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  skeletonName: { height: verticalScale(30), width: scale(140), borderRadius: moderateScale(8), backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: verticalScale(4) },
  headerBtns: { flexDirection: 'row', gap: scale(12), marginTop: verticalScale(6) },
  iconBtn: { width: scale(42), height: scale(42), borderRadius: moderateScale(13), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  avatarBtn: { width: scale(42), height: scale(42), borderRadius: moderateScale(13), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  notiBadge: { position: 'absolute', top: scale(10), right: scale(11), width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#FF4B4B', borderWidth: 1.5, borderColor: '#3D2799' },

  headerDecor1: { position: 'absolute', top: verticalScale(-30), left: scale(-50), width: scale(200), height: scale(200), borderRadius: scale(100), backgroundColor: 'rgba(255,255,255,0.06)' },
  headerDecor2: { position: 'absolute', top: verticalScale(10), right: scale(-70), width: scale(160), height: scale(160), borderRadius: scale(80), backgroundColor: 'rgba(255,255,255,0.04)' },

  statsBar: {
    flexDirection: 'row',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(14),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(16), paddingVertical: verticalScale(12), paddingHorizontal: scale(20),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: moderateScale(18), fontWeight: '800', color: '#fff' },
  statLbl: { fontSize: moderateScale(10), color: 'rgba(255,255,255,0.7)', marginTop: verticalScale(2) },
  statDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: scale(8) },

  curve: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    height: verticalScale(30),
    borderTopLeftRadius: moderateScale(32),
    borderTopRightRadius: moderateScale(32),
  },

  content: { paddingTop: verticalScale(2) },
  section: { fontSize: moderateScale(15), fontWeight: '700', marginBottom: verticalScale(10), marginTop: verticalScale(4) },
  sectionFirst: { marginTop: 0 },

  heroCard: {
    borderRadius: moderateScale(20), padding: moderateScale(18), paddingVertical: moderateScale(16), marginBottom: verticalScale(8), overflow: 'hidden',
  },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: scale(16) },
  heroIconWrap: { width: scale(60), height: scale(60), borderRadius: moderateScale(16), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroTitle: { fontSize: moderateScale(18), fontWeight: '800', color: '#fff', marginBottom: verticalScale(5) },
  heroSub: { fontSize: moderateScale(12), color: 'rgba(255,255,255,0.8)', lineHeight: moderateScale(17) },
  decor1: { position: 'absolute', top: verticalScale(-30), right: scale(-30), width: scale(100), height: scale(100), borderRadius: scale(50), backgroundColor: 'rgba(255,255,255,0.08)' },
  decor2: { position: 'absolute', bottom: verticalScale(-20), right: scale(50), width: scale(60), height: scale(60), borderRadius: scale(30), backgroundColor: 'rgba(255,255,255,0.06)' },

  gridRow: { flexDirection: 'row', marginBottom: CARD_GAP },
  gridColumn: { flexDirection: 'column' },
  gridTouchable: { flex: 1 },
  gridTouchableSingle: { flex: 0, width: '100%' },
  gridCard: { minHeight: verticalScale(125), borderRadius: moderateScale(18), paddingTop: verticalScale(14), paddingHorizontal: scale(14), paddingBottom: verticalScale(12), overflow: 'hidden' },
  gridCardTablet: { minHeight: 170, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, borderRadius: 20 },
  gridIcon: { width: scale(54), height: scale(54), borderRadius: moderateScale(15), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: verticalScale(8), borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  gridIconTablet: { width: 62, height: 62, borderRadius: 18, marginBottom: 10 },
  gridLabel: { fontSize: moderateScale(13), fontWeight: '700', color: '#fff', marginBottom: verticalScale(2), lineHeight: moderateScale(18) },
  gridLabelTablet: { fontSize: 16, lineHeight: 22 },
  gridSub: { fontSize: moderateScale(10), color: 'rgba(255,255,255,0.75)', lineHeight: moderateScale(14) },
  gridSubTablet: { fontSize: 13, lineHeight: 18 },
  gridDecor: { position: 'absolute', bottom: verticalScale(-20), right: scale(-20), width: scale(70), height: scale(70), borderRadius: scale(35), backgroundColor: 'rgba(255,255,255,0.1)' },

  wideCard: { flexDirection: 'row', alignItems: 'center', padding: moderateScale(18), borderRadius: moderateScale(18), overflow: 'hidden', gap: scale(14) },
  wideIcon: { width: scale(52), height: scale(52), borderRadius: moderateScale(15), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexShrink: 0 },
  wideTitle: { fontSize: moderateScale(15), fontWeight: '700', color: '#fff', marginBottom: verticalScale(3) },
  wideSub: { fontSize: moderateScale(11), color: 'rgba(255,255,255,0.8)', lineHeight: moderateScale(16) },
  wideDecor: { position: 'absolute', top: verticalScale(-20), right: scale(-20), width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: 'rgba(255,255,255,0.08)' },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(6),
    marginLeft: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonText: {
    fontSize: moderateScale(9),
    color: '#fff',
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroImageOnly: {
    width: scale(65),
    height: scale(65),
  },
  gridImageOnly: {
    width: scale(84),
    height: scale(64),
    marginBottom: verticalScale(8),
  },
  gridImageOnlyTablet: {
    width: 62,
    height: 62,
    marginBottom: 10,
  },
  wideImageOnly: {
    width: scale(77),
    height: scale(62),
    flexShrink: 0,
  },
  gameTouchable: {
    width: '100%',
  },
});
