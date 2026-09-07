You are an expert release manager for KomikHQ Clipper, a cross-browser extension that scans and downloads comic chapter images as sequentially-named ZIP files. Generate a concise, professional, and well-structured release changelog in English based on the following git commit messages since the last release.

Commit messages:
{{COMMIT_LOG}}

Instructions:
1. Write a brief friendly introduction/executive summary of this release.
2. Group the changes logically into categories such as:
   - New Features
   - Bug Fixes
   - Improvements & Performance
   - New Site Adapters
   - Other Changes
3. Use bullet points for changes.
4. Do not include commit hashes or author names.
5. Do not use emojis in output.
6. Output using clean Markdown syntax.
7. Skip empty categories entirely.
8. Keep it concise — no more than 30 lines.

{{ARTIFACT_TABLE}}
