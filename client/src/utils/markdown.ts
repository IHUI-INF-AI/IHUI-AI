/**
 * Markdown 渲染工具
 * 使用 marked 和 highlight.js 进行优化渲染
 */

import { marked } from 'marked'
import { logger } from '@/utils/logger'
import hljs from '@/utils/highlight'
import DOMPurify from 'dompurify'

// 导入本地 highlight.js 主题样式
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

// 动态切换 highlight.js 主题（根据暗色模式状态）
if (typeof document !== 'undefined') {
  const updateHighlightTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    const codeBlocks = document.querySelectorAll('pre code')

    codeBlocks.forEach(block => {
      if (isDark) {
        block.classList.remove('hljs-light')
        block.classList.add('hljs-dark')
      } else {
        block.classList.remove('hljs-dark')
        block.classList.add('hljs-light')
      }
    })
  }

  // 初始更新
  updateHighlightTheme()

  // 监听主题变化
  const observer = new MutationObserver(() => {
    updateHighlightTheme()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
}

// 转义HTML
function escapeHtml(text: string): string {
  if (typeof document === 'undefined') return text
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 创建自定义渲染器
const renderer = new marked.Renderer()

// 自定义代码块渲染器，添加复制按钮
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang || 'text'
  const escapedCode = escapeHtml(text)
  const highlighted = hljs.getLanguage(language)
    ? hljs.highlight(text, { language }).value
    : escapedCode

  return `<div class="code-block-wrapper" data-language="${language}" data-code="${escapedCode}">
    <div class="code-block-header">
      <span class="code-language">${language || 'text'}</span>
      <button class="code-copy-btn" onclick="window.copyCodeBlock && window.copyCodeBlock(this)" aria-label="复制代码">
        <span class="copy-text">复制</span>
        <span class="copied-text" style="display: none;">已复制</span>
      </button>
    </div>
    <pre><code class="language-${language} hljs">${highlighted}</code></pre>
  </div>`
}

// 配置 marked
marked.setOptions({
  breaks: true, // 支持 GitHub 风格的换行
  gfm: true, // 启用 GitHub 风格的 Markdown
  pedantic: false,
  renderer: renderer,
})

// 全局代码块复制函数
if (typeof window !== 'undefined') {
  ;(window as Window & { copyCodeBlock?: (button: HTMLElement) => void }).copyCodeBlock = function (
    button: HTMLElement
  ) {
    const wrapper = button.closest('.code-block-wrapper')
    if (wrapper) {
      const code = wrapper.getAttribute('data-code')
      if (code) {
        const decodedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        navigator.clipboard
          .writeText(decodedCode)
          .then(() => {
            const copyText = button.querySelector('.copy-text') as HTMLElement
            const copiedText = button.querySelector('.copied-text') as HTMLElement
            if (copyText && copiedText) {
              copyText.style.display = 'none'
              copiedText.style.display = 'inline'
              setTimeout(() => {
                copyText.style.display = 'inline'
                copiedText.style.display = 'none'
              }, 2000)
            }
          })
          .catch((err) => {
            logger.warn('Failed to copy code block:', err)
          })
      }
    }
  }
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''

  try {
    // 使用 marked 渲染
    const html = marked.parse(markdown) as string

    // 使用 DOMPurify 清理 HTML，防止 XSS 攻击
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'ul',
        'ol',
        'li',
        'code',
        'pre',
        'blockquote',
        'a',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
        'del',
        'ins',
        'sub',
        'sup',
        'div',
        'button',
        'span',
      ],
      ALLOWED_ATTR: [
        'class',
        'href',
        'target',
        'rel',
        'src',
        'alt',
        'title',
        'width',
        'height',
        'data-language',
        'data-code',
        'onclick',
        'aria-label',
        'style',
      ],
      ALLOWED_URI_REGEXP:
        // eslint-disable-next-line no-useless-escape
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    })
  } catch (error) {
    logger.error('Markdown rendering failed:', error)
    // 返回转义后的纯文本
    return DOMPurify.sanitize(markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
  }
}

/**
 * 提取 Markdown 中的代码块
 */
export function extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
  const codeBlocks: Array<{ language: string; code: string }> = []
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(markdown)) !== null) {
    codeBlocks.push({
      language: match[1] || 'plaintext',
      code: match[2],
    })
  }

  return codeBlocks
}

/**
 * 提取 Markdown 中的链接
 */
export function extractLinks(markdown: string): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match

  while ((match = regex.exec(markdown)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
    })
  }

  return links
}

/**
 * 判断是否为 Markdown 格式
 */
export function isMarkdown(text: string): boolean {
  if (!text) return false

  const markdownPatterns = [
    /```[\s\S]*?```/, // 代码块
    /#{1,6}\s+\S+/, // 标题
    /\*\*.*?\*\*/, // 粗体
    /\*.*?\*/, // 斜体
    /\[.*?\]\(.*?\)/, // 链接
    /^[-*+]\s+/m, // 列表
    /^\d+\.\s+/m, // 有序列表
    /^>\s+/m, // 引用
    /\|.*?\|/, // 表格
  ]

  return markdownPatterns.some(pattern => pattern.test(text))
}
