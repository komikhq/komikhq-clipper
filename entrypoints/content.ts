import { getAdapter } from '@/lib/adapters/registry';

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
          sendResponse({
            ok: false,
            error: 'Tidak ada adapter yang cocok untuk situs ini.',
          });
          return false;
        }

        if (!adapter.isReaderPage()) {
          sendResponse({
            ok: false,
            error: 'Halaman ini bukan halaman baca chapter. Buka halaman baca komik terlebih dahulu.',
          });
          return false;
        }

        const chapterInfo = adapter.getChapterInfo();
        const imageUrls = adapter.getImageUrls();
        const referer = adapter.getReferer();

        sendResponse({
          ok: true,
          chapterInfo,
          imageUrls,
          imageCount: imageUrls.length,
          referer,
        });
        return false;
      }

      sendResponse({ ok: false, error: `Aksi tidak dikenal: ${action}` });
      return false;
    });

    const adapter = getAdapter(window.location.href);
    console.log('[KomikHQ Clipper] Content script loaded. Adapter:', adapter?.constructor?.name || 'none');
  },
});
