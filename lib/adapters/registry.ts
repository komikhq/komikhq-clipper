import { BaseAdapter } from './base-adapter';
import { KomikuAdapter } from './komiku';
import { KiryuuAdapter } from './kiryuu';

/**
 * Registry adapter — auto-detect site based on current URL.
 */
const adapters: BaseAdapter[] = [
  new KomikuAdapter(),
  new KiryuuAdapter(),
];

export function getAdapter(url: string): BaseAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}

export function getSupportedSites(): string[] {
  return ['komiku.org', 'komiku.id', 'kiryuu.to', 'kiryuu.io'];
}
