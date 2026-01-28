# Phase 7: Testing and Bug Fixing Protocol - Research

**Researched:** 2026-01-28
**Domain:** Code quality, security scanning, pre-commit hooks, automated testing
**Confidence:** HIGH

## Summary

This phase establishes a multi-layered quality gate system for the Samsara Electron+Python codebase. The approach combines a CLAUDE.md session gate (instructions Claude reads every session), pre-commit hooks via Husky + lint-staged (JS/TS) and the pre-commit framework (Python scanners), and automated scanners (ruff with Bandit rules, mypy, semgrep, gitleaks).

The project has two distinct codebases requiring separate toolchains: TypeScript/React (Electron main + renderer) using ESLint, tsc, and vitest; and Python (sidecar) using ruff (which replaces flake8, isort, black AND includes Bandit security rules natively), mypy, and pytest. This dual-stack nature means pre-commit hooks must orchestrate both ecosystems.

**Primary recommendation:** Use Husky 9 + lint-staged for JS/TS checks (already in the npm ecosystem), and the Python `pre-commit` framework for Python-side scanners (semgrep, gitleaks, ruff). Both can coexist by having Husky's pre-commit hook invoke `npx lint-staged` AND `pre-commit run --files` for staged Python files.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| husky | ^9.x | Git hooks management (JS ecosystem) | Already npm-based project; creates `.husky/` scripts |
| lint-staged | ^15.x | Run linters on staged files only | Fast -- only checks changed files, not entire codebase |
| ruff | ^0.9.x | Python linter + formatter + Bandit security rules | Replaces flake8, isort, black, bandit in one tool; 10-100x faster |
| mypy | ^1.14.x | Python static type checking | Standard Python type checker; catches bugs before runtime |
| semgrep | ^1.149.x | SAST scanner (OWASP rules, TypeScript + Python) | Language-agnostic; covers both TS and Python; free open-source rules |
| gitleaks | ^8.24.x | Secret detection in git history + staged files | Standard secrets scanner; pre-commit hook support |
| vitest | (already in project via vite) | JS/TS unit testing | Already implied by Vite setup; fast, native ESM |
| pytest | ^8.x | Python unit testing | Standard Python test framework |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| pre-commit (Python framework) | Orchestrate Python-side hooks | Runs semgrep, gitleaks, ruff as pre-commit hooks |
| @vitest/coverage-v8 | Code coverage for JS/TS | Measuring test coverage |
| pytest-cov | Code coverage for Python | Measuring Python test coverage |
| hypothesis | Property-based testing for Python | Generating edge cases / fuzzing corpus |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ruff (with `select=["S"]`) | standalone bandit | Bandit is slower, separate tool; ruff includes all Bandit rules natively |
| husky + pre-commit coexistence | husky only (shell scripts) | pre-commit framework has better semgrep/gitleaks integration; husky alone would need manual binary management |
| snyk | npm audit + semgrep | Snyk requires account/API key; npm audit + semgrep covers same ground for free |

**Installation:**

```bash
# JS/TS side
npm install --save-dev husky lint-staged vitest @vitest/coverage-v8

# Python side (add to requirements-dev.txt)
pip install ruff mypy pytest pytest-cov hypothesis pre-commit

# System tools (install separately)
# semgrep: pip install semgrep OR brew install semgrep
# gitleaks: brew install gitleaks OR scoop install gitleaks (Windows)
```

## Architecture Patterns

### Recommended Project Structure

