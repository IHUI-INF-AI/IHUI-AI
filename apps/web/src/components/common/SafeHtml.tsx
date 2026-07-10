'use client'

import * as React from 'react'
import DOMPurify from 'dompurify'

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

const DEFAULT_ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
  'width', 'height', 'colspan', 'rowspan',
]

function sanitize(html: string, allowedTags: string[]): string {
  // SSR 安全:dompurify 依赖 DOM,只能在客户端运行
  if (typeof window === 'undefined') {
    return ''
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: DEFAULT_ALLOWED_ATTR,
  })
}

/**
 * 安全 HTML 渲染组件。
 *
 * 使用 dompurify 对 HTML 进行消毒,防止 XSS 攻击:
 * - 仅保留 allowedTags 白名单中的标签
 * - 仅保留安全的属性白名单
 * - 自动移除 script/style 标签、事件处理器、javascript: 协议等危险内容
 *
 * SSR 安全:dompurify 依赖 DOM,只能在客户端运行。服务端渲染时返回空内容,
 * 客户端水合后渲染消毒后的 HTML。
 */
export function SafeHtml({
  html,
  className,
  allowedTags = DEFAULT_ALLOWED_TAGS,
}: SafeHtmlProps): React.ReactElement {
  const clean = React.useMemo(() => sanitize(html, allowedTags), [html, allowedTags])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
