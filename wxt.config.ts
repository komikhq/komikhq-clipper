import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import packageJson from './package.json';

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
    version: packageJson.version,
    description: 'Scan & download chapter comic images as a sequentially-named ZIP file for KomikHQ.',
    permissions: ['activeTab', 'scripting', 'downloads', 'alarms', 'storage'],
    host_permissions: [
      '*://*.komiku.org/*',
      '*://*.komiku.id/*',
      '*://*.komiku.to/*',
      '*://*.kiryuu.id/*',
      '*://*.kiryuu.org/*',
      '*://*.kiryuu.io/*',
      '*://*.kiryuu.to/*',
      '*://*.ainzscans01.com/*',
      '*://*.ainzscans.com/*',
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'clipper@komikhq.org',
          strict_min_version: '109.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    }),
  }),
});
