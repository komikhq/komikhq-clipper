import { BaseAdapter, type ChapterInfo } from './base-adapter';



/**
 * KomikcastAdapter — Parser untuk komikcast.cz / komikcast.lol
 *
 * Komikcast juga menggunakan WordPress reader plugin.
 * Struktur: <div id="readerarea"> <img ...> </div>
 */
export class KomikcastAdapter extends BaseAdapter {
  readonly patterns = [/komikcast\.(cz|lol|site|me|net|art|bz|cx|app)/i];

  private static SKIP_PATTERNS = [
    'banner-iklan',
    'logo',
    'avatar',
    'gravatar',
    'wp-content/plugins',
    'wp-includes',
    'discord',
    'blogger.googleusercontent.com',
    '88cdn.cloud',
  ];

  isReaderPage(): boolean {
    const container = document.querySelector('#readerarea, #chapter-images, .main-reading-area, .reader-area');
    if (container) return true;

    if (/chapter[_-]?\d+/i.test(window.location.pathname)) return true;
    return document.querySelectorAll('img').length > 5;
  }

  getChapterInfo(): ChapterInfo {
    let title = 'Unknown';
    let chapter = '000';

    const h1 = document.querySelector('h1.entry-title, h1');
    if (h1) {
      const text = h1.textContent || '';
      const chMatch = text.match(/chapter\s*(\d+(\.\d+)?)/i);
      if (chMatch && chMatch[1]) chapter = chMatch[1];
      title = text.replace(/baca/i, '').replace(/chapter\s*\d+(\.\d+)?/i, '').replace(/bahasa indonesia/i, '').trim();
    }

    if (chapter === '000') {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch && urlMatch[1]) chapter = urlMatch[1];
    }

    if (title === 'Unknown') {
      const breadcrumb = document.querySelector('.breadcrumb li:nth-last-child(2) a');
      if (breadcrumb) title = breadcrumb.textContent?.trim() || title;
    }

    const slug = this.buildSafeSlug(title, chapter);
    return { title, chapter, slug };
  }

  getImageUrls(): string[] {
    const urls: string[] = [];
    const container = document.querySelector('#readerarea, #chapter-images, .main-reading-area, .reader-area');
    const allImgs = (container || document).querySelectorAll('img');

    for (let i = 0; i < allImgs.length; i++) {
      const img = allImgs[i];
      if (!img) continue;

      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
      if (!src.trim()) continue;

      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//') && !src.startsWith('/')) {
        continue;
      }

      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) continue;

      const isSkip = KomikcastAdapter.SKIP_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
      if (isSkip) continue;

      let absoluteUrl = src;
      if (src.startsWith('//')) absoluteUrl = 'https:' + src;
      else if (src.startsWith('/')) absoluteUrl = window.location.origin + src;

      if (!urls.includes(absoluteUrl)) {
        urls.push(absoluteUrl);
      }
    }

    return urls;
  }

  override inspectDiagnostics() {
    const reasons: string[] = [];
    const isReader = this.isReaderPage();

    let containerSelector: string | null = null;
    if (document.querySelector('#readerarea')) containerSelector = '#readerarea';
    else if (document.querySelector('#chapter-images')) containerSelector = '#chapter-images';
    else if (document.querySelector('.main-reading-area')) containerSelector = '.main-reading-area';
    else if (document.querySelector('.reader-area')) containerSelector = '.reader-area';

    const allImgs = document.querySelectorAll('img');
    const validUrls = this.getImageUrls();
    const skipCount = allImgs.length - validUrls.length;

    if (!containerSelector) {
      reasons.push('Standard reader container (#readerarea) not present, falling back to full document scan.');
    }

    if (validUrls.length === 0) {
      reasons.push(`Found ${allImgs.length} total <img> elements, but 0 passed Komikcast filter rules (${skipCount} skipped).`);
    }

    return {
      siteName: 'Komikcast',
      isReaderPage: isReader,
      containerFound: containerSelector,
      imageCount: validUrls.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All Komikcast DOM checks passed successfully.'],
    };
  }
}
