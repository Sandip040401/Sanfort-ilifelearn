import React from 'react';
import {
  createStackNavigator,
  CardStyleInterpolators,
  TransitionSpecs,
  type StackNavigationOptions,
} from '@react-navigation/stack';
import {useTheme} from '@/theme';
import type {AuthStackParamList} from '@/types';
import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import LoginScreen   from '@/screens/auth/LoginScreen';

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const {colors} = useTheme();

  const screenOptions: StackNavigationOptions = {
    headerShown:           false,
    gestureEnabled:        false,
    cardStyleInterpolator:  CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: {
      open:  TransitionSpecs.TransitionIOSSpec,
      close: TransitionSpecs.TransitionIOSSpec,
    },
    cardOverlayEnabled:   true,
    detachPreviousScreen: false,
    cardStyle:            {backgroundColor: colors.primary},
  };

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="Welcome">
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login"   component={LoginScreen} />
    </Stack.Navigator>
  );
}
