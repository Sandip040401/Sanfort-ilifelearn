import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, ShieldCheck, Mail, MapPin, Globe, FileText} from 'lucide-react-native';
import {useTheme, BorderRadius} from '@/theme';
import LinearGradient from 'react-native-linear-gradient';

export default function PrivacyPolicyScreen() {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const Section = ({title, children}: {title: string; children: React.ReactNode}) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, {color: colors.text}]}>{title}</Text>
      {children}
    </View>
  );

  const BulletPoint = ({text, subtext}: {text: string; subtext?: string}) => (
    <View style={styles.bulletRow}>
      <View style={[styles.bullet, {backgroundColor: colors.primary}]} />
      <View style={styles.bulletContent}>
        <Text style={[styles.bulletText, {color: colors.text}]}>
          <Text style={{fontWeight: '700'}}>{text}</Text>
          {subtext}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Premium Header */}
      <LinearGradient
        colors={isDark ? ['#0F172A', '#1E293B'] : ['#2563EB', '#3B82F6']}
        style={[styles.headerGradient, {paddingTop: insets.top}]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.backBtn}>
            <ArrowLeft size={moderateScale(20)} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Privacy Policy</Text>
            <Text style={styles.lastUpdated}>Last Updated: 18-03-2026</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + verticalScale(40)}]}
        showsVerticalScrollIndicator={false}>
        
        {/* Intro Info Box */}
        <View style={[styles.introCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <View style={styles.introHeader}>
            <ShieldCheck size={28} color={isDark ? '#60A5FA' : '#2563EB'} />
            <Text style={[styles.appName, {color: colors.text}]}>Sanfort Smart Learning</Text>
          </View>
          <Text style={[styles.companyName, {color: colors.textSecondary}]}>
            Learning Integrations for Education Pvt. Ltd.
          </Text>
          
          <View style={styles.contactGrid}>
            <View style={styles.contactItem}>
              <Globe size={14} color={colors.textTertiary} />
              <Text style={[styles.contactText, {color: colors.textSecondary}]}>ilifelearn.com</Text>
            </View>
            <View style={styles.contactItem}>
              <Mail size={14} color={colors.textTertiary} />
              <Text style={[styles.contactText, {color: colors.textSecondary}]}>support@ilifelearn.com</Text>
            </View>
          </View>
        </View>

        <Section title="1. Introduction">
          <Text style={[styles.bodyText, {color: colors.textSecondary}]}>
            Welcome to <Text style={{fontWeight: '700', color: colors.text}}>Sanfort Smart Learning</Text>, an AR app designed for children aged 3–8 years, offered by Learning Integrations for Education Pvt. Ltd. ("i-Life," "we," "us," or "our"). We are committed to protecting the privacy of our users, especially children, and comply with the <Text style={{fontWeight: '700', color: colors.text}}>Children’s Online Privacy Protection Act (COPPA), Google Play Store Policies,</Text> and <Text style={{fontWeight: '700', color: colors.text}}>Apple App Store Guidelines</Text>. This Privacy Policy explains how we collect, use, and safeguard information through our app and website.
          </Text>
        </Section>

        <Section title="2. Information We Collect">
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginBottom: verticalScale(12)}]}>
            We collect only the minimal information necessary to provide a secure and engaging learning experience:
          </Text>
          
          <Text style={[styles.subHeading, {color: colors.text}]}>Account Creation by Schools:</Text>
          <BulletPoint text="Parent/Guardian Email Address – " subtext="Schools create accounts using the provided email, which is required for login purposes only." />
          <BulletPoint text="No other personal information is collected during account creation." />

          <Text style={[styles.subHeading, {color: colors.text, marginTop: verticalScale(16)}]}>We do NOT collect:</Text>
          <View style={styles.negativeList}>
            <Text style={[styles.negativeItem, {color: colors.textSecondary}]}>- Child's name, birthdate, or any other personal identifiers.</Text>
            <Text style={[styles.negativeItem, {color: colors.textSecondary}]}>- Physical addresses or phone numbers.</Text>
            <Text style={[styles.negativeItem, {color: colors.textSecondary}]}>- Data from third-party platforms (e.g., social media).</Text>
            <Text style={[styles.negativeItem, {color: colors.textSecondary}]}>- Usage data, device information, or IP addresses.</Text>
          </View>
        </Section>

        <Section title="3. How We Use Information">
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginBottom: verticalScale(8)}]}>
            We use the collected information solely to:
          </Text>
          <BulletPoint text="Enable login access " subtext="for parents/guardians." />
        </Section>

        <Section title="4. No Third-Party Sharing">
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginBottom: verticalScale(12)}]}>
            We do <Text style={{fontWeight: '700', color: colors.error}}>NOT</Text> share, sell, or trade user data with third parties for marketing, advertising, or commercial purposes. Exceptions are limited to:
          </Text>
          <BulletPoint text="Service Providers: " subtext="Trusted partners (e.g., cloud hosting, customer support tools) who assist in app operations under strict confidentiality agreements." />
          <BulletPoint text="Legal Compliance: " subtext="Disclosures required by law (e.g., court orders)." />
        </Section>

        <Section title="5. Data Security">
          <BulletPoint text="Encryption: " subtext="Data is transmitted via HTTPS and stored securely." />
          <BulletPoint text="Access Controls: " subtext="Access is restricted to authorized personnel only." />
          <BulletPoint text="Regular Audits: " subtext="We conduct periodic reviews to ensure adherence to security standards." />
        </Section>

        <Section title="6. Data Retention & Deletion">
          <Text style={[styles.bodyText, {color: colors.textSecondary}]}>
            We retain personal data only as long as necessary to support app functionality or as required by legal obligations.
          </Text>
          <View style={[styles.infoBox, {backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderLeftColor: colors.primary}]}>
            <Text style={[styles.infoBoxText, {color: colors.textSecondary}]}>
              <Text style={{fontWeight: '700', color: colors.text}}>Delete Account Feature: </Text>
              You can delete your account and associated data directly through the app or via our website at any time.
            </Text>
          </View>
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginTop: verticalScale(10)}]}>
            Parents/guardians can also request deletion of their child’s data by contacting us at support@ilifelearn.com.
          </Text>
        </Section>

        <Section title="7. Parental Rights & Controls">
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginBottom: verticalScale(12)}]}>
            In compliance with COPPA and app store policies, parents/guardians have the right to:
          </Text>
          <View style={styles.numberedList}>
            <Text style={[styles.numberedItem, {color: colors.textSecondary}]}>
              <Text style={{fontWeight: '700', color: colors.text}}>1. Review Data: </Text>Request a copy of the information we have collected.
            </Text>
            <Text style={[styles.numberedItem, {color: colors.textSecondary}]}>
              <Text style={{fontWeight: '700', color: colors.text}}>2. Delete Data: </Text>Request the permanent deletion of their child's account and data using the built-in account deletion feature or by contacting us.
            </Text>
            <Text style={[styles.numberedItem, {color: colors.textSecondary}]}>
              <Text style={{fontWeight: '700', color: colors.text}}>3. Withdraw Consent: </Text>opt out of future data collection (note: this may limit app functionality).
            </Text>
          </View>
        </Section>

        <Section title="8. COPPA Compliance">
          <BulletPoint text="Verifiable Parental Consent: " subtext="We require email confirmation from parents/guardians before collecting any information from children." />
          <BulletPoint text="No Behavioral Ads: " subtext="The app does not include third-party ads or trackers." />
        </Section>

        <Section title="9. Play Store & App Store Compliance">
          <BulletPoint text="Google Play Store: " subtext="Our app complies with the Families Policy for children's apps." />
          <BulletPoint text="Apple App Store: " subtext="Our app follows the App Store Review Guidelines for kids' apps, including age-appropriate design and parental controls." />
        </Section>

        <Section title="10. Updates to This Policy">
          <Text style={[styles.bodyText, {color: colors.textSecondary}]}>
            We may update this Privacy Policy from time to time to reflect changes in legal requirements or our app's features. Any updates will be posted in the app and on our website, and the "Last Updated" date will be revised accordingly. Continued use of the app signifies acceptance of any changes.
          </Text>
        </Section>

        <Section title="11. Contact Us">
          <Text style={[styles.bodyText, {color: colors.textSecondary, marginBottom: verticalScale(16)}]}>
            For privacy-related questions, deletion requests, or other concerns, please contact us at:
          </Text>
          
          <View style={styles.contactLargeCard}>
            <View style={styles.contactRow}>
              <Mail size={18} color={colors.primary} />
              <Text style={[styles.contactLabel, {color: colors.text}]}>support@ilifelearn.com</Text>
            </View>
            <View style={[styles.contactRow, {alignItems: 'flex-start'}]}>
              <MapPin size={18} color={colors.primary} style={{marginTop: 2}} />
              <Text style={[styles.contactLabel, {color: colors.text, lineHeight: 22}]}>
                A/25, Mithaghar Road, Mulund East Mumbai, Maharashtra 400081 India
              </Text>
            </View>
          </View>
        </Section>

        <Text style={[styles.footerNote, {color: colors.textSecondary}]}>
          Sanfort Smart Learning is committed to providing a safe and enriching reading experience for children. Thank you for trusting us with your child's reading journey!
        </Text>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  headerGradient: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(24),
    borderBottomLeftRadius: moderateScale(32),
    borderBottomRightRadius: moderateScale(32),
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    marginTop: verticalScale(8),
  },
  backBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  lastUpdated: {
    fontSize: moderateScale(11),
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: scale(22),
    paddingTop: verticalScale(24),
  },
  introCard: {
    borderRadius: moderateScale(24),
    padding: scale(20),
    borderWidth: 1,
    marginBottom: verticalScale(28),
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    marginBottom: verticalScale(8),
  },
  appName: {
    fontSize: moderateScale(18),
    fontWeight: '800',
  },
  companyName: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginBottom: verticalScale(16),
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(16),
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  contactText: {
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  section: {
    marginBottom: verticalScale(32),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: verticalScale(14),
    letterSpacing: -0.2,
  },
  subHeading: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    marginBottom: verticalScale(10),
  },
  bodyText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(22),
    textAlign: 'left',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: verticalScale(10),
    paddingRight: scale(10),
  },
  bullet: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginTop: verticalScale(8),
    marginRight: scale(12),
  },
  bulletContent: {
    flex: 1,
  },
  bulletText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(21),
  },
  negativeList: {
    gap: verticalScale(6),
  },
  negativeItem: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  infoBox: {
    marginTop: verticalScale(16),
    padding: scale(16),
    borderRadius: moderateScale(16),
    borderLeftWidth: 4,
  },
  infoBoxText: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
  },
  numberedList: {
    gap: verticalScale(12),
  },
  numberedItem: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(22),
  },
  contactLargeCard: {
    gap: verticalScale(14),
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  contactLabel: {
    flex: 1,
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  footerNote: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: verticalScale(10),
    marginBottom: verticalScale(20),
    fontStyle: 'italic',
    paddingHorizontal: scale(10),
  },
  footerSpacing: {
    height: verticalScale(20),
  },
});
