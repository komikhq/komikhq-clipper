/**
 * background.js — Service Worker (Manifest V3)
 *
 * Bertanggung jawab untuk:
 *   1. Menerima daftar URL gambar dari content script (via popup).
 *   2. Fetch blob gambar (bebas CORS karena host_permissions).
 *   3. Membuat file ZIP berurutan menggunakan JSZip.
 *   4. Mengunduh file ZIP via chrome.downloads API.
 */

// Import JSZip library
importScripts("../lib/jszip.min.js");

/**
 * Format nama file berurutan dengan zero-padding.
 * @param {number} index  - Indeks gambar (0-based).
 * @param {number} total  - Total jumlah gambar.
 * @param {string} ext    - Ekstensi file (misal: "webp", "jpg").
 * @returns {string}      - Nama file terformat (misal: "001.webp").
 */
function formatFileName(index, total, ext) {
  const padLength = Math.max(3, String(total).length);
  const paddedIndex = String(index + 1).padStart(padLength, "0");
  return `${paddedIndex}.${ext}`;
}

/**
 * Tentukan ekstensi file dari URL atau Content-Type.
 * @param {string} url         - URL gambar.
 * @param {string} contentType - Content-Type dari response header.
 * @returns {string}
 */
function getExtension(url, contentType) {
  // Coba dari Content-Type
  const mimeMap = {
    "image/webp": "webp",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/avif": "avif",
  };

  if (contentType && mimeMap[contentType]) {
    return mimeMap[contentType];
  }

  // Fallback: dari URL path
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(\w+)$/);
    if (match) return match[1].toLowerCase();
  } catch {
    // ignore
  }

  return "webp"; // default komiku menggunakan webp
}

const FETCH_TIMEOUT_MS = 30000;

/**
 * Fetch semua gambar, buat ZIP, dan trigger download.
 */
async function downloadChapterAsZip(imageUrls, chapterInfo, tabId) {
  const zip = new JSZip();
  const total = imageUrls.length;
  let downloaded = 0;
  let errors = [];

  // Update badge: mulai download
  await chrome.action.setBadgeText({ text: "0%", tabId });
  await chrome.action.setBadgeBackgroundColor({ color: "#4164b2", tabId });

  try {
    await chrome.runtime.sendMessage({
      action: "downloadProgress",
      downloaded: 0,
      total,
      percent: 0,
      currentFile: "Menghubungkan ke server gambar...",
    });
  } catch {
    // Popup mungkin sudah tertutup, tidak masalah.
  }

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: {
          Referer: "https://komiku.org/",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const ext = getExtension(url, contentType);
      const blob = await response.arrayBuffer();
      const fileName = formatFileName(i, total, ext);

      zip.file(fileName, blob);
      downloaded++;

      // Update progress di badge
      const percent = Math.round((downloaded / total) * 100);
      await chrome.action.setBadgeText({ text: `${percent}%`, tabId });

      // Kirim progress ke popup (jika masih terbuka)
      try {
        await chrome.runtime.sendMessage({
          action: "downloadProgress",
          downloaded,
          total,
          percent,
          currentFile: fileName,
        });
      } catch {
        // Popup mungkin sudah tertutup, tidak masalah
      }
    } catch (err) {
      const errorMessage = err.name === "AbortError" ? `Timeout setelah ${FETCH_TIMEOUT_MS / 1000} detik` : err.message;
      errors.push({ index: i, url, error: errorMessage });
      console.warn(`[KomikHQ Clipper] Gagal fetch gambar ${i + 1}:`, errorMessage);
    }
  }

  if (downloaded === 0) {
    await chrome.action.setBadgeText({ text: "ERR", tabId });
    await chrome.action.setBadgeBackgroundColor({ color: "#e74c3c", tabId });
    throw new Error("Tidak ada gambar yang berhasil diunduh.");
  }

  // Generate ZIP
  await chrome.action.setBadgeText({ text: "ZIP", tabId });
  const dataUrl = await zip.generateAsync({ type: "dataurl" });
  const zipFileName = `${chapterInfo.slug}.zip`;

  // Download via chrome.downloads
  const downloadId = await chrome.downloads.download({
    url: dataUrl,
    filename: zipFileName,
    saveAs: false,
  });

  // Clear badge setelah selesai
  await chrome.action.setBadgeText({ text: "✓", tabId });
  await chrome.action.setBadgeBackgroundColor({ color: "#27ae60", tabId });

  // Clear badge setelah 3 detik
  chrome.alarms.create("clearBadge", { delayInMinutes: 0.05 });

  return {
    ok: true,
    downloadId,
    zipFileName,
    downloaded,
    total,
    errors,
  };
}

/**
 * Listener utama untuk pesan dari popup.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadZip") {
    const { imageUrls, chapterInfo, tabId } = message;

    (async () => {
      try {
        const result = await downloadChapterAsZip(imageUrls, chapterInfo, tabId);
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true; // Keeps the message channel open for async response
  }
});

/**
 * Clear badge saat alarm "clearBadge" terpicu.
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "clearBadge") {
    await chrome.action.setBadgeText({ text: "" });
  }
});
