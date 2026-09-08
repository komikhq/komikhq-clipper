import { BaseAdapter, type ChapterInfo } from './base-adapter';

/**
 * KomikuAdapter — Parser untuk komiku.org / komiku.id
 *
 * Struktur halaman baca:
 *   <div id="Baca_Komik">
 *     <img class="klazy ww" src="..." alt="... gambar N">
 *   </div>
 */
export class KomikuAdapter extends BaseAdapter {
  readonly patterns = [/komiku\.(org|id|to)/i];

  private static PROMO_PATTERNS = [
    'komiku-promosi',
    // 'ads',
    '/asset/',
    'komikuplus',
    'gstatic.com',
    'gravatar.com',
    'lazy.jpg',
  ];

  isReaderPage(): boolean {
    return document.getElementById('Baca_Komik') !== null;
  }

  getChapterInfo(): ChapterInfo {
    const metaEl = document.querySelector('[data-series-title]');
    const chapterInfoEl = document.querySelector('span.chapterInfo');

    let title = 'Unknown';
    let chapter = '000';

    if (metaEl) {
      title = metaEl.getAttribute('data-series-title') || title;
      const chapterTitle = metaEl.getAttribute('data-chapter-title') || '';
      const match = chapterTitle.match(/(\d+(\.\d+)?)/);
      if (match && match[1]) chapter = match[1];
    }

    if (chapterInfoEl) {
      const valChapter = chapterInfoEl.getAttribute('valueChapter');
      if (valChapter) chapter = valChapter;
    }

    if (chapter === '000') {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch && urlMatch[1]) chapter = urlMatch[1];
    }

    if (title === 'Unknown') {
      const h1 = document.querySelector('h1');
      if (h1) {
        title = h1.textContent?.replace(/chapter\s*\d+(\.\d+)?/i, '').trim() || title;
      }
    }

    const slug = `${title}-Chapter-${chapter}`
      .replace(/[^a-zA-Z0-9\-_.]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

    return { title, chapter, slug };
  }

  getImageUrls(): string[] {
    const container = document.getElementById('Baca_Komik');
    if (!container) return [];

    const allImgs = Array.from(container.querySelectorAll('img'));
    const urls: string[] = [];

    for (const img of allImgs) {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || '';
      if (!src.trim()) continue;

      const isPromo = KomikuAdapter.PROMO_PATTERNS.some((p) =>
        src.toLowerCase().includes(p.toLowerCase()),
      );
      if (isPromo) continue;

      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) continue;

      const hasChapterClass = img.classList.contains('klazy') || img.classList.contains('ww');
      const isKomikuImage = /image\d*\.komiku\.to|img\.komiku\.org/.test(src);

      if (hasChapterClass || isKomikuImage) {
        let absoluteUrl = src;
        if (src.startsWith('//')) absoluteUrl = 'https:' + src;
        else if (src.startsWith('/')) absoluteUrl = window.location.origin + src;
        urls.push(absoluteUrl);
      }
    }

    return urls;
  }

  override getReferer(): string {
    return 'https://komiku.org/';
  }
}
