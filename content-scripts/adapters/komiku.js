/**
 * KomikuAdapter — Parser khusus untuk komiku.org / komiku.id
 * 
 * Halaman baca komiku.org menggunakan struktur:
 *   <div id="Baca_Komik">
 *     <img class="klazy ww" src="..." alt="... gambar N">
 *     ...
 *   </div>
 *   <span class="chapterInfo" valueChapter="..." valueGambar="..."></span>
 *   <div data-series-title="..." data-chapter-title="..."></div>
 */
class KomikuAdapter extends BaseAdapter {
  /**
   * Domain yang didukung oleh adapter ini.
   */
  static SUPPORTED_HOSTS = ["komiku.org", "komiku.id", "www.komiku.org", "www.komiku.id"];

  /**
   * Pola URL gambar promosi / iklan yang harus di-skip.
   */
  static PROMO_PATTERNS = [
    "komiku-promosi",
    "ads",
    "/asset/",
    "komikuplus",
    "gstatic.com",
    "gravatar.com",
    "lazy.jpg",
  ];

  matches(url) {
    try {
      const hostname = new URL(url).hostname;
      return KomikuAdapter.SUPPORTED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
    } catch {
      return false;
    }
  }

  /**
   * Cek apakah halaman saat ini adalah halaman baca chapter.
   * Halaman baca selalu memiliki elemen #Baca_Komik.
   * @returns {boolean}
   */
  isReaderPage() {
    return document.getElementById("Baca_Komik") !== null;
  }

  getChapterInfo() {
    // 1. Coba dari elemen <span class="chapterInfo">
    const chapterInfoEl = document.querySelector("span.chapterInfo");
    // 2. Coba dari elemen dengan data-series-title
    const metaEl = document.querySelector("[data-series-title]");

    let title = "Unknown";
    let chapter = "000";

    if (metaEl) {
      title = metaEl.getAttribute("data-series-title") || title;
      const chapterTitle = metaEl.getAttribute("data-chapter-title") || "";
      // Ekstrak angka dari "Chapter 1192" -> "1192"
      const match = chapterTitle.match(/(\d+(\.\d+)?)/);
      if (match) chapter = match[1];
    }

    if (chapterInfoEl) {
      const valChapter = chapterInfoEl.getAttribute("valueChapter");
      if (valChapter) chapter = valChapter;
    }

    // Fallback: parse dari URL, contoh: /one-piece-chapter-1192/
    if (chapter === "000") {
      const urlMatch = window.location.pathname.match(/chapter[_-](\d+(\.\d+)?)/i);
      if (urlMatch) chapter = urlMatch[1];
    }

    if (title === "Unknown") {
      // Coba dari <h1>
      const h1 = document.querySelector("h1");
      if (h1) {
        // "One Piece Chapter 1192" -> "One Piece"
        title = h1.textContent.replace(/chapter\s*\d+(\.\d+)?/i, "").trim();
      }
    }

    // Buat slug yang aman untuk nama file
    const slug = `${title}-Chapter-${chapter}`
      .replace(/[^a-zA-Z0-9\-_.]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    return { title, chapter, slug };
  }

  getImageUrls() {
    const container = document.getElementById("Baca_Komik");
    if (!container) return [];

    // Ambil semua <img> di dalam #Baca_Komik
    const allImgs = container.querySelectorAll("img");
    const urls = [];

    for (const img of allImgs) {
      // Ambil src aktual (bisa dari data-src untuk lazy loading)
      const src = img.getAttribute("data-src") || img.getAttribute("src") || "";

      // Skip jika src kosong
      if (!src || src.trim() === "") continue;

      // Skip gambar promosi/iklan/aset berdasarkan pattern
      const isPromo = KomikuAdapter.PROMO_PATTERNS.some((pattern) =>
        src.toLowerCase().includes(pattern.toLowerCase())
      );
      if (isPromo) continue;

      // Skip gambar yang terlalu kecil (biasanya ikon/spacer)
      // Gambar chapter umumnya tidak punya width/height attribute yang kecil
      const width = parseInt(img.getAttribute("width") || "0", 10);
      const height = parseInt(img.getAttribute("height") || "0", 10);
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) continue;

      // Hanya ambil gambar dengan class "klazy" atau "ww" (marker gambar chapter)
      // atau gambar dari domain image komiku
      const hasChapterClass = img.classList.contains("klazy") || img.classList.contains("ww");
      const isKomikuImage = /image\d*\.komiku\.to|img\.komiku\.org/.test(src);

      if (hasChapterClass || isKomikuImage) {
        // Pastikan URL absolut
        let absoluteUrl = src;
        if (src.startsWith("//")) {
          absoluteUrl = "https:" + src;
        } else if (src.startsWith("/")) {
          absoluteUrl = window.location.origin + src;
        }
        urls.push(absoluteUrl);
      }
    }

    return urls;
  }
}

// Register adapter ke global scope
if (typeof window !== "undefined") {
  window.KomikuAdapter = KomikuAdapter;
}
