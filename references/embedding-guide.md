# Embedding guide: WPS HTML素材

## How WPS renders the element

WPS 网页版演示 (kdocs.cn) exposes 插入 → HTML素材. The inserted HTML becomes a slide element that can be resized and repositioned with selection handles. Interaction is available in presentation/preview; edit mode may only show a static surface. Design for an element box whose size changes, not for a fixed browser window.

The PC client needs the presentation opened as an online document (分享 → 在线) before the HTML素材 entry appears; otherwise search the Insert tab for HTML.

## Sizing recipe

- `html, body { width:100%; height:100%; margin:0; overflow:hidden; background:transparent; }`
- Root: `#app { position:relative; width:100%; height:100%; container-type:size; }`
- Use `cqw` / `cqh` with `clamp()` for every scalable dimension: control gaps, padding, font size, icon size.
- Observe `#app` with `ResizeObserver`; set canvas backing size to `clientWidth/clientHeight × devicePixelRatio`, and update camera aspect from the same values.
- Fit the model from its bounding box against `min(canvasWidth, canvasHeight)`, with ~10–15% padding. Recompute on resize so narrow boxes do not clip and wide boxes do not leave the model tiny.
- Keep the control bar inside the root (`left:50%; bottom:4cqh; transform:translateX(-50%)`), wrapping rather than overflowing.
- Test at wide, square, and tall aspect ratios. A layout that only looks right at 16:9 is not done.

## Transparency recipe

- CSS: transparent on `html`, `body`, `#app`, canvas.
- WebGL: create the renderer with `alpha: true`, call `renderer.setClearColor(0x000000, 0)` (or `clearAlpha = 0`), and never set `scene.background`.
- Remove page gradients, ambient glows, grid backgrounds, card surfaces, borders, and shadows.
- Floating controls should use semi-transparent fills with a border so they remain readable on both light and dark slides.

## Text policy

Remove:

- status strings ("模型已载入", "准备模型");
- loading text ("正在载入本地模型…");
- operation hints ("拖动旋转 · 滚轮缩放");
- captions, footnotes, source lines, disclaimers;
- descriptive paragraphs.

Allowed: short control labels inside buttons, and only while they remain legible as the element shrinks.

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Model area covers the whole browser or is offset in the slide | `position:fixed; inset:0` page layout | Use a 100% root container |
| UI huge or tiny after resizing the element | `px`/`vh` sized UI | `cqw`/`cqh` + `clamp()` |
| Camera aspect wrong or stretched | layout reads `window.inner*` | Use root `clientWidth/clientHeight` |
| Grey or white rectangle behind the model | opaque page/root/canvas background or `scene.background` | Transparent CSS + alpha renderer |
| Broken icon/font/script | external CDN or relative asset path | Inline as data URI / base64 |
| Console errors after stripping panels | handlers bound to removed nodes | Remove or null-guard those handlers |
| Model clipped at extreme aspect ratios | single hard-coded camera distance | Re-fit against shorter dimension |
| Clicking controls moves the slide element | pointer events leaking outside the canvas | Restrict drag/orbit handling to the canvas |

## Adaptation checklist

1. Keep the viewer/canvas, camera controls, and model loader.
2. Delete header, side panels, teaching text, questions, footers, decorations.
3. Delete status/loading/hint text and their DOM nodes.
4. Replace page layout with a 100% root + container queries.
5. Add `ResizeObserver`; remove `window.inner*` reads.
6. Verify renderer alpha and transparent clear color.
7. Remove teaching handlers or null-guard them.
8. Run the checker and a syntax check on the extracted script.
