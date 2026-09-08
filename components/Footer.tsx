import React from 'react';
import packageJson from '@/package.json';

export function Footer() {
  let version = packageJson.version;

  try {
    if (typeof browser !== 'undefined' && browser.runtime?.getManifest) {
      const manifestVersion = browser.runtime.getManifest()?.version;
      if (manifestVersion) {
        version = manifestVersion;
      }
    }
  } catch {
    // Fallback to packageJson.version if runtime manifest is unavailable
  }

  return (
    <div className="text-center text-[10px] text-muted-foreground border-t border-border/60 pt-2.5 mt-auto">
      KomikHQ Clipper v{version}
    </div>
  );
}
