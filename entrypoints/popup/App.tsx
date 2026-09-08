import React from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Header } from '@/components/Header';
import { ChapterCard } from '@/components/ChapterCard';
import { DownloadProgressCard } from '@/components/DownloadProgressCard';
import { StatusMessageCard } from '@/components/StatusMessageCard';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { DownloadSimple } from '@phosphor-icons/react';
import { useClipperScanner } from '@/hooks/useClipperScanner';

function ClipperContent() {
  const {
    view,
    scanData,
    errorMsg,
    progress,
    host,
    handleDownload,
    retryScan,
  } = useClipperScanner();

  return (
    <div className="flex flex-col gap-3.5 p-4 min-h-[300px] bg-background text-foreground transition-colors duration-200">
      <Header />

      {/* Loading state */}
      {view === 'loading' && <StatusMessageCard type="loading" />}

      {/* Unsupported page state */}
      {view === 'unsupported' && (
        <StatusMessageCard
          type="unsupported"
          message={errorMsg}
          onRetry={retryScan}
        />
      )}

      {/* Ready / Downloading / Done states */}
      {(view === 'ready' || view === 'downloading' || view === 'done') && scanData && (
        <>
          <ChapterCard scanData={scanData} host={host} />

          {/* Action button */}
          {view === 'ready' && (
            <Button
              onClick={handleDownload}
              className="w-full gap-2 font-semibold shadow-sm transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
            >
              <DownloadSimple weight="fill" className="w-4 h-4" />
              Unduh Chapter (.zip)
            </Button>
          )}

          {/* Download progress card */}
          {(view === 'downloading' || view === 'done') && (
            <DownloadProgressCard
              progress={progress}
              isDone={view === 'done'}
            />
          )}
        </>
      )}

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ClipperContent />
    </ThemeProvider>
  );
}
