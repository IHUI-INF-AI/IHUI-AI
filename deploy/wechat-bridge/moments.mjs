// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈消息归一化：wcfhttp/WeChatFerry 把朋友圈作为 type=0 的回调消息推给桥，
 * 这里把不同版本的 XML 尽力拆成 author/content/media/cursor，供 IHUI 展示与继续翻页。
 * 不伪造图片或点赞：只保留 XML 里真实出现的字段。
 */

import { createHash } from 'node:crypto'

function textOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function stripXml(value) {
  return textOf(value)
    .split('<![CDATA[')
    .join('')
    .replace(/]]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function tagValue(xml, names) {
  for (const name of names) {
    const plain = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(xml)
    if (plain?.[1]) {
      const value = stripXml(plain[1])
      if (value) return value
    }
  }
  return ''
}

function numberOf(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function firstUrl(xml) {
  const urls = [...xml.matchAll(/<url[^>]*>([\s\S]*?)<\/url>/gi)]
    .map((match) => stripXml(match[1]))
    .filter((url) => /^https?:\/\//i.test(url))
  return [...new Set(urls)]
}

/** 只有 type=0 且带朋友圈 XML/正文的回调才归到朋友圈，避免吞掉普通聊天消息。 */
export function isMomentMessage(raw) {
  if (!raw || typeof raw !== 'object') return false
  const type = raw.type ?? raw.msgType ?? raw.msg_type
  if (String(type ?? '') !== '0') return false
  const xml = textOf(raw.xml)
  const content = textOf(raw.content)
  return /<timeline|<sns|<moment|朋友圈|pyq/i.test(xml) || Boolean(xml && content)
}

function momentIdOf(raw, xml, authorName, content) {
  const explicit = tagValue(xml, ['snsId', 'snsid', 'feedId', 'feedid'])
  const rawId = textOf(raw.id)
  if (explicit) return explicit
  if (rawId) return rawId
  return `moment:${createHash('sha256')
    .update(`${authorName}\u0000${content}`)
    .digest('hex')
    .slice(0, 16)}`
}

export function parseMomentMessage(raw) {
  if (!isMomentMessage(raw)) return null
  const xml = textOf(raw.xml)
  const authorName =
    tagValue(xml, ['nickname', 'nickName', 'displayName', 'username', 'userName']) ||
    textOf(raw.senderName) ||
    textOf(raw.sender) ||
    '未知好友'
  const authorId =
    tagValue(xml, ['username', 'userName', 'wxid', 'fromusername']) || textOf(raw.sender) || null
  const content =
    textOf(raw.content) || tagValue(xml, ['contentDesc', 'content', 'desc', 'title']) || ''
  const createdAt =
    numberOf(tagValue(xml, ['createTime', 'createtime', 'timestamp'])) ?? numberOf(raw.ts) ?? null
  const mediaUrls = firstUrl(xml)
  const cursor =
    numberOf(tagValue(xml, ['snsId', 'snsid', 'feedId', 'feedid'])) ?? numberOf(raw.id) ?? null
  if (!content && mediaUrls.length === 0) return null
  return {
    id: momentIdOf(raw, xml, authorName, content),
    authorId,
    authorName,
    content,
    mediaUrls,
    createdAt,
    cursor,
    source: 'wcfhttp',
  }
}

/** 合并多页/多来源，按 id 与「作者+正文」双键去重，保留第一次出现的顺序。 */
export function mergeMoments(...groups) {
  const seen = new Set()
  const merged = []
  for (const group of groups) {
    for (const moment of Array.isArray(group) ? group : []) {
      if (!moment || typeof moment !== 'object') continue
      const id = textOf(moment.id)
      const author = textOf(moment.authorName)
      const content = textOf(moment.content)
      const key = id || `${author}\u0000${content}`
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(moment)
    }
  }
  return merged
}

/** 用朋友圈 id 作为下一页游标；没有数字 id 时退回最早一条的时间戳。 */
export function nextMomentCursor(moments) {
  const cursors = moments
    .map((item) => Number(item?.cursor))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (cursors.length > 0) return Math.min(...cursors)
  const times = moments
    .map((item) => Number(item?.createdAt))
    .filter((n) => Number.isFinite(n) && n > 0)
  return times.length > 0 ? Math.min(...times) : null
}

export const __test__ = { stripXml, tagValue, firstUrl }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
