// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D64⑤ 元素包历史落库 —— 暂存表读写(2026-10-14 立)。
 *
 * 链路:网关转发循环识别 subagent 帧族 → appendElementPackFrame 单语句 upsert 追加
 * (ON CONFLICT DO UPDATE SET frames = frames || EXCLUDED.frames,行锁串行化下并发
 * 追加零丢帧)→ ai-callback worker 落 assistant 消息前 consumeElementPackFrames
 * 原子取走(DELETE ... RETURNING,取走即删,不残留)→ 并进消息 metadata.elementPack。
 *
 * 表定义:packages/database/src/schema/chat.ts 的 chatElementPacks
 * (迁移 20261014100000_chat_element_packs.sql)。wire 契约与守卫:
 * packages/shared/src/chat/element-pack-history.ts。
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from './index.js'
import { chatElementPacks } from '@ihui/database'

/**
 * 追加一帧进暂存行(存在则 jsonb 追加,不存在则建行)。单语句 upsert:
 * 两个并发 append 在同一行锁上串行,两个 frames 数组都进最终结果,零丢帧。
 * 返回 true = 本次真的写了(行存在且帧已并入)。
 */
export async function appendElementPackFrame(
  conversationId: string,
  clientMessageId: string,
  frame: Record<string, unknown>,
): Promise<boolean> {
  const rows = await db
    .insert(chatElementPacks)
    .values({ conversationId, clientMessageId, frames: [frame] })
    .onConflictDoUpdate({
      target: [chatElementPacks.conversationId, chatElementPacks.clientMessageId],
      set: {
        // jsonb 追加:frames = 既有数组 || [新帧]。显式 stringify + ::jsonb 避免
        // postgres-js Bind 对象时的形态歧义(与 rateChatMessage 的 || 合并同型)。
        frames: sql`coalesce(${chatElementPacks.frames}, '[]'::jsonb) || ${JSON.stringify([frame])}::jsonb`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: chatElementPacks.id })
  return rows.length > 0
}

/**
 * 原子取走该 (会话, 占位消息) 的全部暂存帧:DELETE ... RETURNING 保证取走即删,
 * 同键二次取回空数组(回调重试不重复归并)。无行 ⇒ 空数组(常态:无元素包的轮次)。
 */
export async function consumeElementPackFrames(
  conversationId: string,
  clientMessageId: string,
): Promise<Record<string, unknown>[]> {
  const rows = await db
    .delete(chatElementPacks)
    .where(
      and(
        eq(chatElementPacks.conversationId, conversationId),
        eq(chatElementPacks.clientMessageId, clientMessageId),
      ),
    )
    .returning({ frames: chatElementPacks.frames })
  const frames = rows[0]?.frames
  return Array.isArray(frames) ? (frames as Record<string, unknown>[]) : []
}
