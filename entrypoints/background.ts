import JSZip from 'jszip';
import { createLogger } from '@/lib/logger';
import { setBadgeText, setBadgeBackgroundColor } from '@/lib/extension-api';

const logger = createLogger('Background');
const FETCH_TIMEOUT_MS = 30000;

// Badge colors
const BADGE_COLOR_DETECT = '#4f46e5'; // Indigo - image count detected
const BADGE_COLOR_PROGRESS = '#3b82f6'; // Blue - download in progress
const BADGE_COLOR_SUCCESS = '#10b981'; // Green - download complete
const BADGE_COLOR_ERROR = '#ef4444'; // Red - download failed

// In-memory store for detected image counts per tab (restored to badge after download)
const tabImageCounts = new Map<number, number>();

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

// -------------------------------------------------------------------------
// Offscreen Document Management (Chromium MV3 only)
// -------------------------------------------------------------------------

/**
 * Checks if URL.createObjectURL is available in the current context.
 * It IS available in Firefox background pages, but NOT in Chromium Service Workers.
 */
function canCreateBlobUrlDirectly(): boolean {
  try {
    return typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  } catch {
    return false;
  }
}

/**
 * Ensures the offscreen document exists. Only used in Chromium.
 */
async function ensureOffscreenDocument(): Promise<void> {
  // Check if chrome.offscreen API exists (Chromium only)
  const chromeGlobal = (globalThis as any).chrome;
  if (!chromeGlobal?.offscreen) return;

  try {
    // chrome.offscreen.hasDocument was added later; use getContexts as a fallback
    if (typeof chromeGlobal.offscreen.hasDocument === 'function') {
      const hasDoc = await chromeGlobal.offscreen.hasDocument();
      if (hasDoc) return;
    } else if (typeof chromeGlobal.runtime.getContexts === 'function') {
      const contexts = await chromeGlobal.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });
      if (contexts && contexts.length > 0) return;
    }
  } catch {
    // If checking fails, try to create anyway (duplicate will throw)
  }

  try {
    await chromeGlobal.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Create Blob URL for ZIP file download',
    });
    logger.logEvent('DEBUG', 'OFFSCREEN_CREATED', 'Offscreen document created for Blob URL generation');
  } catch (err: any) {
    // "Only a single offscreen document may be created" is expected if already open
    if (!err.message?.includes('single offscreen')) {
      logger.logEvent('WARN', 'OFFSCREEN_CREATE_FAILED', 'Failed to create offscreen document', {}, err);
    }
  }
}

/**
 * Closes the offscreen document. Only used in Chromium.
 */
async function closeOffscreenDocument(): Promise<void> {
  const chromeGlobal = (globalThis as any).chrome;
  if (!chromeGlobal?.offscreen) return;

  try {
    await chromeGlobal.offscreen.closeDocument();
    logger.logEvent('DEBUG', 'OFFSCREEN_CLOSED', 'Offscreen document closed');
  } catch {
    // Already closed or not open — ignore
  }
}

// -------------------------------------------------------------------------
// ZIP File Saving (Cross-Browser)
// -------------------------------------------------------------------------

/**
 * Saves a ZIP file using browser.downloads.download.
 *
 * - Firefox: Creates Blob URL directly in background (has DOM access).
 * - Chromium: Uses offscreen document to create Blob URL (no DOM in Service Worker).
 */
