import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Images,
  FileArchive,
} from 'lucide-react';

type ViewState = 'loading' | 'unsupported' | 'ready' | 'downloading' | 'done';

interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

interface ScanResult {
  ok: boolean;
  error?: string;
  chapterInfo: ChapterInfo;
  imageUrls: string[];
  imageCount: number;
  referer: string;
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  currentFile: string;
}

export default function App() {
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
    initPopup();
    const listener = (message: any) => {
      if (message.action === 'downloadProgress') {
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
        setErrorMsg('Tidak dapat mengakses tab aktif.');
        setView('unsupported');
        return;
      }

      setTabId(tab.id);
      setHost(new URL(tab.url).hostname.replace('www.', ''));

      let response: ScanResult | null = null;
      try {
        response = await browser.tabs.sendMessage(tab.id, { action: 'scan' });
      } catch {
        // Content script belum aktif, inject dulu
        try {
          await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
          response = await browser.tabs.sendMessage(tab.id, { action: 'scan' });
        } catch {
          // ignore
        }
      }

      if (!response?.ok) {
        setErrorMsg(
          response?.error ||
            'Pastikan Anda berada di halaman baca komik (misal: komiku.org).',
        );
        setView('unsupported');
        return;
      }

      setScanData(response);
      setView('ready');
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan.');
      setView('unsupported');
    }
  }

  async function handleDownload() {
    if (!scanData || tabId === null) return;
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
        setProgress((p) => ({ ...p, percent: 100, currentFile: result.zipFileName }));
        setView('done');
      } else {
        setErrorMsg(result?.error || 'Gagal mengunduh.');
        setView('unsupported');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunduh.');
      setView('unsupported');
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-border">
        <img src="/icon/128.png" alt="Logo" className="w-7 h-7 rounded-md" />
        <div>
          <h1 className="text-sm font-bold flex items-center gap-1.5">
            KomikHQ
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              Clipper
            </Badge>
          </h1>
          <p className="text-[11px] text-muted-foreground">Chapter Image Fetcher</p>
        </div>
      </div>

      {/* Loading */}
      {view === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memindai halaman...</p>
        </div>
      )}

      {/* Unsupported */}
      {view === 'unsupported' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500" />
          <h3 className="text-sm font-semibold">Bukan Halaman Baca</h3>
          <p className="text-xs text-muted-foreground px-2">{errorMsg}</p>
        </div>
      )}

      {/* Ready */}
      {(view === 'ready' || view === 'downloading' || view === 'done') && scanData && (
        <>
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[11px]">
                  {host}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-yellow-500 border-yellow-500/30">
                  Ch. {scanData.chapterInfo.chapter}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <h2 className="text-sm font-semibold truncate mb-2">
                {scanData.chapterInfo.title}
              </h2>
              <div className="flex gap-4 border-t border-border pt-2">
                <div className="flex items-center gap-1.5">
                  <Images className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold">{scanData.imageCount}</span>
                  <span className="text-[10px] text-muted-foreground">Gambar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileArchive className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold">ZIP</span>
                  <span className="text-[10px] text-muted-foreground">Output</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Download Button */}
          {view === 'ready' && (
            <Button onClick={handleDownload} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Unduh Chapter (.zip)
            </Button>
          )}

          {/* Progress */}
          {(view === 'downloading' || view === 'done') && (
            <Card className="border-border">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {view === 'done' ? 'Berhasil diunduh!' : 'Mengunduh...'}
                  </span>
                  <span className="text-primary font-bold">{progress.percent}%</span>
                </div>
                <Progress value={progress.percent} className="h-1.5" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[180px]">{progress.currentFile}</span>
                  <span>{progress.downloaded} / {progress.total} file</span>
                </div>
                {view === 'done' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-500 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Download selesai</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-muted-foreground border-t border-border pt-2">
        KomikHQ Clipper v2.0.0
      </div>
    </div>
  );
}
