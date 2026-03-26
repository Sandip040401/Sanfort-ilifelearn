/* eslint-disable react-native/no-inline-styles */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {moderateScale, scale, verticalScale} from 'react-native-size-matters';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import Voice from '@react-native-voice/voice';
import {useTabBarHideOnScroll} from '@/navigation/useTabBarHideOnScroll';
import {TAB_BAR_HEIGHT} from '@/navigation/CustomTabBar';
import {
  BarChart3,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Gauge,
  Mic,
  MicOff,
  PencilLine,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Volume2,
  X,
} from 'lucide-react-native';
import {ScreenErrorBoundary, Skeleton} from '@/components/ui';
import {ReadAloudService} from '@/services/readAloud.service';
import {useAuth} from '@/store/auth-context';
import {useTheme} from '@/theme';
import {
  AGE_GROUPS,
  CURRICULUM_LENSES,
  READ_ALOUD_IMAGES,
  READ_ALOUD_SENTENCES,
  READ_ALOUD_STORIES,
  READ_ALOUD_WORDS,
  READING_MODES,
} from './readAloud.data';
import {
  type AnalysisResult,
  type DashboardData,
  type ReadAloudAttempt,
  type ReadAloudModeId,
  analyzeTranscript,
  buildDashboardFromAttempts,
  buildTranscriptComparison,
  formatAttemptDate,
  formatDuration,
  getAccuracyTone,
  getAttemptTargetText,
  getQuestionText,
  groupAttemptsByQuestion,
} from './readAloud.helpers';

const H_PAD = scale(20);
const HAS_NATIVE_VOICE = Boolean(NativeModules?.Voice || NativeModules?.RCTVoice);

type PracticeItem =
  | (typeof READ_ALOUD_IMAGES)[number]
  | (typeof READ_ALOUD_WORDS)[number]
  | (typeof READ_ALOUD_SENTENCES)[number]
  | (typeof READ_ALOUD_STORIES)[number];

type ActiveTab = 'practice' | 'analytics';

const MODE_LIBRARY: Record<ReadAloudModeId, PracticeItem[]> = {
  word: READ_ALOUD_IMAGES,
  words: READ_ALOUD_WORDS,
  sentence: READ_ALOUD_SENTENCES,
  story: READ_ALOUD_STORIES,
};

const MODE_GRADIENTS: Record<ReadAloudModeId, [string, string]> = {
  word: ['#FB7185', '#F97316'],
  words: ['#14B8A6', '#2DD4BF'],
  sentence: ['#38BDF8', '#3B82F6'],
  story: ['#8B5CF6', '#6366F1'],
};

const MODE_COPY: Record<ReadAloudModeId, {title: string; instruction: string}> = {
  word: {
    title: 'Image Mode',
    instruction: 'Look at the image and say the matching word clearly.',
  },
  words: {
    title: 'Word Mode',
    instruction: 'Read the word aloud with sharp and steady pronunciation.',
  },
  sentence: {
    title: 'Sentence Mode',
    instruction: 'Read the sentence with pace, pauses, and clear word endings.',
  },
  story: {
    title: 'Story Mode',
    instruction: 'Read the full story fluently and keep your rhythm natural.',
  },
};

const LOCALE_BY_CURRICULUM: Record<string, string> = {
  in: 'en-IN',
  uk: 'en-GB',
  us: 'en-US',
  ib: 'en-US',
};

function getModeItems(mode: ReadAloudModeId, ageGroup: string) {
  return MODE_LIBRARY[mode].filter(item => item.ageGroup === ageGroup);
}

function pickNextIndex(total: number, currentIndex: number, shuffled: boolean) {
  if (total <= 1) {
    return 0;
  }
  if (!shuffled) {
    return (currentIndex + 1) % total;
  }

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * total);
  }
  return nextIndex;
}

function parseSpeechError(error: any) {
  const message =
    error?.error?.message ||
    error?.message ||
    error?.error ||
    'Speech recognition is unavailable right now.';
  return String(message);
}

function isImageItem(item: PracticeItem | null): item is (typeof READ_ALOUD_IMAGES)[number] {
  return !!item && 'imageUrl' in item;
}

function isStoryItem(item: PracticeItem | null): item is (typeof READ_ALOUD_STORIES)[number] {
  return !!item && 'sentences' in item;
}

