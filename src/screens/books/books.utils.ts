import type {
  BookConcept,
  BookTopic,
  ConceptsResponse,
  Ebook,
  EbookPage,
  EbookVolume,
  FlatTopic,
  VideoTopic,
  VideoVolume,
} from '@/types';

type NormalizationContext = {
  gradeKey: string;
  gradeName: string;
  subjectKey: string;
  subjectName: string;
  subjectColor: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function ensureString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function ensureNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeTopic(rawTopic: unknown, index: number): BookTopic {
  const topic = isObject(rawTopic) ? rawTopic : {};

  return {
    id: ensureString(topic.id ?? topic._id, `topic-${index + 1}`),
    title: ensureString(topic.title ?? topic.name, `Topic ${index + 1}`),
    keyword: ensureString(topic.keyword ?? topic.tag),
    images: uniqueStrings(ensureStringArray(topic.images)),
    videos: uniqueStrings(ensureStringArray(topic.videos)),
    arSheets: uniqueStrings(
      ensureStringArray(topic.arSheets).concat(ensureStringArray(topic.worksheets)),
    ),
  };
}

function normalizeConcept(rawConcept: unknown, index: number): BookConcept {
  const concept = isObject(rawConcept) ? rawConcept : {};

  return {
    id: ensureString(concept.id ?? concept._id, `concept-${index + 1}`),
    title: ensureString(concept.title ?? concept.name, `Concept ${index + 1}`),
    volumeNumber: ensureNumber(concept.volumeNumber, index + 1),
    topics: ensureArray(concept.topics).map((topic, topicIndex) =>
      normalizeTopic(topic, topicIndex),
    ),
  };
}

function normalizePage(rawPage: unknown, index: number): EbookPage {
  const page = isObject(rawPage) ? rawPage : {};
  const content = isObject(page.content) ? page.content : {};
  const lastSavedContent = isObject(page.lastSavedContent) ? page.lastSavedContent : {};
  const type =
    page.type === 'imageVideo' || page.type === 'writeImage'
      ? page.type
      : 'imageOnly';

  return {
    pageId: ensureString(page.pageId ?? page._id, `page-${index + 1}`),
    type,
    content: {
      image: ensureString(content.image),
      video: ensureString(content.video),
      position:
        content.position === 'left' || content.position === 'right'
          ? content.position
          : undefined,
    },
    lastSavedContent: {
      image: ensureString(lastSavedContent.image),
      video: ensureString(lastSavedContent.video),
      position:
        lastSavedContent.position === 'left' || lastSavedContent.position === 'right'
          ? lastSavedContent.position
          : undefined,
    },
  };
}

function normalizeVolume(rawVolume: unknown, index: number): EbookVolume {
  const volume = isObject(rawVolume) ? rawVolume : {};

  return {
    id: ensureString(volume.id ?? volume._id, `volume-${index + 1}`),
    title: ensureString(volume.title ?? volume.name, `Volume ${index + 1}`),
    pages: ensureArray(volume.pages).map((page, pageIndex) =>
      normalizePage(page, pageIndex),
    ),
    pdfUrl: ensureString(volume.pdfUrl ?? volume.documentUrl ?? volume.url),
    thumbnail: ensureString(volume.thumbnail ?? volume.coverImage),
  };
}

function normalizeEbook(rawEbook: unknown, index: number, fallbackTitle: string): Ebook {
  const ebook = isObject(rawEbook) ? rawEbook : {};

  return {
    title: ensureString(ebook.title ?? ebook.name, fallbackTitle),
    volumes: ensureArray(ebook.volumes).map((volume, volumeIndex) =>
      normalizeVolume(volume, volumeIndex),
    ),
    coverUrl: ensureString(ebook.coverUrl ?? ebook.thumbnail),
  };
}

function normalizeVideoTopic(rawTopic: unknown, index: number, fallbackTitle: string): VideoTopic {
  const topic = isObject(rawTopic) ? rawTopic : {};

  return {
    id: ensureString(topic.id ?? topic._id, `video-topic-${index + 1}`),
    title: ensureString(topic.title ?? topic.name, fallbackTitle),
    videos: uniqueStrings(ensureStringArray(topic.videos)),
  };
}

function normalizeVideoVolume(rawVolume: unknown, index: number): VideoVolume {
  const volume = isObject(rawVolume) ? rawVolume : {};
  const title = ensureString(volume.title ?? volume.name, `VOL-${index + 1}`);
  const directVideos = ensureStringArray(volume.videos);
  const rawTopics = ensureArray(volume.topics);
  const topics = rawTopics.length > 0
    ? rawTopics.map((topic, topicIndex) =>
        normalizeVideoTopic(topic, topicIndex, `Lesson ${topicIndex + 1}`),
      )
    : directVideos.length > 0
      ? [{
          id: `video-topic-${index + 1}`,
          title,
          videos: uniqueStrings(directVideos),
        }]
      : [];

  return {
    id: ensureString(volume.id ?? volume._id, `video-volume-${index + 1}`),
    title,
    topics,
  };
}

export function normalizeConceptsPayload(
  rawPayload: unknown,
  context: NormalizationContext,
): ConceptsResponse {
  const payload = isObject(rawPayload) ? rawPayload : {};
  const rawEbooks = ensureArray(payload.ebooks);
  const normalizedEbooks = rawEbooks.length > 0 && rawEbooks.every(item => isObject(item) && !Array.isArray((item as Record<string, unknown>).volumes))
    ? [{
        title: `${context.subjectName} Library`,
        volumes: rawEbooks.map((volume, index) => normalizeVolume(volume, index)),
      }]
    : rawEbooks.map((ebook, index) =>
        normalizeEbook(ebook, index, `${context.subjectName} Library`),
      );

  return {
    grade: {
      id: ensureString(
        isObject(payload.grade) ? payload.grade.id ?? payload.grade._id : undefined,
        context.gradeKey,
      ),
      name: ensureString(
        isObject(payload.grade) ? payload.grade.name : payload.grade,
        context.gradeName,
      ),
    },
    subject: {
      id: ensureString(
        isObject(payload.subject) ? payload.subject.id ?? payload.subject._id : undefined,
        context.subjectKey,
      ),
      name: ensureString(
        isObject(payload.subject) ? payload.subject.name : payload.subject,
        context.subjectName,
      ),
      color: ensureString(
        isObject(payload.subject) ? payload.subject.color : undefined,
        context.subjectColor,
      ),
    },
    concepts: ensureArray(payload.concepts).map((concept, index) =>
      normalizeConcept(concept, index),
    ),
    ebooks: normalizedEbooks,
    videoVolumes: ensureArray(payload.videoVolumes).map((volume, index) =>
      normalizeVideoVolume(volume, index),
    ),
    arSheets: uniqueStrings(
      ensureStringArray(payload.arSheets).concat(ensureStringArray(payload.worksheets)),
    ),
  };
}

export function flattenTopics(
  concepts: BookConcept[],
  subjectColor: string,
  inheritedSheets: string[] = [],
): FlatTopic[] {
  return concepts.flatMap((concept, conceptIndex) =>
    concept.topics.map((topic, topicIndex) => ({
      ...topic,
      id: topic.id || `${concept.id}-topic-${topicIndex + 1}`,
      arSheets: uniqueStrings(topic.arSheets.concat(inheritedSheets)),
      conceptTitle: concept.title,
      volumeNumber: concept.volumeNumber,
      conceptIndex,
      color: subjectColor,
    })),
  );
}

export function getTopicResourceCount(topic: Pick<FlatTopic, 'images' | 'videos' | 'arSheets'>): number {
  return topic.images.length + topic.videos.length + topic.arSheets.length;
}

export function getTotalVideoCount(videoVolumes: VideoVolume[]): number {
  return videoVolumes.reduce(
    (total, volume) =>
      total + volume.topics.reduce((topicTotal, topic) => topicTotal + topic.videos.length, 0),
    0,
  );
}
