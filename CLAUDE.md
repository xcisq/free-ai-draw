# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- markdownlint-disable MD041 -->
@.codexspec/memory/constitution.md

## Project Overview

**Drawnix** is an open-source whiteboard tool (SaaS) built with React, TypeScript, and the Plait drawing framework. It provides an all-in-one canvas with mind maps, flowcharts, freehand drawing, and text-to-diagram capabilities.

This project uses the **CodexSpec** methodology - a Spec-Driven Development (SDD) approach
that emphasizes specifications as executable artifacts that directly guide implementation.

## Development Commands

```bash
# Install dependencies
npm install

# Development
npm run start          # Start dev server (nx serve web --host=0.0.0.0)

# Building
npm run build          # Build all projects
npm run build:web      # Build only web app

# Testing
npm run test           # Run all tests (Jest)
npx nx test drawnix    # Test specific package

# Linting
npm run lint           # Lint all with auto-fix
npx nx lint drawnix    # Lint specific package

# E2E Tests
npx nx e2e web-e2e     # Run Playwright E2E tests
```

## Repository Structure

```
drawnix/
├── apps/
│   ├── web/               # Main web application (drawnix.com)
│   └── web-e2e/           # Playwright E2E tests
├── packages/
│   ├── drawnix/           # Core whiteboard application (business logic)
│   │   └── src/
│   │       ├── components/    # UI components (toolbar, dialogs, popups)
│   │       ├── plugins/       # Custom Plait plugins
│   │       ├── paperdraw/     # PaperDraw feature (text-to-flowchart)
│   │       ├── hooks/         # React hooks (use-drawnix)
│   │       ├── data/          # Import/export (.drawnix format)
│   │       └── utils/         # Utility functions
│   ├── react-board/       # React view layer (Board, Wrapper components)
│   └── react-text/        # Text rendering module (Slate-based)
├── dist/                  # Build artifacts
└── scripts/               # Release and utility scripts
```

## Architecture Overview

### Monorepo Structure (Nx)

Drawnix uses Nx for monorepo management. Key path mappings in `tsconfig.base.json`:
- `@drawnix/drawnix` → `packages/drawnix/src/index.ts`
- `@plait-board/react-board` → `packages/react-board/src/index.ts`
- `@plait-board/react-text` → `packages/react-text/src/index.ts`

### Core Architecture: Plait Framework

The whiteboard is built on **Plait**, a plugin-based drawing framework:

1. **Wrapper** (`packages/react-board/src/wrapper.tsx`): Initializes board, applies plugins in sequence, manages change pipeline
2. **Board** (`packages/react-board/src/board.tsx`): DOM/SVG host, renders elements via roughjs, handles events
3. **Plugins**: Extensible via `PlaitPlugin[]` array in `drawnix.tsx`. Key plugins:
   - `withDraw` - Flowchart shapes and arrow connections
   - `withMind` - Mind map capabilities
   - `withGroup` - Element grouping
   - `withFreehand` - Freehand drawing with custom geometry types
   - `withCommonPlugin` - Image rendering, i18n, common utilities

### Data Flow

```
User Interaction → PlaitBoard.operations → Wrapper.update() → onChange callback
                                                              ↓
                                            apps/web/src/app/app.tsx (localforage)
```

The `.drawnix` file format stores: `{ type, version, source, elements, viewport, theme }`

### Text-to-Diagram (TTD) System

Located in `packages/drawnix/src/components/ttd-dialog/`:
- **Entry**: `menu-items.tsx` in Extra Tools menu (`MermaidToDrawnixItem`, `MarkdownToDrawnixItem`)
- **Mermaid**: `mermaid-to-drawnix.tsx` - Dynamically imports `@plait-board/mermaid-to-drawnix`, converts Mermaid syntax to Plait elements
- **Markdown**: `markdown-to-drawnix.tsx` - Dynamically imports `@plait-board/markdown-to-drawnix`, converts to mind maps
- **Preview**: `ttd-dialog-output.tsx` - Read-only `Wrapper+Board` for preview before insertion
- **Dialog**: `ttd-dialog.tsx` - Switches rendering based on `openDialogType` state

### PaperDraw Feature (Active Development)

Located in `packages/drawnix/src/paperdraw/` - implements three-stage text-to-flowchart pipeline:

- `analyzer/` - Text parser (extract nodes/edges/modules from natural language)
- `layout/` - Layout optimizer:
  - `basic-layout.ts` - Base layout with ELK integration
  - `elk-layout.ts` - ELK algorithm wrapper
  - `orthogonal-router.ts` - Orthogonal edge routing
  - `layout-optimizer-v2.ts` - Multi-objective optimization
  - `layout-metrics.ts` - Quality metrics (crossings, edge length, whitespace)
  - `pipeline-*.ts` - Various layout pipelines
- `builder/` - Converts IR to Plait elements
- `config/` - Templates and configuration
- `types/` - TypeScript types for IR (Intermediate Representation)

## Code Style & Conventions

