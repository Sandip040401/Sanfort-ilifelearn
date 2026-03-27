import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {BottomTabParamList} from '@/types';
import {TabBarScrollProvider} from './TabBarScrollContext';
import {CustomTabBar} from './CustomTabBar';

// Screens (placeholders — to be replaced with real screens)
import HomeScreen      from '@/screens/home/HomeScreen';
import ARScreen        from '@/screens/ar/ARScreen';
import WebVRStack      from './WebVRStack';
import GamesScreen     from '@/screens/games/GamesScreen';
import ReadAloudScreen from '@/screens/readAloud/ReadAloudScreen';
import ARSheetsScreen  from '@/screens/arSheets/ARSheetsScreen';
import BooksStack      from './BooksStack';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const renderCustomTabBar = (props: React.ComponentProps<typeof CustomTabBar>) => (
  <CustomTabBar {...props} />
);

export function BottomTabs() {
  return (
    <TabBarScrollProvider>
      <Tab.Navigator
        screenOptions={{headerShown: false}}
        tabBar={renderCustomTabBar}>
        <Tab.Screen name="Home"      component={HomeScreen} />
        <Tab.Screen name="Themes"    component={BooksStack} />
        <Tab.Screen name="AR"        component={ARScreen} />
        <Tab.Screen name="WebVR"     component={WebVRStack} />
        <Tab.Screen name="Games"     component={GamesScreen} />
        <Tab.Screen name="ReadAloud" component={ReadAloudScreen} />
        <Tab.Screen name="ARSheets"  component={ARSheetsScreen} />
      </Tab.Navigator>
    </TabBarScrollProvider>
  );
}
