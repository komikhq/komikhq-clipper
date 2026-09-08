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
    '*://*.komikcast.cz/*',
    '*://*.komikcast.lol/*',
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

        const chapterInfo = adapter.getChapterInfo();
        const imageUrls = adapter.getImageUrls();
        const referer = adapter.getReferer();

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
    logger.info('Content script loaded. Adapter:', adapter?.constructor?.name || 'none');
  },
});

