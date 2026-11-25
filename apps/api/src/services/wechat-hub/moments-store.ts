// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈归档持久化层（2026-11-25 增补）。
 *
 * 所有 DB 访问收在本模块：抓取成功后的 upsert、归档列表与计数。
 * 服务层只调这里导出的函数，整层可被 vi.mock 替换，单测不连库。
 * 本模块不吞错：库不可用向上抛，由服务层决定降级到桥还是兜底空结果。
 */

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { wechatHubMoments } from '@ihui/database'
import type { WechatMomentArchiveItemView, WechatMomentCommentView } from '@ihui/types'
import { db, dbRead } from '../../db/index.js'

/** 单条待归档动态（由 operations 从桥返回的 WechatMomentView 归一化而来）。 */
export interface MomentArchiveUpsertInput {
  momentKey: string
  authorId: string | null
  authorName: string
  authorResolved: boolean
  content: string
  mediaUrls: string[]
  createdAt: number | null
  source: string
  page: number | undefined
  /** 界面相对时间原文；仅合法非空字符串时随归档写进 metadata */
  timeText?: string
  /** 界面图片数量；仅正整数时随归档写进 metadata */
  imageCount?: number
  /** 评论原文行；仅非空字符串数组时随归档写进 metadata */
  commentTexts?: string[]
  /** DB sidecar 真实点赞名单 */
  likeUsers?: string[]
  /** DB sidecar 点赞者 wxid 名单 */
  likeUserIds?: string[]
  /** DB sidecar 带作者/时间的评论结构 */
  commentsData?: WechatMomentCommentView[]
  /** DB sidecar 本地媒体目录；仅在媒体真实落盘时写入 */
  mediaLocalDir?: string
  /** DB sidecar 是否至少落盘一个媒体 */
  mediaDownloaded?: boolean
  likes?: boolean
  comments?: boolean
}

/**
 * 把已在服务层校验过的三项摘要收进既有 metadata jsonb：缺省键不写入，
 * 避免在归档行里留下空串 / 0 / 空数组这类占位值。
 */
function momentMetadata(m: MomentArchiveUpsertInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  if (typeof m.timeText === 'string' && m.timeText.length > 0) metadata.timeText = m.timeText
  if (typeof m.imageCount === 'number' && Number.isInteger(m.imageCount) && m.imageCount > 0) {
    metadata.imageCount = m.imageCount
  }
  if (Array.isArray(m.commentTexts) && m.commentTexts.length > 0) {
    metadata.commentTexts = m.commentTexts
  }
  if (Array.isArray(m.likeUsers) && m.likeUsers.length > 0) {
    metadata.likeUsers = m.likeUsers
  }
  if (Array.isArray(m.likeUserIds) && m.likeUserIds.length > 0) {
    metadata.likeUserIds = m.likeUserIds
  }
  if (Array.isArray(m.commentsData) && m.commentsData.length > 0) {
    metadata.commentsData = m.commentsData
  }
  if (typeof m.mediaLocalDir === 'string' && m.mediaLocalDir.length > 0) {
    metadata.mediaLocalDir = m.mediaLocalDir
  }
  if (m.mediaDownloaded === true) metadata.mediaDownloaded = true
  if (m.likes === true) metadata.likes = true
  if (m.comments === true) metadata.comments = true
  return metadata
}

export interface MomentArchiveStat {
  added: number
  updated: number
  total: number
}

/** 归档层当前条数；库不可用时抛出，由调用方降级。 */
export async function countMomentsArchive(accountId: string): Promise<number> {
  const rows = await dbRead
    .select({ count: sql<number>`count(*)::int` })
    .from(wechatHubMoments)
    .where(eq(wechatHubMoments.accountId, accountId))
  return rows[0]?.count ?? 0
}

/**
 * 批量 upsert：(account_id, moment_key) 唯一。
 * 重复命中：seenCount+1、lastSeenAt=now；正文更长才覆盖；authorResolved 只升不降；
 * 作者名/作者 ID/媒体/原始时间在旧值为空或更短时回填，不拿 OCR 残文覆盖完整历史。
 */
