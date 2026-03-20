import {Platform} from 'react-native';
import {ARService} from '@/services';
import {API_BASE_URL} from '@/config';
import type {ARModel} from '@/types';

const REFERENCE_IMAGE_ASSETS_BY_MODEL: Record<string, string> = {
  bear: 'reference_bear_page.jpg',
};

export function normalizeReferenceSource(value: string) {
  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('file://') ||
    value.startsWith('/')
  ) {
    return value;
  }
  if (value.includes('/')) {
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
    return `${base}${value.replace(/^\/+/, '')}`;
  }
  return value;
}

export function resolvePreviewReference(model: ARModel, value: string) {
  const raw = value.trim();
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('file://')) {
    return raw;
  }
  const modelId = model._id || model.id;
  return modelId ? ARService.getPreviewImageUrl(modelId) : normalizeReferenceSource(raw);
}

export function normalizeReferenceForDisplay(value: string) {
  const normalized = normalizeReferenceSource(value);
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('file://')
  ) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `file://${normalized}`;
  }
  return Platform.OS === 'android'
    ? `file:///android_asset/${normalized}`
    : normalized;
}

export function getReferenceImageSource(model?: ARModel | null) {
  if (!model) return null;
  const previewValue = (model as any).preview_image || model.previewImage;
  if (previewValue) {
    return resolvePreviewReference(model, String(previewValue));
  }
  const rawReference =
    (model as any).referenceImageUrl ||
    (model as any).referenceUrl ||
    (model as any).referenceImage ||
    (model as any).reference_image ||
    (model as any).targetImageUrl ||
    (model as any).targetImage ||
    (model as any).sheetImage ||
    (model as any).sheetUrl ||
    (model as any).arSheet ||
    (model as any).arSheetUrl ||
    (model as any).coloringPage ||
    (model as any).coloringPageUrl ||
    (model as any).colorSheet ||
    (model as any).colorSheetUrl ||
    (model as any).reference;
  if (rawReference) {
    return normalizeReferenceSource(String(rawReference));
  }

  const key = (model.name || model.id || model._id || '').toString().trim().toLowerCase();
  if (key && REFERENCE_IMAGE_ASSETS_BY_MODEL[key]) {
    return REFERENCE_IMAGE_ASSETS_BY_MODEL[key];
  }
  return null;
}
