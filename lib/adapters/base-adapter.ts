/**
 * BaseAdapter -- Abstract base class for comic site parsers.
 *
 * Provides:
 * - URL pattern matching
 * - Scoped structured logger (via createLogger('Adapter:<siteId>'))
 * - Standard diagnostic inspection with event emission
 * - Helper methods for emitting match, extraction, and skip events
 */
import { createLogger, type Logger } from '../logger';

export interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

export interface AdapterDiagnosticReport {
  siteId: string;
  siteName: string;
  timestamp: string;
  isReaderPage: boolean;
  containerFound: string | null;
  chapterTitle: string;
  chapterNumber: string;
  safeSlug: string;
  imageCount: number;
  skipCount: number;
  reasons: string[];
}

export abstract class BaseAdapter {
  /** Supported URL patterns for this adapter */
  abstract readonly patterns: RegExp[];

  /** Short machine-readable identifier (e.g., 'komiku', 'kiryuu', 'ainzscans') */
  abstract readonly siteId: string;

  /** Human-readable site name (e.g., 'Komiku', 'Kiryuu') */
  abstract readonly siteName: string;

  /** Scoped logger instance bound to this adapter */
  protected readonly logger: Logger;

  constructor() {
    // Use a temporary siteId reference; subclass fields are set before super()
    // returns in modern ES class semantics. However, since abstract fields are
    // not available during the base constructor, we lazily initialize the
    // logger on first access instead.
    this.logger = null as unknown as Logger;
  }

  /** Lazy-initialize logger on first access so siteId is available. */
  protected getLogger(): Logger {
    if (!this.logger) {
      (this as any).logger = createLogger(`Adapter:${this.siteId}`);
    }
    return this.logger;
  }

  /** Check if adapter matches the given URL */
  matches(url: string): boolean {
    const log = this.getLogger();
    const matched = this.patterns.some((p) => p.test(url));
    if (matched) {
      log.logEvent('DEBUG', 'ADAPTER_MATCH_SUCCESS', `Pattern matched for ${this.siteId}`, {
        url,
        siteId: this.siteId,
      });
    }
    return matched;
  }

  /** Check if the current page is a reader/chapter page */
  abstract isReaderPage(): boolean;

  /** Extract chapter metadata */
  abstract getChapterInfo(): ChapterInfo;

  /** Extract image URLs sequentially */
  abstract getImageUrls(): string[];

  // -------------------------------------------------------------------------
  // Diagnostic Inspection
  // -------------------------------------------------------------------------

  /**
   * Site-specific detailed diagnostic report.
   * Subclasses should override buildDiagnosticReport() for custom logic.
   */
  inspectDiagnostics(): AdapterDiagnosticReport {
    const log = this.getLogger();
    const report = this.buildDiagnosticReport();
    log.logEvent('INFO', 'DIAGNOSTIC_INSPECTION_RUN', 'Ran adapter diagnostics', {
      siteId: report.siteId,
      isReaderPage: report.isReaderPage,
      containerFound: report.containerFound,
      imageCount: report.imageCount,
      skipCount: report.skipCount,
      reasons: report.reasons,
    });
    return report;
  }

  /**
   * Override this in subclasses to produce site-specific diagnostic data.
   * The default returns a minimal placeholder report.
   */
  protected buildDiagnosticReport(): AdapterDiagnosticReport {
    return {
      siteId: this.siteId,
      siteName: this.siteName,
      timestamp: new Date().toISOString(),
      isReaderPage: this.isReaderPage(),
      containerFound: null,
      chapterTitle: 'Unknown',
      chapterNumber: '000',
      safeSlug: '',
      imageCount: 0,
      skipCount: 0,
      reasons: ['Diagnostic inspection not implemented for this adapter.'],
    };
  }

  // -------------------------------------------------------------------------
  // Logging Helpers (for use by subclasses)
  // -------------------------------------------------------------------------

  /** Log a successful extraction summary. */
  protected logExtractionSummary(totalImages: number, validImages: number, skipped: number): void {
    const log = this.getLogger();
    log.logEvent('INFO', 'IMAGES_EXTRACTED_SUMMARY', `Extracted ${validImages} valid images, skipped ${skipped}`, {
      totalImages,
      validImages,
      skipped,
    });
  }

  /** Log a skipped image element with a reason. */
  protected logImageSkipped(index: number, src: string, reason: string): void {
    const log = this.getLogger();
    log.logEvent('WARN', 'IMAGE_SKIPPED', `Image at index ${index} skipped: ${reason}`, {
      index,
      src: src.substring(0, 200),
      reason,
    });
  }

  /** Log a missing container error. */
  protected logContainerMissing(selectors: string[]): void {
    const log = this.getLogger();
    log.logEvent('ERROR', 'CONTAINER_MISSING', 'Reader container not found in DOM', {
      evaluatedSelectors: selectors,
      readyState: typeof document !== 'undefined' ? document.readyState : 'unknown',
    });
  }

  /** Log a found container. */
  protected logContainerFound(selector: string): void {
    const log = this.getLogger();
    log.logEvent('DEBUG', 'CONTAINER_FOUND', `Reader container located: ${selector}`, {
      selector,
    });
  }

  /** Log chapter info extraction results. */
  protected logChapterInfo(info: ChapterInfo, partial: boolean): void {
    const log = this.getLogger();
    if (partial) {
      log.logEvent('WARN', 'CHAPTER_INFO_PARTIAL', 'Chapter metadata partially extracted', {
        title: info.title,
        chapter: info.chapter,
        slug: info.slug,
      });
    } else {
      log.logEvent('INFO', 'CHAPTER_INFO_EXTRACTED', 'Chapter metadata extracted', {
        title: info.title,
        chapter: info.chapter,
        slug: info.slug,
      });
    }
  }

  /** Log reader page detection result. */
  protected logReaderPageCheck(isReader: boolean, details?: Record<string, unknown>): void {
    const log = this.getLogger();
    log.logEvent('DEBUG', 'READER_PAGE_CHECK', `Reader page detected: ${isReader}`, {
      isReader,
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      ...details,
    });
  }

  // -------------------------------------------------------------------------
  // Referer & Slug Utilities
  // -------------------------------------------------------------------------

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