```
project-root/
├── CLAUDE.md                    # Session gate with mandatory checks
├── .husky/
│   └── pre-commit               # Runs lint-staged + pre-commit framework
├── .pre-commit-config.yaml      # semgrep, gitleaks, ruff hooks
├── .gitleaks.toml               # gitleaks custom config (allowlists)
├── .semgrepignore                # semgrep exclusions
├── pyproject.toml               # ruff + mypy + bandit config
├── src/
│   ├── main/                    # Electron main process
│   │   └── __tests__/           # vitest unit tests
│   └── renderer/
│       └── __tests__/           # vitest unit tests
├── python-src/
│   ├── tests/                   # pytest tests
│   │   ├── test_extractors.py
│   │   ├── test_parsers.py
│   │   ├── test_normalizers.py
│   │   ├── test_export.py
│   │   ├── test_schema.py
│   │   ├── test_edge_cases.py   # Fuzzing corpus
│   │   └── conftest.py          # Shared fixtures
│   └── ...
├── e2e/                         # Playwright E2E tests (already exists)
└── vitest.config.ts             # vitest configuration
```

### Pattern 1: Dual-Stack Pre-Commit Hook

**What:** Husky's pre-commit script invokes both lint-staged (JS/TS) and pre-commit (Python).
**When to use:** Projects with both JS and Python codebases.

`.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
pre-commit run --files $(git diff --cached --name-only -- '*.py') || true
```

`package.json` lint-staged config:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "bash -c 'npx tsc --noEmit'"
    ]
  }
}
```

### Pattern 2: CLAUDE.md Session Gate

**What:** CLAUDE.md file with mandatory pre-completion checklist that Claude reads every session.
**When to use:** Every coding session.

```markdown
# Samsara - CLAUDE.md

## Mandatory Pre-Completion Checks

Before completing ANY task, verify:

1. **Secrets scan**: No API keys, passwords, or tokens in code/comments/configs
2. **Injection check**: All user inputs sanitized; no eval(), no raw SQL, no unsanitized IPC
3. **Path traversal**: All file paths validated; no user-controlled path joins without sanitization
4. **Input validation**: All IPC handlers validate input types and ranges
5. **Tests pass**: `npx vitest run` and `cd python-src && pytest`
6. **Types check**: `npx tsc --noEmit` and `cd python-src && mypy .`
7. **Lint clean**: `npx eslint src/` and `cd python-src && ruff check .`
```

### Pattern 3: Self-Audit Test Generation

**What:** Structured approach to writing tests that try to break functionality.
**When to use:** For each critical function, generate adversarial tests.

Categories of tests to generate per function:
- Null/undefined/None inputs
- Empty strings, empty arrays, empty objects
- Negative numbers, zero, MAX_INT
- Unicode edge cases (RTL, zero-width, emoji, combining chars)
- Very large inputs (100k element arrays, 10MB strings)
- Type confusion (string where number expected, object where array expected)
- Injection payloads (SQL, path traversal, command injection)

### Anti-Patterns to Avoid

- **Running full tsc on staged files only:** `tsc --noEmit` must run on the whole project because TypeScript needs full project context. Do NOT try to run tsc on individual files via lint-staged. Instead, run it as a separate step.
- **Installing semgrep via npm:** Semgrep is a Python tool. Install via pip or system package manager, not npm.
- **Separate bandit + ruff:** Ruff includes all Bandit rules. Running both is redundant. Use `ruff check --select S` instead of standalone bandit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret detection | Custom regex patterns | gitleaks | Hundreds of patterns, maintained, handles git history |
| Python security scanning | Manual code review only | ruff with `select=["S"]` | Covers all Bandit rules at 100x speed |
| SAST/OWASP scanning | Custom vulnerability checks | semgrep with `p/owasp-top-ten` | Community-maintained rulesets, language-aware |
| Edge case generation | Manual test writing only | hypothesis (Python) | Property-based testing generates thousands of cases automatically |
| Pre-commit orchestration | Raw git hooks in `.git/hooks/` | husky + pre-commit framework | Versioned, shareable, team-consistent |

**Key insight:** The scanner ecosystem is mature. Every tool listed has pre-commit hook support. The work is configuration, not implementation.

## Common Pitfalls

### Pitfall 1: TypeScript tsc in lint-staged

**What goes wrong:** Running `tsc --noEmit` per-file in lint-staged fails because TypeScript needs full project context for type resolution.
**Why it happens:** lint-staged passes individual file paths; tsc needs tsconfig.json and all imports.
**How to avoid:** Run `tsc --noEmit` as a separate pre-commit step, not inside lint-staged. Or use the bash wrapper: `"bash -c 'npx tsc --noEmit'"` which ignores lint-staged's file arguments.
**Warning signs:** Type errors about missing imports or unresolved modules.

### Pitfall 2: Pre-commit Hook Too Slow

**What goes wrong:** Developers bypass hooks with `--no-verify` because they take too long.
**Why it happens:** Running semgrep on all files, full type check, etc. on every commit.
**How to avoid:** lint-staged runs only on staged files. semgrep with `--baseline-commit HEAD` only scans diff. Keep total hook time under 30 seconds.
**Warning signs:** Developers complaining about commit speed.

### Pitfall 3: Gitleaks False Positives

**What goes wrong:** Gitleaks flags test fixtures, example data, or high-entropy strings as secrets.
**Why it happens:** Default rules are aggressive.
**How to avoid:** Create `.gitleaks.toml` with allowlists for known false positives. Use `.gitleaksignore` for specific commit/file exclusions.
**Warning signs:** Developers adding `SKIP=gitleaks` to every commit.

### Pitfall 4: mypy Strict Mode on Existing Codebase

**What goes wrong:** Enabling `strict = true` on an untyped codebase produces hundreds of errors.
**Why it happens:** Existing Python code likely has no type annotations.
**How to avoid:** Start with basic mode (`--check-untyped-defs`), add type stubs incrementally. Use `--ignore-missing-imports` initially. Create a mypy baseline.
**Warning signs:** Massive error counts blocking all commits.

### Pitfall 5: Windows Path Issues with Pre-commit Framework

**What goes wrong:** The Python `pre-commit` framework may have issues on Windows with certain hooks.
**Why it happens:** Some hooks assume Unix paths or shell availability.
**How to avoid:** Test all hooks on Windows. For gitleaks/semgrep, prefer the native binary hooks over Docker-based ones. Ensure Git Bash or similar is available.
**Warning signs:** Hooks failing with path or shell errors on Windows only.

## Code Examples

### pyproject.toml Configuration

```toml
[tool.ruff]
target-version = "py312"
line-length = 120
src = ["python-src"]

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings
    "F",    # pyflakes
    "I",    # isort
    "B",    # flake8-bugbear
    "S",    # flake8-bandit (security)
    "UP",   # pyupgrade
    "SIM",  # flake8-simplify
]

