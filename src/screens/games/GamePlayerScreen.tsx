import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {ArrowLeft, RefreshCcw, TriangleAlert} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import Orientation from 'react-native-orientation-locker';
import LinearGradient from 'react-native-linear-gradient';
import {useTheme} from '@/theme';
import type {MainStackParamList} from '@/types';
import CustomAlert from '@/components/CustomAlert';

type GamePlayerRouteProp = RouteProp<MainStackParamList, 'GamePlayer'>;
type GamePlayerNavigationProp = StackNavigationProp<MainStackParamList, 'GamePlayer'>;

export default function GamePlayerScreen() {
  const {colors} = useTheme();
  const navigation = useNavigation<GamePlayerNavigationProp>();
  const route = useRoute<GamePlayerRouteProp>();
  const {gameTitle, gameUrl} = route.params;
  const [webKey, setWebKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    Orientation.lockToLandscape();

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      Orientation.lockToPortrait();
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const progressWidth = useMemo(
    () => ({width: `${Math.max(progress * 100, 10)}%` as const}),
    [progress],
  );

  const handleReload = () => {
    setHasError(false);
    setIsLoading(true);
    setProgress(0.1);
    setWebKey(current => current + 1);
  };

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setControlsVisible(false);
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [clearHideTimer, controlsOpacity]);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (isLoading || hasError) {
      return;
    }

    hideTimer.current = setTimeout(() => {
      hideControls();
    }, 1800);
  }, [clearHideTimer, hasError, hideControls, isLoading]);

  const showControls = useCallback(
    (autoHide = true) => {
      clearHideTimer();
      setControlsVisible(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        if (autoHide) {
          scheduleHide();
        }
      });
    },
    [clearHideTimer, controlsOpacity, scheduleHide],
  );

  useEffect(() => {
    if (isLoading || hasError) {
      showControls(false);
      return;
    }

    showControls(true);
  }, [hasError, isLoading, showControls]);

  return (
    <View style={styles.root}>
      <StatusBar hidden barStyle="light-content" />

      <WebView
        key={webKey}
        source={{uri: gameUrl}}
        originWhitelist={['*']}
        style={styles.webview}
        startInLoadingState
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        mediaPlaybackRequiresUserAction={false}
        onLoadStart={() => {
          setHasError(false);
          setIsLoading(true);
          setProgress(0.15);
        }}
        onLoadProgress={({nativeEvent}) => {
          setProgress(nativeEvent.progress || 0.2);
        }}
        onLoadEnd={() => {
          setProgress(1);
          setIsLoading(false);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onHttpError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        injectedJavaScript={`
          (function() {
            // Override browser close/back to signal the app
            window.close = function() {
              window.ReactNativeWebView.postMessage('closeGame');
            };
            window.history.back = function() {
              window.ReactNativeWebView.postMessage('closeGame');
            };
            
            // Listen for window messages from the game (common in some web game engines)
            window.addEventListener('message', function(event) {
              var msg = event.data;
              if (typeof msg === 'string' && (
                msg.toLowerCase() === 'close' || 
                msg.toLowerCase() === 'exit' || 
                msg.toLowerCase() === 'quit' ||
                msg.toLowerCase() === 'closegame'
              )) {
                window.ReactNativeWebView.postMessage('closeGame');
              }
            });
          })();
          true;
        `}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'closeGame') {
            setShowExitConfirm(true);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingLayer}>
            <View style={styles.loadingOrb}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          </View>
        )}
      />

      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.controlsShell}
        pointerEvents="box-none">
        <Animated.View
          pointerEvents={controlsVisible ? 'auto' : 'none'}
          style={[styles.controlsRow, {opacity: controlsOpacity}]}>
          <Pressable
            onPress={() => setShowExitConfirm(true)}
            onPressIn={() => showControls(true)}
            style={styles.iconButton}>
            <ArrowLeft size={moderateScale(20)} color="#fff" strokeWidth={2.2} />
          </Pressable>

          <View style={styles.controlsSpacer} />

          <Pressable
            onPress={handleReload}
            onPressIn={() => showControls(true)}
            style={styles.iconButton}>
            <RefreshCcw size={moderateScale(18)} color="#fff" strokeWidth={2.2} />
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {!isLoading && !hasError && !controlsVisible && (
        <Pressable onPress={() => showControls(true)} style={styles.revealHandle}>
          <View style={styles.revealHandleBar} />
        </Pressable>
      )}

      {isLoading && !hasError && (
        <View style={styles.progressWrap} pointerEvents="none">
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, progressWidth]} />
          </View>
        </View>
      )}

      {hasError && (
        <View style={[styles.errorLayer, {backgroundColor: colors.overlay}]}>
          <LinearGradient
            colors={['rgba(15,23,42,0.96)', 'rgba(30,41,59,0.96)']}
            locations={[0, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <TriangleAlert size={moderateScale(28)} color="#F8FAFC" strokeWidth={2.2} />
            </View>
            <Text style={styles.errorTitle}>Unable to open this game</Text>
            <Text style={styles.errorCopy}>
              {gameTitle} could not load right now. Reload once or exit back to the catalog.
            </Text>
            <View style={styles.errorActions}>
              <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Exit</Text>
              </Pressable>
              <Pressable onPress={handleReload} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Reload</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      )}

      <CustomAlert
        visible={showExitConfirm}
        type="warning"
        title="Exit Game?"
        message={`Are you sure you want to exit "${gameTitle}"? Any unsaved progress will be lost.`}
        confirmText="Yes, Exit"
        cancelText="No, Keep Playing"
        onConfirm={() => {
          setShowExitConfirm(false);
          navigation.goBack();
        }}
        onCancel={() => setShowExitConfirm(false)}
        onDismiss={() => setShowExitConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webview: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.35)',
  },
  loadingOrb: {
    width: scale(44),
    height: scale(44),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  controlsShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: scale(18),
    paddingTop: verticalScale(6),
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsSpacer: {
    flex: 1,
  },
  iconButton: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  revealHandle: {
    position: 'absolute',
    top: verticalScale(8),
    alignSelf: 'center',
    width: scale(70),
    height: verticalScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealHandleBar: {
    width: scale(38),
    height: verticalScale(5),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  progressWrap: {
    position: 'absolute',
    top: verticalScale(18),
    left: scale(18),
    right: scale(18),
    alignItems: 'center',
  },
  progressTrack: {
    width: '38%',
    minWidth: scale(180),
    maxWidth: scale(360),
    height: verticalScale(4),
    borderRadius: moderateScale(999),
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressFill: {
    height: '100%',
    borderRadius: moderateScale(999),
    backgroundColor: '#60A5FA',
  },
  errorLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(24),
  },
  errorCard: {
    width: '100%',
    maxWidth: scale(440),
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(22),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  errorIconWrap: {
    width: scale(58),
    height: scale(58),
    borderRadius: moderateScale(29),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  errorTitle: {
    marginTop: verticalScale(16),
    fontSize: moderateScale(19),
    fontWeight: '800',
    color: '#fff',
  },
  errorCopy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    textAlign: 'center',
    color: 'rgba(255,255,255,0.68)',
  },
  errorActions: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: verticalScale(20),
  },
  secondaryButton: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(11),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#fff',
  },
  primaryButton: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(11),
    borderRadius: moderateScale(14),
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: '#fff',
  },
});
