import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  }),
  manifest: ({ browser }) => ({
    name: 'KomikHQ Clipper',
    version: '2.0.0',
    description: 'Scan & download chapter comic images as a sequentially-named ZIP file for KomikHQ.',
    permissions: ['activeTab', 'scripting', 'downloads', 'alarms'],
    host_permissions: [
      '*://*.komiku.org/*',
      '*://*.komiku.id/*',
      '*://*.komiku.to/*',
      '*://*.kiryuu.id/*',
      '*://*.kiryuu.org/*',
      '*://*.komikcast.cz/*',
      '*://*.komikcast.lol/*',
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'clipper@komikhq.com',
          strict_min_version: '109.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});
