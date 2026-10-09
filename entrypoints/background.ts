import JSZip from 'jszip';
import { createLogger } from '@/lib/logger';
import { setBadgeText, setBadgeBackgroundColor } from '@/lib/extension-api';

const logger = createLogger('Background');
const FETCH_TIMEOUT_MS = 30000;

function formatFileName(index: number, total: number, ext: string): string {
  const padLength = Math.max(3, String(total).length);
  return `${String(index + 1).padStart(padLength, '0')}.${ext}`;
}

function getExtension(url: string, contentType: string): string {
  const mimeMap: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };
  if (contentType && mimeMap[contentType]) return mimeMap[contentType];
  try {
    const match = new URL(url).pathname.match(/\.(\w+)$/);
    if (match && match[1]) return match[1].toLowerCase();
  } catch { /* ignore */ }
  return 'webp';
}

/**
 * Convert an image ArrayBuffer to WebP format using native OffscreenCanvas.
 * Runs entirely inside the Service Worker -- no external dependencies.
 * Returns the converted ArrayBuffer plus the 'webp' extension string.
 * Falls back to the original data if conversion fails.
 */
async function convertBlobToWebP(
  buffer: ArrayBuffer,
  quality = 0.90,
): Promise<{ data: ArrayBuffer; ext: string; converted: boolean }> {
  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to obtain 2D rendering context');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality });
    const webpBuffer = await webpBlob.arrayBuffer();
    logger.logEvent('DEBUG', 'WEBP_CONVERSION_SUCCESS', 'Converted image to WebP format', {
      originalSize: buffer.byteLength,
      convertedSize: webpBuffer.byteLength,
    });
    return { data: webpBuffer, ext: 'webp', converted: true };
  } catch (err: any) {
    logger.logEvent('WARN', 'WEBP_CONVERSION_FAILED', 'WebP conversion failed, keeping original format', {}, err);
    return { data: buffer, ext: '', converted: false };
  }
}

interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

interface DownloadRequest {
  action: 'downloadZip';
  imageUrls: string[];
  chapterInfo: ChapterInfo;
  tabId: number;
  referer: string;
  convertToWebp?: boolean;
}

