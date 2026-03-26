
import React, {useEffect} from 'react';
import {StyleSheet, View, Text, StatusBar, Dimensions} from 'react-native';
import FastImage from 'react-native-fast-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import {BookOpen, Music, Palette} from 'lucide-react-native';
import ARIcon from '@/components/icons/ARIcon';
import WebVRIcon from '@/components/icons/WebVRIcon';
import {useTheme} from '@/theme';
import {APP_NAME} from '@/config/appInfo';
import {scale, moderateScale, verticalScale} from 'react-native-size-matters';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

const FloatingIcon = ({Icon, delay, initialX, initialY, targetX, targetY, color}: any) => {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, {duration: 800}));
    progress.value = withDelay(
      delay,
      withSpring(1, {damping: 15, stiffness: 40})
    );
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [initialX, targetX]);
    const translateY = interpolate(progress.value, [0, 1], [initialY, targetY]);
    const scale = interpolate(progress.value, [0, 1], [0.5, 1]);
    const rotate = interpolate(progress.value, [0, 1], [0, 360]);

    return {
      opacity: opacity.value,
      transform: [
        {translateX},
        {translateY},
        {scale},
        {rotate: `${rotate}deg`}
      ],
    };
  });

  return (
    <Animated.View style={[styles.floatingIconWrap, animatedStyle]}>
      <View style={[styles.floatingIconCircle, {backgroundColor: 'rgba(255,255,255,0.15)', borderColor: color}]}>
        <Icon 
          width={scale(18)} 
          height={scale(18)} 
          color={color} 
          strokeWidth={2.5} 
        />
      </View>
    </Animated.View>
  );
};

