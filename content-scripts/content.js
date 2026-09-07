/**
 * content.js — Content Script Manager
 *
 * Script ini berjalan di halaman web target (komiku.org, dll).
 * Bertanggung jawab untuk:
 *   1. Mendeteksi adapter yang sesuai dengan domain saat ini.
 *   2. Menerima pesan dari popup/service-worker.
 *   3. Menjalankan scanning gambar chapter menggunakan adapter terpilih.
 *   4. Mengirim kembali hasil (URL gambar + metadata) ke peminta.
 */
(function () {
  "use strict";

  // Daftar semua adapter yang terdaftar
  const ADAPTERS = [
    typeof KomikuAdapter !== "undefined" ? new KomikuAdapter() : null,
    // Tambahkan adapter baru di sini:
    // typeof WebtoonAdapter !== "undefined" ? new WebtoonAdapter() : null,
  ].filter(Boolean);

  /**
   * Cari adapter yang cocok untuk URL saat ini.
   * @returns {BaseAdapter|null}
   */
  function findAdapter() {
    const url = window.location.href;
    for (const adapter of ADAPTERS) {
      if (adapter.matches(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Listener untuk pesan dari popup atau service worker.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action } = message;

    if (action === "ping") {
      // Health check — apakah content script sudah aktif?
      const adapter = findAdapter();
      sendResponse({
        ok: true,
        hasAdapter: adapter !== null,
        isReaderPage: adapter?.isReaderPage?.() ?? false,
        url: window.location.href,
      });
      return false;
    }

    if (action === "scan") {
      // Pindai gambar chapter dari halaman ini
      const adapter = findAdapter();

      if (!adapter) {
        sendResponse({
          ok: false,
          error: "Tidak ada adapter yang cocok untuk situs ini.",
        });
        return false;
      }

      if (typeof adapter.isReaderPage === "function" && !adapter.isReaderPage()) {
        sendResponse({
          ok: false,
          error: "Halaman ini bukan halaman baca chapter. Buka halaman baca komik terlebih dahulu.",
        });
        return false;
      }

      const chapterInfo = adapter.getChapterInfo();
      const imageUrls = adapter.getImageUrls();

      sendResponse({
        ok: true,
        chapterInfo,
        imageUrls,
        imageCount: imageUrls.length,
      });
      return false;
    }

    // Unknown action
    sendResponse({ ok: false, error: `Aksi tidak dikenal: ${action}` });
    return false;
  });

  // Log inisialisasi (hanya di console, tidak mengganggu halaman)
  console.log("[KomikHQ Clipper] Content script loaded. Adapter:", findAdapter()?.constructor?.name || "none");
})();
