import React from 'react';
import {
  CardStyleInterpolators,
  TransitionSpecs,
  createStackNavigator,
  type StackNavigationOptions,
} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import type {WebVRStackParamList} from '@/types';
import WebVRScreen from '@/screens/webvr/WebVRScreen';
import WebVRFolderScreen from '@/screens/webvr/WebVRFolderScreen';

const Stack = createStackNavigator<WebVRStackParamList>();

export default function WebVRStack() {
  const {colors} = useTheme();

  const screenOptions: StackNavigationOptions = {
    headerShown: false,
    gestureEnabled: false,
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: {
      open: TransitionSpecs.TransitionIOSSpec,
      close: TransitionSpecs.TransitionIOSSpec,
    },
    cardOverlayEnabled: true,
    detachPreviousScreen: false,
    cardStyle: {backgroundColor: colors.background},
  };

  return (
    <Stack.Navigator initialRouteName="WebVRHome" screenOptions={screenOptions}>
      <Stack.Screen name="WebVRHome" component={WebVRScreen} />
      <Stack.Screen name="WebVRFolder" component={WebVRFolderScreen} />
    </Stack.Navigator>
  );
}
