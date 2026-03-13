export type GameCategory =
  | 'All Games'
  | 'Literacy'
  | 'Numeracy'
  | 'Science'
  | 'Rhymes and Stories';

export interface GameCatalogItem {
  id: string;
  title: string;
  category: Exclude<GameCategory, 'All Games'>;
  url: string;
  description: string;
  icon?: string;
  thumbnail?: string;
  skills?: string[];
  source: 'api' | 'fallback';
}

export const GAME_CATEGORIES: GameCategory[] = [
  'All Games',
  'Literacy',
  'Numeracy',
  'Science',
  'Rhymes and Stories',
];

export const GAME_CATEGORY_META: Record<
  Exclude<GameCategory, 'All Games'>,
  {
    chipLabel: string;
    icon: string;
    accent: string;
    accentSoft: string;
    border: string;
    text: string;
    gradient: [string, string];
  }
> = {
  Literacy: {
    chipLabel: 'Word Play',
    icon: '✍️',
    accent: '#FB4F79',
    accentSoft: '#FFF1F5',
    border: '#FBCFE8',
    text: '#9D174D',
    gradient: ['#FB4F79', '#F97316'],
  },
  Numeracy: {
    chipLabel: 'Number Lab',
    icon: '🧮',
    accent: '#389CF6',
    accentSoft: '#EEF6FF',
    border: '#BFDBFE',
    text: '#1D4ED8',
    gradient: ['#2563EB', '#06B6D4'],
  },
  Science: {
    chipLabel: 'Discovery Deck',
    icon: '🧪',
    accent: '#935CEE',
    accentSoft: '#F5F0FF',
    border: '#DDD6FE',
    text: '#6D28D9',
    gradient: ['#7C3AED', '#A855F7'],
  },
  'Rhymes and Stories': {
    chipLabel: 'Story Spark',
    icon: '🎵',
    accent: '#F9CD1A',
    accentSoft: '#FFFBE8',
    border: '#FDE68A',
    text: '#A16207',
    gradient: ['#F59E0B', '#F97316'],
  },
};

export const SCIENCE_FALLBACK_GAMES: GameCatalogItem[] = [
  {
    id: 'science-coloring-game',
    title: 'Coloring Game',
    category: 'Science',
    url: 'https://coloring-game-bad4f.web.app/',
    description: 'Color-led science discovery activity for early learners.',
    icon: '🎨',
    skills: ['Colors', 'Observation'],
    source: 'fallback',
  },
  {
    id: 'science-communication-game',
    title: 'Communication Game',
    category: 'Science',
    url: 'https://communication-game-app.web.app/',
    description: 'Interactive play around expression, signals and basic communication.',
    icon: '🎈',
    skills: ['Communication', 'Listening'],
    source: 'fallback',
  },
  {
    id: 'science-counting-seeds',
    title: 'Counting Seeds',
    category: 'Science',
    url: 'https://counting-seeds.web.app/',
    description: 'Seed-counting mission that mixes nature themes with number sense.',
    icon: '🔢',
    skills: ['Counting', 'Nature'],
    source: 'fallback',
  },
  {
    id: 'science-cow-game',
    title: 'Cow Game',
    category: 'Science',
    url: 'https://cow-game-cb4e8.web.app/',
    description: 'Farm-themed science mini game focused on animal recognition.',
    icon: '🐄',
    skills: ['Animals', 'Recognition'],
    source: 'fallback',
  },
  {
    id: 'science-crab-game',
    title: 'Crab Game',
    category: 'Science',
    url: 'https://crab-game-abcdc.web.app/',
    description: 'Ocean life challenge with movement and matching play.',
    icon: '🦀',
    skills: ['Sea Life', 'Coordination'],
    source: 'fallback',
  },
  {
    id: 'science-donkey-game',
    title: 'Donkey Game',
    category: 'Science',
    url: 'https://donkey-game.web.app/',
    description: 'Animal-world activity that builds identification and recall.',
    icon: '🐴',
    skills: ['Animals', 'Recall'],
    source: 'fallback',
  },
  {
    id: 'science-flower-color',
    title: 'Flower Color',
    category: 'Science',
    url: 'https://flower-colors-5ad78.web.app/',
    description: 'Botany-inspired color matching with bright visual feedback.',
    icon: '🌸',
    skills: ['Plants', 'Colors'],
    source: 'fallback',
  },
  {
    id: 'science-food-game',
    title: 'Food Game',
    category: 'Science',
    url: 'https://food-game-f82fc.web.app/',
    description: 'Simple nutrition game with fun food sorting and recognition.',
    icon: '🍎',
    skills: ['Food', 'Sorting'],
    source: 'fallback',
  },
  {
    id: 'science-force-and-motion',
    title: 'Force And Motion',
    category: 'Science',
    url: 'https://force-motion-game.web.app',
    description: 'Hands-on mechanics play around movement, push and pull.',
    icon: '⚙️',
    skills: ['Physics', 'Motion'],
    source: 'fallback',
  },
  {
    id: 'science-fox-game',
    title: 'Fox Game',
    category: 'Science',
    url: 'https://fox-game-fde74.web.app/',
    description: 'Quick recognition game set in a playful animal habitat.',
    icon: '🦊',
    skills: ['Animals', 'Speed'],
    source: 'fallback',
  },
  {
    id: 'science-frog-game',
    title: 'Frog Game',
    category: 'Science',
    url: 'https://frog-game-apps.web.app/',
    description: 'Amphibian-themed mission with motion and pattern tracking.',
    icon: '🐸',
    skills: ['Amphibians', 'Patterns'],
    source: 'fallback',
  },
  {
    id: 'science-healthy-food',
    title: 'Healthy Food',
    category: 'Science',
    url: 'https://healthy-food-6c2d3.web.app/',
    description: 'Build healthy choices through a colourful nutrition challenge.',
    icon: '🥗',
    skills: ['Nutrition', 'Choices'],
    source: 'fallback',
  },
  {
    id: 'science-hungry-mouse',
    title: 'Hungry Mouse',
    category: 'Science',
    url: 'https://hungry-mouse.web.app/',
    description: 'Maze-like food hunt with timing and decision-making practice.',
    icon: '🐭',
    skills: ['Logic', 'Timing'],
    source: 'fallback',
  },
  {
    id: 'science-inclined-plane-game',
    title: 'Inclined Plane Game',
    category: 'Science',
    url: 'https://inclined-plane-game.web.app/',
    description: 'Simple machines concept turned into a playable challenge.',
    icon: '🛝',
    skills: ['Physics', 'Machines'],
    source: 'fallback',
  },
  {
    id: 'science-india-game',
    title: 'India Game',
    category: 'Science',
    url: 'https://india-games-kid.web.app/',
    description: 'Place-based exploration game with maps, identity and recall.',
    icon: '🗺️',
    skills: ['Places', 'Memory'],
    source: 'fallback',
  },
];
