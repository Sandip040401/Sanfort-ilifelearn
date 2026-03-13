import React, {startTransition, useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import {BookOpen, ChevronLeft, ChevronRight, Expand, FileText, PlayCircle} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import {useTheme} from '@/theme';
import type {Ebook, EbookPage} from '@/types';
import MediaViewer, {type MediaViewerPayload} from '@/components/MediaViewer';
import FullScreenBookReader from '@/components/books/FullScreenBookReader';
import {withAlpha} from '@/screens/books/books.data';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const BOOK_MARGIN = scale(16);
const BOOK_WIDTH = SCREEN_WIDTH - BOOK_MARGIN * 2;
const PAGE_ASPECT_RATIO = 1.35;
const PAGE_HEIGHT = BOOK_WIDTH * PAGE_ASPECT_RATIO;

function getDocumentViewerUrl(url: string): string {
  if (/\.pdf(\?|$)/i.test(url)) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }

  return url;
}

export default function EbooksTab({
  ebooks,
  arSheets,
  accentColor,
  bottomInset,
  headerContent,
  refreshing,
  onRefresh,
}: {
  ebooks: Ebook[];
  arSheets: string[];
  accentColor: string;
  bottomInset: number;
  headerContent?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const {colors} = useTheme();
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);
  const [selectedVolumeIndex, setSelectedVolumeIndex] = useState(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<MediaViewerPayload | null>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const pagesRef = useRef<FlatList<EbookPage>>(null);

  const activeBook = ebooks[selectedBookIndex];
  const activeVolume = activeBook?.volumes?.[selectedVolumeIndex];
  const pages = activeVolume?.pages ?? [];
  const documentUrl = activeVolume?.pdfUrl;

  const bookTitle = activeBook?.title || activeVolume?.title || 'Ebook';
  const volumeTitle = activeVolume?.title || 'Volume';

  const onPagesMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;
    if (pageWidth <= 0) {
      return;
    }

    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentPageIndex(pageIndex);
  };

  const goToPage = useCallback(
    (direction: 'prev' | 'next') => {
      const newIndex = direction === 'prev'
        ? Math.max(0, currentPageIndex - 1)
        : Math.min(pages.length - 1, currentPageIndex + 1);

      if (newIndex !== currentPageIndex) {
        setCurrentPageIndex(newIndex);
        pagesRef.current?.scrollToIndex({index: newIndex, animated: true});
      }
    },
    [currentPageIndex, pages.length],
  );

  const handleBookSelect = (index: number) => {
    if (index === selectedBookIndex) {
      return;
    }

    startTransition(() => {
      setSelectedBookIndex(index);
      setSelectedVolumeIndex(0);
      setCurrentPageIndex(0);
    });
  };

  const handleVolumeSelect = (index: number) => {
    if (index === selectedVolumeIndex) {
      return;
    }

    startTransition(() => {
      setSelectedVolumeIndex(index);
      setCurrentPageIndex(0);
    });
    pagesRef.current?.scrollToOffset({offset: 0, animated: false});
  };

  const handleOpenWorksheet = (url: string, index: number) => {
    setSelectedMedia({
      type: 'document',
      url,
      title: `Worksheet ${index + 1}`,
    });
  };

  const handleOpenFullScreen = useCallback(() => {
    setFullScreenOpen(true);
  }, []);

  const handleCloseFullScreen = useCallback(() => {
    setFullScreenOpen(false);
  }, []);

  const handlePlayVideoFromReader = useCallback((url: string, title: string) => {
    setSelectedMedia({type: 'video', url, title});
  }, []);

  const activeSelectorTextStyle = styles.selectorChipTextActive;
  const inactiveSelectorTextStyle = useMemo(
    () => [styles.selectorChipText, {color: colors.textSecondary}],
    [colors.textSecondary],
  );

  const renderPage = ({item, index}: {item: EbookPage; index: number}) => {
    const imageUrl = item.content.image || item.lastSavedContent.image;
    const videoUrl = item.content.video || item.lastSavedContent.video;
    const videoPosition = item.content.position || item.lastSavedContent.position || 'right';

    return (
      <Pressable onPress={handleOpenFullScreen} style={styles.pageSlide}>
        <View style={[styles.bookPage, {backgroundColor: '#FFFDF7'}]}>
          {/* Page spine shadow on left */}
          <View style={styles.pageSpine} />

          {imageUrl ? (
            <Image
              source={{uri: imageUrl}}
              resizeMode="contain"
              style={styles.pageImage}
            />
          ) : (
            <View style={[styles.pageFallback, {backgroundColor: withAlpha(accentColor, 0.06)}]}>
              <BookOpen size={moderateScale(40)} color={accentColor} strokeWidth={1.5} />
              <Text style={[styles.pageFallbackText, {color: colors.textSecondary}]}>
                No preview for this page
              </Text>
            </View>
          )}

          {!!videoUrl && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                setSelectedMedia({
                  type: 'video',
                  url: videoUrl,
                  title: `${volumeTitle} • Page ${index + 1}`,
                })
              }
              style={[
                styles.playOverlay,
                videoPosition === 'left' ? styles.playOverlayLeft : styles.playOverlayRight,
              ]}>
              <View style={[styles.playButton, {backgroundColor: accentColor}]}>
                <PlayCircle size={moderateScale(28)} color="#fff" strokeWidth={2} />
              </View>
            </TouchableOpacity>
          )}

          {item.type === 'writeImage' && (
            <View style={styles.writeBadge}>
              <Text style={styles.writeBadgeText}>Write Activity</Text>
            </View>
          )}

          {/* Tap to expand hint */}
          <View style={[styles.expandHint, {backgroundColor: withAlpha(accentColor, 0.9)}]}>
            <Expand size={moderateScale(12)} color="#fff" strokeWidth={2.5} />
            <Text style={styles.expandHintText}>Tap to read full screen</Text>
          </View>

          {/* Page number footer */}
          <View style={styles.pageFooter}>
            <View style={[styles.pageNumberDot, {backgroundColor: accentColor}]} />
            <Text style={[styles.pageFooterText, {color: withAlpha('#000', 0.4)}]}>
              {index + 1}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView
        style={styles.root}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accentColor}
            colors={[accentColor]}
            progressBackgroundColor="#FFFFFF"
          />
        }
        contentContainerStyle={{paddingBottom: bottomInset + verticalScale(12)}}>
        {headerContent}

        {/* Book & Volume selectors */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <BookOpen size={moderateScale(20)} color={accentColor} strokeWidth={2.2} />
            <Text style={[styles.sectionTitle, {color: colors.text}]} numberOfLines={1}>
              {bookTitle}
            </Text>
          </View>

          {ebooks.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
              {ebooks.map((ebook, index) => {
                const selected = selectedBookIndex === index;

                return (
                  <TouchableOpacity
                    key={`${ebook.title}-${index}`}
                    activeOpacity={0.85}
                    onPress={() => handleBookSelect(index)}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: selected ? accentColor : colors.surface,
                        borderColor: selected ? accentColor : colors.border,
                      },
                    ]}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={selected ? activeSelectorTextStyle : inactiveSelectorTextStyle}>
                      {ebook.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {(activeBook?.volumes?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRow}>
              {activeBook.volumes.map((volume, index) => {
                const selected = selectedVolumeIndex === index;

                return (
                  <TouchableOpacity
                    key={volume.id}
                    activeOpacity={0.85}
                    onPress={() => handleVolumeSelect(index)}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: selected ? accentColor : colors.surface,
                        borderColor: selected ? accentColor : colors.border,
                      },
                    ]}>
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={selected ? activeSelectorTextStyle : inactiveSelectorTextStyle}>
                      {volume.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Book Reader Area */}
        <View style={styles.bookContainer}>
          {documentUrl ? (
            <View style={[styles.documentViewer, {borderColor: withAlpha(accentColor, 0.14)}]}>
              <WebView
                source={{uri: getDocumentViewerUrl(documentUrl)}}
                originWhitelist={['*']}
                startInLoadingState
                renderLoading={() => (
                  <View style={[styles.viewerLoadingState, {backgroundColor: '#FFFDF7'}]}>
                    <ActivityIndicator size="small" color={accentColor} />
                    <Text style={[styles.viewerLoadingText, {color: colors.textSecondary}]}>
                      Opening {volumeTitle}…
                    </Text>
                  </View>
                )}
                style={styles.webview}
              />
            </View>
          ) : pages.length > 0 ? (
            <>
              {/* Book wrapper with shadow & spine effect */}
              <View style={styles.bookWrapper}>
                <LinearGradient
                  colors={[withAlpha(accentColor, 0.08), withAlpha(accentColor, 0.02)]}
                  locations={[0, 1]}
                  style={styles.bookShadowBg}
                />
                <View style={[styles.bookFrame, {borderColor: withAlpha(accentColor, 0.12)}]}>
                  <FlatList
                    ref={pagesRef}
                    key={`${activeBook?.title}-${activeVolume?.id}`}
                    data={pages}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onPagesMomentumEnd}
                    renderItem={renderPage}
                    keyExtractor={item => item.pageId}
                    getItemLayout={(_data, index) => ({
                      length: BOOK_WIDTH,
                      offset: BOOK_WIDTH * index,
                      index,
                    })}
                  />
                </View>
              </View>

              {/* Navigation controls below the book */}
              <View style={styles.bookControls}>
                <Pressable
                  onPress={() => goToPage('prev')}
                  disabled={currentPageIndex === 0}
                  style={[
                    styles.navButton,
                    {
                      backgroundColor: currentPageIndex === 0
                        ? withAlpha(colors.textSecondary, 0.08)
                        : withAlpha(accentColor, 0.12),
                    },
                  ]}>
                  <ChevronLeft
                    size={moderateScale(20)}
                    color={currentPageIndex === 0 ? colors.textSecondary : accentColor}
                    strokeWidth={2.5}
                  />
                </Pressable>

                <View style={styles.pageInfo}>
                  <Text style={[styles.pageInfoTitle, {color: colors.text}]} numberOfLines={1}>
                    {volumeTitle}
                  </Text>
                  <Text style={[styles.pageInfoCount, {color: accentColor}]}>
                    Page {currentPageIndex + 1} of {pages.length}
                  </Text>
                </View>

                <Pressable
                  onPress={() => goToPage('next')}
                  disabled={currentPageIndex === pages.length - 1}
                  style={[
                    styles.navButton,
                    {
                      backgroundColor: currentPageIndex === pages.length - 1
                        ? withAlpha(colors.textSecondary, 0.08)
                        : withAlpha(accentColor, 0.12),
                    },
                  ]}>
                  <ChevronRight
                    size={moderateScale(20)}
                    color={currentPageIndex === pages.length - 1 ? colors.textSecondary : accentColor}
                    strokeWidth={2.5}
                  />
                </Pressable>
              </View>

              {/* Full screen read button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleOpenFullScreen}
                style={[styles.readFullBtn, {backgroundColor: accentColor}]}>
                <Expand size={moderateScale(16)} color="#fff" strokeWidth={2.5} />
                <Text style={styles.readFullBtnText}>Read Full Screen</Text>
              </TouchableOpacity>

              {/* Page dots indicator */}
              {pages.length <= 20 && (
                <View style={styles.dotsRow}>
                  {pages.map((_p, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: i === currentPageIndex ? accentColor : withAlpha(accentColor, 0.2),
                          width: i === currentPageIndex ? scale(16) : scale(6),
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.emptyState, {backgroundColor: colors.surface}]}>
              <View style={[styles.emptyIconWrap, {backgroundColor: withAlpha(accentColor, 0.10)}]}>
                <BookOpen size={moderateScale(30)} color={accentColor} strokeWidth={2} />
              </View>
              <Text style={[styles.emptyTitle, {color: colors.text}]}>No ebook preview available</Text>
              <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
                This volume does not have pages or a document link yet.
              </Text>
            </View>
          )}
        </View>

        {/* Worksheets section */}
        {!!arSheets.length && (
          <View style={styles.worksheetsSection}>
            <Text style={[styles.worksheetsTitle, {color: colors.text}]}>Worksheets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.worksheetsRow}>
              {arSheets.map((sheetUrl, index) => (
                <TouchableOpacity
                  key={`${sheetUrl}-${index}`}
                  activeOpacity={0.86}
                  onPress={() => handleOpenWorksheet(sheetUrl, index)}
                  style={[
                    styles.worksheetCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: withAlpha(accentColor, 0.14),
                    },
                  ]}>
                  <LinearGradient
                    colors={[withAlpha(accentColor, 0.18), withAlpha(accentColor, 0.08)]}
                    locations={[0, 1]}
                    style={styles.worksheetIconWrap}>
                    <FileText size={moderateScale(20)} color={accentColor} strokeWidth={2} />
                  </LinearGradient>
                  <Text style={[styles.worksheetLabel, {color: colors.text}]}>
                    Worksheet {index + 1}
                  </Text>
                  <Text style={[styles.worksheetMeta, {color: colors.textSecondary}]}>
                    Open in viewer
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Full screen book reader modal */}
      <FullScreenBookReader
        visible={fullScreenOpen}
        pages={pages}
        initialPage={currentPageIndex}
        accentColor={accentColor}
        bookTitle={bookTitle}
        volumeTitle={volumeTitle}
        onClose={handleCloseFullScreen}
        onPlayVideo={handlePlayVideoFromReader}
      />

      <MediaViewer media={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(16),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(12),
  },
  sectionTitle: {
    flex: 1,
    fontSize: moderateScale(20),
    fontWeight: '800',
  },
  selectorRow: {
    gap: scale(8),
    paddingBottom: verticalScale(8),
  },
  selectorChip: {
    borderRadius: moderateScale(999),
    borderWidth: 1,
    minHeight: verticalScale(38),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    justifyContent: 'center',
  },
  selectorChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  selectorChipTextActive: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#fff',
  },

  /* ── Book Reader ── */
  bookContainer: {
    paddingTop: verticalScale(8),
  },
  bookWrapper: {
    marginHorizontal: BOOK_MARGIN,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
  },
  bookShadowBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(16),
  },
  bookFrame: {
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#FFFDF7',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(6)},
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(16),
    elevation: 8,
  },
  pageSlide: {
    width: BOOK_WIDTH,
  },
  bookPage: {
    width: BOOK_WIDTH,
    minHeight: PAGE_HEIGHT,
    position: 'relative',
  },
  pageSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: scale(4),
    backgroundColor: 'rgba(0,0,0,0.04)',
    zIndex: 1,
  },
  pageImage: {
    width: '100%',
    height: PAGE_HEIGHT - verticalScale(36),
    marginTop: verticalScale(4),
  },
  pageFallback: {
    width: '100%',
    height: PAGE_HEIGHT - verticalScale(36),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(4),
  },
  pageFallbackText: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(13),
    textAlign: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: '42%',
    zIndex: 3,
  },
  playOverlayLeft: {
    left: scale(20),
  },
  playOverlayRight: {
    right: scale(20),
  },
  playButton: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  writeBadge: {
    position: 'absolute',
    right: scale(12),
    top: verticalScale(12),
    borderRadius: moderateScale(999),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    backgroundColor: '#F59E0B',
    zIndex: 3,
  },
  writeBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
  },
  expandHint: {
    position: 'absolute',
    top: verticalScale(10),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: moderateScale(999),
    zIndex: 4,
  },
  expandHintText: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: '#fff',
  },
  pageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: verticalScale(10),
  },
  pageNumberDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
  },
  pageFooterText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },

  /* ── Navigation Controls ── */
  bookControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: BOOK_MARGIN,
    marginTop: verticalScale(14),
    paddingHorizontal: scale(4),
  },
  navButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageInfo: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: scale(8),
  },
  pageInfoTitle: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    marginBottom: verticalScale(2),
  },
  pageInfoCount: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  readFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    marginHorizontal: BOOK_MARGIN,
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(14),
  },
  readFullBtnText: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#fff',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(4),
    marginTop: verticalScale(12),
    paddingHorizontal: scale(20),
    flexWrap: 'wrap',
  },
  dot: {
    height: scale(6),
    borderRadius: scale(3),
  },

  /* ── Document Viewer ── */
  documentViewer: {
    marginHorizontal: BOOK_MARGIN,
    height: PAGE_HEIGHT,
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: verticalScale(6)},
    shadowOpacity: 0.12,
    shadowRadius: moderateScale(16),
    elevation: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  viewerLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(8),
  },
  viewerLoadingText: {
    fontSize: moderateScale(12),
  },

  /* ── Empty State ── */
  emptyState: {
    marginHorizontal: scale(20),
    marginTop: verticalScale(12),
    paddingVertical: verticalScale(40),
    paddingHorizontal: scale(20),
    borderRadius: moderateScale(22),
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: scale(60),
    height: scale(60),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(14),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    marginBottom: verticalScale(6),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    textAlign: 'center',
  },

  /* ── Worksheets ── */
  worksheetsSection: {
    paddingTop: verticalScale(20),
  },
  worksheetsTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(10),
  },
  worksheetsRow: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  worksheetCard: {
    width: scale(148),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    padding: moderateScale(14),
  },
  worksheetIconWrap: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: verticalScale(12),
  },
  worksheetLabel: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    marginBottom: verticalScale(4),
  },
  worksheetMeta: {
    fontSize: moderateScale(11),
    fontWeight: '600',
  },
});
