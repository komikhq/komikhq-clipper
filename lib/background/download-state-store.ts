/**
 * Download State Persistence Store
 *
 * Persists active and recent download states per tab into browser.storage.local
 * so the popup UI can smoothly synchronize when reopened during or after a download.
 */

export interface DownloadState {
  tabId: number;
  state: 'downloading' | 'done' | 'error';
  percent: number;
  downloaded: number;
  total: number;
  currentFile: string;
  zipFileName: string;
  errorMessage?: string;
}

const STATE_PREFIX = 'downloadState_';

export async function setDownloadState(tabId: number, state: DownloadState): Promise<void> {
  const key = `${STATE_PREFIX}${tabId}`;
  await browser.storage.local.set({ [key]: state });
}

export async function getDownloadState(tabId: number): Promise<DownloadState | null> {
  const key = `${STATE_PREFIX}${tabId}`;
  const result = await browser.storage.local.get(key);
  return (result[key] as DownloadState) || null;
}

export async function clearDownloadState(tabId: number): Promise<void> {
  const key = `${STATE_PREFIX}${tabId}`;
  await browser.storage.local.remove(key);
}
