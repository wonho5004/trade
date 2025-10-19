# Repository Guidelines

## Project Structure & Module Organization
- Next.js routes live in `src/app`, grouped by feature folders (e.g., `dashboard`, `trading`, `analysis`); API handlers sit under `src/app/api`.
- Shared UI: `src/components/{chart,trading,ui,common}`; domain logic: `src/lib/{trading,analysis,chart}`.
- State management in `src/stores`, cross-cutting types in `src/types`, and fixtures/helpers live near tests in `test-utils` directories.
- Python mirrors the TS layout: `python/analysis`, `python/backtesting`, `python/indicators`.

## Build, Test, and Development Commands
- `npm install` — install dashboard dependencies.
- `npm run dev` — start Next.js at `http://localhost:3000`.
- `npm run build && npm run start` — create the production bundle, then run a smoke test.
- `npm run lint` — apply ESLint/Prettier rules; fix all warnings before merging.
- `npm run test [--watch]` — run Jest + React Testing Library suites.
- `python python/analysis/main.py` — run analytics/backtests (document new entrypoints in `docs/`).

## Coding Style & Naming Conventions
- TypeScript is strict; favor immutable patterns and explicit return types.
- Format with 2-space indentation, single quotes, and trailing commas. Use the project formatter before commits.
- Naming: React components use PascalCase, hooks start with `use`, Zustand stores end in `Store`.
- Extract recurring Tailwind clusters into helpers; keep shadcn/ui variants colocated with components.

## Testing Guidelines
- Co-locate `*.test.ts(x)` beside the features they cover; prefer behavioural checks via React Testing Library.
- Mock Binance integrations with fixtures from `src/test-utils` for deterministic coverage.
- Target ≥80% coverage on new code; annotate intentional gaps with TODOs referencing tracking issues.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (e.g., `feat: add order book panel`, `fix: correct supabase config`).
- PRs: describe the change, list executed commands (lint, tests, build), and attach relevant UI evidence.
- Reference tickets with `Closes #ID`. Keep secrets in local `.env*`; surface client-safe values via `NEXT_PUBLIC_*`.
- Validate incoming data within API routes and confirm the worktree is clean before requesting review.

## Security & Configuration Tips
- Do not commit secrets; maintain `.env*` locally. Only expose client-safe env via `NEXT_PUBLIC_*`.
- Review third-party changes and validate inputs at API boundaries.

## Agent-Specific Instructions
- Respect this file’s scope; keep changes minimal and focused. Avoid unrelated refactors.
- Prefer small, targeted patches and co-located tests. Update docs when adding new Python or API entrypoints.