export const SplashScreen: React.FC<SplashScreenProps> = ({onFinish}) => {
  const {colors} = useTheme();
  
  // Core animations
  const mainScale = useSharedValue(0.3);
  const mainOpacity = useSharedValue(0);
  const ring1Scale = useSharedValue(0);
  const ring2Scale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);
  const exitScale = useSharedValue(1);
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    // 1. Core pop in
    mainOpacity.value = withTiming(1, {duration: 1000});
    mainScale.value = withSpring(1, {damping: 12, stiffness: 60});

    // 2. Rings expansion
    ring1Scale.value = withDelay(400, withSpring(1.4, {damping: 20}));
    ring2Scale.value = withDelay(600, withSpring(1.8, {damping: 20}));

    // 3. Text Reveal
    textOpacity.value = withDelay(1200, withTiming(1, {duration: 800}));
    textY.value = withDelay(1200, withSpring(0, {damping: 15}));

    // 4. Exit sequence
    const timer = setTimeout(() => {
      exitOpacity.value = withTiming(0, {duration: 800}, (finished) => {
        if (finished && onFinish) runOnJS(onFinish)();
      });
      exitScale.value = withTiming(1.2, {duration: 800, easing: Easing.bezier(0.4, 0, 0.2, 1)});
    }, 3200);

    return () => clearTimeout(timer);
  }, [onFinish]);

  const animatedMainStyle = useAnimatedStyle(() => ({
    opacity: mainOpacity.value,
    transform: [{scale: mainScale.value}],
  }));

  const animatedRing1Style = useAnimatedStyle(() => ({
    transform: [{scale: ring1Scale.value}],
    opacity: interpolate(ring1Scale.value, [0, 1.4], [1, 0.2]),
  }));

  const animatedRing2Style = useAnimatedStyle(() => ({
    transform: [{scale: ring2Scale.value}],
    opacity: interpolate(ring2Scale.value, [0, 1.8], [1, 0.1]),
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{translateY: textY.value}],
  }));

  const animatedExitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{scale: exitScale.value}],
  }));

  return (
    <View style={styles.outer}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <Animated.View style={[styles.container, animatedExitStyle]}>
        <LinearGradient
          colors={colors.gradient.splash}
          start={{x: 0.2, y: 0}}
          end={{x: 0.8, y: 1}}
          style={StyleSheet.absoluteFill}
        />

        {/* Floating Subject Particles - Moved up to orbit the logo center */}
        <FloatingIcon Icon={BookOpen} delay={800} initialX={-SCREEN_WIDTH/2} initialY={-SCREEN_HEIGHT/2} targetX={-scale(110)} targetY={-verticalScale(125)} color="#FF6B6B" />
        <FloatingIcon Icon={WebVRIcon} delay={1000} initialX={SCREEN_WIDTH/2} initialY={-SCREEN_HEIGHT/2} targetX={scale(110)} targetY={-verticalScale(125)} color="#4ECDC4" />
        <FloatingIcon Icon={ARIcon} delay={900} initialX={-SCREEN_WIDTH/2} initialY={0} targetX={-scale(145)} targetY={-verticalScale(10)} color="#45B7D1" />
        <FloatingIcon Icon={Music} delay={1100} initialX={SCREEN_WIDTH/2} initialY={0} targetX={scale(145)} targetY={-verticalScale(10)} color="#F9D423" />
        <FloatingIcon Icon={Palette} delay={1200} initialX={0} initialY={SCREEN_HEIGHT/2} targetX={0} targetY={verticalScale(80)} color="#FF8E53" />

        <View style={styles.centerWrapper}>
          {/* Animated Expansion Rings */}
          <Animated.View style={[styles.ring, styles.ring1, animatedRing1Style]} />
          <Animated.View style={[styles.ring, styles.ring2, animatedRing2Style]} />

          {/* Core Logo */}
          <Animated.View style={[styles.logoContainer, animatedMainStyle]}>
            <FastImage 
              source={require('@/assets/images/logo/sanfort-splash-screen-logo.png')}
              style={styles.logoImage}
              resizeMode={FastImage.resizeMode.contain}
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textStack, animatedTextStyle]}>
          <Text style={styles.appName}>
            {APP_NAME.split('').map((char, i) => (
              <Text key={i}>{char}</Text>
            ))}
          </Text>
          <View style={styles.accentBar} />
          <Text style={styles.appTagline}>Where Curiosity Meets Genius</Text>
        </Animated.View>

        {/* Premium Bottom Finish */}
        <Animated.View 
          entering={FadeIn.delay(2000)}
          style={styles.footer}
        >
          <View style={styles.dotContainer}>
            {[0, 1, 2].map((i) => (
              <PulseDot key={i} delay={2000 + i * 200} color={colors.accent} />
            ))}
          </View>
          <Text style={styles.preparingText}>SYNCHRONIZING LEARNING WORLD</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const PulseDot = ({delay, color}: any) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(withTiming(1.5, {duration: 1000}), -1, true));
    opacity.value = withDelay(delay, withRepeat(withTiming(1, {duration: 1000}), -1, true));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, {backgroundColor: color}, style]} />;
};

const styles = StyleSheet.create({
  outer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 9999,
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    width: scale(300),
    height: scale(300),
  },
  logoContainer: {
    zIndex: 10,
  },
  logoImage: {
    width: scale(120),
    height: scale(120),
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  ring1: {
    width: scale(135),
    height: scale(135),
  },
  ring2: {
    width: scale(145),
    height: scale(145),
  },
  floatingIconWrap: {
    position: 'absolute',
    zIndex: 5,
  },
  floatingIconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  textStack: {
    marginTop: verticalScale(70),
    alignItems: 'center',
    gap: verticalScale(12),
  },
  appName: {
    fontSize: moderateScale(34),
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  accentBar: {
    width: scale(60),
    height: 4,
    backgroundColor: '#F9D423',
    borderRadius: 2,
  },
  appTagline: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: verticalScale(60),
    alignItems: 'center',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: scale(12),
    marginBottom: verticalScale(16),
  },
  dot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  preparingText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
    opacity: 0.6,
  },
});
