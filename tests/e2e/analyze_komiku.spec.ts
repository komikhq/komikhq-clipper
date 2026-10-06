import { test } from '@playwright/test';

// Exact slug mapping for komiku.org
const TITLES_TO_TEST = [
  { name: 'One Piece', slug: 'manga/komik-one-piece-indo' },
  { name: 'Naruto', slug: 'manga/naruto-id' },
  { name: 'Boruto', slug: 'manga/boruto-id' },
  { name: 'Boruto Two Blue Vortex', slug: 'manga/boruto-two-blue-vortex-indo' },
  { name: 'Solo Leveling', slug: 'manga/solo-leveling-id' },
  { name: 'Full-Time Awakening', slug: 'manga/full-time-awakening' }
];

test('Deep analysis of requested titles on komiku.org', async ({ page }) => {
  test.setTimeout(300000);

  for (const item of TITLES_TO_TEST) {
    console.log(`\n==================================================`);
    console.log(`ANALYZING TITLE: "${item.name}"`);
    console.log(`==================================================`);

    const comicUrl = `https://komiku.org/${item.slug}/`;
    await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`📌 Comic Detail Page URL: ${page.url()}`);

    const chapterLinks = await page.locator('a[href*="chapter"]').all();
    const uniqueChapterUrls: string[] = [];

    for (const link of chapterLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
        if (fullUrl.includes('chapter') && !uniqueChapterUrls.includes(fullUrl)) {
          uniqueChapterUrls.push(fullUrl);
        }
      }
    }

    console.log(`📊 Unique chapter URLs found: ${uniqueChapterUrls.length}`);

    if (uniqueChapterUrls.length === 0) {
      console.log(`❌ No chapter links found!`);
      continue;
    }

    const targetChapterUrls: { label: string; url: string }[] = [];
    targetChapterUrls.push({ label: 'AWAL / CHAPTER 1 (Oldest)', url: uniqueChapterUrls[uniqueChapterUrls.length - 1]! });
    if (uniqueChapterUrls.length > 2) {
      const midIdx = Math.floor(uniqueChapterUrls.length / 2);
      targetChapterUrls.push({ label: 'PERTENGAHAN (Mid)', url: uniqueChapterUrls[midIdx]! });
    }
    targetChapterUrls.push({ label: 'AKHIR / TERBARU (Newest)', url: uniqueChapterUrls[0]! });

    for (const ch of targetChapterUrls) {
      console.log(`\n  📖 Chapter [${ch.label}]: ${ch.url}`);
      await page.goto(ch.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const container = page.locator('#Baca_Komik');
      const containerCount = await container.count();
      console.log(`     #Baca_Komik container present: ${containerCount > 0}`);

      if (containerCount > 0) {
        const imgs = await container.locator('img').all();
        console.log(`     Total <img> inside #Baca_Komik: ${imgs.length}`);

        let validImgCount = 0;
        const pathPatterns = new Set<string>();

        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i];
          if (!img) continue;
          const src = (await img.getAttribute('src')) || '';
          const dataSrc = (await img.getAttribute('data-src')) || '';
          const dataLazy = (await img.getAttribute('data-lazy-src')) || '';
          const classes = (await img.getAttribute('class')) || '';
          const alt = (await img.getAttribute('alt')) || '';

          const actualUrl = dataSrc || dataLazy || src;
          if (actualUrl) {
            validImgCount++;
            try {
              const u = new URL(actualUrl.startsWith('//') ? 'https:' + actualUrl : actualUrl);
              pathPatterns.add(u.hostname + u.pathname.substring(0, u.pathname.lastIndexOf('/')));
            } catch {
              // ignore
            }
          }

          if (i < 2 || i >= imgs.length - 2) {
            console.log(`       - Img #${i + 1}: src="${src}" | data-src="${dataSrc}" | class="${classes}" | alt="${alt}"`);
          } else if (i === 2) {
            console.log(`       - ... (${imgs.length - 4} images in between) ...`);
          }
        }
        console.log(`     Summary: ${validImgCount}/${imgs.length} images evaluated.`);
        console.log(`     Detected URL Path Patterns:`, Array.from(pathPatterns));
      } else {
        console.log(`     ⚠️ WARNING: #Baca_Komik container NOT found on this chapter!`);
      }
    }
  }
});
