export type ReadAloudModeId = 'word' | 'words' | 'sentence' | 'story';

export interface ReadAloudAttempt {
  _id?: string;
  questionId?: string | number;
  transcript?: string;
  accuracy?: number | string;
  question?: string;
  correctAnswer?: string;
  correctSentence?: string;
  mode?: ReadAloudModeId | string;
  sessionTime?: number | string;
  word_per_minute?: number | string;
  no_of_correct?: number | string;
  no_of_incorrect?: number | string;
  no_of_total?: number | string;
  date?: string;
}

export interface WordAnalysisItem {
  word: string;
  correct: boolean;
}

export interface SentenceAnalysisItem {
  sentence: string;
  accuracy: number;
  correct: boolean;
}

export interface AnalysisResult {
  accuracy: number;
  feedback: string;
  targetText: string;
  spokenText: string;
  correct?: boolean;
  expectedWord?: string;
  spokenWord?: string;
  wordAnalysis?: WordAnalysisItem[];
  sentenceAnalysis?: SentenceAnalysisItem[];
  readingTime?: number;
  wpm?: number;
  expectedWPM?: number;
  correctWords?: number;
  totalWords?: number;
}

export interface DashboardModePerformance {
  accuracy: number;
  sessions: number;
  speed: number;
  comprehension: number;
  timeSpent: string;
}

