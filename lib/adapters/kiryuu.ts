import { BaseAdapter, type ChapterInfo, type AdapterDiagnosticReport } from './base-adapter';

/**
 * KiryuuAdapter -- Parser for kiryuu.id / kiryuu.org / kiryuu.io / kiryuu.to
 *
 * Uses WordPress reader plugin.
 * DOM structure: <div id="readerarea"> <img ...> </div>
 */
export class KiryuuAdapter extends BaseAdapter {
  readonly patterns = [/kiryuu\.(id|org|io|to)/i];
  readonly siteId = 'kiryuu';
  readonly siteName = 'Kiryuu';

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

  private static CONTAINER_SELECTORS = [
    'section[data-image-data]',
    '#readerarea',
    '#ch-images',
    '.reading-content',
    '.reader-area',
  ];

  isReaderPage(): boolean {
    const container = document.querySelector(KiryuuAdapter.CONTAINER_SELECTORS.join(', '));
    if (container) {
      this.logReaderPageCheck(true, { method: 'container-selector' });
      return true;
    }

    // Fallback DOM check: URL contains chapter path or page contains multiple images
    if (/chapter[_-]?\d+/i.test(window.location.pathname)) {
      this.logReaderPageCheck(true, { method: 'url-path-match' });
      return true;
    }

    const imgCount = document.querySelectorAll('img').length;
    const result = imgCount > 5;
    this.logReaderPageCheck(result, { method: 'image-count-heuristic', imgCount });
    return result;
  }

  getChapterInfo(): ChapterInfo {
    const log = this.getLogger();
    let title = 'Unknown';
    let chapter = '000';

    const h1 = document.querySelector('h1.entry-title, h1');
    if (h1) {
      const text = h1.textContent || '';
      const chMatch = text.match(/chapter\s*(\d+(\.\d+)?)/i);
      if (chMatch && chMatch[1]) chapter = chMatch[1];
      title = text.replace(/baca/i, '').replace(/chapter\s*\d+(\.\d+)?/i, '').replace(/bahasa indonesia/i, '').trim();
      log.logEvent('DEBUG', 'H1_METADATA', 'Extracted metadata from h1 element', { rawText: text, title, chapter });
    }

    if (chapter === '000') {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch && urlMatch[1]) {
        chapter = urlMatch[1];
        log.logEvent('DEBUG', 'CHAPTER_FROM_URL', 'Chapter number extracted from URL path', { chapter });
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
    const urls: string[] = [];

    // Find the reader container
    let containerSelector: string | null = null;
    let container: Element | null = null;
    for (const sel of KiryuuAdapter.CONTAINER_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        container = el;
        containerSelector = sel;
        break;
      }
    }

    if (containerSelector) {
      this.logContainerFound(containerSelector);
    } else {
      log.logEvent('WARN', 'CONTAINER_FALLBACK', 'Reader container not found, falling back to full document scan', {
        evaluatedSelectors: KiryuuAdapter.CONTAINER_SELECTORS,
      });
    }

    const allImgs = (container || document).querySelectorAll('img');
    let skipped = 0;

    for (let i = 0; i < allImgs.length; i++) {
      const img = allImgs[i];
      if (!img) continue;

      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
      if (!src.trim()) {
        this.logImageSkipped(i, src, 'Empty or blank src attribute');
        skipped++;
        continue;
      }

      // Filter out non-http/https strings
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//') && !src.startsWith('/')) {
        this.logImageSkipped(i, src, 'Non-HTTP protocol or data URI');
        skipped++;
        continue;
      }

      // Filter out small UI icons, avatars, or logos by dimension if available
      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) {
        this.logImageSkipped(i, src, `Image dimensions too small (${width}x${height})`);
        skipped++;
        continue;
      }

      // Minimal skip for site UI assets (logo/avatar/plugins)
      const isSkip = KiryuuAdapter.SKIP_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
      if (isSkip) {
        this.logImageSkipped(i, src, 'Matched site UI asset skip pattern');
        skipped++;
        continue;
      }

      let absoluteUrl = src;
      if (src.startsWith('//')) absoluteUrl = 'https:' + src;
      else if (src.startsWith('/')) absoluteUrl = window.location.origin + src;

      if (!urls.includes(absoluteUrl)) {
        urls.push(absoluteUrl);
      }
    }

    this.logExtractionSummary(allImgs.length, urls.length, skipped);
    return urls;
  }

  protected override buildDiagnosticReport(): AdapterDiagnosticReport {
    const isReader = this.isReaderPage();
    const info = this.getChapterInfo();

    let containerSelector: string | null = null;
    for (const sel of KiryuuAdapter.CONTAINER_SELECTORS) {
      if (document.querySelector(sel)) {
        containerSelector = sel;
        break;
      }
    }

    const allImgs = document.querySelectorAll('img');
    const validUrls = this.getImageUrls();
    const skipCount = allImgs.length - validUrls.length;

    const reasons: string[] = [];
    if (!containerSelector) {
      reasons.push('Standard reader container (#readerarea) not present, falling back to full document scan.');
    }
    if (validUrls.length === 0) {
      reasons.push(`Found ${allImgs.length} total <img> elements, but 0 passed Kiryuu filter rules (${skipCount} skipped).`);
    }

    return {
      siteId: this.siteId,
      siteName: `${this.siteName} (kiryuu.to)`,
      timestamp: new Date().toISOString(),
      isReaderPage: isReader,
      containerFound: containerSelector,
      chapterTitle: info.title,
      chapterNumber: info.chapter,
      safeSlug: info.slug,
      imageCount: validUrls.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All Kiryuu DOM checks passed successfully.'],
    };
  }
}
