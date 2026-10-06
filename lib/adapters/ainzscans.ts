import { BaseAdapter, type ChapterInfo, type AdapterDiagnosticReport } from './base-adapter';

/**
 * AinzScansAdapter -- Parser for ainzscans domains (e.g., v3.ainzscans01.com).
 *
 * Site Structure: SvelteKit SPA.
 * Chapter URLs: /comic/{slug}/chapter/{chapter-slug}
 * Reading Images: Embedded with alt="Page X" inside main container divs.
 */
export class AinzScansAdapter extends BaseAdapter {
  readonly patterns = [/ainzscans\d*\.(com|id|net|org)/i];
  readonly siteId = 'ainzscans';
  readonly siteName = 'AinzScans';

  private static SKIP_PATTERNS = [
    'blogger.googleusercontent.com',
    'comment-reactions',
    'ezgif',
    'avatar',
    'logo',
    'gravatar',
    'discord',
  ];

  isReaderPage(): boolean {
    const hasChapterPath = window.location.pathname.includes('/chapter/');
    if (hasChapterPath) {
      this.logReaderPageCheck(true, { method: 'url-path-contains-chapter' });
      return true;
    }
    const pageImgCount = document.querySelectorAll('img[alt^="Page "]').length;
    const result = pageImgCount > 0;
    this.logReaderPageCheck(result, { method: 'page-image-alt-scan', pageImgCount });
    return result;
  }

  getChapterInfo(): ChapterInfo {
    const log = this.getLogger();
    let title = 'Unknown';
    let chapter = '000';

    // Extract from document.title: "Title - Chapter (179) - Bahasa Indonesia | Ainz Scans ID"
    const docTitle = document.title || '';
    const matchTitle = docTitle.match(/^(.+?)\s*-\s*chapter\s*\(?/i);
    if (matchTitle && matchTitle[1]) {
      title = matchTitle[1].trim();
    }

    const matchCh = docTitle.match(/chapter\s*\(?(\d+(\.\d+)?)\)?/i);
    if (matchCh && matchCh[1]) {
      chapter = matchCh[1];
      log.logEvent('DEBUG', 'CHAPTER_FROM_TITLE', 'Chapter number extracted from document title', {
        docTitle,
        chapter,
      });
    } else {
      const pathMatch = window.location.pathname.match(/chapter[-_](\d+(\.\d+)?)/i);
      if (pathMatch && pathMatch[1]) {
        chapter = pathMatch[1];
        log.logEvent('DEBUG', 'CHAPTER_FROM_URL', 'Chapter number extracted from URL path', { chapter });
      }
    }

    if (title !== 'Unknown') {
      log.logEvent('DEBUG', 'TITLE_FROM_DOC_TITLE', 'Title extracted from document title', { docTitle, title });
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
    const allImgs = document.querySelectorAll('img');
    let skipped = 0;

    log.logEvent('DEBUG', 'IMAGE_SCAN_START', `Scanning ${allImgs.length} <img> elements on page`, {
      totalElements: allImgs.length,
    });

    for (let i = 0; i < allImgs.length; i++) {
      const img = allImgs[i];
      if (!img) continue;

      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
      if (!src.trim()) {
        this.logImageSkipped(i, src, 'Empty or blank src attribute');
        skipped++;
        continue;
      }

      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//') && !src.startsWith('/')) {
        this.logImageSkipped(i, src, 'Non-HTTP protocol or data URI');
        skipped++;
        continue;
      }

      const width = parseInt(img.getAttribute('width') || '0', 10);
      const height = parseInt(img.getAttribute('height') || '0', 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) {
        this.logImageSkipped(i, src, `Image dimensions too small (${width}x${height})`);
        skipped++;
        continue;
      }

      const isSkip = AinzScansAdapter.SKIP_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
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
    const allImgs = document.querySelectorAll('img');
    const validUrls = this.getImageUrls();
    const skipCount = allImgs.length - validUrls.length;

    const reasons: string[] = [];
    if (!isReader) {
      reasons.push('Current URL path does not contain "/chapter/" and no page images detected.');
    }
    if (validUrls.length === 0) {
      reasons.push(`Found ${allImgs.length} total <img> elements, but 0 passed AinzScans filter rules (${skipCount} skipped).`);
    }

    return {
      siteId: this.siteId,
      siteName: this.siteName,
      timestamp: new Date().toISOString(),
      isReaderPage: isReader,
      containerFound: isReader ? 'img[alt^="Page "]' : null,
      chapterTitle: info.title,
      chapterNumber: info.chapter,
      safeSlug: info.slug,
      imageCount: validUrls.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All AinzScans DOM checks passed successfully.'],
    };
  }
}
