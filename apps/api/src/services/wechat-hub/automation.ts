// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自动回复规则。
 *
 * 设计约束：
 *  - 默认关闭；启用后只对入站消息触发，且仍走 manager.send 的同一套出站策略。
 *  - 规则只做本地关键词匹配，不调用 LLM，避免每条消息都烧 token。
 *  - lastTriggeredAt 作为冷却闸与并发抢占点；claim 失败直接跳过。
 */

import { and, desc, eq, isNull, lt, or } from 'drizzle-orm'
import { wechatHubAutoReplyRules } from '@ihui/database'
import type {
  WechatAutoReplyMatchType,
  WechatAutoReplyRuleInput,
  WechatAutoReplyRuleView,
  WechatAutoReplyScope,
  WechatSendInput,
  WechatSendResult,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'
import { isContactBlocked } from './contacts.js'
import type { WechatInboundEvent } from './types.js'

const MATCH_TYPES: WechatAutoReplyMatchType[] = ['contains', 'exact', 'prefix']
const SCOPES: WechatAutoReplyScope[] = ['all', 'private', 'group']

function toRuleView(row: typeof wechatHubAutoReplyRules.$inferSelect): WechatAutoReplyRuleView {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    enabled: row.enabled,
    matchType: (MATCH_TYPES.includes(row.matchType as WechatAutoReplyMatchType)
      ? row.matchType
      : 'contains') as WechatAutoReplyMatchType,
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
    replyText: row.replyText,
    scope: (SCOPES.includes(row.scope as WechatAutoReplyScope)
      ? row.scope
      : 'all') as WechatAutoReplyScope,
    cooldownSeconds: row.cooldownSeconds,
    lastTriggeredAt: row.lastTriggeredAt ? row.lastTriggeredAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 纯匹配：contains 任一关键词 / exact 全等 / prefix 前缀；大小写不敏感。 */
export function matchAutoReply(
  rule: Pick<WechatAutoReplyRuleView, 'matchType' | 'keywords' | 'scope'>,
  event: Pick<WechatInboundEvent, 'content' | 'conversationKind'>,
): boolean {
  if (rule.scope !== 'all' && rule.scope !== event.conversationKind) return false
  const text = event.content.trim().toLowerCase()
  if (text.length === 0) return false
  for (const raw of rule.keywords) {
    const keyword = raw.trim().toLowerCase()
    if (keyword.length === 0) continue
    if (rule.matchType === 'exact' && text === keyword) return true
    if (rule.matchType === 'prefix' && text.startsWith(keyword)) return true
    if (rule.matchType === 'contains' && text.includes(keyword)) return true
  }
  return false
}

export async function listRules(
  userId: string,
  accountId: string,
): Promise<WechatAutoReplyRuleView[]> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubAutoReplyRules)
    .where(eq(wechatHubAutoReplyRules.accountId, accountId))
    .orderBy(desc(wechatHubAutoReplyRules.createdAt))
  return rows.map((row) => toRuleView(row))
}

export async function createRule(
  userId: string,
  accountId: string,
  input: WechatAutoReplyRuleInput,
): Promise<WechatAutoReplyRuleView> {
  await assertAccountForUser(userId, accountId)
  const inserted = await db
    .insert(wechatHubAutoReplyRules)
    .values({
      accountId,
      name: input.name?.trim() || '未命名规则',
      enabled: Boolean(input.enabled),
      matchType: input.matchType ?? 'contains',
      keywords: input.keywords ?? [],
      replyText: input.replyText ?? '',
      scope: input.scope ?? 'all',
      cooldownSeconds: input.cooldownSeconds ?? 0,
    })
    .returning()
  const row = inserted[0]
  if (!row) throw new AppError('创建自动回复规则失败', 500, 'WECHAT_RULE_CREATE_FAILED')
  return toRuleView(row)
}

export async function updateRule(
  userId: string,
  accountId: string,
  ruleId: string,
  input: WechatAutoReplyRuleInput,
): Promise<WechatAutoReplyRuleView> {
  await assertAccountForUser(userId, accountId)
  const existing = await dbRead
    .select({ id: wechatHubAutoReplyRules.id })
    .from(wechatHubAutoReplyRules)
    .where(
      and(eq(wechatHubAutoReplyRules.id, ruleId), eq(wechatHubAutoReplyRules.accountId, accountId)),
    )
    .limit(1)
  if (!existing[0]) throw new AppError('自动回复规则不存在', 404, 'WECHAT_RULE_NOT_FOUND')
  const updated = await db
    .update(wechatHubAutoReplyRules)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() || '未命名规则' } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.matchType !== undefined ? { matchType: input.matchType } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
      ...(input.replyText !== undefined ? { replyText: input.replyText } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.cooldownSeconds !== undefined ? { cooldownSeconds: input.cooldownSeconds } : {}),
      updatedAt: new Date(),
    })
    .where(eq(wechatHubAutoReplyRules.id, ruleId))
    .returning()
  const row = updated[0]
  if (!row) throw new AppError('保存自动回复规则失败', 500, 'WECHAT_RULE_UPDATE_FAILED')
  return toRuleView(row)
}

export async function deleteRule(userId: string, accountId: string, ruleId: string): Promise<void> {
  await assertAccountForUser(userId, accountId)
  const deleted = await db
    .delete(wechatHubAutoReplyRules)
    .where(
      and(eq(wechatHubAutoReplyRules.id, ruleId), eq(wechatHubAutoReplyRules.accountId, accountId)),
    )
    .returning({ id: wechatHubAutoReplyRules.id })
  if (deleted.length === 0) throw new AppError('自动回复规则不存在', 404, 'WECHAT_RULE_NOT_FOUND')
}

/** 入站后触发；返回命中的规则与发送结果，交给 manager 写审计。 */
export async function runAutoReply(
  userId: string,
  accountId: string,
  event: WechatInboundEvent,
  send: (input: WechatSendInput) => Promise<WechatSendResult>,
): Promise<{ rule: WechatAutoReplyRuleView; result: WechatSendResult } | null> {
  await assertAccountForUser(userId, accountId)
  if (event.senderId && (await isContactBlocked(accountId, event.senderId))) return null
  const rows = await dbRead
    .select()
    .from(wechatHubAutoReplyRules)
    .where(
      and(
        eq(wechatHubAutoReplyRules.accountId, accountId),
        eq(wechatHubAutoReplyRules.enabled, true),
      ),
    )
    .orderBy(desc(wechatHubAutoReplyRules.createdAt))
  for (const row of rows) {
    const rule = toRuleView(row)
    if (rule.replyText.trim().length === 0) continue
    if (!matchAutoReply(rule, event)) continue
    const cutoff = new Date(Date.now() - Math.max(rule.cooldownSeconds, 0) * 1000)
    const claimed = await db
      .update(wechatHubAutoReplyRules)
      .set({ lastTriggeredAt: new Date() })
      .where(
        and(
          eq(wechatHubAutoReplyRules.id, rule.id),
          or(
            isNull(wechatHubAutoReplyRules.lastTriggeredAt),
            lt(wechatHubAutoReplyRules.lastTriggeredAt, cutoff),
          ),
        ),
      )
      .returning({ id: wechatHubAutoReplyRules.id })
    if (claimed.length === 0) continue
    const result = await send({
      accountId,
      target: event.platformChatId,
      kind: 'text',
      text: rule.replyText,
      mentions: event.conversationKind === 'group' && event.senderId ? [event.senderId] : undefined,
    })
    return { rule: { ...rule, lastTriggeredAt: new Date().toISOString() }, result }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
