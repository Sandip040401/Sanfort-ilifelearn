import React, {useEffect} from 'react';
import {StyleSheet, type ViewStyle} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useTheme} from '@/theme';

interface SkeletonProps {
  width:        number | `${number}%`;
  height:       number;
  borderRadius?: number;
  style?:       ViewStyle;
}

function SkeletonComponent({width, height, borderRadius = 8, style}: SkeletonProps) {
  const {colors} = useTheme();
  const opacity  = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, {duration: 800, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.base,
        {width, height, borderRadius, backgroundColor: colors.skeleton},
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {overflow: 'hidden'},
});

export const Skeleton = React.memo(SkeletonComponent);
