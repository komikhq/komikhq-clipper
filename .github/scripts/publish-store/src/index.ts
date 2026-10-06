/**
 * Publisher Factory & CLI Entry Point
 *
 * Usage:
 *   pnpm tsx .github/scripts/publish-store/src/index.ts --store edge --zip .output/ext-chrome.zip --version 2.0.0
 *   pnpm tsx .github/scripts/publish-store/src/index.ts --store all --zip .output/ext-chrome.zip --zip-firefox .output/ext-firefox.zip --version 2.0.0
 *
 * Supports: edge | firefox | all
 */

import { type BaseStorePublisher, type PublisherConfig, type PublishResult } from './base-publisher.ts';
import { EdgeStorePublisher } from './edge-publisher.ts';
import { FirefoxStorePublisher } from './firefox-publisher.ts';

// --- Argument Parsing ---

type StoreName = 'edge' | 'firefox';

interface CliArgs {
  stores: StoreName[];
  version: string;
  zipEdge?: string;
  zipFirefox?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg && arg.startsWith('--') && i + 1 < argv.length) {
      const nextVal = argv[++i];
      if (nextVal !== undefined) {
        args[arg.slice(2)] = nextVal;
      }
    }
  }

  const storeInput = args['store'] || '';
  const version = args['version'];

  if (!version) {
    throw new Error('Missing required argument: --version');
  }
  if (!storeInput) {
    throw new Error('Missing required argument: --store (edge|firefox|all)');
  }

  const stores: StoreName[] =
    storeInput === 'all'
      ? ['edge', 'firefox']
      : (storeInput.split(',') as StoreName[]);

  return {
    stores,
    version,
    zipEdge: args['zip-edge'] || args['zip'],
    zipFirefox: args['zip-firefox'],
  };
}

// --- Factory ---

function createPublisher(store: StoreName, config: PublisherConfig): BaseStorePublisher {
  switch (store) {
    case 'edge':
      return new EdgeStorePublisher(config);
    case 'firefox':
      return new FirefoxStorePublisher(config);
    default:
      throw new Error(`Unknown store: ${store}`);
  }
}

function resolveZipPath(args: CliArgs, store: StoreName): string {
  const pathMap: Record<StoreName, string | undefined> = {
    edge: args.zipEdge,
    firefox: args.zipFirefox,
  };

  const zipPath = pathMap[store];
  if (!zipPath) {
    throw new Error(`No ZIP path provided for store: ${store}. Use --zip-${store} <path>`);
  }
  return zipPath;
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  console.log('===========================================');
  console.log(`  Extension Publisher -- v${args.version}`);
  console.log(`  Target stores: ${args.stores.join(', ')}`);
  console.log('===========================================\n');

  const results: PublishResult[] = [];

  // Run publishers sequentially to avoid rate limit issues
  for (const store of args.stores) {
    console.log(`\n--- Publishing to ${store} ---\n`);

    try {
      const zipPath = resolveZipPath(args, store);
      const config: PublisherConfig = {
        zipFilePath: zipPath,
        version: args.version,
      };

      const publisher = createPublisher(store, config);
      const result = await publisher.executePipeline();
      results.push(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        storeName: store,
        success: false,
        version: args.version,
        message,
      });
    }
  }

  // --- Summary ---
  console.log('\n===========================================');
  console.log('  PUBLISH SUMMARY');
  console.log('===========================================\n');

  let hasFailures = false;
  for (const result of results) {
    const icon = result.success ? '[OK]' : '[FAIL]';
    console.log(`  ${icon} ${result.storeName}: ${result.message}`);
    if (result.itemUrl) {
      console.log(`     -> ${result.itemUrl}`);
    }
    if (!result.success) hasFailures = true;
  }

  console.log('');

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main();
