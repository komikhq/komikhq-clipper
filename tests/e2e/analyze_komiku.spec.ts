import { test } from '@playwright/test';

// Exact comic URLs on komiku.org
const TITLES_TO_TEST = [
  { name: 'One Piece', search: 'one-piece' },
  { name: 'Naruto', search: 'naruto' },
  { name: 'Boruto', search: 'boruto' },
  { name: 'Boruto Two Blue Vortex', search: 'boruto-two-blue-vortex' },
  { name: 'Solo Leveling', search: 'solo-leveling' },
  { name: 'Full-Time Awakening', search: 'full-time-awakening' }
];

test('Deep analysis of requested titles on komiku.org', async ({ page }) => {
  test.setTimeout(300000);

  for (const item of TITLES_TO_TEST) {
    console.log(`\n==================================================`);
    console.log(`ANALYZING TITLE: "${item.name}"`);
    console.log(`==================================================`);

    // Search page
    const searchUrl = `https://komiku.org/?post_type=manga&s=${encodeURIComponent(item.search)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const comicLinks = await page.locator('.daftar h3 a, .bge a, h2 a').all();
    let comicUrl = '';

    for (const link of comicLinks) {
      const href = await link.getAttribute('href');
      if (href && href.includes('/manga/')) {
        comicUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
        break;
      }
    }

    if (!comicUrl) {
      const anyMangaLink = await page.locator('a[href*="/manga/"]').all();
      for (const link of anyMangaLink) {
        const href = await link.getAttribute('href');
        if (href && !href.includes('/genre/')) {
          comicUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
          break;
        }
      }
    }

    if (!comicUrl) {
      console.log(`❌ No comic detail URL found for "${item.name}"`);
      continue;
    }

    console.log(`📌 Comic Detail Page URL: ${comicUrl}`);
    await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Look for chapter links in chapter table
    const chapterLinks = await page.locator('#Daftar_Chapter a[href*="chapter"], table a[href*="chapter"], a[href*="chapter"]').all();
    console.log(`📊 Found ${chapterLinks.length} chapter links on detail page.`);

    if (chapterLinks.length === 0) {
      console.log(`❌ No chapter links found on detail page!`);
      continue;
    }

    // Filter unique chapter URLs
    const uniqueChapterUrls: string[] = [];
    for (const link of chapterLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
        if (!uniqueChapterUrls.includes(fullUrl)) {
          uniqueChapterUrls.push(fullUrl);
        }
      }
    }

    console.log(`📊 Unique chapter URLs: ${uniqueChapterUrls.length}`);

    const targetChapterUrls: { label: string; url: string }[] = [];
    if (uniqueChapterUrls.length > 0) {
      targetChapterUrls.push({ label: 'AKHIR (Newest)', url: uniqueChapterUrls[0]! });
      if (uniqueChapterUrls.length > 2) {
        const midIdx = Math.floor(uniqueChapterUrls.length / 2);
        targetChapterUrls.push({ label: 'PERTENGAHAN (Mid)', url: uniqueChapterUrls[midIdx]! });
      }
      if (uniqueChapterUrls.length > 1) {
        targetChapterUrls.push({ label: 'AWAL (Oldest)', url: uniqueChapterUrls[uniqueChapterUrls.length - 1]! });
      }
    }

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
