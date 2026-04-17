# Repository Guidelines

## Current Priority

当前阶段的最高优先级是：`autodraw -> bundle.zip -> Drawnix 画板` 的文字还原问题。

在这个主题下，优先处理：

- 字体适配是否正确
- 字号还原是否失真
- 文本框尺寸是否与原始产物一致
- 锚点、基线、旋转导致的位置偏移
- `scene-import` 与 `svg-import fallback` 两条链路的行为差异

当前阶段暂不主动扩展到无关的 UI 重构、后端接口改造、部署方案或大范围架构调整，除非这些改动是解决文字还原问题的必要条件。

## Text Restoration Working Rules

处理文字还原问题时，始终按下面顺序分析和落地：

1. 先确认源数据真相：
   `scene.json` / `final.svg` 里是否真的提供了 `fontFamily`、`fontSize`、`lineHeight`、`letterSpacing`、`layout.width/height`、`anchor`、`baseline`、`rotation`。
2. 再确认导入映射：
   前端导入时有没有丢字段、改字段、兜底覆盖、最小字号钳制、启发式缩放。
3. 最后确认画板渲染：
   Drawnix / Plait 文本渲染是否真正消费了这些字段，而不是只写入了数据却没有渲染生效。

在这条主线上，优先怀疑以下问题类型：

- 字体被角色字体策略或 fallback 栈替换
- 字号被二次拟合、放大、缩小或设定最小值
- 文本包围盒依赖前端估算而不是后端显式给值
- 基线、锚点、旋转只保留了部分信息
- 复杂标题字、描边字、emoji、本应走 fragment 的文本被错误地走了 native text

## Change Strategy For This Topic

围绕文字还原做改动时，遵守以下约定：

- 优先做小步、可验证的修复，一次只解决一个失真来源。
- 能补测试就补测试，优先补在 `packages/drawnix/src/scene-import` 或 `packages/drawnix/src/svg-import`。
- 如果 `scene-import` 是主链路，修复时仍要检查 `svg-import fallback` 是否出现同类回归。
- 不要用“经验值”继续叠加覆盖现有误差；如果能保留源字段，就优先保留源字段。
- 当 `native-text` 无法保证保真时，允许明确讨论是否切到 `svg-fragment-text`，但要先说明代价。

## Done Criteria For Current Work

这阶段如果要判定“文字还原问题已解决得足够好”，至少应满足：

- 同一份 autodraw zip 在导入后，文字不再出现明显字号放大或缩小
- 字体选择符合预期，不再出现肉眼明显错字风格
- 文本位置不再因锚点、基线、旋转处理不当而明显漂移
- 小字号正文、注释、标题三类文本都要覆盖验证
- 主链路和 fallback 链路至少各有最小回归验证

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

始终可以使用context7去查询对应的library.
