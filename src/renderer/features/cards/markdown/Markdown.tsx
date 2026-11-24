import { isValidElement, memo, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CheckIcon, CopyIcon } from '@/ui/icons'
import { highlight } from './highlight'
import styles from './Markdown.module.css'

/**
 * A card's answer: Markdown with GFM (lists, tables, strikethrough), code blocks highlighted with
 * a Copy button. Raw HTML in the source is not rendered. The card view and the editor's Preview
 * both use this, so they always look the same.
 */
export const Markdown = memo(function Markdown({ source }: { source: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
})

const components: Components = {
  pre: ({ children }) => {
    const { lang, text } = codeOf(children)
    return <CodeBlock lang={lang} code={text} />
  },
  // Links leave the app: Electron opens them in the user's browser.
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (typeof src === 'string' ? <img src={src} alt={alt ?? ''} loading="lazy" /> : null)
}

function codeOf(children: ReactNode): { lang: string | null; text: string } {
  const code = Array.isArray(children) ? children[0] : children
  if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) return { lang: null, text: String(children ?? '') }
  const lang = /language-(\S+)/.exec(code.props.className ?? '')?.[1]?.toLowerCase() ?? null
  return { lang, text: String(code.props.children ?? '').replace(/\n$/, '') }
}

function CodeBlock({ lang, code }: { lang: string | null; code: string }) {
  const { t } = useTranslation()
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let current = true
    setHtml(null)
    highlight(code, lang)
      .then((result) => current && setHtml(result))
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [code, lang])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = (): void => {
    void navigator.clipboard.writeText(code).then(() => setCopied(true))
  }

  return (
    <div className={styles.code}>
      <div className={styles.codeBar}>
        <span className={styles.codeLang}>{lang ?? ''}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? t('code.copied') : t('code.copy')}
        </button>
      </div>
      {html ? (
        // Shiki escapes the code itself; the markup around it is Shiki's own.
        <div className={styles.codeBody} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className={styles.codeBody}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
