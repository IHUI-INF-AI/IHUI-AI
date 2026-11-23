// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 分析执行器（从 manager 拆出）。
 * 只负责取数、缓存命中、落地 run 与调用分析引擎；审计由 manager 统一写。
 */

import { and, desc, eq } from 'drizzle-orm'
import { wechatHubAnalysisRuns, wechatHubMessages } from '@ihui/database'
import type { WechatAnalysisKind, WechatAnalysisRunView } from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser, assertConversationForAccount } from './guards.js'
import { analyzeMessages, hashAnalysisInput } from './analysis.js'
import { toAnalysisView, toMessageView } from './views.js'

export interface AnalysisOutcome {
  view: WechatAnalysisRunView
  accountId: string
  target: string | null
  messageCount: number
}

export async function runAnalysis(
  userId: string,
  input: {
    accountId: string
    conversationId?: string
    kind: WechatAnalysisKind
    limit?: number
    model?: string
    force?: boolean
  },
): Promise<AnalysisOutcome> {
  await assertAccountForUser(userId, input.accountId)
  const conversation = input.conversationId
    ? await assertConversationForAccount(input.accountId, input.conversationId)
    : null
  const limit = Math.min(Math.max(input.limit ?? 200, 10), 1_000)
  const where = conversation
    ? and(
        eq(wechatHubMessages.accountId, input.accountId),
        eq(wechatHubMessages.conversationId, conversation.id),
      )
    : eq(wechatHubMessages.accountId, input.accountId)
  const messageRows = await dbRead
    .select()
    .from(wechatHubMessages)
    .where(where)
    .orderBy(desc(wechatHubMessages.createdAt))
    .limit(limit)
  const messages = messageRows.reverse().map((item) => toMessageView(item))
  const inputHash = hashAnalysisInput(
    input.kind,
    conversation?.id ?? null,
    messages.map((message) => message.id),
  )
  const target = conversation?.platformChatId ?? null

  if (!input.force) {
    const cached = await dbRead
      .select()
      .from(wechatHubAnalysisRuns)
      .where(
        and(
          eq(wechatHubAnalysisRuns.accountId, input.accountId),
          eq(wechatHubAnalysisRuns.kind, input.kind),
          eq(wechatHubAnalysisRuns.inputHash, inputHash),
          eq(wechatHubAnalysisRuns.status, 'success'),
        ),
      )
      .orderBy(desc(wechatHubAnalysisRuns.createdAt))
      .limit(1)
    const hit = cached[0]
    if (hit) {
      return {
        view: toAnalysisView(hit),
        accountId: input.accountId,
        target,
        messageCount: messages.length,
      }
    }
  }

  const inserted = await db
    .insert(wechatHubAnalysisRuns)
    .values({
      accountId: input.accountId,
      conversationId: conversation?.id ?? null,
      kind: input.kind,
      status: 'running',
      inputHash,
      model: input.model ?? null,
    })
    .returning()
  const run = inserted[0]
  if (!run) throw new AppError('创建分析任务失败', 500, 'WECHAT_ANALYZE_CREATE_FAILED')

  try {
    const { result, model, tokens } = await analyzeMessages(
      input.kind,
      conversation?.title ?? null,
      messages,
    )
    const updated = await db
      .update(wechatHubAnalysisRuns)
      .set({
        status: 'success',
        result,
        model: input.model ?? model,
        tokens,
        completedAt: new Date(),
      })
      .where(eq(wechatHubAnalysisRuns.id, run.id))
      .returning()
    return {
      view: toAnalysisView(updated[0] ?? run),
      accountId: input.accountId,
      target,
      messageCount: messages.length,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '分析失败'
    await db
      .update(wechatHubAnalysisRuns)
      .set({ status: 'failed', error: message, completedAt: new Date() })
      .where(eq(wechatHubAnalysisRuns.id, run.id))
    return {
      view: toAnalysisView({ ...run, status: 'failed' as const, error: message }),
      accountId: input.accountId,
      target,
      messageCount: messages.length,
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
