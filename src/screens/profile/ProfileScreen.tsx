import React, {useState} from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
  BookOpen,
  ChevronRight,
  Fingerprint,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  UserRound,
} from 'lucide-react-native';
import {useAuth} from '@/store';
import {useTheme, Typography, BorderRadius, type AppColors} from '@/theme';
import CustomAlert from '@/components/CustomAlert';

type ThemeMode = 'light' | 'dark' | 'system';

function capitalize(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProfileScreen() {
  const {user, logout} = useAuth();
  const {colors, mode, setMode, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width - scale(64), scale(960)) : undefined;
  const contentStyle = contentWidth ? {width: contentWidth, alignSelf: 'center'} : undefined;
  const [showLogout, setShowLogout] = useState(false);

  const displayName = capitalize(user?.name || 'User');
  const avatarLetter = displayName.charAt(0);
  const userId = user?.id ?? user?._id ?? 'N/A';

  const handleLogout = () => {
    setShowLogout(false);
    logout();
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

        {/* ── Logout ───────────────────────────────── */}
        <View style={[styles.cardsContainer, contentStyle]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowLogout(true)}
            style={[styles.logoutRow, {backgroundColor: colors.card, borderColor: colors.divider}]}>
            <View style={[styles.logoutIcon, {backgroundColor: isDark ? '#2A1215' : '#FEF2F2'}]}>
              <LogOut size={moderateScale(18)} color={colors.error} />
            </View>
            <Text style={[styles.logoutText, {color: colors.error}]}>Log Out</Text>
            <ChevronRight size={moderateScale(16)} color={colors.error + '60'} />
          </TouchableOpacity>
        </View>

        {/* ── App Version ──────────────────────────── */}
        <Text style={[styles.versionText, {color: colors.textTertiary}]}>
          iLife Learn v1.0.0
        </Text>

      </ScrollView>

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
  icon, iconBg, label, value, colors, mono,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  colors: AppColors;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, {backgroundColor: iconBg}]}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, {color: colors.textTertiary}]}>{label}</Text>
        <Text
          style={[styles.rowValue, {color: colors.text}, mono && styles.mono]}
          numberOfLines={1}>
          {value}
        </Text>
      </View>
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
});
