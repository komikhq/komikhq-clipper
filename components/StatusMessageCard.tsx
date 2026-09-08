import React from 'react';
import { CircleNotch, Warning, ArrowClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface StatusMessageCardProps {
  type: 'loading' | 'unsupported';
  message?: string;
  onRetry?: () => void;
}

export function StatusMessageCard({ type, message, onRetry }: StatusMessageCardProps) {
  if (type === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <CircleNotch weight="fill" className="w-7 h-7 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Memindai halaman komik...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500">
        <Warning weight="fill" className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Bukan Halaman Baca</h3>
        <p className="text-xs text-muted-foreground px-2 leading-relaxed">
          {message || 'Pastikan Anda berada di halaman baca komik yang didukung (misal: komiku.org).'}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-1 gap-1.5 text-xs font-medium border-border"
        >
          <ArrowClockwise weight="bold" className="w-3.5 h-3.5" />
          Coba Pindai Lagi
        </Button>
      )}
    </div>
  );
}
