import React from 'react';
import { Sun, Moon, Desktop } from '@phosphor-icons/react';
import { useTheme } from './ThemeProvider';
import type { Theme } from './ThemeProvider';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const modes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(theme);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
    const nextTheme = modes[nextIndex] ?? 'system';
    setTheme(nextTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun weight="fill" className="w-4 h-4 text-amber-500" />;
      case 'dark':
        return <Moon weight="fill" className="w-4 h-4 text-indigo-400" />;
      case 'system':
        return <Desktop weight="fill" className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Desktop weight="fill" className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Tema Terang (Klik untuk ganti)';
      case 'dark':
        return 'Tema Gelap (Klik untuk ganti)';
      case 'system':
        return 'Tema Sistem (Klik untuk ganti)';
      default:
        return 'Ganti Tema';
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={getLabel()}
      className="w-8 h-8 rounded-full border border-border/50 hover:bg-accent transition-colors"
      aria-label={getLabel()}
    >
      {getIcon()}
    </Button>
  );
}