function safeNumber(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ReadAloudSkeleton() {
  return (
    <View style={styles.skeletonRoot}>
      <LinearGradient
        colors={['#0F766E', '#0C8490', '#0891B2', '#177ACF', '#2563EB']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.skeletonHero}>
        <Skeleton width="36%" height={18} borderRadius={999} />
        <Skeleton width="58%" height={34} borderRadius={16} style={styles.skeletonGap} />
        <Skeleton width="78%" height={14} borderRadius={10} style={styles.skeletonGap} />
        <View style={styles.skeletonStatsRow}>
          <Skeleton width="31%" height={84} borderRadius={24} />
          <Skeleton width="31%" height={84} borderRadius={24} />
          <Skeleton width="31%" height={84} borderRadius={24} />
        </View>
      </LinearGradient>

      <View style={styles.skeletonBody}>
        <Skeleton width="100%" height={48} borderRadius={18} />
        <Skeleton width="100%" height={102} borderRadius={28} style={styles.skeletonGap} />
        <Skeleton width="100%" height={280} borderRadius={30} style={styles.skeletonGap} />
        <Skeleton width="100%" height={200} borderRadius={26} style={styles.skeletonGap} />
      </View>
    </View>
  );
}

function ReadAloudContent() {
  const {colors, isDark} = useTheme();
  const insets = useSafeAreaInsets();
  const {onScroll} = useTabBarHideOnScroll();
  const queryClient = useQueryClient();
  const {user} = useAuth();
  const studentId = user?.id || user?._id || '';
  const {width: screenWidth} = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const contentWidth = isTablet ? Math.min(screenWidth * 0.75, 620) : undefined;

  const [activeTab, setActiveTab] = useState<ActiveTab>('practice');
  const [selectedAge, setSelectedAge] = useState(AGE_GROUPS[1]?.value || AGE_GROUPS[0]?.value || '5-6');
  const [selectedCurriculum, setSelectedCurriculum] = useState(CURRICULUM_LENSES[0]?.id || 'in');
  const [selectedMode, setSelectedMode] = useState<ReadAloudModeId>('word');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [speechReady, setSpeechReady] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [readingTime, setReadingTime] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  const [analyticsFilter, setAnalyticsFilter] = useState<'all' | ReadAloudModeId>('all');
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [reviewAttempts, setReviewAttempts] = useState<ReadAloudAttempt[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);

  const transcriptRef = useRef('');
  const startedAtRef = useRef<number | null>(null);
  const finalizeLockRef = useRef(false);

  const attemptsQuery = useQuery<ReadAloudAttempt[]>({
    queryKey: ['read-aloud-attempts', studentId],
    queryFn: () => ReadAloudService.getAttempts(studentId),
    enabled: !!studentId,
  });

  const dashboardQuery = useQuery<Partial<DashboardData> | null>({
    queryKey: ['read-aloud-dashboard', studentId],
    queryFn: () => ReadAloudService.getDashboard(studentId),
    enabled: !!studentId,
  });

  const attempts = useMemo(() => attemptsQuery.data ?? [], [attemptsQuery.data]);

  const availabilityByMode = useMemo(
    () =>
      READING_MODES.reduce(
        (acc, mode) => {
          acc[mode.id as ReadAloudModeId] = getModeItems(mode.id as ReadAloudModeId, selectedAge).length;
          return acc;
        },
        {} as Record<ReadAloudModeId, number>,
      ),
    [selectedAge],
  );

  const practiceItems = useMemo(
    () => getModeItems(selectedMode, selectedAge),
    [selectedAge, selectedMode],
  );
  const currentItem = practiceItems[currentIndex] || null;

  const activeLens = useMemo(
    () => CURRICULUM_LENSES.find(lens => lens.id === selectedCurriculum) || CURRICULUM_LENSES[0],
    [selectedCurriculum],
  );

  const dashboardData = useMemo(
    () => buildDashboardFromAttempts(attempts, dashboardQuery.data),
    [attempts, dashboardQuery.data],
  );

  const filteredAttempts = useMemo(
    () =>
      analyticsFilter === 'all'
        ? attempts
        : attempts.filter(attempt => String(attempt.mode || '') === analyticsFilter),
    [analyticsFilter, attempts],
  );

  const groupedAttempts = useMemo(
    () =>
      Object.entries(groupAttemptsByQuestion(filteredAttempts))
        .map(([key, items]) => [
          key,
          [...items].sort(
            (left, right) =>
              new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime(),
          ),
        ] as const)
        .sort(
          (left, right) =>
            new Date(right[1][0]?.date || 0).getTime() -
            new Date(left[1][0]?.date || 0).getTime(),
        ),
    [filteredAttempts],
  );

  const recentAttempts = useMemo(
    () =>
      [...attempts]
        .sort(
          (left, right) =>
            new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime(),
        )
        .slice(0, 3),
    [attempts],
  );

  const reviewAttempt = reviewAttempts[reviewIndex] || null;
  const reviewComparison = useMemo(
    () =>
      reviewAttempt
        ? buildTranscriptComparison(
            getAttemptTargetText(reviewAttempt),
            String(reviewAttempt.transcript || ''),
          )
        : null,
    [reviewAttempt],
  );

  const resetPracticeState = useCallback(() => {
    setTranscript('');
    transcriptRef.current = '';
    setAnalysis(null);
    setReadingTime(0);
    setSpeechError(null);
    setVolumeLevel(0);
    setManualTranscript('');
    finalizeLockRef.current = false;
  }, []);

  useEffect(() => {
    if (availabilityByMode[selectedMode] > 0) {
      if (currentIndex >= practiceItems.length) {
        setCurrentIndex(0);
      }
      return;
    }

    const fallbackMode = READING_MODES.find(
      mode => availabilityByMode[mode.id as ReadAloudModeId] > 0,
    )?.id as ReadAloudModeId | undefined;

    if (fallbackMode) {
      setSelectedMode(fallbackMode);
    }
    setCurrentIndex(0);
  }, [availabilityByMode, currentIndex, practiceItems.length, selectedMode]);

  useEffect(() => {
    resetPracticeState();
  }, [currentIndex, resetPracticeState, selectedAge, selectedMode]);

  const finalizeAttempt = useCallback(
    async (rawTranscript: string, rawDuration: number) => {
      if (!currentItem || finalizeLockRef.current) {
        return;
      }

      const spokenText = rawTranscript.trim();
      if (!spokenText) {
        setSpeechError('No speech detected. Try once more or use type mode.');
        return;
      }

      finalizeLockRef.current = true;
      setIsSubmitting(true);

      const duration =
        rawDuration > 0
          ? rawDuration
          : Math.max(2, spokenText.split(/\s+/).filter(Boolean).length * 1.1);

      const {result, payload} = analyzeTranscript({
        mode: selectedMode,
        item: currentItem,
        transcript: spokenText,
        readingTime: duration,
      });

      setTranscript(spokenText);
      transcriptRef.current = spokenText;
      setReadingTime(duration);
      setAnalysis(result);

      try {
        if (studentId) {
          await ReadAloudService.submitAttempt(studentId, {
            ...payload,
            ageGroup: selectedAge,
            curriculumLens: selectedCurriculum,
            date: new Date().toISOString(),
          });

          await Promise.all([
            queryClient.invalidateQueries({queryKey: ['read-aloud-attempts', studentId]}),
            queryClient.invalidateQueries({queryKey: ['read-aloud-dashboard', studentId]}),
          ]);
        }
      } catch {
        Alert.alert(
          'Sync issue',
          'The analysis is ready, but backend sync failed. Refresh and try again.',
        );
      } finally {
        setIsSubmitting(false);
        finalizeLockRef.current = false;
      }
    },
    [currentItem, queryClient, selectedAge, selectedCurriculum, selectedMode, studentId],
  );

  useEffect(() => {
    if (!HAS_NATIVE_VOICE) {
      setSpeechReady(false);
      setSpeechError('The speech engine is not linked yet. You can continue with type mode.');
      return undefined;
    }

    Voice.onSpeechStart = () => {
      startedAtRef.current = Date.now();
      finalizeLockRef.current = false;
      setIsRecording(true);
      setSpeechError(null);
      setAnalysis(null);
      setTranscript('');
      transcriptRef.current = '';
      setReadingTime(0);
      setVolumeLevel(0.08);
    };

    const handleSpeechResults = (event: any) => {
      const nextTranscript = String(event?.value?.[0] || '').trim();
      if (!nextTranscript) {
        return;
      }
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
    };

    Voice.onSpeechResults = handleSpeechResults;
    Voice.onSpeechPartialResults = handleSpeechResults;

    Voice.onSpeechVolumeChanged = (event: any) => {
      const raw = safeNumber(event?.value);
      const normalized = Math.max(0, Math.min(1, (raw + 2) / 12));
      setVolumeLevel(normalized);
    };

    Voice.onSpeechError = (event: any) => {
      setIsRecording(false);
      setVolumeLevel(0);

      const duration = startedAtRef.current
        ? (Date.now() - startedAtRef.current) / 1000
        : readingTime;
      startedAtRef.current = null;

      if (transcriptRef.current.trim()) {
        finalizeAttempt(transcriptRef.current, duration).catch(() => undefined);
        return;
      }

      setSpeechError(parseSpeechError(event));
    };

    Voice.onSpeechEnd = () => {
      setIsRecording(false);
      setVolumeLevel(0);

      const duration = startedAtRef.current
        ? (Date.now() - startedAtRef.current) / 1000
        : readingTime;
      startedAtRef.current = null;

      finalizeAttempt(transcriptRef.current, duration).catch(() => undefined);
    };

    let disposed = false;

    (async () => {
      try {
        const available = await Voice.isAvailable();
        let resolvedReady = Boolean(available);

        if (!resolvedReady && Platform.OS === 'android') {
          try {
            const services = await Voice.getSpeechRecognitionServices();
            resolvedReady = Array.isArray(services) && services.length > 0;
          } catch {
            resolvedReady = false;
          }
        }

        if (!disposed) {
          setSpeechReady(resolvedReady);
        }
      } catch {
        if (!disposed) {
          setSpeechReady(false);
        }
      }
    })();

    return () => {
      disposed = true;
      if (!HAS_NATIVE_VOICE) {
        return;
      }
      Voice.destroy().catch(() => undefined);
      Voice.removeAllListeners();
    };
  }, [finalizeAttempt, readingTime]);

  const refreshAll = useCallback(async () => {
    await Promise.all([attemptsQuery.refetch(), dashboardQuery.refetch()]);
  }, [attemptsQuery, dashboardQuery]);

  const handleModeChange = useCallback(
    (mode: ReadAloudModeId) => {
      if (mode === selectedMode) {
        return;
      }

      if (!getModeItems(mode, selectedAge).length) {
        const fallbackAge = AGE_GROUPS.find(age => getModeItems(mode, age.value).length);
        if (fallbackAge) {
          setSelectedAge(fallbackAge.value);
        }
      }

      setSelectedMode(mode);
      setCurrentIndex(0);
    },
    [selectedAge, selectedMode],
  );

  const handleNextPrompt = useCallback(() => {
    if (!practiceItems.length) {
      return;
    }
    setCurrentIndex(prev => pickNextIndex(practiceItems.length, prev, shuffleEnabled));
  }, [practiceItems.length, shuffleEnabled]);

  const ensureMicPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message: 'Read Aloud needs microphone access for live speech practice.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (!currentItem) {
      return;
    }

    if (!HAS_NATIVE_VOICE) {
      setSpeechReady(false);
      setSpeechError('The speech engine is currently unavailable. Type mode is opening.');
      setManualEntryVisible(true);
      return;
    }

    if (isRecording) {
      return;
    }

    const granted = await ensureMicPermission();
    if (!granted) {
      Alert.alert(
        'Microphone required',
        'Please allow microphone permission to use voice practice.',
      );
      return;
    }

    resetPracticeState();

    try {
      await Voice.cancel().catch(() => undefined);
      await Voice.start(LOCALE_BY_CURRICULUM[selectedCurriculum] || 'en-US');
      setSpeechReady(true);
    } catch (error) {
      setSpeechError(parseSpeechError(error));
      setManualEntryVisible(true);
    }
  }, [
    currentItem,
    ensureMicPermission,
    isRecording,
    resetPracticeState,
    selectedCurriculum,
  ]);

  const handleStopRecording = useCallback(async () => {
    if (!HAS_NATIVE_VOICE) {
      setIsRecording(false);
      setVolumeLevel(0);
      return;
    }

    try {
      await Voice.stop();
    } catch {
      setIsRecording(false);
      setVolumeLevel(0);
      await finalizeAttempt(transcriptRef.current, readingTime);
    }
  }, [finalizeAttempt, readingTime]);

  const handleManualAnalyze = useCallback(async () => {
    const nextTranscript = manualTranscript.trim();
    if (!nextTranscript) {
      return;
    }

    setManualEntryVisible(false);
    await finalizeAttempt(
      nextTranscript,
      Math.max(2, nextTranscript.split(/\s+/).filter(Boolean).length * 1.1),
    );
  }, [finalizeAttempt, manualTranscript]);

  const performanceEntries = useMemo(
    () =>
      Object.entries(dashboardData.performanceByMode || {}).sort(
        (left, right) => right[1].sessions - left[1].sessions,
      ),
    [dashboardData.performanceByMode],
  );

  const renderPromptBody = () => {
    if (!currentItem) {
      return (
        <View style={[styles.emptyPromptCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.emptyPromptTitle, {color: colors.text}]}>
            No practice deck available
          </Text>
          <Text style={[styles.emptyPromptText, {color: colors.textSecondary}]}>
            No content is available for this age group in the selected mode. Switch the age group or mode.
          </Text>
        </View>
      );
    }

    if (isImageItem(currentItem)) {
      return (
        <View style={styles.promptVisualWrap}>
          <FastImage source={{uri: currentItem.imageUrl}} style={styles.promptImage} resizeMode={FastImage.resizeMode.cover} />
          <View style={styles.promptFooterRow}>
            {(currentItem.badges || []).slice(0, 3).map(badge => (
              <View key={badge} style={styles.promptBadge}>
                <Text style={styles.promptBadgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (isStoryItem(currentItem)) {
      return (
        <View style={styles.storyCard}>
          <Text style={styles.storyTitle}>{currentItem.title}</Text>
          {(currentItem.sentences || []).map(sentence => (
            <Text key={sentence} style={styles.storySentence}>
              {sentence}
            </Text>
          ))}
          {currentItem.teacherPrompt ? (
            <View style={styles.teacherPromptPill}>
              <Text style={styles.teacherPromptText}>Prompt: {currentItem.teacherPrompt}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.textPromptWrap}>
        <Text style={styles.textPromptValue}>{getQuestionText(currentItem, selectedMode)}</Text>
        <View style={styles.promptFooterRow}>
          {(currentItem.badges || []).slice(0, 3).map(badge => (
            <View key={badge} style={styles.promptBadge}>
              <Text style={styles.promptBadgeText}>{badge}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, {backgroundColor: colors.background}]}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={attemptsQuery.isRefetching || dashboardQuery.isRefetching}
            onRefresh={refreshAll}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: TAB_BAR_HEIGHT + insets.bottom + verticalScale(24)}}>
        <LinearGradient
          colors={isDark ? ['#0F172A', '#0F474C', '#0F766E', '#1A6DAD', '#2563EB'] : ['#115E59', '#0D7886', '#0891B2', '#177ACF', '#2563EB']}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={[styles.hero, {paddingTop: insets.top + verticalScale(18)}]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <Sparkles size={15} color="#FFF" strokeWidth={2.4} />
              <Text style={styles.heroPillText}>ReadLab AI</Text>
            </View>
            <TouchableOpacity style={styles.heroPill} activeOpacity={0.84} onPress={refreshAll}>
              {attemptsQuery.isRefetching || dashboardQuery.isRefetching ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <RefreshCcw size={15} color="#FFF" strokeWidth={2.2} />
              )}
              <Text style={styles.heroPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>Read, speak, and score with instant feedback</Text>
          <Text style={styles.heroSubtitle}>
            The full practice workflow from the previous app is now live here with a new studio-style interface.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{dashboardData.totalSessions}</Text>
              <Text style={styles.heroStatLabel}>Sessions</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{Math.round(dashboardData.overallAccuracy)}%</Text>
              <Text style={styles.heroStatLabel}>Accuracy</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{Math.round(dashboardData.avgWPM)}</Text>
              <Text style={styles.heroStatLabel}>Avg WPM</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.body, contentWidth ? {width: contentWidth, alignSelf: 'center', paddingHorizontal: 0} : undefined]}>
          <View style={[styles.tabShell, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            {(['practice', 'analytics'] as ActiveTab[]).map(tab => {
              const active = tab === activeTab;
              return (
                <TouchableOpacity
                  key={tab}
                  activeOpacity={0.84}
                  onPress={() => setActiveTab(tab)}
                  style={styles.tabButton}>
                  {active ? (
                    <LinearGradient
                      colors={tab === 'practice' ? ['#0EA5E9', '#2563EB'] : ['#F97316', '#FB7185']}
                      locations={[0, 1]}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}
                      style={styles.tabButtonActive}>
                      {tab === 'practice' ? (
                        <Mic size={16} color="#FFF" strokeWidth={2.2} />
                      ) : (
                        <BarChart3 size={16} color="#FFF" strokeWidth={2.2} />
                      )}
                      <Text style={styles.tabTextActive}>
                        {tab === 'practice' ? 'Practice Studio' : 'Insights'}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.tabButtonIdle}>
                      {tab === 'practice' ? (
                        <Mic size={16} color={colors.textSecondary} strokeWidth={2.2} />
                      ) : (
                        <BarChart3 size={16} color={colors.textSecondary} strokeWidth={2.2} />
                      )}
                      <Text style={[styles.tabTextIdle, {color: colors.textSecondary}]}>
                        {tab === 'practice' ? 'Practice Studio' : 'Insights'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'practice' ? (
            <>
              <View style={[styles.sectionCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Age track</Text>
                    <Text style={[styles.sectionTitle, {color: colors.text}]}>Choose learner band</Text>
                  </View>
                  <View style={[styles.lensCard, {backgroundColor: colors.primarySurface}]}>
                    <Text style={styles.lensEmoji}>{activeLens?.icon || '🌐'}</Text>
                    <View>
                      <Text style={[styles.lensTitle, {color: colors.text}]}>{activeLens?.name}</Text>
                      <Text style={[styles.lensSubtitle, {color: colors.textSecondary}]}>
                        {activeLens?.description}
                      </Text>
                    </View>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {AGE_GROUPS.map(group => {
                    const active = group.value === selectedAge;
                    return (
                      <TouchableOpacity
                        key={group.value}
                        activeOpacity={0.84}
                        onPress={() => {
                          setSelectedAge(group.value);
                          setCurrentIndex(0);
                        }}
                        style={[
                          styles.filterChip,
                          active
                            ? styles.filterChipActive
                            : {backgroundColor: isDark ? '#102033' : '#ECF7FF', borderColor: 'transparent'},
                        ]}>
                        <Text
                          style={[
                            styles.filterChipText,
                            {color: active ? '#FFF' : colors.text},
                          ]}>
                          {group.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {CURRICULUM_LENSES.map(lens => {
                    const active = lens.id === selectedCurriculum;
                    return (
                      <TouchableOpacity
                        key={lens.id}
                        activeOpacity={0.84}
                        onPress={() => setSelectedCurriculum(lens.id)}
                        style={[
                          styles.curriculumChip,
                          {
                            backgroundColor: active
                              ? isDark
                                ? '#132A3A'
                                : '#E6FFFB'
                              : colors.background,
                            borderColor: active ? colors.secondary : colors.border,
                          },
                        ]}>
                        <Text style={styles.curriculumEmoji}>{lens.icon}</Text>
                        <Text style={[styles.curriculumText, {color: colors.text}]}>
                          {lens.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
                {READING_MODES.map(mode => {
                  const typedMode = mode.id as ReadAloudModeId;
                  const active = typedMode === selectedMode;
                  const count = availabilityByMode[typedMode];
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      activeOpacity={0.86}
                      onPress={() => handleModeChange(typedMode)}
                      style={[
                        styles.modeCard,
                        {opacity: count ? 1 : 0.55},
                      ]}>
                      <LinearGradient
                        colors={active ? MODE_GRADIENTS[typedMode] : isDark ? ['#1E293B', '#111827'] : ['#FFFFFF', '#EFF6FF']}
                        locations={[0, 1]}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={[
                          styles.modeCardGradient,
                          !active && {borderColor: colors.border, borderWidth: 1},
                        ]}>
                        <Text style={styles.modeEmoji}>{mode.icon}</Text>
                        <Text style={[styles.modeTitle, {color: active ? '#FFF' : colors.text}]}>
                          {mode.title}
                        </Text>
                        <Text
                          style={[
                            styles.modeMeta,
                            {color: active ? 'rgba(255,255,255,0.86)' : colors.textSecondary},
                          ]}>
                          {count} prompts
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.modeDescription,
                            {color: active ? 'rgba(255,255,255,0.72)' : colors.textSecondary},
                          ]}>
                          {mode.description}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <LinearGradient
                colors={MODE_GRADIENTS[selectedMode]}
                locations={[0, 1]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.practiceCard}>
                <View style={styles.practiceHeaderRow}>
                  <View>
                    <Text style={styles.practiceEyebrow}>{MODE_COPY[selectedMode].title}</Text>
                    <Text style={styles.practiceInstruction}>{MODE_COPY[selectedMode].instruction}</Text>
                  </View>
                  <View style={styles.practiceCounterCard}>
                    <Text style={styles.practiceCounterValue}>
                      {practiceItems.length ? currentIndex + 1 : 0}/{practiceItems.length}
                    </Text>
                    <Text style={styles.practiceCounterLabel}>Prompt</Text>
                  </View>
                </View>

                <View style={styles.promptShell}>{renderPromptBody()}</View>

                <View style={styles.toolRow}>
                  <TouchableOpacity
                    onPress={() => setShuffleEnabled(value => !value)}
                    activeOpacity={0.84}
                    style={[
                      styles.toolButton,
                      shuffleEnabled && styles.toolButtonActive,
                    ]}>
                    <Shuffle
                      size={17}
                      color={shuffleEnabled ? '#0F172A' : '#FFF'}
                      strokeWidth={2.1}
                    />
                    <Text
                      style={[
                        styles.toolButtonText,
                        {color: shuffleEnabled ? '#0F172A' : '#FFF'},
                      ]}>
                      Shuffle {shuffleEnabled ? 'on' : 'off'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setManualEntryVisible(true)}
                    activeOpacity={0.84}
                    style={styles.toolButton}>
                    <PencilLine size={17} color="#FFF" strokeWidth={2.1} />
                    <Text style={styles.toolButtonText}>Type mode</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleNextPrompt}
                    activeOpacity={0.84}
                    style={styles.toolButton}>
                    <ChevronRight size={17} color="#FFF" strokeWidth={2.1} />
                    <Text style={styles.toolButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              <View style={[styles.liveStudioCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.liveStudioTopRow}>
                  <View>
                    <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Live capture</Text>
                    <Text style={[styles.sectionTitle, {color: colors.text}]}>Voice practice studio</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: speechReady
                          ? isDark
                            ? '#0B2A22'
                            : '#ECFDF5'
                          : isDark
                            ? '#2A1A05'
                            : '#FFFBEB',
                      },
                    ]}>
                    {speechReady ? (
                      <Volume2 size={15} color={colors.success} strokeWidth={2.2} />
                    ) : (
                      <MicOff size={15} color={colors.warning} strokeWidth={2.2} />
                    )}
                    <Text
                      style={[
                        styles.statusPillText,
                        {color: speechReady ? colors.success : HAS_NATIVE_VOICE ? colors.info : colors.warning},
                      ]}>
                      {speechReady ? 'Mic ready' : HAS_NATIVE_VOICE ? 'Ready to test' : 'Type fallback active'}
                    </Text>
                  </View>
                </View>

                <View style={styles.waveDock}>
                  {Array.from({length: 16}).map((_, index) => {
                    const variance = (index % 4) * 0.08;
                    const height =
                      12 + Math.max(0.08, volumeLevel + variance) * (isRecording ? 48 : 20);
                    return (
                      <View
                        key={`wave-${index}`}
                        style={[
                          styles.waveBar,
                          {
                            height,
                            opacity: isRecording ? 0.9 : 0.34,
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={isRecording ? handleStopRecording : handleStartRecording}
                  style={styles.recordButtonWrap}>
                  <LinearGradient
                    colors={isRecording ? ['#F97316', '#FB7185'] : ['#0EA5E9', '#2563EB']}
                    locations={[0, 1]}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.recordButton}>
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : isRecording ? (
                      <MicOff size={30} color="#FFF" strokeWidth={2.2} />
                    ) : (
                      <Mic size={30} color="#FFF" strokeWidth={2.2} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={[styles.recordHint, {color: colors.textSecondary}]}>
                  {isRecording
                    ? 'Recording live. Tap again when you want to stop.'
                    : HAS_NATIVE_VOICE
                      ? 'Tap and speak naturally. The analysis is generated automatically.'
                      : 'If speech recognition is unavailable, you can still practice with type mode.'}
                </Text>

                {speechError ? (
                  <View
                    style={[
                      styles.noticeCard,
                      {
                        backgroundColor: colors.errorSurface,
                        borderColor: colors.error,
                      },
                    ]}>
                    <Text style={[styles.noticeTitle, {color: colors.error}]}>Voice issue</Text>
                    <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
                      {speechError}
                    </Text>
                  </View>
                ) : null}

                {transcript ? (
                  <View
                    style={[
                      styles.noticeCard,
                      {
                        backgroundColor: isDark ? '#101F35' : '#F8FBFF',
                        borderColor: isDark ? '#1E3A5F' : '#D8EEFF',
                      },
                    ]}>
                    <Text style={[styles.noticeTitle, {color: colors.info}]}>Recognized transcript</Text>
                    <Text style={[styles.noticeText, {color: colors.text}]}>
                      {transcript}
                    </Text>
                  </View>
                ) : null}
              </View>

              {analysis ? (
                <View style={[styles.analysisCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                  <View style={styles.analysisHeader}>
                    <View>
                      <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>AI feedback</Text>
                      <Text style={[styles.sectionTitle, {color: colors.text}]}>Performance summary</Text>
                    </View>
                    <View style={[styles.analysisScoreWrap, {borderColor: colors.border}]}>
                      <Text style={[styles.analysisScoreValue, {color: getAccuracyTone(analysis.accuracy).color}]}>
                        {Math.round(analysis.accuracy)}%
                      </Text>
                      <Text style={[styles.analysisScoreLabel, {color: colors.textSecondary}]}>
                        {getAccuracyTone(analysis.accuracy).label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={[styles.metricTile, {backgroundColor: isDark ? '#122033' : '#F1F8FF'}]}>
                      <Clock3 size={18} color={colors.info} strokeWidth={2.2} />
                      <Text style={[styles.metricValue, {color: colors.text}]}>
                        {formatDuration(readingTime)}
                      </Text>
                      <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Reading time</Text>
                    </View>
                    <View style={[styles.metricTile, {backgroundColor: isDark ? '#11261E' : '#ECFDF5'}]}>
                      <Gauge size={18} color={colors.success} strokeWidth={2.2} />
                      <Text style={[styles.metricValue, {color: colors.text}]}>
                        {Math.round(analysis.wpm || 0)}
                      </Text>
                      <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>WPM</Text>
                    </View>
                    <View style={[styles.metricTile, {backgroundColor: isDark ? '#271909' : '#FFF7ED'}]}>
                      <Brain size={18} color={colors.warning} strokeWidth={2.2} />
                      <Text style={[styles.metricValue, {color: colors.text}]}>
                        {Math.round(analysis.correctWords || 0)}
                      </Text>
                      <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Matched</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.noticeCard,
                      {
                        backgroundColor: isDark ? '#131F2C' : '#F8FAFC',
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text style={[styles.noticeTitle, {color: colors.text}]}>Feedback</Text>
                    <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
                      {analysis.feedback}
                    </Text>
                  </View>

                  {analysis.wordAnalysis?.length ? (
                    <View style={styles.analysisFlow}>
                      <Text style={[styles.flowLabel, {color: colors.textSecondary}]}>Word matching</Text>
                      <View style={styles.flowRow}>
                        {analysis.wordAnalysis.map(item => (
                          <View
                            key={`${item.word}-${item.correct ? '1' : '0'}`}
                            style={[
                              styles.flowChip,
                              {
                                backgroundColor: item.correct
                                  ? isDark
                                    ? '#0B2A22'
                                    : '#ECFDF5'
                                  : isDark
                                    ? '#2B1115'
                                    : '#FEF2F2',
                              },
                            ]}>
                            <Text
                              style={[
                                styles.flowChipText,
                                {color: item.correct ? colors.success : colors.error},
                              ]}>
                              {item.word}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {analysis.sentenceAnalysis?.length ? (
                    <View style={styles.sentenceList}>
                      {analysis.sentenceAnalysis.map(item => (
                        <View
                          key={item.sentence}
                          style={[
                            styles.sentenceItem,
                            {
                              backgroundColor: item.correct
                                ? isDark
                                  ? '#0B2A22'
                                  : '#F0FDF4'
                                : isDark
                                  ? '#2A1A05'
                                  : '#FFF7ED',
                              borderColor: item.correct ? colors.success : colors.warning,
                            },
                          ]}>
                          <Text style={[styles.sentenceItemText, {color: colors.text}]}>
                            {item.sentence}
                          </Text>
                          <Text
                            style={[
                              styles.sentenceItemAccuracy,
                              {color: item.correct ? colors.success : colors.warning},
                            ]}>
                            {item.accuracy}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={[styles.quickStatsCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Recent momentum</Text>
                <View style={styles.quickStatsRow}>
                  <View style={[styles.quickStatTile, {backgroundColor: isDark ? '#102033' : '#EFF6FF'}]}>
                    <BookOpen size={18} color={colors.info} strokeWidth={2.1} />
                    <Text style={[styles.quickStatValue, {color: colors.text}]}>
                      {recentAttempts.length ? Math.round(safeNumber(recentAttempts[0]?.accuracy)) : 0}%
                    </Text>
                    <Text style={[styles.quickStatLabel, {color: colors.textSecondary}]}>Last score</Text>
                  </View>
                  <View style={[styles.quickStatTile, {backgroundColor: isDark ? '#11261E' : '#ECFDF5'}]}>
                    <Trophy size={18} color={colors.success} strokeWidth={2.1} />
                    <Text style={[styles.quickStatValue, {color: colors.text}]}>
                      {Math.round(dashboardData.overallAccuracy)}%
                    </Text>
                    <Text style={[styles.quickStatLabel, {color: colors.textSecondary}]}>Overall accuracy</Text>
                  </View>
                  <View style={[styles.quickStatTile, {backgroundColor: isDark ? '#271909' : '#FFF7ED'}]}>
                    <Clock3 size={18} color={colors.warning} strokeWidth={2.1} />
                    <Text style={[styles.quickStatValue, {color: colors.text}]}>
                      {dashboardData.totalTime}
                    </Text>
                    <Text style={[styles.quickStatLabel, {color: colors.textSecondary}]}>Practice time</Text>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <>
              {attemptsQuery.isLoading && !attempts.length ? <ReadAloudSkeleton /> : null}

              <View style={[styles.analyticsHeroCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <View style={styles.analyticsHeroHeader}>
                  <View>
                    <Text style={[styles.sectionLabel, {color: colors.textSecondary}]}>Analytics</Text>
                    <Text style={[styles.sectionTitle, {color: colors.text}]}>Reading performance dashboard</Text>
                  </View>
                  <View style={[styles.statusPill, {backgroundColor: isDark ? '#132A3A' : '#E0F2FE'}]}>
                    <BarChart3 size={15} color={colors.info} strokeWidth={2.2} />
                    <Text style={[styles.statusPillText, {color: colors.info}]}>
                      {dashboardData.lastActive || 'Just now'}
                    </Text>
                  </View>
                </View>

                <View style={styles.analyticsMetricGrid}>
                  <View style={[styles.analyticsMetricCard, {backgroundColor: isDark ? '#101F35' : '#F8FBFF'}]}>
                    <Text style={[styles.analyticsMetricValue, {color: colors.text}]}>
                      {dashboardData.totalSessions}
                    </Text>
                    <Text style={[styles.analyticsMetricLabel, {color: colors.textSecondary}]}>
                      Total sessions
                    </Text>
                  </View>
                  <View style={[styles.analyticsMetricCard, {backgroundColor: isDark ? '#11261E' : '#ECFDF5'}]}>
                    <Text style={[styles.analyticsMetricValue, {color: colors.text}]}>
                      {Math.round(dashboardData.avgWPM)}
                    </Text>
                    <Text style={[styles.analyticsMetricLabel, {color: colors.textSecondary}]}>
                      Average WPM
                    </Text>
                  </View>
                  <View style={[styles.analyticsMetricCard, {backgroundColor: isDark ? '#271909' : '#FFF7ED'}]}>
                    <Text style={[styles.analyticsMetricValue, {color: colors.text}]}>
                      {dashboardData.totalTime}
                    </Text>
                    <Text style={[styles.analyticsMetricLabel, {color: colors.textSecondary}]}>
                      Total time
                    </Text>
                  </View>
                </View>

                <Text style={[styles.flowLabel, {color: colors.textSecondary}]}>Progress timeline</Text>
                <View style={styles.timelineRow}>
                  {(dashboardData.progressOverTime || []).length ? (
                    dashboardData.progressOverTime.map(point => (
                      <View key={point.label} style={styles.timelineItem}>
                        <View style={[styles.timelineTrack, {backgroundColor: isDark ? '#0F172A' : '#E5E7EB'}]}>
                          <View
                            style={[
                              styles.timelineFill,
                              {
                                height: `${Math.max(10, point.accuracy)}%`,
                                backgroundColor: point.accuracy >= 85 ? colors.success : point.accuracy >= 60 ? colors.warning : colors.error,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.timelineValue, {color: colors.text}]}>
                          {Math.round(point.accuracy)}%
                        </Text>
                        <Text style={[styles.timelineLabel, {color: colors.textSecondary}]}>
                          {point.label}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.emptyPromptText, {color: colors.textSecondary}]}>
                      The progress timeline will appear here after attempts are completed.
                    </Text>
                  )}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  onPress={() => setAnalyticsFilter('all')}
                  activeOpacity={0.84}
                  style={[
                    styles.analyticsFilterChip,
                    analyticsFilter === 'all'
                      ? styles.analyticsFilterChipActive
                      : {backgroundColor: colors.surface, borderColor: colors.border},
                  ]}>
                  <Text
                    style={[
                      styles.analyticsFilterText,
                      {color: analyticsFilter === 'all' ? '#FFF' : colors.text},
                    ]}>
                    All modes
                  </Text>
                </TouchableOpacity>
                {READING_MODES.map(mode => {
                  const active = analyticsFilter === (mode.id as ReadAloudModeId);
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      onPress={() => setAnalyticsFilter(mode.id as ReadAloudModeId)}
                      activeOpacity={0.84}
                      style={[
                        styles.analyticsFilterChip,
                        active
                          ? styles.analyticsFilterChipActive
                          : {backgroundColor: colors.surface, borderColor: colors.border},
                      ]}>
                      <Text
                        style={[
                          styles.analyticsFilterText,
                          {color: active ? '#FFF' : colors.text},
                        ]}>
                        {mode.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.sectionCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Mode performance</Text>
                {performanceEntries.length ? (
                  performanceEntries.map(([mode, value]) => (
                    <View
                      key={mode}
                      style={[
                        styles.performanceRow,
                        {borderBottomColor: colors.divider},
                      ]}>
                      <View style={styles.performanceRowMain}>
                        <Text style={[styles.performanceModeTitle, {color: colors.text}]}>
                          {MODE_COPY[mode as ReadAloudModeId]?.title || mode}
                        </Text>
                        <Text style={[styles.performanceModeMeta, {color: colors.textSecondary}]}>
                          {value.sessions} sessions • {Math.round(value.speed)} WPM • {value.timeSpent}
                        </Text>
                      </View>
                      <View style={styles.performanceScoreWrap}>
                        <Text style={[styles.performanceScore, {color: getAccuracyTone(value.accuracy).color}]}>
                          {Math.round(value.accuracy)}%
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.emptyPromptText, {color: colors.textSecondary}]}>
                    No mode performance history is available yet.
                  </Text>
                )}
              </View>

              <View style={[styles.sectionCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Attempt library</Text>
                {groupedAttempts.length ? (
                  groupedAttempts.map(([key, items]) => {
                    const isOpen = !!expandedHistory[key];
                    const latest = items[0];
                    const bestAccuracy = Math.max(...items.map(item => safeNumber(item.accuracy)));
                    const targetText = getAttemptTargetText(latest);

                    return (
                      <View
                        key={key}
                        style={[
                          styles.historyCard,
                          {borderColor: colors.border, backgroundColor: colors.background},
                        ]}>
                        <TouchableOpacity
                          activeOpacity={0.84}
                          onPress={() =>
                            setExpandedHistory(prev => ({
                              ...prev,
                              [key]: !prev[key],
                            }))
                          }
                          style={styles.historyHeader}>
                          <View style={styles.historyMeta}>
                            <View style={[styles.historyModePill, {backgroundColor: colors.primarySurface}]}>
                              <Text style={[styles.historyModePillText, {color: colors.primary}]}>
                                {MODE_COPY[String(latest.mode || 'word') as ReadAloudModeId]?.title || latest.mode}
                              </Text>
                            </View>
                            <Text style={[styles.historyTitle, {color: colors.text}]}>
                              {targetText || 'Untitled prompt'}
                            </Text>
                            <Text style={[styles.historySubtext, {color: colors.textSecondary}]}>
                              {items.length} attempts • best {Math.round(bestAccuracy)}% • {formatAttemptDate(new Date(latest.date || Date.now()))}
                            </Text>
                          </View>
                          {isOpen ? (
                            <ChevronUp size={20} color={colors.textSecondary} strokeWidth={2.2} />
                          ) : (
                            <ChevronDown size={20} color={colors.textSecondary} strokeWidth={2.2} />
                          )}
                        </TouchableOpacity>

                        {isOpen ? (
                          <View style={styles.historyExpanded}>
                            <View style={styles.metricRow}>
                              <View style={[styles.metricTile, {backgroundColor: isDark ? '#11261E' : '#ECFDF5'}]}>
                                <Trophy size={18} color={colors.success} strokeWidth={2.1} />
                                <Text style={[styles.metricValue, {color: colors.text}]}>
                                  {Math.round(bestAccuracy)}%
                                </Text>
                                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Best</Text>
                              </View>
                              <View style={[styles.metricTile, {backgroundColor: isDark ? '#101F35' : '#EFF6FF'}]}>
                                <Gauge size={18} color={colors.info} strokeWidth={2.1} />
                                <Text style={[styles.metricValue, {color: colors.text}]}>
                                  {Math.round(safeNumber(latest.word_per_minute))}
                                </Text>
                                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Latest WPM</Text>
                              </View>
                              <View style={[styles.metricTile, {backgroundColor: isDark ? '#271909' : '#FFF7ED'}]}>
                                <Clock3 size={18} color={colors.warning} strokeWidth={2.1} />
                                <Text style={[styles.metricValue, {color: colors.text}]}>
                                  {formatDuration(safeNumber(latest.sessionTime))}
                                </Text>
                                <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Latest time</Text>
                              </View>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.84}
                              onPress={() => {
                                setReviewAttempts(items);
                                setReviewIndex(0);
                              }}
                              style={styles.reviewButton}>
                              <Brain size={17} color="#FFF" strokeWidth={2.1} />
                              <Text style={styles.reviewButtonText}>Review all attempts</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyPromptText, {color: colors.textSecondary}]}>
                    Detailed history will appear here after practice attempts are completed.
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={manualEntryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualEntryVisible(false)}>
        <View style={[styles.modalBackdrop, {backgroundColor: colors.overlay}]}>
          <View style={[styles.modalCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Type your spoken response</Text>
                <Text style={[styles.modalSubtitle, {color: colors.textSecondary}]}>
                  If voice recognition is unavailable, you can enter the transcript manually here.
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.84} onPress={() => setManualEntryVisible(false)}>
                <X size={20} color={colors.textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={manualTranscript}
              onChangeText={setManualTranscript}
              placeholder="Type what the learner spoke..."
              placeholderTextColor={colors.placeholder}
              multiline
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => setManualEntryVisible(false)}
                style={[styles.modalGhostButton, {borderColor: colors.border}]}>
                <Text style={[styles.modalGhostText, {color: colors.text}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.84} onPress={handleManualAnalyze} style={styles.modalPrimaryButton}>
                <Text style={styles.modalPrimaryText}>Analyze reading</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reviewAttempt}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setReviewAttempts([]);
          setReviewIndex(0);
        }}>
        <View style={[styles.modalBackdrop, {backgroundColor: colors.scrim}]}>
          <View style={[styles.reviewModalCard, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Attempt review</Text>
                <Text style={[styles.modalSubtitle, {color: colors.textSecondary}]}>
                  {reviewAttempts.length ? `${reviewIndex + 1} of ${reviewAttempts.length}` : '0 of 0'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => {
                  setReviewAttempts([]);
                  setReviewIndex(0);
                }}>
                <X size={20} color={colors.textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {reviewAttempt ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.metricRow}>
                  <View style={[styles.metricTile, {backgroundColor: isDark ? '#11261E' : '#ECFDF5'}]}>
                    <Trophy size={18} color={colors.success} strokeWidth={2.1} />
                    <Text style={[styles.metricValue, {color: colors.text}]}>
                      {Math.round(safeNumber(reviewAttempt.accuracy))}%
                    </Text>
                    <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Accuracy</Text>
                  </View>
                  <View style={[styles.metricTile, {backgroundColor: isDark ? '#101F35' : '#EFF6FF'}]}>
                    <Gauge size={18} color={colors.info} strokeWidth={2.1} />
                    <Text style={[styles.metricValue, {color: colors.text}]}>
                      {Math.round(safeNumber(reviewAttempt.word_per_minute))}
                    </Text>
                    <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>WPM</Text>
                  </View>
                  <View style={[styles.metricTile, {backgroundColor: isDark ? '#271909' : '#FFF7ED'}]}>
                    <Clock3 size={18} color={colors.warning} strokeWidth={2.1} />
                    <Text style={[styles.metricValue, {color: colors.text}]}>
                      {formatDuration(safeNumber(reviewAttempt.sessionTime))}
                    </Text>
                    <Text style={[styles.metricLabel, {color: colors.textSecondary}]}>Duration</Text>
                  </View>
                </View>

                <View style={[styles.noticeCard, {backgroundColor: colors.background, borderColor: colors.border}]}>
                  <Text style={[styles.noticeTitle, {color: colors.text}]}>Target text</Text>
                  <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
                    {getAttemptTargetText(reviewAttempt)}
                  </Text>
                </View>

                <View style={[styles.noticeCard, {backgroundColor: colors.background, borderColor: colors.border}]}>
                  <Text style={[styles.noticeTitle, {color: colors.text}]}>Spoken transcript</Text>
                  <Text style={[styles.noticeText, {color: colors.textSecondary}]}>
                    {String(reviewAttempt.transcript || 'No transcript saved')}
                  </Text>
                </View>

                {reviewComparison ? (
                  <View style={styles.analysisFlow}>
                    <Text style={[styles.flowLabel, {color: colors.textSecondary}]}>Word-by-word review</Text>
                    <View style={styles.flowRow}>
                      {reviewComparison.targetHighlights.map(item => (
                        <View
                          key={`${item.word}-${item.matched ? '1' : '0'}`}
                          style={[
                            styles.flowChip,
                            {
                              backgroundColor: item.matched
                                ? isDark
                                  ? '#0B2A22'
                                  : '#ECFDF5'
                                : isDark
                                  ? '#2B1115'
                                  : '#FEF2F2',
                            },
                          ]}>
                          <Text
                            style={[
                              styles.flowChipText,
                              {color: item.matched ? colors.success : colors.error},
                            ]}>
                            {item.word}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.modalSubtitle, {color: colors.textSecondary, marginTop: verticalScale(10)}]}>
                  {formatAttemptDate(new Date(reviewAttempt.date || Date.now()))}
                </Text>
              </ScrollView>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={reviewIndex <= 0}
                onPress={() => setReviewIndex(index => Math.max(0, index - 1))}
                style={[
                  styles.modalGhostButton,
                  {borderColor: colors.border, opacity: reviewIndex <= 0 ? 0.45 : 1},
                ]}>
                <Text style={[styles.modalGhostText, {color: colors.text}]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={reviewIndex >= reviewAttempts.length - 1}
                onPress={() =>
                  setReviewIndex(index => Math.min(reviewAttempts.length - 1, index + 1))
                }
                style={[
                  styles.modalPrimaryButton,
                  {opacity: reviewIndex >= reviewAttempts.length - 1 ? 0.45 : 1},
                ]}>
                <Text style={styles.modalPrimaryText}>Next review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ReadAloudScreen() {
  return (
    <ScreenErrorBoundary>
      <ReadAloudContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  hero: {
    paddingHorizontal: H_PAD,
    paddingBottom: verticalScale(32),
    borderBottomLeftRadius: moderateScale(36),
    borderBottomRightRadius: moderateScale(36),
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroPillText: {
    color: '#FFF',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: verticalScale(22),
    color: '#FFF',
    fontSize: moderateScale(30),
    lineHeight: moderateScale(38),
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: verticalScale(10),
    color: 'rgba(255,255,255,0.76)',
    fontSize: moderateScale(15),
    lineHeight: moderateScale(23),
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(20),
  },
  heroStatCard: {
    flex: 1,
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(24),
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroStatValue: {
    color: '#FFF',
    fontSize: moderateScale(22),
    fontWeight: '900',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
  body: {
    paddingHorizontal: H_PAD,
    paddingTop: verticalScale(18),
  },
  tabShell: {
    flexDirection: 'row',
    padding: scale(5),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    marginBottom: verticalScale(18),
  },
  tabButton: {
    flex: 1,
  },
  tabButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(16),
  },
  tabButtonIdle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(13),
    borderRadius: moderateScale(16),
  },
  tabTextActive: {
    color: '#FFF',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  tabTextIdle: {
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
    marginBottom: verticalScale(16),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  sectionLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: verticalScale(6),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    lineHeight: moderateScale(25),
  },
  lensCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
    maxWidth: '52%',
  },
  lensEmoji: {
    fontSize: moderateScale(18),
  },
  lensTitle: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  lensSubtitle: {
    marginTop: verticalScale(2),
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  chipRow: {
    gap: scale(10),
    paddingTop: verticalScale(14),
  },
  filterChip: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  filterChipText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  curriculumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
    borderWidth: 1,
  },
  curriculumEmoji: {
    fontSize: moderateScale(14),
  },
  curriculumText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  modeRow: {
    gap: scale(12),
    paddingBottom: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  modeCard: {
    width: scale(166),
  },
  modeCardGradient: {
    borderRadius: moderateScale(28),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(18),
    minHeight: verticalScale(164),
  },
  modeEmoji: {
    fontSize: moderateScale(22),
    marginBottom: verticalScale(16),
  },
  modeTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
  modeMeta: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  modeDescription: {
    marginTop: verticalScale(10),
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  practiceCard: {
    borderRadius: moderateScale(32),
    padding: scale(20),
    marginBottom: verticalScale(16),
  },
  practiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  practiceEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: moderateScale(11),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  practiceInstruction: {
    marginTop: verticalScale(8),
    color: '#FFF',
    fontSize: moderateScale(18),
    fontWeight: '800',
    lineHeight: moderateScale(24),
    maxWidth: '82%',
  },
  practiceCounterCard: {
    minWidth: scale(76),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(15,23,42,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  practiceCounterValue: {
    color: '#FFF',
    fontSize: moderateScale(16),
    fontWeight: '900',
  },
  practiceCounterLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: moderateScale(10),
    fontWeight: '700',
    marginTop: verticalScale(4),
  },
  promptShell: {
    marginTop: verticalScale(18),
    borderRadius: moderateScale(28),
    padding: scale(12),
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  promptVisualWrap: {
    gap: verticalScale(12),
  },
  promptImage: {
    width: '100%',
    height: verticalScale(250),
    borderRadius: moderateScale(24),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  textPromptWrap: {
    minHeight: verticalScale(210),
    alignItems: 'center',
    justifyContent: 'center',
    gap: verticalScale(14),
    paddingHorizontal: scale(18),
  },
  textPromptValue: {
    color: '#FFF',
    fontSize: moderateScale(26),
    lineHeight: moderateScale(34),
    fontWeight: '900',
    textAlign: 'center',
  },
  storyCard: {
    gap: verticalScale(10),
    padding: scale(16),
  },
  storyTitle: {
    color: '#FFF',
    fontSize: moderateScale(24),
    fontWeight: '900',
    marginBottom: verticalScale(6),
  },
  storySentence: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: moderateScale(15),
    lineHeight: moderateScale(24),
    fontWeight: '600',
  },
  teacherPromptPill: {
    marginTop: verticalScale(8),
    alignSelf: 'flex-start',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  teacherPromptText: {
    color: '#FFF',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  promptFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  promptBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
    backgroundColor: 'rgba(15,23,42,0.22)',
  },
  promptBadgeText: {
    color: '#FFF',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    marginTop: verticalScale(18),
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(11),
    borderRadius: moderateScale(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toolButtonActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#FDE68A',
  },
  toolButtonText: {
    color: '#FFF',
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  liveStudioCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
    marginBottom: verticalScale(16),
  },
  liveStudioTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(9),
    borderRadius: moderateScale(999),
  },
  statusPillText: {
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  waveDock: {
    marginTop: verticalScale(20),
    height: verticalScale(78),
    borderRadius: moderateScale(24),
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(16),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(14,165,233,0.08)',
  },
  waveBar: {
    width: scale(8),
    borderRadius: moderateScale(999),
    backgroundColor: '#0EA5E9',
  },
  recordButtonWrap: {
    alignItems: 'center',
    marginTop: verticalScale(20),
  },
  recordButton: {
    width: scale(92),
    height: scale(92),
    borderRadius: scale(46),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
    elevation: 8,
  },
  recordHint: {
    marginTop: verticalScale(14),
    textAlign: 'center',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  noticeCard: {
    marginTop: verticalScale(14),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    padding: scale(14),
  },
  noticeTitle: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    marginBottom: verticalScale(6),
  },
  noticeText: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  analysisCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
    marginBottom: verticalScale(16),
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  analysisScoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(88),
    borderWidth: 1,
    borderRadius: moderateScale(22),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(12),
  },
  analysisScoreValue: {
    fontSize: moderateScale(26),
    fontWeight: '900',
  },
  analysisScoreLabel: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(18),
  },
  metricTile: {
    flex: 1,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(22),
    alignItems: 'flex-start',
    gap: verticalScale(8),
  },
  metricValue: {
    fontSize: moderateScale(18),
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  analysisFlow: {
    marginTop: verticalScale(18),
  },
  flowLabel: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    marginBottom: verticalScale(10),
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  flowChip: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    borderRadius: moderateScale(16),
  },
  flowChipText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  sentenceList: {
    gap: verticalScale(10),
    marginTop: verticalScale(18),
  },
  sentenceItem: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(18),
    borderWidth: 1,
  },
  sentenceItemText: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '700',
  },
  sentenceItemAccuracy: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(12),
    fontWeight: '900',
  },
  quickStatsCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(16),
  },
  quickStatTile: {
    flex: 1,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(14),
    borderRadius: moderateScale(22),
    gap: verticalScale(8),
  },
  quickStatValue: {
    fontSize: moderateScale(18),
    fontWeight: '900',
  },
  quickStatLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  analyticsHeroCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
    marginBottom: verticalScale(16),
  },
  analyticsHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  analyticsMetricGrid: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(18),
    marginBottom: verticalScale(16),
  },
  analyticsMetricCard: {
    flex: 1,
    borderRadius: moderateScale(22),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(14),
  },
  analyticsMetricValue: {
    fontSize: moderateScale(18),
    fontWeight: '900',
  },
  analyticsMetricLabel: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: scale(12),
    marginTop: verticalScale(8),
    minHeight: verticalScale(154),
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
  },
  timelineTrack: {
    width: '100%',
    height: verticalScale(104),
    borderRadius: moderateScale(16),
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  timelineFill: {
    width: '100%',
    borderRadius: moderateScale(16),
  },
  timelineValue: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(11),
    fontWeight: '800',
  },
  timelineLabel: {
    marginTop: verticalScale(4),
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  analyticsFilterChip: {
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(18),
    borderWidth: 1,
  },
  analyticsFilterChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  analyticsFilterText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
  },
  performanceRowMain: {
    flex: 1,
  },
  performanceModeTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
  performanceModeMeta: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  performanceScoreWrap: {
    justifyContent: 'center',
  },
  performanceScore: {
    fontSize: moderateScale(22),
    fontWeight: '900',
  },
  historyCard: {
    borderRadius: moderateScale(24),
    borderWidth: 1,
    padding: scale(16),
    marginTop: verticalScale(14),
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  historyMeta: {
    flex: 1,
  },
  historyModePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(999),
    marginBottom: verticalScale(10),
  },
  historyModePillText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
  },
  historyTitle: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(23),
    fontWeight: '800',
  },
  historySubtext: {
    marginTop: verticalScale(8),
    fontSize: moderateScale(11),
    lineHeight: moderateScale(18),
    fontWeight: '600',
  },
  historyExpanded: {
    marginTop: verticalScale(16),
  },
  reviewButton: {
    marginTop: verticalScale(16),
    borderRadius: moderateScale(18),
    backgroundColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(14),
  },
  reviewButtonText: {
    color: '#FFF',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  emptyPromptCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: verticalScale(200),
  },
  emptyPromptTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  emptyPromptText: {
    textAlign: 'center',
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
  },
  modalCard: {
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
  },
  reviewModalCard: {
    maxHeight: '86%',
    borderRadius: moderateScale(28),
    borderWidth: 1,
    padding: scale(18),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(12),
    marginBottom: verticalScale(14),
  },
  modalSubtitle: {
    marginTop: verticalScale(6),
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
    fontWeight: '600',
  },
  modalInput: {
    minHeight: verticalScale(150),
    borderRadius: moderateScale(20),
    borderWidth: 1,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    textAlignVertical: 'top',
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: scale(10),
    marginTop: verticalScale(18),
  },
  modalGhostButton: {
    flex: 1,
    borderRadius: moderateScale(18),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(13),
  },
  modalGhostText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  modalPrimaryButton: {
    flex: 1,
    borderRadius: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(13),
    backgroundColor: '#0EA5E9',
  },
  modalPrimaryText: {
    color: '#FFF',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  skeletonRoot: {
    paddingBottom: verticalScale(10),
  },
  skeletonHero: {
    borderRadius: moderateScale(30),
    padding: scale(20),
  },
  skeletonGap: {
    marginTop: verticalScale(12),
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(20),
  },
  skeletonBody: {
    paddingTop: verticalScale(16),
  },
});
