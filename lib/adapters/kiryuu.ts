import { BaseAdapter, type ChapterInfo } from './base-adapter';

/**
 * KiryuuAdapter — Parser untuk kiryuu.id / kiryuu.org
 *
 * Kiryuu menggunakan WordPress reader plugin.
 * Struktur: <div id="readerarea"> <img ...> </div>
 */
export class KiryuuAdapter extends BaseAdapter {
  readonly patterns = [/kiryuu\.(id|org)/i];

  private static SKIP_PATTERNS = [
    'ads',
    'banner',
    'promo',
    'icon',
    'logo',
    'avatar',
    'gravatar',
    'wp-content/plugins',
    'wp-includes',
  ];

  isReaderPage(): boolean {
    return document.getElementById('readerarea') !== null;
  }

  getChapterInfo(): ChapterInfo {
    let title = 'Unknown';
    let chapter = '000';

    // Coba dari <h1> atau breadcrumb
    const h1 = document.querySelector('h1.entry-title');
    if (h1) {
      const text = h1.textContent || '';
      // "Manga Title Chapter 123" -> extract
      const chMatch = text.match(/chapter\s*(\d+(\.\d+)?)/i);
      if (chMatch && chMatch[1]) chapter = chMatch[1];
      title = text.replace(/chapter\s*\d+(\.\d+)?/i, '').replace(/bahasa indonesia/i, '').trim();
    }

    // Fallback: parse URL
    if (chapter === '000') {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch && urlMatch[1]) chapter = urlMatch[1];
    }

    if (title === 'Unknown') {
      const breadcrumb = document.querySelector('.breadcrumb li:nth-last-child(2) a');
      if (breadcrumb) title = breadcrumb.textContent?.trim() || title;
    }

    const slug = `${title}-Chapter-${chapter}`
      .replace(/[^a-zA-Z0-9\-_.]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

    return { title, chapter, slug };
  }

  getImageUrls(): string[] {
    const container = document.getElementById('readerarea');
    if (!container) return [];

    const allImgs = container.querySelectorAll('img');
    const urls: string[] = [];

    for (const img of allImgs) {
      const src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || '';
      if (!src.trim()) continue;

      const isSkip = KiryuuAdapter.SKIP_PATTERNS.some((p) =>
        src.toLowerCase().includes(p.toLowerCase()),
      );
      if (isSkip) continue;

      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) continue;

      let absoluteUrl = src;
      if (src.startsWith('//')) absoluteUrl = 'https:' + src;
      else if (src.startsWith('/')) absoluteUrl = window.location.origin + src;

      urls.push(absoluteUrl);
    }

    return urls;
  }
}
