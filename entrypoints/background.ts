/**
 * Background Service Worker Entrypoint
 *
 * Coordinates extension lifecycle, runtime messaging, tab events, and alarms.
 * Core domain logic is delegated to modular libraries in @/lib:
 * - Chapter download and WebP conversion: @/lib/download/chapter-downloader
 * - Binary saving & instant cleanup: @/lib/download/zip-saver
 * - Badge management & visual alerts: @/lib/background/badge-manager
 * - Per-tab download state store: @/lib/background/download-state-store
 */

import { createLogger } from '@/lib/logger';
import {
  setImageCountBadge,
  restoreImageCountBadge,
  setTabDetectedCount,
  removeTabDetectedCount,
} from '@/lib/background/badge-manager';
import {
  getDownloadState,
  clearDownloadState,
} from '@/lib/background/download-state-store';
import { downloadChapterAsZip, type ChapterInfo } from '@/lib/download/chapter-downloader';

const logger = createLogger('Background');

export interface DownloadRequest {
  action: 'downloadZip';
  imageUrls: string[];
  chapterInfo: ChapterInfo;
  tabId: number;
  referer?: string;
  convertToWebp?: boolean;
}

export default defineBackground(() => {
  logger.logEvent('INFO', 'EXTENSION_INITIALIZED', 'Background service worker initialized', {
    extensionId: browser.runtime.id,
  });

  // Runtime message dispatcher
  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    // Ignore internal messages designated for the offscreen document
    if (message.target === 'offscreen') return;

    logger.logEvent('DEBUG', 'MESSAGE_RECEIVED', `Received runtime message: ${message.action}`, {
      action: message.action,
    });

    // Handle detected comic image counts from content script
    if (message.action === 'imagesDetected') {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        const count = message.count || 0;
        setTabDetectedCount(tabId, count);
        setImageCountBadge(tabId, count);
        logger.logEvent('DEBUG', 'IMAGES_DETECTED', `Content script detected ${count} images for tab ${tabId}`, {
          tabId,
          count,
        });
      }
      return false;
    }

    // Handle popup request to synchronize active download state
    if (message.action === 'getDownloadState') {
      const tabId = message.tabId;
      if (tabId !== undefined) {
        getDownloadState(tabId)
          .then((state) => sendResponse(state))
          .catch(() => sendResponse(null));
        return true; // Keep message channel open for async response
      }
      return false;
    }

    // Handle chapter download request
    if (message.action === 'downloadZip') {
      const { imageUrls, chapterInfo, tabId, referer, convertToWebp } = message as DownloadRequest;
      downloadChapterAsZip(imageUrls, chapterInfo, tabId, referer, convertToWebp)
        .then((result) => sendResponse(result))
        .catch((err) => {
          logger.logEvent('ERROR', 'PIPELINE_FAILED', 'Failed to execute chapter download', {
            chapter: chapterInfo?.chapter,
            title: chapterInfo?.title,
          }, err);
          sendResponse({ ok: false, error: err.message });
        });
      return true; // Keep message channel open for async response
    }
  });

  // Alarm listener: restores previous badge state after completion and cleans up state
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('clearBadge_')) {
      const tabId = parseInt(alarm.name.replace('clearBadge_', ''), 10);
      if (!isNaN(tabId)) {
        logger.logEvent('DEBUG', 'BADGE_RESTORE', `Restoring badge and clearing state for tab ${tabId}`);
        await restoreImageCountBadge(tabId);
        await clearDownloadState(tabId);
      }
    }
  });

  // Tab closure listener: frees tab memory and storage state immediately
  browser.tabs.onRemoved.addListener((tabId) => {
    removeTabDetectedCount(tabId);
    clearDownloadState(tabId);
    logger.logEvent('DEBUG', 'TAB_CLEANUP', `Cleaned up state for closed tab ${tabId}`, { tabId });
  });

  // Global error monitoring
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
