import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Images, Archive } from '@phosphor-icons/react';
import type { ScanResult } from '@/hooks/useClipperScanner';

interface ChapterCardProps {
  scanData: ScanResult;
  host: string;
}

export function ChapterCard({ scanData, host }: ChapterCardProps) {
  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm shadow-sm">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-[11px] font-mono">
            {host}
          </Badge>
          <Badge variant="outline" className="text-[11px] text-amber-500 border-amber-500/30 font-semibold">
            Ch. {scanData.chapterInfo.chapter}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <h2 className="text-sm font-semibold truncate mb-2 text-foreground" title={scanData.chapterInfo.title}>
          {scanData.chapterInfo.title}
        </h2>
        <div className="flex gap-4 border-t border-border/60 pt-2">
          <div className="flex items-center gap-1.5">
            <Images weight="fill" className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">{scanData.imageCount}</span>
            <span className="text-[10px] text-muted-foreground">Gambar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Archive weight="fill" className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">ZIP</span>
            <span className="text-[10px] text-muted-foreground">Output</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
