import React, {useState} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import type {StackNavigationProp} from '@react-navigation/stack';
import {ArrowLeft, Lock, Mail, Sparkles, Trash2} from 'lucide-react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import CustomAlert from '@/components/CustomAlert';
import {useTheme} from '@/theme';
import {AuthService} from '@/services';
import type {AuthStackParamList} from '@/types';
import Animated, {FadeInDown, FadeInUp, ZoomIn, FadeIn} from 'react-native-reanimated';
import {CheckCircle2, AlertTriangle, X} from 'lucide-react-native';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'DeleteAccount'>;
};

export default function DeleteAccountScreen({navigation}: Props) {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'input' | 'success'>('input');
  
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);

  const isTablet = screenWidth >= 768;
  const contentWidth = isTablet ? Math.min(screenWidth * 0.55, 480) : undefined;
  const wrapStyle = contentWidth ? {width: contentWidth, alignSelf: 'center' as const} : undefined;

  const handleDelete = () => {
    if (!email || !password) {
      setAlertMessage('Please enter both your email and password.');
      setAlertVisible(true);
      return;
    }
    Keyboard.dismiss();
    setConfirmVisible(true);
  };

  const executeDelete = async () => {
    setConfirmVisible(false);
    setLoading(true);
    try {
      await AuthService.deleteAccount({email: email.trim(), password});
      setStatus('success');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 3000);
    } catch (error: any) {
      setAlertMessage(error?.response?.data?.message || error?.message || 'Failed to delete account. Please check your credentials.');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <View style={[styles.safe, {backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center'}]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View 
          entering={ZoomIn.duration(600)}
          style={[styles.successIcon, {backgroundColor: isDark ? '#064E3B' : '#F0FDF4'}]}>
          <CheckCircle2 size={48} color={colors.success} />
        </Animated.View>
        <Text style={[styles.title, {color: colors.text, textAlign: 'center'}]}>Account Deleted</Text>
        <Text style={[styles.subtitle, {color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40}]}>
          Your account has been permanently removed. Returning to login...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: colors.surface}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <Animated.View 
        entering={FadeInDown.duration(600)}
        style={[styles.header, {paddingTop: insets.top}]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Delete Account</Text>
        <View style={{width: 40}} />
      </Animated.View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{flex: 1}}>
        <ScrollView 
          contentContainerStyle={[styles.scroll, wrapStyle]}
          showsVerticalScrollIndicator={false}>
          
          <Animated.View 
            entering={FadeInDown.delay(200).duration(800)}
            style={styles.hero}>
            <Animated.View 
              entering={ZoomIn.delay(400).duration(600)}
              style={[styles.iconBox, {backgroundColor: '#FEF2F2'}]}>
              <Trash2 size={32} color="#EF4444" />
            </Animated.View>
            <Text style={[styles.title, {color: colors.text}]}>Permanent Deletion</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              Enter your credentials to confirm you want to permanently wipe all your account data.
            </Text>
          </Animated.View>

          <Animated.View 
            entering={FadeInUp.delay(400).duration(800)}
            style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Email Address</Text>
              <View style={[styles.inputRow, {borderColor: colors.border, backgroundColor: colors.surface}]}>
                <Mail size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="hello@example.com"
                  placeholderTextColor={colors.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Password</Text>
              <View style={[styles.inputRow, {borderColor: colors.border, backgroundColor: colors.surface}]}>
                <Lock size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(800)}>
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                Warning: This action cannot be undone. All your progress, favorites, and profile data will be lost forever.
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.deleteBtn, {opacity: loading ? 0.7 : 1}]}
              onPress={handleDelete}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteBtnText}>Delete Permanently</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        type="error"
        title="Deletion Failed"
        message={alertMessage}
        onDismiss={() => setAlertVisible(false)}
      />

      {/* Confirmation Modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Animated.View 
            entering={FadeIn.duration(300)}
            style={styles.modalOverlay} 
          />
          <View style={styles.modalCenter}>
            <Animated.View 
              entering={ZoomIn.duration(400)}
              style={[styles.modalCard, {backgroundColor: colors.card, borderColor: colors.border}]}
            >
              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={() => setConfirmVisible(false)}
              >
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>

              <View style={[styles.iconCircle, {backgroundColor: '#FEF2F2'}]}>
                <AlertTriangle size={32} color="#EF4444" />
              </View>

              <Text style={[styles.modalTitle, {color: colors.text}]}>Are you sure?</Text>
              <Text style={[styles.modalDesc, {color: colors.textSecondary}]}>
                Are you sure you want to delete your account? This action is permanent and cannot be reversed.
              </Text>

              <View style={styles.modalWarningBox}>
                <Text style={styles.modalWarningText}>
                  Warning: All your progress, favorites, and profile data will be lost forever.
                </Text>
              </View>

              <View style={styles.finalBtnRow}>
                <TouchableOpacity 
                  style={[styles.finalBtn, styles.finalBtnNo, {borderColor: colors.border}]}
                  onPress={() => setConfirmVisible(false)}
                >
                  <Text style={[styles.finalBtnText, {color: colors.text}]}>No, Keep it</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.finalBtn, styles.finalBtnYes, {backgroundColor: '#EF4444'}]}
                  onPress={executeDelete}
                >
                  <Text style={[styles.finalBtnText, {color: '#fff'}]}>Yes, Delete</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(10),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {fontSize: moderateScale(16), fontWeight: '700'},
  scroll: {padding: scale(20), flexGrow: 1},
  hero: {alignItems: 'center', marginBottom: verticalScale(30)},
  iconBox: {
    width: scale(72),
    height: scale(72),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(16),
  },
  title: {fontSize: moderateScale(22), fontWeight: '800', marginBottom: verticalScale(8)},
  subtitle: {fontSize: moderateScale(14), textAlign: 'center', lineHeight: 22},
  card: {borderRadius: 20, padding: 18, borderWidth: 1, gap: 16},
  inputGroup: {gap: 6},
  label: {fontSize: 12, fontWeight: '600', marginLeft: 4},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  input: {flex: 1, fontSize: 14},
  warningContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  warningText: {color: '#BE123C', fontSize: 13, textAlign: 'center', lineHeight: 20, fontWeight: '500'},
  deleteBtn: {
    marginTop: 30,
    height: 54,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteBtnText: {color: '#fff', fontSize: 16, fontWeight: '700'},
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  // Modal styles
  modalRoot: { flex: 1 },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {elevation: 10},
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalWarningBox: {
    width: '100%',
    padding: 14,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: 24,
  },
  modalWarningText: {
    color: '#BE123C',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  finalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  finalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalBtnNo: {
    borderWidth: 1,
  },
  finalBtnYes: {
    //
  },
  finalBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
