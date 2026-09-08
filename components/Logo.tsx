import React from 'react';
import { useTheme } from './ThemeProvider';

interface LogoProps {
  className?: string;
}

export function Logo({ className = 'w-7 h-7' }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === 'dark' ? '/logo-mark-dark.svg' : '/logo-mark-light.svg';

  return (
    <img
      src={logoSrc}
      alt="KomikHQ Logo"
      className={`object-contain transition-opacity duration-200 ${className}`}
    />
  );
}
