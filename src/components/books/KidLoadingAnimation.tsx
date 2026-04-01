import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BookOpen, Star, Sparkles, GraduationCap } from 'lucide-react-native';
import { useTheme } from '@/theme';

export default function KidLoadingAnimation() {
  const { colors } = useTheme();
  const bounce = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(-verticalScale(15), { duration: 500 }),
        withTiming(0, { duration: 500 })
      ),
      -1,
      true
    );

    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [bounce, pulse]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }, { scale: pulse.value }],
  }));

  const textPulse = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    ),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.main, animatedIconStyle]}>
        <View style={styles.iconStack}>
          <View style={[styles.iconCircle, { backgroundColor: '#6C4CFF' }]}>
            <BookOpen size={moderateScale(42)} color="#fff" strokeWidth={2.5} />
          </View>
          <Animated.View style={styles.floatingStar1}>
            <Star size={moderateScale(24)} color="#FFD700" fill="#FFD700" />
          </Animated.View>
          <Animated.View style={styles.floatingStar2}>
            <Sparkles size={moderateScale(28)} color="#64D2FF" fill="#64D2FF" />
          </Animated.View>
          <Animated.View style={styles.floatingStar3}>
            <GraduationCap size={moderateScale(24)} color="#FF6B6B" fill="#FF6B6B" />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.textWrap, textPulse]}>
        <Text style={styles.title}>Opening your library…</Text>
        <Text style={styles.sub}>Get ready to learn and play!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    marginBottom: verticalScale(30),
  },
  iconStack: {
    width: scale(110),
    height: scale(110),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C4CFF',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  floatingStar1: {
    position: 'absolute',
    top: -scale(10),
    right: -scale(10),
  },
  floatingStar2: {
    position: 'absolute',
    bottom: -scale(5),
    left: -scale(15),
  },
  floatingStar3: {
    position: 'absolute',
    top: scale(5),
    left: -scale(20),
  },
  textWrap: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: moderateScale(22),
    fontWeight: '900',
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  sub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: moderateScale(14),
    fontWeight: '600',
    textAlign: 'center',
  },
});
