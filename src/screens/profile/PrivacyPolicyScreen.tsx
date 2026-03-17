import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';
import {useTheme, BorderRadius} from '@/theme';

export default function PrivacyPolicyScreen() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {paddingTop: insets.top + verticalScale(8)},
        ]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={[styles.backBtn, {backgroundColor: colors.card, borderColor: colors.divider}]}>
          <ArrowLeft size={moderateScale(20)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Privacy Policy</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, {paddingBottom: insets.bottom + verticalScale(20)}]}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.placeholderText, {color: colors.textSecondary}]}>
          Our Privacy Policy will be added here soon.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
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
  content: {
    padding: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  placeholderText: {
    fontSize: moderateScale(14),
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
