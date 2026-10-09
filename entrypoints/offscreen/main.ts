/**
 * Offscreen Document Script
 *
 * Handles Blob URL creation for chrome.downloads.download in Chromium MV3.
 * Service Workers lack DOM access, so URL.createObjectURL() is unavailable there.
 * This offscreen document provides the DOM context needed for Blob creation.
 */

browser.runtime.onMessage.addListener(
  (message: any, _sender: any, sendResponse: (response?: any) => void) => {
    if (message.target !== 'offscreen') return;

    if (message.action === 'createBlobUrl') {
      try {
        const byteArray = new Uint8Array(message.data);
        const blob = new Blob([byteArray], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        sendResponse({ ok: true, url });
      } catch (err: any) {
        sendResponse({ ok: false, error: err.message || 'Failed to create Blob URL' });
      }
      return true; // Keep message channel open for async response
    }

    if (message.action === 'revokeBlobUrl') {
      try {
        if (message.url) {
          URL.revokeObjectURL(message.url);
        }
        sendResponse({ ok: true });
      } catch (err: any) {
        sendResponse({ ok: false, error: err.message });
      }
      return true;
    }
  }
);
