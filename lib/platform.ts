/**
 * Platform & Device Detection Utility
 * Detects whether the extension is running on a Mobile browser (e.g. Kiwi, Lemur, Firefox Android, Orion)
 * or a Desktop browser (Chrome, Firefox, Edge, Brave, etc.) using hybrid UA & capability checks.
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTouch: boolean;
  browserType: 'chrome' | 'firefox' | 'safari' | 'other';
  os: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'other';
}

export function detectDevice(): DeviceInfo {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform = typeof navigator !== 'undefined'
    ? ((navigator as any).userAgentData?.platform || navigator.platform || '')
    : '';

  // Detect Operating System
  const isAndroid = /android/i.test(ua);
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
  const isWindows = /win/i.test(platform);
  const isMac = /mac/i.test(platform) && !isIOS;
  const isLinux = /linux/i.test(platform) && !isAndroid;

  // Detect Browser Engine
  const isFirefox = /firefox|fxios/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios/i.test(ua);
  const isChrome = /chrome|chromium|crios/i.test(ua);

  // Detect Touch / Coarse Pointer input
  const isTouch = typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
  );

  // Determine if running on mobile viewport
  const isMobile = isAndroid || isIOS || (
    isTouch &&
    typeof window !== 'undefined' &&
    window.innerWidth <= 600 &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none)').matches
  );

  return {
    isMobile,
    isTouch,
    browserType: isFirefox ? 'firefox' : isChrome ? 'chrome' : isSafari ? 'safari' : 'other',
    os: isAndroid ? 'android' : isIOS ? 'ios' : isWindows ? 'windows' : isMac ? 'mac' : isLinux ? 'linux' : 'other',
  };
}
