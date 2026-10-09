/**
 * Image Fetcher and Processing Utility
 *
 * Handles HTTP retrieval of chapter images with referer header configuration,
 * timeout controls, filename sequential formatting, and optional WebP conversion.
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('ImageFetcher');
export const FETCH_TIMEOUT_MS = 30000;

export function formatFileName(index: number, total: number, ext: string): string {
  const padLength = Math.max(3, String(total).length);
  return `${String(index + 1).padStart(padLength, '0')}.${ext}`;
}

export function getExtension(url: string, contentType: string): string {
  const mimeMap: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };

  const cleanContentType = contentType.split(';')[0]?.trim().toLowerCase() || '';
  if (mimeMap[cleanContentType]) {
    return mimeMap[cleanContentType];
  }

  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      const ext = match[1].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch {
    // Fallback if URL parsing fails
  }

  return 'jpg';
}

/**
 * Converts an image ArrayBuffer to WebP format using native OffscreenCanvas.
 */
export async function convertToWebpCanvas(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    logger.logEvent('WARN', 'WEBP_CANVAS_UNAVAILABLE', 'OffscreenCanvas or createImageBitmap not supported in this runtime');
    return buffer;
  }

  const blob = new Blob([buffer]);
  const bitmap = await createImageBitmap(blob);

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D rendering context from OffscreenCanvas');
    }

    ctx.drawImage(bitmap, 0, 0);

    const webpBlob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.85,
    });

    return await webpBlob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}

export interface FetchedImageResult {
  buffer: ArrayBuffer;
  contentType: string;
  extension: string;
  byteLength: number;
}

/**
 * Fetches an individual image by URL with timeout and referer headers.
 */
export async function fetchImage(url: string, referer?: string): Promise<FetchedImageResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (referer) {
      try {
        const origin = new URL(referer).origin;
        headers['Referer'] = referer.endsWith('/') ? referer : `${referer}/`;
        headers['Origin'] = origin;
      } catch {
        headers['Referer'] = referer;
      }
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: arrayBuffer,
      contentType,
      extension: getExtension(url, contentType),
      byteLength: arrayBuffer.byteLength,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
