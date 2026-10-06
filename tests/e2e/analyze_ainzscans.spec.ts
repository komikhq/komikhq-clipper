import { test } from '@playwright/test';

const CHAPTER_URLS = [
  'https://v3.ainzscans01.com/comic/solo-leveling/chapter/chapter-1',
  'https://v3.ainzscans01.com/comic/solo-leveling/chapter/chapter-179-end',
  'https://v3.ainzscans01.com/comic/one-piece/chapter/chapter-1',
  'https://v3.ainzscans01.com/comic/one-piece/chapter/chapter-1190788518',
];

test('Full DOM pattern analysis for ainzscans chapters', async ({ page }) => {
  test.setTimeout(120000);

  for (const url of CHAPTER_URLS) {
    console.log(`\n==================================================`);
    console.log(`ANALYZING: ${url}`);
    console.log(`==================================================`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
      const title = document.title;
      const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
      
      // Look for breadcrumbs or title headers
      const headerText = Array.from(document.querySelectorAll('h1, h2, span, a'))
        .map(el => el.textContent?.trim() || '')
        .filter(t => t.toLowerCase().includes('chapter'))
        .slice(0, 5);

      // Extract all comic images: imgs inside page container or with alt="Page X" or src from cdn
      const imgs = Array.from(document.querySelectorAll('img'));
      const comicImgs = imgs.map((img, i) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
        const alt = img.getAttribute('alt') || '';
        const parentCls = typeof img.parentElement?.className === 'string' ? img.parentElement.className : '';
        return { index: i + 1, src, alt, parentCls };
      }).filter(item => {
        if (!item.src) return false;
        // Filter out Blogger ads and comment reactions
        if (item.src.includes('blogger.googleusercontent.com')) return false;
        if (item.src.includes('comment-reactions')) return false;
        if (item.src.includes('ezgif')) return false;
        return true;
      });

      return { title, h1Text, headerText, totalImgs: imgs.length, comicImgCount: comicImgs.length, sampleComicImgs: comicImgs.slice(0, 4) };
    });

    console.log(`Page Title: "${data.title}"`);
    console.log(`H1: "${data.h1Text}"`);
    console.log(`Chapter Headers Found:`, data.headerText);
    console.log(`Total <img>: ${data.totalImgs}, Comic <img> after basic filter: ${data.comicImgCount}`);
    console.log(`Sample Comic Images:`);
    data.sampleComicImgs.forEach(img => {
      console.log(`  [#${img.index}] src="${img.src}" | alt="${img.alt}" | parentCls="${img.parentCls}"`);
    });
  }
});