async function downloadChapterAsZip(
  imageUrls: string[],
  chapterInfo: ChapterInfo,
  tabId: number,
  referer: string,
  convertToWebp = false,
) {
  const zip = new JSZip();
  const total = imageUrls.length;
  let downloaded = 0;
  const errors: { index: number; url: string; error: string }[] = [];

  logger.logEvent('INFO', 'PIPELINE_START', 'Starting chapter download pipeline', {
    title: chapterInfo.title,
    chapter: chapterInfo.chapter,
    slug: chapterInfo.slug,
    totalImages: total,
    convertToWebp,
    referer,
  });

  await setBadgeText('0%', tabId);
  await setBadgeBackgroundColor('#3b82f6', tabId);

  try {
    await browser.runtime.sendMessage({
      action: 'downloadProgress',
      downloaded: 0,
      total,
      percent: 0,
      currentFile: 'Menghubungkan ke server gambar...',
    });
  } catch { /* popup mungkin tertutup */ }

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    if (!url) continue;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { Referer: referer },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get('content-type') || '';
      let ext = getExtension(url, contentType);
      const rawBuffer = await response.arrayBuffer();
      let finalBuffer: ArrayBuffer = rawBuffer;

      // Convert to WebP if enabled and not already WebP
      if (convertToWebp && ext !== 'webp') {
        const result = await convertBlobToWebP(rawBuffer);
        if (result.converted) {
          finalBuffer = result.data;
          ext = result.ext;
        }
      }

      const fileName = formatFileName(i, total, ext);
      zip.file(fileName, finalBuffer);
      downloaded++;

      const percent = Math.round((downloaded / total) * 100);
      await setBadgeText(`${percent}%`, tabId);

      logger.logEvent('DEBUG', 'IMAGE_FETCH_SUCCESS', `Downloaded image ${i + 1}/${total}`, {
        index: i,
        fileName,
        url: url.substring(0, 150),
        httpStatus: response.status,
        byteSize: finalBuffer.byteLength,
        contentType,
      });

      try {
        await browser.runtime.sendMessage({
          action: 'downloadProgress',
          downloaded,
          total,
          percent,
          currentFile: fileName,
        });
      } catch { /* popup mungkin tertutup */ }
    } catch (err: any) {
      const errorMessage = err.name === 'AbortError'
        ? `Timeout after ${FETCH_TIMEOUT_MS / 1000} seconds`
        : err.message;

      logger.logEvent('WARN', 'IMAGE_FETCH_RETRY', `Failed to download image ${i + 1}/${total}`, {
        index: i,
        url: url.substring(0, 150),
        error: errorMessage,
      }, err);

      errors.push({ index: i, url, error: errorMessage });
    }
  }

  if (downloaded === 0) {
    await setBadgeText('ERR', tabId);
    await setBadgeBackgroundColor('#ef4444', tabId);

    logger.logEvent('ERROR', 'IMAGE_FETCH_FAILURE', 'Download pipeline failed: no images were successfully downloaded', {
      totalAttempted: total,
      errors,
    });

    throw new Error('Tidak ada gambar yang berhasil diunduh.');
  }

  logger.logEvent('INFO', 'ZIP_COMPRESSION_START', 'Generating ZIP archive', {
    downloadedImages: downloaded,
    totalImages: total,
    errorCount: errors.length,
  });

  await setBadgeText('ZIP', tabId);
  const dataUrl = await zip.generateAsync({ type: 'base64' });
  const zipFileName = `${chapterInfo.slug}.zip`;

  await setBadgeText('OK', tabId);
  await setBadgeBackgroundColor('#10b981', tabId);

  logger.logEvent('INFO', 'ZIP_COMPRESSION_COMPLETE', 'ZIP archive generated successfully', {
    zipFileName,
    downloaded,
    total,
    errorsCount: errors.length,
  });

  browser.alarms.create('clearBadge', { delayInMinutes: 0.05 });

  return { ok: true, zipFileName, zipBase64: dataUrl, downloaded, total, errors };
}

export default defineBackground(() => {
  logger.logEvent('INFO', 'EXTENSION_INITIALIZED', 'Background service worker loaded', {
    extensionId: browser.runtime.id,
  });

  browser.runtime.onMessage.addListener((message: DownloadRequest, _sender, sendResponse) => {
    logger.logEvent('DEBUG', 'MESSAGE_RECEIVED', `Received runtime message: ${message.action}`, {
      action: message.action,
    });

    if (message.action === 'downloadZip') {
      const { imageUrls, chapterInfo, tabId, referer, convertToWebp } = message;
      downloadChapterAsZip(imageUrls, chapterInfo, tabId, referer, convertToWebp)
        .then((result) => sendResponse(result))
        .catch((err) => {
          logger.logEvent('ERROR', 'PIPELINE_FAILED', 'Error handling downloadZip message', {
            chapter: chapterInfo?.chapter,
            title: chapterInfo?.title,
          }, err);
          sendResponse({ ok: false, error: err.message });
        });
      return true; // keep channel open for async
    }
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'clearBadge') {
      logger.logEvent('DEBUG', 'BADGE_CLEARED', 'Clearing badge text after alarm');
      await setBadgeText('');
    }
  });

  self.addEventListener('unhandledrejection', (event: any) => {
    logger.logEvent('ERROR', 'UNHANDLED_REJECTION', 'Unhandled Promise Rejection in background', {}, {
      name: 'UnhandledRejection',
      message: String(event.reason),
      stack: event.reason?.stack,
    });
  });

  self.addEventListener('error', (event: any) => {
    logger.logEvent('ERROR', 'UNCAUGHT_ERROR', 'Uncaught Error in background', {}, {
      name: 'UncaughtError',
      message: event.error?.message || event.message || 'Unknown error',
      stack: event.error?.stack,
    });
  });
});
