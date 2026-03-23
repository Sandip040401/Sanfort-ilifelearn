import React from 'react';
import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
  type StackNavigationOptions,
} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import type {MainStackParamList} from '@/types';
import {BottomTabs} from './BottomTabs';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import GamePlayerScreen from '@/screens/games/GamePlayerScreen';
import ARViewerScreen from '@/screens/ar/ARViewerScreen';
import PrivacyPolicyScreen from '@/screens/profile/PrivacyPolicyScreen';

const Stack = createStackNavigator<MainStackParamList>();

function MainStack() {
  const {colors} = useTheme();

  const screenOptions: StackNavigationOptions = {
    headerShown:          false,
    gestureEnabled:       false,
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: {
      open:  TransitionSpecs.TransitionIOSSpec,
      close: TransitionSpecs.TransitionIOSSpec,
    },
    cardOverlayEnabled:   true,
    detachPreviousScreen: false,
    cardStyle: {backgroundColor: colors.background},
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="BottomTabs" component={BottomTabs} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="GamePlayer" component={GamePlayerScreen} />
      <Stack.Screen name="ARViewer" component={ARViewerScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    </Stack.Navigator>
  );
}

export default MainStack;
