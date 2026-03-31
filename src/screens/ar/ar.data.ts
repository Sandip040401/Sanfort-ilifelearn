import type {ARFolder, ARModel} from '@/types';

export type AREnvironmentKey =
  | 'Phonics'
  | 'Numbers'
  | 'Stories'
  | 'My Body'
  | 'Underwater'
  | 'Wild Animals'
  | 'Farm Animals'
  | 'Fruits and Vegetables'
  | 'Amphibians'
  | 'Transport'
  | 'Space'
  | 'Extinct Animal';

export interface AREnvironmentView extends ARFolder {
  canonicalName: AREnvironmentKey | string;
  badge: string;
  colors: [string, string];
  accent: string;
  accentSoft: string;
  emoji: string;
  description: string;
  isSynthetic?: boolean;
  matchMode?: 'canonical' | 'all';
}

const ENVIRONMENT_ORDER: AREnvironmentKey[] = [
  'Phonics',
  'Numbers',
  'Stories',
  'My Body',
  'Underwater',
  'Wild Animals',
  'Farm Animals',
  'Fruits and Vegetables',
  'Amphibians',
  'Transport',
  'Space',
  'Extinct Animal',
];

const ENVIRONMENT_RANK = ENVIRONMENT_ORDER.reduce<Record<string, number>>(
  (acc, key, index) => {
    acc[key] = index;
    return acc;
  },
  {},
);

const ENVIRONMENT_META: Record<
  AREnvironmentKey,
  {
    name: string;
    description: string;
    badge: string;
    emoji: string;
    colors: [string, string];
    accent: string;
    accentSoft: string;
  }
> = {
  Phonics: {
    name: 'Phonics Fun',
    description: 'Learn sounds and letters with playful, speak-along 3D models.',
    badge: 'Sound Lab',
    emoji: '🔤',
    colors: ['#FB4F79', '#F97316'],
    accent: '#FB4F79',
    accentSoft: '#FFF1F5',
  },
  Numbers: {
    name: 'Numbers',
    description: 'Count, compare and discover number concepts in AR space.',
    badge: 'Count Zone',
    emoji: '🔢',
    colors: ['#2563EB', '#06B6D4'],
    accent: '#2563EB',
    accentSoft: '#EEF6FF',
  },
  Stories: {
    name: 'Stories',
    description: 'Bring narrative characters and story scenes into your room.',
    badge: 'Story Studio',
    emoji: '📚',
    colors: ['#9333EA', '#C084FC'],
    accent: '#9333EA',
    accentSoft: '#F6F0FF',
  },
  'My Body': {
    name: 'My Body',
    description: 'Explore human body parts and anatomy with tactile AR learning.',
    badge: 'Body Lab',
    emoji: '🧍',
    colors: ['#A855F7', '#EC4899'],
    accent: '#A855F7',
    accentSoft: '#F7EDFF',
  },
  Underwater: {
    name: 'Underwater World',
    description: 'Dive into sea life, habitats and aquatic creatures.',
    badge: 'Ocean Deck',
    emoji: '🐠',
    colors: ['#0EA5A4', '#0EA5E9'],
    accent: '#0EA5A4',
    accentSoft: '#ECFEFF',
  },
  'Wild Animals': {
    name: 'Wild Animals',
    description: 'Meet predators, jungle stars and safari creatures in AR.',
    badge: 'Wild Zone',
    emoji: '🦁',
    colors: ['#F59E0B', '#FB7185'],
    accent: '#F59E0B',
    accentSoft: '#FFF7E6',
  },
  'Farm Animals': {
    name: 'Farm Animals',
    description: 'Learn everyday animals from the farm with sound and motion.',
    badge: 'Farm Yard',
    emoji: '🐄',
    colors: ['#14B8A6', '#22C55E'],
    accent: '#14B8A6',
    accentSoft: '#ECFDF5',
  },
  'Fruits and Vegetables': {
    name: 'Fruits & Vegetables',
    description: 'Healthy, colourful food items ready for close-up AR discovery.',
    badge: 'Fresh Basket',
    emoji: '🍎',
    colors: ['#22C55E', '#F59E0B'],
    accent: '#22C55E',
    accentSoft: '#ECFDF5',
  },
  Amphibians: {
    name: 'Amphibians',
    description: 'Observe frogs, salamanders and other amphibians up close.',
    badge: 'Wetland Lab',
    emoji: '🐸',
    colors: ['#10B981', '#0F766E'],
    accent: '#10B981',
    accentSoft: '#ECFDF5',
  },
  Transport: {
    name: 'Transportation',
    description: 'Cars, planes and moving machines placed into real surfaces.',
    badge: 'Move Deck',
    emoji: '🚗',
    colors: ['#8B5CF6', '#3B82F6'],
    accent: '#8B5CF6',
    accentSoft: '#F5F3FF',
  },
  Space: {
    name: 'Space Adventure',
    description: 'Launch planets, rockets and explorers into your surroundings.',
    badge: 'Orbit Lab',
    emoji: '🚀',
    colors: ['#312E81', '#7C3AED'],
    accent: '#7C3AED',
    accentSoft: '#F5F3FF',
  },
  'Extinct Animal': {
    name: 'Extinct Animals',
    description: 'Travel back in time with dinosaurs and creatures from the past.',
    badge: 'Time Vault',
    emoji: '🦕',
    colors: ['#EF4444', '#F97316'],
    accent: '#EF4444',
    accentSoft: '#FEF2F2',
  },
};

