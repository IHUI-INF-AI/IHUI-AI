/**
 * 代码高亮模块
 * 基于 highlight.js/core 的封装 - 按需加载语言
 */

import hljs from 'highlight.js/lib/core'

// 按需注册常用语言
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

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
