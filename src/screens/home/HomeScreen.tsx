import React, { useCallback, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import { withTiming } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  Bell,
  BookOpen,
  FileText,
  Gamepad2,
  Glasses,
  Globe,
  Mic,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/store';
import { useTheme } from '@/theme';
import { useTabBarScroll } from '@/navigation/TabBarScrollContext';
import { TAB_BAR_HEIGHT } from '@/navigation/CustomTabBar';
import type { BottomTabParamList, MainStackParamList } from '@/types';

const H_PAD    = scale(20);
const CARD_GAP = scale(12);

type TabNav = BottomTabNavigationProp<BottomTabParamList, 'Home'>;
type MainNav = StackNavigationProp<MainStackParamList>;

const GRID_ITEMS = [
  { key: 'AR' as const, label: 'Augmented\nReality', sub: 'Scan 3D models', Icon: Glasses, colors: ['#0369A1', '#0EA5E9'], shadow: '#0EA5E9' },
  { key: 'WebVR' as const, label: 'WebVR', sub: 'Virtual worlds', Icon: Globe, colors: ['#7C3AED', '#A855F7'], shadow: '#A855F7' },
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
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  const isTablet = width >= 768;
  const isLandscape = width > height;
  const outerHPad = isTablet && isLandscape ? scale(12) : H_PAD;
  const maxContentWidth = isTablet && !isLandscape ? width - 48 : undefined;
  const gridGap = isTablet ? 14 : CARD_GAP;
  const containerStyle = [
    styles.container,
    { paddingHorizontal: outerHPad },
    maxContentWidth ? { width: maxContentWidth, alignSelf: 'center' } : null,
  ];

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 0) {
      tabBarTranslateY.value = withTiming(0, { duration: 200 });
      return;
    }
    if (diff > 0) {
      // scrolling down — snap hide immediately
      tabBarTranslateY.value = withTiming(tabBarHeight, { duration: 200 });
    } else if (diff < -2) {
      // scrolling up — show
      tabBarTranslateY.value = withTiming(0, { duration: 200 });
    }
  }, [tabBarTranslateY, tabBarHeight]);

  const firstName = useMemo(() => {
    const n = user?.name?.split(' ')[0] ?? 'Learner';
    return n.charAt(0).toUpperCase() + n.slice(1);
  }, [user?.name]);
  const greeting = useMemo(() => getGreeting(), []);
  const isUserLoaded = !!user;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, { backgroundColor: colors.background }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: tabBarHeight + 24,
          backgroundColor: colors.background,
          flexGrow: 1,
        }}>

        {/* ── Header ── */}
        <View style={[styles.headerOuter, { paddingTop: insets.top + 16 }]}>
          <LinearGradient
            colors={['#3D2799', '#5439CC', '#6C4CFF']}
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
                <TouchableOpacity style={styles.iconBtn}>
                  <Bell size={19} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.avatarBtn}
                  onPress={() => mainNav.navigate('Profile')}>
                  <User size={19} color="#6C4CFF" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>

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
          </View>

          <View style={[styles.curve, { backgroundColor: colors.background }]} />
        </View>

        {/* ── Content ── */}
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <View style={[containerStyle]}>

            {/* Featured — Books */}
          <Text style={[styles.section, styles.sectionFirst, { color: colors.text }]}>Featured</Text>
            <TouchableOpacity onPress={() => tabNav.navigate('Books')} activeOpacity={0.88}>
              <View style={styles.heroCard}>
                <LinearGradient
                  colors={['#4F46E5', '#5D49F2', '#6C4CFF', '#8354FF', '#9B5CFF']}
                  locations={[0, 0.25, 0.5, 0.75, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroInner}>
                  <View style={styles.heroIconWrap}>
                    <BookOpen size={32} color="#fff" strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroTitle}>Grade Books</Text>
                    <Text style={styles.heroSub}>Curriculum-aligned ebooks{'\n'}for every grade level</Text>
                  </View>
                </View>
                <View style={styles.decor1} /><View style={styles.decor2} />
              </View>
            </TouchableOpacity>

            {/* Grid — 2x2 on all devices */}
            <Text style={[styles.section, { color: colors.text }]}>Learning Tools</Text>
            <View style={[styles.gridRow, { gap: gridGap, marginBottom: gridGap }]}>
              {GRID_ITEMS.slice(0, 2).map(({ key, label, sub, Icon, colors: c }) => (
                <TouchableOpacity key={key} onPress={() => tabNav.navigate(key)} activeOpacity={0.88} style={styles.gridTouchable}>
                  <View style={[styles.gridCard, isTablet && styles.gridCardTablet]}>
                    <LinearGradient colors={c as unknown as string[]} locations={[0, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                    <View style={[styles.gridIcon, isTablet && styles.gridIconTablet]}><Icon size={isTablet ? 30 : 26} color="#fff" strokeWidth={1.8} /></View>
                    <Text style={[styles.gridLabel, isTablet && styles.gridLabelTablet]}>{label}</Text>
                    <Text style={[styles.gridSub, isTablet && styles.gridSubTablet]}>{sub}</Text>
                    <View style={styles.gridDecor} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* AR Sheets */}
            <Text style={[styles.section, { color: colors.text }]}>Worksheets</Text>
            <TouchableOpacity onPress={() => tabNav.navigate('ARSheets')} activeOpacity={0.88}>
              <View style={styles.wideCard}>
                <LinearGradient
                  colors={['#0D9488', '#10AE9A', '#14B8A6']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.wideIcon}>
                  <FileText size={28} color="#fff" strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.wideTitle}>AR Sheets</Text>
                  <Text style={styles.wideSub}>Scan worksheets with AR camera to see 3D animations live</Text>
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

  headerOuter: { paddingBottom: verticalScale(24), overflow: 'hidden' },
  headerContent: {},
  container: { width: '100%' },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetCol:   { flex: 1, gap: verticalScale(2) },
  greetLine:  { fontSize: moderateScale(12), color: 'rgba(255,255,255,0.75)' },
  greetName:  { fontSize: moderateScale(22), fontWeight: '800', color: '#fff' },
  greetSub:   { fontSize: moderateScale(12), color: 'rgba(255,255,255,0.65)' },
  skeletonName: { height: verticalScale(26), width: scale(120), borderRadius: moderateScale(6), backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: verticalScale(2) },
  headerBtns: { flexDirection: 'row', gap: scale(10), marginTop: verticalScale(4) },
  iconBtn:    { width: scale(40), height: scale(40), borderRadius: moderateScale(12), backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarBtn:  { width: scale(40), height: scale(40), borderRadius: moderateScale(12), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  statsBar: {
    flexDirection: 'row',
    marginTop: verticalScale(16),
    marginBottom: verticalScale(14),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(16), paddingVertical: verticalScale(12), paddingHorizontal: scale(20),
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: moderateScale(18), fontWeight: '800', color: '#fff' },
  statLbl:  { fontSize: moderateScale(10), color: 'rgba(255,255,255,0.7)', marginTop: verticalScale(2) },
  statDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: scale(8) },

  curve: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: verticalScale(20),
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
  },

  content: { paddingTop: verticalScale(2) },
  section: { fontSize: moderateScale(15), fontWeight: '700', marginBottom: verticalScale(10), marginTop: verticalScale(4) },
  sectionFirst: { marginTop: 0 },

  heroCard: {
    borderRadius: moderateScale(20), padding: moderateScale(22), marginBottom: verticalScale(8), overflow: 'hidden',
  },
  heroInner:    { flexDirection: 'row', alignItems: 'center', gap: scale(16) },
  heroIconWrap: { width: scale(60), height: scale(60), borderRadius: moderateScale(16), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  heroTitle:    { fontSize: moderateScale(18), fontWeight: '800', color: '#fff', marginBottom: verticalScale(5) },
  heroSub:      { fontSize: moderateScale(12), color: 'rgba(255,255,255,0.8)', lineHeight: moderateScale(17) },
  decor1:       { position: 'absolute', top: verticalScale(-30), right: scale(-30), width: scale(100), height: scale(100), borderRadius: scale(50), backgroundColor: 'rgba(255,255,255,0.08)' },
  decor2:       { position: 'absolute', bottom: verticalScale(-20), right: scale(50), width: scale(60), height: scale(60), borderRadius: scale(30), backgroundColor: 'rgba(255,255,255,0.06)' },

  gridRow:       { flexDirection: 'row', marginBottom: CARD_GAP },
  gridTouchable: { flex: 1 },
  gridCard:        { minHeight: verticalScale(150), borderRadius: moderateScale(18), paddingTop: verticalScale(14), paddingHorizontal: scale(14), paddingBottom: verticalScale(12), overflow: 'hidden' },
  gridCardTablet:  { minHeight: 170, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, borderRadius: 20 },
  gridIcon:        { width: scale(44), height: scale(44), borderRadius: moderateScale(13), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: verticalScale(8), borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  gridIconTablet:  { width: 52, height: 52, borderRadius: 16, marginBottom: 10 },
  gridLabel:       { fontSize: moderateScale(13), fontWeight: '700', color: '#fff', marginBottom: verticalScale(2), lineHeight: moderateScale(18) },
  gridLabelTablet: { fontSize: 16, lineHeight: 22 },
  gridSub:         { fontSize: moderateScale(10), color: 'rgba(255,255,255,0.75)', lineHeight: moderateScale(14) },
  gridSubTablet:   { fontSize: 13, lineHeight: 18 },
  gridDecor:       { position: 'absolute', bottom: verticalScale(-20), right: scale(-20), width: scale(70), height: scale(70), borderRadius: scale(35), backgroundColor: 'rgba(255,255,255,0.1)' },

  wideCard:  { flexDirection: 'row', alignItems: 'center', padding: moderateScale(18), borderRadius: moderateScale(18), overflow: 'hidden', gap: scale(14) },
  wideIcon:  { width: scale(52), height: scale(52), borderRadius: moderateScale(15), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', flexShrink: 0 },
  wideTitle: { fontSize: moderateScale(15), fontWeight: '700', color: '#fff', marginBottom: verticalScale(3) },
  wideSub:   { fontSize: moderateScale(11), color: 'rgba(255,255,255,0.8)', lineHeight: moderateScale(16) },
  wideDecor: { position: 'absolute', top: verticalScale(-20), right: scale(-20), width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: 'rgba(255,255,255,0.08)' },
});
