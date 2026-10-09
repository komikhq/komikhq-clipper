import { useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('Popup');

export type ViewState = 'loading' | 'unsupported' | 'ready' | 'downloading' | 'done';

export interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

export interface ScanResult {
  ok: boolean;
  error?: string;
  chapterInfo: ChapterInfo;
  imageUrls: string[];
  imageCount: number;
  referer: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  currentFile: string;
}

export function useClipperScanner() {
  const [view, setView] = useState<ViewState>('loading');
  const [scanData, setScanData] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState<DownloadProgress>({
    downloaded: 0,
    total: 0,
    percent: 0,
    currentFile: '',
  });
  const [host, setHost] = useState('');
  const [tabId, setTabId] = useState<number | null>(null);
  const [convertToWebp, setConvertToWebpState] = useState(true);

  useEffect(() => {
    logger.info('Initializing popup scanner hook...');
    initPopup();

    // Load persisted WebP preference
    browser.storage.local.get('convertToWebp').then((result) => {
      if (typeof result.convertToWebp === 'boolean') {
        setConvertToWebpState(result.convertToWebp);
      }
    });

    const listener = (message: any) => {
      if (message.action === 'downloadProgress') {
        logger.debug('Download progress update:', message);
        setProgress({
          downloaded: message.downloaded,
          total: message.total,
          percent: message.percent,
          currentFile: message.currentFile,
        });
      }
      if (message.action === 'downloadComplete') {
        logger.info('Download complete notification received:', message.zipFileName);
        setProgress((p) => ({ ...p, percent: 100, currentFile: message.zipFileName }));
        setView('done');
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  async function initPopup() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        logger.warn('No active tab found or missing tab URL');
        setErrorMsg('Tidak dapat mengakses tab aktif.');
        setView('unsupported');
        return;
      }

      setTabId(tab.id);
      const parsedHost = new URL(tab.url).hostname.replace('www.', '');
      setHost(parsedHost);
      logger.debug('Active tab identified:', { tabId: tab.id, host: parsedHost, url: tab.url });

      // Check if there is an active download for this tab (state syncing)
      try {
        const downloadState = await browser.runtime.sendMessage({
          action: 'getDownloadState',
          tabId: tab.id,
        });

        if (downloadState) {
          logger.info('Resuming display of active download state:', downloadState);

          if (downloadState.state === 'downloading') {
            // There's an active download — show progress
            setProgress({
              downloaded: downloadState.downloaded,
              total: downloadState.total,
              percent: downloadState.percent,
              currentFile: downloadState.currentFile,
            });

            // We still need scan data for the ChapterCard, try to get it
            await attemptScan(tab.id);
            setView('downloading');
            return;
          }

          if (downloadState.state === 'done') {
            setProgress({
              downloaded: downloadState.downloaded,
              total: downloadState.total,
              percent: 100,
              currentFile: downloadState.zipFileName,
            });
            await attemptScan(tab.id);
            setView('done');
            return;
          }
        }
      } catch {
        // No active download state or message failed — continue with normal scan
      }

      // Normal flow: scan the page
      await attemptScan(tab.id);
    } catch (err: any) {
      logger.error('Error in initPopup:', err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setView('unsupported');
    }
  }

  /**
   * Attempts to scan the page for chapter info and images.
   * Sets the view to 'ready' on success or 'unsupported' on failure.
   * Used both for normal init and for recovering scan data when resuming download state.
   */
  async function attemptScan(currentTabId: number): Promise<void> {
    let response: ScanResult | null = null;
    try {
      response = await browser.tabs.sendMessage(currentTabId, { action: 'scan' });
    } catch (err: any) {
      logger.debug('Initial scan message failed, attempting content script injection...', err.message);
      try {
        await browser.scripting.executeScript({
          target: { tabId: currentTabId },
          files: ['/content-scripts/content.js'],
        });
        response = await browser.tabs.sendMessage(currentTabId, { action: 'scan' });
      } catch (injectErr: any) {
        logger.warn('Content script injection failed:', injectErr.message);
        console.error('[KomikHQ:Popup] Content script injection error:', injectErr);
      }
    }

    if (!response?.ok) {
      logger.warn('Scan response not OK:', response?.error);
      const errMsg = response?.error || 'Content script is not active on this page. Please refresh (F5) the comic tab.';
      console.warn('[KomikHQ:Popup] Scan failed with error:', errMsg);
      setErrorMsg(errMsg);
      // Only set unsupported if we're not already showing download state
      if (view === 'loading') {
        setView('unsupported');
      }
      return;
    }

    logger.info('Scan successful in popup:', { chapter: response.chapterInfo.chapter, count: response.imageCount });
    setScanData(response);

    // Only transition to 'ready' if we're not already in a download-related state
    if (view === 'loading') {
      setView('ready');
    }
  }

  function setConvertToWebp(value: boolean) {
    setConvertToWebpState(value);
    browser.storage.local.set({ convertToWebp: value });
    logger.debug('WebP conversion preference updated:', value);
  }

  async function handleDownload() {
    if (!scanData || tabId === null) return;
    logger.info('User initiated download:', { chapter: scanData.chapterInfo.slug, total: scanData.imageUrls.length, convertToWebp });
    setView('downloading');
    setProgress({ downloaded: 0, total: scanData.imageUrls.length, percent: 0, currentFile: 'Preparing...' });

    try {
      const result = await browser.runtime.sendMessage({
        action: 'downloadZip',
        imageUrls: scanData.imageUrls,
        chapterInfo: scanData.chapterInfo,
        tabId,
        referer: scanData.referer,
        convertToWebp,
      });

      if (result?.ok) {
        logger.info('Download completed successfully:', result.zipFileName);
        // Background has already saved the file via chrome.downloads.download!
        // No need for DOM hack (anchor.click) anymore.
        setProgress((p) => ({ ...p, percent: 100, currentFile: result.zipFileName }));
        setView('done');
      } else {
        logger.error('Background download failed:', result?.error);
        setErrorMsg(result?.error || 'Failed to download chapter.');
        setView('unsupported');
      }
    } catch (err: any) {
      logger.error('Error sending download message to background:', err);
      setErrorMsg(err.message || 'Failed to download chapter.');
      setView('unsupported');
    }
  }

  return {
    view,
    scanData,
    errorMsg,
    progress,
    host,
    tabId,
    convertToWebp,
    setConvertToWebp,
    handleDownload,
    retryScan: initPopup,
  };
}
