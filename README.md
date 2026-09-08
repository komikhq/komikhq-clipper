<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-mark-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="assets/logo-mark-light.svg" />
    <img alt="KomikHQ Clipper" src="assets/logo-mark-dark.svg" width="100" />
  </picture>
</p>

<h1 align="center">KomikHQ Clipper</h1>

<p align="center">
  A cross-browser extension that scans comic chapter pages and downloads every image as a sequentially-named ZIP file &mdash; one click, zero friction.
</p>

<p align="center">
  <a href="https://github.com/komikhq/komikhq-clipper/releases/latest">
    <img src="https://img.shields.io/github/v/release/komikhq/komikhq-clipper?style=for-the-badge&label=Version&color=E08E45" alt="Latest Release" />
  </a>
  <a href="https://github.com/komikhq/komikhq-clipper/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/komikhq/komikhq-clipper?style=for-the-badge&color=C2410C" alt="MIT License" />
  </a>
  <a href="https://github.com/komikhq/komikhq-clipper/stargazers">
    <img src="https://img.shields.io/github/stars/komikhq/komikhq-clipper?style=for-the-badge&color=E08E45" alt="Stars" />
  </a>
  <a href="https://github.com/komikhq/komikhq-clipper/commits/main">
    <img src="https://img.shields.io/github/last-commit/komikhq/komikhq-clipper?style=for-the-badge&color=C2410C" alt="Last Commit" />
  </a>
  <a href="https://github.com/komikhq/komikhq-clipper/actions/workflows/create-release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/komikhq/komikhq-clipper/create-release.yml?style=for-the-badge&label=Build&color=E08E45" alt="Build Status" />
  </a>
</p>

<p align="center">
  <a href="https://microsoftedge.microsoft.com/addons/detail/majmeimedakmbcfdcebjkbnmbjmdiggc">
    <img src="https://img.shields.io/badge/Edge_Add--ons-Available-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white" alt="Edge Add-ons" />
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/komikhq-clipper/">
    <img src="https://img.shields.io/badge/Firefox_Add--ons-Available-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white" alt="Firefox Add-ons" />
  </a>
</p>

<br />

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,tailwind,vite,nodejs,github,githubactions&theme=dark" alt="Tech Stack" />
</p>

