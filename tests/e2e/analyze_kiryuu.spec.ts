import { test } from '@playwright/test';

// Sample titles to analyze on v7.kiryuu.to
const TITLES = [
  { name: 'One Piece', slug: 'manga/one-piece' },
  { name: 'Jujutsu Kaisen', slug: 'manga/jujutsu-kaisen' }
];

test.describe('Kiryuu DOM Analysis', () => {
  test('Analyze DOM layout and image attributes on v7.kiryuu.to', async ({ page }) => {
    test.setTimeout(180000);

    for (const item of TITLES) {
      console.log(`\n==================================================`);
      console.log(`ANALYZING KIRYUU TITLE: "${item.name}"`);
      console.log(`==================================================`);

      let comicUrl = `https://v7.kiryuu.to/${item.slug}/`;
      let res = await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (!res || res.status() === 404) {
        console.log(`Direct URL failed for ${comicUrl}, searching via main page...`);
        await page.goto('https://v7.kiryuu.to/', { waitUntil: 'domcontentloaded' });
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

      const chapterLinks = page.locator('a[href*="/chapter-"]');
      const count = await chapterLinks.count();
      const targets: { label: string; url: string }[] = [];

      if (count > 0) {
        const firstHref = await chapterLinks.first().getAttribute('href');
        const lastHref = await chapterLinks.last().getAttribute('href');
        if (firstHref) targets.push({ label: 'NEWEST', url: firstHref.startsWith('http') ? firstHref : new URL(firstHref, page.url()).toString() });
        if (lastHref) targets.push({ label: 'OLDEST', url: lastHref.startsWith('http') ? lastHref : new URL(lastHref, page.url()).toString() });
      }

      console.log(`📊 Target chapter URLs found: ${targets.length}`);

      if (targets.length === 0) {
        console.log(`❌ No chapter links found for ${item.name}`);
        continue;
      }

      for (const ch of targets) {
        console.log(`\n  📖 Chapter [${ch.label}]: ${ch.url}`);
        await page.goto(ch.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const candidateSelectors = ['#readerarea', '#ch-images', '.reading-content', '.reader-area', 'div:has(img[src*="cdn"])'];
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

          for (let i = 0; i < Math.min(imgs.length, 5); i++) {
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
