import React, {useCallback, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BookOpen, ChevronLeft, ChevronRight, PlayCircle, X} from 'lucide-react-native';
import type {EbookPage} from '@/types';
import {withAlpha} from '@/screens/books/books.data';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

interface FullScreenBookReaderProps {
  visible: boolean;
  pages: EbookPage[];
  initialPage?: number;
  accentColor: string;
  bookTitle: string;
  volumeTitle: string;
  onClose: () => void;
  onPlayVideo?: (url: string, title: string) => void;
}

export default function FullScreenBookReader({
  visible,
  pages,
  initialPage = 0,
  accentColor,
  bookTitle,
  volumeTitle,
  onClose,
  onPlayVideo,
}: FullScreenBookReaderProps) {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [showControls, setShowControls] = useState(true);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList<EbookPage>>(null);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pageWidth = e.nativeEvent.layoutMeasurement.width;
      if (pageWidth <= 0) {
        return;
      }
      const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setCurrentPage(idx);
    },
    [],
  );

  const goToPage = useCallback(
    (dir: 'prev' | 'next') => {
      const next =
        dir === 'prev'
          ? Math.max(0, currentPage - 1)
          : Math.min(pages.length - 1, currentPage + 1);
      if (next !== currentPage) {
        setCurrentPage(next);
        (flatListRef.current as any)?.scrollToIndex?.({index: next, animated: true});
      }
    },
    [currentPage, pages.length],
  );

  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  const renderPage = useCallback(
    ({item, index}: {item: EbookPage; index: number}) => {
      const imageUrl = item.content.image || item.lastSavedContent.image;
      const videoUrl = item.content.video || item.lastSavedContent.video;

      // Page flip animation: each page rotates slightly based on scroll position
      const inputRange = [
        (index - 1) * SCREEN_W,
        index * SCREEN_W,
        (index + 1) * SCREEN_W,
      ];

      const rotateY = scrollX.interpolate({
        inputRange,
        outputRange: ['45deg', '0deg', '-45deg'],
        extrapolate: 'clamp',
      });

      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.5, 1, 0.5],
        extrapolate: 'clamp',
      });

      const pageScale = scrollX.interpolate({
        inputRange,
        outputRange: [0.85, 1, 0.85],
        extrapolate: 'clamp',
      });

      return (
        <Pressable onPress={toggleControls} style={styles.pageContainer}>
          <Animated.View
            style={[
              styles.pageInner,
              {
                opacity,
                transform: [
                  {perspective: 1200},
                  {rotateY},
                  {scale: pageScale},
                ],
              },
            ]}>
            {/* Book page with paper texture */}
            <View style={styles.paperPage}>
              {/* Page curl shadow */}
              <View style={styles.pageCurlShadow} />

              {imageUrl ? (
                <Image
                  source={{uri: imageUrl}}
                  resizeMode="contain"
                  style={styles.fullPageImage}
                />
              ) : (
                <View style={styles.noPreview}>
                  <BookOpen
                    size={moderateScale(48)}
                    color={withAlpha(accentColor, 0.3)}
                    strokeWidth={1.5}
                  />
                  <Text style={styles.noPreviewText}>No preview</Text>
                </View>
              )}

              {/* Video play button overlay */}
              {!!videoUrl && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onPlayVideo?.(videoUrl, `${volumeTitle} • Page ${index + 1}`)}
                  style={styles.videoButton}>
                  <View style={[styles.videoButtonCircle, {backgroundColor: accentColor}]}>
                    <PlayCircle size={moderateScale(32)} color="#fff" strokeWidth={2} />
                  </View>
                  <Text style={styles.videoButtonText}>Watch Video</Text>
                </TouchableOpacity>
              )}

              {item.type === 'writeImage' && (
                <View style={[styles.activityBadge, styles.activityBadgeWarning]}>
                  <Text style={styles.activityBadgeText}>Write Activity</Text>
                </View>
              )}

              {/* Page number at bottom */}
              <View style={styles.pageNumFooter}>
                <Text style={styles.pageNum}>{index + 1}</Text>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      );
    },
    [accentColor, onPlayVideo, scrollX, toggleControls, volumeTitle],
  );

  if (!visible || pages.length === 0) {
    return null;
  }
  const prevDisabled = currentPage === 0;
  const nextDisabled = currentPage === pages.length - 1;
  const navButtonActiveStyle = {backgroundColor: withAlpha(accentColor, 0.25)};
  const prevNavButtonStyle = prevDisabled ? styles.navBtnDisabled : navButtonActiveStyle;
  const nextNavButtonStyle = nextDisabled ? styles.navBtnDisabled : navButtonActiveStyle;
  const prevIconColor = prevDisabled ? 'rgba(255,255,255,0.3)' : '#fff';
  const nextIconColor = nextDisabled ? 'rgba(255,255,255,0.3)' : '#fff';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <StatusBar hidden={!showControls} animated />
      <View style={styles.root}>
        {/* Pages */}
        <Animated.FlatList
          ref={flatListRef}
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          onScroll={Animated.event(
            [{nativeEvent: {contentOffset: {x: scrollX}}}],
            {useNativeDriver: true},
          )}
          renderItem={renderPage}
          keyExtractor={item => item.pageId}
          getItemLayout={(_d, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          initialScrollIndex={initialPage}
          scrollEventThrottle={16}
        />

        {/* Top bar - close + title */}
        {showControls && (
          <View style={[styles.topBar, {paddingTop: insets.top + verticalScale(8)}]}>
            <View style={styles.topBarBg} />
            <View style={styles.topBarContent}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={styles.closeBtn}>
                <X size={moderateScale(20)} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.topBarTitle}>
                <Text style={styles.topBarBookTitle} numberOfLines={1}>
                  {bookTitle}
                </Text>
                <Text style={styles.topBarVolume} numberOfLines={1}>
                  {volumeTitle}
                </Text>
              </View>

              <View style={[styles.pageCountPill, {backgroundColor: accentColor}]}>
                <Text style={styles.pageCountText}>
                  {currentPage + 1}/{pages.length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom navigation bar */}
        {showControls && (
          <View style={[styles.bottomBar, {paddingBottom: insets.bottom + verticalScale(8)}]}>
            <View style={styles.bottomBarBg} />
            <View style={styles.bottomBarContent}>
              {/* Previous */}
              <Pressable
                onPress={() => goToPage('prev')}
                disabled={prevDisabled}
                style={[
                  styles.navBtn,
                  prevNavButtonStyle,
                ]}>
                <ChevronLeft
                  size={moderateScale(22)}
                  color={prevIconColor}
                  strokeWidth={2.5}
                />
              </Pressable>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: accentColor,
                        width: `${((currentPage + 1) / pages.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Page {currentPage + 1} of {pages.length}
                </Text>
              </View>

              {/* Next */}
              <Pressable
                onPress={() => goToPage('next')}
                disabled={nextDisabled}
                style={[
                  styles.navBtn,
                  nextNavButtonStyle,
                ]}>
                <ChevronRight
                  size={moderateScale(22)}
                  color={nextIconColor}
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },

  /* ── Pages ── */
  pageContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(60),
  },
  pageInner: {
    flex: 1,
    width: '100%',
    borderRadius: moderateScale(8),
    overflow: 'hidden',
  },
  paperPage: {
    flex: 1,
    backgroundColor: '#FFFEF9',
    borderRadius: moderateScale(6),
    overflow: 'hidden',
    // Book page shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 4, height: 4},
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  pageCurlShadow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: scale(20),
    zIndex: 2,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: -3, height: 0},
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
    }),
  },
  fullPageImage: {
    flex: 1,
    width: '100%',
  },
  noPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPreviewText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(14),
    color: 'rgba(0,0,0,0.3)',
    fontWeight: '600',
  },
  videoButton: {
    position: 'absolute',
    bottom: verticalScale(60),
    alignSelf: 'center',
    alignItems: 'center',
    gap: verticalScale(6),
    zIndex: 3,
  },
  videoButtonCircle: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  videoButtonText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: 'rgba(0,0,0,0.5)',
  },
  activityBadge: {
    position: 'absolute',
    right: scale(12),
    top: verticalScale(12),
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    zIndex: 3,
  },
  activityBadgeWarning: {
    backgroundColor: '#F59E0B',
  },
  activityBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
  },
  pageNumFooter: {
    position: 'absolute',
    bottom: verticalScale(10),
    alignSelf: 'center',
  },
  pageNum: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: 'rgba(0,0,0,0.3)',
  },

  /* ── Top Bar ── */
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,46,0.92)',
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    gap: scale(12),
  },
  closeBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  topBarTitle: {
    flex: 1,
  },
  topBarBookTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#fff',
  },
  topBarVolume: {
    fontSize: moderateScale(11),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginTop: verticalScale(1),
  },
  pageCountPill: {
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
  },
  pageCountText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: '#fff',
  },

  /* ── Bottom Bar ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,46,0.92)',
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    gap: scale(12),
  },
  navBtn: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    gap: verticalScale(6),
  },
  progressTrack: {
    width: '100%',
    height: verticalScale(4),
    borderRadius: verticalScale(2),
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: verticalScale(2),
  },
  progressText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
});
