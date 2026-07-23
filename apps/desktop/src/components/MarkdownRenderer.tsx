import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useI18n } from '../i18n'

interface Props {
  content: string
}

/** 代码块:加复制按钮 + 语言标签。 */
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const lang = (className || '').replace('language-', '') || 'text'
  const text = String(children ?? '').replace(/\n$/, '')

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 静默
    }
  }

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{lang}</span>
        <button type="button" className="md-code-copy" onClick={onCopy}>
          {copied ? t('chat.copied') : t('chat.copyCode')}
        </button>
      </div>
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

/**
 * Markdown 渲染器(用于 AI 回复)。
 * - GFM(表格/删除线/任务列表)
 * - 代码高亮(highlight.js)
 * - 代码块加复制按钮 + 语言标签
 * - 链接 target=_blank + rel=noreferrer
 */
function MarkdownRendererImpl({ content }: Props) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          // 外链新窗口打开
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // 代码块(含语言)
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children, ...props }) => {
            const isBlock = (className || '').startsWith('language-')
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          // 表格包裹层(横向滚动)
          table: ({ children }) => (
            <div className="md-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

const MarkdownRenderer = memo(MarkdownRendererImpl)
export default MarkdownRenderer
