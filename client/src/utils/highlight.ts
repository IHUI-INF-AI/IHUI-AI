/**
 * 代码高亮模块
 * 基于 highlight.js/core 的封装 - 按需加载语言
 */

import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'

// 按需注册常用语言
import _javascript from 'highlight.js/lib/languages/javascript'
import _typescript from 'highlight.js/lib/languages/typescript'
import _python from 'highlight.js/lib/languages/python'
import _java from 'highlight.js/lib/languages/java'
import _css from 'highlight.js/lib/languages/css'
import _scss from 'highlight.js/lib/languages/scss'
import _xml from 'highlight.js/lib/languages/xml'
import _json from 'highlight.js/lib/languages/json'
import _bash from 'highlight.js/lib/languages/bash'
import _sql from 'highlight.js/lib/languages/sql'
import _markdown from 'highlight.js/lib/languages/markdown'
import _yaml from 'highlight.js/lib/languages/yaml'
import _dockerfile from 'highlight.js/lib/languages/dockerfile'

// highlight.js v11+ 用 LanguageFn；不同子模块导出的形状不统一,统一 cast
const javascript = _javascript as unknown as LanguageFn
const typescript = _typescript as unknown as LanguageFn
const python = _python as unknown as LanguageFn
const java = _java as unknown as LanguageFn
const css = _css as unknown as LanguageFn
const scss = _scss as unknown as LanguageFn
const xml = _xml as unknown as LanguageFn
const json = _json as unknown as LanguageFn
const bash = _bash as unknown as LanguageFn
const sql = _sql as unknown as LanguageFn
const markdown = _markdown as unknown as LanguageFn
const yaml = _yaml as unknown as LanguageFn
const dockerfile = _dockerfile as unknown as LanguageFn

// 注册语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('css', css)
hljs.registerLanguage('scss', scss)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('vue', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('dockerfile', dockerfile)

/**
 * 高亮代码
 * @param code 代码字符串
 * @param language 语言
 */
export function highlightCode(code: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language }).value
    } catch (_e) {
      // 高亮失败，返回普通文本
    }
  }

  // 轻量级自动检测：仅在已注册语言中尝试，避免 highlightAuto 加载内置 190+ 语言
  const detected = detectRegisteredLanguage(code)
  if (detected) {
    try {
      return hljs.highlight(code, { language: detected }).value
    } catch (_e) {
      // 检测到但高亮失败，返回转义后的文本
    }
  }

  return escapeHtml(code)
}

/**
 * 在已注册语言中检测（避免 highlightAuto 加载未注册的内置语言）
 */
function detectRegisteredLanguage(code: string): string | null {
  // 简单启发式：按关键字优先匹配
  if (/^\s*[{[]/.test(code) && /[}\]]\s*$/.test(code)) {
    try {
      JSON.parse(code)
      return 'json'
    } catch (_e) {
      // 不是 JSON
    }
  }
  if (/^\s*<\?xml|^\s*<[a-zA-Z]/.test(code)) return 'xml'
  if (/^\s*(import|export|const|let|var|function|class)\s/.test(code)) return 'javascript'
  if (/^\s*(def|class|import|from|print)\s/.test(code)) return 'python'
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\s/i.test(code)) return 'sql'
  return null
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return text.replace(/[&<>"']/g, m => map[m])
}

/**
 * 检测代码语言
 * @param code 代码字符串
 */
export function detectLanguage(code: string): string {
  return detectRegisteredLanguage(code) || 'plaintext'
}

// 默认导出 hljs 实例
export default hljs
