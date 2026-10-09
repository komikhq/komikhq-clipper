import { getAdapter } from '@/lib/adapters/registry';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Content');

export default defineContentScript({
  matches: [
    '*://*.komiku.org/*',
    '*://*.komiku.id/*',
    '*://*.komiku.to/*',
    '*://*.kiryuu.id/*',
    '*://*.kiryuu.org/*',
    '*://*.kiryuu.io/*',
    '*://*.kiryuu.to/*',
    '*://*.ainzscans01.com/*',
    '*://*.ainzscans.com/*',
  ],
  main() {
    logger.logEvent('INFO', 'CONTENT_SCRIPT_LOADED', 'Content script injected into page', {
      url: window.location.href,
      readyState: document.readyState,
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { action } = message;
      logger.logEvent('DEBUG', 'MESSAGE_RECEIVED', `Message received from popup: ${action}`, {
        action,
      });

      if (action === 'ping') {
        const adapter = getAdapter(window.location.href);
        const response = {
          ok: true,
          hasAdapter: adapter !== null,
          isReaderPage: adapter?.isReaderPage() ?? false,
          url: window.location.href,
        };
        logger.logEvent('DEBUG', 'PING_RESPONSE', 'Responded to ping request', response);
        sendResponse(response);
        return false;
      }

      if (action === 'scan') {
        const adapter = getAdapter(window.location.href);

        if (!adapter) {
          logger.logEvent('WARN', 'SCAN_NO_ADAPTER', 'No matching adapter found for scan request', {
            url: window.location.href,
          });
          sendResponse({
            ok: false,
            error: 'Tidak ada adapter yang cocok untuk situs ini.',
          });
          return false;
        }

        if (!adapter.isReaderPage()) {
          logger.logEvent('WARN', 'SCAN_NOT_READER', 'Scan requested on non-reader page', {
            url: window.location.href,
            siteId: adapter.siteId,
          });
          sendResponse({
            ok: false,
            error: 'Halaman ini bukan halaman baca chapter. Buka halaman baca komik terlebih dahulu.',
          });
          return false;
        }

        logger.logEvent('INFO', 'SCAN_START', 'Processing scan request', {
          url: window.location.href,
          adapter: adapter.siteName,
          siteId: adapter.siteId,
        });

        const chapterInfo = adapter.getChapterInfo();
        const imageUrls = adapter.getImageUrls();
        const referer = adapter.getReferer();

        logger.logEvent('INFO', 'SCAN_COMPLETE', 'Scan completed successfully', {
          adapter: adapter.siteName,
          chapterTitle: chapterInfo.title,
          chapterNumber: chapterInfo.chapter,
          slug: chapterInfo.slug,
          imageCount: imageUrls.length,
          referer,
        });

        sendResponse({
          ok: true,
          chapterInfo,
          imageUrls,
          imageCount: imageUrls.length,
          referer,
        });
        return false;
      }

      logger.logEvent('WARN', 'UNKNOWN_ACTION', `Unknown message action received: ${action}`, { action });
      sendResponse({ ok: false, error: `Aksi tidak dikenal: ${action}` });
      return false;
    });

    // -----------------------------------------------------------------------
    // Notify background of detected image count (for toolbar badge)
    // -----------------------------------------------------------------------
    let lastNotifiedCount = -1;

    function notifyImageCount(count: number): void {
      if (count === lastNotifiedCount) return; // avoid duplicate messages
      lastNotifiedCount = count;
      try {
        browser.runtime.sendMessage({ action: 'imagesDetected', count });
        logger.logEvent('DEBUG', 'NOTIFY_IMAGE_COUNT', `Notified background of ${count} detected images`, { count });
      } catch (err: any) {
        logger.logEvent('WARN', 'NOTIFY_IMAGE_COUNT_FAILED', 'Failed to notify background of image count', {}, err);
      }
    }

    /**
     * Runs adapter diagnostics and notifies background of image count.
     * Returns the detected image count.
     */
    function runDetectionAndNotify(): number {
      const currentAdapter = getAdapter(window.location.href);
      if (!currentAdapter) {
        notifyImageCount(0);
        return 0;
      }

      const diag = currentAdapter.inspectDiagnostics();

      logger.logEvent('INFO', 'AUTO_DIAGNOSTIC_SUMMARY', `Diagnostic summary for ${diag.siteName}`, {
        url: window.location.href,
        isReaderPage: diag.isReaderPage,
        containerFound: diag.containerFound || 'None',
        chapterTitle: diag.chapterTitle,
        chapterNumber: diag.chapterNumber,
        detectedImages: diag.imageCount,
        skippedImages: diag.skipCount,
        diagnosticNotes: diag.reasons,
      });

      if (diag.isReaderPage && diag.imageCount > 0) {
        logger.logEvent('INFO', 'AUTO_SCAN_SUCCESS', `Detected ${diag.imageCount} comic images for chapter "${diag.chapterNumber}" of "${diag.chapterTitle}"`, {
          imageCount: diag.imageCount,
          chapter: diag.chapterNumber,
          title: diag.chapterTitle,
        });
        notifyImageCount(diag.imageCount);
      } else {
        logger.logEvent('WARN', 'AUTO_SCAN_WARNING', 'Zero images detected or not a reader page', {
          isReaderPage: diag.isReaderPage,
          imageCount: diag.imageCount,
          reasons: diag.reasons,
        });
        notifyImageCount(0);
      }

      return diag.imageCount;
    }

    // Auto-diagnostic on page load
    const adapter = getAdapter(window.location.href);
    logger.logEvent('DEBUG', 'AUTO_DETECT', 'Auto-detection result on page load', {
      url: window.location.href,
      adapterFound: adapter ? adapter.siteName : 'NONE',
      siteId: adapter?.siteId ?? null,
    });

    // Initial detection attempt
    const initialCount = runDetectionAndNotify();

    // For SPA / lazy-load sites: retry detection if initial scan finds 0 images
    // Uses a combination of scheduled retries + MutationObserver
    if (adapter && initialCount === 0) {
      logger.logEvent('DEBUG', 'LAZY_LOAD_RETRY', 'Initial image count is 0, setting up retry detection for dynamic content');

      // Scheduled retries (500ms, 1.5s, 3s) for pages that render images after DOMContentLoaded
      const retryDelays = [500, 1500, 3000];
      let retryAborted = false;

      for (const delay of retryDelays) {
        setTimeout(() => {
          if (retryAborted) return;
          const count = runDetectionAndNotify();
          if (count > 0) {
            retryAborted = true;
          }
        }, delay);
      }

      // MutationObserver with debounce for truly dynamic SPA rendering
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const observer = new MutationObserver(() => {
        if (retryAborted) {
          observer.disconnect();
          return;
        }
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const count = runDetectionAndNotify();
          if (count > 0) {
            retryAborted = true;
            observer.disconnect();
            logger.logEvent('DEBUG', 'MUTATION_DETECTED_IMAGES', 'MutationObserver found images after DOM changes', { count });
          }
        }, 300);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Safety: disconnect observer after 15 seconds to avoid memory leak
      setTimeout(() => {
        observer.disconnect();
        if (debounceTimer) clearTimeout(debounceTimer);
      }, 15000);
    }
  },
});
