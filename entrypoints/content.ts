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

    // Auto-diagnostic on page load
    const adapter = getAdapter(window.location.href);
    logger.logEvent('DEBUG', 'AUTO_DETECT', 'Auto-detection result on page load', {
      url: window.location.href,
      adapterFound: adapter ? adapter.siteName : 'NONE',
      siteId: adapter?.siteId ?? null,
    });

    if (adapter) {
      const diag = adapter.inspectDiagnostics();

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
      } else {
        logger.logEvent('WARN', 'AUTO_SCAN_WARNING', 'Zero images detected or not a reader page', {
          isReaderPage: diag.isReaderPage,
          imageCount: diag.imageCount,
          reasons: diag.reasons,
        });
      }
    }
  },
});
