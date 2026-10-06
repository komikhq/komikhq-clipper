# Adapter Architecture & Developer Rules

This directory contains the site-specific parser adapters for `komikhq-clipper`. Each adapter extends the abstract `BaseAdapter` class located in `lib/adapters/base-adapter.ts`.

---

## Developer Guidelines & Core Constraints

### 1. Pure DOM & HTML Structural Detection
- **No Hardcoded CDN Filters**: Never use hardcoded CDN domain names, subpaths (e.g., `/wp-content/uploads/`), or specific image host regex patterns to filter comic images. CDN URLs change frequently and randomly across different providers and mirrors.
- **Structural Container Matching**: Target reader container elements directly via CSS selectors (e.g., `section[data-image-data]`, `#readerarea`, `.reading-content`).
- **Universal Schema Validation**: Extract images based on standard DOM image attributes (`src`, `data-src`, `data-lazy-src`). Validate image URLs using standard protocol prefixes (`http://`, `https://`, `//`, `/`).

### 2. Dimension & Asset Filtering Rules
- Filter out non-content UI elements (avatars, icons, navigation logos) strictly using element dimensions (e.g., width or height < 50px) or generic UI asset class names rather than domain matching.
- Maintain a minimal list of site-wide UI assets in `SKIP_PATTERNS` only for explicit UI components (e.g., logo, header banner).

### 3. File Naming & Code Modularization
- Each adapter class MUST reside in its own dedicated file named after the primary site key (e.g., `komiku.ts`, `kiryuu.ts`, `westmanga.ts`).
- Keep adapter implementations concise, self-contained, and strictly under **200 lines of code** per file.
- Register all newly created adapters in `lib/adapters/registry.ts` and declare their URL match patterns in both `entrypoints/content.ts` and `wxt.config.ts` (`host_permissions`).

### 4. Language & Clean Code Standard
- Write all comments, docstrings, logger scopes, error messages, and class methods in **English**.
- Do not use emoji symbols in source code, diagnostic outputs, or log messages.
- Maintain `inspectDiagnostics()` implementation on every adapter to provide detailed DOM inspection diagnostics for debugging.

---

## Directory Structure

```text
lib/adapters/
├── base-adapter.ts   # Abstract base class and ChapterInfo interface
├── registry.ts       # Adapter auto-detection registry and lookup helper
├── komiku.ts         # Komiku parser adapter
├── kiryuu.ts         # Kiryuu parser adapter
├── ainzscans.ts      # AinzScans parser adapter
└── README.md         # Developer rules and architecture guide
```
