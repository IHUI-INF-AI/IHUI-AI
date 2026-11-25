// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈本地归档：把每次真实抓到的动态按「作者+正文」归一化去重后落成 JSONL。
 * 只保存桥实际返回的字段；不补图片、点赞、评论，不把 OCR 错字“修”成平台原文。
 * 目的是给数据分析和重复抓取一个稳定的历史层，而不是替代微信原始存储。
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const DEFAULT_MAX = 5000

function textOf(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map((item) => textOf(item)).filter(Boolean)
}

/** 归一化只用于判重，不改变归档展示的原文。作者回退为「朋友圈好友」时不能把同一正文判成新人。 */
function isUnknownAuthor(value) {
  const author = textOf(value)
  return !author || author === '朋友圈好友' || author === 'ocr:member:unknown'
}

function normalizedContent(moment) {
  return textOf(moment?.content)
    .toLowerCase()
    .replace(/[\s\u3000【】\[\]〔〕〖〗·•，,。.：:；;！!？?、]/gu, '')
}

function archiveKey(moment) {
  const author = isUnknownAuthor(moment?.authorName)
    ? '~'
    : textOf(moment?.authorName)
        .toLowerCase()
        .replace(/[\s\u3000【】\[\]〔〕〖〗·•，,。.：:；;！!？?、]/gu, '')
  const content = normalizedContent(moment)
  if (!content) return `id:${textOf(moment?.id)}`
  return `${author}\u0000${content}`
}

function archiveId(moment) {
  const id = textOf(moment?.id)
  if (id) return id
  return `archive-${createHash('sha256').update(archiveKey(moment)).digest('hex').slice(0, 16)}`
}

function normalizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const content = textOf(value.content)
  const mediaUrls = stringArray(value.mediaUrls)
  const likeUsers = stringArray(value.likeUsers)
  const likeUserIds = stringArray(value.likeUserIds)
  const commentsData = Array.isArray(value.commentsData)
    ? value.commentsData
        .filter((item) => item && typeof item === 'object' && textOf(item.content))
        .map((item) => ({
          username: textOf(item.username) || undefined,
          nickname: textOf(item.nickname) || undefined,
          content: textOf(item.content),
          createTime:
            typeof item.createTime === 'number' && Number.isFinite(item.createTime)
              ? item.createTime
              : null,
          commentId: textOf(item.commentId) || null,
          refCommentId: textOf(item.refCommentId) || null,
        }))
    : []
  const hasLikes = value.likes === true || likeUsers.length > 0
  const hasComments = value.comments === true || commentsData.length > 0
  // 纯图片/纯点赞动态也可能没有正文：DB 路线要保留，不再只认正文。
  if (!content && mediaUrls.length === 0 && !hasLikes && !hasComments) return null
  const authorId = textOf(value.authorId) || null
  const mediaLocalDir = textOf(value.mediaLocalDir)
  return {
    id: textOf(value.id) || archiveId(value),
    authorId,
    authorResolved: authorId !== null,
    authorName: textOf(value.authorName) || '朋友圈好友',
    content,
    mediaUrls,
    createdAt: numberOrNull(value.createdAt),
    source: textOf(value.source) || 'ocr',
    page: typeof value.page === 'number' && Number.isFinite(value.page) ? value.page : null,
    ...(mediaLocalDir ? { mediaLocalDir } : {}),
    ...(value.mediaDownloaded === true ? { mediaDownloaded: true } : {}),
    ...(likeUsers.length > 0 ? { likeUsers } : {}),
    ...(likeUserIds.length > 0 ? { likeUserIds } : {}),
    ...(commentsData.length > 0 ? { commentsData } : {}),
    likes: hasLikes,
    comments: hasComments,
    firstSeenAt: textOf(value.firstSeenAt) || textOf(value.lastSeenAt) || new Date().toISOString(),
    lastSeenAt: textOf(value.lastSeenAt) || new Date().toISOString(),
    seenCount:
      typeof value.seenCount === 'number' && Number.isFinite(value.seenCount)
        ? Math.max(1, Math.floor(value.seenCount))
        : 1,
  }
}

function maxArchive() {
  const configured = Number(process.env.BRIDGE_MAX_ARCHIVE ?? DEFAULT_MAX)
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 1), 50000) : DEFAULT_MAX
}

