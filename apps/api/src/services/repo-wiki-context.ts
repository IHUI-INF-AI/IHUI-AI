// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Repo Wiki 对话上下文取数层 (2026-09-13 新增,P1-8)
 *
 * 聊天主链路(ai-chat-stream / chat-resume)在转发请求前,按 repoName 读取仓库最新一条
 * kind='overview' 的"项目百科",截断后作为 wiki_context 透传给 ai-service,由
 * _inject_repo_wiki 注入 system prompt —— AI 回答代码/架构问题时自动引用项目百科。
 *
 * 设计要点:
 * - loadRepoWikiContext 全程 try/catch:任何异常(DB 抖动/表未建)一律 warn 并返回 null,
 *   绝不把异常抛给聊天主链路。
 * - userId 为 null 时只匹配全局 wiki(userId IS NULL)。
 * - 正文超长按 MAX_WIKI_CONTEXT_CHARS 截断,避免撑爆上下文窗口。
 */

import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { repoWikiDocs } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from './clawdbot/logger.js'

/** wiki 上下文注入字符上限(超出截断,防撑爆上下文窗口) */
export const MAX_WIKI_CONTEXT_CHARS = 8000

/** 截断提示语(与正文以空行分隔) */
const TRUNCATED_HINT = '\n\n…（项目百科已截断）'

export interface RepoWikiContext {
  repoName: string
  content: string
  generatedAt: Date | null
  truncated: boolean
}

/**
 * 截断 wiki 正文(纯函数):
 * - content.length <= limit → 原样返回,truncated=false
 * - 超长 → 在 limit 之前最后一个换行处截断(找不到换行才硬截),末尾追加截断提示
 */
export function trimWikiContext(
  content: string,
  limit: number = MAX_WIKI_CONTEXT_CHARS,
): { content: string; truncated: boolean } {
  if (content.length <= limit) return { content, truncated: false }
  let cut = content.lastIndexOf('\n', limit)
  if (cut <= 0) cut = limit
  return { content: `${content.slice(0, cut)}${TRUNCATED_HINT}`, truncated: true }
}

/**
 * 按仓库名加载最新一版项目百科总览。
 *
 * @param userId 当前用户 ID(null = 只匹配全局 wiki)
 * @param repoName 仓库名(空/纯空白 → null)
 * @returns 命中返回 {repoName, content, generatedAt, truncated};未命中或任何异常 → null
 */
export async function loadRepoWikiContext(
  userId: string | null,
  repoName: string | null | undefined,
): Promise<RepoWikiContext | null> {
  try {
    const name = repoName?.trim()
    if (!name) return null
    const rows = await db
      .select({
        content: repoWikiDocs.content,
        generatedAt: repoWikiDocs.generatedAt,
      })
      .from(repoWikiDocs)
      .where(
        and(
          eq(repoWikiDocs.kind, 'overview'),
          eq(repoWikiDocs.repoName, name),
          userId
            ? or(eq(repoWikiDocs.userId, userId), isNull(repoWikiDocs.userId))
            : isNull(repoWikiDocs.userId),
        ),
      )
      .orderBy(desc(repoWikiDocs.generatedAt))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    const trimmed = trimWikiContext(row.content)
    return {
      repoName: name,
      content: trimmed.content,
      generatedAt: row.generatedAt ?? null,
      truncated: trimmed.truncated,
    }
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, repoName },
      '[RepoWiki] 加载项目百科上下文失败,降级为不注入',
    )
    return null
  }
}
