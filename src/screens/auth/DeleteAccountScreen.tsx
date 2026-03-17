import React, {useState} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
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
import Animated, {FadeInDown, FadeInUp, ZoomIn} from 'react-native-reanimated';

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

  const isTablet = screenWidth >= 768;
  const contentWidth = isTablet ? Math.min(screenWidth * 0.55, 480) : undefined;
  const wrapStyle = contentWidth ? {width: contentWidth, alignSelf: 'center' as const} : undefined;

  const handleDelete = async () => {
    if (!email || !password) {
      setAlertMessage('Please enter both your email and password.');
      setAlertVisible(true);
      return;
    }

    Keyboard.dismiss();
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
        <View style={styles.successIcon}>
          <Text style={{fontSize: 48}}>👋</Text>
        </View>
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
});