const LANGUAGE_ORDER = [
  'English (India)', 'English (US)', 'English (UK)',
  'Hindi', 'Marathi', 'Malayalam', 'Punjabi',
  'Guajarati', 'Telegu', 'Kannada', 'Tamil', 'Odia', 'Bengali',
];
const DIFFICULTY_ORDER = ['basic', 'intermediate', 'advance', 'advanced'];
const FALLBACK_LIBRARY_ID = 'synthetic-model-library';

function normalizeLooseText(raw: string) {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function slugify(raw: string) {
  return normalizeLooseText(raw).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function normalizeEnvironmentName(raw: string) {
  const value = normalizeLooseText(raw);
  if (value === 'phonics' || value === 'phonics fun') {return 'Phonics';}
  if (value === 'numbers') {return 'Numbers';}
  if (value === 'stories') {return 'Stories';}
  if (value === 'my body') {return 'My Body';}
  if (value === 'underwater' || value === 'underwater world') {return 'Underwater';}
  if (value === 'wild animals') {return 'Wild Animals';}
  if (value === 'farm animals') {return 'Farm Animals';}
  if (value === 'fruits and vegetables' || value === 'fruits & vegetables') {return 'Fruits and Vegetables';}
  if (value === 'amphibians') {return 'Amphibians';}
  if (value === 'transport' || value === 'transportation') {return 'Transport';}
  if (value === 'space' || value === 'space adventure') {return 'Space';}
  if (value === 'extinct animal' || value === 'extinct animals') {return 'Extinct Animal';}
  return raw;
}

function inferEnvironmentFromValue(raw: string) {
  const value = normalizeLooseText(raw);
  if (!value) {
    return null;
  }

  const canonical = normalizeEnvironmentName(value);
  if (canonical !== value || ENVIRONMENT_META[canonical as AREnvironmentKey]) {
    return canonical;
  }

  if (value.includes('phonic') || value.includes('alphabet') || value.includes('letter')) {return 'Phonics';}
  if (value.includes('number') || value.includes('count') || value.includes('math')) {return 'Numbers';}
  if (value.includes('story') || value.includes('rhyme') || value.includes('poem')) {return 'Stories';}
  if (value.includes('body') || value.includes('anatom')) {return 'My Body';}
  if (value.includes('underwater') || value.includes('ocean') || value.includes('sea') || value.includes('fish')) {return 'Underwater';}
  if (value.includes('wild') || value.includes('jungle') || value.includes('safari')) {return 'Wild Animals';}
  if (value.includes('farm')) {return 'Farm Animals';}
  if (value.includes('fruit') || value.includes('vegetable') || value.includes('food')) {return 'Fruits and Vegetables';}
  if (value.includes('amphib')) {return 'Amphibians';}
  if (
    value.includes('transport') ||
    value.includes('vehicle') ||
    value.includes('car') ||
    value.includes('plane') ||
    value.includes('train')
  ) {return 'Transport';}
  if (
    value.includes('space') ||
    value.includes('planet') ||
    value.includes('rocket') ||
    value.includes('astronaut')
  ) {return 'Space';}
  if (value.includes('extinct') || value.includes('dino') || value.includes('prehistoric')) {return 'Extinct Animal';}

  return null;
}

function getModelCandidateValues(model: ARModel) {
  const rawModel = model as unknown as Record<string, unknown>;
  const values = new Set<string>();

  const pushValue = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      values.add(value);
    }
    if (Array.isArray(value)) {
      value.forEach(pushValue);
    }
  };

  pushValue(model.name);
  pushValue(model.tags);
  pushValue(rawModel.category);
  pushValue(rawModel.subCategory);
  pushValue(rawModel.subcategory);
  pushValue(rawModel.environment);
  pushValue(rawModel.folderName);
  pushValue(rawModel.folder);
  pushValue(rawModel.topic);
  pushValue(rawModel.subject);
  pushValue(rawModel.keyword);
  pushValue(rawModel.keywords);

  return [...values];
}

