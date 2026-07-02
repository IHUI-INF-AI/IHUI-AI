/**
 * Markdown 渲染工具
 * 使用 marked 和 highlight.js 进行优化渲染
 */

import { marked } from 'marked'
import { logger } from '@/utils/logger'
import hljs from '@/utils/highlight'

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
