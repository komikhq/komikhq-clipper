import { test } from '@playwright/test';

const TITLES_TO_TEST = [
  'One Piece',
  'Naruto',
  'Boruto',
  'Boruto Two Blue Vortex',
  'Solo Leveling',
  'Full-Time Awakening'
];

test('Deep analysis of requested titles on komiku.org', async ({ page }) => {
  for (const titleQuery of TITLES_TO_TEST) {
    console.log(`\n==================================================`);
    console.log(`SEARCHING & ANALYZING TITLE: "${titleQuery}"`);
    console.log(`==================================================`);

    await page.goto('https://komiku.org/', { waitUntil: 'domcontentloaded' });
    
    // Search on website
    const searchInput = page.locator('input[name="s"], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(titleQuery);
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
    } else {
      await page.goto(`https://komiku.org/?post_type=manga&s=${encodeURIComponent(titleQuery)}`, { waitUntil: 'domcontentloaded' });
    }

    // Find comic link from search results or homepage
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
      console.log(`❌ No comic page found for title: "${titleQuery}"`);
      continue;
    }

    console.log(`📌 Comic Page URL: ${comicUrl}`);
    await page.goto(comicUrl, { waitUntil: 'domcontentloaded' });

    const chapterLinks = await page.locator('a[href*="chapter"]').all();
    console.log(`📊 Found ${chapterLinks.length} total chapter links on comic page.`);

    if (chapterLinks.length === 0) {
      console.log(`❌ No chapter links found on page!`);
      continue;
    }

    // Pick early (last in list/oldest), mid, and late (first in list/newest) chapters
    const indicesToPick = [
      chapterLinks.length - 1, // Early / Chapter 1
      Math.floor(chapterLinks.length / 2), // Mid
      0 // Late / Recent Chapter
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

    for (const item of targetChapterUrls) {
      console.log(`\n  📖 Chapter [${item.label}]: ${item.url}`);
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const container = page.locator('#Baca_Komik');
      const containerCount = await container.count();
      console.log(`     #Baca_Komik container present: ${containerCount > 0}`);

      if (containerCount > 0) {
        const imgs = await container.locator('img').all();
        console.log(`     Total <img> inside #Baca_Komik: ${imgs.length}`);

        let validImgCount = 0;
        const domainSampleSet = new Set<string>();

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
              domainSampleSet.add(u.hostname + u.pathname.substring(0, u.pathname.lastIndexOf('/')));
            } catch {
              // ignore
            }
          }

          if (i < 3 || i >= imgs.length - 2) {
            console.log(`       - Img #${i + 1}: src="${src}" | data-src="${dataSrc}" | class="${classes}" | alt="${alt}"`);
          } else if (i === 3) {
            console.log(`       - ... (${imgs.length - 5} images in between) ...`);
          }
        }
        console.log(`     Summary: ${validImgCount}/${imgs.length} images have valid src attributes.`);
        console.log(`     Detected Image Path/Domain Patterns:`, Array.from(domainSampleSet));
      } else {
        console.log(`     ⚠️ WARNING: #Baca_Komik container NOT found on this chapter!`);
      }
    }
  }
});