export function getModelEnvironmentKeys(model: ARModel) {
  const resolved = new Set<string>();

  getModelCandidateValues(model).forEach(value => {
    const match = inferEnvironmentFromValue(value);
    if (match) {
      resolved.add(match);
    }
  });

  return [...resolved];
}

function createEnvironmentView(
  canonicalName: string,
  folder?: ARFolder,
  overrides?: Partial<AREnvironmentView>,
): AREnvironmentView {
  const meta = ENVIRONMENT_META[canonicalName as AREnvironmentKey];

  return {
    _id: folder?._id || `synthetic-${slugify(canonicalName)}`,
    folderName: folder?.folderName || canonicalName,
    createdAt: folder?.createdAt,
    updatedAt: folder?.updatedAt,
    imgURL: folder?.imgURL || folder?.icon,
    gradient: folder?.gradient,
    ...folder,
    name: overrides?.name || meta?.name || canonicalName,
    canonicalName,
    description:
      overrides?.description ||
      meta?.description ||
      folder?.description ||
      `Explore 3D models from ${canonicalName}.`,
    badge: overrides?.badge || meta?.badge || 'AR World',
    emoji: overrides?.emoji || meta?.emoji || '📦',
    colors: overrides?.colors || meta?.colors || ['#6C4CFF', '#A855F7'],
    accent: overrides?.accent || meta?.accent || '#6C4CFF',
    accentSoft: overrides?.accentSoft || meta?.accentSoft || '#F3F0FF',
    isSynthetic: overrides?.isSynthetic ?? !folder,
    matchMode: overrides?.matchMode || 'canonical',
  };
}

export function getFallbackLibraryEnvironment(): AREnvironmentView {
  return createEnvironmentView('Model Library', undefined, {
    _id: FALLBACK_LIBRARY_ID,
    folderName: 'Model Library',
    name: 'Model Library',
    description:
      'Your models are ready. Browse the full 3D library while category metadata syncs in the background.',
    badge: 'Quick Launch',
    emoji: '🧊',
    colors: ['#6C4CFF', '#0EA5E9'],
    accent: '#6C4CFF',
    accentSoft: '#F3F0FF',
    isSynthetic: true,
    matchMode: 'all',
  });
}

export function mergeEnvironmentFolders(
  folders: ARFolder[],
  models: ARModel[] = [],
): AREnvironmentView[] {
  const mapped = new Map<string, AREnvironmentView>();

  [...folders]
    .filter(folder => folder.folderName?.trim().toLowerCase() !== 'test')
    .forEach(folder => {
      const canonicalName = normalizeEnvironmentName(
        folder.name || folder.folderName,
      );
      mapped.set(String(canonicalName), createEnvironmentView(String(canonicalName), folder));
    });

  models.forEach(model => {
    getModelEnvironmentKeys(model).forEach(canonicalName => {
      if (!mapped.has(canonicalName)) {
        mapped.set(canonicalName, createEnvironmentView(canonicalName));
      }
    });
  });

  return [...mapped.values()].sort((left, right) => {
    const leftRank = ENVIRONMENT_RANK[left.canonicalName] ?? Number.POSITIVE_INFINITY;
    const rightRank = ENVIRONMENT_RANK[right.canonicalName] ?? Number.POSITIVE_INFINITY;
    if (leftRank === rightRank) {
      return (left.name || left.folderName).localeCompare(right.name || right.folderName);
    }
    return leftRank - rightRank;
  });
}

