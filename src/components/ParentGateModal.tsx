import React, {useEffect, useState, useRef} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {Baby, Lock, X} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale, verticalScale, scale} from 'react-native-size-matters';

interface ParentGateModalProps {
  visible: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ParentGateModal({visible, onSuccess, onCancel}: ParentGateModalProps) {
  const {colors, isDark} = useTheme();
  
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [answer, setAnswer] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const scaleValue = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Generate new problem
      const n1 = Math.floor(Math.random() * 10) + 10; // 10-19
      const n2 = Math.floor(Math.random() * 9) + 1;  // 1-9
      setNum1(n1);
      setNum2(n2);
      setAnswer(n1 + n2);
      setUserInput('');
      setIsError(false);
      setIsVerifying(false);
      setIsSuccess(false);

      opacity.value = withTiming(1, {duration: 250, easing: Easing.out(Easing.cubic)});
      scaleValue.value = withSpring(1, {damping: 18, stiffness: 300});
    } else {
      opacity.value = withTiming(0, {duration: 200});
      scaleValue.value = withTiming(0.9, {duration: 200});
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scaleValue.value}],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleVerify = () => {
    if (parseInt(userInput, 10) === answer) {
      setIsVerifying(true);
      setIsError(false);
      
      // Dramatic success beat
      setTimeout(() => {
        setIsSuccess(true);
        setIsVerifying(false);
        setTimeout(() => {
            onSuccess();
        }, 800);
      }, 400);
    } else {
      setIsError(true);
      // Shake effect or simple red highlight
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onCancel} />
        </Animated.View>

        <View style={styles.center} pointerEvents="box-none">
          <Animated.View style={[styles.card, {backgroundColor: colors.card}, containerStyle]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconBox, {backgroundColor: isDark ? '#064E3B' : '#ECFDF5'}]}>
                {isSuccess ? (
                   <Lock size={moderateScale(24)} color={colors.primary} />
                ) : (
                   <Baby size={moderateScale(28)} color={colors.primary} />
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onCancel}>
                <X size={moderateScale(20)} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {isSuccess ? (
                <View style={styles.successView}>
                    <Text style={[styles.title, {color: colors.text}]}>Identity Verified!</Text>
                    <Text style={[styles.desc, {color: colors.textSecondary}]}>
                        Access granted. Opening link...
                    </Text>
                    <ActivityIndicator color={colors.primary} style={{marginTop: 20}} />
                </View>
            ) : (
                <>
                    <Text style={[styles.title, {color: colors.text}]}>Parent Gate</Text>
                    <Text style={[styles.desc, {color: colors.textSecondary}]}>
                        Please solve this math problem to verify you're a parent or teacher.
                    </Text>

                    <View style={styles.mathZone}>
                        <Text style={[styles.mathText, {color: colors.primary}]}>
                            {num1} + {num2} = ?
                        </Text>
                    </View>

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: isError ? colors.error : colors.divider,
                            }
                        ]}
                        placeholder="Answer"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        value={userInput}
                        onChangeText={(t) => {
                            setUserInput(t);
                            if (isError) setIsError(false);
                        }}
                        autoFocus
                        maxLength={3}
                    />

                    {isError && (
                        <Text style={[styles.errorText, {color: colors.error}]}>
                            Incorrect answer. Please try again.
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.verifyBtn,
                            {backgroundColor: colors.primary},
                            isVerifying && {opacity: 0.8}
                        ]}
                        onPress={handleVerify}
                        disabled={isVerifying || !userInput}
                    >
                        {isVerifying ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.verifyBtnText}>Verify Identity</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                        <Text style={[styles.cancelBtnText, {color: colors.textTertiary}]}>Cancel</Text>
                    </TouchableOpacity>
                </>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  flex: {flex: 1},
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(24),
  },
  card: {
    width: '100%',
    maxWidth: scale(320),
    borderRadius: moderateScale(24),
    padding: moderateScale(20),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  iconBox: {
    width: moderateScale(54),
    height: moderateScale(54),
    borderRadius: moderateScale(27),
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: -moderateScale(4),
    top: -moderateScale(4),
    padding: 8,
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: verticalScale(4),
  },
  desc: {
    fontSize: moderateScale(12),
    textAlign: 'center',
    lineHeight: moderateScale(18),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(10),
  },
  mathZone: {
    marginBottom: verticalScale(16),
  },
  mathText: {
    fontSize: moderateScale(32),
    fontWeight: '900',
    letterSpacing: 2,
  },
  input: {
    width: '100%',
    height: verticalScale(48),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: moderateScale(18),
    fontWeight: '700',
    paddingHorizontal: scale(16),
  },
  errorText: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(6),
  },
  verifyBtn: {
    width: '100%',
    height: verticalScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(16),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: verticalScale(12),
    padding: 6,
  },
  cancelBtnText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },

  successView: {
    alignItems: 'center',
    paddingVertical: verticalScale(10),
  }
});
