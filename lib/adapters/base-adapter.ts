/**
 * BaseAdapter — Abstract base class for comic site parsers.
 */
export interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

export abstract class BaseAdapter {
  /** Supported URL patterns for this adapter */
  abstract readonly patterns: RegExp[];

  /** Check if adapter matches the given URL */
  matches(url: string): boolean {
    return this.patterns.some((p) => p.test(url));
  }

  /** Check if the current page is a reader/chapter page */
  abstract isReaderPage(): boolean;

  /** Extract chapter metadata */
  abstract getChapterInfo(): ChapterInfo;

  /** Extract image URLs sequentially */
  abstract getImageUrls(): string[];

  /** Referer header for fetching chapter images */
  getReferer(): string {
    return window.location.origin + '/';
  }

  /** Sanitizes title and chapter into a filesystem-safe ZIP slug */
  protected buildSafeSlug(title: string, chapter: string): string {
    const safeTitle = (title || 'Comic').trim();
    const safeChapter = (chapter || '000').trim();

    const slug = `${safeTitle}-Chapter-${safeChapter}`
      .replace(/[^a-zA-Z0-9\-_.]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');

    return slug || 'komikhq-chapter';
  }
}


