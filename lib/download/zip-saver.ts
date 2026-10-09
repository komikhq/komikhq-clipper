/**
 * ZIP Archiving and Download Execution Manager
 *
 * Saves generated ZIP files to the user's filesystem using browser.downloads.download.
 * Handles cross-browser differences:
 * - Firefox: Creates Blob URL directly in the background worker.
 * - Chromium: Uses IndexedDB temporary bridge + Offscreen Document to bypass the 64 MB IPC limit.
 *
 * Implements instant cleanup via browser.downloads.onChanged:
 * As soon as the download finishes or is interrupted, the Blob URL is revoked and the
 * offscreen document is closed immediately, ensuring zero lingering memory or storage.
 */

import { createLogger } from '@/lib/logger';
import { ensureOffscreenDocument, closeOffscreenDocument, isOffscreenSupported } from '@/lib/background/offscreen-manager';
import { storeTempBinary, removeTempBinary } from '@/lib/download/temp-storage-bridge';

const logger = createLogger('ZipSaver');

export async function saveZipFile(
  zipUint8Array: Uint8Array,
  zipFileName: string,
  tabId: number
): Promise<void> {
  const supportsDirectBlob = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';

  if (supportsDirectBlob && !isOffscreenSupported()) {
    // DIRECT PATH (Firefox MV2/MV3)
    logger.logEvent('DEBUG', 'SAVE_ZIP_DIRECT', 'Using direct Blob URL for download (Firefox path)', {
      zipFileName,
      byteLength: zipUint8Array.byteLength,
    });

    const blob = new Blob([zipUint8Array.buffer as ArrayBuffer], { type: 'application/zip' });
    const blobUrl = URL.createObjectURL(blob);

    try {
      const downloadId = await browser.downloads.download({
        url: blobUrl,
        filename: zipFileName,
        saveAs: false,
      });

      // Instantly revoke Blob URL once download finishes
      const cleanupListener = (delta: any) => {
        if (delta.id === downloadId && (delta.state?.current === 'complete' || delta.state?.current === 'interrupted')) {
          browser.downloads.onChanged.removeListener(cleanupListener);
          clearTimeout(fallbackTimeout);
          URL.revokeObjectURL(blobUrl);
          logger.logEvent('DEBUG', 'DIRECT_BLOB_REVOKED', 'Direct Blob URL revoked upon download completion', { downloadId });
        }
      };

      browser.downloads.onChanged.addListener(cleanupListener);

      const fallbackTimeout = setTimeout(() => {
        browser.downloads.onChanged.removeListener(cleanupListener);
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (err: any) {
      URL.revokeObjectURL(blobUrl);
      logger.logEvent('ERROR', 'SAVE_ZIP_DIRECT_FAILED', 'Failed to trigger direct download', {}, err);
      throw err;
    }
  } else {
    // CHROMIUM PATH: IndexedDB Bridge + Offscreen Document
    // Zero IPC message limit, zero storage accumulation.
    const storageKey = `zip_${tabId}_${Date.now()}`;
    logger.logEvent('DEBUG', 'SAVE_ZIP_OFFSCREEN', 'Using IndexedDB bridge & offscreen document for Blob URL (Chromium path)', {
      storageKey,
      byteLength: zipUint8Array.byteLength,
    });

    try {
      // 1. Store temporary binary in IndexedDB (handles any file size without 64 MB limit)
      await storeTempBinary(storageKey, zipUint8Array);

      // 2. Ensure offscreen document is ready
      await ensureOffscreenDocument();

      // 3. Send lightweight message with just the storage key (tiny payload)
      const response = await browser.runtime.sendMessage({
        target: 'offscreen',
        action: 'createBlobUrlFromStorage',
        key: storageKey,
      });

      if (!response?.ok || !response.url) {
        throw new Error(response?.error || 'Offscreen document failed to generate Blob URL from storage');
      }

      const blobUrl = response.url;

      // 4. Trigger download
      const downloadId = await browser.downloads.download({
        url: blobUrl,
        filename: zipFileName,
        saveAs: false,
      });

      // 5. Register instant event-driven cleanup
      const cleanupListener = async (delta: any) => {
        if (delta.id === downloadId && (delta.state?.current === 'complete' || delta.state?.current === 'interrupted')) {
          browser.downloads.onChanged.removeListener(cleanupListener);
          clearTimeout(fallbackTimeout);

          logger.logEvent('DEBUG', 'OFFSCREEN_CLEANUP', 'Download complete event detected, cleaning up offscreen document', { downloadId });

          try {
            await browser.runtime.sendMessage({
              target: 'offscreen',
              action: 'revokeBlobUrl',
              url: blobUrl,
            });
          } catch {
            // Document might already be closed
          }
          await closeOffscreenDocument();
        }
      };

      browser.downloads.onChanged.addListener(cleanupListener);

      // Safety fallback in case browser does not dispatch onChanged (e.g. system dialog)
      const fallbackTimeout = setTimeout(async () => {
        browser.downloads.onChanged.removeListener(cleanupListener);
        try {
          await browser.runtime.sendMessage({
            target: 'offscreen',
            action: 'revokeBlobUrl',
            url: blobUrl,
          });
        } catch { /* noop */ }
        await closeOffscreenDocument();
      }, 120000);

    } catch (err: any) {
      // Guarantee temporary storage cleanup on failure
      await removeTempBinary(storageKey);
      await closeOffscreenDocument();
      logger.logEvent('ERROR', 'SAVE_ZIP_OFFSCREEN_FAILED', 'Failed to save ZIP via offscreen pipeline', {}, err);
      throw err;
    }
  }
}
