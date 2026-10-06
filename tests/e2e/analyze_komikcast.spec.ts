import { test } from '@playwright/test';

const TITLES = [
  { name: 'One Piece', slug: 'manga/one-piece' },
  { name: 'Solo Leveling', slug: 'manga/solo-leveling' }
];

test.describe('Komikcast DOM Analysis', () => {
  test('Analyze DOM layout and image attributes for Komikcast mirrors', async ({ page }) => {
    test.setTimeout(180000);

    for (const item of TITLES) {
      console.log(`\n==================================================`);
      console.log(`ANALYZING KOMIKCAST TITLE: "${item.name}"`);
      console.log(`==================================================`);

      let comicUrl = `https://komikcast.cz/${item.slug}/`;
      let res = await page.goto(comicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);

      if (!res || res.status() >= 400) {
        console.log(`Direct URL failed for ${comicUrl}`);
      }

      const candidateSelectors = ['#readerarea', '#chapter-images', '.main-reading-area', '.reader-area'];
      let activeContainerSelector = '';

      for (const sel of candidateSelectors) {
        if ((await page.locator(sel).count()) > 0) {
          activeContainerSelector = sel;
          break;
        }
      }

      console.log(`     Active Container Selector: "${activeContainerSelector || 'NOT FOUND'}"`);
    }
  });
});
