/**
 * Chapter Downloader Pipeline
 *
 * Orchestrates downloading chapter images sequentially, converting them to WebP (optional),
 * bundling them into a ZIP archive, and saving to disk.
 * Dispatches granular progress updates and coordinates badge and state persistence.
 */

import JSZip from 'jszip';
import { createLogger } from '@/lib/logger';
import { fetchImage, convertToWebpCanvas, formatFileName, FETCH_TIMEOUT_MS } from '@/lib/download/image-fetcher';
import { saveZipFile } from '@/lib/download/zip-saver';
import {
  setProgressBadge,
  setZipBadge,
  setSuccessBadge,
  setErrorBadge,
} from '@/lib/background/badge-manager';
import { setDownloadState } from '@/lib/background/download-state-store';

const logger = createLogger('ChapterDownloader');

export interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

export interface DownloadResult {
  ok: boolean;
  zipFileName?: string;
  downloaded?: number;
  total?: number;
  errors?: Array<{ index: number; url: string; error: string }>;
  error?: string;
}

export async function downloadChapterAsZip(
  imageUrls: string[],
  chapterInfo: ChapterInfo,
  tabId: number,
  referer?: string,
  convertToWebp: boolean = false
): Promise<DownloadResult> {
  const total = imageUrls.length;
  const zip = new JSZip();
  let downloaded = 0;
  const errors: Array<{ index: number; url: string; error: string }> = [];

  const rawChapterNum = chapterInfo.chapter || '0';
  const paddedChapter = rawChapterNum.padStart(3, '0');
  const safeTitle = chapterInfo.title.replace(/[/\\?%*:|"<>]/g, '-').trim();
  const zipFileName = `${safeTitle} - Chapter ${paddedChapter}.zip`;

  logger.logEvent('INFO', 'DOWNLOAD_STARTED', `Starting download for ${chapterInfo.title} Chapter ${chapterInfo.chapter}`, {
    title: chapterInfo.title,
    chapter: chapterInfo.chapter,
    totalImages: total,
    tabId,
    convertToWebp,
  });

  // Initialize download state
  await setDownloadState(tabId, {
    tabId,
    state: 'downloading',
    percent: 0,
    downloaded: 0,
    total,
    currentFile: '',
    zipFileName,
  });
  await setProgressBadge(tabId, 0);

  // Sequential image download pipeline
  for (let i = 0; i < total; i++) {
    const url = imageUrls[i];
    if (!url) continue;

    try {
      const fetched = await fetchImage(url, referer);
      let finalBuffer = fetched.buffer;
      let ext = fetched.extension;

      if (convertToWebp && ext !== 'webp') {
        try {
          finalBuffer = await convertToWebpCanvas(finalBuffer);
          ext = 'webp';
        } catch (convErr: any) {
          logger.logEvent('WARN', 'WEBP_CONVERT_FALLBACK', `Failed to convert image ${i + 1} to WebP, keeping original format`, {
            index: i,
            originalExt: ext,
          }, convErr);
        }
      }

      const fileName = formatFileName(i, total, ext);
      zip.file(fileName, finalBuffer);
      downloaded++;

      const percent = Math.round((downloaded / total) * 100);

      // Update badge and persistence
      await setProgressBadge(tabId, percent);
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
        byteSize: finalBuffer.byteLength,
      });

      // Notify popup if currently open
      try {
        await browser.runtime.sendMessage({
          action: 'downloadProgress',
          downloaded,
          total,
          percent,
          currentFile: fileName,
        });
      } catch {
        // Popup may be closed; progress continues uninterrupted
      }
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

  // Handle failure case where no images succeeded
  if (downloaded === 0) {
    await setErrorBadge(tabId);
    await setDownloadState(tabId, {
      tabId,
      state: 'error',
      percent: 0,
      downloaded: 0,
      total,
      currentFile: '',
      zipFileName,
      errorMessage: 'No images were successfully downloaded.',
    });

    logger.logEvent('ERROR', 'IMAGE_FETCH_FAILURE', 'Download pipeline failed: no images were successfully downloaded', {
      totalAttempted: total,
      errors,
    });

    throw new Error('No images were successfully downloaded.');
  }

  // ZIP compression phase
  logger.logEvent('INFO', 'ZIP_COMPRESSION_START', 'Generating ZIP archive', {
    downloadedImages: downloaded,
    totalImages: total,
  });

  await setZipBadge(tabId);

  const zipUint8Array = await zip.generateAsync({ type: 'uint8array' });

  logger.logEvent('INFO', 'ZIP_COMPRESSION_COMPLETE', 'ZIP archive generated successfully', {
    zipFileName,
    zipSize: zipUint8Array.byteLength,
  });

  // Save the ZIP file using browser downloads API
  await saveZipFile(zipUint8Array, zipFileName, tabId);

  // Update success states
  await setSuccessBadge(tabId);
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
  } catch {
    // Popup may be closed
  }

  return { ok: true, zipFileName, downloaded, total, errors };
}