async function saveZipFile(zipUint8Array: Uint8Array, zipFileName: string): Promise<void> {
  if (canCreateBlobUrlDirectly()) {
    // FIREFOX PATH: Background has DOM access
    logger.logEvent('DEBUG', 'SAVE_ZIP_DIRECT', 'Using direct Blob URL creation (Firefox path)');
    const blob = new Blob([zipUint8Array.buffer as ArrayBuffer], { type: 'application/zip' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      await browser.downloads.download({
        url: blobUrl,
        filename: zipFileName,
        saveAs: false,
      });
    } finally {
      // Revoke after a delay to ensure download manager has grabbed the data
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  } else {
    // CHROMIUM PATH: Use offscreen document for Blob URL
    logger.logEvent('DEBUG', 'SAVE_ZIP_OFFSCREEN', 'Using offscreen document for Blob URL (Chromium path)');
    await ensureOffscreenDocument();

    // Send raw byte array to offscreen document
    const response = await browser.runtime.sendMessage({
      target: 'offscreen',
      action: 'createBlobUrl',
      data: Array.from(zipUint8Array),
    });

    if (!response?.ok || !response.url) {
      throw new Error(response?.error || 'Offscreen document failed to create Blob URL');
    }

    try {
      await browser.downloads.download({
        url: response.url,
        filename: zipFileName,
        saveAs: false,
      });
    } finally {
      // Revoke the blob URL via offscreen document after a delay
      setTimeout(async () => {
        try {
          await browser.runtime.sendMessage({
            target: 'offscreen',
            action: 'revokeBlobUrl',
            url: response.url,
          });
        } catch { /* offscreen may already be closed */ }
        await closeOffscreenDocument();
      }, 60000);
    }
  }
}

// -------------------------------------------------------------------------
// Download State Management
// -------------------------------------------------------------------------

interface DownloadState {
  tabId: number;
  state: 'downloading' | 'done' | 'error';
  percent: number;
  downloaded: number;
  total: number;
  currentFile: string;
  zipFileName: string;
  errorMessage?: string;
}

async function setDownloadState(tabId: number, state: DownloadState): Promise<void> {
  await browser.storage.session.set({ [`download_${tabId}`]: state }).catch(() => {
    // Fallback to storage.local if session storage is not available (older Firefox)
    return browser.storage.local.set({ [`download_${tabId}`]: state });
  });
}

async function getDownloadState(tabId: number): Promise<DownloadState | null> {
  try {
    const result = await browser.storage.session.get(`download_${tabId}`).catch(() => {
      return browser.storage.local.get(`download_${tabId}`);
    });
    return (result[`download_${tabId}`] as DownloadState) || null;
  } catch {
    return null;
  }
}

async function clearDownloadState(tabId: number): Promise<void> {
  await browser.storage.session.remove(`download_${tabId}`).catch(() => {
    return browser.storage.local.remove(`download_${tabId}`);
  });
}

// -------------------------------------------------------------------------
// Chapter Download Pipeline
// -------------------------------------------------------------------------

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
  const zipFileName = `${chapterInfo.slug}.zip`;

  logger.logEvent('INFO', 'PIPELINE_START', 'Starting chapter download pipeline', {
    title: chapterInfo.title,
    chapter: chapterInfo.chapter,
    slug: chapterInfo.slug,
    totalImages: total,
    convertToWebp,
    referer,
  });

  // Set initial download state
  await setDownloadState(tabId, {
    tabId,
    state: 'downloading',
    percent: 0,
    downloaded: 0,
    total,
    currentFile: 'Menghubungkan ke server gambar...',
    zipFileName,
  });

  await setBadgeText('0%', tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_PROGRESS, tabId);

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

      // Update download state in storage
      await setDownloadState(tabId, {
        tabId,
        state: 'downloading',
        percent,
        downloaded,
        total,
        currentFile: fileName,
        zipFileName,
      });

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
    await setBadgeBackgroundColor(BADGE_COLOR_ERROR, tabId);
    await setDownloadState(tabId, {
      tabId,
      state: 'error',
      percent: 0,
      downloaded: 0,
      total,
      currentFile: '',
      zipFileName,
      errorMessage: 'Tidak ada gambar yang berhasil diunduh.',
    });

    logger.logEvent('ERROR', 'IMAGE_FETCH_FAILURE', 'Download pipeline failed: no images were successfully downloaded', {
      totalAttempted: total,
      errors,
    });

    throw new Error('Tidak ada gambar yang berhasil diunduh.');
  }

  // ZIP compression phase
  logger.logEvent('INFO', 'ZIP_COMPRESSION_START', 'Generating ZIP archive', {
    downloadedImages: downloaded,
    totalImages: total,
    errorCount: errors.length,
  });

  await setBadgeText('ZIP', tabId);

  // Generate ZIP as Uint8Array (binary) instead of base64
  const zipUint8Array = await zip.generateAsync({ type: 'uint8array' });

  logger.logEvent('INFO', 'ZIP_COMPRESSION_COMPLETE', 'ZIP archive generated successfully', {
    zipFileName,
    zipSize: zipUint8Array.byteLength,
    downloaded,
    total,
    errorsCount: errors.length,
  });

  // Save the ZIP file using browser downloads API (works even if popup is closed!)
  await saveZipFile(zipUint8Array, zipFileName);

  await setBadgeText('OK', tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_SUCCESS, tabId);

  // Update download state to done
  await setDownloadState(tabId, {
    tabId,
    state: 'done',
    percent: 100,
    downloaded,
    total,
    currentFile: zipFileName,
    zipFileName,
  });

  // Notify popup if still open
  try {
    await browser.runtime.sendMessage({
      action: 'downloadProgress',
      downloaded,
      total,
      percent: 100,
      currentFile: zipFileName,
    });
    await browser.runtime.sendMessage({
      action: 'downloadComplete',
      zipFileName,
      downloaded,
      total,
      errors,
    });
  } catch { /* popup mungkin tertutup */ }

  // Schedule badge reset: restore image count badge after 5 seconds
  browser.alarms.create(`clearBadge_${tabId}`, { delayInMinutes: 5 / 60 });

  return { ok: true, zipFileName, downloaded, total, errors };
}

