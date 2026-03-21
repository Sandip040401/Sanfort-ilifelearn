// WebVR immersive viewer – production-grade video + audio playback
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Video, {
  type VideoRef,
  type OnLoadData,
  type OnBufferData,
  type OnProgressData,
} from 'react-native-video';
import Orientation from 'react-native-orientation-locker';
import {moderateScale} from 'react-native-size-matters';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  AlertCircle,
  Glasses,
  Globe,
  MoreHorizontal,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';

// ── Constants ──────────────────────────────────────────────────────────
const LANGUAGE_ORDER: string[] = [
  'english (india)', 'english (us)', 'english (uk)',
  'hindi', 'marathi', 'malayalam', 'punjabi',
  'gujarati', 'telugu', 'kannada', 'tamil', 'odia', 'bengali',
];
const DIFFICULTY_ORDER: string[] = ['basic', 'intermediate', 'advance', 'advanced'];
const SPRING_CONFIG = {damping: 14, stiffness: 120} as const;
const TIMING_CONFIG = {duration: 200} as const;
const FALLBACK_LANGUAGE = 'default';
const FALLBACK_DIFFICULTY = 'basic';
const norm = (s: string) => (s || '').trim().toLowerCase();
const ucFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Types ──────────────────────────────────────────────────────────────
export interface WebVRAsset {
  _id?: string;
  title: string;
  description?: string;
  icon?: string;
  isImmersive?: boolean;
  webvr?: Array<{
    type: 'video' | 'audio';
    url: string;
    language?: string;
    keyword?: string;
    difficulty?: string | number;
    level?: string | number;
  }>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  assetTitle: string;
  folderName: string;
  assetData: WebVRAsset | null;
}

type WebVRMediaItem = NonNullable<WebVRAsset['webvr']>[number];

const getLanguageKey = (item: Pick<WebVRMediaItem, 'language' | 'keyword'>) =>
  norm(String(item.language ?? item.keyword ?? '')) || FALLBACK_LANGUAGE;

const getDifficultyKey = (
  item: Pick<WebVRMediaItem, 'difficulty' | 'level'>,
) => {
  const raw = norm(String(item.difficulty ?? item.level ?? ''));
  if (!raw) return FALLBACK_DIFFICULTY;
  switch (raw) {
    case 'beginner':
    case 'easy':
      return 'basic';
    case 'medium':
      return 'intermediate';
    case 'hard':
      return 'advanced';
    default:
      return raw;
  }
};

const getLanguageLabel = (
  item: Pick<WebVRMediaItem, 'language' | 'keyword'>,
  key: string,
) => item.language || item.keyword || (key === FALLBACK_LANGUAGE ? 'Default' : ucFirst(key));

