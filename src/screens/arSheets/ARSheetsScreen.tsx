import React from 'react';
import {
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {scale, verticalScale, moderateScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ScanLine, FileText, Clock, Info} from 'lucide-react-native';
import {useTheme, Typography} from '@/theme';
import {ScreenErrorBoundary} from '@/components/ui';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';

const {width: SCREEN_W} = Dimensions.get('window');
const H_PAD = scale(20);

const RECENT_SCANS = [
  {id: '1', name: 'Math Sheet 1', date: '2 hours ago'},
  {id: '2', name: 'Science Lab', date: 'Yesterday'},
  {id: '3', name: 'English Quiz', date: '3 days ago'},
];

function ARSheetsContent() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const {width} = useWindowDimensions();
  const isTablet = width >= 768;
  const contentWidth = isTablet ? Math.min(width * 0.75, 620) : undefined;
  const bottomContentInset = insets.bottom + verticalScale(24);

  const renderScanItem = ({item}: {item: typeof RECENT_SCANS[0]}) => (
    <TouchableOpacity
      style={[styles.scanItem, {backgroundColor: colors.surface, borderColor: colors.border}]}
      activeOpacity={0.8}>
      <View style={[styles.scanIconWrap, {backgroundColor: colors.primarySurface}]}>
        <FileText size={20} color={colors.primary} strokeWidth={2} />
      </View>
      <Text style={[styles.scanName, {color: colors.text}]} numberOfLines={1}>
        {item.name}
      </Text>
      <View style={styles.scanDateRow}>
        <Clock size={10} color={colors.textTertiary} strokeWidth={2} />
        <Text style={[styles.scanDate, {color: colors.textTertiary}]}>{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{paddingBottom: bottomContentInset}}>

        {/* Header */}
        <View style={[styles.header, {paddingTop: insets.top + verticalScale(16)}]}>
          <LinearGradient
            colors={['#0D9488', '#10AE9A', '#14B8A6']}
            locations={[0, 0.5, 1]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.headerTitle}>AR Sheets</Text>
          <Text style={styles.headerSub}>Scan worksheets and bring them to life</Text>
          <View style={[styles.curve, {backgroundColor: colors.background}]} />
        </View>

        <View style={[styles.content, contentWidth ? {width: contentWidth, alignSelf: 'center'} : undefined]}>

          {/* Scan Area Placeholder */}
          <View style={[styles.scanArea, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <View style={styles.scanPreview}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
              <ScanLine size={48} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
              <Text style={styles.scanPlaceholderText}>Point camera at worksheet</Text>
            </View>
          </View>

          {/* Scan Button */}
          <TouchableOpacity activeOpacity={0.85} style={styles.scanBtnWrap}>
            <View style={styles.scanBtn}>
              <LinearGradient
                colors={['#0D9488', '#10AE9A', '#14B8A6']}
                locations={[0, 0.5, 1]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={StyleSheet.absoluteFill}
              />
              <ScanLine size={20} color="#fff" strokeWidth={2} />
              <Text style={styles.scanBtnText}>Scan Worksheet</Text>
            </View>
          </TouchableOpacity>

          {/* Recent Scans */}
          <Text style={[styles.section, {color: colors.text}]}>Recent Scans</Text>
          <FlatList
            data={RECENT_SCANS}
            renderItem={renderScanItem}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scansList}
            ItemSeparatorComponent={() => <View style={{width: scale(10)}} />}
            scrollEnabled={true}
          />

          {/* Instructions Card */}
          <Text style={[styles.section, {color: colors.text}]}>How It Works</Text>
          <View style={[styles.instructionsCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={[styles.infoIconWrap, {backgroundColor: '#E6FDF9'}]}>
              <Info size={20} color="#0D9488" strokeWidth={2} />
            </View>
            <View style={styles.instructionsList}>
              {[
                'Place the worksheet on a flat surface',
                'Tap "Scan Worksheet" and point your camera',
                'Watch 3D animations appear on the page',
                'Interact with models by tapping on them',
              ].map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepBadge, {backgroundColor: colors.primarySurface}]}>
                    <Text style={[styles.stepNum, {color: colors.primary}]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, {color: colors.textSecondary}]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function ARSheetsScreen() {
  return (
    <ScreenErrorBoundary>
      <ARSheetsContent />
    </ScreenErrorBoundary>
  );
}

const CORNER_SIZE = scale(20);
const CORNER_WIDTH = 3;
const CORNER_COLOR = 'rgba(255,255,255,0.5)';

const styles = StyleSheet.create({
  root: {flex: 1},

  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(30),
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: moderateScale(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(4),
  },
  headerSub: {
    fontSize: moderateScale(13),
    color: 'rgba(255,255,255,0.7)',
  },
  curve: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: verticalScale(10),
    borderTopLeftRadius: moderateScale(16),
    borderTopRightRadius: moderateScale(16),
  },

  content: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(2),
  },

  scanArea: {
    borderRadius: moderateScale(20),
    overflow: 'hidden',
    marginBottom: verticalScale(16),
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: verticalScale(4)},
        shadowOpacity: 0.08,
        shadowRadius: moderateScale(12),
      },
      android: {},
    }),
  },
  scanPreview: {
    height: verticalScale(220),
    backgroundColor: '#1A2330',
    borderRadius: moderateScale(16),
    margin: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanPlaceholderText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.35)',
    marginTop: verticalScale(10),
  },

  cornerTL: {
    position: 'absolute',
    top: scale(16),
    left: scale(16),
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderTopLeftRadius: moderateScale(4),
  },
  cornerTR: {
    position: 'absolute',
    top: scale(16),
    right: scale(16),
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderTopRightRadius: moderateScale(4),
  },
  cornerBL: {
    position: 'absolute',
    bottom: scale(16),
    left: scale(16),
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderBottomLeftRadius: moderateScale(4),
  },
  cornerBR: {
    position: 'absolute',
    bottom: scale(16),
    right: scale(16),
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
    borderBottomRightRadius: moderateScale(4),
  },

  scanBtnWrap: {
    marginBottom: verticalScale(20),
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    height: verticalScale(50),
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0D9488',
        shadowOffset: {width: 0, height: verticalScale(6)},
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(10),
      },
      android: {},
    }),
  },
  scanBtnText: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#fff',
  },

  section: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    marginBottom: verticalScale(10),
    marginTop: verticalScale(4),
  },

  scansList: {
    paddingBottom: verticalScale(4),
  },
  scanItem: {
    width: scale(120),
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    alignItems: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: verticalScale(2)},
        shadowOpacity: 0.06,
        shadowRadius: moderateScale(6),
      },
      android: {},
    }),
  },
  scanIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(8),
  },
  scanName: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginBottom: verticalScale(4),
    textAlign: 'center',
  },
  scanDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  scanDate: {
    fontSize: moderateScale(9),
  },

  instructionsCard: {
    borderRadius: moderateScale(18),
    padding: moderateScale(18),
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: verticalScale(2)},
        shadowOpacity: 0.06,
        shadowRadius: moderateScale(6),
      },
      android: {},
    }),
  },
  infoIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  instructionsList: {
    gap: verticalScale(10),
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  stepBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
});
