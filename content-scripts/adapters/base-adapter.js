/**
 * BaseAdapter — Interface dasar untuk semua adapter situs komik.
 *
 * Setiap adapter harus mengimplementasikan:
 * - matches(url)       : Apakah adapter ini mendukung URL saat ini?
 * - getChapterInfo()   : Mengambil metadata (judul komik, chapter, dll).
 * - getImageUrls()     : Mengambil daftar URL gambar chapter secara berurutan.
 */
class BaseAdapter {
  /**
   * Cek apakah adapter ini cocok untuk URL/halaman saat ini.
   * @param {string} url — URL halaman saat ini.
   * @returns {boolean}
   */
  matches(url) {
    return false;
  }

  /**
   * Ambil informasi chapter dari halaman saat ini.
   * @returns {{ title: string, chapter: string, slug: string }}
   */
  getChapterInfo() {
    return { title: "Unknown", chapter: "000", slug: "unknown-000" };
  }

  /**
   * Ambil daftar URL gambar chapter dari halaman baca.
   * Hanya gambar konten chapter, bukan banner/iklan/aset UI.
   * @returns {string[]} — Array URL gambar berurutan.
   */
  getImageUrls() {
    return [];
  }
}

// Expose ke global scope agar bisa diakses content script lain
if (typeof window !== "undefined") {
  window.BaseAdapter = BaseAdapter;
}
