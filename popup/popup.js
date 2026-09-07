/**
 * popup.js — Popup Logic for KomikHQ Clipper
 */

document.addEventListener("DOMContentLoaded", async () => {
  const elLoading = document.getElementById("state-loading");
  const elUnsupported = document.getElementById("state-unsupported");
  const elUnsupportedMsg = document.getElementById("unsupported-msg");
  const elReady = document.getElementById("state-ready");

  const elComicTitle = document.getElementById("comic-title");
  const elSiteBadge = document.getElementById("site-badge");
  const elChapterBadge = document.getElementById("chapter-badge");
  const elImgCount = document.getElementById("img-count");

  const btnDownload = document.getElementById("btn-download");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressStatus = document.getElementById("progress-status");
  const progressPercent = document.getElementById("progress-percent");
  const progressDetail = document.getElementById("progress-detail");

  let scannedData = null;
  let activeTab = null;

  // Show a specific state view
  function showView(viewName) {
    elLoading.classList.add("hidden");
    elUnsupported.classList.add("hidden");
    elReady.classList.add("hidden");

    if (viewName === "loading") elLoading.classList.remove("hidden");
    if (viewName === "unsupported") elUnsupported.classList.remove("hidden");
    if (viewName === "ready") elReady.classList.remove("hidden");
  }

  // Get active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    if (!tab || !tab.url) {
      showView("unsupported");
      return;
    }

    // Try messaging content script
    let response = await sendMessageToTab(tab.id, { action: "scan" });

    // If message fails (content script not injected yet), try injecting dynamically
    if (!response) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            "content-scripts/adapters/base-adapter.js",
            "content-scripts/adapters/komiku.js",
            "content-scripts/content.js",
          ],
        });
        // Retry scanning
        response = await sendMessageToTab(tab.id, { action: "scan" });
      } catch (err) {
        console.warn("[KomikHQ Clipper] Script injection failed:", err);
      }
    }

    if (!response || !response.ok) {
      const errMsg = response?.error || "Pastikan Anda berada di halaman baca komik (misal: komiku.org/one-piece-chapter-xxxx/).";
      elUnsupportedMsg.textContent = errMsg;
      showView("unsupported");
      return;
    }

    // Data scanned successfully!
    scannedData = response;
    const { chapterInfo, imageUrls } = response;
    const host = new URL(tab.url).hostname.replace("www.", "");

    elComicTitle.textContent = chapterInfo.title || "Judul Komik";
    elSiteBadge.textContent = host;
    elChapterBadge.textContent = `Ch. ${chapterInfo.chapter || "0"}`;
    elImgCount.textContent = imageUrls.length;

    showView("ready");
  } catch (err) {
    console.error("[KomikHQ Clipper] Error initializing popup:", err);
    showView("unsupported");
  }

  // Helper to send message to tab
  function sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });
  }

  function getExtension(url, contentType) {
    const mimeMap = {
      "image/webp": "webp",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/avif": "avif",
    };

    if (mimeMap[contentType]) return mimeMap[contentType];

    try {
      const match = new URL(url).pathname.match(/\.(\w+)$/);
      if (match) return match[1].toLowerCase();
    } catch {
      // Gunakan ekstensi default di bawah.
    }

    return "webp";
  }

  async function fetchImage(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        headers: { Referer: "https://komiku.org/" },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        data: await response.arrayBuffer(),
        extension: getExtension(url, response.headers.get("content-type") || ""),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function downloadChapterAsZip() {
    const zip = new JSZip();
    const { imageUrls, chapterInfo } = scannedData;
    let downloaded = 0;
    const errors = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const fileName = `${String(i + 1).padStart(Math.max(3, String(imageUrls.length).length), "0")}`;

      try {
        const image = await fetchImage(imageUrls[i]);
        zip.file(`${fileName}.${image.extension}`, image.data);
        downloaded++;
        const percent = Math.round((downloaded / imageUrls.length) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
        progressStatus.textContent = `Mengunduh... (${fileName}.${image.extension})`;
        progressDetail.textContent = `${downloaded} / ${imageUrls.length} file`;
      } catch (err) {
        const message = err.name === "AbortError" ? "Timeout setelah 30 detik" : err.message;
        errors.push(`${i + 1}: ${message}`);
        console.warn(`[KomikHQ Clipper] Gagal fetch gambar ${i + 1}:`, message);
      }
    }

    if (downloaded === 0) throw new Error("Tidak ada gambar yang berhasil diunduh.");

    progressStatus.textContent = "Membuat file ZIP...";
    const blob = await zip.generateAsync({ type: "blob" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${chapterInfo.slug}.zip`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);

    return { downloaded, total: imageUrls.length, zipFileName: anchor.download, errors };
  }

  // Listen for progress updates from background service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "downloadProgress") {
      const { downloaded, total, percent, currentFile } = message;
      progressContainer.classList.remove("hidden");
      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressStatus.textContent = `Mengunduh... (${currentFile})`;
      progressDetail.textContent = `${downloaded} / ${total} file`;
    }
  });

  // Handle Download button click
  btnDownload.addEventListener("click", async () => {
    if (!scannedData || !activeTab) return;

    btnDownload.disabled = true;
    progressContainer.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";
    progressStatus.textContent = "Menyiapkan unduhan...";
    progressDetail.textContent = `0 / ${scannedData.imageUrls.length} file`;

    try {
      const result = await downloadChapterAsZip();

      if (result) {
        progressBar.style.width = "100%";
        progressPercent.textContent = "100%";
        progressStatus.textContent = "Berhasil diunduh!";
        progressDetail.textContent = `${result.downloaded} file -> ${result.zipFileName}`;
      } else {
        progressStatus.textContent = "Gagal: Terjadi kesalahan.";
        btnDownload.disabled = false;
      }
    } catch (err) {
      console.error("[KomikHQ Clipper] Download error:", err);
      progressStatus.textContent = "❌ Gagal mengunduh: " + err.message;
      btnDownload.disabled = false;
    }
  });
});