export interface DashboardData {
  totalSessions: number;
  overallAccuracy: number;
  avgWPM: number;
  totalTime: string;
  lastActive: string;
  performanceByMode: Record<string, DashboardModePerformance>;
  progressOverTime: Array<{label: string; accuracy: number}>;
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function wordsFromText(value: string): string[] {
  return value
    .split(/\s+/)
    .map(word => word.trim())
    .filter(Boolean);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (!seconds) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (hours === 0 && remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

export function formatAttemptDate(date = new Date()): string {
  return date
    .toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', '');
}

export function getAccuracyTone(accuracy: number) {
  if (accuracy >= 85) {
    return {label: 'Excellent', color: '#10B981'};
  }
  if (accuracy >= 60) {
    return {label: 'Good', color: '#F59E0B'};
  }
  return {label: 'Needs Practice', color: '#EF4444'};
}

export function getQuestionText(item: any, mode: ReadAloudModeId): string {
  if (!item) {
    return '';
  }
  if (mode === 'word') {
    return item.word || '';
  }
  if (mode === 'words' || mode === 'sentence') {
    return item.text || '';
  }
  if (mode === 'story') {
    return item.sentences?.join(' ') || item.title || '';
  }
  return '';
}

export function getQuestionTitle(item: any, mode: ReadAloudModeId): string {
  if (!item) {
    return '';
  }
  if (mode === 'story') {
    return item.title || 'Story';
  }
  return getQuestionText(item, mode);
}

export function analyzeTranscript(params: {
  mode: ReadAloudModeId;
  item: any;
  transcript: string;
  readingTime: number;
}): {
  result: AnalysisResult;
  payload: Record<string, unknown>;
} {
  const {mode, item, transcript, readingTime} = params;
  const spokenText = transcript.trim();
  const duration = Math.max(0, readingTime);

  if (mode === 'word') {
    const expectedText = (item.word || '').toLowerCase();
    const lowerSpoken = spokenText.toLowerCase();
    const exact = lowerSpoken === expectedText;
    const partial = lowerSpoken.includes(expectedText) || expectedText.includes(lowerSpoken);
    const accuracy = exact
      ? 100
      : partial
        ? Math.max(60, 75 - Math.abs(lowerSpoken.length - expectedText.length) * 5)
        : Math.max(0, 40 - Math.abs(lowerSpoken.length - expectedText.length) * 10);

    return {
      result: {
        accuracy,
        correct: exact || partial,
        expectedWord: item.word,
        spokenWord: spokenText,
        targetText: item.word,
        spokenText,
        feedback: exact
          ? 'Perfect pronunciation.'
          : partial
            ? 'Close. Keep practicing.'
            : 'Let us try once more.',
      },
      payload: {
        questionId: item.id,
        transcript: spokenText,
        accuracy,
        question: item.word,
        mode,
        correctAnswer: item.word,
        sessionTime: duration.toFixed(2),
      },
    };
  }

  if (mode === 'words') {
    const expectedText = (item.text || '').toLowerCase();
    const lowerSpoken = spokenText.toLowerCase();
    const exact = lowerSpoken === expectedText;
    const partial = lowerSpoken.includes(expectedText) || expectedText.includes(lowerSpoken);
    const accuracy = exact
      ? 100
      : partial
        ? Math.max(60, 75 - Math.abs(lowerSpoken.length - expectedText.length) * 5)
        : Math.max(0, 40 - Math.abs(lowerSpoken.length - expectedText.length) * 10);

    return {
      result: {
        accuracy,
        correct: exact || partial,
        expectedWord: item.text,
        spokenWord: spokenText,
        targetText: item.text,
        spokenText,
        feedback: exact
          ? 'Clean read.'
          : partial
            ? 'Nearly there.'
            : 'Try the word again slowly.',
      },
      payload: {
        questionId: item.id,
        transcript: spokenText,
        accuracy,
        question: item.text,
        mode,
        correctAnswer: item.text,
        sessionTime: duration.toFixed(2),
      },
    };
  }

  if (mode === 'sentence') {
    const expectedWords = wordsFromText((item.text || '').toLowerCase());
    const spokenWords = wordsFromText(spokenText.toLowerCase());
    const wordAnalysis = expectedWords.map((word, index) => ({
      word,
      correct:
        !!spokenWords[index] &&
        normalizeWord(spokenWords[index]).includes(normalizeWord(word)),
    }));
    const correctWords = wordAnalysis.filter(itemWord => itemWord.correct).length;
    const accuracy = expectedWords.length
      ? Math.round((correctWords / expectedWords.length) * 100)
      : 0;
    const wpm = duration > 0 ? Math.round((expectedWords.length / duration) * 60) : 0;

    return {
      result: {
        accuracy,
        feedback:
          accuracy >= 85
            ? 'Fluent and accurate.'
            : accuracy >= 60
              ? 'Good flow. Sharpen a few words.'
              : 'Slow down and try for clearer word matches.',
        targetText: item.text,
        spokenText,
        wordAnalysis,
        readingTime: duration,
        wpm,
      },
      payload: {
        questionId: item.id,
        transcript: spokenText,
        accuracy,
        question: item.text,
        mode,
        correctAnswer: item.text,
        sessionTime: duration.toFixed(2),
        word_per_minute: wpm,
      },
    };
  }

  const fullText = (item.sentences?.join(' ') || '').toLowerCase();
  const expectedWords = wordsFromText(fullText);
  const spokenWords = wordsFromText(spokenText.toLowerCase());
  const correctWords = expectedWords.filter(word =>
    spokenWords.some(spoken => normalizeWord(spoken).includes(normalizeWord(word))),
  ).length;
  const accuracy = expectedWords.length
    ? Math.round((correctWords / expectedWords.length) * 100)
    : 0;
  const wpm = duration > 0 ? Math.round((expectedWords.length / duration) * 60) : 0;
  const sentenceAnalysis = (item.sentences || []).map((sentence: string, index: number) => {
    const sentenceWords = wordsFromText(sentence.toLowerCase());
    const previousWords = (item.sentences || [])
      .slice(0, index)
      .join(' ');
    const sentenceStart = wordsFromText(previousWords).length;
    const sentenceSpoken = spokenWords.slice(sentenceStart, sentenceStart + sentenceWords.length);
    const correctInSentence = sentenceWords.filter(word =>
      sentenceSpoken.some(spoken => normalizeWord(spoken).includes(normalizeWord(word))),
    ).length;
    const sentenceAccuracy = sentenceWords.length
      ? Math.round((correctInSentence / sentenceWords.length) * 100)
      : 0;

    return {
      sentence,
      accuracy: sentenceAccuracy,
      correct: correctInSentence >= sentenceWords.length * 0.7,
    };
  });

  return {
    result: {
      accuracy,
      feedback:
        accuracy >= 85
          ? 'Excellent storytelling rhythm.'
          : accuracy >= 60
            ? 'Good pacing. Keep refining.'
            : 'Practice smaller chunks for better fluency.',
      targetText: item.sentences?.join(' ') || item.title,
      spokenText,
      readingTime: duration,
      wpm,
      expectedWPM: item.expectedWPM,
      correctWords,
      totalWords: expectedWords.length,
      sentenceAnalysis,
    },
    payload: {
      questionId: item.id,
      transcript: spokenText,
      accuracy,
      question: item.title,
      mode,
      sessionTime: duration.toFixed(2),
      correctAnswer: item.sentences?.join(' ') || '',
      no_of_correct: correctWords,
      no_of_incorrect: expectedWords.length - correctWords,
      no_of_total: expectedWords.length,
      word_per_minute: wpm,
    },
  };
}

export function buildDashboardFromAttempts(
  attempts: ReadAloudAttempt[],
  dashboard?: Partial<DashboardData> | null,
): DashboardData {
  if (!attempts.length && dashboard) {
    return {
      totalSessions: safeNumber(dashboard.totalSessions),
      overallAccuracy: safeNumber(dashboard.overallAccuracy),
      avgWPM: safeNumber(dashboard.avgWPM),
      totalTime: dashboard.totalTime || '0s',
      lastActive: dashboard.lastActive || 'Just now',
      performanceByMode: dashboard.performanceByMode || {},
      progressOverTime: dashboard.progressOverTime || [],
    };
  }

  const totalSessions = attempts.length;
  const overallAccuracy = totalSessions
    ? attempts.reduce((sum, attempt) => sum + safeNumber(attempt.accuracy), 0) / totalSessions
    : 0;
  const avgWPMValues = attempts
    .map(attempt => safeNumber(attempt.word_per_minute))
    .filter(value => value > 0);
  const avgWPM = avgWPMValues.length
    ? avgWPMValues.reduce((sum, value) => sum + value, 0) / avgWPMValues.length
    : 0;
  const totalSeconds = attempts.reduce(
    (sum, attempt) => sum + safeNumber(attempt.sessionTime),
    0,
  );

  const modeTotals = attempts.reduce<Record<string, DashboardModePerformance & {timeSeconds: number}>>(
    (acc, attempt) => {
      const mode = String(attempt.mode || 'unknown');
      const current = acc[mode] || {
        accuracy: 0,
        sessions: 0,
        speed: 0,
        comprehension: 0,
        timeSpent: '0s',
        timeSeconds: 0,
      };
      const nextSessions = current.sessions + 1;
      const nextAccuracy =
        (current.accuracy * current.sessions + safeNumber(attempt.accuracy)) / nextSessions;
      const attemptSpeed = safeNumber(attempt.word_per_minute);
      const existingSpeedTotal = current.speed * current.sessions;
      const nextSpeed = attemptSpeed > 0
        ? (existingSpeedTotal + attemptSpeed) / nextSessions
        : current.speed;
      const nextTimeSeconds = current.timeSeconds + safeNumber(attempt.sessionTime);

      acc[mode] = {
        accuracy: nextAccuracy,
        sessions: nextSessions,
        speed: nextSpeed,
        comprehension: mode === 'story' ? nextAccuracy : 0,
        timeSpent: formatDuration(nextTimeSeconds),
        timeSeconds: nextTimeSeconds,
      };
      return acc;
    },
    {},
  );
  const performanceByMode = Object.entries(modeTotals).reduce<Record<string, DashboardModePerformance>>(
    (acc, [mode, value]) => {
      acc[mode] = {
        accuracy: value.accuracy,
        sessions: value.sessions,
        speed: value.speed,
        comprehension: value.comprehension,
        timeSpent: value.timeSpent,
      };
      return acc;
    },
    {},
  );

  const sortedAttempts = [...attempts].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return dateA - dateB;
  });

  const progressOverTime = sortedAttempts.slice(-7).map((attempt, index) => ({
    label: `S${index + 1}`,
    accuracy: safeNumber(attempt.accuracy),
  }));

  const lastAttempt = sortedAttempts[sortedAttempts.length - 1];

  return {
    totalSessions: safeNumber(dashboard?.totalSessions) || totalSessions,
    overallAccuracy: safeNumber(dashboard?.overallAccuracy) || overallAccuracy,
    avgWPM: safeNumber(dashboard?.avgWPM) || avgWPM,
    totalTime: dashboard?.totalTime || formatDuration(totalSeconds),
    lastActive: dashboard?.lastActive || (lastAttempt?.date ? new Date(lastAttempt.date).toLocaleDateString() : 'Just now'),
    performanceByMode: Object.keys(performanceByMode).length
      ? performanceByMode
      : dashboard?.performanceByMode || {},
    progressOverTime: progressOverTime.length ? progressOverTime : dashboard?.progressOverTime || [],
  };
}

export function groupAttemptsByQuestion(attempts: ReadAloudAttempt[]) {
  return attempts.reduce<Record<string, ReadAloudAttempt[]>>((acc, attempt) => {
    const key = String(attempt.questionId || attempt.question || attempt._id || 'unknown');
    (acc[key] ||= []).push(attempt);
    return acc;
  }, {});
}

export function buildTranscriptComparison(targetText: string, spokenText: string) {
  const targetWords = wordsFromText(targetText);
  const spokenWords = wordsFromText(spokenText);
  const usedIndices = new Set<number>();

  const targetHighlights = targetWords.map((word, index) => {
    const normalizedTarget = normalizeWord(word);
    let matchedIndex = -1;

    if (
      spokenWords[index] &&
      normalizeWord(spokenWords[index]).includes(normalizedTarget)
    ) {
      matchedIndex = index;
      usedIndices.add(index);
    } else {
      for (let i = 0; i < spokenWords.length; i += 1) {
        if (usedIndices.has(i)) {
          continue;
        }
        if (normalizeWord(spokenWords[i]).includes(normalizedTarget)) {
          matchedIndex = i;
          usedIndices.add(i);
          break;
        }
      }
    }

    return {
      word,
      matched: matchedIndex !== -1,
      matchedIndex,
    };
  });

  const extraSpoken = spokenWords
    .map((word, index) => (!usedIndices.has(index) ? {word, index} : null))
    .filter(Boolean) as Array<{word: string; index: number}>;

  return {
    targetHighlights,
    extraSpoken,
    spokenWords,
  };
}

export function getAttemptTargetText(attempt: ReadAloudAttempt) {
  return attempt.correctAnswer || attempt.correctSentence || attempt.question || '';
}
