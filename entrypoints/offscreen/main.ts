/**
 * Offscreen Document Script
 *
 * Handles Blob URL creation for chrome.downloads.download in Chromium MV3.
 * Service Workers lack DOM access, so URL.createObjectURL() is unavailable there.
 *
 * Transfers binary data from IndexedDB instead of IPC message passing,
 * completely bypassing the 64 MB message limit and deleting the record instantly.
 */

import { retrieveAndRemoveTempBinary } from '@/lib/download/temp-storage-bridge';

browser.runtime.onMessage.addListener(
  (message: any, _sender: any, sendResponse: (response?: any) => void) => {
    if (message.target !== 'offscreen') return;

    if (message.action === 'createBlobUrlFromStorage') {
      const key = message.key;
      if (!key) {
        sendResponse({ ok: false, error: 'No storage key provided for Blob URL generation' });
        return false;
      }

      // Read from IndexedDB and delete immediately
      retrieveAndRemoveTempBinary(key)
        .then((buffer) => {
          if (!buffer) {
            sendResponse({ ok: false, error: `No binary buffer found in temporary storage for key: ${key}` });
            return;
          }

          try {
            const blob = new Blob([buffer], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            sendResponse({ ok: true, url });
          } catch (err: any) {
            sendResponse({ ok: false, error: err.message || 'Failed to generate Blob URL from buffer' });
          }
        })
        .catch((err: any) => {
          sendResponse({ ok: false, error: err.message || 'Failed to read from temporary storage' });
        });

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
