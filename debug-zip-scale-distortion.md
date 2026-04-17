[OPEN] zip-scale-distortion

# Debug Record

- Symptom: `bundle.zip` 导入后图形比例明显失调，元素分布和缩放异常。
- Artifact: `/Users/bytedance/Documents/upc/draw_xcl/drawnix/autodraw/backend/runtime/jobs/20260415_071204_4f9fad9f/bundle.zip`
- Goal: 确认问题出在 zip 生成、zip 解析、还是导入后的视口/布局适配逻辑。

# Hypotheses

1. zip 内部坐标/尺寸原始数据错误。
2. 解析阶段单位换算错误。
3. 导入后发生了二次 fit/normalize 导致失真。
4. 某些元素边界框异常，污染整体包围盒。
5. 图片或 SVG 宽高比处理错误。

# Evidence Log

- `run.log` 显示原图与 `final.svg` 尺寸一致，均为 `7060 x 2432`，当前没有发现生成阶段的整体尺寸失真。
- `final.svg` 中多个主要分区使用父级 `<g transform="translate(...)" />`，例如 `section-problem` 使用 `translate(50, 50)`，`section-existing` 使用 `translate(50, 1300)`。
- `packages/drawnix/src/svg-import/convert-svg-to-drawnix.ts` 中：
  - `collectTextNodes()` 直接读取 `text` 的 `x/y`。
  - `collectPackageBoundImages()` 直接读取 `image` 的 `x/y/width/height`。
  - `collectArrowItems()` 直接读取 `line/polyline/path` 的原始坐标。
  - `collectRectNodes()` 直接读取 `rect` 的 `x/y/width/height`。
- 上述采集逻辑均未合并父级 `transform`，会把位于 `<g transform>` 下的元素错误地放回局部坐标系。
- `measureBBoxByDom()` 仅克隆单个节点，不克隆其父级变换链，因此文本和保留型 path 的包围盒也会丢失父级变换信息。
- 结论：问题主因在前端 `svg-import` 导入链路，尤其是父级 `transform` 未参与坐标换算，而非 `bundle.zip` 内的 `final.svg` 本身比例错误。

# Next Step

- 已在 `packages/drawnix/src/svg-import/convert-svg-to-drawnix.ts` 实现祖先 `transform` 累积。
- 已补充 `g translate(...)` 回归测试，覆盖 `rect/text/image/path`。
- 已执行 `npx nx test drawnix --runInBand --testPathPattern=convert-svg-to-drawnix.spec.ts`，结果通过。
