import { BaseAdapter, type ChapterInfo } from './base-adapter';



/**
 * KiryuuAdapter — Parser untuk kiryuu.id / kiryuu.org
 *
 * Kiryuu menggunakan WordPress reader plugin.
 * Struktur: <div id="readerarea"> <img ...> </div>
 */
export class KiryuuAdapter extends BaseAdapter {
  readonly patterns = [/kiryuu\.(id|org|io|to)/i];

  private static SKIP_PATTERNS = [
    'banner-iklan',
    'logo-kiryuu',
    'cropped-logo',
    'avatar',
    'gravatar',
    'wp-content/plugins',
    'wp-includes',
    'blogger.googleusercontent.com',
    '88cdn.cloud',
    'hokidewa',
    'idks',
    'hp-gaza',
    'hp-penta',
    'hp-indo',
    'apps.png',
  ];

  isReaderPage(): boolean {
    const container = document.querySelector('section[data-image-data], #readerarea, #ch-images, .reading-content, .reader-area');
    if (container) return true;

    // Fallback DOM check: URL contains chapter path or page contains multiple images
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

    const slug = this.buildSafeSlug(title, chapter);
    return { title, chapter, slug };
  }

  getImageUrls(): string[] {
    const urls: string[] = [];
    
    // Target container strictly from DOM structure, fallback to full document
    const container = document.querySelector('section[data-image-data], #readerarea, #ch-images, .reading-content, .reader-area');
    const allImgs = (container || document).querySelectorAll('img');

    for (let i = 0; i < allImgs.length; i++) {
      const img = allImgs[i];
      if (!img) continue;

      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
      if (!src.trim()) continue;

      // Filter out non-http/https strings
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//') && !src.startsWith('/')) {
        continue;
      }

      // Filter out small UI icons, avatars, or logos by dimension if available
      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) continue;

      // Minimal skip for site UI assets (logo/avatar/plugins)
      const isSkip = KiryuuAdapter.SKIP_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
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
    if (document.querySelector('section[data-image-data]')) containerSelector = 'section[data-image-data]';
    else if (document.querySelector('#readerarea')) containerSelector = '#readerarea';
    else if (document.querySelector('#ch-images')) containerSelector = '#ch-images';
    else if (document.querySelector('.reading-content')) containerSelector = '.reading-content';
    else if (document.querySelector('.reader-area')) containerSelector = '.reader-area';

    const allImgs = document.querySelectorAll('img');
    const validUrls = this.getImageUrls();
    const skipCount = allImgs.length - validUrls.length;

    if (!containerSelector) {
      reasons.push('Standard reader container (#readerarea) not present, falling back to full document scan.');
    }

    if (validUrls.length === 0) {
      reasons.push(`Found ${allImgs.length} total <img> elements, but 0 passed Kiryuu filter rules (${skipCount} skipped).`);
    }

    return {
      siteName: 'Kiryuu (kiryuu.to)',
      isReaderPage: isReader,
      containerFound: containerSelector,
      imageCount: validUrls.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All Kiryuu DOM checks passed successfully.'],
    };
  }
}
