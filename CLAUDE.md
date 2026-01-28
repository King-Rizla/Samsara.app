# CLAUDE.md - Samsara Project Intelligence

## Project Context

Samsara is an AI-powered resume editing application built with:
- **Electron** (desktop app) + **React** (renderer) + **TypeScript**
- **Python sidecar** for parsing/extraction (spawned as child process)
- **IPC bridge** between Electron main process and renderer
- **SQLite** (better-sqlite3) for local-first data storage
- **Local-first architecture**: Zero cloud dependency, all processing on-device

## Architecture

- `src/` - Electron + React TypeScript code (main process, preload, renderer)
- `python-src/` - Python sidecar (parsers, extractors, export, schema)
- `.vite/` - Vite build output (do not edit)
- `python-dist/` - PyInstaller bundle output

## Mandatory Pre-Completion Checks

Before completing ANY task, run through this 7-point checklist:

### 1. Secrets Scan
No hardcoded API keys, tokens, passwords, or credentials in code.
```bash
# Check staged files for secrets
git diff --cached --name-only | xargs grep -l -i "api.key\|secret\|password\|token\|credential" || echo "Clean"
```

### 2. Injection Check
No string concatenation in SQL queries. All SQL must use parameterized queries.
```bash
# Verify no raw string SQL
grep -rn "db\.\(exec\|run\|prepare\)" src/ --include="*.ts" | grep -v "?" | head -20
```

### 3. Path Traversal
All file paths are validated. No user input directly used in file system operations without sanitization.

### 4. Input Validation
All IPC handlers validate their inputs. No unvalidated data crosses the IPC bridge.

### 5. Tests Pass
```bash
# TypeScript unit tests
npx vitest run

# Python tests
cd python-src && python -m pytest
```

### 6. Types Check
```bash
# TypeScript type checking
npx tsc --noEmit

# Python type checking
cd python-src && python -m mypy .
```

### 7. Lint Clean
```bash
# TypeScript linting
npx eslint --ext .ts,.tsx src/

# Python linting
cd python-src && python -m ruff check .
```

## Development Commands

```bash
# Start app
npm start

# Run all JS/TS tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run typecheck

# E2E tests
npm run test:e2e

# Python tests
cd python-src && python -m pytest

# Python lint
cd python-src && python -m ruff check . --fix
```
