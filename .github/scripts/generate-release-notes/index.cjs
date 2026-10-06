const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = process.cwd();
const outputPath = path.join(root, 'release_notes.md');
const templatePath = path.join(root, '.github', 'release-prompt-template.md');
const repository = process.env.GITHUB_REPOSITORY || 'komikhq/komikhq-clipper';
const releaseTag = process.env.GITHUB_REF_NAME || 'v0.0.0';
const requestTimeoutMs = 30_000;

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function getCommitLog() {
  try {
    const tags = git('tag', '--sort=-version:refname', '--list', 'v*')
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    if (tags.length > 1) {
      const prevTag = tags[1];
      console.log(`Generating changelog since tag: ${prevTag}`);
      const log = git('log', `${prevTag}..HEAD`, '--oneline');
      if (log) return log;
    }

    console.log('Fetching latest 50 commits...');
    const log = git('log', '--oneline', '-n', '50');
    return log || 'Initial release / No commit logs found.';
  } catch (error) {
    console.warn('Failed to retrieve git log:', error.message);
    return 'Initial release / No commit logs found.';
  }
}

function generateArtifactTable(repo, tag) {
  return `
### Download Extension Packs

| Platform | File | Install Method |
| --- | --- | --- |
| Chromium (Chrome/Edge/Brave) | [\`komikhq-clipper-${tag}-chrome.zip\`](https://github.com/${repo}/releases/download/${tag}/komikhq-clipper-${tag}-chrome.zip) | Load unpacked / Developer mode |
| Chromium (CRX3 Self-Signed) | [\`komikhq-clipper-${tag}.crx\`](https://github.com/${repo}/releases/download/${tag}/komikhq-clipper-${tag}.crx) | Drag to \`chrome://extensions\` |
| Firefox | [\`komikhq-clipper-${tag}-firefox.zip\`](https://github.com/${repo}/releases/download/${tag}/komikhq-clipper-${tag}-firefox.zip) | Load temporary add-on in \`about:debugging\` |
| Source Code (Store Verification) | [\`komikhq-clipper-${tag}-sources.zip\`](https://github.com/${repo}/releases/download/${tag}/komikhq-clipper-${tag}-sources.zip) | Source zip for submission verification |
`;
}

function loadLocalApiKey() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const match = fs.readFileSync(envPath, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
  return match?.[1]?.trim();
}

async function run() {
  const commitLog = getCommitLog() || 'No commits found since the last release.';

  if (!fs.existsSync(templatePath)) {
    console.error(`Error: Template file not found at ${templatePath}`);
    process.exit(1);
  }

  const artifactTable = generateArtifactTable(repository, releaseTag);
  let prompt = fs.readFileSync(templatePath, 'utf8')
    .replace('{{COMMIT_LOG}}', commitLog)
    .replace('{{ARTIFACT_TABLE}}', artifactTable);

  const apiKey = process.env.GEMINI_API_KEY || loadLocalApiKey();

  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath);
  }

  if (!apiKey) {
    console.warn('[WARN] GEMINI_API_KEY is not set. Generating fallback release notes.');
    writeFallbackNotes(commitLog, artifactTable);
    return;
  }

  console.log('--- Sending Prompt to Gemini API ---');
  console.log(prompt);
  console.log('------------------------------------');

  const candidateModels = [
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.7-flash',
    'gemini-flash-lite-latest',
  ];

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  let generatedText = null;
  const failures = [];

  for (const modelName of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log(`Requesting Gemini API (model: ${modelName}, attempt: ${attempt}/3)...`);
        const signal = AbortSignal.timeout(requestTimeoutMs);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text?.trim()) {
            generatedText = text.trim();
            console.log(`Successfully generated release notes using model ${modelName}.`);
            break;
          }
          failures.push(`${modelName} attempt ${attempt}: empty response payload`);
        } else {
          const errorText = await response.text();
          failures.push(`${modelName} attempt ${attempt}: HTTP ${response.status} - ${errorText}`);
          console.warn(`Gemini API returned status ${response.status} for model ${modelName}`);

          if (response.status === 429 || response.status >= 500) {
            console.log('Retrying in 2 seconds...');
            await new Promise((res) => setTimeout(res, 2000));
            continue;
          }
          break;
        }
      } catch (err) {
        failures.push(`${modelName} attempt ${attempt}: ${err.message}`);
        console.warn(`Attempt ${attempt} for model ${modelName} failed: ${err.message}`);
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    }

    if (generatedText) {
      break;
    }
  }

  if (generatedText) {
    let finalNotes = generatedText
      .replace(/\{\{GITHUB_REPOSITORY\}\}/g, repository)
      .replace(/\{\{RELEASE_VERSION\}\}/g, releaseTag);

    fs.writeFileSync(outputPath, finalNotes.trim() + '\n', 'utf8');
    console.log(`Release notes successfully generated and written to ${outputPath}`);
  } else {
    console.warn('[WARN] All Gemini API models failed. Generating fallback release notes.');
    console.warn(failures.join('\n'));
    writeFallbackNotes(commitLog, artifactTable);
  }
}

function writeFallbackNotes(commitLog, artifactTable) {
  const fallbackNotes = `### Release Summary (${releaseTag})

### Commits in this Release

\`\`\`
${commitLog}
\`\`\`

${artifactTable}
`;
  fs.writeFileSync(outputPath, fallbackNotes.trim() + '\n', 'utf8');
  console.log(`Fallback release notes written to ${outputPath}`);
}

run().catch((err) => {
  console.error('Fatal error in generate-release-notes:', err);
  process.exit(1);
});
