/**
 * Chromium Offscreen Document Lifecycle Manager
 *
 * Manages the creation and teardown of an offscreen document
 * required for DOM APIs (like URL.createObjectURL) in Chromium Manifest V3.
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('OffscreenManager');

function getChromeOffscreenApi(): any {
  const chromeGlobal = (globalThis as any).chrome;
  return chromeGlobal?.offscreen ? chromeGlobal.offscreen : null;
}

/**
 * Checks whether the Chromium offscreen API is available in the current runtime.
 */
export function isOffscreenSupported(): boolean {
  return getChromeOffscreenApi() !== null;
}

/**
 * Ensures that an offscreen document is active. If already open, succeeds silently.
 */
export async function ensureOffscreenDocument(): Promise<void> {
  const offscreenApi = getChromeOffscreenApi();
  if (!offscreenApi) return;

  const chromeGlobal = (globalThis as any).chrome;

  try {
    // Check if offscreen document already exists
    if (typeof offscreenApi.hasDocument === 'function') {
      const hasDoc = await offscreenApi.hasDocument();
      if (hasDoc) return;
    } else if (typeof chromeGlobal?.runtime?.getContexts === 'function') {
      const contexts = await chromeGlobal.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });
      if (contexts && contexts.length > 0) return;
    }
  } catch {
    // If probing fails, proceed to attempt creation
  }

  try {
    await offscreenApi.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Create Blob URL for chapter ZIP file download',
    });
    logger.logEvent('DEBUG', 'OFFSCREEN_CREATED', 'Offscreen document created for Blob URL handling');
  } catch (err: any) {
    // "Only a single offscreen document may be created" is expected if already open
    if (!err.message?.includes('single offscreen')) {
      logger.logEvent('WARN', 'OFFSCREEN_CREATE_FAILED', 'Failed to create offscreen document', {}, err);
      throw err;
    }
  }
}

/**
 * Closes the offscreen document to release browser memory.
 */
export async function closeOffscreenDocument(): Promise<void> {
  const offscreenApi = getChromeOffscreenApi();
  if (!offscreenApi) return;

  try {
    await offscreenApi.closeDocument();
    logger.logEvent('DEBUG', 'OFFSCREEN_CLOSED', 'Offscreen document successfully closed');
  } catch (err: any) {
    // Harmless if the document is already closed
    logger.logEvent('DEBUG', 'OFFSCREEN_CLOSE_SKIPPED', 'Offscreen document already closed or not found', {}, err);
  }
}
