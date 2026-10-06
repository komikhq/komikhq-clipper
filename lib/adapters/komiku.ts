import { BaseAdapter, type ChapterInfo, type AdapterDiagnosticReport } from './base-adapter';

/**
 * KomikuAdapter -- Parser for komiku.org / komiku.id / komiku.to
 *
 * DOM structure for reader pages:
 *   <div id="Baca_Komik">
 *     <img class="klazy ww" src="..." alt="... gambar N">
 *   </div>
 */
export class KomikuAdapter extends BaseAdapter {
  readonly patterns = [/komiku\.(org|id|to)/i];
  readonly siteId = 'komiku';
  readonly siteName = 'Komiku';

  private static PROMO_PATTERNS = [
    'komiku-promosi',
    '/asset/',
    'komikuplus',
    'gstatic.com',
    'gravatar.com',
    'lazy.jpg',
  ];

  private static READER_SELECTOR = 'Baca_Komik';

  isReaderPage(): boolean {
    const found = document.getElementById(KomikuAdapter.READER_SELECTOR) !== null;
    this.logReaderPageCheck(found, { selector: `#${KomikuAdapter.READER_SELECTOR}` });
    return found;
  }

  getChapterInfo(): ChapterInfo {
    const log = this.getLogger();
    const metaEl = document.querySelector('[data-series-title]');
    const chapterInfoEl = document.querySelector('span.chapterInfo');

    let title = 'Unknown';
    let chapter = '000';

    if (metaEl) {
      title = metaEl.getAttribute('data-series-title') || title;
      const chapterTitle = metaEl.getAttribute('data-chapter-title') || '';
      const match = chapterTitle.match(/(\d+(\.\d+)?)/);
      if (match && match[1]) chapter = match[1];
      log.logEvent('DEBUG', 'META_ELEMENT_FOUND', 'Extracted metadata from data-series-title element', {
        title,
        chapterTitle,
        chapter,
      });
    }

    if (chapterInfoEl) {
      const valChapter = chapterInfoEl.getAttribute('valueChapter');
      if (valChapter) {
        chapter = valChapter;
        log.logEvent('DEBUG', 'CHAPTER_INFO_ELEMENT', 'Chapter number overridden from chapterInfo element', {
          valueChapter: valChapter,
        });
      }
    }

    if (chapter === '000') {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch && urlMatch[1]) {
        chapter = urlMatch[1];
        log.logEvent('DEBUG', 'CHAPTER_FROM_URL', 'Chapter number extracted from URL path', { chapter });
      }
    }

    if (title === 'Unknown') {
      const h1 = document.querySelector('h1');
      if (h1) {
        title = h1.textContent?.replace(/chapter\s*\d+(\.\d+)?/i, '').trim() || title;
        log.logEvent('DEBUG', 'TITLE_FROM_H1', 'Title fallback extracted from h1 element', { title });
      }
    }

    const slug = this.buildSafeSlug(title, chapter);
    const info: ChapterInfo = { title, chapter, slug };
    const isPartial = title === 'Unknown' || chapter === '000';
    this.logChapterInfo(info, isPartial);
    return info;
  }

  getImageUrls(): string[] {
    const log = this.getLogger();
    const container = document.getElementById(KomikuAdapter.READER_SELECTOR);

    if (!container) {
      this.logContainerMissing([`#${KomikuAdapter.READER_SELECTOR}`]);
      return [];
    }

    this.logContainerFound(`#${KomikuAdapter.READER_SELECTOR}`);
    const allImgs = Array.from(container.querySelectorAll('img'));
    const urls: string[] = [];
    let skipped = 0;

    for (let i = 0; i < allImgs.length; i++) {
      const img = allImgs[i]!;
      const src =
        img.getAttribute('data-src') ||
        img.getAttribute('data-lazy-src') ||
        img.getAttribute('src') ||
        '';

      if (!src.trim()) {
        this.logImageSkipped(i, src, 'Empty or blank src attribute');
        skipped++;
        continue;
      }

      const isPromo = KomikuAdapter.PROMO_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
      if (isPromo) {
        this.logImageSkipped(i, src, 'Matched promotional/ad URL pattern');
        skipped++;
        continue;
      }

      let absoluteUrl = src;
      if (src.startsWith('//')) absoluteUrl = 'https:' + src;
      else if (src.startsWith('/')) absoluteUrl = window.location.origin + src;

      urls.push(absoluteUrl);
    }

    this.logExtractionSummary(allImgs.length, urls.length, skipped);
    return urls;
  }

  protected override buildDiagnosticReport(): AdapterDiagnosticReport {
    const isReader = this.isReaderPage();
    const container = document.getElementById(KomikuAdapter.READER_SELECTOR);
    const info = this.getChapterInfo();
    const images = this.getImageUrls();
    const allImgs = container ? container.querySelectorAll('img').length : 0;
    const skipCount = allImgs - images.length;

    const reasons: string[] = [];
    if (!container) {
      reasons.push(`Reader container #${KomikuAdapter.READER_SELECTOR} not found in DOM.`);
    }
    if (images.length === 0 && allImgs > 0) {
      reasons.push(`Found ${allImgs} total <img> elements but all were filtered out.`);
    }

    return {
      siteId: this.siteId,
      siteName: this.siteName,
      timestamp: new Date().toISOString(),
      isReaderPage: isReader,
      containerFound: container ? `#${KomikuAdapter.READER_SELECTOR}` : null,
      chapterTitle: info.title,
      chapterNumber: info.chapter,
      safeSlug: info.slug,
      imageCount: images.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All Komiku DOM checks passed successfully.'],
    };
  }

  override getReferer(): string {
    return 'https://komiku.org/';
  }
}