// -------------------------------------------------------------------------
// Badge Helpers
// -------------------------------------------------------------------------

/**
 * Sets the badge to show detected image count for a specific tab.
 * Only sets the badge if the tab is not currently downloading.
 */
async function setImageCountBadge(tabId: number, count: number): Promise<void> {
  // Don't override download progress badge
  const downloadState = await getDownloadState(tabId);
  if (downloadState && downloadState.state === 'downloading') return;

  if (count > 0) {
    await setBadgeText(String(count), tabId);
    await setBadgeBackgroundColor(BADGE_COLOR_DETECT, tabId);
  } else {
    await setBadgeText('', tabId);
  }
}

/**
 * Restores the image count badge for a tab after download completion.
 */
async function restoreImageCountBadge(tabId: number): Promise<void> {
  const count = tabImageCounts.get(tabId);
  if (count && count > 0) {
    await setBadgeText(String(count), tabId);
    await setBadgeBackgroundColor(BADGE_COLOR_DETECT, tabId);
  } else {
    await setBadgeText('', tabId);
  }
  // Clear the download state since it's done
  await clearDownloadState(tabId);
}

// -------------------------------------------------------------------------
// Extension Lifecycle
// -------------------------------------------------------------------------

export default defineBackground(() => {
  logger.logEvent('INFO', 'EXTENSION_INITIALIZED', 'Background service worker loaded', {
    extensionId: browser.runtime.id,
  });

  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    // Ignore messages targeted at offscreen document
    if (message.target === 'offscreen') return;

    logger.logEvent('DEBUG', 'MESSAGE_RECEIVED', `Received runtime message: ${message.action}`, {
      action: message.action,
    });

    // Handle image detection from content script
    if (message.action === 'imagesDetected') {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const count = message.count || 0;
        tabImageCounts.set(tabId, count);
        setImageCountBadge(tabId, count);
        logger.logEvent('DEBUG', 'IMAGES_DETECTED', `Content script detected ${count} images`, {
          tabId,
          count,
        });
      }
      return false;
    }

    // Handle download state query from popup
    if (message.action === 'getDownloadState') {
      const tabId = message.tabId;
      if (tabId !== undefined) {
        getDownloadState(tabId)
          .then((state) => sendResponse(state))
          .catch(() => sendResponse(null));
        return true; // keep channel open for async
      }
      return false;
    }

    // Handle download request
    if (message.action === 'downloadZip') {
      const { imageUrls, chapterInfo, tabId, referer, convertToWebp } = message as DownloadRequest;
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

  // Alarm handler: clear badge and restore image count
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('clearBadge_')) {
      const tabId = parseInt(alarm.name.replace('clearBadge_', ''), 10);
      if (!isNaN(tabId)) {
        logger.logEvent('DEBUG', 'BADGE_RESTORE', `Restoring image count badge for tab ${tabId}`);
        await restoreImageCountBadge(tabId);
      }
    }
    // Legacy support for old alarm name
    if (alarm.name === 'clearBadge') {
      logger.logEvent('DEBUG', 'BADGE_CLEARED', 'Clearing badge text after alarm');
      await setBadgeText('');
    }
  });

  // Clean up when a tab is closed
  browser.tabs.onRemoved.addListener((tabId) => {
    tabImageCounts.delete(tabId);
    clearDownloadState(tabId);
    logger.logEvent('DEBUG', 'TAB_CLEANUP', `Cleaned up state for closed tab ${tabId}`, { tabId });
  });

  // Global error handlers
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
