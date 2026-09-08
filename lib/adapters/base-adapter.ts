/**
 * BaseAdapter — Interface untuk semua adapter situs komik.
 */
export interface ChapterInfo {
  title: string;
  chapter: string;
  slug: string;
}

export abstract class BaseAdapter {
  /** URL patterns yang didukung adapter ini */
  abstract readonly patterns: RegExp[];

  /** Cek apakah adapter cocok untuk URL ini */
  matches(url: string): boolean {
    return this.patterns.some((p) => p.test(url));
  }

  /** Cek apakah halaman saat ini adalah halaman baca chapter */
  abstract isReaderPage(): boolean;

  /** Ambil metadata chapter */
  abstract getChapterInfo(): ChapterInfo;

  /** Ambil daftar URL gambar chapter secara berurutan */
  abstract getImageUrls(): string[];

  /** Referer header untuk fetch gambar (anti-hotlinking) */
  getReferer(): string {
    return window.location.origin + '/';
  }
}
