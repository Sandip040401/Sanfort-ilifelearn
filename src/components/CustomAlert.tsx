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
import {AlertTriangle, CheckCircle2, Info, XCircle} from 'lucide-react-native';
import {useTheme} from '@/theme';
import {moderateScale} from 'react-native-size-matters';

export type AlertType = 'error' | 'success' | 'warning' | 'info';

export interface CustomAlertProps {
  visible:    boolean;
  type?:      AlertType;
  title:      string;
  message:    string;
  confirmText?:  string;
  cancelText?:   string;
  onConfirm?: () => void;
  onCancel?:  () => void;
  onDismiss:  () => void;
}

const TYPE_CONFIG: Record<AlertType, {icon: any; color: string; bg: string}> = {
  error:   {icon: XCircle, color: '#EF4444', bg: '#FEF2F2'},
  success: {icon: CheckCircle2, color: '#22C55E', bg: '#F0FDF4'},
  warning: {icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB'},
  info:    {icon: Info, color: '#3B82F6', bg: '#EFF6FF'},
};

export default function CustomAlert({
  visible,
  type = 'error',
  title,
  message,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
  onDismiss,
}: CustomAlertProps) {
  const {colors} = useTheme();
  const cfg      = TYPE_CONFIG[type];
  const Icon     = cfg.icon;

  const scale   = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, {duration: 200, easing: Easing.out(Easing.cubic)});
      scale.value   = withSpring(1, {damping: 18, stiffness: 280});
    } else {
      opacity.value = withTiming(0, {duration: 150});
      scale.value   = withTiming(0.9, {duration: 150});
    }
  }, [visible, opacity, scale]);

  const backdropStyle = useAnimatedStyle(() => ({opacity: opacity.value}));
  const cardStyle     = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{scale: scale.value}],
  }));

  const handleConfirm = () => {
    onConfirm?.();
    onDismiss();
  };

  const handleCancel = () => {
    onCancel?.();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
      accessibilityViewIsModal>

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.backdropPress} onPress={onDismiss} />
      </Animated.View>

      {/* Card */}
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, {backgroundColor: colors.surface}, cardStyle]}>

          {/* Icon circle */}
          <View style={[styles.iconCircle, {backgroundColor: cfg.bg}]}>
            <Icon size={moderateScale(32)} color={cfg.color} strokeWidth={2.5} />
          </View>

          {/* Title */}
          <Text
            style={[styles.title, {color: colors.text}]}
            accessibilityRole="header">
            {title}
          </Text>

          {/* Message */}
          <Text style={[styles.message, {color: colors.textSecondary}]}>
            {message}
          </Text>

          {/* Divider */}
          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          {/* Buttons */}
          <View style={[styles.btnRow, cancelText && styles.btnRowDouble]}>
            {cancelText ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, {borderColor: colors.border}]}
                onPress={handleCancel}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={cancelText}>
                <Text style={[styles.btnSecText, {color: colors.textSecondary}]}>
                  {cancelText}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.btnPrimary,
                {backgroundColor: cfg.color},
                cancelText ? styles.btnFlex : styles.btnFull,
              ]}
              onPress={handleConfirm}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={confirmText}>
              <Text style={styles.btnPriText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)'},
  backdropPress: {flex: 1},
  center:        {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28},

  card: {
    width: '100%', borderRadius: 24,
    paddingTop: 32, paddingHorizontal: 24, paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title:     {fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8},
  message:   {fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20},
  divider:   {width: '100%', height: 1, marginBottom: 16},

  btnRow:       {flexDirection: 'row', width: '100%', gap: 10},
  btnRowDouble: {},
  btn:          {height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  btnFull:      {width: '100%'},
  btnFlex:      {flex: 1},
  btnPrimary:   {},
  btnSecondary: {flex: 1, borderWidth: 1.5},
  btnPriText:   {fontSize: 15, fontWeight: '700', color: '#fff'},
  btnSecText:   {fontSize: 15, fontWeight: '600'},
});

