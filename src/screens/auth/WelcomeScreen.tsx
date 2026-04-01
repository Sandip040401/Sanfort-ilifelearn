import React from 'react';
import {Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {StackNavigationProp} from '@react-navigation/stack';
import {BookOpen, ChevronRight, Globe} from 'lucide-react-native';
import type {AuthStackParamList} from '@/types';
import Animated, {FadeInDown, FadeInUp, ZoomIn} from 'react-native-reanimated';
import {APP_NAME} from '@/config/appInfo';

type Props = {
  navigation: StackNavigationProp<AuthStackParamList, 'Welcome'>;
};

const FEATURES = [
  {Icon: BookOpen, label: 'Grade Books & Ebooks',     sub: 'Curriculum aligned content'},
  {Icon: Globe,    label: 'AR & WebVR Experiences',   sub: 'Immersive 3D learning'},
] as const;

export default function WelcomeScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;
  const maxContentWidth = isTablet ? Math.min(width * 0.65, 560) : undefined;
  const wrapStyle = maxContentWidth
    ? {width: maxContentWidth, alignSelf: 'center' as const}
    : undefined;

  return (
    <LinearGradient
      colors={['#3D2799', '#4930B3', '#5438CC', '#6040E5', '#6C4CFF']}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      start={{x: 0.1, y: 0}}
      end={{x: 0.9, y: 1}}
      style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.circle1} accessibilityElementsHidden />
      <View style={styles.circle2} accessibilityElementsHidden />
      <View style={styles.circle3} accessibilityElementsHidden />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>

        {/* Hero */}
        <Animated.View 
          entering={FadeInDown.duration(800).springify()}
          style={[styles.hero, {paddingTop: insets.top + verticalScale(28)}, wrapStyle]}>
          <Animated.View 
            entering={ZoomIn.delay(300).duration(600)}
            style={styles.logoWrap} accessibilityRole="image" accessibilityLabel={`${APP_NAME} logo`}>

              <Image
                source={require('@/assets/images/logo/sanfort-splash-screen-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
          
            <View style={styles.logoBadge}>
              <BookOpen size={moderateScale(12)} color="#fff" strokeWidth={2} />
            </View>
          </Animated.View>
          <Text style={styles.appName} accessibilityRole="header">{APP_NAME}</Text>
          <Text style={styles.tagline}>Learn · Explore · Grow</Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(800)}
          style={[
            styles.featuresWrap,
            wrapStyle ? {...wrapStyle, marginHorizontal: 0} : undefined,
          ]}
          accessibilityLabel="App features">
          {FEATURES.map(({Icon, label, sub}, index) => (
            <Animated.View
              entering={FadeInDown.delay(700 + index * 100)}
              key={label}
              style={styles.featureRow}
              accessible
              accessibilityLabel={`${label}: ${sub}`}>
              <View style={styles.featureIcon} accessibilityElementsHidden>
                <Icon size={moderateScale(20)} color="#6C4CFF" strokeWidth={2} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{label}</Text>
                <Text style={styles.featureSub}>{sub}</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View 
          entering={FadeInUp.delay(1000).duration(800)}
          style={[styles.bottomWrap, {paddingBottom: insets.bottom + verticalScale(28)}, wrapStyle ? {...wrapStyle, paddingHorizontal: 0} : undefined]}>
          <TouchableOpacity
            testID="welcome-get-started-btn"
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={`Get started with ${APP_NAME}`}
            accessibilityHint="Opens the sign in screen">
            <Text style={styles.ctaBtnText}>Get Started</Text>
            <ChevronRight size={moderateScale(20)} color="#6C4CFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.versionText} accessibilityElementsHidden>Made for curious minds ✨</Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scrollContent: {flexGrow: 1},

  circle1: {position:'absolute', top:verticalScale(-80), right:scale(-80), width:scale(280), height:scale(280), borderRadius:scale(140), backgroundColor:'rgba(255,255,255,0.06)'},
  circle2: {position:'absolute', top:'30%', left:scale(-60), width:scale(200), height:scale(200), borderRadius:scale(100), backgroundColor:'rgba(255,255,255,0.04)'},
  circle3: {position:'absolute', bottom:verticalScale(80), right:scale(-40), width:scale(160), height:scale(160), borderRadius:scale(80), backgroundColor:'rgba(255,255,255,0.05)'},

  hero:       {alignItems:'center', paddingHorizontal:scale(24)},
  logoWrap:   {marginBottom:verticalScale(20), position:'relative'},
  logoImage:  {width:scale(110), height:scale(110)},
  logoBadge:  {position:'absolute', bottom:verticalScale(0), right:scale(0), width:scale(28), height:scale(28), borderRadius:scale(14), backgroundColor:'#FFB020', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#fff'},
  appName:    {fontSize:moderateScale(28), lineHeight:moderateScale(34), fontWeight:'800', color:'#fff', letterSpacing:0.3, marginBottom:verticalScale(6), textAlign:'center'},
  tagline:    {fontSize:moderateScale(14), color:'rgba(255,255,255,0.7)', letterSpacing:2},

  featuresWrap: {marginHorizontal:scale(20), marginTop:verticalScale(28), backgroundColor:'rgba(255,255,255,0.12)', borderRadius:moderateScale(20), padding:moderateScale(18), borderWidth:1, borderColor:'rgba(255,255,255,0.2)', gap:verticalScale(14)},
  featureRow:   {flexDirection:'row', alignItems:'center', gap:scale(12)},
  featureIcon:  {width:scale(40), height:scale(40), borderRadius:moderateScale(12), backgroundColor:'#fff', alignItems:'center', justifyContent:'center'},
  featureText:  {flex:1},
  featureLabel: {fontSize:moderateScale(13), fontWeight:'600', color:'#fff', marginBottom:2},
  featureSub:   {fontSize:moderateScale(11), color:'rgba(255,255,255,0.65)'},

  bottomWrap: {paddingHorizontal:scale(24), marginTop:'auto', paddingTop:verticalScale(20), gap:verticalScale(14)},
  ctaBtn:     {flexDirection:'row', alignItems:'center', justifyContent:'center', gap:scale(8), backgroundColor:'#fff', borderRadius:moderateScale(18), paddingVertical:verticalScale(16), shadowColor:'#000', shadowOffset:{width:0, height:verticalScale(8)}, shadowOpacity:0.2, shadowRadius:moderateScale(16)},
  ctaBtnText: {fontSize:moderateScale(16), fontWeight:'700', color:'#6C4CFF'},
  versionText:{textAlign:'center', fontSize:moderateScale(12), color:'rgba(255,255,255,0.5)'},
});
