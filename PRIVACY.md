# Privacy Policy for KomikHQ Clipper

**Last updated:** October 9, 2026

KomikHQ Clipper ("the Extension", "we", "us", or "our") is an open-source browser extension developed by the KomikHQ team. We are committed to protecting your privacy. This Privacy Policy explains our practices regarding data collection, usage, and disclosure when you use the KomikHQ Clipper browser extension.

---

## 1. Summary (Key Principles)

* **Zero Data Collection:** We do not collect, store, transmit, or sell any personal data, browsing activity, or personally identifiable information (PII).
* **Pure Client-Side Operation:** All chapter scanning, image extraction, and ZIP compression occur entirely within your browser locally.
* **No Telemetry or Tracking:** The extension contains no tracking scripts, analytics libraries, advertising SDKs, or external trackers.
* **No Remote Code:** All code is packaged locally within the extension bundle in strict accordance with Manifest V3 and store review policies.

---

## 2. Information We Do Not Collect

KomikHQ Clipper does **NOT** collect, process, or transmit:
* Personally Identifiable Information (such as name, email address, physical address, or phone number).
* Authentication credentials, passwords, or session tokens.
* Financial, payment, or billing information.
* Browsing history, visited URLs, or search queries.
* Device identifiers, IP addresses, or location data.
* Keystrokes, mouse movements, or user activity logs.

---

## 3. Browser Permissions & Purpose

KomikHQ Clipper requests only the minimum set of permissions necessary to deliver its core functionality. Below is a detailed breakdown of each permission requested in `manifest.json`:

| Permission | Technical Purpose & Justification |
| :--- | :--- |
| `activeTab` | Allows the extension to interact with the currently active browser tab when opened, identifying if the user is currently viewing a comic chapter on a supported domain. |
| `scripting` | Enables content script execution within the active reader tab DOM to detect chapter image elements and extract image URLs. |
| `downloads` | Used exclusively to prompt and save the compiled, sequentially-named ZIP archive onto your local storage. |
| `offscreen` | Used exclusively in Chromium-based browsers to host an isolated, headless document context for generating temporary Blob URLs required by `chrome.downloads.download`. Never accesses or tracks personal data. |
| `alarms` | Used to schedule a temporary, delayed background alarm that automatically resets the extension badge status and counter after a download finishes, avoiding persistent background processes. |
| `storage` | Used strictly with `browser.storage.local` to store your local preferences (such as the WebP conversion toggle and UI dark/light theme). This data never leaves your device. |
| **Host Permissions** (`*://*.komiku.*`, `*://*.kiryuu.*`, `*://*.komikcast.*`, `*://*.ainzscans.*`) | Scoped strictly to supported comic reader websites to inject DOM parsers and fetch image blobs required to construct the downloadable chapter ZIP archive. No access is requested or executed outside these specific domains. |

---

## 4. Local Storage Usage

The extension uses the browser's local storage API (`browser.storage.local`) and client-side IndexedDB exclusively for:
1. **User Interface Settings:** Remembering your preferred theme (light, dark, or system default).
2. **Download Options:** Remembering your preference for WebP image conversion.
3. **Session Download Sync:** Temporarily synchronizing chapter download progress so the popup can resume status if reopened.
4. **Transient IndexedDB Bridge:** Storing temporary binary buffers locally during ZIP generation to bypass browser IPC limits. All data is deleted immediately from IndexedDB upon retrieval.

This information is stored solely on your local computer or device and is never uploaded, synced, or shared with external servers.

---

## 5. Third-Party Services & External Communication

* **External Servers:** KomikHQ Clipper does not communicate with any external KomikHQ server or third-party cloud backend.
* **Image Fetching:** When extracting chapter images, network requests for comic images are sent directly from your browser to the hosting servers of the supported comic reading websites you are currently viewing.
* **No Ads or Monetization:** KomikHQ Clipper is completely free, open source, and does not serve advertisements.

---

## 6. Security

Because all processing—including DOM parsing, image fetching, and ZIP file generation—takes place entirely within your browser's local memory and sandbox, your data remains secure and isolated from third parties.

---

## 7. Open Source & Transparency

KomikHQ Clipper is open-source software licensed under the MIT License. You can review the complete source code, build scripts, and dependencies at any time on GitHub:
👉 [https://github.com/komikhq/komikhq-clipper](https://github.com/komikhq/komikhq-clipper)

---

## 8. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or browser store compliance requirements. Any revisions will be reflected in this document with an updated "Last updated" date. Continued use of the extension following any updates indicates your acceptance of the revised policy.

---

## 9. Contact Us

If you have any questions, concerns, or feedback regarding this Privacy Policy or the security of the extension, please open an issue or discussion on GitHub:
* **Repository:** [https://github.com/komikhq/komikhq-clipper/issues](https://github.com/komikhq/komikhq-clipper/issues)
* **Organization:** [https://github.com/komikhq](https://github.com/komikhq)
