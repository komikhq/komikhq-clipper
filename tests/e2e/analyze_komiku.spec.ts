import { test } from '@playwright/test';

test('Inspect komiku.org search and manga structure live', async ({ page }) => {
  await page.goto('https://komiku.org/', { waitUntil: 'domcontentloaded' });
  console.log('Homepage loaded');

  const links = await page.locator('a').all();
  let comicUrl = '';
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && href.includes('one-piece')) {
      comicUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
      break;
    }
  }

  if (comicUrl) {
    console.log('\nNavigating to Comic Page:', comicUrl);
    await page.goto(comicUrl, { waitUntil: 'domcontentloaded' });

    const chapterLinks = await page.locator('a[href*="chapter"]').all();
    console.log(`Chapter links found on comic page: ${chapterLinks.length}`);

    const targetChapters: string[] = [];
    if (chapterLinks.length > 0) {
      const firstHref = await chapterLinks[0].getAttribute('href');
      const midHref = await chapterLinks[Math.floor(chapterLinks.length / 2)].getAttribute('href');
      const lastHref = await chapterLinks[chapterLinks.length - 1].getAttribute('href');
      
      for (const h of [firstHref, midHref, lastHref]) {
        if (h) {
          const full = h.startsWith('http') ? h : new URL(h, page.url()).toString();
          if (!targetChapters.includes(full)) targetChapters.push(full);
        }
      }
    }

    for (const chUrl of targetChapters) {
      console.log(`\n----------------------------------------`);
      console.log('Navigating to Chapter:', chUrl);
      await page.goto(chUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const container = page.locator('#Baca_Komik');
      const containerCount = await container.count();
      console.log('#Baca_Komik container count:', containerCount);

      if (containerCount > 0) {
        const imgs = await container.locator('img').all();
        console.log(`Total <img> inside #Baca_Komik: ${imgs.length}`);

        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i];
          if (!img) continue;
          const outer = await img.evaluate((el) => el.outerHTML);
          console.log(`  Img #${i + 1}: ${outer}`);
        }
      }
    }
  }
});