export function doesModelMatchEnvironment(model: ARModel, environment: AREnvironmentView | null) {
  if (!environment) {
    return false;
  }
  if (environment.matchMode === 'all') {
    return true;
  }

  if (model.folder && model.folder === environment._id) {
    return true;
  }

  const modelEnvironmentKeys = getModelEnvironmentKeys(model);
  if (modelEnvironmentKeys.some(key => key === environment.canonicalName)) {
    return true;
  }
  if (!model.tags?.length) {
    return false;
  }

  const envName = (environment.name || environment.folderName).toLowerCase().trim();

  return model.tags.some(tag => {
    const normalizedTag = tag.toLowerCase().trim();

    if (normalizedTag === envName) {return true;}
    if (normalizedTag === 'wild animals' && envName.includes('wild animals')) {return true;}
    if (normalizedTag === 'farm animals' && envName.includes('farm animals')) {return true;}
    if (normalizedTag === 'extinct animals' && envName.includes('extinct animals')) {return true;}
    if (normalizedTag === 'fruits & vegetables' && envName.includes('fruit') && envName.includes('vegetable')) {return true;}
    if (normalizedTag === 'transportation' && envName.includes('transport')) {return true;}
    if (normalizedTag === 'space adventure' && envName.includes('space')) {return true;}
    if (normalizedTag === 'underwater world' && envName.includes('underwater')) {return true;}
    if (normalizedTag === 'phonics fun' && envName.includes('phonics')) {return true;}
    if (normalizedTag === 'amphibians' && envName.includes('amphibian')) {return true;}
    if (normalizedTag === 'my body' && envName.includes('body')) {return true;}
    if (normalizedTag === 'numbers' && envName.includes('number')) {return true;}

    return false;
  });
}

export function getModelsForEnvironment(
  environment: AREnvironmentView | null,
  models: ARModel[],
) {
  if (!environment) {
    return [];
  }

  return models.filter(model => doesModelMatchEnvironment(model, environment));
}

export function getBrowsableEnvironments(
  folders: ARFolder[],
  models: ARModel[],
) {
  const environments = mergeEnvironmentFolders(folders, models);
  const withAssets = environments.filter(environment =>
    getModelsForEnvironment(environment, models).length > 0,
  );

  if (withAssets.length > 0) {
    return withAssets;
  }

  return models.length > 0 ? [getFallbackLibraryEnvironment()] : [];
}

export function sortStringsByReference(items: string[], referenceOrder: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = referenceOrder.findIndex(item =>
      item.toLowerCase() === left.toLowerCase(),
    );
    const rightIndex = referenceOrder.findIndex(item =>
      item.toLowerCase() === right.toLowerCase(),
    );

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

export function sortLanguages(items: string[]) {
  return sortStringsByReference(items, LANGUAGE_ORDER);
}

export function sortLevels(items: string[]) {
  return sortStringsByReference(items, DIFFICULTY_ORDER);
}

export function getModelStableId(model: ARModel, fallbackIndex = 0) {
  return String(model.id || model._id || `ar-model-${fallbackIndex}`);
}

const LEVEL_MAP: Record<string, number> = {
  basic: 1,
  beginner: 1,
  intermediate: 2,
  medium: 2,
  advanced: 3,
  hard: 3,
};

export function getModelLevel(model: ARModel) {
  const raw = model.level || model.difficulty;
  if (typeof raw === 'string') {
    return LEVEL_MAP[raw.toLowerCase()] || 1;
  }
  return Number(raw) || 1;
}

export function getLevelStars(level: number) {
  return '⭐'.repeat(level);
}
