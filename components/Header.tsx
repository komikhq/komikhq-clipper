import React from 'react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from '@/components/ui/badge';

export function Header() {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-border">
      <div className="flex items-center gap-2.5">
        <Logo className="w-7 h-7" />
        <div>
          <h1 className="text-sm font-bold flex items-center gap-1.5 leading-none">
            KomikHQ
            <Badge variant="default" className="text-[10px] px-1.5 py-0 font-medium">
              Clipper
            </Badge>
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Chapter Image Fetcher</p>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}
