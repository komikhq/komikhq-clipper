import { createLogger } from '@/lib/logger';

const logger = createLogger('ExtensionAPI');

/**
 * Safe accessor for Action / BrowserAction Toolbar API.
 * Supports Chrome MV3, Firefox MV2 / MV3, and mobile browsers.
 */
export function getActionApi() {
  if (typeof browser !== 'undefined') {
    return browser.action || (browser as any).browserAction;
  }
  const globalChrome = (globalThis as any).chrome;
  if (globalChrome) {
    return globalChrome.action || globalChrome.browserAction;
  }
  return null;
}

/**
 * Safely updates badge text without throwing uncaught exceptions on any platform.
 */
export async function setBadgeText(text: string, tabId?: number): Promise<void> {
  try {
    const action = getActionApi();
    if (action && typeof action.setBadgeText === 'function') {
      if (tabId !== undefined) {
        await action.setBadgeText({ text, tabId });
      } else {
        await action.setBadgeText({ text });
      }
    }
  } catch (err) {
    logger.debug('setBadgeText ignored or failed:', err);
  }
}

/**
 * Safely updates badge background color without throwing uncaught exceptions.
 */
export async function setBadgeBackgroundColor(color: string, tabId?: number): Promise<void> {
  try {
    const action = getActionApi();
    if (action && typeof action.setBadgeBackgroundColor === 'function') {
      if (tabId !== undefined) {
        await action.setBadgeBackgroundColor({ color, tabId });
      } else {
        await action.setBadgeBackgroundColor({ color });
      }
    }
  } catch (err) {
    logger.debug('setBadgeBackgroundColor ignored or failed:', err);
  }
}
