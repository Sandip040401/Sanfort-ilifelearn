import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {SafeAreaView} from 'react-native-safe-area-context';
import Video from 'react-native-video';
import {WebView} from 'react-native-webview';
import {FileText, X} from 'lucide-react-native';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {getYouTubeEmbedUrl} from '@/utils/video';

export type MediaViewerPayload = {
  type: 'image' | 'video' | 'document';
  url: string;
  title?: string;
};

function getDocumentViewerUrl(url: string): string {
  if (/\.pdf(\?|$)/i.test(url)) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }

  return url;
}

function getYouTubeEmbedHtml(embedUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #000;
        overflow: hidden;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
      }
    </style>
  </head>
  <body>
    <iframe
      src="${embedUrl}"
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </body>
</html>`;
}

const PinchZoomImage = ({url}: {url: string}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const displayWidth = useSharedValue(0);
  const displayHeight = useSharedValue(0);

  const {width: screenWidth, height: screenHeight} = useWindowDimensions();

  const handleImageLayout = () => {
    Image.getSize(url, (w, h) => {
      const imgAspectRatio = w / h;
      const screenAspectRatio = screenWidth / screenHeight;

      if (imgAspectRatio > screenAspectRatio) {
        displayWidth.value = screenWidth;
        displayHeight.value = screenWidth / imgAspectRatio;
      } else {
        displayHeight.value = screenHeight;
        displayWidth.value = screenHeight * imgAspectRatio;
      }
    });
  };

  const MAX_ZOOM = 5;

  const pinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      const targetScale = savedScale.value * e.scale;
      // Clamp scale to [0.8, MAX_ZOOM] for feedback, will timing back on end
      scale.value = Math.min(Math.max(targetScale, 0.8), MAX_ZOOM);
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .onUpdate(e => {
      if (scale.value > 1) {
        // Use the actual displayed image dimensions for clamping
        const maxTranslateX = (displayWidth.value * (scale.value - 1)) / 2;
        const maxTranslateY = (displayHeight.value * (scale.value - 1)) / 2;

        const nextX = savedTranslateX.value + e.translationX;
        const nextY = savedTranslateY.value + e.translationY;

        translateX.value = Math.min(Math.max(nextX, -maxTranslateX), maxTranslateX);
        translateY.value = Math.min(Math.max(nextY, -maxTranslateY), maxTranslateY);
      }
    })
    .onEnd(() => {
      if (scale.value > 1) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {scale: scale.value},
      ],
    };
  });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  return (
    <View style={styles.imageContainer}>
      <GestureDetector gesture={composed}>
        <Animated.Image
          source={{uri: url}}
          onLoad={handleImageLayout}
          resizeMode="contain"
          style={[styles.image, animatedStyle]}
        />
      </GestureDetector>
    </View>
  );
};

export default function MediaViewer({
  media,
  onClose,
}: {
  media: MediaViewerPayload | null;
  onClose: () => void;
}) {
  if (!media) {
    return null;
  }

  const youTubeEmbedUrl =
    media.type === 'video' ? getYouTubeEmbedUrl(media.url) : null;
  const showsEmbeddedYouTube = Boolean(youTubeEmbedUrl);

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      visible={!!media}
      onRequestClose={onClose}>
      <GestureHandlerRootView style={{flex: 1}}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalRoot}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerLabel}>
              {media.type === 'image' ? 'Image Preview' : media.type === 'video' ? 'Video Lesson' : 'Document Viewer'}
            </Text>
            {!!media.title && (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {media.title}
              </Text>
            )}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={onClose} style={styles.closeButton}>
            <X size={moderateScale(20)} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {media.type === 'image' && (
            <PinchZoomImage url={media.url} />
          )}

          {media.type === 'video' && (
            <View style={styles.videoStage}>
              <View style={styles.videoFrame}>
                {showsEmbeddedYouTube && youTubeEmbedUrl ? (
                  <WebView
                    source={{html: getYouTubeEmbedHtml(youTubeEmbedUrl)}}
                    originWhitelist={['*']}
                    style={styles.webview}
                    allowsInlineMediaPlayback
                    allowsFullscreenVideo
                    mediaPlaybackRequiresUserAction={false}
                    startInLoadingState
                    renderLoading={() => (
                      <View style={styles.loadingState}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.loadingText}>Opening lesson…</Text>
                      </View>
                    )}
                  />
                ) : (
                  <Video
                    source={{uri: media.url}}
                    style={styles.video}
                    controls
                    resizeMode="contain"
                  />
                )}
              </View>

              <View style={styles.videoMetaCard}>
                <Text style={styles.videoMetaEyebrow}>
                  {showsEmbeddedYouTube ? 'YouTube-style player' : 'Lesson player'}
                </Text>
                {!!media.title && (
                  <Text style={styles.videoMetaTitle}>
                    {media.title}
                  </Text>
                )}
                <Text style={styles.videoMetaCopy}>
                  {showsEmbeddedYouTube
                    ? 'Embedded playback opens inside a full-width 16:9 viewer.'
                    : 'Playback uses the native controls with a stable full-width frame.'}
                </Text>
              </View>
            </View>
          )}

          {media.type === 'document' && (
            <View style={styles.documentWrap}>
              <WebView
                source={{uri: getDocumentViewerUrl(media.url)}}
                style={styles.webview}
                originWhitelist={['*']}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loadingState}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loadingText}>Opening document…</Text>
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {media.type === 'document' && (
          <View style={styles.footer}>
            <FileText size={moderateScale(16)} color="rgba(255,255,255,0.8)" strokeWidth={2} />
            <Text style={styles.footerText}>PDF and ebook links open in an embedded WebView.</Text>
          </View>
        )}
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.96)',
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  headerText: {
    flex: 1,
  },
  headerLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerTitle: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: scale(42),
    height: scale(42),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
  },
  imageContainer: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  videoStage: {
    flex: 1,
    gap: verticalScale(16),
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: moderateScale(18),
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
    backgroundColor: '#000',
  },
  videoMetaCard: {
    borderRadius: moderateScale(18),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  videoMetaEyebrow: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    color: 'rgba(255,255,255,0.68)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: verticalScale(6),
  },
  videoMetaTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
    color: '#fff',
    marginBottom: verticalScale(6),
  },
  videoMetaCopy: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    color: 'rgba(255,255,255,0.74)',
  },
  documentWrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: moderateScale(18),
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    gap: verticalScale(8),
  },
  loadingText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
  },
  footer: {
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(14),
    paddingTop: verticalScale(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  footerText: {
    flex: 1,
    fontSize: moderateScale(11),
    color: 'rgba(255,255,255,0.72)',
  },
});
