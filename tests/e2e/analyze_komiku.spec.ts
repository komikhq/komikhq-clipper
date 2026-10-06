import { test } from '@playwright/test';

// Direct mappings or search parameters
const TITLES_TO_TEST = [
  { name: 'One Piece', search: 'One Piece' },
  { name: 'Naruto', search: 'Naruto' },
  { name: 'Boruto', search: 'Boruto' },
  { name: 'Boruto Two Blue Vortex', search: 'Boruto Two Blue Vortex' },
  { name: 'Solo Leveling', search: 'Solo Leveling' },
  { name: 'Full-Time Awakening', search: 'Full-Time Awakening' }
];

test('Deep analysis of requested titles on komiku.org', async ({ page }) => {
  // Set generous test timeout for processing multiple titles & chapters
  test.setTimeout(180000);

  for (const item of TITLES_TO_TEST) {
    console.log(`\n==================================================`);
    console.log(`ANALYZING TITLE: "${item.name}"`);
    console.log(`==================================================`);

    const searchUrl = `https://komiku.org/?post_type=manga&s=${encodeURIComponent(item.search)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const comicLinks = await page.locator('a[href*="/manga/"]').all();
    let comicUrl = '';

    for (const link of comicLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        comicUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
        break;
      }
    }

    if (!comicUrl) {
      console.log(`❌ No comic page found for title: "${item.name}"`);
      continue;
    }

    console.log(`📌 Comic Page URL: ${comicUrl}`);
    await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const chapterLinks = await page.locator('a[href*="chapter"]').all();
    console.log(`📊 Found ${chapterLinks.length} total chapter links on comic page.`);

    if (chapterLinks.length === 0) {
      console.log(`❌ No chapter links found on page!`);
      continue;
    }

    const indicesToPick = [
      chapterLinks.length - 1, // AWAL (Oldest / Chapter 1)
      Math.floor(chapterLinks.length / 2), // PERTENGAHAN (Mid)
      0 // AKHIR (Newest)
    ];

    const targetChapterUrls: { label: string; url: string }[] = [];
    const labels = ['AWAL (Oldest)', 'PERTENGAHAN (Mid)', 'AKHIR (Newest)'];

    for (let i = 0; i < indicesToPick.length; i++) {
      const idx = indicesToPick[i];
      if (idx !== undefined && idx >= 0 && idx < chapterLinks.length) {
        const link = chapterLinks[idx];
        if (link) {
          const href = await link.getAttribute('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
            if (!targetChapterUrls.some((t) => t.url === fullUrl)) {
              const label = labels[i] || `Chapter index ${idx}`;
              targetChapterUrls.push({ label, url: fullUrl });
            }
          }
        }
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
