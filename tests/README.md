# E2E Testing Suite (Playwright)

This directory contains the End-to-End (E2E) automated tests for `komikhq-clipper` built using [Playwright](https://playwright.dev/).

---

## Language & Coding Conventions

- **Language**: All test files, test suite descriptions, test case titles, variable names, and documentation **MUST** be written in **English**.
- **File Naming**: Name test files using standard `.spec.ts` suffix (e.g., `example.spec.ts`, `downloader.spec.ts`).
- **Structure**: Group related test scenarios using `test.describe('Suite Title', ...)` blocks and express individual expectations clearly using `test('should ...', ...)` blocks.

---

## Directory Structure

```text
tests/
├── e2e/
│   ├── example.spec.ts   # Example smoke test
│   └── ...               # Additional E2E test specs
└── README.md             # E2E test documentation
```

---

## Running Tests

### Run all E2E tests (Headless Chromium)
```bash
pnpm test:e2e
```

### Run tests in Interactive UI Mode
```bash
pnpm test:e2e:ui
```

### Run a specific test file
```bash
npx playwright test tests/e2e/example.spec.ts
```

### View HTML Test Report
```bash
npx playwright show-report playwright/report
```

---

## Configuration Notes

- **Browser**: Configured to run on **Chromium** (Headless mode enabled by default).
- **Test Results & Reports**: Stored under the `playwright/` folder (`playwright/results/` and `playwright/report/`), which are excluded from Git tracking via `.gitignore`.