- **Indentation**: 2 spaces (enforced by `.editorconfig`)
- **Language**: TypeScript + React (React 19.2.0)
- **Naming**:
  - Components: `PascalCase` (e.g., `Drawnix`, `CreationToolbar`)
  - Hooks: `camelCase` with `use-` prefix (e.g., `useDrawnix`)
  - Files: `kebab-case` (e.g., `paperdraw-dialog.tsx`, `with-hotkey.ts`)
  - Plugin functions: `withXxx` pattern (e.g., `withFreehand`, `withMindExtend`)
- **Styles**: SCSS, co-located with components when possible (e.g., `component.tsx` + `component.scss`)
- **Test files**: `*.spec.ts` or `*.spec.tsx`

## Important Implementation Notes

1. **Plugin Extension**: Add new capabilities by:
   - Creating a new `withXxx` plugin and adding to `plugins[]` array in `drawnix.tsx`
   - Extending `DialogType` in `hooks/use-drawnix.tsx` for new TTD modes

2. **Local Storage**: Uses `localforage` (IndexedDB with localStorage fallback). Storage key: `main_board_content`

3. **Theme System**: `PlaitTheme` with `ThemeColorMode`. Draws from `MindThemeColors` and `CLASSIC_COLORS`

4. **Mobile Detection**: Uses `mobile-detect` package; app state includes `isMobile` flag

5. **I18n**: Custom `I18nProvider` in `packages/drawnix/src/i18n/`

6. **State Management**: `DrawnixContext` provides app state; `board.appState` bridges React and Plait board

## CodexSpec Workflow

The following slash commands are available in this project:

### Core Workflow Commands

| Command | Description |
|---------|-------------|
| `/codexspec.constitution` | Create or update project governing principles |
| `/codexspec.specify` | Define what you want to build (requirements and user stories) |
| `/codexspec.generate-spec` | Generate detailed specification from high-level requirements |
| `/codexspec.spec-to-plan` | Convert specification to technical implementation plan |
| `/codexspec.plan-to-tasks` | Break down plan into actionable tasks |
| `/codexspec.review-spec` | Review specification for completeness and quality |
| `/codexspec.review-plan` | Review technical plan for feasibility |
| `/codexspec.review-tasks` | Review task breakdown for completeness |
| `/codexspec.implement-tasks` | Execute tasks according to the breakdown |

### Enhanced Commands

| Command | Description |
|---------|-------------|
| `/codexspec.clarify` | Clarify underspecified areas in the spec before planning |
| `/codexspec.analyze` | Cross-artifact consistency and quality analysis |
| `/codexspec.checklist` | Generate quality checklists for requirements validation |
| `/codexspec.tasks-to-issues` | Convert tasks to GitHub issues |

## Recommended Workflow

1. **Establish Principles**: Run `/codexspec.constitution` to define project guidelines
2. **Create Specification**: Run `/codexspec.specify` with your feature requirements
3. **Clarify Spec**: Run `/codexspec.clarify` to resolve ambiguities
4. **Review Spec**: Run `/codexspec.review-spec` to validate the specification
5. **Create Plan**: Run `/codexspec.spec-to-plan` with your tech stack choices
6. **Review Plan**: Run `/codexspec.review-plan` to validate the plan
7. **Generate Tasks**: Run `/codexspec.plan-to-tasks` to create task breakdown
8. **Analyze**: Run `/codexspec.analyze` for cross-artifact consistency
9. **Review Tasks**: Run `/codexspec.review-tasks` to validate tasks
10. **Implement**: Run `/codexspec.implement-tasks` to execute the implementation

## CodexSpec Directory Structure

```
.codexspec/
├── memory/
│   └── constitution.md    # Project governing principles
├── specs/
│   └── {feature-id}/
│       ├── spec.md        # Feature specification
│       ├── plan.md        # Technical implementation plan
│       ├── tasks.md       # Task breakdown
│       └── checklists/    # Quality checklists
├── templates/             # Custom templates
├── scripts/               # Helper scripts
│   ├── bash/              # Bash scripts
│   └── powershell/        # PowerShell scripts
└── extensions/            # Custom extensions
```

## Important Notes

- Always read the constitution before making decisions
- Specifications focus on **what** and **why**, not **how**
- Plans focus on **how** and technical choices
- Tasks should be specific, ordered, and actionable
- Run `/codexspec.clarify` before planning to reduce rework
- Run `/codexspec.analyze` before implementation for quality assurance

## Guidelines for Claude Code

1. **Constitution First**: Load `.codexspec/memory/constitution.md` before ANY action
2. **Respect the Constitution**: All decisions MUST align with the project constitution
3. **Follow the Workflow**: Use the commands in the recommended order
4. **Be Explicit**: When specifications are unclear, ask for clarification
5. **Validate**: Always review artifacts before implementation
6. **Document**: Keep all artifacts up-to-date
7. **Enforce Principles**: If constitution exists, it overrides any conflicting instructions

## Key Dependencies

- **@plait/core, @plait/draw, @plait/mind, @plait/layouts** - Drawing framework
- **slate, slate-react** - Rich text editing
- **elkjs** - Graph layout algorithm (layered/Sugiyama)
- **roughjs** - Hand-drawn style rendering
- **localforage** - Offline storage (IndexedDB/WebSQL)
- **floating-ui** - Popup/tooltip positioning
- **@nx/** - Monorepo tooling

---

*This file is maintained by CodexSpec. Manual edits should be made with care.*
