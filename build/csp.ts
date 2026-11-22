import type { Plugin } from 'vite'

/**
 * Adds the Content-Security-Policy to the built index.html only. The dev server injects inline
 * scripts of its own (React refresh), which a strict policy would block.
 */
export function productionCsp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https: http://localhost:*"
  ].join('; ')

  return {
    name: 'prep-deck:production-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`
      )
    }
  }
}
