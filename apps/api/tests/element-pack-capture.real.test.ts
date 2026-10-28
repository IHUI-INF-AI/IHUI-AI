// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeEach } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users, chatConversations, chatElementPacks } from '@ihui/database'
import {
  appendElementPackFrame,
  consumeElementPackFrames,
} from '../src/db/element-pack-queries.js'

/**
 * D64⑤ 元素包暂存表 —— 真实 DB 集成测试(2026-10-14 立)。
 * 验收判据(台账):同键 append 两帧 upsert 追加不丢;consume 取走即删
 * (DELETE ... RETURNING,二次取空);不同 clientMessageId 键隔离;
 * 会话删除级联清暂存行。契约:packages/shared/src/chat/element-pack-history.ts。
 * 运行方式:vitest.real.config.ts(真库 ihui_test),默认 vitest 排除 *.real.test.ts。
 */
describe('element-pack 暂存表 — 真实 DB 集成测试(D64⑤)', () => {
  let conversationId: string

  beforeEach(async () => {
    // 只清理本测试造的数据:按 email 前缀定位,不动其他测试的行
    // (暂存表对 chat_conversations ON DELETE CASCADE,删会话即清暂存)
    await db.execute(sql`DELETE FROM chat_element_packs WHERE conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%+d64elem@test.local'))`)
    await db.execute(sql`DELETE FROM chat_conversations WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%+d64elem@test.local')`)
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%+d64elem@test.local'`)

    const suffix = Math.random().toString(36).slice(2, 8)
    const [u] = await db
      .insert(users)
      .values({
        phone: `138${suffix}0003`,
        email: `d64-${suffix}+d64elem@test.local`,
        username: `d64e_${suffix}`,
        nickname: 'D64元素包测试用户',
      })
      .returning()
    const [c] = await db
      .insert(chatConversations)
      .values({ userId: u!.id, title: 'D64元素包测试会话' })
      .returning()
    conversationId = c!.id
  })

  it('同键 append 两帧:upsert 追加,consume 一次性取全且顺序保持', async () => {
    const clientMessageId = 'cm-ep-1'
    const spawn = { kind: 'subagent_spawn', agentId: 'sa-1', name: 'researcher' }
    const end = { kind: 'subagent_end', agentId: 'sa-1', status: 'done' }
    expect(await appendElementPackFrame(conversationId, clientMessageId, spawn)).toBe(true)
    expect(await appendElementPackFrame(conversationId, clientMessageId, end)).toBe(true)
    const frames = await consumeElementPackFrames(conversationId, clientMessageId)
    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject(spawn)
    expect(frames[1]).toMatchObject(end)
  })

  it('consume 取走即删:同键二次取空(回调重试不重复归并)', async () => {
    const clientMessageId = 'cm-ep-2'
    await appendElementPackFrame(conversationId, clientMessageId, {
      kind: 'subagent_progress',
      agentId: 'sa-2',
      phase: 'running',
    })
    expect(await consumeElementPackFrames(conversationId, clientMessageId)).toHaveLength(1)
    expect(await consumeElementPackFrames(conversationId, clientMessageId)).toEqual([])
    // 行已物理删除,不残留
    const rows = await db
      .select()
      .from(chatElementPacks)
      .where(eq(chatElementPacks.conversationId, conversationId))
    expect(rows).toHaveLength(0)
  })

  it('无帧轮次常态:未 append 直接 consume 得空数组', async () => {
    expect(await consumeElementPackFrames(conversationId, 'cm-never-appended')).toEqual([])
  })

  it('不同 clientMessageId 键隔离:互不串帧', async () => {
    await appendElementPackFrame(conversationId, 'cm-ep-a', {
      kind: 'subagent_spawn',
      agentId: 'sa-a',
    })
    await appendElementPackFrame(conversationId, 'cm-ep-b', {
      kind: 'subagent_spawn',
      agentId: 'sa-b',
    })
    const a = await consumeElementPackFrames(conversationId, 'cm-ep-a')
    const b = await consumeElementPackFrames(conversationId, 'cm-ep-b')
    expect(a).toHaveLength(1)
    expect((a[0] as Record<string, unknown>).agentId).toBe('sa-a')
    expect(b).toHaveLength(1)
    expect((b[0] as Record<string, unknown>).agentId).toBe('sa-b')
  })

  it('会话删除级联:暂存行随 chat_conversations 消亡', async () => {
    await appendElementPackFrame(conversationId, 'cm-ep-c', {
      kind: 'subagent_spawn',
      agentId: 'sa-c',
    })
    expect(
      (
        await db
          .select()
          .from(chatElementPacks)
          .where(eq(chatElementPacks.conversationId, conversationId))
      ).length,
    ).toBe(1)
    await db.delete(chatConversations).where(eq(chatConversations.id, conversationId))
    expect(
      (
        await db
          .select()
          .from(chatElementPacks)
          .where(eq(chatElementPacks.conversationId, conversationId))
      ).length,
    ).toBe(0)
  })
})
