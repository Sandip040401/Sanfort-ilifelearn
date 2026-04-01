import { Platform } from 'react-native';
import { ARService } from '@/services';
import { API_BASE_URL } from '@/config';
import type { ARModel } from '@/types';

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
  const m = model as any;

  // 1. Prioritize explicit reference, coloring sheets, and the user-specified preview_image
  const raw =
    m.preview_image || // User emphasized this field as the source of truth
    m.previewImage ||
    m.coloringPage || m.coloringPageUrl ||
    m.colorSheet || m.colorSheetUrl ||
    m.targetImageUrl || m.targetImage ||
    m.sheetImage || m.sheetUrl ||
    m.arSheet || m.arSheetUrl ||
    m.referenceImageUrl || m.referenceUrl || m.referenceImage || m.reference_image || m.reference ||
    m.preview_url || m.previewUrl ||
    m.thumbnailUrl || m.thumbnail; // Icons last

  if (!raw) {
    const key = (m.name || m.id || m._id || '').toString().trim().toLowerCase();
    if (key && REFERENCE_IMAGE_ASSETS_BY_MODEL[key]) {
      return REFERENCE_IMAGE_ASSETS_BY_MODEL[key];
    }
    return null;
  }

  const value = String(raw).trim();
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file://')) {
    return value;
  }

  return resolvePreviewReference(model, value);
}

