const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function run() {
  // Load .env if GEMINI_API_KEY is not set in environment (for local testing)
  if (!process.env.GEMINI_API_KEY) {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^GEMINI_API_KEY=(.+)$/m);
      if (match) {
        process.env.GEMINI_API_KEY = match[1].trim();
      }
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 1. Get commit history since last tag
  let commitLog = '';
  try {
    const lastTag = execSync(
      'git describe --tags --abbrev=0 --match "v*" HEAD^ 2>/dev/null || git describe --tags --abbrev=0 --match "v*" HEAD~1 2>/dev/null'
    ).toString().trim();
    console.log(`Generating changelog since tag: ${lastTag}`);
    commitLog = execSync(`git log ${lastTag}..HEAD --oneline`).toString().trim();
  } catch (error) {
    console.log('No previous tag found. Fetching last 50 commits instead.');
    try {
      commitLog = execSync('git log --oneline -n 50').toString().trim();
    } catch (gitError) {
      console.error('Failed to retrieve git log:', gitError.message);
      commitLog = 'Initial release / No commit logs found.';
    }
  }

  if (!commitLog) {
    commitLog = 'No commits found since the last release.';
  }

  // 2. Read prompt template
  const templatePath = path.join(__dirname, '..', 'release-prompt-template.md');
  if (!fs.existsSync(templatePath)) {
    console.error(`Error: Template file not found at ${templatePath}`);
    process.exit(1);
  }

  let prompt = fs.readFileSync(templatePath, 'utf8');
  prompt = prompt.replace('{{COMMIT_LOG}}', commitLog);

  const githubRepository = process.env.GITHUB_REPOSITORY || 'komikhq/komikhq-clipper';
  const releaseVersion = process.env.GITHUB_REF_NAME || 'v0.0.0';
  const artifactTable = generateArtifactTable(githubRepository, releaseVersion);

  prompt = prompt.replace('{{ARTIFACT_TABLE}}', artifactTable);

  console.log('--- Sending Prompt to Gemini API ---');
  console.log(prompt);
  console.log('------------------------------------');

  // 3. Request Gemini API with fallback models and retry mechanism
  const candidateModels = [
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-lite-latest'
  ];
  let generatedText = null;

  try {
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    for (const modelName of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Requesting Gemini API (model: ${modelName}, attempt: ${attempt})...`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const data = await response.json();
            generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedText) {
              console.log(`Successfully generated release notes using model ${modelName}.`);
              break;
            }
          } else {
            const errorText = await response.text();
            console.warn(`Gemini API returned status ${response.status} for model ${modelName}: ${errorText}`);
            if (response.status === 503) {
              console.log('503 Service Unavailable. Retrying in 2 seconds...');
              await new Promise(res => setTimeout(res, 2000));
            } else {
              break;
            }
          }
        } catch (err) {
          console.warn(`Attempt ${attempt} for model ${modelName} failed: ${err.message}`);
          await new Promise(res => setTimeout(res, 2000));
        }
      }
      if (generatedText) break;
    }

    if (!generatedText) {
      throw new Error('All Gemini API models failed or returned empty content.');
    }

    let finalNotes = generatedText;

    finalNotes = finalNotes
      .replace(/\{\{GITHUB_REPOSITORY\}\}/g, githubRepository)
      .replace(/\{\{RELEASE_VERSION\}\}/g, releaseVersion);

    // 4. Output the release notes to a file
    const outputPath = path.join(process.cwd(), 'release_notes.md');
    fs.writeFileSync(outputPath, finalNotes, 'utf8');
    console.log(`Release notes successfully generated and written to ${outputPath}`);
  } catch (error) {
    console.error('Failed to generate release notes via Gemini API:', error.message);
    // Fallback release notes
    const outputPath = path.join(process.cwd(), 'release_notes.md');
    const fallbackNotes = `### Release Summary (${releaseVersion})\n\n### Commits in this Release\n\n\`\`\`\n${commitLog}\n\`\`\`\n\n${artifactTable}`;
    fs.writeFileSync(outputPath, fallbackNotes, 'utf8');
    console.log(`Fallback release notes written to ${outputPath}`);
  }
}

function generateArtifactTable(githubRepository, releaseVersion) {
  return `
### Download Extension Packs

| Platform | File | Install Method |
| --- | --- | --- |
| Chromium (Chrome/Edge/Brave) | [\`komikhq-clipper-${releaseVersion}-chrome.zip\`](https://github.com/${githubRepository}/releases/download/${releaseVersion}/komikhq-clipper-${releaseVersion}-chrome.zip) | Load unpacked / Edge Add-ons Store |
| Chromium (CRX3 Self-Signed) | [\`komikhq-clipper-${releaseVersion}.crx\`](https://github.com/${githubRepository}/releases/download/${releaseVersion}/komikhq-clipper-${releaseVersion}.crx) | Drag to \`chrome://extensions\` |
| Firefox | [\`komikhq-clipper-${releaseVersion}-firefox.zip\`](https://github.com/${githubRepository}/releases/download/${releaseVersion}/komikhq-clipper-${releaseVersion}-firefox.zip) | \`about:addons\` / AMO |
| Source Code (Firefox/AMO Compliance) | [\`komikhq-clipper-${releaseVersion}-sources.zip\`](https://github.com/${githubRepository}/releases/download/${releaseVersion}/komikhq-clipper-${releaseVersion}-sources.zip) | Source zip for submission verification |
`;
}

run();
