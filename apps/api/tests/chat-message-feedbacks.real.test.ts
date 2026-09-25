// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, chatConversations, chatMessages, chatMessageFeedbacks } from '@ihui/database'
import { rateChatMessage } from '../src/db/chat-queries.js'

/**
 * D49① 消息点赞/点踩落库 —— 真实 DB 集成测试(2026-09-23 立)。
 * 验收判据(台账):反馈表行数 +1;upsert 改票覆盖;归属校验(他人消息/不存在消息 not-found)。
 * D64⑤(2026-09-26)补充:问卷结构化答案(reason/comment)零迁移落库 ——
 * 借 chat_messages.metadata jsonb `||` 原子合并写 `feedbackSurvey` 键;
 * 重复提交按键覆盖;纯评分(不带问卷)不写该键。
 * 运行方式:vitest.real.config.ts(真库 ihui_test),默认 vitest 排除 *.real.test.ts。
 */
describe('rateChatMessage — 真实 DB 集成测试(D49①)', () => {
  let userId: string
  let conversationId: string
  let messageId: string

  beforeEach(async () => {
    // 只清理本测试造的数据:按 email/昵称前缀定位,不动其他测试的行
    await db.execute(sql`DELETE FROM chat_message_feedbacks WHERE conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%+d49feedback@test.local'
      ))`)
    await db.execute(sql`DELETE FROM chat_messages WHERE conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%+d49feedback@test.local'
      ))`)
    await db.execute(sql`DELETE FROM chat_conversations WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%+d49feedback@test.local')`)
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%+d49feedback@test.local'`)

    const suffix = Math.random().toString(36).slice(2, 8)
    const [u] = await db
      .insert(users)
      .values({
        phone: `139${suffix}0001`,
        email: `d49-${suffix}+d49feedback@test.local`,
        username: `d49_${suffix}`,
        nickname: 'D49反馈测试用户',
      })
      .returning()
    userId = u!.id
    const [c] = await db
      .insert(chatConversations)
      .values({ userId, title: 'D49反馈测试会话' })
      .returning()
    conversationId = c!.id
    const [m] = await db
      .insert(chatMessages)
      .values({ conversationId, role: 'assistant', content: 'D49 测试回答' })
      .returning()
    messageId = m!.id
  })

  it('like 落库:反馈表行数 +1 且 rating 正确', async () => {
    const result = await rateChatMessage(userId, messageId, 'like')
    expect(result).toEqual({ ok: true })
    const rows = await db
      .select()
      .from(chatMessageFeedbacks)
      .where(sql`user_id = ${userId} AND message_id = ${messageId}`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.rating).toBe('like')
    expect(rows[0]?.conversationId).toBe(conversationId)
  })

  it('改票覆盖:同用户同消息再次评价,行数不变且 rating 更新', async () => {
    await rateChatMessage(userId, messageId, 'like')
    await rateChatMessage(userId, messageId, 'dislike')
    const rows = await db
      .select()
      .from(chatMessageFeedbacks)
      .where(sql`user_id = ${userId} AND message_id = ${messageId}`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.rating).toBe('dislike')
  })

  it('他人消息:not-found(归属校验,不区分不存在/无权)', async () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const [other] = await db
      .insert(users)
      .values({
        phone: `137${suffix}0002`,
        email: `d49-other-${suffix}+d49feedback@test.local`,
        username: `d49o_${suffix}`,
        nickname: 'D49其他用户',
      })
      .returning()
    const result = await rateChatMessage(other!.id, messageId, 'like')
    expect(result).toEqual({ ok: false, reason: 'not-found' })
    // 未落任何行
    const rows = await db.select().from(chatMessageFeedbacks)
    expect(rows.every((r) => r.userId !== other!.id)).toBe(true)
  })

  it('不存在的消息:not-found', async () => {
    const result = await rateChatMessage(
      userId,
      '00000000-0000-4000-8000-000000000000',
      'dislike',
    )
    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it('D64⑤ 问卷扩展:reason/comment 原子合并进 metadata.feedbackSurvey', async () => {
    const result = await rateChatMessage(userId, messageId, 'dislike', {
      reason: 'incomplete',
      comment: '少了最后一步',
    })
    expect(result).toEqual({ ok: true })
    const [msg] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId))
    const survey = (msg?.metadata as Record<string, unknown> | null)?.feedbackSurvey as
      | Record<string, unknown>
      | undefined
    expect(survey).toMatchObject({
      rating: 'dislike',
      reason: 'incomplete',
      comment: '少了最后一步',
    })
    expect(typeof survey?.answeredAt).toBe('string')
  })

  it('D64⑤ 重复提交问卷:feedbackSurvey 键覆盖为最新一票,反馈行仍一行', async () => {
    await rateChatMessage(userId, messageId, 'dislike', { reason: 'inaccurate' })
    await rateChatMessage(userId, messageId, 'dislike', { comment: '补充第二版' })
    const [msg] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId))
    const survey = (msg?.metadata as Record<string, unknown> | null)?.feedbackSurvey as
      | Record<string, unknown>
      | undefined
    // 最新一票为准:reason 已被不带 reason 的提交覆盖掉,comment 换新
    expect(survey).toMatchObject({ rating: 'dislike', comment: '补充第二版' })
    expect(survey?.reason).toBeUndefined()
    const rows = await db
      .select()
      .from(chatMessageFeedbacks)
      .where(sql`user_id = ${userId} AND message_id = ${messageId}`)
    expect(rows).toHaveLength(1)
  })

  it('D64⑤ 旧载荷(不带问卷)不写 metadata.feedbackSurvey 键', async () => {
    await rateChatMessage(userId, messageId, 'like')
    const [msg] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId))
    const meta = (msg?.metadata ?? {}) as Record<string, unknown>
    expect(meta.feedbackSurvey).toBeUndefined()
  })
})
