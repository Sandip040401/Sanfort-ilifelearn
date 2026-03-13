import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import {Eye, EyeOff, Lock, LogIn, Mail, Sparkles} from 'lucide-react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import CustomAlert from '@/components/CustomAlert';
import {useAuth} from '@/store';
import {useTheme} from '@/theme';
import {AuthService} from '@/services';
import type {AuthStackParamList} from '@/types';

const {height} = Dimensions.get('window');
const MIN_HEADER = 260;

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Login'>;
};

type FieldErrors = {email?: string; password?: string};

function validateFields(email: string, password: string): FieldErrors {
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

export default function LoginScreen({navigation}: Props) {
  const {colors} = useTheme();
  const {login}  = useAuth();
  const insets   = useSafeAreaInsets();
  const headerH  = Math.max(MIN_HEADER, height * 0.38) + insets.top;

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused,  setPassFocused]  = useState(false);
  const [errors,          setErrors]          = useState<FieldErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [alertVisible,    setAlertVisible]    = useState(false);
  const [alertMessage,    setAlertMessage]    = useState('');

  const passwordRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor('transparent');
    }, []),
  );

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (submitAttempted) {
      setErrors(prev => ({...prev, email: validateFields(val, password).email}));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (submitAttempted) {
      setErrors(prev => ({...prev, password: validateFields(email, val).password}));
    }
  };

  const handleLogin = async () => {
    setSubmitAttempted(true);
    const fieldErrors = validateFields(email, password);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    Keyboard.dismiss();
    setLoading(true);
    try {
      const response = await AuthService.login({email: email.trim(), password});
      const {user, token} = response.data;
      if (!user || !token) {throw new Error('Invalid response from server');}
      login(token, user);
    } catch (error: any) {
      const status = error?.response?.status;
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong. Please try again.';
      const finalMsg = status === 429
        ? 'Too many attempts. Please wait a moment and try again.'
        : msg;
      setAlertMessage(finalMsg);
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: colors.surface}]} edges={['bottom']}>

      {/* ── Fixed purple header bg ── */}
      <View style={[styles.brandTop, {height: headerH, backgroundColor: colors.primary}]} />
      {/* Decorative circles */}
      <View style={[styles.circle, {top: -40, right: -40, backgroundColor: colors.primaryLight, opacity: 0.18}]} />
      <View style={[styles.circle, {top: height * 0.22, left: -60, backgroundColor: colors.primaryLight, opacity: 0.1}]} />

      {/* ── Scrollable area ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingTop: insets.top + 24, paddingBottom: 40},
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>

          {/* Logo + Title (on purple) */}
          <View style={styles.heroSection}>
            <View style={styles.logoBox} accessibilityRole="image" accessibilityLabel="iLife Learn logo">
              <Sparkles size={30} color="#6C4CFF" strokeWidth={1.8} />
            </View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue your learning journey</Text>
          </View>

          {/* ── White input card ── */}
          <View style={[styles.card, {backgroundColor: colors.surface}]}>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>Email Address</Text>
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
                  style={[styles.input, {color: colors.text}]}
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
                />
              </View>
              {errors.email ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">{errors.email}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, {color: colors.textSecondary}]}>Password</Text>
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
                  style={[styles.input, {color: colors.text}]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={() => setPassFocused(true)}
                  onBlur={() => setPassFocused(false)}
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                  accessibilityHint="Enter your account password"
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                  accessibilityRole="button"
                  accessibilityLabel={showPass ? 'Hide password' : 'Show password'}>
                  {showPass
                    ? <EyeOff size={18} color={colors.placeholder} strokeWidth={2} />
                    : <Eye    size={18} color={colors.placeholder} strokeWidth={2} />
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
              <Text style={[styles.forgotText, {color: colors.primary}]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Fixed bottom Sign In button ── */}
      <View style={[styles.bottomBar, {paddingBottom: Math.max(20, insets.bottom + 12)}]}>
        <Pressable
          testID="login-submit-btn"
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign in to your account"
          accessibilityState={{disabled: loading, busy: loading}}
          style={({pressed}) => [
            styles.cta,
            {backgroundColor: colors.primary},
            loading && {opacity: 0.7},
            pressed && {opacity: 0.9, transform: [{scale: 0.995}]},
          ]}
          android_ripple={{color: 'rgba(255,255,255,0.2)'}}>
          {loading ? (
            <ActivityIndicator color="#fff" accessibilityLabel="Signing in..." />
          ) : (
            <>
              <LogIn size={20} color="#fff" strokeWidth={2.5} />
              <Text style={styles.ctaText}>Sign In</Text>
            </>
          )}
        </Pressable>
      </View>

      <CustomAlert
        visible={alertVisible}
        type="error"
        title="Login Failed"
        message={alertMessage}
        confirmText="Try Again"
        onDismiss={() => setAlertVisible(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  {flex: 1},
  flex:  {flex: 1},

  brandTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    borderBottomLeftRadius: moderateScale(28), borderBottomRightRadius: moderateScale(28),
  },
  circle: {position: 'absolute', width: scale(180), height: scale(180), borderRadius: scale(90)},

  scrollContent: {paddingHorizontal: scale(20)},

  heroSection: {alignItems: 'center', marginBottom: verticalScale(20)},
  logoBox: {
    width: scale(76), height: scale(76), borderRadius: moderateScale(22),
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: verticalScale(16),
    shadowColor: '#000', shadowOffset: {width: 0, height: verticalScale(8)},
    shadowOpacity: 0.2, shadowRadius: moderateScale(16), elevation: 8,
  },
  title:    {fontSize: moderateScale(24), fontWeight: '800', color: '#fff', marginBottom: verticalScale(5)},
  subtitle: {fontSize: moderateScale(13), color: 'rgba(255,255,255,0.8)', textAlign: 'center'},

  card: {
    borderRadius: moderateScale(20), padding: moderateScale(18),
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: moderateScale(12), shadowOffset: {width: 0, height: verticalScale(4)}, elevation: 2,
    gap: verticalScale(14),
  },

  fieldGroup: {gap: verticalScale(5)},
  fieldLabel: {fontSize: moderateScale(12), fontWeight: '500'},
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: scale(10),
    borderRadius: moderateScale(12), borderWidth: 1.5,
    paddingHorizontal: scale(14), paddingVertical: verticalScale(12),
  },
  input: {flex: 1, fontSize: moderateScale(14), padding: 0},

  errorText: {fontSize: moderateScale(11), color: '#EF4444', fontWeight: '500', marginTop: verticalScale(2)},

  forgotWrap: {alignSelf: 'flex-end', marginTop: verticalScale(-2)},
  forgotText: {fontSize: moderateScale(13), fontWeight: '600'},

  bottomBar: {paddingHorizontal: scale(20), backgroundColor: 'transparent'},
  cta: {
    height: verticalScale(52), borderRadius: moderateScale(14),
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: scale(10),
  },
  ctaText: {fontSize: moderateScale(15), fontWeight: '700', color: '#fff', letterSpacing: 0.3},
});
