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
  difficulty?: number;
  difficultyLevel?: string;
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
    "id": "science-coloring-game",
    "title": "Coloring Game",
    "category": "Science",
    "url": "https://coloring-game-bad4f.web.app/",
    "description": "Color-led science discovery activity for early learners.",
    "icon": "🎨",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Colors",
      "Observation"
    ],
    "source": "fallback"
  },
  {
    "id": "science-communication-game",
    "title": "Communication Game",
    "category": "Science",
    "url": "https://communication-game-app.web.app/",
    "description": "Interactive play around expression, signals and basic communication.",
    "icon": "🎈",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Communication",
      "Listening"
    ],
    "source": "fallback"
  },
  {
    "id": "science-counting-seeds",
    "title": "Counting Seeds",
    "category": "Numeracy",
    "url": "https://counting-seeds.web.app/",
    "description": "Seed-counting mission that mixes nature themes with number sense.",
    "icon": "🔢",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Counting",
      "Nature"
    ],
    "source": "fallback"
  },
  {
    "id": "science-cow-game",
    "title": "Cow Game",
    "category": "Science",
    "url": "https://cow-game-cb4e8.web.app/",
    "description": "Farm-themed science mini game focused on animal recognition.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Animals",
      "Recognition"
    ],
    "source": "fallback"
  },
  {
    "id": "science-crab-game",
    "title": "Crab Game",
    "category": "Science",
    "url": "https://crab-game-abcdc.web.app/",
    "description": "Ocean life challenge with movement and matching play.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Sea Life",
      "Coordination"
    ],
    "source": "fallback"
  },
  {
    "id": "science-donkey-game",
    "title": "Donkey Game",
    "category": "Science",
    "url": "https://donkey-game.web.app/",
    "description": "Animal-world activity that builds identification and recall.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Animals",
      "Recall"
    ],
    "source": "fallback"
  },
  {
    "id": "science-flower-color",
    "title": "Flower Color",
    "category": "Science",
    "url": "https://flower-colors-5ad78.web.app/",
    "description": "Botany-inspired color matching with bright visual feedback.",
    "icon": "🌱",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Plants",
      "Colors"
    ],
    "source": "fallback"
  },
  {
    "id": "science-food-game",
    "title": "Food Game",
    "category": "Science",
    "url": "https://food-game-f82fc.web.app/",
    "description": "Simple nutrition game with fun food sorting and recognition.",
    "icon": "🍎",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Food",
      "Sorting"
    ],
    "source": "fallback"
  },
  {
    "id": "science-force-and-motion",
    "title": "Force And Motion",
    "category": "Science",
    "url": "https://force-motion-game.web.app",
    "description": "Hands-on mechanics play around movement, push and pull.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Physics",
      "Motion"
    ],
    "source": "fallback"
  },
  {
    "id": "science-fox-game",
    "title": "Fox Game",
    "category": "Science",
    "url": "https://fox-game-fde74.web.app/",
    "description": "Quick recognition game set in a playful animal habitat.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Animals",
      "Speed"
    ],
    "source": "fallback"
  },
  {
    "id": "science-frog-game",
    "title": "Frog Game",
    "category": "Science",
    "url": "https://frog-game-apps.web.app/",
    "description": "Amphibian-themed mission with motion and pattern tracking.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Amphibians",
      "Patterns"
    ],
    "source": "fallback"
  },
  {
    "id": "science-healthy-food",
    "title": "Healthy Food",
    "category": "Science",
    "url": "https://healthy-food-6c2d3.web.app/",
    "description": "Build healthy choices through a colourful nutrition challenge.",
    "icon": "🍎",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Nutrition",
      "Choices"
    ],
    "source": "fallback"
  },
  {
    "id": "science-hungry-mouse",
    "title": "Hungry Mouse",
    "category": "Science",
    "url": "https://hungry-mouse.web.app/",
    "description": "Maze-like food hunt with timing and decision-making practice.",
    "icon": "🎯",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Logic",
      "Timing"
    ],
    "source": "fallback"
  },
  {
    "id": "science-inclined-plane-game",
    "title": "Inclined Plane Game",
    "category": "Science",
    "url": "https://inclined-plane-game.web.app/",
    "description": "Simple machines concept turned into a playable challenge.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Physics",
      "Machines"
    ],
    "source": "fallback"
  },
  {
    "id": "science-india-game",
    "title": "India Game",
    "category": "Science",
    "url": "https://india-games-kid.web.app/",
    "description": "Place-based exploration game with maps, identity and recall.",
    "icon": "🗺️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Places",
      "Memory"
    ],
    "source": "fallback"
  },
  {
    "id": "science-jelly-fish-game",
    "title": "Jelly Fish Game",
    "category": "Science",
    "url": "https://jelly-fish-game.web.app/",
    "description": "Interactive learning mission: Jelly Fish Game.",
    "icon": "🌟",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-kenya-game",
    "title": "Kenya Game",
    "category": "Science",
    "url": "https://kenya-game-app.web.app/",
    "description": "Interactive learning mission: Kenya Game.",
    "icon": "🗺️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-ladybug-game",
    "title": "Ladybug Game",
    "category": "Science",
    "url": "https://ladybug-games-app.web.app/",
    "description": "Interactive learning mission: Ladybug Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-ant-game",
    "title": "Ant Game",
    "category": "Science",
    "url": "https://ant-game-app.web.app/",
    "description": "Interactive learning mission: Ant Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-apple-game",
    "title": "Apple Game",
    "category": "Science",
    "url": "https://apple-game-play.web.app/",
    "description": "Interactive learning mission: Apple Game.",
    "icon": "🪄",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-bat-game",
    "title": "Bat Game",
    "category": "Science",
    "url": "https://bat-game-app.web.app/",
    "description": "Interactive learning mission: Bat Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-bear-game",
    "title": "Bear Game",
    "category": "Science",
    "url": "https://bear-game-app.web.app/",
    "description": "Interactive learning mission: Bear Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-building-puzzle-game",
    "title": "Building Puzzle Game",
    "category": "Science",
    "url": "https://building-game-app.web.app/",
    "description": "Interactive learning mission: Building Puzzle Game.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-butterfly-game",
    "title": "Butterfly Game",
    "category": "Science",
    "url": "https://butterfly-game-apps.web.app/",
    "description": "Interactive learning mission: Butterfly Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-chicken-game",
    "title": "Chicken Game",
    "category": "Science",
    "url": "https://chicken-game-app.web.app/",
    "description": "Interactive learning mission: Chicken Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-china-game",
    "title": "China Game",
    "category": "Science",
    "url": "https://china-game-app.web.app/",
    "description": "Interactive learning mission: China Game.",
    "icon": "🗺️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-animal-match",
    "title": "Animal Match",
    "category": "Science",
    "url": "https://animal-match-48cf5.web.app/",
    "description": "Interactive learning mission: Animal Match.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-light-and-heavy-game",
    "title": "Light And Heavy Game",
    "category": "Science",
    "url": "https://light-and-heavy.web.app/",
    "description": "Interactive learning mission: Light And Heavy Game.",
    "icon": "🪄",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-lion-game",
    "title": "Lion Game",
    "category": "Science",
    "url": "https://lion-game-51441.web.app/",
    "description": "Interactive learning mission: Lion Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-magnet-game",
    "title": "Magnet Game",
    "category": "Science",
    "url": "https://magnet-game-app.web.app/",
    "description": "Interactive learning mission: Magnet Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-match-face",
    "title": "Match Face",
    "category": "Science",
    "url": "https://match-face-game.web.app/",
    "description": "Interactive learning mission: Match Face.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-match-shape",
    "title": "Match shape",
    "category": "Science",
    "url": "https://match-shapes.web.app/",
    "description": "Interactive learning mission: Match shape.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-memory-game",
    "title": "Memory Game",
    "category": "Science",
    "url": "https://memory-game-b1b36.web.app/",
    "description": "Interactive learning mission: Memory Game.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-mexico-game",
    "title": "Mexico Game",
    "category": "Science",
    "url": "https://mexico-game-app.web.app/",
    "description": "Interactive learning mission: Mexico Game.",
    "icon": "🗺️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-missing-acorns",
    "title": "Missing Acorns",
    "category": "Science",
    "url": "https://missing-acorns.web.app/",
    "description": "Interactive learning mission: Missing Acorns.",
    "icon": "🎲",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-my-skeleton-game",
    "title": "My Skeleton Game",
    "category": "Science",
    "url": "https://my-skeleton-game.web.app/",
    "description": "Interactive learning mission: My Skeleton Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-my-5-senses",
    "title": "My 5 Senses",
    "category": "Science",
    "url": "https://my5-sense-game.web.app/",
    "description": "Interactive learning mission: My 5 Senses.",
    "icon": "🔢",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-natrual-resources-game",
    "title": "Natrual resources game",
    "category": "Science",
    "url": "https://natural-resources-game.web.app/",
    "description": "Interactive learning mission: Natrual resources game.",
    "icon": "🧠",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-odd-one-out",
    "title": "Odd One Out",
    "category": "Science",
    "url": "https://odd-one-out-6eaed.web.app/",
    "description": "Interactive learning mission: Odd One Out.",
    "icon": "🎉",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-pet-fish-game",
    "title": "Pet Fish Game",
    "category": "Science",
    "url": "https://pet-fish-game.web.app/",
    "description": "Interactive learning mission: Pet Fish Game.",
    "icon": "🚀",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-pumpkin-game",
    "title": "Pumpkin Game",
    "category": "Science",
    "url": "https://pumkin-games-app.web.app/",
    "description": "Interactive learning mission: Pumpkin Game.",
    "icon": "🎉",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-puzzle-fun",
    "title": "Puzzle Fun",
    "category": "Science",
    "url": "https://puzzle-fun-fe18e.web.app/",
    "description": "Interactive learning mission: Puzzle Fun.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-recreation-game",
    "title": "Recreation Game",
    "category": "Science",
    "url": "https://recreation-game-app.web.app/",
    "description": "Interactive learning mission: Recreation Game.",
    "icon": "🌟",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-robin-game",
    "title": "Robin Game",
    "category": "Science",
    "url": "https://robin-game-app.web.app/",
    "description": "Interactive learning mission: Robin Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-rocks-game",
    "title": "Rocks Game",
    "category": "Science",
    "url": "https://rocks-game-20dcf.web.app/",
    "description": "Interactive learning mission: Rocks Game.",
    "icon": "🎲",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-shark-game",
    "title": "Shark Game",
    "category": "Science",
    "url": "https://shark-game-6e1e2.web.app/",
    "description": "Interactive learning mission: Shark Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-snow-and-ice",
    "title": "Snow And Ice",
    "category": "Science",
    "url": "https://shdow-ice-game.web.app/",
    "description": "Interactive learning mission: Snow And Ice.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-shell-puzzle-game",
    "title": "Shell Puzzle Game",
    "category": "Science",
    "url": "https://shell-puzzle-game.web.app/",
    "description": "Interactive learning mission: Shell Puzzle Game.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-simple-machine-game",
    "title": "Simple Machine Game",
    "category": "Science",
    "url": "https://simple-machines-game.web.app/",
    "description": "Interactive learning mission: Simple Machine Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-big-and-small-game",
    "title": "Big And Small Game",
    "category": "Science",
    "url": "https://small-and-big-game.web.app/",
    "description": "Interactive learning mission: Big And Small Game.",
    "icon": "🚀",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-sort-the-trash",
    "title": "Sort The Trash",
    "category": "Science",
    "url": "https://sort-the-trash.web.app/",
    "description": "Interactive learning mission: Sort The Trash.",
    "icon": "🌟",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-squirrel-game",
    "title": "Squirrel Game",
    "category": "Science",
    "url": "https://squirrel-game-5.web.app/",
    "description": "Interactive learning mission: Squirrel Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-statue-of-liberty-game",
    "title": "statue of liberty game",
    "category": "Science",
    "url": "https://stauteofliberty-game-app.web.app/",
    "description": "Interactive learning mission: statue of liberty game.",
    "icon": "🗺️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-tiger-game",
    "title": "Tiger Game",
    "category": "Science",
    "url": "https://tiger-game-aa3e1.web.app/",
    "description": "Interactive learning mission: Tiger Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-tooth-game",
    "title": "Tooth Game",
    "category": "Science",
    "url": "https://tooth-gam-app.web.app/",
    "description": "Interactive learning mission: Tooth Game.",
    "icon": "🎉",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-transportaion-game",
    "title": "Transportaion Game",
    "category": "Science",
    "url": "https://transportaion-game-app.web.app/",
    "description": "Interactive learning mission: Transportaion Game.",
    "icon": "🚀",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-tree-game",
    "title": "Tree game",
    "category": "Science",
    "url": "https://tree-game-app.web.app/",
    "description": "Interactive learning mission: Tree game.",
    "icon": "🌱",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-weather-game",
    "title": "Weather Game",
    "category": "Science",
    "url": "https://weather-game-55053.web.app/",
    "description": "Interactive learning mission: Weather Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-what-is-that-fruit",
    "title": "What Is That Fruit",
    "category": "Science",
    "url": "https://what-is-that-fruit.web.app/",
    "description": "Interactive learning mission: What Is That Fruit.",
    "icon": "🍎",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-what-is-that-vegetable",
    "title": "What Is That Vegetable",
    "category": "Science",
    "url": "https://what-is-that-vegetable.web.app/",
    "description": "Interactive learning mission: What Is That Vegetable.",
    "icon": "🍎",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-what-is-a-holiday",
    "title": "what is a holiday",
    "category": "Science",
    "url": "https://whatisaholiday.web.app/",
    "description": "Interactive learning mission: what is a holiday.",
    "icon": "🎲",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-sink-or-float",
    "title": "Sink Or Float",
    "category": "Science",
    "url": "https://sink-or-float.web.app/",
    "description": "Interactive learning mission: Sink Or Float.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-calendar-game",
    "title": "Calendar Game",
    "category": "Science",
    "url": "https://calendar-game-f6cac.web.app/",
    "description": "Interactive learning mission: Calendar Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-color-switch",
    "title": "Color Switch",
    "category": "Science",
    "url": "https://color-switch-f0dfe.web.app/",
    "description": "Interactive learning mission: Color Switch.",
    "icon": "🎨",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-computer-game",
    "title": "Computer Game",
    "category": "Science",
    "url": "https://computer-game-89893.web.app/",
    "description": "Interactive learning mission: Computer Game.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-physics-ball",
    "title": "Physics Ball",
    "category": "Science",
    "url": "https://physics-ball.web.app/",
    "description": "Interactive learning mission: Physics Ball.",
    "icon": "⚙️",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-critsmas-tree",
    "title": "Critsmas Tree",
    "category": "Science",
    "url": "https://christmas-tree-game.web.app/",
    "description": "Interactive learning mission: Critsmas Tree.",
    "icon": "🌱",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-identify-activities",
    "title": "Identify Activities",
    "category": "Science",
    "url": "https://identify-activities.web.app/",
    "description": "Interactive learning mission: Identify Activities.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-unicorn-puzzle",
    "title": "Unicorn Puzzle",
    "category": "Science",
    "url": "https://unicorn-puzzle.web.app/",
    "description": "Interactive learning mission: Unicorn Puzzle.",
    "icon": "🧩",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-alpaca-game",
    "title": "Alpaca game",
    "category": "Science",
    "url": "https://alpaca-game.web.app/",
    "description": "Interactive learning mission: Alpaca game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-badger-game",
    "title": "Badger Game",
    "category": "Science",
    "url": "https://badger-game.web.app/",
    "description": "Interactive learning mission: Badger Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-armadillo-game",
    "title": "Armadillo Game",
    "category": "Science",
    "url": "https://armadillo-game.web.app/",
    "description": "Interactive learning mission: Armadillo Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-badicoot-game",
    "title": "Badicoot Game",
    "category": "Science",
    "url": "https://bandicoot-game.web.app/",
    "description": "Interactive learning mission: Badicoot Game.",
    "icon": "✨",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-beaver-game",
    "title": "Beaver Game",
    "category": "Science",
    "url": "https://beaver-game.web.app/",
    "description": "Interactive learning mission: Beaver Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-bison-game",
    "title": "Bison Game",
    "category": "Science",
    "url": "https://bison-game.web.app/",
    "description": "Interactive learning mission: Bison Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-buffalo-game",
    "title": "Buffalo Game",
    "category": "Science",
    "url": "https://buffalo-game-e65f7.web.app",
    "description": "Interactive learning mission: Buffalo Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-camel-game",
    "title": "Camel Game",
    "category": "Science",
    "url": "https://camel-game.web.app",
    "description": "Interactive learning mission: Camel Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-cheetah-game",
    "title": "Cheetah Game",
    "category": "Science",
    "url": "https://cheetah-game-b3189.web.app",
    "description": "Interactive learning mission: Cheetah Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-deer-game",
    "title": "Deer Game",
    "category": "Science",
    "url": "https://deer-game.web.app",
    "description": "Interactive learning mission: Deer Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-giraffe-game",
    "title": "Giraffe Game",
    "category": "Science",
    "url": "https://giraffe-game-ce6df.web.app",
    "description": "Interactive learning mission: Giraffe Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-elephant-game",
    "title": "Elephant Game",
    "category": "Science",
    "url": "https://elephant-game.web.app",
    "description": "Interactive learning mission: Elephant Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-gorilla-game",
    "title": "Gorilla Game",
    "category": "Science",
    "url": "https://gorilla-game-134a6.web.app",
    "description": "Interactive learning mission: Gorilla Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-heyna-game",
    "title": "Heyna Game",
    "category": "Science",
    "url": "https://heyna-game.web.app",
    "description": "Interactive learning mission: Heyna Game.",
    "icon": "🧠",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-impala-game",
    "title": "Impala Game",
    "category": "Science",
    "url": "https://impala-game.web.app",
    "description": "Interactive learning mission: Impala Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-kangaroo-game",
    "title": "Kangaroo Game",
    "category": "Science",
    "url": "https://kangaroo-game-ddc6a.web.app/",
    "description": "Interactive learning mission: Kangaroo Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-puma-game",
    "title": "Puma Game",
    "category": "Science",
    "url": "https://puma-game.web.app",
    "description": "Interactive learning mission: Puma Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-koala-game",
    "title": "Koala Game",
    "category": "Science",
    "url": "https://koala-a6cd5.web.app",
    "description": "Interactive learning mission: Koala Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-monkey-game",
    "title": "Monkey Game",
    "category": "Science",
    "url": "https://monkey-game-787dc.web.app",
    "description": "Interactive learning mission: Monkey Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-mustang-game",
    "title": "Mustang Game",
    "category": "Science",
    "url": "https://mustang-game.web.app",
    "description": "Interactive learning mission: Mustang Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-platypus-game",
    "title": "Platypus Game",
    "category": "Science",
    "url": "https://platypus-game.web.app",
    "description": "Interactive learning mission: Platypus Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-muskox-game",
    "title": "Muskox Game",
    "category": "Science",
    "url": "https://muskox-game.web.app",
    "description": "Interactive learning mission: Muskox Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-pangolin-game",
    "title": "Pangolin Game",
    "category": "Science",
    "url": "https://pangolin-game.web.app",
    "description": "Interactive learning mission: Pangolin Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-moose-game",
    "title": "Moose Game",
    "category": "Science",
    "url": "https://moose-game.web.app",
    "description": "Interactive learning mission: Moose Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-mongoose-game",
    "title": "Mongoose Game",
    "category": "Science",
    "url": "https://mongoose-game.web.app",
    "description": "Interactive learning mission: Mongoose Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-mole-game",
    "title": "Mole Game",
    "category": "Science",
    "url": "https://mole-game-c8b1d.web.app",
    "description": "Interactive learning mission: Mole Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-martin-game",
    "title": "Martin Game",
    "category": "Science",
    "url": "https://marten-game.web.app",
    "description": "Interactive learning mission: Martin Game.",
    "icon": "🪄",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-lemur-game",
    "title": "Lemur Game",
    "category": "Science",
    "url": "https://lemur-game.web.app",
    "description": "Interactive learning mission: Lemur Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-fox-game-2",
    "title": "Fox Game 2",
    "category": "Science",
    "url": "https://fox-game-fdfc7.web.app",
    "description": "Interactive learning mission: Fox Game 2.",
    "icon": "🔢",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-zebra-game",
    "title": "Zebra Game",
    "category": "Science",
    "url": "https://zebra-game-736af.web.app/",
    "description": "Interactive learning mission: Zebra Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-yak-game",
    "title": "Yak Game",
    "category": "Science",
    "url": "https://yak-game.web.app",
    "description": "Interactive learning mission: Yak Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-wombat-game",
    "title": "Wombat Game",
    "category": "Science",
    "url": "https://wombat-game.web.app",
    "description": "Interactive learning mission: Wombat Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-tarsier-game",
    "title": "Tarsier Game",
    "category": "Science",
    "url": "https://tarsier-game.web.app/",
    "description": "Interactive learning mission: Tarsier Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-warthog-game",
    "title": "Warthog Game",
    "category": "Science",
    "url": "https://warthog-game.web.app",
    "description": "Interactive learning mission: Warthog Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-tapir-game",
    "title": "Tapir Game",
    "category": "Science",
    "url": "https://tapir-game.web.app",
    "description": "Interactive learning mission: Tapir Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-skunk-game",
    "title": "Skunk Game",
    "category": "Science",
    "url": "https://skunk-game.web.app",
    "description": "Interactive learning mission: Skunk Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-rabbit-game",
    "title": "Rabbit Game",
    "category": "Science",
    "url": "https://rabbit-game-97745.web.app",
    "description": "Interactive learning mission: Rabbit Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-quail-game",
    "title": "Quail Game",
    "category": "Science",
    "url": "https://quail-game.web.app",
    "description": "Interactive learning mission: Quail Game.",
    "icon": "🐾",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  },
  {
    "id": "science-viscacha-game",
    "title": "Viscacha Game",
    "category": "Science",
    "url": "https://viscacha-2fa26.web.app/",
    "description": "Interactive learning mission: Viscacha Game.",
    "icon": "🪄",
    "thumbnail": "https://img.freepik.com/free-vector/physics-science-concept-with-pendulum_1308-39322.jpg",
    "skills": [
      "Science",
      "Discovery"
    ],
    "source": "fallback"
  }
];