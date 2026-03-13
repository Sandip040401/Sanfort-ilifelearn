function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function getYouTubeVideoId(url: string): string | null {
  const parsedUrl = tryParseUrl(url);

  if (!parsedUrl) {
    return null;
  }

  const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = parsedUrl.pathname.replace(/^\/+/, '').split('/')[0];
    return id || null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const videoId = parsedUrl.searchParams.get('v');
    if (videoId) {
      return videoId;
    }

    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'embed' || pathParts[0] === 'shorts') {
      return pathParts[1] || null;
    }
  }

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return getYouTubeVideoId(url) !== null;
}

export function getYouTubeThumbnailUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`
    : null;
}
