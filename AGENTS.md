# Repository Guidelines

## Project Structure & Module Organization
- Next.js routes live in `src/app`, grouped by feature folders like `dashboard`, `trading`, and `analysis`; API handlers sit under `src/app/api`.
- Shared UI is split across `src/components/{chart,trading,ui,common}` and domain logic in `src/lib/{trading,analysis,chart}`.
- State management resides in `src/stores`, cross-cutting types in `src/types`, and fixtures or helpers stay near tests in `test-utils` directories.
- Python analytics and backtesting mirror the TypeScript layout inside `python/analysis`, `python/backtesting`, and `python/indicators`.

## Build, Test, and Development Commands
- `npm install` — install dashboard dependencies.
- `npm run dev` — start the Next.js dev server at `http://localhost:3000`.
- `npm run build && npm run start` — create the production bundle, then run a smoke test.
- `npm run lint` — apply ESLint/Prettier rules; fix every warning before merging.
- `npm run test` — execute Jest + React Testing Library suites; append `--watch` for focused runs.
- `python python/analysis/main.py` — trigger analytics or backtests; document new entrypoints in `docs/`.

## Coding Style & Naming Conventions
- TypeScript runs in strict mode; prefer immutable patterns and explicit return types.
- Format with 2-space indentation, single quotes, and trailing commas; run the project formatter before commits.
- Name React components with PascalCase, hooks with a `use` prefix, and Zustand stores ending in `Store`.
- Extract recurring Tailwind clusters into helpers and keep shadcn/ui variants colocated with components.

## Testing Guidelines
- Co-locate `*.test.ts(x)` files with the features they cover; focus on behavioural checks via React Testing Library.
- Mock Binance integrations with fixtures from `src/test-utils` for deterministic coverage.
- Target ≥80% coverage on new code; annotate intentional gaps with TODOs referencing tracking issues.

## Commit & Pull Request Guidelines
- Follow Conventional Commits, e.g., `feat: add order book panel` or `fix: correct supabase config`.
- Summaries must explain the change, list executed commands (lint, tests, builds), and attach relevant UI evidence.
- Reference tickets using `Closes #ID`, keep secrets in local `.env*`, and surface client-safe values via `NEXT_PUBLIC_*`.
- Validate incoming data within API routes and confirm the worktree is clean before requesting review.
