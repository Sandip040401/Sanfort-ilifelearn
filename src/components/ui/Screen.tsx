import React, {memo, useCallback, useRef} from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '@/theme';

type EdgeFlags = {
  top?:    boolean;
  bottom?: boolean;
  left?:   boolean;
  right?:  boolean;
};

export type ScreenProps = {
  children:                 React.ReactNode;
  style?:                   StyleProp<ViewStyle>;
  contentContainerStyle?:   StyleProp<ViewStyle>;
  statusBarStyle?:          'light-content' | 'dark-content';
  statusBarBackgroundColor?: ColorValue;
  edges?:                   EdgeFlags;
  animateOnFocus?:          boolean;
  testID?:                  string;
};

const DEFAULT_EDGES: Required<EdgeFlags> = {
  top:    true,
  bottom: true,
  left:   true,
  right:  true,
};

const Screen = memo<ScreenProps>(function Screen({
  children,
  style,
  contentContainerStyle,
  statusBarStyle,
  statusBarBackgroundColor = 'transparent',
  edges = DEFAULT_EDGES,
  animateOnFocus = true,
  testID,
}) {
  const {isDark} = useTheme();
  const insets   = useSafeAreaInsets();

  const paddingTop    = edges.top    ? insets.top    : 0;
  const paddingBottom = edges.bottom ? insets.bottom : 0;
  const paddingLeft   = edges.left   ? insets.left   : 0;
  const paddingRight  = edges.right  ? insets.right  : 0;

  const introOpacity  = useRef(new Animated.Value(animateOnFocus ? 0 : 1)).current;
  const introTranslate = useRef(new Animated.Value(animateOnFocus ? 12 : 0)).current;

  useFocusEffect(
    useCallback(() => {
      if (!animateOnFocus) {return;}

      const anim = Animated.parallel([
        Animated.timing(introOpacity, {
          toValue:         1,
          duration:        220,
          useNativeDriver: true,
        }),
        Animated.spring(introTranslate, {
          toValue:         0,
          friction:        9,
          tension:         70,
          useNativeDriver: true,
        }),
      ]);

      anim.start();
      // Don't reset on blur — keeps screen visible during back transition
    }, [animateOnFocus, introOpacity, introTranslate]),
  );

  const barStyle: 'light-content' | 'dark-content' =
    statusBarStyle ?? (isDark ? 'light-content' : 'dark-content');

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {paddingTop, paddingBottom, paddingLeft, paddingRight},
        style,
      ]}>
      <StatusBar
        translucent
        backgroundColor={statusBarBackgroundColor as string}
        barStyle={barStyle}
        animated
      />
      <Animated.View
        style={[
          styles.content,
          {
            opacity:   introOpacity,
            transform: [{translateY: introTranslate}],
          },
          contentContainerStyle,
        ]}>
        {children}
      </Animated.View>
    </View>
  );
});

export default Screen;

const styles = StyleSheet.create({
  root:    {flex: 1},
  content: {flex: 1},
});