<br />

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Supported Sites](#supported-sites)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

KomikHQ Clipper is a browser extension purpose-built for comic archival workflows. It detects chapter reader pages on supported sites, extracts every image in reading order, and packages them into a clean, zero-padded ZIP archive. The extension handles the entire pipeline &mdash; detection, extraction, progress tracking, and download &mdash; within a single, polished popup interface.

Built with [WXT](https://wxt.dev/), React 19, and TypeScript, the extension targets Chromium-based browsers (Edge, Brave, Opera, Vivaldi) and Firefox from a single codebase. An adapter-based architecture makes adding support for new comic sites straightforward.

---

## Features

- **One-click chapter download** &mdash; scan and archive an entire chapter from the popup
- **Sequential file naming** &mdash; images are zero-padded (`001.webp`, `002.webp`, ...) for correct sort order across all platforms
- **Real-time progress tracking** &mdash; download progress is displayed in both the popup UI and the extension badge
- **Multi-format support** &mdash; handles WebP, JPEG, PNG, GIF, and AVIF source images
- **Adapter-based parsing** &mdash; each supported site has a dedicated parser with domain-specific extraction logic
- **Cross-browser compatibility** &mdash; ships for Chrome, Firefox, and Edge from a unified build pipeline
- **Dark and light themes** &mdash; the popup respects your system preference with a manual toggle
- **Automated releases** &mdash; CI/CD pipeline builds extension packs, generates CRX3 bundles, signs Firefox XPIs, submits to Edge Add-ons, and publishes GitHub Releases with AI-generated changelogs

---

## Supported Sites

| Site | Domains | Adapter |
|:---|:---|:---|
| Komiku | `komiku.org` / `komiku.id` / `komiku.to` | [`komiku.ts`](lib/adapters/komiku.ts) |
| Kiryuu | `kiryuu.id` / `kiryuu.org` | [`kiryuu.ts`](lib/adapters/kiryuu.ts) |
| Komikcast | `komikcast.cz` / `komikcast.lol` | [`komikcast.ts`](lib/adapters/komikcast.ts) |

> Adding a new site? See the [Contributing Guide](CONTRIBUTING.md#adding-a-new-site-adapter).

---

## Installation

### Browser Extension Stores

| Store | Link |
|:---|:---|
| Microsoft Edge Add-ons | [Install for Edge](https://microsoftedge.microsoft.com/addons/detail/majmeimedakmbcfdcebjkbnmbjmdiggc) |
| Firefox Add-ons | [Install for Firefox](https://addons.mozilla.org/en-US/firefox/addon/komikhq-clipper/) |

### Manual Installation via GitHub Releases

Pre-built extension packages are attached to every [GitHub Release](https://github.com/komikhq/komikhq-clipper/releases/latest). Download the artifact that matches your browser:

| Artifact | Browser | Instructions |
|:---|:---|:---|
| `komikhq-clipper-vX.X.X-chrome.zip` | Chrome, Edge, Brave, Vivaldi, Opera | Unzip, then load via `chrome://extensions` with **Developer mode** enabled |
| `komikhq-clipper-vX.X.X.crx` | Chrome, Edge, Brave, Vivaldi, Opera | Drag-and-drop the `.crx` file onto `chrome://extensions` |
| `komikhq-clipper-vX.X.X-firefox.zip` | Firefox | Load as a temporary add-on via `about:debugging#/runtime/this-firefox` |
| `komikhq-clipper-vX.X.X-firefox-signed.xpi` | Firefox | Open the file directly in Firefox to install permanently |

---

## Getting Started

<details>
<summary><strong>Prerequisites</strong></summary>

<br />

- [Node.js](https://nodejs.org/) 22 or later
- [pnpm](https://pnpm.io/) package manager

</details>

<details>
<summary><strong>Installation</strong></summary>

<br />

```bash
git clone https://github.com/komikhq/komikhq-clipper.git
cd komikhq-clipper
pnpm install
```

</details>

<details>
<summary><strong>Development</strong></summary>

<br />

Start the development server with hot reload:

```bash
# Chromium browsers (Chrome, Edge, Brave)
pnpm dev

# Firefox
pnpm dev:firefox
```

The unpacked extension output is written to `.output/chrome-mv3` or `.output/firefox-mv2`. Load it via your browser's extension developer page.

</details>

<details>
<summary><strong>Building for Production</strong></summary>

<br />

```bash
# Build without packaging
pnpm build              # Chrome
pnpm build:firefox      # Firefox

# Build and create distributable ZIP archives
pnpm zip                # Chrome
pnpm zip:firefox        # Firefox
```

Output artifacts are placed in the `.output/` directory.

</details>

---

## Architecture

```
komikhq-clipper/
  entrypoints/
    background.ts           Service worker: image fetching, ZIP generation, download orchestration
    content.ts              Content script: page detection, adapter dispatch, DOM scanning
    popup/                  React popup UI (App.tsx, styles, entry point)
  components/               Reusable UI components (Header, ChapterCard, DownloadProgress, ...)
    ui/                     shadcn/ui primitives (Button, Progress, ScrollArea)
  hooks/
    useClipperScanner.ts    Core React hook managing scan/download state machine
  lib/
    adapters/
      base-adapter.ts       Abstract base class defining the adapter interface
      komiku.ts             Komiku site parser
      kiryuu.ts             Kiryuu site parser
      komikcast.ts          Komikcast site parser
      registry.ts           Auto-detection registry mapping URLs to adapters
    logger.ts               Structured logging utility with scoped prefixes
  .github/
    workflows/
      create-release.yml    CI/CD: build, sign, submit, and publish releases
```

The extension follows a three-layer architecture:

1. **Content Script** &mdash; injected into matched comic pages, it uses the adapter registry to detect the site, verify that the page is a chapter reader, and extract image URLs and metadata.
2. **Background Service Worker** &mdash; receives image URLs from the content script, fetches each image with proper `Referer` headers, assembles them into a ZIP archive via JSZip, and triggers the browser download.
3. **Popup UI** &mdash; a React application that orchestrates the scan-and-download flow, presenting chapter metadata, real-time progress, and status feedback to the user.

---

## Contributing

Contributions are welcome. Whether you are fixing a bug, adding a new site adapter, or improving documentation, please review the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

To report a bug or request a feature, open an issue on [GitHub Issues](https://github.com/komikhq/komikhq-clipper/issues).

---

## License

This project is distributed under the [MIT License](LICENSE).

<br />

---

<p align="center">
  <a href="https://github.com/komikhq/komikhq-clipper/network/members">
    <img src="https://img.shields.io/github/forks/komikhq/komikhq-clipper?style=flat-square&color=E08E45" alt="Forks" />
  </a>
  <a href="https://github.com/komikhq/komikhq-clipper/issues">
    <img src="https://img.shields.io/github/issues/komikhq/komikhq-clipper?style=flat-square&color=C2410C" alt="Issues" />
  </a>
  <img src="https://img.shields.io/github/repo-size/komikhq/komikhq-clipper?style=flat-square&color=E08E45" alt="Repo Size" />
  <img src="https://img.shields.io/github/languages/top/komikhq/komikhq-clipper?style=flat-square&color=C2410C" alt="Top Language" />
</p>

<p align="center">
  <sub>Built with precision by <a href="https://github.com/komikhq">KomikHQ</a></sub>
</p>
