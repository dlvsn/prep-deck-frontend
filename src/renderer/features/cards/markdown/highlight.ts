type Shiki = typeof import('shiki')

let loading: Promise<Shiki> | null = null
const cache = new Map<string, string>()

/**
 * Highlighted HTML for a code block, in both themes at once (Shiki's `--shiki-light` /
 * `--shiki-dark` variables; Markdown.module.css picks one by the mode). Shiki loads on the first
 * code block, not with the app. A language Shiki does not know comes out as plain text.
 */
export async function highlight(code: string, lang: string | null): Promise<string> {
  const key = `${lang ?? ''}\u0000${code}`
  const cached = cache.get(key)
  if (cached) return cached

  const shiki = await (loading ??= import('shiki'))
  const known = lang !== null && Object.prototype.hasOwnProperty.call(shiki.bundledLanguages, lang)
  const html = await shiki.codeToHtml(code, {
    lang: known ? lang : 'text',
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false
  })
  if (cache.size > 200) cache.clear()
  cache.set(key, html)
  return html
}
