/**
 * Toolbar Badge Manager
 *
 * Manages action icon badge text and background colors across tab states:
 * - Detected image count on chapter pages (Indigo)
 * - Download progress percentages (Blue)
 * - Compression in progress (Blue: 'ZIP')
 * - Success completion (Green: 'OK')
 * - Errors (Red: 'ERR')
 */

import { setBadgeText, setBadgeBackgroundColor } from '@/lib/extension-api';
import { getDownloadState } from './download-state-store';
import { createLogger } from '@/lib/logger';

const logger = createLogger('BadgeManager');

export const BADGE_COLOR_DETECT = '#4f46e5';   // Indigo - image count detected
export const BADGE_COLOR_PROGRESS = '#3b82f6'; // Blue - download in progress
export const BADGE_COLOR_SUCCESS = '#10b981';  // Green - download complete
export const BADGE_COLOR_ERROR = '#ef4444';    // Red - download failed

// In-memory store for detected image counts per tab (restored after download)
const tabImageCounts = new Map<number, number>();

export function setTabDetectedCount(tabId: number, count: number): void {
  tabImageCounts.set(tabId, count);
}

export function getTabDetectedCount(tabId: number): number | undefined {
  return tabImageCounts.get(tabId);
}

export function removeTabDetectedCount(tabId: number): void {
  tabImageCounts.delete(tabId);
}

/**
 * Sets badge to show detected image count for a tab.
 * Skips update if an active download is running.
 */
export async function setImageCountBadge(tabId: number, count: number): Promise<void> {
  const downloadState = await getDownloadState(tabId);
  if (downloadState && downloadState.state === 'downloading') return;

  if (count > 0) {
    await setBadgeText(String(count), tabId);
    await setBadgeBackgroundColor(BADGE_COLOR_DETECT, tabId);
  } else {
    await setBadgeText('', tabId);
  }
}

/**
 * Sets badge to show download progress percentage (e.g. '45%').
 */
export async function setProgressBadge(tabId: number, percent: number): Promise<void> {
  await setBadgeText(`${percent}%`, tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_PROGRESS, tabId);
}

/**
 * Sets badge to 'ZIP' during archive compression.
 */
export async function setZipBadge(tabId: number): Promise<void> {
  await setBadgeText('ZIP', tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_PROGRESS, tabId);
}

/**
 * Sets badge to 'OK' upon successful download completion,
 * and schedules badge restoration after 5 seconds.
 */
export async function setSuccessBadge(tabId: number): Promise<void> {
  await setBadgeText('OK', tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_SUCCESS, tabId);

  // Restore previous count badge after 5 seconds
  browser.alarms.create(`clearBadge_${tabId}`, { delayInMinutes: 5 / 60 });
}

/**
 * Sets badge to 'ERR' when a download pipeline failure occurs.
 */
export async function setErrorBadge(tabId: number): Promise<void> {
  await setBadgeText('ERR', tabId);
  await setBadgeBackgroundColor(BADGE_COLOR_ERROR, tabId);
}

/**
 * Restores the detected image count badge for a tab after the completion alarm fires.
 */
export async function restoreImageCountBadge(tabId: number): Promise<void> {
  const count = tabImageCounts.get(tabId);
  if (count && count > 0) {
    await setBadgeText(String(count), tabId);
    await setBadgeBackgroundColor(BADGE_COLOR_DETECT, tabId);
  } else {
    await setBadgeText('', tabId);
  }
}
