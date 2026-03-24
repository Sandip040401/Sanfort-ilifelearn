
import React, {useEffect, useMemo} from 'react';
import {Platform, StatusBar} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import {useAuth} from '@/store';
import {useTheme} from '@/theme';
import {AuthStack} from './AuthStack';
import MainStack from './MainStack';

function RootNavigator() {
  const {isAuthenticated} = useAuth();
  const {colors, isDark}  = useTheme();

  // Memoize nav theme — prevents unnecessary re-renders
  const navTheme: Theme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card:       colors.surface,
        text:       colors.text,
        border:     colors.divider,
        primary:    colors.primary,
      },
    }),
    [isDark, colors],
  );

  // Android: transparent + translucent once; per-screen bar style via Screen component
  useEffect(() => {
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }
  }, []);

  return (
    <NavigationContainer
      theme={navTheme}
      key={isAuthenticated ? 'app' : 'auth'}>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

export {RootNavigator};
export default RootNavigator;


