# Contributing to KomikHQ Clipper

Thank you for your interest in contributing to KomikHQ Clipper. This document outlines the process for submitting changes, reporting issues, and adding new site adapters.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding a New Site Adapter](#adding-a-new-site-adapter)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

All contributors are expected to be respectful and constructive in all interactions. Harassment, discrimination, and disruptive behavior will not be tolerated.

---

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. Ensure you have **Node.js 22+** and **pnpm** installed.
3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Start the development server:

   ```bash
   # Chrome (default)
   pnpm dev

   # Firefox
   pnpm dev:firefox
   ```

5. Load the extension in your browser from the `.output/` directory.

---

## Development Workflow

- Create a feature branch from `main`:

  ```bash
  git checkout -b feat/your-feature-name
  ```

- Make your changes in small, focused commits.
- Run the TypeScript compiler to check for type errors:

  ```bash
  pnpm compile
  ```

- Test your changes manually by loading the extension in your browser.

---

## Adding a New Site Adapter

KomikHQ Clipper uses an adapter pattern to support multiple comic sites. To add support for a new site:

1. Create a new adapter file in `lib/adapters/` (e.g., `newsite.ts`).
2. Extend the `BaseAdapter` class and implement all required methods:

   ```typescript
   import { BaseAdapter, ChapterInfo } from './base-adapter';

   export class NewSiteAdapter extends BaseAdapter {
     readonly patterns = [/^https?:\/\/(www\.)?newsite\.com/];

     isReaderPage(): boolean {
       // Return true if the current page is a chapter reader
     }

     getChapterInfo(): ChapterInfo {
       // Extract and return chapter metadata from the DOM
     }

     getImageUrls(): string[] {
       // Extract and return all chapter image URLs in order
     }
   }
   ```

3. Register the adapter in `lib/adapters/registry.ts`.
4. Add the site's URL patterns to `matches` in `entrypoints/content.ts` and to `host_permissions` in `wxt.config.ts`.
5. Test thoroughly on multiple chapters of the target site.

---

## Code Style

- **Language**: TypeScript (strict mode).
- **Formatting**: Follow the existing conventions in the codebase.
- **Naming**: Use descriptive, self-documenting names. Avoid abbreviations.
- **Comments**: Write comments to explain *why*, not *what*. The code should be self-explanatory.
- **Imports**: Use path aliases (`@/`) for project-internal imports.

---

## Submitting a Pull Request

1. Ensure your branch is up to date with `main`.
2. Verify that `pnpm compile` completes without errors.
3. Write a clear PR title and description explaining the purpose of the change.
4. Reference any related issues (e.g., `Closes #42`).
5. Submit the PR and await review.

---

## Reporting Issues

When reporting a bug, please include:

- **Browser and version** (e.g., Firefox 138, Edge 130).
- **Extension version** (visible in the popup footer).
- **The comic site URL** where the issue occurs.
- **Steps to reproduce** the problem.
- **Expected behavior** versus **actual behavior**.
- **Console logs** from the browser's developer tools, if available.

Open an issue at [github.com/komikhq/komikhq-clipper/issues](https://github.com/komikhq/komikhq-clipper/issues).
