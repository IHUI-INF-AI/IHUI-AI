/**
 * Markdown 工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 3 个文件：
 * - markdown / highlight / htmlSanitizer
 *
 * 新架构基于纯 TypeScript，无 Vue 依赖。
 * 不内置语法高亮依赖；可通过 registerHighlighter 注入第三方高亮器。
 */

/* ------------------------------------------------------------------ */
/* HTML 净化（htmlSanitizer）                                          */
/* ------------------------------------------------------------------ */

const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'i',
  'em',
  'strong',
  'u',
  's',
  'del',
  'code',
  'pre',
  'kbd',
  'blockquote',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
  'sup',
  'sub',
  'mark',
  'figure',
  'figcaption',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  code: new Set(['class']),
  pre: new Set(['class']),
  span: new Set(['class']),
  th: new Set(['align']),
  td: new Set(['align', 'colspan', 'rowspan']),
  div: new Set(['class']),
}

const URL_ATTRS = new Set(['href', 'src'])

/** 净化 HTML 字符串，移除危险标签与属性 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    // SSR 降级:用严格正则清理(2026-07-24 安全审计加固)
    // 注意:SSR 输出会在客户端 hydrate 时被 DOMParser 重新净化,但 SSR HTML 若被搜索引擎
    // 爬虫直接抓取或用户在 hydrate 前看到,可能存在 XSS 风险,因此 SSR 也必须严格过滤
    return html
      // 1. 移除所有 script/style/iframe/object/embed/link 标签及内容
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?<\/embed>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      // 2. 移除所有 on* 事件属性(双引号/单引号/无引号三种形式)
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
      // 3. 移除 javascript: 协议(href/src 属性值)
      .replace(/(href|src)\s*=\s*["']?\s*javascript:/gi, '$1="')
      // 4. 移除 data:text/html 协议(可含脚本)
      .replace(/(href|src)\s*=\s*["']?\s*data:text\/html/gi, '$1="')
      // 5. 移除 vbscript: 协议(IE 老攻击向量)
      .replace(/(href|src)\s*=\s*["']?\s*vbscript:/gi, '$1="')
      // 6. 移除 SVG 中的 onload/onerror 等(SVG 自身可含脚本)
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  cleanNode(doc.body)
  return doc.body.innerHTML
}

function cleanNode(node: Node): void {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) {
        // 移除 script/style/iframe 等
        if (
          tag === 'script' ||
          tag === 'style' ||
          tag === 'iframe' ||
          tag === 'object' ||
          tag === 'embed'
        ) {
          node.removeChild(child)
          continue
        }
        // 其他非白名单标签：保留其子内容
        const parent = node
        while (el.firstChild) parent.insertBefore(el.firstChild, el)
        parent.removeChild(el)
        continue
      }
      // 清理属性
      const allowed = ALLOWED_ATTRS[tag]
      const attrs = Array.from(el.attributes)
      for (const attr of attrs) {
        const name = attr.name.toLowerCase()
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          continue
        }
        if (allowed && !allowed.has(name)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (URL_ATTRS.has(name)) {
          const value = attr.value.trim()
          if (/^javascript:/i.test(value) || /^data:text\/html/i.test(value)) {
            el.removeAttribute(attr.name)
          }
        }
      }
      // a 标签强制 rel
      if (tag === 'a') {
        const a = el as HTMLAnchorElement
        if (a.target === '_blank') {
          a.rel = 'noopener noreferrer'
        }
      }
      cleanNode(el)
    } else if (child.nodeType === Node.COMMENT_NODE) {
      node.removeChild(child)
    }
  }
}

/* ------------------------------------------------------------------ */
/* 语法高亮（highlight）                                               */
/* ------------------------------------------------------------------ */

export interface HighlightResult {
  html: string
  language: string | null
}

export type Highlighter = (code: string, language: string | null) => HighlightResult

let registeredHighlighter: Highlighter | null = null

/** 注入第三方高亮器（如 highlight.js / Prism） */
export function registerHighlighter(fn: Highlighter): void {
  registeredHighlighter = fn
}