export async function upsertMoments(
  accountId: string,
  moments: readonly MomentArchiveUpsertInput[],
): Promise<MomentArchiveStat> {
  if (moments.length === 0) {
    return { added: 0, updated: 0, total: await countMomentsArchive(accountId) }
  }
  const keys = moments.map((m) => m.momentKey)
  const existingRows = await dbRead
    .select({ momentKey: wechatHubMoments.momentKey })
    .from(wechatHubMoments)
    .where(
      and(eq(wechatHubMoments.accountId, accountId), inArray(wechatHubMoments.momentKey, keys)),
    )
  const existing = new Set(existingRows.map((row) => row.momentKey))
  const added = moments.filter((m) => !existing.has(m.momentKey)).length
  const updated = moments.length - added

  await db
    .insert(wechatHubMoments)
    .values(
      moments.map((m) => ({
        accountId,
        momentKey: m.momentKey,
        authorId: m.authorId,
        authorName: m.authorName,
        authorResolved: m.authorResolved,
        content: m.content,
        mediaUrls: m.mediaUrls,
        createdAt: m.createdAt,
        source: m.source,
        page: m.page ?? null,
        metadata: momentMetadata(m),
      })),
    )
    .onConflictDoUpdate({
      target: [wechatHubMoments.accountId, wechatHubMoments.momentKey],
      set: {
        lastSeenAt: new Date(),
        seenCount: sql`${wechatHubMoments.seenCount} + 1`,
        content: sql`CASE WHEN length(excluded.content) > length(${wechatHubMoments.content}) THEN excluded.content ELSE ${wechatHubMoments.content} END`,
        authorResolved: sql`${wechatHubMoments.authorResolved} OR excluded.author_resolved`,
        authorName: sql`CASE WHEN ${wechatHubMoments.authorName} = '' THEN excluded.author_name ELSE ${wechatHubMoments.authorName} END`,
        authorId: sql`COALESCE(${wechatHubMoments.authorId}, excluded.author_id)`,
        mediaUrls: sql`CASE WHEN jsonb_array_length(excluded.media_urls) > jsonb_array_length(${wechatHubMoments.mediaUrls}) THEN excluded.media_urls ELSE ${wechatHubMoments.mediaUrls} END`,
        createdAt: sql`COALESCE(${wechatHubMoments.createdAt}, excluded.created_at)`,
        metadata: sql`${wechatHubMoments.metadata} || excluded.metadata`,
      },
    })

  return { added, updated, total: await countMomentsArchive(accountId) }
}

/** 按最近抓到时间倒序取归档；库不可用时抛出，由服务层降级桥。 */
export async function listMomentsArchive(
  accountId: string,
  limit: number,
  offset = 0,
): Promise<WechatMomentArchiveItemView[]> {
  const rows = await dbRead
    .select()
    .from(wechatHubMoments)
    .where(eq(wechatHubMoments.accountId, accountId))
    .orderBy(desc(wechatHubMoments.lastSeenAt))
    .limit(limit)
    .offset(Math.max(0, Math.floor(offset)))
  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const likeUsers = Array.isArray(metadata.likeUsers)
      ? metadata.likeUsers.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        )
      : []
    const likeUserIds = Array.isArray(metadata.likeUserIds)
      ? metadata.likeUserIds.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        )
      : []
    const commentsData = Array.isArray(metadata.commentsData)
      ? metadata.commentsData
          .filter(
            (item): item is Record<string, unknown> =>
              typeof item === 'object' && item !== null && !Array.isArray(item),
          )
          .map((item) => ({
            ...(typeof item.username === 'string' && item.username
              ? { username: item.username }
              : {}),
            ...(typeof item.nickname === 'string' && item.nickname
              ? { nickname: item.nickname }
              : {}),
            content: typeof item.content === 'string' ? item.content : '',
            ...(typeof item.createTime === 'number' && Number.isFinite(item.createTime)
              ? { createTime: item.createTime }
              : {}),
            ...(typeof item.commentId === 'string' && item.commentId
              ? { commentId: item.commentId }
              : {}),
            ...(typeof item.refCommentId === 'string' && item.refCommentId
              ? { refCommentId: item.refCommentId }
              : {}),
          }))
          .filter((item) => item.content.length > 0)
      : []
    const hasLikes = metadata.likes === true || likeUsers.length > 0
    const hasComments = metadata.comments === true || commentsData.length > 0
    return {
      id: row.id,
      momentKey: row.momentKey,
      authorId: row.authorId,
      authorName: row.authorName,
      authorResolved: row.authorResolved,
      content: row.content,
      mediaUrls: (row.mediaUrls as string[]) ?? [],
      createdAt: row.createdAt,
      source: row.source,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      seenCount: row.seenCount,
      ...(row.page !== null && row.page !== undefined ? { page: row.page } : {}),
      ...(likeUsers.length > 0 ? { likeUsers } : {}),
      ...(likeUserIds.length > 0 ? { likeUserIds } : {}),
      ...(hasLikes ? { likes: true } : {}),
      ...(hasComments ? { comments: true } : {}),
      ...(commentsData.length > 0 ? { commentsData } : {}),
      ...(typeof metadata.mediaLocalDir === 'string' && metadata.mediaLocalDir.length > 0
        ? { mediaLocalDir: metadata.mediaLocalDir }
        : {}),
      ...(metadata.mediaDownloaded === true ? { mediaDownloaded: true } : {}),
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
