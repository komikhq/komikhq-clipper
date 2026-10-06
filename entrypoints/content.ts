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
  ],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const { action } = message;
      logger.debug('Message received from popup:', action);

      if (action === 'ping') {
        const adapter = getAdapter(window.location.href);
        sendResponse({
          ok: true,
          hasAdapter: adapter !== null,
          isReaderPage: adapter?.isReaderPage() ?? false,
          url: window.location.href,
        });
        return false;
      }

      if (action === 'scan') {
        const adapter = getAdapter(window.location.href);

        if (!adapter) {
          logger.warn('No matching adapter found for URL:', window.location.href);
          sendResponse({
            ok: false,
            error: 'Tidak ada adapter yang cocok untuk situs ini.',
          });
          return false;
        }

        if (!adapter.isReaderPage()) {
          logger.warn('Page is not a comic reader page:', window.location.href);
          sendResponse({
            ok: false,
            error: 'Halaman ini bukan halaman baca chapter. Buka halaman baca komik terlebih dahulu.',
          });
          return false;
        }

        console.log('[KomikHQ:Content] Received scan request on URL:', window.location.href);
        const chapterInfo = adapter.getChapterInfo();
        const imageUrls = adapter.getImageUrls();
        const referer = adapter.getReferer();

        console.log('[KomikHQ:Content] Scan details:', {
          adapter: adapter.constructor.name,
          isReaderPage: adapter.isReaderPage(),
          chapterInfo,
          imageCount: imageUrls.length,
          urlsSample: imageUrls.slice(0, 5),
        });

        logger.info('Scan successful:', { chapter: chapterInfo.chapter, imageCount: imageUrls.length });

        sendResponse({
          ok: true,
          chapterInfo,
          imageUrls,
          imageCount: imageUrls.length,
          referer,
        });
        return false;
      }

      logger.warn('Unknown message action:', action);
      sendResponse({ ok: false, error: `Aksi tidak dikenal: ${action}` });
      return false;
    });

    const adapter = getAdapter(window.location.href);
    console.log('[KomikHQ:Content] Content script loaded on page:', window.location.href);
    console.log('[KomikHQ:Content] Detected Adapter:', adapter ? adapter.constructor.name : 'NONE (URL matched but no adapter matched)');

    if (adapter) {
      const isReader = adapter.isReaderPage();
      const diag = adapter.inspectDiagnostics();

      console.log(`[KomikHQ:${diag.siteName}] Auto-Scan Diagnostic Summary:`, {
        url: window.location.href,
        isReaderPage: diag.isReaderPage,
        containerFound: diag.containerFound || 'None',
        detectedImages: diag.imageCount,
        skippedImages: diag.skipCount,
        diagnosticNotes: diag.reasons,
      });

      if (isReader && diag.imageCount > 0) {
        const info = adapter.getChapterInfo();
        const urls = adapter.getImageUrls();
        console.log(`[KomikHQ:${diag.siteName}] SCAN SUCCESS: Detected ${urls.length} comic images for chapter "${info.chapter}" of "${info.title}".`);
      } else {
        console.warn(`[KomikHQ:${diag.siteName}] SCAN WARNING / FAILURE: 0 images detected or not a reader page. Reasons:`, diag.reasons);
      }
    }
  },
});

