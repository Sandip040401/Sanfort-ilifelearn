
import React, {useEffect} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {X, Gamepad2, Stars} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale, verticalScale, scale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';

const EduGamesImg = require('@/assets/images/home_screen/Edu-Games.webp');

interface ComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function ComingSoonModal({
  visible,
  onClose,
  title = "Coming Soon!",
  description = "We're working hard to bring you the best interactive educational games. Stay tuned for an amazing experience!"
}: ComingSoonModalProps) {
  const {colors} = useTheme();
  const scaleValue = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {duration: 300, easing: Easing.out(Easing.cubic)});
      scaleValue.value = withSpring(1, {damping: 15, stiffness: 200});
    } else {
      opacity.value = withTiming(0, {duration: 200});
      scaleValue.value = withTiming(0.9, {duration: 200});
    }
  }, [visible, opacity, scaleValue]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scaleValue.value}],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.flex} onPress={onClose} />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View style={[styles.card, {backgroundColor: colors.surface}, cardStyle]}>
            {/* Header with Gradient Background */}
            <View style={styles.header}>
              <LinearGradient
                colors={['#4F46E5', '#7E22CE']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.headerGradient}
              />
              <View style={styles.iconContainer}>
                <Image source={EduGamesImg} style={styles.heroImage} resizeMode="contain" />
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={moderateScale(20)} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Content Section */}
            <View style={styles.content}>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, {backgroundColor: 'rgba(79, 70, 229, 0.1)'}]}>
                  <Stars size={moderateScale(12)} color="#4F46E5" fill="#4F46E5" />
                  <Text style={styles.badgeText}>Exciting Update</Text>
                </View>
              </View>

              <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
              <Text style={[styles.desc, {color: colors.textSecondary}]}>
                {description}
              </Text>

              <TouchableOpacity
                style={[styles.btn]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4F46E5', '#6366F1']}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.btnGradient}
                />
                <Text style={styles.btnText}>Great, can't wait!</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  flex: {
    flex: 1,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(20),
  },
  card: {
    width: '100%',
    maxWidth: scale(340),
    borderRadius: moderateScale(30),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 24,
  },
  header: {
    height: verticalScale(140),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  iconContainer: {
    width: scale(100),
    height: scale(100),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: moderateScale(16),
    right: moderateScale(16),
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: moderateScale(24),
    alignItems: 'center',
  },
  badgeRow: {
    marginBottom: verticalScale(12),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(999),
  },
  badgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },
  desc: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    lineHeight: moderateScale(22),
    marginBottom: verticalScale(24),
    paddingHorizontal: scale(10),
  },
  btn: {
    width: '100%',
    height: verticalScale(52),
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  btnText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
