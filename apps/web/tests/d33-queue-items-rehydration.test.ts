// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @vitest-environment node
 */
// D33(G-39) queueItems web 读回层用例(2026-09-26 立):
// 发送面(agent_engine.py build_queue_items)→ 落库面(ai-callback strictObject 三键)
// 已闭环,本文件钉住**读回语义**:与 SideQueueItem 逐字段同形、脏数据缺席而非造假、
// 空态不挂(与 citations/steerApplied/memoryUpdates 四类先例同口径)。
// 生产接线经既有 hydrateHistoryMessages 调用点(ai-side-panel loadHistory 两处),
// 本票零改 ai-side-panel(该文件有他人 D43 在途)。
import { describe, expect, it } from 'vitest'

import { hydrateHistoryMessage, type HistoryMessageRecord } from '@/hooks/use-chat/history-message'

const ID = 'msg-d33-qi'

function row(metadata: Record<string, unknown> | null, id = ID): HistoryMessageRecord {
  return {
    id,
    role: 'assistant',
    content: '回答正文',
    createdAt: '2026-09-26T10:00:00+00:00',
    metadata,
  }
}

/** 与 api 侧 persistedQueueItemSchema / Python 侧 QueueItemPayload 同形的合法项 */
const item = (index: number, text = `排队消息 ${index}`) => ({
  id: `q_${index}`,
  text,
  createdAt: 1_790_000_000_000 + index,
})

describe('queueItems → 消息字段读回(D33/G-39,2026-09-26 立)', () => {
  it('合法快照 → 归一为 SideQueueItem[] 逐字段等价挂到消息(id/text/createdAt 毫秒)', () => {
    const msg = hydrateHistoryMessage(row({ queueItems: [item(1), item(2, '先看第 2 个报错')] }))
    expect(msg.queueItems).toEqual([
      { id: 'q_1', text: '排队消息 1', createdAt: 1_790_000_000_001 },
      { id: 'q_2', text: '先看第 2 个报错', createdAt: 1_790_000_000_002 },
    ])
  })

  it('与既有读回字段共存(fallback + queueItems 同一条历史行)', () => {
    const msg = hydrateHistoryMessage(
      row({
        queueItems: [item(1)],
        fallback: { primary_model: 'gpt-a', backup_model: 'gpt-b', reason: 'timeout' },
      }),
    )
    expect(msg.queueItems).toHaveLength(1)
    expect(msg.fallback).toEqual({ primaryModel: 'gpt-a', backupModel: 'gpt-b', reason: 'timeout' })
  })

  it('坏项逐条剔除,好项保留 —— 半截快照不整体作废', () => {
    const msg = hydrateHistoryMessage(
      row({
        queueItems: [
          item(1),
          { id: '', text: 'id 空', createdAt: 1 }, // id 空串
          { id: 'q_2', text: 42, createdAt: 2 }, // text 非字符串
          { id: 'q_3', text: '毫秒非整数', createdAt: 1.5 }, // createdAt 非整数
          { id: 'q_4', text: '负时间', createdAt: -1 }, // createdAt 负数
          { id: 'q_5', text: '时间字符串', createdAt: '1790000000000' }, // 字符串形态
          'junk', // 非对象
          null,
        ],
      }),
    )
    expect(msg.queueItems).toEqual([
      { id: 'q_1', text: '排队消息 1', createdAt: 1_790_000_000_001 },
    ])
  })

  it.each([
    ['空数组(api 侧"确实没有排队"信号,消息字段形态下与缺键渲染等价)', []],
    ['全坏项', [{ id: '', text: 1, createdAt: 'x' }]],
    ['非数组', 'nope'],
    ['null', null],
  ])('%s → 不挂字段,不造空态', (_label: string, bad: unknown) => {
    const msg = hydrateHistoryMessage(row({ queueItems: bad }))
    expect(msg.queueItems).toBeUndefined()
  })

  it('缺 key 的老消息(2026-09-26 前落库)→ 不挂字段', () => {
    const msg = hydrateHistoryMessage(row({ model: 'deepseek-chat' }))
    expect(msg.queueItems).toBeUndefined()
  })

  it('metadata 为 null 的最老消息 → 不挂字段', () => {
    const msg = hydrateHistoryMessage(row(null))
    expect(msg.queueItems).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
