import { BaseAdapter } from './base-adapter';
import { KomikuAdapter } from './komiku';
import { KiryuuAdapter } from './kiryuu';
import { AinzScansAdapter } from './ainzscans';
import { createLogger } from '../logger';

const logger = createLogger('Registry');

/**
 * Registry adapter -- auto-detect site based on current URL.
 */
const adapters: BaseAdapter[] = [
  new KomikuAdapter(),
  new KiryuuAdapter(),
  new AinzScansAdapter(),
];

export function getAdapter(url: string): BaseAdapter | null {
  logger.logEvent('DEBUG', 'ADAPTER_MATCH_ATTEMPT', `Attempting to match URL against ${adapters.length} adapters`, {
    url,
    adapterCount: adapters.length,
  });

  const matched = adapters.find((a) => a.matches(url)) ?? null;

  if (matched) {
    logger.logEvent('INFO', 'ADAPTER_MATCH_SUCCESS', `Matched adapter: ${matched.siteName}`, {
      url,
      siteId: matched.siteId,
      siteName: matched.siteName,
    });
  } else {
    logger.logEvent('WARN', 'ADAPTER_MATCH_FAILED', 'No adapter matched the given URL', {
      url,
      testedAdapters: adapters.map((a) => a.siteId),
    });
  }

  return matched;
}

export function getSupportedSites(): string[] {
  return [
    'komiku.org',
    'komiku.id',
    'komiku.to',
    'kiryuu.id',
    'kiryuu.org',
    'kiryuu.io',
    'kiryuu.to',
    'ainzscans01.com',
    'ainzscans.com',
  ];
}
