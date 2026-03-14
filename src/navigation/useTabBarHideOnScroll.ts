import {useCallback, useRef} from 'react';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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
        tabBarTranslateY.value = 0;
        return;
      }
      if (diff > 0) {
        tabBarTranslateY.value = Math.min(tabBarTranslateY.value + diff, tabBarHeight);
      } else {
        tabBarTranslateY.value = Math.max(tabBarTranslateY.value + diff, 0);
      }
    },
    [tabBarTranslateY, tabBarHeight],
  );

  return {onScroll, tabBarHeight};
}
