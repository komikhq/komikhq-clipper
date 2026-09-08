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

  useEffect(() => {
    logger.info('Initializing popup scanner hook...');
    initPopup();
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

      let response: ScanResult | null = null;
      try {
        response = await browser.tabs.sendMessage(tab.id, { action: 'scan' });
      } catch (err: any) {
        logger.debug('Initial scan message failed, attempting content script injection...', err.message);
        // Content script belum aktif, inject dulu
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
          response = await browser.tabs.sendMessage(tab.id, { action: 'scan' });
        } catch (injectErr: any) {
          logger.warn('Content script injection failed:', injectErr.message);
        }
      }

      if (!response?.ok) {
        logger.warn('Scan response not OK:', response?.error);
        setErrorMsg(
          response?.error ||
            'Pastikan Anda berada di halaman baca komik (misal: komiku.org).',
        );
        setView('unsupported');
        return;
      }

      logger.info('Scan successful in popup:', { chapter: response.chapterInfo.chapter, count: response.imageCount });
      setScanData(response);
      setView('ready');
    } catch (err: any) {
      logger.error('Error in initPopup:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan.');
      setView('unsupported');
    }
  }

  async function handleDownload() {
    if (!scanData || tabId === null) return;
    logger.info('User initiated download:', { chapter: scanData.chapterInfo.slug, total: scanData.imageUrls.length });
    setView('downloading');
    setProgress({ downloaded: 0, total: scanData.imageUrls.length, percent: 0, currentFile: 'Menyiapkan...' });

    try {
      const result = await browser.runtime.sendMessage({
        action: 'downloadZip',
        imageUrls: scanData.imageUrls,
        chapterInfo: scanData.chapterInfo,
        tabId,
        referer: scanData.referer,
      });

      if (result?.ok) {
        logger.info('Download completed successfully:', result.zipFileName);
        setProgress((p) => ({ ...p, percent: 100, currentFile: result.zipFileName }));
        setView('done');
      } else {
        logger.error('Background download failed:', result?.error);
        setErrorMsg(result?.error || 'Gagal mengunduh.');
        setView('unsupported');
      }
    } catch (err: any) {
      logger.error('Error sending download message to background:', err);
      setErrorMsg(err.message || 'Gagal mengunduh.');
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
    handleDownload,
    retryScan: initPopup,
  };
}

