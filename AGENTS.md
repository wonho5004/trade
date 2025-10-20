# Repository Guidelines

This guide applies repo‑wide. Nested AGENTS.md files may override within their subtree.

## Project Structure & Module Organization
- Next.js routes live in `src/app/<feature>`; APIs in `src/app/api`.
- Shared UI: `src/components/{chart,trading,ui,common}`. Domain logic: `src/lib/{trading,analysis,chart}`.
- State in `src/stores`; cross‑cutting types in `src/types`; fixtures/helpers in `src/test-utils`.
- Python mirrors TS layout: `python/analysis`, `python/backtesting`, `python/indicators`.
- Public assets in `public/`; co‑locate tests beside features.

## Build, Test, and Development Commands
- `npm install` — install dashboard dependencies.
- `npm run dev` — start Next.js at http://localhost:3000.
- `npm run build && npm run start` — build, then run a smoke test.
- `npm run lint` — run ESLint/Prettier; fix all warnings before merging.
- `npm run test [--watch]` — run Jest + React Testing Library.
- `python python/analysis/main.py` — run analytics/backtests (document new entrypoints in `docs/`).

## Coding Style & Naming Conventions
- TypeScript is strict; prefer immutable patterns and explicit return types.
- Format: 2‑space indent, single quotes, trailing commas; follow repo ESLint/Prettier.
- Naming: Components PascalCase; hooks start with `use`; Zustand stores end with `Store`.
- Extract recurring Tailwind clusters into helpers; keep shadcn/ui variants with components.

## Testing Guidelines
- Co‑locate `*.test.ts(x)` with features; favor behavioral checks via RTL.
- Mock Binance integrations using `src/test-utils` fixtures.
- Target ≥80% coverage on new code; annotate intentional gaps with TODOs linking issues.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: add order book panel`, `fix: correct supabase config`).
- PRs must include: description of change, executed commands (lint, tests, build), relevant UI evidence, and linked issues (e.g., "Closes #123").
- Validate incoming data in API routes and ensure a clean worktree before requesting review.

## Security & Configuration Tips
- Never commit secrets; keep `.env*` local. Expose only client‑safe env via `NEXT_PUBLIC_*`.
- Review third‑party changes and validate inputs at API boundaries.

## Agent‑Specific Instructions
- Keep changes minimal and focused; avoid unrelated refactors.
- Prefer small, targeted patches and co‑located tests. Update docs for new Python or API entrypoints.

