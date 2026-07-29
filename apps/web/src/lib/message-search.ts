/**
 * 消息搜索工具函数(2026-07-29 立,Phase 23)
 *
 * 纯函数模块,提供消息搜索 + 高亮 + 正则转义能力,供 message-list.tsx 接入
 * "右键菜单搜索消息 + Ctrl+F 快捷键 + 高亮匹配 + 滚动到第一个匹配" 使用。
 *
 * 设计要点:
 * - 全部为纯函数,无副作用,便于单测
 * - 大小写不敏感匹配
 * - escapeRegExp 防止用户输入的特殊字符被当作正则元字符(注入防护)
 * - highlightMatch 返回 HTML 片段,用 <mark> 标签包裹匹配项(调用方需用 dangerouslySetInnerHTML)
 */

/** 搜索消息的最小结构:只需 id + content */
export interface SearchableMessage {
  id: string
  content: string
}

/** 转义正则特殊字符,防止用户输入被当作正则元字符
 *  覆盖: . * + ? ^ $ { } ( ) | [ ] \ /
 *  普通字母数字不变 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

/** 搜索消息内容,返回匹配的消息 ID 列表(按 messages 数组顺序)
 *  - 大小写不敏感
 *  - 空查询 / 空消息列表 → 返回空数组
 *  - 部分匹配(如 "auth" 匹配 "authentication") */
export function searchMessages(
  messages: ReadonlyArray<SearchableMessage>,
  query: string,
): string[] {
  const trimmed = query.trim()
  if (trimmed === '' || messages.length === 0) return []
  const pattern = new RegExp(escapeRegExp(trimmed), 'i')
  const result: string[] = []
  for (const m of messages) {
    if (pattern.test(m.content)) {
      result.push(m.id)
    }
  }
  return result
}

/** 高亮匹配文本,返回 HTML 片段(用 <mark> 标签包裹所有匹配项)
 *  - 大小写不敏感
 *  - 无匹配 → 返回原文(已 HTML 转义)
 *  - 多个匹配全部高亮
 *  - 返回值需用 dangerouslySetInnerHTML 注入,调用方需确保 query 来自可信输入
 *  - 标签样式:rounded-sm(非 rounded-full,符合 AGENTS.md §4 圆角守门)
 *  - 文本先 HTML 转义,query 也 HTML 转义后再匹配,保证 < > 等字符可搜索 + 防 XSS */
export function highlightMatch(text: string, query: string): string {
  const trimmed = query.trim()
  const escapedText = escapeHtml(text)
  if (trimmed === '') return escapedText
  const escapedQuery = escapeHtml(trimmed)
  const pattern = new RegExp(`(${escapeRegExp(escapedQuery)})`, 'gi')
  return escapedText.replace(
    pattern,
    '<mark class="bg-yellow-200 dark:bg-yellow-700 rounded-sm px-0.5">$1</mark>',
  )
}

/** HTML 转义:防止 XSS,只转义 5 个核心字符(& < > " ') */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
