/**
 * WPS HTML素材 preview: the browser half of the bundle.
 *
 * One page type for the right Sidebar (`htmlMaterial`). It puts a PPT canvas
 * in the pane, loads a real `.pptx` deck onto it, and stacks one single-file
 * HTML material on top as a movably resizable element box — the same shape a
 * WPS "HTML素材" takes inside a slide. The material is also checked against the
 * `wps-html-material` embed rules.
 *
 * The deck renderer is self-contained: ZIP central-directory reading with
 * `DecompressionStream`, a small XML reader for DrawingML, and a canvas paint
 * of the deck's backgrounds, rectangles, pictures, and text. No external
 * library, CDN, or Harness Client package is imported; React is the only
 * module. Host chrome uses theme tokens, and every visible string comes from
 * this plugin's locale namespace.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-wps-html-material',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    /** This plugin's copy namespace. */
    const NS = 'wpsHtmlMaterial'
    /** The page type's kind: what `openTab` names. */
    const KIND = 'htmlMaterial'
    /** This implementation's identity in the tab system: the body's keyed seat. */
    const ID = '@local/dsh-wps-html-material/preview'
    /** Header control slot id and guide card order. */
    const ACTION_ID = 'wps-html-material.open'
    const GUIDE_ORDER = 40
    /** Settings that survive reload; document bytes stay in memory. */
    const SETTINGS_KEY = 'dsh.wps-html-material.v1'
    /** Material cache: one entry per Session, a few Sessions at most. */
    const MATERIAL_CACHE_LIMIT = 4
    /** Deck cache: rendered decks are heavier, so keep fewer. */
    const DECK_CACHE_LIMIT = 2

    /** Slide sizes a deck without its own size falls back to. */
    const RATIOS = [
      { id: '16:9', width: 1280, height: 720 },
      { id: '4:3', width: 1280, height: 960 },
      { id: '1:1', width: 1080, height: 1080 },
      { id: '9:16', width: 720, height: 1280 },
    ]
    const BACKDROPS = ['light', 'dark', 'checker']
    const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    const DEFAULT_BOX = { x: 0.08, y: 0.08, w: 0.84, h: 0.84 }
    const DECK_EXTENSION = /\.pptx$/i
    const HTML_EXTENSION = /\.html?$/i

    // ------------------------------------------------------------------ copy

    const zh = {
      'panel.title': 'HTML 素材预览',
      'guide.description': '把 PPT 放进右侧栏，再把做好的 HTML 素材叠到幻灯片上预览并按规范自检',
      'action.open': 'HTML 素材预览',
      'pickLocal': '本地文件',
      'pickWorkspace': '工作区文件',
      'workspace.none': '工作区无 .html / .pptx',
      'workspace.error': '工作区列表读取失败',
      'workspace.unavailable': '这个环境没有文件读取服务',
      'refreshList': '刷新文件列表',
      'reload': '重新载入',
      'load': '载入',
      'path.placeholder': '路径，如 out/demo.html 或 教学模板.pptx',
      'mode.layout': '布局',
      'mode.interact': '交互',
      'mode.interactHint': '交互中 · 切回「布局」可拖动和缩放',
      'fit': '复位',
      'ratio': '版式',
      'backdrop': '背景',
      'backdrop.light': '白底',
      'backdrop.dark': '深色',
      'backdrop.checker': '棋盘',
      'element': '元素',
      'loading': '读取中…',
      'loadFailed': '读取失败',
      'retry': '重试',
      'frame': 'HTML 素材',
      'frame.loading': '素材渲染中…',
      'frame.failed': '素材未能渲染，检查 WebGL 或脚本是否被沙箱拦下。',
      'empty.stage': '先选一个 .pptx 当幻灯片，或直接载入 .html 素材。',
      'empty.hint': '文件可以来自工作区，也可以来自本地；两者都在上面选。',
      'deck.loading': '解析 PPT 中…',
      'deck.failed': 'PPT 解析失败',
      'deck.page': '页',
      'deck.prev': '上一页',
      'deck.next': '下一页',
      'deck.slide': '幻灯片',
      'deck.remove': '移除 PPT',
      'deck.unsupported': '只支持 .pptx（旧版 .ppt 请先另存为 .pptx）',
      'checks.title': '自检',
      'checks.ok': '自检通过',
      'checks.errors': '错误',
      'checks.warnings': '提示',
      'checks.empty': '未载入素材',
      'checks.copy': '复制报告',
      'checks.copied': '已复制',
      'checks.truncated': '仅显示前 40 条',
      'checks.more': '展开自检',
      'check.level.error': '错误',
      'check.level.warn': '提示',
      'check.resource.src': '外部或相对资源 src',
      'check.resource.link': '外部或相对 <link>',
      'check.resource.import': 'CSS @import 走网络',
      'check.resource.url': 'CSS url() 走网络',
      'check.resource.dynamicImport': '动态 import 走网络',
      'check.network.fetch': '出现 fetch()，确认不请求远程地址',
      'check.network.xhr': '出现 XMLHttpRequest，确认不请求远程地址',
      'check.layout.fixed': 'position: fixed（整页布局）',
      'check.layout.vh': '100vh 布局',
      'check.layout.vw': '100vw 布局',
      'check.layout.inner': '读取 window.innerWidth/innerHeight 布局',
      'check.hint.phrase': '残留小字说明',
      'check.font.small': '字号小于 12px，可能读作小字',
      'check.background.value': '确认这个背景是故意保留的',
      'check.background.missing': '没有显式的 transparent 背景',
      'check.href.external': '外部超链接（不加载，但按无署名规则应删）',
    }

    const en = {
      'panel.title': 'HTML material preview',
      'guide.description': 'Put a PPT in the right Sidebar, stack a finished HTML material on the slide, and self-check it',
      'action.open': 'HTML material preview',
      'pickLocal': 'Local file',
      'pickWorkspace': 'Workspace file',
      'workspace.none': 'No .html or .pptx in workspace',
      'workspace.error': 'Could not list the workspace',
      'workspace.unavailable': 'No workspace file service here',
      'refreshList': 'Refresh file list',
      'reload': 'Reload',
      'load': 'Load',
      'path.placeholder': 'Path, e.g. out/demo.html or deck.pptx',
      'mode.layout': 'Layout',
      'mode.interact': 'Interact',
      'mode.interactHint': 'Interacting · switch to Layout to move or resize',
      'fit': 'Reset',
      'ratio': 'Slide',
      'backdrop': 'Backdrop',
      'backdrop.light': 'Light',
      'backdrop.dark': 'Dark',
      'backdrop.checker': 'Checker',
      'element': 'Element',
      'loading': 'Reading…',
      'loadFailed': 'Read failed',
      'retry': 'Retry',
      'frame': 'HTML material',
      'frame.loading': 'Rendering the material…',
      'frame.failed': 'The material did not render; check WebGL or a sandboxed script.',
      'empty.stage': 'Choose a .pptx as the slide, or load an .html material directly.',
      'empty.hint': 'Files come from the workspace or from your disk; both are chosen above.',
      'deck.loading': 'Parsing the deck…',
      'deck.failed': 'Could not parse the deck',
      'deck.page': 'of',
      'deck.prev': 'Previous slide',
      'deck.next': 'Next slide',
      'deck.slide': 'Slide',
      'deck.remove': 'Remove PPT',
      'deck.unsupported': 'Only .pptx is supported; save older .ppt files as .pptx first',
      'checks.title': 'Self-check',
      'checks.ok': 'Self-check passed',
      'checks.errors': 'errors',
      'checks.warnings': 'warnings',
      'checks.empty': 'No material loaded',
      'checks.copy': 'Copy report',
      'checks.copied': 'Copied',
      'checks.truncated': 'Showing the first 40 only',
      'checks.more': 'Show self-check',
      'check.level.error': 'Error',
      'check.level.warn': 'Warning',
      'check.resource.src': 'External or relative resource src',
      'check.resource.link': 'External or relative <link>',
      'check.resource.import': 'CSS @import over the network',
      'check.resource.url': 'CSS url() over the network',
      'check.resource.dynamicImport': 'Dynamic import over the network',
      'check.network.fetch': 'fetch() present; confirm it never loads a remote URL',
      'check.network.xhr': 'XMLHttpRequest present; confirm it never loads a remote URL',
      'check.layout.fixed': 'position: fixed (full-page layout)',
      'check.layout.vh': '100vh layout',
      'check.layout.vw': '100vw layout',
      'check.layout.inner': 'Layout read from window.innerWidth/innerHeight',
      'check.hint.phrase': 'Leftover small-print copy',
      'check.font.small': 'font-size below 12px may read as small print',
      'check.background.value': 'Confirm this background is intentional',
      'check.background.missing': 'No explicit transparent background',
      'check.href.external': 'External hyperlink; remove it under the no-attribution rule',
    }

    // -------------------------------------------------------------- settings

    const DEFAULT_SETTINGS = {
      ratio: '16:9',
      backdrop: 'light',
      mode: 'layout',
      box: { ...DEFAULT_BOX },
      /** Last workspace file per Session and kind, so reopening restores deck and material. */
      lastPath: {},
    }

    let settingsCache

    function validBox(box) {
      if (!box || typeof box !== 'object') return { ...DEFAULT_BOX }
      if (['x', 'y', 'w', 'h'].some(key => typeof box[key] !== 'number' || !Number.isFinite(box[key]))) return { ...DEFAULT_BOX }
      const w = Math.min(1, Math.max(0.05, box.w))
      const height = Math.min(1, Math.max(0.05, box.h))
      return {
        x: Math.min(1 - w, Math.max(0, box.x)),
        y: Math.min(1 - height, Math.max(0, box.y)),
        w,
        h: height,
      }
    }

    function readSettings() {
      if (settingsCache) return settingsCache
      let stored = {}
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) stored = JSON.parse(raw) || {}
      } catch (_error) {
        stored = {}
      }
      settingsCache = {
        ratio: RATIOS.some(ratio => ratio.id === stored.ratio) ? stored.ratio : DEFAULT_SETTINGS.ratio,
        backdrop: BACKDROPS.includes(stored.backdrop) ? stored.backdrop : DEFAULT_SETTINGS.backdrop,
        mode: stored.mode === 'interact' ? 'interact' : 'layout',
        box: validBox(stored.box),
        lastPath: stored.lastPath && typeof stored.lastPath === 'object' ? stored.lastPath : {},
      }
      return settingsCache
    }

    /** Record one Session's last workspace file for `kind` ('html' | 'deck'). */
    function writeLastPath(sessionId, kind, path) {
      const lastPath = { ...readSettings().lastPath }
      const current = lastPath[sessionId]
      const entry = current && typeof current === 'object' ? { ...current } : current ? { html: current } : {}
      if (path) entry[kind] = path
      else delete entry[kind]
      lastPath[sessionId] = entry
      writeSettings({ lastPath })
    }

    function lastPathsOf(sessionId) {
      const entry = readSettings().lastPath[sessionId]
      if (!entry) return {}
      return typeof entry === 'string' ? { html: entry } : entry
    }

    function writeSettings(patch) {
      settingsCache = { ...readSettings(), ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache))
      } catch (_error) {
        // A full or unavailable storage keeps the in-memory value.
      }
      return settingsCache
    }

    /** Bounded insertion-order cache; reading a key refreshes it. */
    function remember(cache, key, value, limit) {
      cache.delete(key)
      cache.set(key, value)
      if (cache.size > limit) cache.delete(cache.keys().next().value)
    }

    const materialCache = new Map()
    const deckCache = new Map()

    function disposeDeck(deck) {
      if (!deck || !deck.images) return
      for (const entry of deck.images.values()) {
        try { URL.revokeObjectURL(entry.url) } catch (_error) { /* already revoked */ }
      }
      deck.images.clear()
    }

    // ------------------------------------------------------------- pptx read

    /** Slide-space default palette, used only when a deck names a scheme colour. */
    const DEFAULT_THEME = {
      dk1: '#000000', lt1: '#ffffff', dk2: '#44546a', lt2: '#e7e6e6',
      accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5', accent4: '#ffc000',
      accent5: '#5b9bd5', accent6: '#70ad47', hlink: '#0563c1', folHlink: '#954f72',
    }

    const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

    function decodeXmlText(value) {
      return value.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (match, entity) => {
        if (entity[0] === '#') {
          const code = entity[1] === 'x' || entity[1] === 'X'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10)
          return Number.isFinite(code) ? String.fromCodePoint(code) : match
        }
        return XML_ENTITIES[entity] || match
      })
    }

    /**
     * Read one XML document into `{ name, attrs, children, text }` nodes.
     * Prefixes are kept verbatim (`p:sp`, `a:t`), which is all DrawingML needs.
     * @param {string} source - the document text.
     * @returns {object} the document node.
     */
    function parseXml(source) {
      const root = { name: '#document', attrs: {}, children: [], text: '' }
      const stack = [root]
      let index = 0
      const appendText = value => {
        if (value) stack[stack.length - 1].text += decodeXmlText(value)
      }
      while (index < source.length) {
        const open = source.indexOf('<', index)
        if (open === -1) { appendText(source.slice(index)); break }
        if (open > index) appendText(source.slice(index, open))
        if (source.startsWith('<!--', open)) {
          const end = source.indexOf('-->', open + 4)
          index = end === -1 ? source.length : end + 3
          continue
        }
        if (source.startsWith('<![CDATA[', open)) {
          const end = source.indexOf(']]>', open + 9)
          appendText(source.slice(open + 9, end === -1 ? source.length : end))
          index = end === -1 ? source.length : end + 3
          continue
        }
        if (source.startsWith('<?', open)) {
          const end = source.indexOf('?>', open + 2)
          index = end === -1 ? source.length : end + 2
          continue
        }
        if (source.startsWith('<!', open)) {
          const end = source.indexOf('>', open + 2)
          index = end === -1 ? source.length : end + 1
          continue
        }
        let end = open + 1
        let quote = ''
        while (end < source.length) {
          const char = source[end]
          if (quote) { if (char === quote) quote = '' }
          else if (char === '"' || char === "'") quote = char
          else if (char === '>') break
          end += 1
        }
        const raw = source.slice(open + 1, end)
        if (raw[0] === '/') {
          if (stack.length > 1) stack.pop()
        } else {
          const selfClosing = raw.endsWith('/')
          const body = selfClosing ? raw.slice(0, -1) : raw
          const space = body.search(/\s/)
          const name = (space === -1 ? body : body.slice(0, space)).trim()
          const attrs = {}
          if (space !== -1) {
            const attributePattern = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g
            let match
            const rest = body.slice(space)
            while ((match = attributePattern.exec(rest)) !== null) {
              attrs[match[1]] = decodeXmlText(match[3] !== undefined ? match[3] : match[4])
            }
          }
          const node = { name, attrs, children: [], text: '' }
          stack[stack.length - 1].children.push(node)
          if (!selfClosing) stack.push(node)
        }
        index = end + 1
      }
      return root
    }

    function childNamed(node, name) {
      if (!node) return null
      for (const child of node.children) if (child.name === name) return child
      return null
    }

    function childrenNamed(node, name) {
      return node ? node.children.filter(item => item.name === name) : []
    }

    function firstNamed(node, name) {
      if (!node) return null
      for (const child of node.children) {
        if (child.name === name) return child
        const found = firstNamed(child, name)
        if (found) return found
      }
      return null
    }

    function allNamed(node, name, out = []) {
      if (!node) return out
      for (const child of node.children) {
        if (child.name === name) out.push(child)
        allNamed(child, name, out)
      }
      return out
    }

    function numberAttr(node, key, fallback = 0) {
      const value = node && node.attrs ? Number(node.attrs[key]) : NaN
      return Number.isFinite(value) ? value : fallback
    }

    /** Resolve one relationship target against its owning part's directory. */
    function resolvePartPath(base, target) {
      if (target.startsWith('/')) return target.slice(1)
      const parts = `${base}/${target}`.split('/')
      const stack = []
      for (const part of parts) {
        if (part === '..') stack.pop()
        else if (part !== '.' && part !== '') stack.push(part)
      }
      return stack.join('/')
    }

    function relsPathOf(partPath) {
      const slash = partPath.lastIndexOf('/')
      const dir = slash === -1 ? '' : partPath.slice(0, slash + 1)
      const file = partPath.slice(slash + 1)
      return `${dir}_rels/${file}.rels`
    }

    function parseRelationships(bytes) {
      const rels = new Map()
      if (!bytes) return rels
      const doc = parseXml(new TextDecoder('utf-8').decode(bytes))
      for (const node of allNamed(doc, 'Relationship')) {
        if (node.attrs.Id && node.attrs.Target) rels.set(node.attrs.Id, node.attrs.Target)
      }
      return rels
    }

    /** Central-directory ZIP reader; entries inflate through `DecompressionStream`. */
    async function unzip(buffer) {
      const bytes = new Uint8Array(buffer)
      const view = new DataView(buffer)
      let eocd = -1
      const floor = Math.max(0, bytes.length - 66000)
      for (let at = bytes.length - 22; at >= floor; at -= 1) {
        if (view.getUint32(at, true) === 0x06054b50) { eocd = at; break }
      }
      if (eocd < 0) throw new Error('not a zip archive')
      const count = view.getUint16(eocd + 10, true)
      let offset = view.getUint32(eocd + 16, true)
      const entries = new Map()
      for (let index = 0; index < count; index += 1) {
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('corrupt zip directory')
        const method = view.getUint16(offset + 10, true)
        const compressedSize = view.getUint32(offset + 20, true)
        const nameLength = view.getUint16(offset + 28, true)
        const extraLength = view.getUint16(offset + 30, true)
        const commentLength = view.getUint16(offset + 32, true)
        const localOffset = view.getUint32(offset + 42, true)
        const name = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
        entries.set(name, { method, compressedSize, localOffset })
        offset += 46 + nameLength + extraLength + commentLength
      }
      const readEntry = async name => {
        const entry = entries.get(name)
        if (!entry) return undefined
        const local = entry.localOffset
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error('corrupt zip entry')
        const nameLength = view.getUint16(local + 26, true)
        const extraLength = view.getUint16(local + 28, true)
        const start = local + 30 + nameLength + extraLength
        const raw = bytes.slice(start, start + entry.compressedSize)
        if (entry.method === 0) return raw
        if (entry.method !== 8) throw new Error('unsupported zip compression')
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
      }
      return { entries, readEntry }
    }

    function colorFrom(fill) {
      if (!fill) return undefined
      const solid = childNamed(fill, 'a:srgbClr')
      if (solid && solid.attrs.val) {
        const alphaNode = childNamed(solid, 'a:alpha')
        const alpha = alphaNode ? Math.max(0, Math.min(100, numberAttr(alphaNode, 'val', 100000) / 1000)) / 100 : 1
        return { color: `#${solid.attrs.val}`, alpha }
      }
      const scheme = childNamed(fill, 'a:schemeClr')
      if (scheme && scheme.attrs.val) return { color: DEFAULT_THEME[scheme.attrs.val] || '#000000', alpha: 1 }
      const preset = childNamed(fill, 'a:prstClr')
      if (preset && preset.attrs.val) return { color: preset.attrs.val, alpha: 1 }
      return undefined
    }

    function runStyle(runProps, fallbackProps) {
      const read = key => (runProps && runProps.attrs[key] !== undefined
        ? runProps.attrs[key]
        : fallbackProps && fallbackProps.attrs[key] !== undefined ? fallbackProps.attrs[key] : undefined)
      const solid = runProps ? childNamed(runProps, 'a:solidFill') : null
      const fallbackSolid = fallbackProps ? childNamed(fallbackProps, 'a:solidFill') : null
      const painted = colorFrom(solid) || colorFrom(fallbackSolid)
      const latin = (runProps && childNamed(runProps, 'a:latin')) || (fallbackProps && childNamed(fallbackProps, 'a:latin'))
      const eastAsian = (runProps && childNamed(runProps, 'a:ea')) || (fallbackProps && childNamed(fallbackProps, 'a:ea'))
      return {
        size: Number(read('sz') || 1800),
        bold: read('b') === '1',
        italic: read('i') === '1',
        color: painted ? painted.color : '#000000',
        font: (eastAsian && eastAsian.attrs.typeface) || (latin && latin.attrs.typeface) || undefined,
      }
    }

    function parseTextBody(body) {
      const bodyPr = childNamed(body, 'a:bodyPr')
      const insets = {
        l: numberAttr(bodyPr, 'lIns', 91440),
        t: numberAttr(bodyPr, 'tIns', 45720),
        r: numberAttr(bodyPr, 'rIns', 91440),
        b: numberAttr(bodyPr, 'bIns', 45720),
      }
      const listStyle = childNamed(body, 'a:lstStyle')
      const baseStyle = listStyle ? firstNamed(listStyle, 'a:defRPr') : null
      const paragraphs = []
      for (const paragraph of childrenNamed(body, 'a:p')) {
        const paragraphProps = childNamed(paragraph, 'a:pPr')
        const paragraphStyle = paragraphProps ? childNamed(paragraphProps, 'a:defRPr') : null
        const runs = []
        for (const node of paragraph.children) {
          if (node.name === 'a:r' || node.name === 'a:fld') {
            const textNode = childNamed(node, 'a:t')
            const text = textNode ? textNode.text : ''
            if (!text) continue
            runs.push({ text, ...runStyle(childNamed(node, 'a:rPr'), paragraphStyle || baseStyle) })
          } else if (node.name === 'a:br') {
            runs.push({ text: '\n', size: 1800, bold: false, italic: false, color: '#000000', font: undefined })
          }
        }
        if (runs.length > 0) {
          paragraphs.push({
            align: (paragraphProps && paragraphProps.attrs.algn) || 'l',
            runs,
          })
        }
      }
      if (paragraphs.length === 0) return null
      return { insets, anchor: (bodyPr && bodyPr.attrs.anchor) || 't', paragraphs }
    }

    function parseShape(node) {
      const props = childNamed(node, 'p:spPr')
      const transform = childNamed(props, 'a:xfrm')
      const offset = childNamed(transform, 'a:off')
      const extent = childNamed(transform, 'a:ext')
      const geometry = childNamed(props, 'a:prstGeom')
      const fillNode = childNamed(props, 'a:solidFill')
      const noFill = childNamed(props, 'a:noFill')
      const lineNode = childNamed(props, 'a:ln')
      const lineFill = lineNode && !childNamed(lineNode, 'a:noFill') ? childNamed(lineNode, 'a:solidFill') : null
      const linePaint = colorFrom(lineFill)
      return {
        kind: 'shape',
        geometry: (geometry && geometry.attrs.prst) || 'rect',
        x: numberAttr(offset, 'x'),
        y: numberAttr(offset, 'y'),
        w: numberAttr(extent, 'cx'),
        h: numberAttr(extent, 'cy'),
        fill: noFill ? null : colorFrom(fillNode),
        line: linePaint ? { color: linePaint.color, width: numberAttr(lineNode, 'w', 12700) } : null,
        text: parseTextBody(childNamed(node, 'p:txBody')),
      }
    }

    function parsePicture(node, rels) {
      const props = childNamed(node, 'p:spPr')
      const transform = childNamed(props, 'a:xfrm')
      const offset = childNamed(transform, 'a:off')
      const extent = childNamed(transform, 'a:ext')
      const blipFill = childNamed(node, 'p:blipFill')
      const blip = blipFill ? childNamed(blipFill, 'a:blip') : null
      const crop = blipFill ? childNamed(blipFill, 'a:srcRect') : null
      const target = blip && blip.attrs['r:embed'] ? rels.get(blip.attrs['r:embed']) : undefined
      return {
        kind: 'picture',
        x: numberAttr(offset, 'x'),
        y: numberAttr(offset, 'y'),
        w: numberAttr(extent, 'cx'),
        h: numberAttr(extent, 'cy'),
        media: target ? resolvePartPath('ppt/slides', target) : undefined,
        crop: crop
          ? {
            l: numberAttr(crop, 'l') / 100000,
            t: numberAttr(crop, 't') / 100000,
            r: numberAttr(crop, 'r') / 100000,
            b: numberAttr(crop, 'b') / 100000,
          }
          : null,
      }
    }

    function parseSlide(xml, rels) {
      const root = firstNamed(xml, 'p:sld') || xml
      const backgroundNode = firstNamed(root, 'p:bg')
      const background = { color: '#ffffff', image: undefined }
      const solid = backgroundNode ? firstNamed(backgroundNode, 'a:solidFill') : null
      const painted = colorFrom(solid)
      if (painted) background.color = painted.color
      const blip = backgroundNode ? firstNamed(backgroundNode, 'a:blip') : null
      if (blip && blip.attrs['r:embed'] && rels.get(blip.attrs['r:embed'])) {
        background.image = resolvePartPath('ppt/slides', rels.get(blip.attrs['r:embed']))
      }
      const tree = firstNamed(root, 'p:spTree')
      const shapes = []
      for (const node of tree ? tree.children : []) {
        if (node.name === 'p:sp') shapes.push(parseShape(node))
        else if (node.name === 'p:pic') shapes.push(parsePicture(node, rels))
        else if (node.name === 'p:grpSp') {
          for (const inner of node.children) {
            if (inner.name === 'p:sp') shapes.push(parseShape(inner))
            else if (inner.name === 'p:pic') shapes.push(parsePicture(inner, rels))
          }
        }
      }
      return { background, shapes }
    }

    /**
     * Turn a .pptx into decks of parsed slides plus their media bytes.
     * @param {ArrayBuffer} buffer - the complete file.
     * @param {string} name - display name for failure messages.
     * @returns {Promise<object>} { name, width, height, slides, media, images }
     */
    async function parsePptx(buffer, name) {
      const zip = await unzip(buffer)
      const presentationBytes = await zip.readEntry('ppt/presentation.xml')
      if (!presentationBytes) throw new Error('missing ppt/presentation.xml')
      const presentation = parseXml(new TextDecoder('utf-8').decode(presentationBytes))
      const size = firstNamed(presentation, 'p:sldSz')
      const width = numberAttr(size, 'cx', 12192000)
      const height = numberAttr(size, 'cy', 6858000)
      const presentationRels = parseRelationships(await zip.readEntry('ppt/_rels/presentation.xml.rels'))
      const slideIds = allNamed(presentation, 'p:sldId')
      const slides = []
      for (const slideId of slideIds) {
        const target = presentationRels.get(slideId.attrs['r:id'])
        if (!target) continue
        const partPath = resolvePartPath('ppt', target)
        const bytes = await zip.readEntry(partPath)
        if (!bytes) continue
        const rels = parseRelationships(await zip.readEntry(relsPathOf(partPath)))
        slides.push(parseSlide(parseXml(new TextDecoder('utf-8').decode(bytes)), rels))
      }
      if (slides.length === 0) throw new Error('no slides in deck')
      const media = new Map()
      for (const entryName of zip.entries.keys()) {
        if (!entryName.startsWith('ppt/media/') || entryName.endsWith('/')) continue
        const bytes = await zip.readEntry(entryName)
        if (bytes) media.set(entryName, bytes)
      }
      return { name, width, height, slides, media, images: new Map() }
    }

    // ------------------------------------------------------------ deck paint

    function mediaTypeOf(path) {
      if (/\.png$/i.test(path)) return 'image/png'
      if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
      if (/\.webp$/i.test(path)) return 'image/webp'
      if (/\.gif$/i.test(path)) return 'image/gif'
      if (/\.svg$/i.test(path)) return 'image/svg+xml'
      return 'application/octet-stream'
    }

    /** Lazily decode one deck image; `onReady` repaints when it arrives. */
    function imageOf(deck, name, onReady) {
      if (!name || !deck.media.has(name)) return null
      let entry = deck.images.get(name)
      if (!entry) {
        const url = URL.createObjectURL(new Blob([deck.media.get(name)], { type: mediaTypeOf(name) }))
        const image = new Image()
        entry = { url, image, ready: false }
        image.onload = () => { entry.ready = true; onReady() }
        image.onerror = () => { entry.ready = false }
        image.src = url
        deck.images.set(name, entry)
      }
      return entry.ready ? entry.image : null
    }

    function fontOf(run, pxPerPoint) {
      const size = Math.max(1, (run.size / 100) * pxPerPoint)
      const family = run.font ? `"${run.font}", ` : ''
      return `${run.italic ? 'italic ' : ''}${run.bold ? '700' : '400'} ${size}px ${family}"PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
    }

    function paintText(context, text, box, width, height, deck) {
      const pxPerEmu = width / deck.width
      const pxPerPoint = width * 12700 / deck.width
      const left = box.x * pxPerEmu + text.insets.l * pxPerEmu
      const top = box.y * pxPerEmu + text.insets.t * pxPerEmu
      const maxWidth = Math.max(1, (box.w - text.insets.l - text.insets.r) * pxPerEmu)
      const maxHeight = Math.max(1, (box.h - text.insets.t - text.insets.b) * pxPerEmu)
      const lines = []
      let line = { glyphs: [], width: 0, height: 0, align: 'l' }
      const flush = () => {
        lines.push(line)
        line = { glyphs: [], width: 0, height: 0, align: line.align }
      }
      for (const paragraph of text.paragraphs) {
        line.align = paragraph.align
        for (const run of paragraph.runs) {
          const font = fontOf(run, pxPerPoint)
          const size = Math.max(1, (run.size / 100) * pxPerPoint)
          context.font = font
          for (const character of Array.from(run.text)) {
            if (character === '\n') { flush(); continue }
            const glyphWidth = context.measureText(character).width
            if (line.width + glyphWidth > maxWidth && line.glyphs.length > 0) flush()
            line.glyphs.push({ character, font, color: run.color, width: glyphWidth })
            line.width += glyphWidth
            line.height = Math.max(line.height, size)
          }
        }
        if (line.glyphs.length > 0) flush()
      }
      if (lines.length === 0) return
      let cursor = top
      const total = lines.reduce((sum, item) => sum + Math.max(item.height, 1) * 1.22, 0)
      if (text.anchor === 'ctr') cursor = top + Math.max(0, (maxHeight - total) / 2)
      else if (text.anchor === 'b') cursor = top + Math.max(0, maxHeight - total)
      context.textBaseline = 'top'
      for (const item of lines) {
        const lineHeight = Math.max(item.height, 1) * 1.22
        let x = left
        if (item.align === 'ctr') x = left + Math.max(0, (maxWidth - item.width) / 2)
        else if (item.align === 'r') x = left + Math.max(0, maxWidth - item.width)
        for (const glyph of item.glyphs) {
          context.font = glyph.font
          context.fillStyle = glyph.color
          context.fillText(glyph.character, x, cursor)
          x += glyph.width
        }
        cursor += lineHeight
      }
    }

    function paintShape(context, shape, deck, width) {
      const scale = width / deck.width
      const x = shape.x * scale
      const y = shape.y * scale
      const w = shape.w * scale
      const h = shape.h * scale
      if (shape.kind === 'picture') {
        const image = imageOf(deck, shape.media, deck.onImageReady || (() => {}))
        if (image) {
          const crop = shape.crop || { l: 0, t: 0, r: 0, b: 0 }
          const sw = image.naturalWidth * (1 - crop.l - crop.r)
          const sh = image.naturalHeight * (1 - crop.t - crop.b)
          if (sw > 0 && sh > 0) {
            context.drawImage(image, image.naturalWidth * crop.l, image.naturalHeight * crop.t, sw, sh, x, y, Math.max(1, w), Math.max(1, h))
          }
        }
        return
      }
      const fill = shape.fill
      if (fill && fill.alpha > 0) {
        context.save()
        context.globalAlpha = fill.alpha
        context.fillStyle = fill.color
        if (shape.geometry === 'ellipse') {
          context.beginPath()
          context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
          context.fill()
        } else {
          context.fillRect(x, y, Math.max(1, w), Math.max(1, h))
        }
        context.restore()
      }
      if (shape.line) {
        context.save()
        context.strokeStyle = shape.line.color
        context.lineWidth = Math.max(0.5, shape.line.width * scale)
        context.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1))
        context.restore()
      }
      if (shape.text) {
        context.save()
        paintText(context, shape.text, shape, width, deck.height * scale, deck)
        context.restore()
      }
    }

    function paintSlide(context, slide, deck, width, height) {
      context.save()
      context.fillStyle = slide.background.color
      context.fillRect(0, 0, width, height)
      if (slide.background.image) {
        const image = imageOf(deck, slide.background.image, deck.onImageReady || (() => {}))
        if (image) context.drawImage(image, 0, 0, width, height)
      }
      context.beginPath()
      context.rect(0, 0, width, height)
      context.clip()
      for (const shape of slide.shapes) paintShape(context, shape, deck, width)
      context.restore()
    }

    // ---------------------------------------------------------------- checks

    /** Regex sources are literals compiled once; no lookbehind, so older engines cannot throw. */
    const RESOURCE_RULES = [
      { key: 'check.resource.link', source: "<link\\b[^>]*\\bhref\\s*=\\s*[\"'](?!#|data:)", flags: 'gi' },
      { key: 'check.resource.import', source: "@import[^;]*[\"']?\\s*(?:https?:)?\\/\\/", flags: 'gi' },
      { key: 'check.resource.url', source: "url\\(\\s*[\"']?\\s*(?:https?:)?\\/\\/", flags: 'gi' },
      { key: 'check.resource.dynamicImport', source: "\\bimport\\s*\\(\\s*[\"']\\s*https?:\\/\\/", flags: 'gi' },
    ].map(rule => ({ ...rule, regex: safeRegex(rule.source, rule.flags) }))

    const LAYOUT_RULES = [
      { key: 'check.layout.fixed', source: 'position\\s*:\\s*fixed', flags: 'gi' },
      { key: 'check.layout.vh', source: '\\b100vh\\b', flags: 'gi' },
      { key: 'check.layout.vw', source: '\\b100vw\\b', flags: 'gi' },
      { key: 'check.layout.inner', source: '\\bwindow\\.(?:innerWidth|innerHeight)\\b', flags: 'g' },
    ].map(rule => ({ ...rule, regex: safeRegex(rule.source, rule.flags) }))

    const NETWORK_RULES = [
      { key: 'check.network.fetch', source: '\\bfetch\\s*\\(', flags: 'gi' },
      { key: 'check.network.xhr', source: 'XMLHttpRequest', flags: 'g' },
    ].map(rule => ({ ...rule, regex: safeRegex(rule.source, rule.flags) }))

    const HREF_RULE = safeRegex("href\\s*=\\s*[\"']https?:\\/\\/", 'gi')
    const FONT_RULE = safeRegex('font-size\\s*:\\s*([0-9]*\\.?[0-9]+)px', 'gi')
    const BACKGROUND_RULE = safeRegex('background(?:-color)?\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(|hsl\\(|hsla\\()', 'g')
    const TRANSPARENT_RULE = safeRegex('background\\s*:\\s*transparent', 'i')
    const SRC_ATTRIBUTE_RULE = safeRegex("\\bsrc\\s*=\\s*[\"']", 'gi')
    const MAX_REPORT_ROWS = 40

    const HINT_PHRASES = [
      '拖动旋转', '滚轮缩放', '模型已载入', '正在载入', '准备模型',
      '加载中', '操作提示', '使用说明', '点击查看',
    ]

    function safeRegex(source, flags) {
      try {
        return new RegExp(source, flags)
      } catch (_error) {
        return undefined
      }
    }

    function scanWith(rule, text, target) {
      if (!rule.regex) return
      rule.regex.lastIndex = 0
      let match
      while ((match = rule.regex.exec(text)) !== null) {
        target.push({ key: rule.key, index: match.index })
        if (rule.regex.lastIndex === match.index) rule.regex.lastIndex += 1
      }
    }

    /** Count newlines once per ordered list instead of per match. */
    function lineTable(list, text) {
      list.sort((left, right) => left.index - right.index)
      let line = 1
      let cursor = 0
      for (const item of list) {
        const limit = Math.min(item.index, text.length)
        while (cursor < limit) {
          if (text.charCodeAt(cursor) === 10) line += 1
          cursor += 1
        }
        item.line = line
      }
      return list
    }

    /**
     * Scan one HTML document for WPS HTML素材 embedding issues.
     * @param {string} text - the complete UTF-8 source.
     * @returns counts plus the bounded rows the panel lists.
     */
    function analyzeHtml(text) {
      const errors = []
      const warnings = []
      try {
        if (SRC_ATTRIBUTE_RULE) {
          SRC_ATTRIBUTE_RULE.lastIndex = 0
          let match
          while ((match = SRC_ATTRIBUTE_RULE.exec(text)) !== null) {
            const before = match.index > 0 ? text[match.index - 1] : ''
            const value = text.slice(match.index + match[0].length)
            if (/[\w.-]/.test(before)) continue
            if (value.startsWith('#') || value.startsWith('data:')) continue
            errors.push({ key: 'check.resource.src', index: match.index })
          }
        }
        for (const rule of RESOURCE_RULES) scanWith(rule, text, errors)
        for (const rule of LAYOUT_RULES) scanWith(rule, text, errors)
        for (const rule of NETWORK_RULES) scanWith(rule, text, warnings)
        if (HREF_RULE) {
          HREF_RULE.lastIndex = 0
          let match
          while ((match = HREF_RULE.exec(text)) !== null) warnings.push({ key: 'check.href.external', index: match.index })
        }

        const decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (_whole, hex) => String.fromCharCode(parseInt(hex, 16)))
        for (const phrase of HINT_PHRASES) {
          let from = 0
          for (;;) {
            const at = decoded.indexOf(phrase, from)
            if (at === -1) break
            warnings.push({ key: 'check.hint.phrase', index: at, detail: phrase, source: decoded })
            from = at + phrase.length
          }
        }

        if (FONT_RULE) {
          FONT_RULE.lastIndex = 0
          let match
          while ((match = FONT_RULE.exec(text)) !== null) {
            const size = Number(match[1])
            if (size < 12) warnings.push({ key: 'check.font.small', index: match.index, detail: `${size}px` })
          }
        }
        if (BACKGROUND_RULE) {
          BACKGROUND_RULE.lastIndex = 0
          let match
          while ((match = BACKGROUND_RULE.exec(text)) !== null) {
            const snippet = text.slice(match.index, match.index + 70).replace(/\s+/g, ' ').trim()
            warnings.push({ key: 'check.background.value', index: match.index, detail: snippet })
          }
        }
        if (!TRANSPARENT_RULE || !TRANSPARENT_RULE.test(text)) {
          warnings.push({ key: 'check.background.missing', index: 0 })
        }

        const decodedRows = warnings.filter(item => item.source !== undefined)
        const rawRows = warnings.filter(item => item.source === undefined)
        lineTable(rawRows, text)
        for (const item of decodedRows) {
          lineTable([item], item.source)
          delete item.source
        }
        lineTable(errors, text)
      } catch (_error) {
        // A malformed document must not blank the pane; report what was found.
      }

      const counts = { errors: errors.length, warnings: warnings.length }
      const rows = [
        ...errors.map(item => ({ level: 'error', key: item.key, line: item.line })),
        ...warnings.map(item => ({ level: 'warn', key: item.key, line: item.line, detail: item.detail })),
      ].sort((left, right) => (left.line || 0) - (right.line || 0))

      return {
        counts,
        rows: rows.slice(0, MAX_REPORT_ROWS),
        truncated: rows.length > MAX_REPORT_ROWS,
        ok: counts.errors === 0 && counts.warnings === 0,
      }
    }

    // ------------------------------------------------------------------ css

    const CSS = `
.wphm-root{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;color:var(--dsw-alias-label-primary,#1f2328);font-size:var(--dsh-content-font-size-secondary,13px);}
.wphm-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}
.wphm-toolbar-sub{padding-top:0;}
.wphm-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:26px;padding:0 9px;font:inherit;font-size:12px;line-height:1;color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:6px;cursor:pointer;white-space:nowrap;}
.wphm-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));}
.wphm-btn[data-active="true"]{color:var(--dsw-alias-label-on-color,#fff);background:var(--dsw-alias-brand-primary,#247bbf);border-color:transparent;}
.wphm-btn[data-tone="error"]{color:var(--dsw-alias-state-error-primary,#c0392b);}
.wphm-btn[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary,#a66a00);}
.wphm-btn[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#1a7f48);}
.wphm-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:1px;}
.wphm-icon{width:28px;min-height:26px;padding:0;}
.wphm-select{max-width:150px;min-height:26px;padding:0 6px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:6px;}
.wphm-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:1px;}
.wphm-input{flex:1 1 120px;min-width:100px;min-height:26px;padding:0 8px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:6px;}
.wphm-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:1px;}
.wphm-meta{margin-left:auto;color:var(--dsw-alias-label-secondary,#57606a);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.wphm-note{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:12px;color:var(--dsw-alias-label-secondary,#57606a);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}
.wphm-note-error{color:var(--dsw-alias-state-error-primary,#c0392b);}
.wphm-deckbar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));}
.wphm-page{color:var(--dsw-alias-label-secondary,#57606a);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.wphm-stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#f4f5f7);}
.wphm-area{position:relative;flex:0 0 auto;}
.wphm-slide{position:absolute;inset:0;overflow:hidden;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.16));box-shadow:var(--dsw-elevation-soft,0 6px 18px rgba(0,0,0,.12));}
.wphm-slide[data-backdrop="light"]{background:#ffffff;}
.wphm-slide[data-backdrop="dark"]{background:#14161a;}
.wphm-slide[data-backdrop="checker"]{background-image:repeating-conic-gradient(#e3e7ed 0% 25%,#ffffff 0% 50%);background-size:16px 16px;}
.wphm-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
.wphm-box{position:absolute;box-sizing:border-box;}
.wphm-box[data-layout="true"]{outline:1px dashed var(--dsw-alias-brand-primary,#247bbf);outline-offset:0;}
.wphm-frame{display:block;width:100%;height:100%;border:0;background:transparent;}
.wphm-shield{position:absolute;inset:0;cursor:move;touch-action:none;}
.wphm-shield:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:2px;}
.wphm-handle{position:absolute;z-index:3;pointer-events:auto;width:9px;height:9px;background:var(--dsw-alias-bg-layer-1,#fff);border:1.5px solid var(--dsw-alias-brand-primary,#247bbf);border-radius:2px;box-sizing:border-box;touch-action:none;}
.wphm-handle[data-dir="nw"]{left:-5px;top:-5px;cursor:nwse-resize;}
.wphm-handle[data-dir="n"]{left:calc(50% - 4.5px);top:-5px;cursor:ns-resize;}
.wphm-handle[data-dir="ne"]{right:-5px;top:-5px;cursor:nesw-resize;}
.wphm-handle[data-dir="e"]{right:-5px;top:calc(50% - 4.5px);cursor:ew-resize;}
.wphm-handle[data-dir="se"]{right:-5px;bottom:-5px;cursor:nwse-resize;}
.wphm-handle[data-dir="s"]{left:calc(50% - 4.5px);bottom:-5px;cursor:ns-resize;}
.wphm-handle[data-dir="sw"]{left:-5px;bottom:-5px;cursor:nesw-resize;}
.wphm-handle[data-dir="w"]{left:-5px;top:calc(50% - 4.5px);cursor:ew-resize;}
.wphm-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;max-width:280px;text-align:center;color:var(--dsw-alias-label-secondary,#57606a);}
.wphm-placeholder-title{margin:0;color:var(--dsw-alias-label-primary,#1f2328);font-size:14px;font-weight:600;}
.wphm-placeholder-hint{margin:0;line-height:1.5;}
.wphm-render-note{position:absolute;left:10px;bottom:10px;padding:2px 7px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font-size:11px;pointer-events:none;}
.wphm-checks{flex:0 0 auto;max-height:44%;overflow:auto;padding:8px 10px 10px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));background:var(--dsw-alias-bg-base,transparent);}
.wphm-checks-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#57606a);}
.wphm-checks-title{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;}
.wphm-check-row{display:flex;gap:8px;padding:2px 0;font-size:12px;line-height:1.45;}
.wphm-check-line{flex:0 0 38px;text-align:right;color:var(--dsw-alias-label-secondary,#57606a);font-variant-numeric:tabular-nums;}
.wphm-check-level{flex:0 0 auto;font-weight:600;}
.wphm-check-row[data-level="error"] .wphm-check-text,.wphm-check-row[data-level="error"] .wphm-check-level{color:var(--dsw-alias-state-error-primary,#c0392b);}
.wphm-check-row[data-level="warn"] .wphm-check-level{color:var(--dsw-alias-state-warn-primary,#a66a00);}
.wphm-check-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;}
.wphm-check-detail{color:var(--dsw-alias-label-secondary,#57606a);}
.wphm-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;color:var(--dsw-alias-label-secondary,#57606a);background:transparent;border:none;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;line-height:1;}
.wphm-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#1f2328);}
.wphm-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:1px;}
`

    const ACTION_CSS = `
.wphm-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:6px;color:var(--dsw-alias-label-secondary,#57606a);background:transparent;border:none;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;line-height:1;}
.wphm-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#1f2328);}
.wphm-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#247bbf);outline-offset:1px;}
`

    // ----------------------------------------------------------- components

    function StyleSheet(props) {
      return h('style', { dangerouslySetInnerHTML: { __html: props.css || CSS } })
    }

    function SlideIcon(props) {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: props.size || 15,
        height: props.size || 15,
        'aria-hidden': true,
        focusable: false,
        style: { display: 'block' },
      },
      h('rect', { x: 1.4, y: 2.4, width: 13.2, height: 9.2, rx: 1.6, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
      h('rect', { x: 4.2, y: 4.6, width: 7.6, height: 4.8, rx: 0.8, fill: 'currentColor', opacity: 0.22 }),
      h('path', { d: 'M7 5.7 10.6 7 7 8.3z', fill: 'currentColor' }),
      h('path', { d: 'M5.2 13.8h5.6', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }))
    }

    function CheckRow(props) {
      const { row, tr } = props
      const level = row.level === 'error' ? tr('check.level.error') : tr('check.level.warn')
      return h('div', { className: 'wphm-check-row', 'data-level': row.level },
        h('span', { className: 'wphm-check-line' }, row.line ? row.line : '–'),
        h('span', { className: 'wphm-check-level' }, level),
        h('span', { className: 'wphm-check-text' },
          tr(row.key),
          row.detail ? h('span', { className: 'wphm-check-detail' }, ' · ' + row.detail) : null))
    }

    function CheckPanel(props) {
      const { report, tr, onCopy, copied } = props
      if (!report) return null
      return h('div', { className: 'wphm-checks' },
        h('div', { className: 'wphm-checks-head' },
          h('span', { className: 'wphm-checks-title' }, tr('checks.title')),
          h('span', { role: 'status' }, report.ok
            ? tr('checks.ok')
            : `${report.counts.errors} ${tr('checks.errors')} · ${report.counts.warnings} ${tr('checks.warnings')}`),
          h('span', { style: { marginLeft: 'auto' } }),
          h('button', { type: 'button', className: 'wphm-btn', onClick: onCopy }, copied ? tr('checks.copied') : tr('checks.copy'))),
        report.rows.length === 0
          ? h('div', { className: 'wphm-check-row', 'data-level': 'ok' },
            h('span', { className: 'wphm-check-line' }, '✓'),
            h('span', { className: 'wphm-check-text' }, tr('checks.ok')))
          : report.rows.map((row, index) => h(CheckRow, { key: index, row, tr })),
        report.truncated
          ? h('div', { className: 'wphm-check-row' },
            h('span', { className: 'wphm-check-line' }, '…'),
            h('span', { className: 'wphm-check-text wphm-check-detail' }, tr('checks.truncated')))
          : null)
    }

    function reportText(report, name, tr) {
      const lines = [`${tr('checks.title')}: ${name || '-'}`]
      if (!report) return lines.join('\n')
      lines.push(`errors: ${report.counts.errors}; warnings: ${report.counts.warnings}`)
      for (const row of report.rows) {
        const prefix = row.level === 'error' ? 'ERROR' : 'WARN '
        lines.push(`${prefix} line ${row.line || '-'}: ${tr(row.key)}${row.detail ? ' — ' + row.detail : ''}`)
      }
      return lines.join('\n')
    }

    /**
     * Build the tab body bound to one client context.
     * @param {object} ctx - the client root context.
     * @param {object} files - workspace read/list faces; they throw a tagged error when the Remote is absent.
     * @param {Function} fallbackTr - namespace translate used when the slot supplies none.
     * @returns {Function} the `sidebar.right.pane.tab` body component.
     */
    function makeTab(ctx, files, fallbackTr) {
      return function HtmlMaterialTab(props) {
        // One stable translate wrapper: injected callbacks keep their identity
        // across renders even while the slot re-supplies its own `t`.
        const liveTranslate = useRef(props.t)
        liveTranslate.current = props.t
        const translateRef = useRef(null)
        if (translateRef.current === null) {
          translateRef.current = key => (typeof liveTranslate.current === 'function' ? liveTranslate.current : fallbackTr)(key)
        }
        const tr = translateRef.current
        const sessionId = props.sessionId || props.sessionKey
        const initial = readSettings()

        const [ratio, setRatio] = useState(initial.ratio)
        const [backdrop, setBackdrop] = useState(initial.backdrop)
        const [mode, setMode] = useState('layout')
        const [box, setBox] = useState(initial.box)
        const [material, setMaterial] = useState(() => (materialCache.get(sessionId) || {}).material || null)
        const [deck, setDeck] = useState(() => (deckCache.get(sessionId) || {}).deck || null)
        const [slideIndex, setSlideIndex] = useState(0)
        const [frameUrl, setFrameUrl] = useState(null)
        const [frameKey, setFrameKey] = useState(0)
        const [frameReady, setFrameReady] = useState(false)
        const [frameFailed, setFrameFailed] = useState(false)
        const [imageTick, setImageTick] = useState(0)
        const [status, setStatus] = useState('idle')
        const [error, setError] = useState('')
        const [workspaceFiles, setWorkspaceFiles] = useState([])
        const [listState, setListState] = useState('idle')
        const [showChecks, setShowChecks] = useState(false)
        const [copied, setCopied] = useState(false)
        const [stage, setStage] = useState({ width: 0, height: 0 })
        const [selectedPath, setSelectedPath] = useState('')
        const [draftPath, setDraftPath] = useState('')
        const [lastFailedPath, setLastFailedPath] = useState('')

        const stageRef = useRef(null)
        const canvasRef = useRef(null)
        const inputRef = useRef(null)
        const dragRef = useRef(null)
        const sessionRef = useRef('')
        const copiedTimer = useRef(undefined)
        const readAbort = useRef(undefined)

        const deckPreset = deck
          ? { id: 'ppt', width: 1280, height: Math.max(1, Math.round(1280 * deck.height / deck.width)) }
          : null
        const preset = deckPreset || RATIOS.find(item => item.id === ratio) || RATIOS[0]
        const hasStage = Boolean(deck || material)

        // Persist the small view settings after the user settles.
        useEffect(() => {
          const timer = setTimeout(() => { writeSettings({ ratio, backdrop, mode, box }) }, 200)
          return () => clearTimeout(timer)
        }, [ratio, backdrop, mode, box])

        useEffect(() => () => {
          if (copiedTimer.current !== undefined) clearTimeout(copiedTimer.current)
          if (readAbort.current) readAbort.current.abort()
        }, [])

        // The stage measures itself; slide and element box derive from it.
        useEffect(() => {
          const element = stageRef.current
          if (!element || typeof ResizeObserver === 'undefined') return undefined
          const measure = () => {
            setStage(previous => previous.width === element.clientWidth && previous.height === element.clientHeight
              ? previous
              : { width: element.clientWidth, height: element.clientHeight })
          }
          measure()
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }, [])

        const frame = useMemo(() => {
          const gutter = Math.max(16, Math.min(64, Math.min(stage.width, stage.height) * 0.1))
          const availableWidth = Math.max(0, stage.width - gutter * 2)
          const availableHeight = Math.max(0, stage.height - gutter * 2)
          if (availableWidth <= 0 || availableHeight <= 0) return { width: 0, height: 0 }
          const aspect = preset.width / preset.height
          if (availableWidth / availableHeight > aspect) {
            return { width: availableHeight * aspect, height: availableHeight }
          }
          return { width: availableWidth, height: availableWidth / aspect }
        }, [stage.width, stage.height, preset.width, preset.height])

        // One blob per loaded material; replacing it replaces the browsing context.
        useEffect(() => {
          if (!material) { setFrameUrl(null); return undefined }
          let url
          try {
            url = URL.createObjectURL(new Blob([material.text], { type: 'text/html' }))
          } catch (failure) {
            setStatus('error')
            setError(String((failure && failure.message) || failure))
            return undefined
          }
          setFrameUrl(url)
          setFrameReady(false)
          setFrameFailed(false)
          return () => { URL.revokeObjectURL(url) }
        }, [material])

        // Paint the active slide whenever the deck, the slide, the box, or an image changes.
        useEffect(() => {
          const canvas = canvasRef.current
          if (!canvas || !deck || frame.width <= 0) return
          const slideData = deck.slides[slideIndex]
          if (!slideData) return
          const ratioDevice = Math.min(2, window.devicePixelRatio || 1)
          const pixelWidth = Math.max(1, Math.round(frame.width * ratioDevice))
          const pixelHeight = Math.max(1, Math.round(frame.height * ratioDevice))
          if (canvas.width !== pixelWidth) canvas.width = pixelWidth
          if (canvas.height !== pixelHeight) canvas.height = pixelHeight
          const context = canvas.getContext('2d')
          if (!context) return
          context.setTransform(ratioDevice, 0, 0, ratioDevice, 0, 0)
          context.clearRect(0, 0, frame.width, frame.height)
          deck.onImageReady = () => setImageTick(tick => tick + 1)
          paintSlide(context, slideData, deck, frame.width, frame.height)
        }, [deck, slideIndex, frame.width, frame.height, imageTick])

        const applyMaterial = useCallback(next => {
          remember(materialCache, sessionId, { material: next }, MATERIAL_CACHE_LIMIT)
          setMaterial(next)
          setStatus('idle')
          setError('')
          setFrameKey(key => key + 1)
        }, [sessionId])

        const applyDeck = useCallback((next, path) => {
          const cached = deckCache.get(sessionId)
          if (cached && cached.deck !== next) disposeDeck(cached.deck)
          if (!deckCache.has(sessionId) && deckCache.size >= DECK_CACHE_LIMIT) {
            const oldestKey = deckCache.keys().next().value
            disposeDeck(deckCache.get(oldestKey).deck)
            deckCache.delete(oldestKey)
          }
          remember(deckCache, sessionId, { deck: next, path }, DECK_CACHE_LIMIT)
          setDeck(next)
          setSlideIndex(0)
          setImageTick(0)
          setStatus('idle')
          setError('')
        }, [sessionId])

        const loadBytes = useCallback(async (bytes, name, path) => {
          if (DECK_EXTENSION.test(name)) {
            const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
            const parsed = await parsePptx(buffer, name)
            parsed.path = path
            applyDeck(parsed, path)
            setSelectedPath(path || '')
            if (path) { setDraftPath(path); writeLastPath(sessionId, 'deck', path) }
            return
          }
          if (!HTML_EXTENSION.test(name)) throw new Error(tr('deck.unsupported'))
          const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
          const next = { name, path, text, bytes: bytes.byteLength, origin: path ? 'workspace' : 'local' }
          applyMaterial(next)
          setSelectedPath(path || '')
          if (path) setDraftPath(path)
          else { setDraftPath(''); setLastFailedPath('') }
          if (path) writeLastPath(sessionId, 'html', path)
        }, [applyDeck, applyMaterial, sessionId, tr])

        const loadPath = useCallback(async path => {
          if (!path) return
          if (readAbort.current) readAbort.current.abort()
          const controller = new AbortController()
          readAbort.current = controller
          setStatus('loading')
          setError('')
          setLastFailedPath(path)
          try {
            const result = await files.readBytes(sessionId, path, controller.signal)
            if (controller.signal.aborted) return
            if (!result || result.ok === false) {
              const failure = result && result.error
              setStatus('error')
              setError((failure && (failure.message || failure.code)) || tr('loadFailed'))
              return
            }
            const data = result.value.data
            const name = path.slice(path.lastIndexOf('/') + 1) || path
            await loadBytes(data, name, path)
          } catch (failure) {
            if (controller.signal.aborted) return
            setStatus('error')
            setError(failure && failure.code === 'unavailable'
              ? tr('workspace.unavailable')
              : String((failure && failure.message) || failure))
          } finally {
            if (readAbort.current === controller) readAbort.current = undefined
          }
        }, [files, loadBytes, sessionId, tr])

        const refreshFiles = useCallback(async () => {
          setListState('loading')
          try {
            const result = await files.list(sessionId, '.')
            if (!result || result.ok === false) { setListState('error'); return }
            const entries = (result.value && result.value.entries) || []
            const names = entries
              .filter(entry => entry.type === 'file' && (HTML_EXTENSION.test(entry.name) || DECK_EXTENSION.test(entry.name)))
              .map(entry => entry.name)
              .sort((left, right) => left.localeCompare(right))
            setWorkspaceFiles(names)
            setListState('ready')
          } catch (_failure) {
            setListState('error')
          }
        }, [files, sessionId])

        useEffect(() => { void refreshFiles() }, [refreshFiles])

        // Restore this Session's material and deck, or reopen the file it had last.
        useEffect(() => {
          if (sessionRef.current === sessionId) return
          sessionRef.current = sessionId
          const cachedMaterial = materialCache.get(sessionId)
          const cachedDeck = deckCache.get(sessionId)
          setMaterial(cachedMaterial ? cachedMaterial.material : null)
          setDeck(cachedDeck ? cachedDeck.deck : null)
          setSlideIndex(0)
          if (cachedMaterial) setSelectedPath(cachedMaterial.material.path || '')
          if (cachedDeck) setSelectedPath(cachedDeck.path || '')
          if (!cachedMaterial && !cachedDeck) {
            const remembered = lastPathsOf(sessionId)
            void (async () => {
              if (remembered.deck) await loadPath(remembered.deck)
              if (remembered.html && sessionRef.current === sessionId) {
                setLastFailedPath(remembered.html)
                await loadPath(remembered.html)
              }
            })()
          }
        }, [sessionId, loadPath])

        const onPickFile = useCallback(async event => {
          const file = event.target.files && event.target.files[0]
          event.target.value = ''
          if (!file) return
          setStatus('loading')
          setError('')
          try {
            const bytes = new Uint8Array(await file.arrayBuffer())
            await loadBytes(bytes, file.name, '')
          } catch (failure) {
            setStatus('error')
            setError(String((failure && failure.message) || failure))
          }
        }, [loadBytes])

        const reload = useCallback(() => {
          if (selectedPath) { void loadPath(selectedPath); return }
          if (material) setFrameKey(key => key + 1)
        }, [selectedPath, material, loadPath])

        const resetBox = useCallback(() => setBox({ ...DEFAULT_BOX }), [])
        const toggleChecks = useCallback(() => setShowChecks(value => !value), [])
        const showPrevious = useCallback(() => setSlideIndex(index => Math.max(0, index - 1)), [])
        const showNext = useCallback(() => setSlideIndex(index => (deck ? Math.min(deck.slides.length - 1, index + 1) : index)), [deck])
        const removeDeck = useCallback(() => {
          if (!deck) return
          disposeDeck(deck)
          deckCache.delete(sessionId)
          setDeck(null)
          setSlideIndex(0)
          if (lastPathsOf(sessionId).deck === deck.path) writeLastPath(sessionId, 'deck', '')
        }, [deck, sessionId])

        const report = useMemo(() => (material ? analyzeHtml(material.text) : null), [material])

        const copyReport = useCallback(async () => {
          const text = reportText(report, material && material.name, tr)
          try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            if (copiedTimer.current !== undefined) clearTimeout(copiedTimer.current)
            copiedTimer.current = setTimeout(() => setCopied(false), 1600)
          } catch (_failure) {
            // Clipboard permission is the page's business; the report stays readable.
          }
        }, [report, material, tr])

        // ---------------------------------------------------------- dragging

        // The element is a slide-shape, not a slide child: it may sit outside the
        // canvas, so only a generous sanity range applies. 复位 brings it back.
        const clampBox = useCallback(next => {
          const w = Math.min(3, Math.max(0.05, next.w))
          const height = Math.min(3, Math.max(0.05, next.h))
          return {
            x: Math.min(2.5, Math.max(-1.5, next.x)),
            y: Math.min(2.5, Math.max(-1.5, next.y)),
            w,
            h: height,
          }
        }, [])

        const beginDrag = useCallback((event, handle) => {
          if (mode !== 'layout' || frame.width <= 0) return
          event.preventDefault()
          event.stopPropagation()
          if (event.currentTarget && typeof event.currentTarget.focus === 'function') event.currentTarget.focus()
          try { event.currentTarget.setPointerCapture(event.pointerId) } catch (_error) { /* capture is best effort */ }
          dragRef.current = { handle, startX: event.clientX, startY: event.clientY, box: { ...box } }
        }, [mode, frame.width, box])

        const moveDrag = useCallback(event => {
          const drag = dragRef.current
          if (!drag) return
          if (event.buttons === 0) { dragRef.current = null; return }
          const dx = (event.clientX - drag.startX) / Math.max(1, frame.width)
          const dy = (event.clientY - drag.startY) / Math.max(1, frame.height)
          if (drag.handle === 'move') {
            setBox(clampBox({ ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy }))
            return
          }
          // Move the dragged edge, then derive x/w so a west/north drag cannot
          // detach the box from its opposite edge.
          const min = 0.05
          const source = drag.box
          let left = source.x
          let top = source.y
          let right = source.x + source.w
          let bottom = source.y + source.h
          if (drag.handle.indexOf('e') !== -1) right = Math.min(3.5, Math.max(left + min, source.x + source.w + dx))
          if (drag.handle.indexOf('w') !== -1) left = Math.max(-2.5, Math.min(right - min, source.x + dx))
          if (drag.handle.indexOf('s') !== -1) bottom = Math.min(3.5, Math.max(top + min, source.y + source.h + dy))
          if (drag.handle.indexOf('n') !== -1) top = Math.max(-2.5, Math.min(bottom - min, source.y + dy))
          setBox(clampBox({ x: left, y: top, w: right - left, h: bottom - top }))
        }, [frame.width, frame.height, clampBox])

        const endDrag = useCallback(() => { dragRef.current = null }, [])

        useEffect(() => {
          if (typeof window === 'undefined') return undefined
          const stop = () => { dragRef.current = null }
          window.addEventListener('pointerup', stop)
          window.addEventListener('pointercancel', stop)
          return () => {
            window.removeEventListener('pointerup', stop)
            window.removeEventListener('pointercancel', stop)
          }
        }, [])

        const onBoxKeyDown = useCallback(event => {
          if (mode !== 'layout') return
          const step = event.shiftKey ? 0.02 : 0.005
          const next = { ...box }
          if (event.key === 'ArrowLeft') next.x = box.x - step
          else if (event.key === 'ArrowRight') next.x = box.x + step
          else if (event.key === 'ArrowUp') next.y = box.y - step
          else if (event.key === 'ArrowDown') next.y = box.y + step
          else if (event.key === '+' || event.key === '=') { next.w = box.w + step; next.h = box.h + step }
          else if (event.key === '-') { next.w = box.w - step; next.h = box.h - step }
          else return
          event.preventDefault()
          setBox(clampBox(next))
        }, [mode, box, clampBox])

        // ------------------------------------------------------------ render

        const elementWidth = Math.round(box.w * preset.width)
        const elementHeight = Math.round(box.h * preset.height)
        const summary = !report
          ? tr('checks.empty')
          : report.ok
            ? tr('checks.ok')
            : `${report.counts.errors} ${tr('checks.errors')} · ${report.counts.warnings} ${tr('checks.warnings')}`
        const summaryTone = !report ? undefined : report.counts.errors > 0 ? 'error' : report.counts.warnings > 0 ? 'warn' : 'ok'
        const workspaceLabel = listState === 'error'
          ? tr('workspace.error')
          : workspaceFiles.length === 0 ? tr('workspace.none') : tr('pickWorkspace')

        const fileRow = h('div', { className: 'wphm-toolbar' },
          h('input', { ref: inputRef, type: 'file', accept: '.html,.htm,.pptx', onChange: onPickFile, style: { display: 'none' } }),
          h('button', { type: 'button', className: 'wphm-btn', onClick: () => inputRef.current && inputRef.current.click() }, tr('pickLocal')),
          h('select', {
            className: 'wphm-select',
            'aria-label': tr('pickWorkspace'),
            value: selectedPath,
            onChange: event => {
              const value = event.target.value
              setSelectedPath(value)
              if (value) void loadPath(value)
            },
          },
          h('option', { value: '' }, workspaceLabel),
          workspaceFiles.map(name => h('option', { key: name, value: name }, name))),
          h('button', {
            type: 'button',
            className: 'wphm-btn wphm-icon',
            title: tr('refreshList'),
            'aria-label': tr('refreshList'),
            onClick: () => void refreshFiles(),
          }, '↻'),
          h('input', {
            className: 'wphm-input',
            value: draftPath,
            placeholder: tr('path.placeholder'),
            'aria-label': tr('path.placeholder'),
            spellCheck: false,
            onChange: event => setDraftPath(event.target.value),
            onKeyDown: event => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              void loadPath(draftPath.trim())
            },
          }),
          h('button', { type: 'button', className: 'wphm-btn', onClick: () => void loadPath(draftPath.trim()) }, tr('load')))

        const canvasRow = h('div', { className: 'wphm-toolbar wphm-toolbar-sub' },
          deck
            ? h('span', { className: 'wphm-page' }, `${tr('deck.slide')} ${preset.width}×${preset.height}`)
            : h('select', { className: 'wphm-select', 'aria-label': tr('ratio'), value: ratio, onChange: event => setRatio(event.target.value) },
              RATIOS.map(item => h('option', { key: item.id, value: item.id }, item.id))),
          deck
            ? null
            : h('select', { className: 'wphm-select', 'aria-label': tr('backdrop'), value: backdrop, onChange: event => setBackdrop(event.target.value) },
              BACKDROPS.map(item => h('option', { key: item, value: item }, tr('backdrop.' + item)))),
          material
            ? h(React.Fragment, null,
              h('button', { type: 'button', className: 'wphm-btn', 'data-active': mode === 'layout', 'aria-pressed': mode === 'layout', onClick: () => setMode('layout') }, tr('mode.layout')),
              h('button', { type: 'button', className: 'wphm-btn', 'data-active': mode === 'interact', 'aria-pressed': mode === 'interact', onClick: () => setMode('interact') }, tr('mode.interact')),
              h('button', { type: 'button', className: 'wphm-btn', onClick: reload }, tr('reload')),
              h('button', { type: 'button', className: 'wphm-btn', onClick: resetBox }, tr('fit')),
              h('button', {
                type: 'button',
                className: 'wphm-btn',
                'data-tone': summaryTone,
                'data-active': showChecks,
                'aria-expanded': showChecks,
                'aria-controls': 'wphm-checks',
                title: tr('checks.more'),
                onClick: toggleChecks,
              }, summary),
              h('span', { className: 'wphm-meta' }, `${elementWidth}×${elementHeight} px · ${Math.round(box.w * 100)}%`))
            : null)

        const deckRow = deck ? h('div', { className: 'wphm-deckbar' },
          h('button', { type: 'button', className: 'wphm-btn', 'aria-label': tr('deck.prev'), disabled: slideIndex <= 0, onClick: showPrevious }, '‹'),
          h('select', {
            className: 'wphm-select',
            'aria-label': tr('deck.slide'),
            value: String(slideIndex),
            onChange: event => setSlideIndex(Number(event.target.value)),
          },
          deck.slides.map((_slide, index) => h('option', { key: index, value: String(index) }, `${index + 1} / ${deck.slides.length}`))),
          h('button', { type: 'button', className: 'wphm-btn', 'aria-label': tr('deck.next'), disabled: slideIndex >= deck.slides.length - 1, onClick: showNext }, '›'),
          h('span', { className: 'wphm-meta', title: deck.name }, deck.name),
          h('button', { type: 'button', className: 'wphm-btn', onClick: removeDeck }, tr('deck.remove'))) : null

        const statusRow = status === 'loading'
          ? h('div', { className: 'wphm-note', role: 'status' }, tr('loading'))
          : status === 'error'
            ? h('div', { className: 'wphm-note wphm-note-error', role: 'alert' },
              h('span', null, tr('loadFailed') + (error ? ' · ' + error : '')),
              lastFailedPath ? h('button', { type: 'button', className: 'wphm-btn', onClick: () => void loadPath(lastFailedPath) }, tr('retry')) : null)
            : null

        const slideView = h('div', {
          className: 'wphm-slide',
          'data-backdrop': deck ? 'deck' : backdrop,
          style: { background: deck ? '#ffffff' : undefined },
        },
        deck ? h('canvas', { ref: canvasRef, className: 'wphm-canvas', 'aria-label': `${tr('deck.slide')} ${slideIndex + 1}` }) : null)

        const boxView = material && frameUrl ? h('div', {
          className: 'wphm-box',
          'data-layout': mode === 'layout' ? 'true' : 'false',
          style: {
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          },
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
        },
        h('iframe', {
          key: `frame:${frameKey}:${frameUrl}`,
          className: 'wphm-frame',
          src: frameUrl,
          sandbox: 'allow-scripts',
          title: tr('frame'),
          style: mode === 'interact' ? { pointerEvents: 'auto' } : { pointerEvents: 'none' },
          onLoad: () => setFrameReady(true),
          onError: () => { setFrameReady(true); setFrameFailed(true) },
        }),
        mode === 'layout' ? h('div', {
          key: 'shield',
          className: 'wphm-shield',
          role: 'group',
          tabIndex: 0,
          'aria-label': `${tr('element')} ${elementWidth}×${elementHeight}`,
          title: `${elementWidth}×${elementHeight} px`,
          onPointerDown: event => beginDrag(event, 'move'),
          onKeyDown: onBoxKeyDown,
        }, HANDLES.map(dir => h('span', {
          key: dir,
          className: 'wphm-handle',
          'data-dir': dir,
          onPointerDown: event => beginDrag(event, dir),
        }))) : null) : null

        // The material is a sibling of the clipped slide, so it can sit outside the canvas.
        const areaView = h('div', {
          className: 'wphm-area',
          style: { width: `${frame.width}px`, height: `${frame.height}px` },
        }, slideView, boxView)

        const stageView = h('div', { className: 'wphm-stage', ref: stageRef },
          !hasStage
            ? h('div', { className: 'wphm-placeholder' },
              h(SlideIcon, { size: 28 }),
              h('p', { className: 'wphm-placeholder-title' }, tr('empty.stage')),
              h('p', { className: 'wphm-placeholder-hint' }, tr('empty.hint')))
            : areaView,
          material && !frameReady ? h('div', { className: 'wphm-render-note', role: 'status' }, tr('frame.loading')) : null,
          material && frameReady && frameFailed ? h('div', { className: 'wphm-render-note', role: 'alert' }, tr('frame.failed')) : null)

        return h('div', { className: 'wphm-root' },
          h(StyleSheet),
          fileRow,
          canvasRow,
          deckRow,
          statusRow,
          stageView,
          showChecks ? h('div', { id: 'wphm-checks' }, h(CheckPanel, { report, tr, onCopy: copyReport, copied })) : null)
      }
    }

    /**
     * The launch control in the conversation header's utilities.
     * @param {object} props - reserved owner props; the launch face arrives injected.
     * @returns the icon button.
     */
    function OpenAction(props) {
      const tr = props.tr
      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          className: 'wphm-icon-btn',
          title: tr('action.open'),
          'aria-label': tr('action.open'),
          onClick: () => props.open(),
        }, h(SlideIcon)),
        h(StyleSheet, { css: ACTION_CSS }))
    }

    // ----------------------------------------------------------------- apply

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'remote', 'remote.workspaceFiles'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'wps-html-material: dictionaries')
        const tr = key => ctx.locale.bind(NS)(key)
        // The Remote namespace is resolved per call: reading ctx.remote during
        // activation can run before the connection settles.
        const workspaceRemote = () => {
          try {
            return ctx.remote && ctx.remote.workspaceFiles ? ctx.remote.workspaceFiles : undefined
          } catch (_error) {
            return undefined
          }
        }
        const unavailable = () => {
          const failure = new Error('workspace file service unavailable')
          failure.code = 'unavailable'
          return failure
        }
        const files = {
          readBytes: (sessionId, path, signal) => {
            const remote = workspaceRemote()
            if (!remote) return Promise.reject(unavailable())
            return remote.readBytes(sessionId, path, {}, signal)
          },
          list: (sessionId, path, signal) => {
            const remote = workspaceRemote()
            if (!remote) return Promise.reject(unavailable())
            return remote.list(sessionId, path, signal)
          },
        }
        const Tab = makeTab(ctx, files, tr)

        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: ID,
          kind: KIND,
          priority: 'extension',
          keepMounted: true,
          title: () => tr('panel.title'),
          guide: [{
            id: 'preview',
            order: GUIDE_ORDER,
            title: () => tr('panel.title'),
            description: () => tr('guide.description'),
          }],
        }), 'wps-html-material: tab type')

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: ID,
          locale: NS,
          inject: sessionId => ({ tr, sessionKey: sessionId }),
        }, Tab)), 'wps-html-material: tab body')

        ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: ACTION_ID,
          order: 30,
          locale: NS,
          inject: () => ({
            tr,
            open: () => {
              try {
                ctx.sidebarRight.openTab(KIND)
              } catch (failure) {
                // Opening without a Session or before the type registers is a wiring state, not a crash.
                console.error('[wps-html-material] open failed', failure)
              }
            },
          }),
        }, OpenAction)), 'wps-html-material: header action')
      },
    }
  },
})