export function highlight(code: string, language: string | null = null): HighlightResult {
  if (registeredHighlighter) return registeredHighlighter(code, language)
  // 默认实现：仅 HTML 转义
  return {
    html: escapeForHtml(code),
    language,
  }
}

function escapeForHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ------------------------------------------------------------------ */
/* Markdown 解析（markdown）                                           */
/* ------------------------------------------------------------------ */

export interface MarkdownOptions {
  gfm?: boolean // GitHub Flavored Markdown
  breaks?: boolean // 单换行转 <br>
  sanitize?: boolean // 净化输出 HTML
  highlight?: boolean // 启用代码高亮
}

export interface MarkdownRenderResult {
  html: string
  toc: Array<{ level: number; text: string; id: string }>
}

const DEFAULT_OPTIONS: Required<MarkdownOptions> = {
  gfm: true,
  breaks: false,
  sanitize: true,
  highlight: false,
}

/** 简单的 Markdown 渲染器（不依赖第三方库） */
export function renderMarkdown(
  source: string,
  options: MarkdownOptions = {},
): MarkdownRenderResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const toc: Array<{ level: number; text: string; id: string }> = []
  const html: string[] = []
  let inCodeBlock = false
  let codeLang: string | null = null
  let codeBuffer: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }

  const flushCode = () => {
    if (!inCodeBlock) return
    const code = codeBuffer.join('\n')
    if (opts.highlight) {
      const result = highlight(code, codeLang)
      html.push(`<pre><code class="language-${codeLang ?? 'plain'}">${result.html}</code></pre>`)
    } else {
      html.push(
        `<pre><code class="language-${codeLang ?? 'plain'}">${escapeForHtml(code)}</code></pre>`,
      )
    }
    inCodeBlock = false
    codeLang = null
    codeBuffer = []
  }

  for (const line of lines) {
    // 代码块
    const fence = line.match(/^```(\w*)/)
    if (fence) {
      if (inCodeBlock) {
        flushCode()
      } else {
        flushList()
        inCodeBlock = true
        codeLang = fence[1] || null
        codeBuffer = []
      }
      continue
    }
    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    // 空行
    if (line.trim() === '') {
      flushList()
      continue
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading && heading[1] && heading[2]) {
      flushList()
      const level = heading[1].length
      const text = heading[2].trim()
      const id = slugify(text)
      toc.push({ level, text, id })
      html.push(`<h${level} id="${id}">${escapeInline(text)}</h${level}>`)
      continue
    }

    // 引用
    if (line.startsWith('> ')) {
      flushList()
      html.push(`<blockquote>${parseInline(line.slice(2), opts)}</blockquote>`)
      continue
    }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList()
      html.push('<hr />')
      continue
    }

    // 无序列表
    if (/^[-*+]\s+/.test(line)) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
        html.push('<ul>')
      }
      html.push(`<li>${parseInline(line.replace(/^[-*+]\s+/, ''), opts)}</li>`)
      continue
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
        html.push('<ol>')
      }
      html.push(`<li>${parseInline(line.replace(/^\d+\.\s+/, ''), opts)}</li>`)
      continue
    }

    // 普通段落
    flushList()
    html.push(`<p>${parseInline(line, opts)}</p>`)
  }

  flushCode()
  flushList()

  let result = html.join('\n')
  if (opts.sanitize) result = sanitizeHtml(result)
  return { html: result, toc }
}

/** 行内语法：粗体 / 斜体 / 行内代码 / 链接 / 图片 / 删除线 */
function parseInline(text: string, opts: Required<MarkdownOptions>): string {
  let s = escapeInline(text)
  // 图片
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  // 链接
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
  // 行内代码
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // 粗体
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // 斜体
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>')
  // 删除线（GFM）
  if (opts.gfm) {
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  }
  // 换行
  if (opts.breaks) {
    s = s.replace(/\n/g, '<br />')
  }
  return s
}

function escapeInline(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/* ------------------------------------------------------------------ */
/* 工具辅助                                                            */
/* ------------------------------------------------------------------ */

/** 提取纯文本（去除 Markdown 语法） */
export function markdownToText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^[#>\-*+]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 估算阅读时长（分钟） */
export function estimateReadingTime(source: string): number {
  const text = markdownToText(source)
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}
