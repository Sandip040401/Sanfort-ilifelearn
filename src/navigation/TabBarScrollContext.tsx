import React, {createContext, useContext, useMemo} from 'react';
import {useSharedValue, type SharedValue} from 'react-native-reanimated';

interface TabBarScrollContextValue {
  tabBarTranslateY: SharedValue<number>;
}

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

export function TabBarScrollProvider({children}: {children: React.ReactNode}) {
  const tabBarTranslateY = useSharedValue(0);

  const value = useMemo(
    () => ({tabBarTranslateY}),
    [tabBarTranslateY],
  );

  return (
    <TabBarScrollContext.Provider value={value}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarScroll() {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) {
    throw new Error('useTabBarScroll must be used within TabBarScrollProvider');
  }
  return ctx;
}