// ── Chip ───────────────────────────────────────────────────────────────
const ChipButton = React.memo(function ChipButton({
  label, active, onPress,
}: {
  label: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ── Main ───────────────────────────────────────────────────────────────
function WebVRViewerModal({visible, onClose, assetTitle, folderName, assetData}: Props) {
  const insets = useSafeAreaInsets();
  const items = useMemo(() => assetData?.webvr ?? [], [assetData?.webvr]);

  const videoFile = useMemo(
    () => items.find(m => norm(String(m.type ?? '')) === 'video' && !!m.url),
    [items],
  );
  const audioFiles = useMemo(
    () => items.filter(m => norm(String(m.type ?? '')) === 'audio' && !!m.url),
    [items],
  );
  const hasAudio = audioFiles.length > 0;
  const videoUrl = videoFile?.url || '';
  const isImmersive = assetData?.isImmersive === true;
  const assetSessionKey = assetData?._id || `${assetTitle}:${folderName}:${videoUrl}`;

  // ── State ──
  const [mode, setMode] = useState<'audio' | 'video'>(hasAudio ? 'audio' : 'video');
  const [isMuted, setIsMuted] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedLanguage, setSelectedLang] = useState('');
  const [selectedDifficulty, setSelectedDiff] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [playbackSession, setPlaybackSession] = useState(0);
  const [appInBackground, setAppInBackground] = useState(false);

  // ── Refs ──
  const videoRef = useRef<VideoRef>(null);
  const audioRef = useRef<VideoRef>(null);
  const resumeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const videoPositionRef = useRef(0);

  // ── Reanimated ──
  const drawerProgress = useSharedValue(0);
  const headerProgress = useSharedValue(0);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{translateY: (1 - drawerProgress.value) * 220}],
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerProgress.value,
  }));

  // ── Audio data maps ──
  const byLanguage = useMemo(() => {
    const acc: Record<string, Record<string, WebVRMediaItem>> = {};
    for (const a of audioFiles) {
      const lang = getLanguageKey(a);
      const diff = getDifficultyKey(a);
      (acc[lang] ??= {})[diff] = a;
    }
    return acc;
  }, [audioFiles]);

  const languageLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of audioFiles) {
      const key = getLanguageKey(a);
      if (!m[key]) m[key] = getLanguageLabel(a, key);
    }
    return m;
  }, [audioFiles]);

  const languages = useMemo(() => {
    const keys = Object.keys(byLanguage);
    const order = new Map<string, number>(LANGUAGE_ORDER.map((l, i) => [l, i]));
    return keys.sort((a, b) => {
      const ai = order.get(a) ?? 999;
      const bi = order.get(b) ?? 999;
      return ai === bi ? a.localeCompare(b) : ai - bi;
    });
  }, [byLanguage]);

  const difficultiesForLang = useMemo(() => {
    if (!selectedLanguage) return [];
    const diffs = Object.keys(byLanguage[selectedLanguage] || {});
    const order = new Map<string, number>(DIFFICULTY_ORDER.map((d, i) => [d, i]));
    return diffs.sort((a, b) => {
      const ai = order.get(a) ?? 999;
      const bi = order.get(b) ?? 999;
      return ai === bi ? a.localeCompare(b) : ai - bi;
    });
  }, [byLanguage, selectedLanguage]);

  const selectedAudioObj = useMemo(
    () => (selectedLanguage && selectedDifficulty
      ? byLanguage[selectedLanguage]?.[selectedDifficulty] || null
      : null),
    [byLanguage, selectedLanguage, selectedDifficulty],
  );

  // ── Auto-select defaults ──
  useEffect(() => {
    if (!languages.length) return;
    setSelectedLang(prev => {
      if (prev && languages.includes(prev)) return prev;
      return languages.includes('english (india)') ? 'english (india)' : languages[0];
    });
  }, [languages]);

  useEffect(() => {
    if (!selectedLanguage) return;
    const diffs = Object.keys(byLanguage[selectedLanguage] || {});
    setSelectedDiff(prev => {
      if (prev && diffs.includes(prev)) return prev;
      return diffs.includes('basic') ? 'basic' : diffs[0] || '';
    });
  }, [selectedLanguage, byLanguage]);

  // ── Force resume (Android Modal + orientation change can pause players) ──
  const forceResumePlayers = useCallback(() => {
    try { videoRef.current?.resume(); } catch { /* ok */ }
    try { audioRef.current?.resume(); } catch { /* ok */ }
  }, []);

  const scheduleResume = useCallback((...delays: number[]) => {
    for (const d of delays) {
      resumeTimers.current.push(setTimeout(forceResumePlayers, d));
    }
  }, [forceResumePlayers]);

  const clearResumeTimers = useCallback(() => {
    for (const t of resumeTimers.current) clearTimeout(t);
    resumeTimers.current = [];
  }, []);

  const pausePlayers = useCallback(() => {
    try { videoRef.current?.pause(); } catch { /* ok */ }
    try { audioRef.current?.pause(); } catch { /* ok */ }
  }, []);

  const syncAudioToVideo = useCallback(() => {
    const position = Math.max(videoPositionRef.current, 0);
    try { audioRef.current?.seek(position); } catch { /* ok */ }
  }, []);

  // ── Lifecycle ──
  useEffect(() => {
    if (visible) {
      Orientation.lockToLandscape();
      setMode(hasAudio ? 'audio' : 'video');
      setIsMuted(false);
      setVideoLoaded(false);
      setBuffering(false);
      setVideoError(false);
      setAudioReady(false);
      setAudioError(false);
      setMenuOpen(false);
      setHeaderVisible(false);
      setPlaybackSession(prev => prev + 1);
      drawerProgress.value = 0;
      headerProgress.value = 0;
      // Android: force resume after orientation settles
      scheduleResume(200, 600, 1200, 2000);
    } else {
      clearResumeTimers();
      pausePlayers();
      Orientation.lockToPortrait();
    }
  }, [
    visible,
    assetSessionKey,
    hasAudio,
    drawerProgress,
    headerProgress,
    scheduleResume,
    clearResumeTimers,
    pausePlayers,
  ]);

  // AppState: pause in background, resume in foreground
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setAppInBackground(false);
        scheduleResume(100, 500);
      } else {
        setAppInBackground(true);
      }
    });
    return () => sub.remove();
  }, [visible, scheduleResume]);

  // Hardware back
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cleanup
  useEffect(() => () => clearResumeTimers(), [clearResumeTimers]);

  // ── Video callbacks ──
  const onVideoLoad = useCallback((_data: OnLoadData) => {
    setVideoError(false);
    setVideoLoaded(true);
    scheduleResume(50, 300);
  }, [scheduleResume]);

  const onVideoBuffer = useCallback(({isBuffering}: OnBufferData) => {
    setBuffering(isBuffering);
  }, []);

  const onVideoProgress = useCallback(({currentTime}: OnProgressData) => {
    videoPositionRef.current = currentTime;
  }, []);

  const onVideoErrorCb = useCallback((e: any) => {
    console.warn('WebVR video error:', e?.error || e);
    setBuffering(false);
    setVideoLoaded(false);
    setVideoError(true);
  }, []);

  // ── Audio callbacks ──
  const onAudioLoad = useCallback(() => {
    setAudioError(false);
    setAudioReady(true);
    syncAudioToVideo();
    scheduleResume(50, 200);
  }, [scheduleResume, syncAudioToVideo]);

  const onAudioErrorCb = useCallback((e: any) => {
    console.warn('WebVR audio error:', e?.error || e);
    setAudioReady(false);
    setAudioError(true);
  }, []);

  // ── UI callbacks ──
  const closeMenuAnim = useCallback(() => {
    'worklet';
    drawerProgress.value = withTiming(0, TIMING_CONFIG, fin => {
      if (fin) runOnJS(setMenuOpen)(false);
    });
  }, [drawerProgress]);

  const handleClose = useCallback(() => {
    clearResumeTimers();
    pausePlayers();
    closeMenuAnim();
    onClose();
  }, [onClose, closeMenuAnim, clearResumeTimers, pausePlayers]);

  const toggleHeader = useCallback(() => {
    if (headerVisible) {
      setHeaderVisible(false);
      closeMenuAnim();
    } else {
      setHeaderVisible(true);
    }
  }, [headerVisible, closeMenuAnim]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    drawerProgress.value = withSpring(1, SPRING_CONFIG);
  }, [drawerProgress]);

  const closeMenu = useCallback(() => closeMenuAnim(), [closeMenuAnim]);

  const handleModeChange = useCallback((newMode: 'audio' | 'video') => {
    if (newMode === mode) return;
    if (newMode === 'video') {
      videoRef.current?.seek(0);
      audioRef.current?.seek(0);
    } else {
      syncAudioToVideo();
    }
    setMode(newMode);
    scheduleResume(100, 400);
  }, [mode, scheduleResume, syncAudioToVideo]);

  const handleLangChange = useCallback((lang: string) => {
    if (lang === selectedLanguage) return;
    setAudioReady(false);
    setAudioError(false);
    setSelectedLang(lang);
  }, [selectedLanguage]);

  const handleDiffChange = useCallback((diff: string) => {
    if (diff === selectedDifficulty) return;
    setAudioReady(false);
    setAudioError(false);
    setSelectedDiff(diff);
  }, [selectedDifficulty]);

  const handleRestart = useCallback(() => {
    videoRef.current?.seek(0);
    audioRef.current?.seek(0);
    scheduleResume(100);
  }, [scheduleResume]);

  const toggleMute = useCallback(() => setIsMuted(m => !m), []);

  const handleRetry = useCallback(() => {
    setVideoError(false);
    setVideoLoaded(false);
    setBuffering(false);
    setAudioReady(false);
    setAudioError(false);
    setPlaybackSession(prev => prev + 1);
    scheduleResume(150, 500, 1000);
  }, [scheduleResume]);

  // ── Memoized sources ──
  const videoSource = useMemo(
    () => (
      videoUrl
        ? {
            uri: videoUrl,
            shouldCache: true,
            minLoadRetryCount: 3,
            bufferConfig: {
              minBufferMs: 1500,
              maxBufferMs: 10000,
              bufferForPlaybackMs: 500,
              bufferForPlaybackAfterRebufferMs: 1000,
              cacheSizeMB: 160,
            },
          }
        : undefined
    ),
    [videoUrl],
  );

  const audioSource = useMemo(
    () => (
      selectedAudioObj?.url
        ? {
            uri: selectedAudioObj.url,
            shouldCache: true,
            minLoadRetryCount: 3,
          }
        : undefined
    ),
    [selectedAudioObj?.url],
  );

  const audioModeActive = hasAudio && mode === 'audio';
  const showAudioPlayer = visible && !!audioSource;
  const audioShouldPause = !visible || !audioModeActive;
  const videoShouldBeMuted = (audioModeActive && !!audioSource) || isMuted;
  const sideInset = Math.max(insets.left, insets.right, 12);

  const showStartupScrim = !videoLoaded && !videoError && !!videoUrl;
  const showBufferSpinner = videoLoaded && buffering && !videoError && !!videoUrl;
  const showAudioErrorBadge = audioModeActive && audioError && !videoError;

  useEffect(() => {
    if (!visible || !audioModeActive || !audioReady) return;
    syncAudioToVideo();
  }, [visible, audioModeActive, audioReady, syncAudioToVideo, selectedAudioObj?.url]);

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}>
      <StatusBar translucent backgroundColor="transparent" hidden />
      <View style={styles.root}>

        {/* ── VIDEO (always visible, no blocking overlay) ── */}
        {videoSource ? (
          <Video
            key={`webvr-video-${assetSessionKey}-${playbackSession}`}
            ref={videoRef}
            source={videoSource}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            repeat
            paused={appInBackground}
            muted={videoShouldBeMuted}
            disableFocus={audioModeActive}
            audioOutput="speaker"
            ignoreSilentSwitch="ignore"
            onLoad={onVideoLoad}
            onReadyForDisplay={() => setVideoLoaded(true)}
            onBuffer={onVideoBuffer}
            onProgress={onVideoProgress}
            progressUpdateInterval={250}
            onError={onVideoErrorCb}
          />
        ) : (
          <View style={styles.noVideo}>
            <Globe size={moderateScale(48)} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            <Text style={styles.noVideoText}>No video content available</Text>
          </View>
        )}

        {/* ── AUDIO PLAYER (off-screen, full-size for Android compat) ── */}
        {showAudioPlayer && (
          <Video
            key={`webvr-audio-${selectedAudioObj?.url ?? 'none'}-${playbackSession}`}
            ref={audioRef}
            source={audioSource!}
            style={styles.offScreenAudio}
            repeat
            paused={audioShouldPause || appInBackground}
            muted={isMuted}
            volume={isMuted ? 0 : 1.0}
            audioOutput="speaker"
            ignoreSilentSwitch="ignore"
            onLoad={onAudioLoad}
            onError={onAudioErrorCb}
          />
        )}

        {showStartupScrim && (
          <View style={styles.startupScrim}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* ── Non-blocking buffer spinner (small, bottom-right) ── */}
        {showBufferSpinner && (
          <View style={styles.bufferBadge}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {/* ── Audio status indicator ── */}
        {showAudioErrorBadge && (
          <View style={styles.audioBadge}>
            <TouchableOpacity onPress={handleRetry} style={styles.audioRetryBtn}>
              <Text style={styles.audioRetryBtnText}>Retry audio</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── TAP ZONE — toggles header on tap, sits above Video SurfaceView ── */}
        <Pressable
          onPress={toggleHeader}
          style={styles.tapZone}
        />

        {/* ── HEADER ── */}
        {headerVisible && <View style={[styles.header, {paddingHorizontal: sideInset, paddingTop: insets.top + 8}]}>
          <TouchableOpacity onPress={handleClose} style={styles.iconBtn} activeOpacity={0.7}>
            <X size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.titleText} numberOfLines={1}>{assetTitle}</Text>
            <Text style={styles.subtitleText} numberOfLines={1}>{folderName}</Text>
          </View>
          <TouchableOpacity onPress={toggleMute} style={styles.iconBtn} activeOpacity={0.7}>
            {isMuted
              ? <VolumeX size={18} color="#fff" strokeWidth={2} />
              : <Volume2 size={18} color="#fff" strokeWidth={2} />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={menuOpen ? closeMenu : openMenu}
            style={[styles.iconBtn, menuOpen && styles.iconBtnActive]}
            activeOpacity={0.7}>
            <MoreHorizontal size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>}

        {/* ── BOTTOM DRAWER ── */}
        {menuOpen && (
          <>
            <Pressable style={styles.drawerBackdrop} onPress={closeMenu} />
            <Animated.View
              style={[styles.drawer, {paddingHorizontal: sideInset}, drawerStyle]}>
              <View style={styles.drawerHandle} />

              <View style={styles.drawerRow}>
                <Text style={styles.drawerLabel}>Controls</Text>
                <View style={styles.drawerRowBtns}>
                  <TouchableOpacity onPress={handleClose} style={styles.actionBtn}>
                    <X size={14} color="#fff" strokeWidth={2} />
                    <Text style={styles.actionBtnText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRestart} style={styles.actionBtn}>
                    <RotateCcw size={14} color="#fff" strokeWidth={2} />
                    <Text style={styles.actionBtnText}>Restart</Text>
                  </TouchableOpacity>
                  {isImmersive && (
                    <TouchableOpacity
                      onPress={() => handleModeChange(mode === 'video' ? 'audio' : 'video')}
                      style={[styles.actionBtn, mode === 'video' && styles.actionBtnImm]}>
                      <Glasses size={14} color={mode === 'video' ? '#E8A2AF' : '#fff'} strokeWidth={2} />
                      <Text style={[styles.actionBtnText, mode === 'video' && styles.immText]}>
                        {mode === 'video' ? 'Immersive ON' : 'Immersive'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {hasAudio && mode === 'audio' && (
                <>
                  <View style={styles.drawerRow}>
                    <Text style={styles.drawerLabel}>Language</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.chipRow}>
                        {languages.map(lang => (
                          <ChipButton
                            key={lang}
                            label={languageLabels[lang] || ucFirst(lang)}
                            active={selectedLanguage === lang}
                            onPress={() => handleLangChange(lang)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                  <View style={styles.drawerRow}>
                    <Text style={styles.drawerLabel}>Level</Text>
                    <View style={styles.chipRow}>
                      {difficultiesForLang.map(diff => (
                        <ChipButton
                          key={diff}
                          label={ucFirst(diff)}
                          active={selectedDifficulty === diff}
                          onPress={() => handleDiffChange(diff)}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}
            </Animated.View>
          </>
        )}

        {/* ── Error overlay (only for actual errors) ── */}
        {videoError && (
          <View style={styles.errorOverlay}>
            <AlertCircle size={moderateScale(40)} color="#EF4444" strokeWidth={2.5} />
            <Text style={styles.errorTitle}>Failed to Load</Text>
            <Text style={styles.errorDesc}>
              Unable to load the WebVR experience.{'\n'}Check your connection and try again.
            </Text>
            <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default React.memo(WebVRViewerModal);

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  // Audio player: positioned off-screen but with proper size so Android plays it
  offScreenAudio: {
    position: 'absolute',
    width: 50,
    height: 50,
    top: -100,
    left: -100,
    opacity: 0,
  },
  startupScrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: 'rgba(4, 8, 16, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  noVideoIcon: {fontSize: 48},
  noVideoText: {fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 12},

  // Non-blocking buffer spinner (bottom-right corner)
  bufferBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },

  // Audio loading badge (bottom-center)
  audioBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 5,
  },
  audioRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  audioRetryBtnText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },

  tapZone: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    ...(Platform.OS === 'android' ? {elevation: 5} : {}),
  },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBlock: {flex: 1, minWidth: 0},
  titleText: {fontSize: 13, fontWeight: '700', color: '#fff'},
  subtitleText: {fontSize: 10, color: 'rgba(255,255,255,0.6)'},
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnActive: {backgroundColor: 'rgba(255,255,255,0.25)'},

  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 19,
    ...(Platform.OS === 'android' ? {elevation: 14} : {}),
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    ...(Platform.OS === 'android' ? {elevation: 15} : {}),
    backgroundColor: 'rgba(15,20,30,0.96)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 4,
  },
  drawerRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  drawerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    width: 52,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drawerRowBtns: {flexDirection: 'row', gap: 8, flexWrap: 'wrap'},
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionBtnImm: {
    backgroundColor: 'rgba(232,162,175,0.15)',
    borderColor: '#E8A2AF',
  },
  actionBtnText: {fontSize: 12, fontWeight: '600', color: '#fff'},
  immText: {color: '#E8A2AF'},

  chipRow: {flexDirection: 'row', gap: 6},
  chip: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8},
  chipActive: {backgroundColor: '#4ECDC4'},
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipText: {fontSize: 11, fontWeight: '600', color: '#fff'},
  chipTextActive: {color: '#000'},

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: '900',
    color: '#EF4444',
    width: 64,
    height: 64,
    textAlign: 'center',
    lineHeight: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#EF4444',
    overflow: 'hidden',
  },
  errorTitle: {marginTop: 16, color: '#fff', fontSize: 16, fontWeight: '600'},
  errorDesc: {
    marginTop: 6, color: 'rgba(255,255,255,0.5)', fontSize: 12,
    textAlign: 'center', paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  retryBtnText: {color: '#000', fontWeight: '700'},
});
