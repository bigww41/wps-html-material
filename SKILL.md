---
name: wps-html-material
description: Create or adapt single-file, transparent, self-contained HTML elements for WPS Presentation's HTML素材 feature, such as interactive 3D model viewers. Use when an HTML widget must be inserted into a WPS PPT slide and resized or moved there; not for full websites or standalone pages.
metadata:
  short-description: Build WPS HTML素材 embed elements
---

# WPS HTML 素材

Deliver one `.html` file that renders as a self-contained element inside a WPS Presentation slide. The user inserts it with 插入 → HTML素材 and then drags its handles to resize and reposition it. Treat the viewport as that element box, not as a browser page.

## Non-negotiables

1. **Single file, fully offline.** Inline the library, styles, fonts, images, and model data. No CDN, no `http(s)` resource URLs, no `@import`, no `fetch` / `XMLHttpRequest` / network `import()`. Base64 or data-URI every asset; a multi-MB inline model is acceptable when it keeps the file self-contained.
2. **Transparent background.** `html`, `body`, the root container, and the 3D renderer must all be transparent. No page background, gradient, card, border, shadow, or rounded panel behind the model. Enable renderer alpha and clear with alpha 0.
3. **Element-sized, not page-sized.** The file is one PPT element, so it must reflow and scale with its container. Do not design a full-screen page: no `position:fixed` takeover, no `100vh` / `100vw` layout, no page padding, no hero/header/footer scaffolding.
4. **No small-print text.** Remove status lines, loading text, hints such as "拖动旋转", captions, footnotes, source attributions, and disclaimers. Keep only the visual and essential controls, and keep their short labels legible at the smallest expected size.

## Sizing and adaptation

Make the root fill the element box and derive everything else from it:

```css
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
#app { position: relative; width: 100%; height: 100%; container-type: size; }
```

- Size controls, gaps, and type with container units and `clamp()`, e.g. `font-size: clamp(9px, 2.4cqw, 15px)`, so the UI shrinks and grows with the element.
- Position UI relative to `#app` (e.g. a control bar at `bottom: 4cqh`), never relative to the window.
- Use a `ResizeObserver` on the root to resize the canvas/renderer and update camera aspect. Do not read `window.innerWidth` / `innerHeight` for layout; the host page is not the element.
- Fit the model to the shorter dimension of the element and re-fit on every resize, with padding so nothing clips at narrow or wide aspect ratios.
- Keep pointer handling on the canvas (`touch-action: none`); avoid full-page scroll and text selection while dragging.
- Check roughly 4:3, 16:9, and a narrow tall box before delivering.

## Visual integration

- The slide supplies the background, so floating UI must stay readable on light and dark slides: translucent surfaces, subtle border, optional blur; never assume one backdrop color.
- Keep chrome minimal: the model plus a compact control bar (for example 自动旋转 / 放大 / 缩小 / 网格 / 复位 / 全屏). Drop decorative grids, glows, and gradients.
- Buttons are the only persistent text. Keep them short and comfortably tappable; no explanatory sentence under or beside the model.
- If loading must be shown, use a textless spinner and remove it when ready.

## Adapting an existing full-page HTML

Keep the interactive core (viewer/canvas, camera controls, model loader) and strip everything that exists only for a standalone page:

- Remove header/title, side panels, teaching copy, questions, footers, and their event handlers.
- Remove status/loading labels and any text that explains controls.
- Convert `position:fixed; inset:0` and `vh`/`vw` layout to the 100% root plus container units above.
- Ensure the renderer uses `alpha: true` and that no scene background color or canvas CSS background is set.
- Remove handlers that would throw after their DOM nodes are deleted, or null-guard them.

## Verify before delivering

Run `python3 scripts/check_embed_html.py <file.html>` and confirm:

- no external/relative resource URLs and no network calls;
- no `position:fixed`, `100vh`, or `100vw`;
- transparent page and root backgrounds, renderer alpha enabled;
- no small-print or explanatory text;
- the extracted script passes `node --check`, and the file opens offline.

See [references/embedding-guide.md](references/embedding-guide.md) for the sizing, transparency, and failure-mode details, and [assets/embed-template.html](assets/embed-template.html) for a minimal starting skeleton.
