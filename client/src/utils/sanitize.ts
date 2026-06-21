/**
 * HTML 清理工具 - 防止 XSS 攻击
 *
 * 使用方法:
 *   import { sanitizeHtml, sanitizeText } from '@/utils/sanitize'
 *   const safe = sanitizeHtml(userInput)
 */

/**
 * 危险的 HTML 标签（完全移除）
 */
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'style',
  'link',
  'meta',
  'base',
  'applet',
  'frameset',
  'frame',
]

/**
 * 危险的属性
 */
const DANGEROUS_ATTRS = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onmouseout',
  'onmouseup',
  'onmousedown',
  'onfocus',
  'onblur',
  'onchange',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onabort',
  'onbeforeunload',
  'oncanplay',
  'oncontextmenu',
  'onpaste',
  'onprogress',
  'onresize',
  'onscroll',
  'onselect',
  'onunload',
  'srcset', // 部分浏览器允许 srcset 注入
]

/**
 * 危险的 URL 协议
 */
const DANGEROUS_PROTOCOLS = [
  /^javascript:/i,
  /^data:(?!image\/(png|jpeg|jpg|gif|svg\+xml|webp))/i,
  /^vbscript:/i,
  /^file:/i,
]

/**
 * 简单的 HTML 清理（适用于不依赖外部库的场景）
 * 移除危险标签、危险属性和危险协议
 *
 * 注意：此实现是 DOM-based 的，对于复杂场景建议使用 DOMPurify
 *
 * @param html 原始 HTML 字符串
 * @returns 清理后的 HTML 字符串
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || !html) return ''

  // 服务端 SSR 时无 DOM，使用基础正则清理
  if (typeof document === 'undefined') {
    return sanitizeHtmlSSR(html)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
    const root = doc.body.firstElementChild
    if (!root) return ''

    cleanNode(root)

    return root.innerHTML
  } catch {
    // 解析失败时降级到基础清理
    return sanitizeHtmlSSR(html)
  }
}

/**
 * 递归清理 DOM 节点
 */
function cleanNode(node: Element): void {
  // 收集需要删除的子节点
  const toRemove: Element[] = []
  const toClean: Element[] = []

  for (const child of Array.from(node.children)) {
    const tagName = child.tagName.toLowerCase()
    if (DANGEROUS_TAGS.includes(tagName)) {
      toRemove.push(child)
    } else {
      toClean.push(child)
    }
  }

  // 删除危险标签
  for (const el of toRemove) {
    el.remove()
  }

  // 清理保留标签的属性
  for (const el of toClean) {
    cleanAttributes(el)
    cleanNode(el)
  }
}

/**
 * 清理元素属性
 */
function cleanAttributes(el: Element): void {
  const attrs = Array.from(el.attributes)
  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    const value = attr.value

    // 移除事件处理器
    if (name.startsWith('on')) {
      el.removeAttribute(attr.name)
      continue
    }

    // 移除危险属性
    if (DANGEROUS_ATTRS.includes(name)) {
      el.removeAttribute(attr.name)
      continue
    }

    // 检查 URL 类型属性
    if (['href', 'src', 'action', 'formaction', 'background', 'poster'].includes(name)) {
      const trimmed = value.trim()
      for (const protocol of DANGEROUS_PROTOCOLS) {
        if (protocol.test(trimmed)) {
          el.removeAttribute(attr.name)
          break
        }
      }
    }

    // style 属性内的 expression() / javascript:
    if (name === 'style') {
      if (/expression\s*\(|javascript\s*:|behaviour\s*:/i.test(value)) {
        el.removeAttribute(attr.name)
      }
    }
  }
}

/**
 * SSR 环境下的基础清理（使用正则，效果有限）
 */
function sanitizeHtmlSSR(html: string): string {
  let result = html

  // 移除危险标签及其内容
  for (const tag of DANGEROUS_TAGS) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gis')
    result = result.replace(pattern, '')
    // 自闭合标签
    const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi')
    result = result.replace(selfClosing, '')
  }

  // 移除事件处理器属性
  result = result.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // 移除 javascript: 协议
  result = result.replace(/(?:href|src|action)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '')

  return result
}

/**
 * 转义为纯文本（移除所有 HTML 标签）
 *
 * @param html 原始字符串
 * @returns 纯文本字符串
 */
export function sanitizeText(html: string): string {
  if (typeof html !== 'string' || !html) return ''

  if (typeof document === 'undefined') {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * 转义 HTML 实体（用于将文本作为 HTML 内容显示时）
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 验证 URL 是否安全
 */
export function isSafeUrl(url: string): boolean {
  if (typeof url !== 'string' || !url) return false
  const trimmed = url.trim()
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (protocol.test(trimmed)) return false
  }
  return true
}
