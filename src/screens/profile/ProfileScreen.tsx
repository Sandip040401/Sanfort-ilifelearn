import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  ArrowLeft,
  Baby,
  BookOpen,
  ChevronRight,
  FileText,
  Fingerprint,
  Key,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import {useAuth} from '@/store';
import {useTheme, Typography, BorderRadius, type AppColors} from '@/theme';
import CustomAlert from '@/components/CustomAlert';
import { AuthService } from '@/services/auth.service';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type ThemeMode = 'light' | 'dark' | 'system';

function capitalize(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProfileScreen() {
  const {user, logout} = useAuth();
  const {colors, mode, setMode, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width - scale(64), scale(960)) : undefined;
  const contentStyle = contentWidth ? {width: contentWidth, alignSelf: 'center' as const} : undefined;
  
  const [showLogout, setShowLogout] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'reset' | 'delete' | 'gate'>('none');
  const [modalStep, setModalStep] = useState<'confirm' | 'processing' | 'success' | 'input' | 'error'>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const [gateInput, setGateInput] = useState('');
  const [gateAnswer] = useState('18'); // 12 + 6

  // Form Inputs
  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // ── Animations ─────────────────────────────────
  const modalVisible = activeModal !== 'none';
  const modalScale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (modalVisible) {
      opacity.value = withTiming(1, {duration: 200, easing: Easing.out(Easing.cubic)});
      modalScale.value = withSpring(1, {damping: 18, stiffness: 280});
    } else {
      opacity.value = withTiming(0, {duration: 150});
      modalScale.value = withTiming(0.9, {duration: 150});
    }
  }, [modalVisible, opacity, modalScale]);

  const backdropAnimStyle = useAnimatedStyle(() => ({opacity: opacity.value}));
  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: modalScale.value}],
  }));

  const displayName = capitalize(user?.name || 'User');
  const avatarLetter = displayName.charAt(0);
  const userId = user?.id ?? user?._id ?? 'N/A';

  const resetModal = () => {
    setActiveModal('none');
    setModalStep('confirm');
    setGateInput('');
    setPassword('');
    setOldPassword('');
    setNewPassword('');
    setErrorMessage('');
  };

  const handleLogout = () => {
    setShowLogout(false);
    logout();
  };

  const startResetPassword = () => {
    setActiveModal('reset');
    setModalStep('confirm');
  };

  const startDeleteAccount = () => {
    setActiveModal('delete');
    setModalStep('confirm');
  };

  const startParentGate = () => {
    setActiveModal('gate');
    setModalStep('input');
  };

  const processResetPassword = async () => {
    if (!oldPassword || !newPassword) {
      setErrorMessage('Please fill in both fields.');
      setModalStep('error');
      return;
    }

    setModalStep('processing');
    try {
      const response = await AuthService.resetPassword({
        email: user?.email || '',
        oldPassword,
        newPassword
      });
      setModalStep('success');
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'Failed to reset password');
      setModalStep('error');
    }
  };

  const processDeleteAccount = async () => {
    if (!password) {
      setErrorMessage('Please enter your password to confirm.');
      setModalStep('error');
      return;
    }

    setModalStep('processing');
    try {
      await AuthService.deleteAccount({
        email: user?.email || '',
        password
      });
      setModalStep('success');
      setTimeout(() => {
        resetModal();
        logout();
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'Failed to delete account');
      setModalStep('error');
    }
  };

  const verifyParentGate = () => {
    /* 
       INFO: REPLACE VALIDATION WITH YOUR LOGIC
       Currently checking if input matches '18' (12 + 6)
    */
    if (gateInput === gateAnswer) {
      setModalStep('success');
      setTimeout(() => resetModal(), 1500);
    } else {
      setErrorMessage('Verification failed. Please solve the problem correctly to proceed.');
      setModalStep('error');
    }
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      {/* ── Header ─────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {paddingTop: insets.top + verticalScale(8)},
          contentStyle,
        ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={[styles.backBtn, {backgroundColor: colors.card, borderColor: colors.divider}]}>
          <ArrowLeft size={moderateScale(20)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={{paddingBottom: insets.bottom + verticalScale(100)}}
        showsVerticalScrollIndicator={false}>

        {/* ── Avatar Section ───────────────────────── */}
        <View style={[styles.avatarSection, contentStyle]}>
          <LinearGradient
            colors={colors.gradient.primary}
            locations={[0, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
          </LinearGradient>

          <Text style={[styles.nameText, {color: colors.text}]}>{displayName}</Text>
          <Text style={[styles.emailText, {color: colors.textSecondary}]}>
            {user?.email || 'No email'}
          </Text>

          {user?.role && (
            <View style={[styles.badge, {backgroundColor: colors.primarySurface}]}>
              <Shield size={moderateScale(13)} color={colors.primary} />
              <Text style={[styles.badgeText, {color: colors.primary}]}>
                {capitalize(user.role)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Info Cards ───────────────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <Text style={[styles.sectionLabel, {color: colors.textTertiary}]}>
            ACCOUNT
          </Text>

          <View style={[styles.groupCard, {backgroundColor: colors.card, borderColor: colors.divider}]}>
            <CardRow
              icon={<UserRound size={moderateScale(18)} color={colors.primary} />}
              iconBg={colors.primarySurface}
              label="Name"
              value={displayName}
              colors={colors}
            />
            <Divider color={colors.divider} />
            <CardRow
              icon={<Mail size={moderateScale(18)} color="#14B8A6" />}
              iconBg={isDark ? '#0A2520' : '#F0FDFA'}
              label="Email"
              value={user?.email || 'Not set'}
              colors={colors}
            />
            <Divider color={colors.divider} />
            <CardRow
              icon={<Fingerprint size={moderateScale(18)} color="#F59E0B" />}
              iconBg={isDark ? '#1C1508' : '#FFFBEB'}
              label="ID"
              value={userId}
              colors={colors}
              mono
            />
            {user?.role && (
              <>
                <Divider color={colors.divider} />
                <CardRow
                  icon={<BookOpen size={moderateScale(18)} color="#8B5CF6" />}
                  iconBg={isDark ? '#1A1040' : '#F5F3FF'}
                  label="Role"
                  value={capitalize(user.role)}
                  colors={colors}
                />
              </>
            )}
          </View>
        </View>

        {/* ── Theme Picker ─────────────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <Text style={[styles.sectionLabel, {color: colors.textTertiary}]}>
            APPEARANCE
          </Text>

          <View style={[styles.groupCard, styles.themePad, {backgroundColor: colors.card, borderColor: colors.divider}]}>
            <View style={styles.themeHeader}>
              <Palette size={moderateScale(16)} color={colors.textSecondary} />
              <Text style={[styles.themeHeaderText, {color: colors.text}]}>Theme</Text>
            </View>
            <View style={[styles.themePicker, {backgroundColor: colors.background, borderColor: colors.divider}]}>
              {([
                {v: 'light' as ThemeMode, l: 'Light', I: Sun},
                {v: 'dark' as ThemeMode, l: 'Dark', I: Moon},
                {v: 'system' as ThemeMode, l: 'Auto', I: Monitor},
              ]).map(opt => {
                const active = mode === opt.v;
                return (
                  <TouchableOpacity
                    key={opt.v}
                    activeOpacity={0.7}
                    onPress={() => setMode(opt.v)}
                    style={[styles.themeOption, active && styles.themeOptionActive]}>
                    {active ? (
                      <LinearGradient
                        colors={colors.gradient.primary}
                        locations={[0, 1]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={styles.themeOptionGradient}>
                        <opt.I size={moderateScale(16)} color="#fff" />
                        <Text style={styles.themeActiveLabel}>{opt.l}</Text>
                      </LinearGradient>
                    ) : (
                      <>
                        <opt.I size={moderateScale(16)} color={colors.textTertiary} />
                        <Text style={[styles.themeLabel, {color: colors.textSecondary}]}>
                          {opt.l}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Security & Support ───────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <Text style={[styles.sectionLabel, {color: colors.textTertiary}]}>
            SECURITY & SUPPORT
          </Text>

          <View style={[styles.groupCard, {backgroundColor: colors.card, borderColor: colors.divider}]}>
            <TouchableOpacity activeOpacity={0.7} onPress={startResetPassword}>
              <CardRow
                icon={<Key size={moderateScale(18)} color="#F43F5E" />}
                iconBg={isDark ? '#2A1215' : '#FFF1F2'}
                value="Reset Password"
                colors={colors}
                showChevron
              />
            </TouchableOpacity>
            <Divider color={colors.divider} />
            
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('PrivacyPolicy')}>
              <CardRow
                icon={<FileText size={moderateScale(18)} color="#3B82F6" />}
                iconBg={isDark ? '#0F172A' : '#EFF6FF'}
                value="Privacy Policy"
                colors={colors}
                showChevron
              />
            </TouchableOpacity>
            <Divider color={colors.divider} />

            <TouchableOpacity activeOpacity={0.7} onPress={startParentGate}>
              <CardRow
                icon={<Baby size={moderateScale(18)} color="#10B981" />}
                iconBg={isDark ? '#064E3B' : '#ECFDF5'}
                value="Parent Gate"
                colors={colors}
                showChevron
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Session Actions ────────────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowLogout(true)}
            style={[styles.logoutRow, {backgroundColor: colors.card, borderColor: colors.divider}]}>
            <View style={[styles.logoutIcon, {backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF'}]}>
              <LogOut size={moderateScale(18)} color={colors.primary} />
            </View>
            <Text style={[styles.logoutText, {color: colors.text}]}>Log Out</Text>
            <ChevronRight size={moderateScale(16)} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── Danger Zone ───────────────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <Text style={[styles.sectionLabel, {color: colors.error}]}>DANGER ZONE</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={startDeleteAccount}
            style={[styles.logoutRow, {
              backgroundColor: isDark ? '#2A1215' : '#FFF1F2', 
              borderColor: colors.error + '30',
            }]}>
            <View style={[styles.logoutIcon, {backgroundColor: colors.error}]}>
              <Trash2 size={moderateScale(16)} color="#fff" />
            </View>
            <Text style={[styles.logoutText, {color: colors.error, fontWeight: '700'}]}>Delete Account</Text>
            <ChevronRight size={moderateScale(16)} color={colors.error + '60'} />
          </TouchableOpacity>
        </View>

        {/* ── App Version ──────────────────────────── */}
        <Text style={[styles.versionText, {color: colors.textTertiary}]}>
          iLife Learn v1.0.0
        </Text>

      </ScrollView>

      {/* ── Mock Action Modal ─────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={resetModal}>
        <View style={styles.modalRoot}>
          {/* Backdrop */}
          <Animated.View style={[styles.modalOverlay, backdropAnimStyle]}>
            <TouchableOpacity 
              activeOpacity={1} 
              style={{flex: 1}} 
              onPress={modalStep !== 'processing' ? resetModal : undefined} 
            />
          </Animated.View>

          {/* Card */}
          <View style={styles.modalCenter} pointerEvents="box-none">
            <Animated.View style={[styles.modalCard, {backgroundColor: colors.card}, cardAnimStyle]}>
              {/* ── Standard Error View ──────────────────────── */}
              {modalStep === 'error' && (
                <>
                  <View style={[styles.statusIcon, {backgroundColor: isDark ? '#450A0A' : '#FEF2F2'}]}>
                    <Text style={{fontSize: 32}}>⚠️</Text>
                  </View>
                  <Text style={[styles.modalTitle, {color: colors.error}]}>Action Failed</Text>
                  <Text style={[styles.modalDesc, {color: colors.textSecondary, textAlign: 'center'}]}>
                    {errorMessage || "Something went wrong. Please try again later."}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.modalBtn, {backgroundColor: colors.primary}]} 
                    onPress={() => setModalStep(activeModal === 'gate' ? 'input' : 'confirm')}>
                    <Text style={styles.modalBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </>
              )}

              {activeModal === 'reset' && modalStep !== 'error' && (
                <>
                  <Text style={[styles.modalTitle, {color: colors.text}]}>Reset Password</Text>
                  {modalStep === 'confirm' && (
                    <>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary}]}>
                        Updating password for <Text style={{fontWeight: '700'}}>{user?.email}</Text>
                      </Text>
                      
                      <TextInput
                        style={[styles.modalInput, styles.passwordInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.divider}]}
                        placeholder="Current Password"
                        secureTextEntry
                        placeholderTextColor={colors.textTertiary}
                        value={oldPassword}
                        onChangeText={setOldPassword}
                      />

                      <TextInput
                        style={[styles.modalInput, styles.passwordInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.divider}]}
                        placeholder="New Password"
                        secureTextEntry
                        placeholderTextColor={colors.textTertiary}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />

                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.primary}]} onPress={processResetPassword}>
                        <Text style={styles.modalBtnText}>Update Password</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {modalStep === 'processing' && (
                    <View style={styles.modalContent}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={[styles.modalInfo, {color: colors.textTertiary}]}>Updating...</Text>
                    </View>
                  )}
                  {modalStep === 'success' && (activeModal === 'reset') && (
                    <>
                      <View style={[styles.statusIcon, {backgroundColor: isDark ? '#064E3B' : '#ECFDF4'}]}>
                        <Text style={{fontSize: 32}}>🔐</Text>
                      </View>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary, textAlign: 'center'}]}>
                        Password has been successfully updated!
                      </Text>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.primary}]} onPress={resetModal}>
                        <Text style={styles.modalBtnText}>Close</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}

              {activeModal === 'delete' && modalStep !== 'error' && (
                <>
                  <Text style={[styles.modalTitle, {color: colors.text}]}>Delete Account</Text>
                  {modalStep === 'confirm' && (
                    <>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary}]}>
                        Enter your password to permanently delete <Text style={{fontWeight: '700'}}>{user?.email}</Text>
                      </Text>

                      <TextInput
                        style={[styles.modalInput, styles.passwordInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.divider}]}
                        placeholder="Password"
                        secureTextEntry
                        placeholderTextColor={colors.textTertiary}
                        value={password}
                        onChangeText={setPassword}
                        autoFocus
                      />

                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.error}]} onPress={processDeleteAccount}>
                        <Text style={styles.modalBtnText}>Confirm Deletion</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {modalStep === 'processing' && (
                    <View style={styles.modalContent}>
                      <ActivityIndicator size="large" color={colors.error} />
                      <Text style={[styles.modalInfo, {color: colors.textTertiary}]}>Wiping data...</Text>
                    </View>
                  )}
                  {modalStep === 'success' && (activeModal === 'delete') && (
                    <>
                      <View style={[styles.statusIcon, {backgroundColor: isDark ? '#450A0A' : '#FEF2F2'}]}>
                        <Text style={{fontSize: 32}}>👋</Text>
                      </View>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary, textAlign: 'center'}]}>
                        Account deleted. Logging you out...
                      </Text>
                    </>
                  )}
                </>
              )}

              {activeModal === 'gate' && modalStep !== 'error' && (
                <>
                  <Text style={[styles.modalTitle, {color: colors.text}]}>Parent Gate</Text>
                  {modalStep === 'input' && (
                    <>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary}]}>
                        Please solve this math problem to continue:
                      </Text>
                      <Text style={[styles.mathQuestion, {color: colors.primary}]}>12 + 6 = ?</Text>
                      <TextInput
                        style={[styles.modalInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.divider}]}
                        placeholder="Enter answer"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        value={gateInput}
                        onChangeText={setGateInput}
                        autoFocus
                      />
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.primary}]} onPress={verifyParentGate}>
                        <Text style={styles.modalBtnText}>Verify</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {modalStep === 'success' && (activeModal === 'gate') && (
                    <>
                      <View style={[styles.statusIcon, {backgroundColor: isDark ? '#064E3B' : '#ECFDF4'}]}>
                        <Text style={{fontSize: 32}}>🔑</Text>
                      </View>
                      <Text style={[styles.modalDesc, {color: colors.textSecondary, textAlign: 'center'}]}>
                        Identity Verified! Access granted.
                      </Text>
                    </>
                  )}
                </>
              )}

              {modalStep !== 'processing' && modalStep !== 'success' && (
                <TouchableOpacity style={styles.modalCancel} onPress={resetModal}>
                  <Text style={[styles.modalCancelText, {color: colors.textTertiary}]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        </View>
      </Modal>

      {/* ── Logout Modal ───────────────────────────── */}
      <CustomAlert
        visible={showLogout}
        type="warning"
        title="Log Out?"
        message="Are you sure you want to log out? You'll need to sign in again to access your account."
        confirmText="Log Out"
        cancelText="Cancel"
        onConfirm={handleLogout}
        onDismiss={() => setShowLogout(false)}
      />
    </View>
  );
}

// ─── Card Row ─────────────────────────────────────────────────────────
function CardRow({
  icon, iconBg, label, value, colors, mono, showChevron,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label?: string;
  value: string;
  colors: AppColors;
  mono?: boolean;
  showChevron?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, {backgroundColor: iconBg}]}>{icon}</View>
      <View style={styles.rowBody}>
        {label && <Text style={[styles.rowLabel, {color: colors.textTertiary}]}>{label}</Text>}
        <Text
          style={[
            styles.rowValue, 
            {color: colors.text}, 
            mono && styles.mono,
            !label && {marginTop: 0}
          ]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
      {showChevron && (
        <ChevronRight size={moderateScale(16)} color={colors.textTertiary} />
      )}
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────
function Divider({color}: {color: string}) {
  return <View style={[styles.divider, {backgroundColor: color}]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1},

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    gap: scale(12),
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(24),
  },
  avatarOuter: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    padding: scale(3),
  },
  avatarInner: {
    flex: 1,
    borderRadius: scale(50),
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: moderateScale(40),
    fontWeight: '800',
    color: '#fff',
  },
  nameText: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    marginTop: verticalScale(16),
    letterSpacing: -0.3,
  },
  emailText: {
    fontSize: moderateScale(14),
    marginTop: verticalScale(4),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(5),
    borderRadius: BorderRadius.full,
    marginTop: verticalScale(10),
  },
  badgeText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },

  // Cards
  cardsContainer: {
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(16),
  },
  sectionLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: verticalScale(8),
    marginLeft: scale(4),
  },
  groupCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
  },
  rowIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  rowBody: {flex: 1},
  rowLabel: {
    fontSize: moderateScale(11),
    fontWeight: '500',
  },
  rowValue: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    marginTop: 2,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: moderateScale(12),
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: scale(64),
  },

  // Theme
  themePad: {
    padding: scale(16),
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(12),
  },
  themeHeaderText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  themePicker: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: scale(4),
    gap: scale(4),
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(10),
    borderRadius: BorderRadius.md,
  },
  themeOptionActive: {
    overflow: 'hidden',
  },
  themeOptionGradient: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    borderRadius: BorderRadius.md,
  },
  themeLabel: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  themeActiveLabel: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },

  // Logout
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
  },
  logoutIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  logoutText: {
    flex: 1,
    fontSize: moderateScale(15),
    fontWeight: '600',
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: moderateScale(11),
    marginTop: verticalScale(16),
  },

  // Modal Styles
  modalRoot: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(24),
  },
  modalCard: {
    width: '100%',
    borderRadius: BorderRadius.xxl,
    padding: scale(24),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 10},
        shadowOpacity: 0.25,
        shadowRadius: 15,
      },
      android: {elevation: 10},
    }),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    marginBottom: verticalScale(12),
  },
  modalDesc: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginBottom: verticalScale(24),
    textAlign: 'center',
  },
  modalContent: {
    paddingVertical: verticalScale(20),
    alignItems: 'center',
  },
  modalInfo: {
    marginTop: verticalScale(12),
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
  modalBtn: {
    width: '100%',
    height: verticalScale(48),
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(8),
  },
  modalBtnText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  modalCancel: {
    padding: scale(10),
  },
  modalCancelText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  statusIcon: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(20),
  },
  mathQuestion: {
    fontSize: moderateScale(32),
    fontWeight: '900',
    marginBottom: verticalScale(16),
  },
  modalInput: {
    width: '100%',
    height: verticalScale(54),
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: scale(16),
    fontSize: moderateScale(18),
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: verticalScale(20),
  },
  passwordInput: {
    fontSize: moderateScale(15),
    textAlign: 'left',
    height: verticalScale(48),
    marginBottom: verticalScale(12),
  },
});
