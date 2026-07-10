'use client'

import * as React from 'react'

export interface SafeHtmlProps {
  html: string
  className?: string
  allowedTags?: string[]
}

const DEFAULT_ALLOWED_TAGS = [
  'a', 'b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li',
  'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre',
  'blockquote', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

const DANGEROUS_ATTRS = [
  'onerror',
  'onload',
  'onclick',
  'ondblclick',
  'onmouseover',
  'onmouseout',
  'onmousemove',
  'onmousedown',
  'onmouseup',
  'onfocus',
  'onblur',
  'onchange',
  'oninput',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
]

function sanitize(html: string, allowedTags: string[]): string {
  let result = html
  // 移除 script/style 标签及其内容
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  // 构建白名单:移除不在 allowedTags 中的标签
  const tagPattern = new RegExp(`</?(?!/?(?:${allowedTags.join('|')})\\b)[^>]*>`, 'gi')
  result = result.replace(tagPattern, '')
  // 移除事件处理器属性
  for (const attr of DANGEROUS_ATTRS) {
    const attrPattern = new RegExp(`\\s${attr}\\s*=\\s*"[^"]*"`, 'gi')
    result = result.replace(attrPattern, '')
    const attrPattern2 = new RegExp(`\\s${attr}\\s*=\\s*'[^']*'`, 'gi')
    result = result.replace(attrPattern2, '')
  }
  // 移除 javascript: 协议
  result = result.replace(/(href|src)\s*=\s*(['"])javascript:[^'"]*\2/gi, '$1=$2$2')
  return result
}

/**
 * 安全 HTML 渲染组件。
 *
 * 项目未安装 dompurify,这里使用简单正则替代方案:
 * - 移除 script/style 标签及其内容
 * - 仅保留 allowedTags 白名单中的标签
 * - 移除事件处理器(onerror/onclick 等)
 * - 移除 javascript: 协议
 *
 * 注意:正则方案不能覆盖所有 XSS 攻击场景,如需更强防护请安装 dompurify。
 */
export function SafeHtml({
  html,
  className,
  allowedTags = DEFAULT_ALLOWED_TAGS,
}: SafeHtmlProps): React.ReactElement {
  const clean = React.useMemo(() => sanitize(html, allowedTags), [html, allowedTags])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
