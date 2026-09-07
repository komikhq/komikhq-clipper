# KomikHQ Clipper

KomikHQ Clipper is a Manifest V3 browser extension for scanning comic chapter pages on KomikU and downloading the detected images as a sequentially named ZIP archive.

## Features

- Detects comic chapter images on supported KomikU pages.
- Downloads images in chapter order.
- Packages downloaded images into a ZIP archive.
- Supports Chromium-based browsers and Firefox through automated release builds.
- Uses browser-native download APIs without a backend service.

## Supported Browsers

- Google Chrome
- Microsoft Edge
- Brave
- Mozilla Firefox

The extension currently supports pages on:

- `komiku.org`
- `komiku.id`

## Installation

### From a release package

1. Open the repository's [Releases](https://github.com/komikhq/komikhq-clipper/releases) page.
2. Download the package for your browser.
3. Install it using the instructions for that browser.

### Chromium-based browsers

1. Download the Chromium ZIP package from Releases.
2. Extract the archive to a local directory.
3. Open `chrome://extensions` or the equivalent extensions page.
4. Enable Developer mode.
5. Select Load unpacked and choose the extracted directory.

### Firefox

1. Download the Firefox XPI package from Releases.
2. Open `about:addons`.
3. Open the extensions settings menu and select Install Add-on From File.
4. Select the downloaded XPI package.

Temporary installation may be used for local development through Firefox's debugging tools.

## Usage

1. Open a supported comic chapter page.
2. Select the KomikHQ Clipper extension from the browser toolbar.
3. Start the scan from the popup.
4. Review the detected images.
5. Start the download to create the ZIP archive.

The extension only operates on supported KomikU domains and requires an active tab to inspect the current page.

## Development

No package installation is required for the extension source itself. The project is plain JavaScript and uses the bundled JSZip library.

### Load the extension locally

For Chromium-based browsers:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the repository directory.

For Firefox, use the browser's temporary add-on installation or debugging tools and select the repository's `manifest.json`.

After changing source files, reload the extension from the browser's extensions page.

## Project Structure

```text
assets/                  Extension icons
content-scripts/         Page scanning and site adapters
lib/                     Bundled third-party libraries
popup/                   Extension popup UI
service-worker/          Background download handling
manifest.json            Manifest V3 configuration
.github/workflows/       Build and release automation
```

Site-specific page parsing belongs in `content-scripts/adapters/`. Shared adapter behavior belongs in `content-scripts/adapters/base-adapter.js`.

## Release Process

Releases are created by `.github/workflows/create-release.yml` when a version tag is pushed.

1. Commit and push the release changes to `main`.
2. Create an annotated version tag, for example `v1.0.0`.
3. Push the tag to GitHub.
4. Monitor the Build & Release Extension Packs workflow.
5. Verify the generated ZIP, CRX, and XPI files on the GitHub Release.

The workflow requires these GitHub Actions secrets:

- `GEMINI_API_KEY` for generated release notes.
- `EXTENSION_PEM_KEY` for signing the Chromium CRX3 package.

The organization secrets must be available to this repository. Never commit private keys or API keys to the repository.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
