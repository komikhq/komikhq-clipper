import JSZip from 'jszip';
import { createLogger } from '@/lib/logger';

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
}

async function downloadChapterAsZip(
  imageUrls: string[],
  chapterInfo: ChapterInfo,
  tabId: number,
  referer: string,
) {
  const zip = new JSZip();
  const total = imageUrls.length;
  let downloaded = 0;
  const errors: { index: number; url: string; error: string }[] = [];

  logger.info('Starting chapter download:', { title: chapterInfo.title, chapter: chapterInfo.chapter, totalImages: total });

  await browser.action.setBadgeText({ text: '0%', tabId });
  await browser.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId });

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
      const ext = getExtension(url, contentType);
      const blob = await response.arrayBuffer();
      const fileName = formatFileName(i, total, ext);

      zip.file(fileName, blob);
      downloaded++;

      const percent = Math.round((downloaded / total) * 100);
      await browser.action.setBadgeText({ text: `${percent}%`, tabId });
      logger.debug(`Downloaded image ${i + 1}/${total}: ${fileName}`);

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
        ? `Timeout setelah ${FETCH_TIMEOUT_MS / 1000} detik`
        : err.message;
      logger.warn(`Failed to download image ${i + 1}/${total}:`, { url, error: errorMessage });
      errors.push({ index: i, url, error: errorMessage });
    }
  }

  if (downloaded === 0) {
    await browser.action.setBadgeText({ text: 'ERR', tabId });
    await browser.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    logger.error('Download failed: No images were successfully downloaded.');
    throw new Error('Tidak ada gambar yang berhasil diunduh.');
  }

  await browser.action.setBadgeText({ text: 'ZIP', tabId });
  const dataUrl = await zip.generateAsync({ type: 'base64' });
  const zipFileName = `${chapterInfo.slug}.zip`;

  await browser.action.setBadgeText({ text: '✓', tabId });
  await browser.action.setBadgeBackgroundColor({ color: '#10b981', tabId });

  logger.info('ZIP generated successfully:', { zipFileName, downloaded, total, errorsCount: errors.length });

  browser.alarms.create('clearBadge', { delayInMinutes: 0.05 });

  return { ok: true, zipFileName, zipBase64: dataUrl, downloaded, total, errors };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DownloadRequest, _sender, sendResponse) => {
    logger.debug('Received runtime message:', message.action);
    if (message.action === 'downloadZip') {
      const { imageUrls, chapterInfo, tabId, referer } = message;
      downloadChapterAsZip(imageUrls, chapterInfo, tabId, referer)
        .then((result) => sendResponse(result))
        .catch((err) => {
          logger.error('Error handling downloadZip message:', err);
          sendResponse({ ok: false, error: err.message });
        });
      return true; // keep channel open for async
    }
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'clearBadge') {
      logger.debug('Clearing badge text');
      await browser.action.setBadgeText({ text: '' });
    }
  });

  self.addEventListener('unhandledrejection', (event: any) => {
    logger.error('Unhandled Promise Rejection:', event.reason);
  });

  self.addEventListener('error', (event: any) => {
    logger.error('Uncaught Error:', event.error || event.message);
  });

  logger.info('Background loaded.', { id: browser.runtime.id });
});

