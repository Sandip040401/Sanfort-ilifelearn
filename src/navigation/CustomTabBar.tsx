import React, {useEffect} from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Home,
  Glasses,
  Globe,
  Gamepad2,
  BookOpen,
} from 'lucide-react-native';
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useTheme} from '@/theme';
import {useTabBarScroll} from './TabBarScrollContext';

export const TAB_BAR_HEIGHT = verticalScale(56);

// Only these 5 tabs are shown in the bar
// ReadAloud & ARSheets stay registered in navigator so tabNav.navigate() works
const VISIBLE_TABS = ['Home', 'AR', 'WebVR', 'Books'] as const;

const TAB_ICONS = {
  Home:  Home,
  AR:    Glasses,
  WebVR: Globe,
  Games: Gamepad2,
  Books: BookOpen,
} as const;

const TAB_LABELS: Record<string, string> = {
  Home:  'Home',
  AR:    'AR',
  WebVR: 'WebVR',
  Games: 'Games',
  Books: 'Books',
};

// ── Per-tab animated item ─────────────────────────────────────────────
type TabItemProps = {
  route:     {key: string; name: string};
  isFocused: boolean;
  onPress:   () => void;
  onLongPress: () => void;
  primaryColor: string;
  inactiveColor: string;
};

function TabItem({route, isFocused, onPress, onLongPress, primaryColor, inactiveColor}: TabItemProps) {
  const Icon    = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
  const label   = TAB_LABELS[route.name] || route.name;

  // 0 = inactive, 1 = active
  const progress = useSharedValue(isFocused ? 1 : 0);
  // Per-tap bounce
  const scale    = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress]);

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(1.22, {damping: 5, stiffness: 500, mass: 0.6}),
      withSpring(1.0,  {damping: 10, stiffness: 300}),
    );
    onPress();
  };

  // Active indicator — slide down from top + fade
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity:   progress.value,
    transform: [{scaleX: withSpring(isFocused ? 1 : 0.3, {damping: 14, stiffness: 200})}],
  }));

  // Icon + label scale bounce
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  // Animated icon/label color (interpolateColor needs a numeric driver 0→1)
  const colorProgress = useDerivedValue(() => progress.value);

  const iconColorStyle = useAnimatedStyle(() => ({
    // overlay tint at active state
    opacity: 1,
  }));

  // We use two overlapping icons (active + inactive) with opacity cross-fade
  const activeIconOpacity   = useAnimatedStyle(() => ({opacity: progress.value}));
  const inactiveIconOpacity = useAnimatedStyle(() => ({opacity: 1 - progress.value}));

  const labelColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      colorProgress.value,
      [0, 1],
      [inactiveColor, primaryColor],
    ),
  }));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? {selected: true} : {}}
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={1}
      style={styles.tab}>

      {/* Top active indicator */}
      <Animated.View
        style={[
          styles.activeIndicator,
          {backgroundColor: primaryColor},
          indicatorStyle,
        ]}
      />

      {/* Icon with bounce */}
      <Animated.View style={[styles.iconWrap, iconStyle]}>
        {/* Active icon layer */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, activeIconOpacity]}>
          {Icon && <Icon size={22} color={primaryColor} strokeWidth={2.2} />}
        </Animated.View>
        {/* Inactive icon layer */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconLayer, inactiveIconOpacity]}>
          {Icon && <Icon size={22} color={inactiveColor} strokeWidth={1.8} />}
        </Animated.View>
      </Animated.View>

      {/* Label with animated color */}
      <Animated.Text
        style={[styles.label, labelColorStyle, isFocused && styles.labelActive]}
        numberOfLines={1}>
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

// ── Main TabBar ───────────────────────────────────────────────────────
export function CustomTabBar({state, descriptors, navigation}: BottomTabBarProps) {
  const {colors} = useTheme();
  const insets   = useSafeAreaInsets();
  const {tabBarTranslateY} = useTabBarScroll();

  const totalHeight = TAB_BAR_HEIGHT + insets.bottom;

  // Slide tab bar back into view on every tab switch
  useEffect(() => {
    tabBarTranslateY.value = withTiming(0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index, tabBarTranslateY]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{translateY: tabBarTranslateY.value}],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height:          totalHeight,
          paddingBottom:   insets.bottom,
          backgroundColor: colors.tabBar,
          borderTopColor:  colors.divider,
        },
        containerStyle,
      ]}>
      {state.routes.filter(r => (VISIBLE_TABS as readonly string[]).includes(r.name)).map((route) => {
        const index   = state.routes.indexOf(route);
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({type: 'tabLongPress', target: route.key});
        };

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            primaryColor={colors.primary}
            inactiveColor={colors.textTertiary}
          />
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:      'absolute',
    left:          0,
    right:         0,
    bottom:        0,
    flexDirection: 'row',
    borderTopWidth: 0,
    elevation:      8,
    shadowColor:   '#000',
    shadowOffset:  {width: 0, height: -verticalScale(2)},
    shadowOpacity: 0.08,
    shadowRadius:  moderateScale(8),
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    height:         TAB_BAR_HEIGHT,
    paddingTop:     verticalScale(4),
  },
  activeIndicator: {
    position:               'absolute',
    top:                    0,
    width:                  '40%',
    height:                 verticalScale(3),
    borderBottomLeftRadius:  moderateScale(3),
    borderBottomRightRadius: moderateScale(3),
  },
  iconWrap: {
    width:          scale(26),
    height:         scale(26),
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconLayer: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  label: {
    fontSize:   moderateScale(9),
    marginTop:  verticalScale(3),
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
  },
});
