import { BaseAdapter, type ChapterInfo } from './base-adapter';

/**
 * AinzScansAdapter — Parser for ainzscans domains (e.g., v3.ainzscans01.com).
 *
 * Site Structure: SvelteKit SPA.
 * Chapter URLs: /comic/{slug}/chapter/{chapter-slug}
 * Reading Images: Embedded with alt="Page X" inside main container divs.
 */
export class AinzScansAdapter extends BaseAdapter {
  readonly patterns = [/ainzscans\d*\.(com|id|net|org)/i];

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
    if (window.location.pathname.includes('/chapter/')) return true;
    return document.querySelectorAll('img[alt^="Page "]').length > 0;
  }

  getChapterInfo(): ChapterInfo {
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
    } else {
      const pathMatch = window.location.pathname.match(/chapter[-_](\d+(\.\d+)?)/i);
      if (pathMatch && pathMatch[1]) chapter = pathMatch[1];
    }

    const slug = this.buildSafeSlug(title, chapter);
    return { title, chapter, slug };
  }

  getImageUrls(): string[] {
    const urls: string[] = [];
    const allImgs = document.querySelectorAll('img');

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

      const isSkip = AinzScansAdapter.SKIP_PATTERNS.some((p) => src.toLowerCase().includes(p.toLowerCase()));
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
    const allImgs = document.querySelectorAll('img');
    const validUrls = this.getImageUrls();
    const skipCount = allImgs.length - validUrls.length;

    if (!isReader) {
      reasons.push('Current URL path does not contain "/chapter/" and no page images detected.');
    }

    if (validUrls.length === 0) {
      reasons.push(`Found ${allImgs.length} total <img> elements, but 0 passed AinzScans filter rules (${skipCount} skipped).`);
    }

    return {
      siteName: 'AinzScans',
      isReaderPage: isReader,
      containerFound: 'img[alt^="Page "]',
      imageCount: validUrls.length,
      skipCount,
      reasons: reasons.length > 0 ? reasons : ['All AinzScans DOM checks passed successfully.'],
    };
  }
}