export async function readMomentArchive(filePath, limit = 500) {
  let raw = ''
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') return { total: 0, moments: [] }
    throw e
  }
  const records = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    try {
      const record = normalizeRecord(JSON.parse(line))
      if (record) records.push(record)
    } catch {
      // 单行损坏不能让整个历史层不可读；保留其他可解析记录。
    }
  }
  records.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  const capped = Math.min(Math.max(Number(limit) || 500, 1), 1000)
  return { total: records.length, moments: records.slice(0, capped) }
}

export async function appendMomentArchive(moments, filePath) {
  const incoming = (Array.isArray(moments) ? moments : [])
    .map(normalizeRecord)
    .filter((item) => item !== null)
  if (incoming.length === 0) {
    const current = await readMomentArchive(filePath, 1000)
    return { added: 0, updated: 0, total: current.total }
  }

  let existing = []
  try {
    const raw = await readFile(filePath, 'utf8')
    existing = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return normalizeRecord(JSON.parse(line))
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch (e) {
    if (!e || typeof e !== 'object' || e.code !== 'ENOENT') throw e
  }

  const byKey = new Map()
  const byContent = new Map()
  for (const item of existing) {
    const key = archiveKey(item)
    if (!byKey.has(key)) byKey.set(key, item)
    const contentKey = normalizedContent(item)
    if (!contentKey) continue
    const bucket = byContent.get(contentKey) ?? []
    bucket.push(item)
    byContent.set(contentKey, bucket)
  }

  let added = 0
  let updated = 0
  const now = new Date().toISOString()
  for (const item of incoming) {
    const key = archiveKey(item)
    let previous = byKey.get(key)
    if (!previous && item.content) {
      const candidates = byContent.get(normalizedContent(item)) ?? []
      if (isUnknownAuthor(item.authorName)) {
        previous =
          candidates.find((candidate) => !isUnknownAuthor(candidate.authorName)) ?? candidates[0]
      } else {
        previous =
          candidates.find((candidate) => isUnknownAuthor(candidate.authorName)) ?? candidates[0]
      }
    }
    if (!previous) {
      const record = { ...item, firstSeenAt: now, lastSeenAt: now, seenCount: 1 }
      byKey.set(key, record)
      const contentKey = normalizedContent(record)
      if (contentKey) {
        const bucket = byContent.get(contentKey) ?? []
        bucket.push(record)
        byContent.set(contentKey, bucket)
      }
      added += 1
      continue
    }
    // 同一动态再次出现：只更新时间和计数；OCR 变长时保留更完整的文本。
    const oldKey = archiveKey(previous)
    const wasUnknown = isUnknownAuthor(previous.authorName)
    previous.lastSeenAt = now
    previous.seenCount += 1
    if (item.content.length > previous.content.length + 4) previous.content = item.content
    if (!isUnknownAuthor(item.authorName) && wasUnknown) {
      previous.authorName = item.authorName
      byKey.delete(oldKey)
      byKey.set(archiveKey(previous), previous)
    }
    if (item.mediaUrls.length > previous.mediaUrls.length) previous.mediaUrls = item.mediaUrls
    if (item.createdAt && !previous.createdAt) previous.createdAt = item.createdAt
    if (item.mediaLocalDir && !previous.mediaLocalDir) {
      previous.mediaLocalDir = item.mediaLocalDir
    }
    if (item.mediaDownloaded === true) previous.mediaDownloaded = true
    if (item.likeUsers?.length > (previous.likeUsers?.length ?? 0)) {
      previous.likeUsers = item.likeUsers
    }
    if (item.likeUserIds?.length > (previous.likeUserIds?.length ?? 0)) {
      previous.likeUserIds = item.likeUserIds
    }
    if (item.commentsData?.length > (previous.commentsData?.length ?? 0)) {
      previous.commentsData = item.commentsData
    }
    if (item.likes === true) previous.likes = true
    if (item.comments === true) previous.comments = true
    updated += 1
  }

  const max = maxArchive()
  const kept = [...byKey.values()]
    .sort((a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt))
    .slice(-max)
  const payload = kept.map((item) => JSON.stringify(item)).join('\n')
  await mkdir(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp-${process.pid}`
  await writeFile(tmpPath, payload ? `${payload}\n` : '', 'utf8')
  await rename(tmpPath, filePath)
  return { added, updated, total: kept.length }
}

export const __test__ = { archiveKey, normalizeRecord }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
