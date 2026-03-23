import {useCallback, useRef} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {withTiming} from 'react-native-reanimated';
import {TAB_BAR_HEIGHT} from './CustomTabBar';
import {useTabBarScroll} from './TabBarScrollContext';

export function useTabBarHideOnScroll() {
  const {tabBarTranslateY} = useTabBarScroll();
  const lastScrollY = useRef(0);
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const diff = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 0) {
        tabBarTranslateY.value = withTiming(0, {duration: 200});
        return;
      }
      if (diff > 0) {
        tabBarTranslateY.value = withTiming(tabBarHeight, {duration: 200});
      } else if (diff < -2) {
        tabBarTranslateY.value = withTiming(0, {duration: 200});
      }
    },
    [tabBarTranslateY, tabBarHeight],
  );

  return {onScroll, tabBarHeight};
}
