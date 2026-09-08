import { BaseAdapter } from './base-adapter';
import { KomikuAdapter } from './komiku';
import { KiryuuAdapter } from './kiryuu';
import { KomikcastAdapter } from './komikcast';

/**
 * Registry adapter — auto-detect situs berdasarkan URL.
 */
const adapters: BaseAdapter[] = [
  new KomikuAdapter(),
  new KiryuuAdapter(),
  new KomikcastAdapter(),
];

export function getAdapter(url: string): BaseAdapter | null {
  return adapters.find((a) => a.matches(url)) ?? null;
}

export function getSupportedSites(): string[] {
  return ['komiku.org', 'komiku.id', 'kiryuu.id', 'komikcast.cz'];
}