[tool.ruff.lint.per-file-ignores]
"python-src/tests/*" = ["S101"]  # Allow assert in tests

[tool.mypy]
python_version = "3.12"
warn_return_any = true
warn_unused_configs = true
check_untyped_defs = true
ignore_missing_imports = true
mypy_path = "python-src"

[tool.pytest.ini_options]
testpaths = ["python-src/tests"]
python_files = "test_*.py"
python_functions = "test_*"
```

### .pre-commit-config.yaml

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.9.6
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.24.2
    hooks:
      - id: gitleaks

  - repo: https://github.com/semgrep/pre-commit
    rev: v1.149.0
    hooks:
      - id: semgrep
        args: ['--config', 'p/owasp-top-ten', '--config', 'p/typescript', '--error', '--skip-unknown-extensions']
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/preload.ts'],
    },
  },
});
```

### Edge Case Test Example (Python)

```python
import pytest
from hypothesis import given, strategies as st

# Manual edge case corpus
EDGE_CASES = [
    None, "", " ", "   ", "\n", "\t", "\r\n",
    "\x00", "\ufeff",  # null byte, BOM
    "a" * 100_000,  # very long string
    "<script>alert(1)</script>",  # XSS
    "'; DROP TABLE resumes; --",  # SQL injection
    "../../../etc/passwd",  # path traversal
    "CON", "NUL", "PRN",  # Windows reserved names
    "\ud800",  # lone surrogate (invalid unicode)
]

@pytest.mark.parametrize("input_val", EDGE_CASES)
def test_parser_handles_edge_cases(input_val):
    """Parser must not crash on any edge case input."""
    # Should either return valid result or raise ValueError, never crash
    try:
        result = parse_resume_text(input_val)
        assert result is not None or input_val in (None, "", " ")
    except (ValueError, TypeError):
        pass  # Expected for invalid inputs
    # Must NEVER raise: RuntimeError, OSError, UnicodeError, etc.

@given(st.text(min_size=0, max_size=10000))
def test_parser_never_crashes_on_arbitrary_text(text):
    """Property-based: parser handles any text without crashing."""
    try:
        parse_resume_text(text)
    except (ValueError, TypeError):
        pass
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| flake8 + isort + black + bandit (4 tools) | ruff (1 tool, includes all) | 2023-2024 | Single tool, 100x faster, unified config |
| husky v4 (npm install hooks) | husky v9 (prepare script) | 2024 | Simpler setup, no npm postinstall hack |
| eslint v8 | eslint v9 (flat config) | 2024-2025 | Project uses v8 which still works; migration optional |
| bandit standalone | ruff `select=["S"]` | 2024 | No need for separate bandit install |

**Deprecated/outdated:**
- **bandit standalone:** Still works, but redundant if using ruff with S rules
- **flake8:** Superseded by ruff for all practical purposes
- **black:** ruff includes formatting via `ruff format`

## Open Questions

1. **Windows compatibility of pre-commit framework**
   - What we know: pre-commit works on Windows but some hooks may have issues
   - What's unclear: Whether semgrep pre-commit hook works smoothly on Windows
   - Recommendation: Test semgrep hook on Windows first; fall back to running semgrep as an npm script if hooks fail

2. **vitest setup with Electron Forge + Vite**
   - What we know: vitest works with Vite but Electron Forge has custom Vite configs (main, preload, renderer)
   - What's unclear: Whether vitest can be added alongside Forge's Vite setup without conflicts
   - Recommendation: Create a separate `vitest.config.ts` that does not extend Forge configs; test main process code in Node environment

3. **mypy baseline for existing Python code**
   - What we know: Python codebase likely has minimal type annotations
   - What's unclear: How many errors mypy will produce on first run
   - Recommendation: Run `mypy python-src/ --ignore-missing-imports` first to assess, then decide on strictness level

## Sources

### Primary (HIGH confidence)
- [Semgrep pre-commit docs](https://semgrep.dev/docs/extensions/pre-commit) - Hook configuration and customization
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks) - Pre-commit hook setup and TOML config
- [Ruff GitHub](https://github.com/astral-sh/ruff) - Configuration, Bandit rule integration
- [Husky GitHub](https://github.com/typicode/husky) - v9 setup pattern
- [lint-staged GitHub](https://github.com/lint-staged/lint-staged) - Configuration options

### Secondary (MEDIUM confidence)
- [Modern Python Code Quality Setup (Dec 2025)](https://simone-carolini.medium.com/modern-python-code-quality-setup-uv-ruff-and-mypy-8038c6549dcc) - ruff + mypy combined config patterns
- [Bandit HelpNetSecurity (Jan 2026)](https://www.helpnetsecurity.com/2026/01/21/bandit-open-source-tool-find-security-issues-python-code/) - Current bandit state
- [CLAUDE.md Guide (Builder.io)](https://www.builder.io/blog/claude-md-guide) - CLAUDE.md format and best practices
- [Anthropic: Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) - Official CLAUDE.md guidance

### Tertiary (LOW confidence)
- TypeScript tsc-in-lint-staged workaround pattern (community convention, multiple sources agree)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools are well-established, documented, actively maintained
- Architecture: HIGH - Dual-stack hook pattern is well-documented; CLAUDE.md format is official
- Pitfalls: MEDIUM - Windows-specific issues are based on general knowledge, not verified on this project

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (stable domain, tools change slowly)
