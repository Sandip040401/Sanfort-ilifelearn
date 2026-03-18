
import React, {useEffect} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {WifiOff} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale, verticalScale} from 'react-native-size-matters';

interface NetworkModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function NetworkModal({visible, onDismiss}: NetworkModalProps) {
  const {colors} = useTheme();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {duration: 250, easing: Easing.out(Easing.cubic)});
      scale.value = withSpring(1, {damping: 18, stiffness: 300});
    } else {
      opacity.value = withTiming(0, {duration: 200});
      scale.value = withTiming(0.9, {duration: 200});
    }
  }, [visible, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({opacity: opacity.value}));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scale.value}],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onDismiss} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, {backgroundColor: colors.surface}, cardStyle]}>
          <View style={[styles.iconContainer, {backgroundColor: colors.errorSurface}]}>
            <WifiOff size={moderateScale(40)} color={colors.error} strokeWidth={2.5} />
          </View>

          <Text style={[styles.title, {color: colors.text}]}>No Internet Connection</Text>
          <Text style={[styles.message, {color: colors.textSecondary}]}>
            It seems you're offline. Please check your network settings and try again.
          </Text>

          <TouchableOpacity
            style={[styles.btn, {backgroundColor: colors.primary}]}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdropPress: {flex: 1},
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(30),
  },
  card: {
    width: '100%',
    borderRadius: moderateScale(28),
    padding: moderateScale(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: verticalScale(12),
  },
  message: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(24),
  },
  btn: {
    width: '100%',
    height: verticalScale(50),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  btnText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
