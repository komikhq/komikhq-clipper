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
      const result = await chrome.runtime.sendMessage({
        action: "downloadZip",
        imageUrls: scannedData.imageUrls,
        chapterInfo: scannedData.chapterInfo,
        tabId: activeTab.id,
      });

      if (result && result.ok) {
        progressBar.style.width = "100%";
        progressPercent.textContent = "100%";
        progressStatus.textContent = "✅ Berhasil Diunduh!";
        progressDetail.textContent = `${result.downloaded} file -> ${result.zipFileName}`;
      } else {
        progressStatus.textContent = "❌ Gagal: " + (result?.error || "Terjadi kesalahan.");
        btnDownload.disabled = false;
      }
    } catch (err) {
      console.error("[KomikHQ Clipper] Download error:", err);
      progressStatus.textContent = "❌ Gagal mengunduh: " + err.message;
      btnDownload.disabled = false;
    }
  });
});
