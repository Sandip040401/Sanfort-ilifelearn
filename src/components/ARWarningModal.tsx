
import React, {useEffect} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {AlertTriangle, Shield, User, Landmark} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale, verticalScale} from 'react-native-size-matters';

interface ARWarningModalProps {
  visible: boolean;
  onConfirm: () => void;
}

export default function ARWarningModal({visible, onConfirm}: ARWarningModalProps) {
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
      onRequestClose={onConfirm}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onConfirm} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, {backgroundColor: colors.surface}, cardStyle]}>
          {/* Header Row */}
          <View style={styles.header}>
            <View style={[styles.cautionBox, {backgroundColor: '#FFA500'}]}>
              <AlertTriangle size={moderateScale(24)} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <View style={styles.cautionTextBox}>
              <Text style={styles.cautionText}>CAUTION</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Middle Section with Shield and Adult/Child */}
            <View style={styles.shieldSection}>
              <View style={[styles.shieldContainer, {backgroundColor: '#FFA500'}]}>
                <View style={styles.iconWrapper}>
                   <User size={moderateScale(44)} color="#FFFFFF" strokeWidth={2} style={styles.adultIcon} />
                   <User size={moderateScale(27)} color="#FFFFFF" strokeWidth={2} style={styles.childIcon} />
                </View>
                <Shield size={moderateScale(64)} color="#FFFFFF" strokeWidth={1} style={styles.shieldIcon} />
              </View>
              
              <View style={styles.mainTextBox}>
                <Text style={[styles.mainText, {color: colors.textSecondary}]}>
                  Always ask a grown-up before using this app. Watch out for other people when using this app and be aware of your surroundings.
                </Text>
              </View>
            </View>

            {/* Bottom Section: Parents' Note */}
            <View style={styles.parentsNoteSection}>
              <Text style={styles.parentsTitle}>Parents and guardians please note:</Text>
              <Text style={[styles.noteText, {color: colors.textSecondary}]}>
                It is recommended that younger children have adult supervision while using Augmented Reality. While using Augmented Reality there is a tendency for users to step backwards to view Augmented 3D animals & other 3D Models.
              </Text>
            </View>
          </ScrollView>

          {/* OK Button */}
          <TouchableOpacity
            style={[styles.btn, {backgroundColor: '#FFA500'}]}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>OK</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropPress: {flex: 1},
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(20),
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    height: verticalScale(50),
    backgroundColor: '#EEEEEE',
  },
  cautionBox: {
    flex: 0.25,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: moderateScale(24),
  },
  cautionTextBox: {
    flex: 0.75,
    justifyContent: 'center',
    paddingLeft: moderateScale(15),
  },
  cautionText: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    color: '#333',
    letterSpacing: 1,
  },
  scrollContent: {
    padding: moderateScale(20),
  },
  shieldSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  shieldContainer: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: moderateScale(15),
  },
  shieldIcon: {
    opacity: 0.3,
  },
  iconWrapper: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingBottom: moderateScale(10),
  },
  adultIcon: {
    marginBottom: moderateScale(5),
  },
  childIcon: {
    marginLeft: moderateScale(-5),
    marginBottom: moderateScale(3),
  },
  mainTextBox: {
    flex: 1,
  },
  mainText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  parentsNoteSection: {
    marginTop: verticalScale(5),
  },
  parentsTitle: {
    fontSize: moderateScale(15),
    fontWeight: 'bold',
    color: '#FF4D6D', // Soft pinkish-red
    marginBottom: verticalScale(8),
  },
  noteText: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(19),
    fontWeight: '500',
  },
  btn: {
    height: verticalScale(48),
    marginHorizontal: moderateScale(20),
    marginBottom: moderateScale(20),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: moderateScale(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
