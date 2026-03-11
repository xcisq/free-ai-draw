# Repository Guidelines

## Project Structure & Module Organization
This repository is an Nx monorepo for Drawnix. `apps/web` contains the demo and deployable web app, while `apps/web-e2e` holds Playwright end-to-end tests. Reusable libraries live in `packages/`: `packages/drawnix` is the main whiteboard product, `packages/react-board` provides the React board layer, and `packages/react-text` contains text-editing utilities. Product notes and design material live in `docs/`, release scripts live in `scripts/`, and generated output belongs in `dist/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`. Start the local app with `npm run start`, which runs `nx serve web --host=0.0.0.0`. Build all projects with `npm run build`, or build only the app with `npm run build:web`. Run unit tests across the workspace with `npm run test`. Run lint autofixes with `npm run lint`. For focused checks, prefer Nx targets such as `npx nx test drawnix` or `npx nx e2e web-e2e`.

## Local Development Notes
Current PaperDraw work is local-first. Prefer `apps/web/.env.local` for model configuration, and do not plan production deployment, hosted secrets, or online feature gating unless explicitly requested.

## Coding Style & Naming Conventions
Use TypeScript, React, and SCSS following the existing Nx layout. `.editorconfig` enforces 2-space indentation, UTF-8, and final newlines; `.prettierrc` uses single quotes. Keep React components and exported types in `PascalCase`, hooks in `camelCase` with a `use-` prefix, and file names mostly in kebab-case such as `paperdraw-dialog.tsx` or `with-hotkey.ts`. Place styles close to components when possible, for example `component.tsx` with `component.scss`.

## Testing Guidelines
Jest is used for unit and component tests, and Playwright covers browser flows. Name test files `*.spec.ts` or `*.spec.tsx`; examples include `drawnix.spec.tsx` and `example.spec.ts`. Add or update tests for any behavior change, especially in shared packages. Before opening a PR, run the smallest relevant command first, then expand to workspace-wide checks if needed.

## Commit & Pull Request Guidelines
Recent history shows a mix of Conventional Commit style (`feat(...)`, `fix(...)`) and scoped Chinese prefixes such as `功能:` or `文档:`. Keep messages imperative, concise, and scoped to one change. Pull requests should explain the user-visible impact, list affected apps or packages, link related issues, and include screenshots or recordings for UI changes. Call out breaking changes and any follow-up work clearly.

## Security & Configuration Tips
Do not commit secrets, tokens, or local `.env` values. Use environment variables for sensitive configuration, and avoid adding new network calls or telemetry without explicit review.
