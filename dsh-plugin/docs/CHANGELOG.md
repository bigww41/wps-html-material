# Changelog

## 1.1.0

- Bundled the original `wps-html-material` skill and register it
  as a runtime skill (`ctx.skills.register`) at activation, with its references,
  scripts, and template directory as the resource base.
- Added a real `.pptx` reader and canvas painter to the preview: ZIP central
  directory plus `DecompressionStream`, a small DrawingML reader, and painting of
  backgrounds, shapes, cropped pictures, and text.
- Slide navigation (previous/next, jump list), per-Session deck and material
  restore, and `移除 PPT`.
- The HTML material is now a layer beside the clipped slide, so it can be moved
  and resized outside the canvas onto a 10% stage gutter; `复位` restores it.
- Ported the skill's checker to the client with the same findings on
  `jet-engine-3d.html` (0 errors, 7 warnings).
- Fixed: first-paint measurement, duplicate empty-state controls, west/north
  resize detachment, stuck drags, missing iframe feedback, bounded caches,
  lookbehind-free regexes, `data-src` false positives, level labels, and the
  header button's stylesheet scope.

## 1.0.0

- First right-Sidebar page type: ratio canvas, HTML material element box,
  embed self-check, Session-header launch button.
