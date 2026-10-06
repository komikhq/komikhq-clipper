import { test } from '@playwright/test';

// Sample titles to analyze on www.manhwaindo.my
const TITLES = [
  { name: 'Solo Leveling', slug: 'manga/solo-leveling' },
  { name: 'Tower of God', slug: 'manga/tower-of-god' }
];

test.describe('Manhwaindo DOM Analysis', () => {
  test('Analyze DOM layout and image attributes on www.manhwaindo.my', async ({ page }) => {
    test.setTimeout(180000);

    for (const item of TITLES) {
      console.log(`\n==================================================`);
      console.log(`ANALYZING MANHWAINDO TITLE: "${item.name}"`);
      console.log(`==================================================`);

      let comicUrl = `https://www.manhwaindo.my/${item.slug}/`;
      let res = await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (!res || res.status() === 404) {
        console.log(`Direct URL failed for ${comicUrl}, searching via main page...`);
        await page.goto('https://www.manhwaindo.my/', { waitUntil: 'domcontentloaded' });
        const searchBox = page.locator('input[name="s"]').first();
        if (await searchBox.isVisible()) {
          await searchBox.fill(item.name);
          await searchBox.press('Enter');
          await page.waitForTimeout(2000);
          const firstLink = page.locator('.bsx a, .animposx a').first();
          if (await firstLink.isVisible()) {
            const href = await firstLink.getAttribute('href');
            if (href) {
              comicUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
              await page.goto(comicUrl, { waitUntil: 'domcontentloaded' });
            }
          }
        }
      }

      console.log(`📌 Comic Detail Page URL: ${page.url()}`);

      const chapterLinks = await page.locator('#chapterlist a, .eplister a, a[href*="chapter"]').all();
      const uniqueUrls: string[] = [];

      for (const link of chapterLinks) {
        const href = await link.getAttribute('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
          if (!uniqueUrls.includes(fullUrl) && fullUrl.includes('manhwaindo')) {
            uniqueUrls.push(fullUrl);
          }
        }
      }

      console.log(`📊 Unique chapter URLs found: ${uniqueUrls.length}`);

      if (uniqueUrls.length === 0) {
        console.log(`❌ No chapter links found for ${item.name}`);
        continue;
      }

      const targets = [
        { label: 'OLDEST', url: uniqueUrls[uniqueUrls.length - 1]! },
        { label: 'NEWEST', url: uniqueUrls[0]! }
      ];

      for (const ch of targets) {
        console.log(`\n  📖 Chapter [${ch.label}]: ${ch.url}`);
        await page.goto(ch.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const candidateSelectors = ['#readerarea', '.chapter-content', '.reading-content', '#chapter-images'];
        let activeContainerSelector = '';

        for (const sel of candidateSelectors) {
          if ((await page.locator(sel).count()) > 0) {
            activeContainerSelector = sel;
            break;
          }
        }

        console.log(`     Active Container Selector: "${activeContainerSelector || 'NOT FOUND'}"`);

        if (activeContainerSelector) {
          const imgs = await page.locator(`${activeContainerSelector} img`).all();
          console.log(`     Total <img> in container: ${imgs.length}`);

          for (let i = 0; i < Math.min(imgs.length, 3); i++) {
            const img = imgs[i]!;
            const src = (await img.getAttribute('src')) || '';
            const dataSrc = (await img.getAttribute('data-src')) || '';
            const dataLazy = (await img.getAttribute('data-lazy-src')) || '';
            const cls = (await img.getAttribute('class')) || '';

            console.log(`       - Img #${i + 1}: src="${src}" | data-src="${dataSrc}" | data-lazy="${dataLazy}" | class="${cls}"`);
          }
        }
      }
    }
  });
});
