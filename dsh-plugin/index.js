/**
 * Host half of the WPS HTML material bundle.
 *
 * Two jobs. It exposes the `wps-html-material` skill shipped inside the package
 * (`skill/SKILL.md` and its references, scripts, and template) to the running
 * Harness, so installing the plugin also makes the authoring rules available to
 * the agent. The preview itself is the Client module: a right-Sidebar page that
 * renders a deck, stacks an HTML material on it, and runs the same self-check.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Skill identity shipped in `skill/`; also the folder name users copy to `~/.codex/skills`. */
const SKILL_NAME = 'wps-html-material'
const SKILL_DIRECTORY = 'skill'

/**
 * Find the bundled skill in either layout: inside the package (`skill/`, the
 * standalone bundle) or one level up (this repository, whose root is the skill
 * and whose `dsh-plugin/` holds this package).
 */
function locateSkill() {
  const base = dirname(fileURLToPath(import.meta.url))
  for (const directory of [join(base, SKILL_DIRECTORY), join(base, '..')]) {
    const file = join(directory, 'SKILL.md')
    try {
      if (statSync(file).isFile()) return { directory, file }
    } catch (_error) {
      // Try the next layout.
    }
  }
  return undefined
}

/**
 * Drop the leading YAML frontmatter block, as the filesystem provider does.
 * @param {string} raw - the full SKILL.md text.
 * @returns {string} the Markdown body.
 */
function stripFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return text.trim()
  const firstBreak = text.indexOf('\n')
  if (firstBreak === -1) return text.trim()
  const close = text.indexOf('\n---', firstBreak)
  if (close === -1) return text.trim()
  const bodyStart = text.indexOf('\n', close + 1)
  return (bodyStart === -1 ? '' : text.slice(bodyStart + 1)).trim()
}

/**
 * Register the bundled skill when the profile has a skills service.
 *
 * Optional access keeps the row active on profiles without one: the preview
 * still works, and only the skill registration is skipped.
 * @param {object} ctx - the Host plugin context.
 */
export function apply(ctx) {
  const skills = ctx.get('skills')
  if (!skills) return
  try {
    const located = locateSkill()
    if (!located) return
    const { directory, file } = located
    const content = stripFrontmatter(readFileSync(file, 'utf8'))
    if (content === '') return
    ctx.effect(() => skills.register({
      name: SKILL_NAME,
      description: 'Create or adapt single-file, transparent, self-contained HTML elements for WPS Presentation HTML素材, such as interactive 3D model viewers, and check them against the embed rules.',
      whenToUse: 'When an HTML widget must be inserted into a WPS PPT slide and resized or moved there; the bundled right-Sidebar preview shows the same file on a deck and runs the same self-check.',
      content,
      path: file,
      source: 'bundled',
      provider: '@local/dsh-wps-html-material',
      invocation: { modelInvocable: true, userInvocable: true },
      resourceBase: { kind: 'directory', path: directory },
    }), 'wps-html-material: bundled skill')
  } catch (error) {
    // A missing or unreadable skill file must not take the preview down with it.
    try { console.warn('[wps-html-material] bundled skill not registered:', error && error.message) } catch (_ignored) { /* console unavailable */ }
  }
}
