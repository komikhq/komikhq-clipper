# E2E Testing Suite (Playwright)

This directory contains the End-to-End (E2E) automated tests for `komikhq-clipper` built using [Playwright](https://playwright.dev/).

---

## Language, Modularity & Architecture Conventions

### 1. English Only
- All test files, test suite descriptions, test case titles, variable names, and documentation **MUST** be written in **English**.

### 2. Strict Modularity & Single Responsibility
- **No Monolithic Design**: Never write monolithic test suites or code files. Every file must serve one specific, highly-focused feature or domain responsibility.
- **Specific File Naming**: Avoid broad or generic file names (e.g., `helpers.ts`, `all-tests.spec.ts`, `utils.spec.ts`). Use clear, purpose-driven file names (e.g., `komiku-adapter.spec.ts`, `zip-generation.spec.ts`).
- **File Size Limit**: No file should exceed **200 lines of code**. If a file approaches or exceeds 200 lines, immediately refactor and split it into smaller, modular sub-modules or page objects.

### 3. Test Structure
- Name test files using standard `.spec.ts` suffix (e.g., `smoke.spec.ts`, `komiku-parser.spec.ts`).
- Group related test scenarios using `test.describe('Suite Title', ...)` blocks and express individual expectations clearly using `test('should ...', ...)` blocks.

---

## Directory Structure

```text
tests/
├── e2e/
│   ├── example.spec.ts   # Example smoke test
│   └── ...               # Focused E2E spec files (< 200 lines per file)
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
