import type {LucideIcon} from 'lucide-react-native';
import {
  Bird,
  BookOpen,
  Feather,
  FlaskConical,
  Hash,
  Mic,
  Sparkles,
} from 'lucide-react-native';
import type {BookGradeKey, BookSubjectKey} from '@/types';

export interface GradeMeta {
  key: BookGradeKey;
  name: string;
  subtitle: string;
  description: string;
  subjects: number;
  statsLabel: string;
  colors: readonly [string, string];
  accent: string;
  icon: LucideIcon;
}

export interface SubjectMeta {
  key: BookSubjectKey;
  name: string;
  shortName: string;
  description: string;
  badge: string;
  colors: readonly [string, string];
  color: string;
  soft: string;
  icon: LucideIcon;
}

export const GRADE_OPTIONS: GradeMeta[] = [
  {
    key: 'hummingbird',
    name: 'Hummingbird',
    subtitle: 'Early years',
    description: 'Picture-first books for first readers and curious listeners.',
    subjects: 4,
    statsLabel: 'Story-led foundations',
    colors: ['#10B981', '#34D399'],
    accent: '#0F766E',
    icon: Feather,
  },
  {
    key: 'dove',
    name: 'Dove',
    subtitle: 'Growing confidence',
    description: 'Daily reading, numeracy and science practice with guided media.',
    subjects: 4,
    statsLabel: 'Balanced core learning',
    colors: ['#2563EB', '#60A5FA'],
    accent: '#1D4ED8',
    icon: Bird,
  },
  {
    key: 'macaw',
    name: 'Macaw',
    subtitle: 'Independent explorers',
    description: 'Deeper concepts, richer visuals and topic-based video support.',
    subjects: 4,
    statsLabel: 'Advanced learning journeys',
    colors: ['#F59E0B', '#FBBF24'],
    accent: '#B45309',
    icon: Sparkles,
  },
];

export const SUBJECT_OPTIONS: SubjectMeta[] = [
  {
    key: 'literacy',
    name: 'Literacy Readers',
    shortName: 'Literacy',
    description: 'Read, write and spell through guided readers and picture prompts.',
    badge: 'Readers + writing',
    colors: ['#FB7185', '#F43F5E'],
    color: '#F43F5E',
    soft: '#FFF1F2',
    icon: BookOpen,
  },
  {
    key: 'numeracy',
    name: 'Numeracy',
    shortName: 'Numeracy',
    description: 'Counting, comparison and problem solving with visual practice.',
    badge: 'Hands-on maths',
    colors: ['#60A5FA', '#2563EB'],
    color: '#2563EB',
    soft: '#EFF6FF',
    icon: Hash,
  },
  {
    key: 'science',
    name: 'Science',
    shortName: 'Science',
    description: 'Observe, question and explore with concept videos and worksheets.',
    badge: 'Explore concepts',
    colors: ['#34D399', '#10B981'],
    color: '#10B981',
    soft: '#ECFDF5',
    icon: FlaskConical,
  },
  {
    key: 'rhymes',
    name: 'Rhymes & Stories',
    shortName: 'Rhymes',
    description: 'Songs, stories and speaking prompts for expressive learning.',
    badge: 'Voice + imagination',
    colors: ['#FDBA74', '#F59E0B'],
    color: '#F59E0B',
    soft: '#FFFBEB',
    icon: Mic,
  },
];

export const GRADE_MAP = Object.fromEntries(
  GRADE_OPTIONS.map(grade => [grade.key, grade]),
) as Record<BookGradeKey, GradeMeta>;

export const SUBJECT_MAP = Object.fromEntries(
  SUBJECT_OPTIONS.map(subject => [subject.key, subject]),
) as Record<BookSubjectKey, SubjectMeta>;

export function getGradeMeta(gradeKey: string): GradeMeta | undefined {
  return GRADE_MAP[gradeKey as BookGradeKey];
}

export function getSubjectMeta(subjectKey: string): SubjectMeta | undefined {
  return SUBJECT_MAP[subjectKey as BookSubjectKey];
}

export function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) {
    return hexColor;
  }

  const normalizedAlpha = Math.max(0, Math.min(1, alpha));
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
}
