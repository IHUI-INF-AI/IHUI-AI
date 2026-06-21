import DOMPurify from 'dompurify'

/**
 * HTML 转义工具
 * 防止 XSS 攻击
 */

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(text: string): string {
  if (!text) return ''

  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 反转义 HTML
 */
export function unescapeHtml(html: string): string {
  if (!html) return ''

  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || ''
}

/**
 * 清理HTML（防止XSS）- 使用 DOMPurify
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img', 'video', 'audio', 'source',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span', 'section', 'article',
      'hr', 'details', 'summary',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'class', 'style', 'id',
      'controls', 'autoplay', 'muted', 'loop',
      'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: true,
  })
}

export default {
  escapeHtml,
  unescapeHtml,
  sanitizeHtml,
}
