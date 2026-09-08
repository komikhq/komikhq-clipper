import JSZip from 'jszip';

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
      errors.push({ index: i, url, error: errorMessage });
    }
  }

  if (downloaded === 0) {
    await browser.action.setBadgeText({ text: 'ERR', tabId });
    await browser.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    throw new Error('Tidak ada gambar yang berhasil diunduh.');
  }

  await browser.action.setBadgeText({ text: 'ZIP', tabId });
  const dataUrl = await zip.generateAsync({ type: 'base64' });
  const zipFileName = `${chapterInfo.slug}.zip`;

  const downloadId = await browser.downloads.download({
    url: `data:application/zip;base64,${dataUrl}`,
    filename: zipFileName,
    saveAs: false,
  });

  await browser.action.setBadgeText({ text: '✓', tabId });
  await browser.action.setBadgeBackgroundColor({ color: '#10b981', tabId });

  browser.alarms.create('clearBadge', { delayInMinutes: 0.05 });

  return { ok: true, downloadId, zipFileName, downloaded, total, errors };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DownloadRequest, _sender, sendResponse) => {
    if (message.action === 'downloadZip') {
      const { imageUrls, chapterInfo, tabId, referer } = message;
      downloadChapterAsZip(imageUrls, chapterInfo, tabId, referer)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // keep channel open for async
    }
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'clearBadge') {
      await browser.action.setBadgeText({ text: '' });
    }
  });

  console.log('[KomikHQ Clipper] Background loaded.', { id: browser.runtime.id });
});
