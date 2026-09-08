import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle } from '@phosphor-icons/react';
import type { DownloadProgress } from '@/hooks/useClipperScanner';

interface DownloadProgressCardProps {
  progress: DownloadProgress;
  isDone: boolean;
}

export function DownloadProgressCard({ progress, isDone }: DownloadProgressCardProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {isDone ? 'Berhasil diunduh!' : 'Mengunduh chapter...'}
          </span>
          <span className="text-primary font-bold">{progress.percent}%</span>
        </div>

        <Progress value={progress.percent} className="h-1.5" />

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate max-w-[180px]" title={progress.currentFile}>
            {progress.currentFile}
          </span>
          <span className="font-mono">
            {progress.downloaded} / {progress.total} file
          </span>
        </div>

        {isDone && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium pt-1">
            <CheckCircle weight="fill" className="w-4 h-4 text-emerald-500" />
            <span>Download ZIP Selesai</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
