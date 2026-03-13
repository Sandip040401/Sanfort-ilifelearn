import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import NetInfo, {type NetInfoStateType} from '@react-native-community/netinfo';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale, verticalScale} from 'react-native-size-matters';
import {WifiOff} from 'lucide-react-native';
import {Typography, Spacing} from '@/theme';

interface NetworkContextValue {
  isOnline:    boolean;
  networkType: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline:    true,
  networkType: 'unknown',
});

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}

export function NetworkProvider({children}: {children: React.ReactNode}) {
  const [isOnline, setIsOnline]       = useState(true);
  const [networkType, setNetworkType] = useState<string>('unknown');
  const insets = useSafeAreaInsets();

  const bannerHeight = useSharedValue(0);
  const bannerOpacity = useSharedValue(0);

  const BANNER_HEIGHT = verticalScale(44) + insets.top;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      setNetworkType((state.type as NetInfoStateType) ?? 'unknown');
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const timingConfig = {duration: 300, easing: Easing.out(Easing.cubic)};

    if (!isOnline) {
      bannerHeight.value  = withTiming(BANNER_HEIGHT, timingConfig);
      bannerOpacity.value = withTiming(1, timingConfig);
    } else {
      bannerHeight.value  = withTiming(0, timingConfig);
      bannerOpacity.value = withTiming(0, timingConfig);
    }
  }, [isOnline, bannerHeight, bannerOpacity, BANNER_HEIGHT]);

  const bannerAnimatedStyle = useAnimatedStyle(() => ({
    height:  bannerHeight.value,
    opacity: bannerOpacity.value,
  }));

  const value = useMemo(
    () => ({isOnline, networkType}),
    [isOnline, networkType],
  );

  return (
    <NetworkContext.Provider value={value}>
      <Animated.View style={[styles.banner, {paddingTop: insets.top}, bannerAnimatedStyle]}>
        <View style={styles.bannerContent}>
          <WifiOff
            size={moderateScale(16)}
            color="#FFFFFF"
            strokeWidth={2.5}
          />
          <Text style={styles.bannerText}>No Internet Connection</Text>
        </View>
      </Animated.View>
      {children}
    </NetworkContext.Provider>
  );
}

const styles = StyleSheet.create({
  banner: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    zIndex:          9999,
    backgroundColor: '#E74C3C',
    overflow:        'hidden',
  },
  bannerContent: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  bannerText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
});
