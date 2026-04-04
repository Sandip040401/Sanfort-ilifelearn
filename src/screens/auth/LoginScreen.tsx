import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Eye, EyeOff, HelpCircle, Lock, LogIn, Mail, Phone } from 'lucide-react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import CustomAlert from '@/components/CustomAlert';
import { useAuth, useModals } from '@/store';
import { useTheme } from '@/theme';
import { AuthService } from '@/services';
import type { AuthStackParamList, ClientMeta } from '@/types';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { APP_NAME } from '@/config/appInfo';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Login'>;
};

type LoginMode = 'email' | 'phone';
type OtpStep = 'phone' | 'otp';

type FieldErrors = { email?: string; password?: string; phone?: string; otp?: string };

const OTP_RESEND_SECONDS = 30;

function validateEmailFields(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (!password.trim()) {
    errors.password = 'Password is required';
  }
  return errors;
}

function validatePhone(phone: string): string | undefined {
  const cleaned = phone.replace(/\s/g, '');
  if (!cleaned) { return 'Phone number is required'; }
  if (!/^\+?\d{10,15}$/.test(cleaned)) { return 'Enter a valid phone number'; }
  return undefined;
}

function validateOtp(otp: string): string | undefined {
  if (!otp.trim()) { return 'OTP is required'; }
  if (!/^\d{4,6}$/.test(otp.trim())) { return 'Enter a valid OTP'; }
  return undefined;
}

async function getClientMeta(): Promise<ClientMeta> {
  const [deviceId, isEmulator] = await Promise.all([
    DeviceInfo.getUniqueId(),
    DeviceInfo.isEmulator(),
  ]);
  return {
    platform: 'mobile',
    os: Platform.OS,
    osVersion: String(Platform.Version),
    appVersion: DeviceInfo.getVersion(),
    deviceModel: DeviceInfo.getModel(),
    deviceBrand: DeviceInfo.getBrand(),
    deviceId,
    isEmulator,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export default function LoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { login } = useAuth();
  const { openExternalUrl } = useModals();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const isLandscape = screenWidth > screenHeight;
  const contentWidth = isTablet ? Math.min(screenWidth * 0.55, 480) : undefined;
  const headerH = isLandscape
    ? Math.max(220, screenHeight * 0.45) + insets.top
    : Math.max(260, screenHeight * 0.38) + insets.top;

  // ── Mode ──
  const [mode, setMode] = useState<LoginMode>('phone');

  // ── Email login state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  // ── Phone/OTP state ──
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('phone');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // ── Shared state ──
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);

  // ── Resend timer countdown ──
  useEffect(() => {
    if (resendTimer <= 0) { return; }
    const id = setInterval(() => setResendTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor('transparent');
    }, []),
  );

  // ── Reset when switching mode ──
  const switchMode = (m: LoginMode) => {
    setMode(m);
    setErrors({});
    setSubmitAttempted(false);
    setOtpStep('phone');
    setOtp('');
    setResendTimer(0);
  };

  // ── Inline validation ──
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (submitAttempted) {
      setErrors(prev => ({ ...prev, email: validateEmailFields(val, password).email }));
    }
  };
  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (submitAttempted) {
      setErrors(prev => ({ ...prev, password: validateEmailFields(email, val).password }));
    }
  };
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (submitAttempted) {
      setErrors(prev => ({ ...prev, phone: validatePhone(val) }));
    }
  };
  const handleOtpChange = (val: string) => {
    setOtp(val);
    if (submitAttempted) {
      setErrors(prev => ({ ...prev, otp: validateOtp(val) }));
    }
  };

  // ── Show error alert ──
  const showError = (error: any, fallback: string) => {
    const status = error?.response?.status;
    const msg =
      error?.response?.data?.message ||
      error?.message ||
      fallback;
    const finalMsg = status === 429
      ? 'Too many attempts. Please wait a moment and try again.'
      : msg;
    setAlertMessage(finalMsg);
    setAlertVisible(true);
  };

  // ── Email Login ──
  const handleEmailLogin = async () => {
    setSubmitAttempted(true);
    const fieldErrors = validateEmailFields(email, password);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    Keyboard.dismiss();
    setLoading(true);
    try {
      const clientMeta = await getClientMeta();
      const response = await AuthService.login({
        email: email.trim(),
        password,
        clientMeta,
      });
      const { user, token } = response.data;
      if (!user || !token) { throw new Error('Invalid response from server'); }
      login(token, user);
    } catch (error: any) {
      showError(error, 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Send OTP ──
  const handleSendOtp = async () => {
    setSubmitAttempted(true);
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      setErrors({ phone: phoneErr });
      return;
    }
    setErrors({});
    Keyboard.dismiss();
    setLoading(true);
    try {
      const clientMeta = await getClientMeta();
      const response = await AuthService.sendOtp({
        phone: phone.replace(/\s/g, ''),
        clientMeta,
      });
      if (response.data?.success === false) {
        throw new Error(response.data?.message || 'Failed to send OTP');
      }
      setOtpStep('otp');
      setSubmitAttempted(false);
      setResendTimer(OTP_RESEND_SECONDS);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (error: any) {
      showError(error, 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ──
  const handleVerifyOtp = async () => {
    setSubmitAttempted(true);
    const otpErr = validateOtp(otp);
    if (otpErr) {
      setErrors({ otp: otpErr });
      return;
    }
    setErrors({});
    Keyboard.dismiss();
    setLoading(true);
    try {
      const clientMeta = await getClientMeta();
      const response = await AuthService.verifyOtp({
        phone: phone.replace(/\s/g, ''),
        otp: otp.trim(),
        clientMeta,
      });
      const { user, token } = response.data;
      if (!user || !token) { throw new Error('Invalid response from server'); }
      login(token, user);
    } catch (error: any) {
      showError(error, 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResendOtp = () => {
    setOtp('');
    setErrors({});
    setSubmitAttempted(false);
    handleSendOtp();
  };

  // ── Determine primary action ──
  const handlePrimaryAction = () => {
    if (mode === 'email') { return handleEmailLogin(); }
    if (otpStep === 'phone') { return handleSendOtp(); }
    return handleVerifyOtp();
  };

  const primaryLabel =
    mode === 'email'
      ? 'Sign In'
      : otpStep === 'phone'
        ? 'Send OTP'
        : 'Verify OTP';

  const wrapStyle = contentWidth
    ? { width: contentWidth, alignSelf: 'center' as const }
    : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={['bottom']}>

      {/* ── Fixed purple header bg ── */}
      <View style={[styles.brandTop, { height: headerH, backgroundColor: colors.primary }]} />
      {/* Decorative circles */}
      <View style={[styles.circle, { top: -40, right: -40, backgroundColor: colors.primaryLight, opacity: 0.18 }]} />
      <View style={[styles.circle, { top: screenHeight * 0.22, left: -60, backgroundColor: colors.primaryLight, opacity: 0.1 }]} />

      {/* ── Scrollable area ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24, paddingBottom: 80 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

          {/* Logo + Title (on purple) */}
          <Animated.View
            entering={FadeInDown.duration(800).springify()}
            style={[styles.heroSection, wrapStyle]}>
            <Animated.View
              entering={ZoomIn.delay(200).duration(600)}
              style={styles.logoBox} accessibilityRole="image" accessibilityLabel={`${APP_NAME} logo`}>
              <Image
                source={require('@/assets/images/logo/sanfort_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue your learning journey</Text>
          </Animated.View>

          {/* ── White input card ── */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(800)}
            style={[styles.card, { backgroundColor: colors.surface }, wrapStyle]}>

            {/* ── Mode Tabs ── */}
            <View style={[styles.tabRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, mode === 'phone' && { backgroundColor: colors.primary }]}
                onPress={() => switchMode('phone')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'phone' }}>
                <Phone size={14} color={mode === 'phone' ? '#fff' : colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.tabText, { color: mode === 'phone' ? '#fff' : colors.textSecondary }]}>
                  Phone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'email' && { backgroundColor: colors.primary }]}
                onPress={() => switchMode('email')}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'email' }}>
                <Mail size={14} color={mode === 'email' ? '#fff' : colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.tabText, { color: mode === 'email' ? '#fff' : colors.textSecondary }]}>
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'email' ? (
              <>
                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email Address</Text>
                  <View style={[
                    styles.inputRow,
                    {
                      borderColor: errors.email
                        ? '#EF4444'
                        : emailFocused ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}>
                    <Mail size={18} color={errors.email ? '#EF4444' : emailFocused ? colors.primary : colors.placeholder} strokeWidth={2} />
                    <TextInput
                      testID="login-email-input"
                      style={[styles.input, { color: colors.text }]}
                      placeholder="hello@example.com"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      value={email}
                      onChangeText={handleEmailChange}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      onSubmitEditing={() => passwordRef.current?.focus()}
                      accessibilityLabel="Email address"
                      accessibilityHint="Enter your registered email"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                  {errors.email ? (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">{errors.email}</Text>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
                  <View style={[
                    styles.inputRow,
                    {
                      borderColor: errors.password
                        ? '#EF4444'
                        : passFocused ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}>
                    <Lock size={18} color={errors.password ? '#EF4444' : passFocused ? colors.primary : colors.placeholder} strokeWidth={2} />
                    <TextInput
                      ref={passwordRef}
                      testID="login-password-input"
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Enter your password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry={!showPass}
                      returnKeyType="done"
                      value={password}
                      onChangeText={handlePasswordChange}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      onSubmitEditing={handleEmailLogin}
                      accessibilityLabel="Password"
                      accessibilityHint="Enter your account password"
                      underlineColorAndroid="transparent"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPass(v => !v)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={showPass ? 'Hide password' : 'Show password'}>
                      {showPass
                        ? <EyeOff size={18} color={colors.placeholder} strokeWidth={2} />
                        : <Eye size={18} color={colors.placeholder} strokeWidth={2} />
                      }
                    </TouchableOpacity>
                  </View>
                  {errors.password ? (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">{errors.password}</Text>
                  ) : null}
                </View>

                {/* Forgot */}
                <TouchableOpacity
                  style={styles.forgotWrap}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password">
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Phone Number */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone Number</Text>
                  <View style={[
                    styles.inputRow,
                    {
                      borderColor: errors.phone
                        ? '#EF4444'
                        : phoneFocused ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}>
                    <Phone size={18} color={errors.phone ? '#EF4444' : phoneFocused ? colors.primary : colors.placeholder} strokeWidth={2} />
                    <TextInput
                      testID="login-phone-input"
                      style={[styles.input, { color: colors.text }]}
                      placeholder="+91 9876543210"
                      placeholderTextColor={colors.placeholder}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType={otpStep === 'phone' ? 'done' : 'next'}
                      value={phone}
                      editable={otpStep === 'phone'}
                      onChangeText={handlePhoneChange}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                      onSubmitEditing={otpStep === 'phone' ? handleSendOtp : () => otpRef.current?.focus()}
                      accessibilityLabel="Phone number"
                      accessibilityHint="Enter your registered phone number"
                      underlineColorAndroid="transparent"
                    />
                    {otpStep === 'otp' && (
                      <TouchableOpacity
                        onPress={() => {
                          setOtpStep('phone');
                          setOtp('');
                          setErrors({});
                          setSubmitAttempted(false);
                          setResendTimer(0);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel="Change phone number">
                        <Text style={[styles.changeText, { color: colors.primary }]}>Change</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {errors.phone ? (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">{errors.phone}</Text>
                  ) : null}
                </View>

                {/* OTP Input (visible after sending) */}
                {otpStep === 'otp' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Enter OTP</Text>
                    <View style={[
                      styles.inputRow,
                      {
                        borderColor: errors.otp
                          ? '#EF4444'
                          : otpFocused ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}>
                      <Lock size={18} color={errors.otp ? '#EF4444' : otpFocused ? colors.primary : colors.placeholder} strokeWidth={2} />
                      <TextInput
                        ref={otpRef}
                        testID="login-otp-input"
                        style={[styles.input, { color: colors.text, letterSpacing: 6, fontSize: moderateScale(18), fontWeight: '700' }]}
                        placeholder="------"
                        placeholderTextColor={colors.placeholder}
                        keyboardType="number-pad"
                        maxLength={6}
                        returnKeyType="done"
                        value={otp}
                        onChangeText={handleOtpChange}
                        onFocus={() => setOtpFocused(true)}
                        onBlur={() => setOtpFocused(false)}
                        onSubmitEditing={handleVerifyOtp}
                        accessibilityLabel="OTP code"
                        accessibilityHint="Enter the OTP sent to your phone"
                        underlineColorAndroid="transparent"
                      />
                    </View>
                    {errors.otp ? (
                      <Text style={styles.errorText} accessibilityLiveRegion="polite">{errors.otp}</Text>
                    ) : null}

                    {/* Resend OTP */}
                    <View style={styles.resendRow}>
                      {resendTimer > 0 ? (
                        <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                          Resend OTP in {resendTimer}s
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendOtp} disabled={loading} activeOpacity={0.7}>
                          <Text style={[styles.resendText, { color: colors.primary, fontWeight: '600' }]}>
                            Resend OTP
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </Animated.View>

          {/* ── Primary action button ── */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(800)}
            style={[styles.ctaWrap, wrapStyle]}>
            <Pressable
              testID="login-submit-btn"
              onPress={handlePrimaryAction}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              accessibilityState={{ disabled: loading, busy: loading }}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.primary },
                loading && { opacity: 0.7 },
                pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
              ]}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}>
              {loading ? (
                <ActivityIndicator color="#fff" accessibilityLabel="Please wait..." />
              ) : (
                <>
                  <LogIn size={20} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.ctaText}>{primaryLabel}</Text>
                </>
              )}
            </Pressable>

            <TouchableOpacity
              style={styles.delBtnWrap}
              onPress={() => navigation.navigate('DeleteAccount')}
              activeOpacity={0.7}>
              <Text style={[styles.delText, { color: colors.textSecondary }]}>
                Want to delete your account? <Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete Here</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        type="error"
        title="Login Failed"
        message={alertMessage}
        confirmText="Try Again"
        onDismiss={() => setAlertVisible(false)}
      />

      <TouchableOpacity
        style={[styles.helpBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openExternalUrl('https://ilifelearn.com/contact-us')}
        activeOpacity={0.8}
      >
        <HelpCircle size={moderateScale(18)} color={colors.primary} />
        <Text style={[styles.helpBtnText, { color: colors.textSecondary }]}>Need Help?</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  brandTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    borderBottomLeftRadius: moderateScale(28), borderBottomRightRadius: moderateScale(28),
  },
  circle: { position: 'absolute', width: scale(180), height: scale(180), borderRadius: scale(90) },

  scrollContent: { paddingHorizontal: scale(20), flexGrow: 1 },

  heroSection: { alignItems: 'center', marginBottom: verticalScale(20), paddingBottom: verticalScale(10) },
  logoBox: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: { fontSize: moderateScale(24), fontWeight: '800', color: '#fff', marginBottom: verticalScale(5) },
  subtitle: { fontSize: moderateScale(13), color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  card: {
    borderRadius: moderateScale(20), padding: moderateScale(18),
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: moderateScale(12), shadowOffset: { width: 0, height: verticalScale(4) },
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.06)',
    gap: verticalScale(14),
  },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row',
    borderRadius: moderateScale(12),
    padding: 3,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(9),
    borderRadius: moderateScale(10),
  },
  tabText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
  },

  fieldGroup: { gap: verticalScale(5) },
  fieldLabel: { fontSize: moderateScale(12), fontWeight: '500' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: scale(10),
    borderRadius: moderateScale(12), borderWidth: 1.5,
    paddingHorizontal: scale(14), paddingVertical: verticalScale(12),
  },
  input: { flex: 1, fontSize: moderateScale(14), padding: 0, backgroundColor: 'transparent' },

  errorText: { fontSize: moderateScale(11), color: '#EF4444', fontWeight: '500', marginTop: verticalScale(2) },

  changeText: { fontSize: moderateScale(12), fontWeight: '700' },

  forgotWrap: { alignSelf: 'flex-end', marginTop: verticalScale(-2) },
  forgotText: { fontSize: moderateScale(13), fontWeight: '600' },

  resendRow: { alignSelf: 'flex-end', marginTop: verticalScale(2) },
  resendText: { fontSize: moderateScale(12) },

  ctaWrap: { marginTop: 'auto', paddingTop: verticalScale(24), paddingBottom: verticalScale(8) },
  cta: {
    height: verticalScale(52), borderRadius: moderateScale(14),
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: scale(10),
  },
  ctaText: { fontSize: moderateScale(15), fontWeight: '700', color: '#fff', letterSpacing: 0.3 },

  delBtnWrap: {
    marginTop: verticalScale(16),
    alignSelf: 'center',
    padding: scale(10),
  },
  delText: {
    fontSize: moderateScale(13),
  },
  helpBtn: {
    position: 'absolute',
    bottom: verticalScale(20),
    right: scale(20),
    paddingHorizontal: scale(14),
    height: verticalScale(40),
    borderRadius: moderateScale(20),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  helpBtnText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
});
