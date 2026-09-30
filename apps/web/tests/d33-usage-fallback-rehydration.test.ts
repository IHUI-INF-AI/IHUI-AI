// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * @vitest-environment node
 */
// D33 过程性信息持久化 · web 读回层用例(2026-09-23 立):
// usageDetail / fallback / memoryUpdates 三类生产帧与 /api/ai/callback 早已落库,
// 但历史水合只读回 planSteps/citations/injections/compaction/retryNotice —— 刷新后
// 「这轮用了多少 token / 是否降级过模型 / 记住了什么」整段消失。
// 本文件钉住读回语义:与 SSE 契约同形状、脏数据缺席而非造假、seed 只灌真值行。
import { beforeEach, describe, expect, it } from 'vitest'

import {
  hydrateHistoryMessage,
  seedHistoryProcessInfoFrames,
  type HistoryMessageRecord,
} from '@/hooks/use-chat/history-message'
import { FALLBACK_REASON_QUOTA_EQUIVALENT } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'

const ID = 'msg-d33'

function row(metadata: Record<string, unknown> | null, id = ID): HistoryMessageRecord {
  return {
    id,
    role: 'assistant',
    content: '回答正文',
    createdAt: '2026-09-23T10:00:00+00:00',
    metadata,
  }
}

/** 与 api-callback persistedUsageDetailSchema 同形的完整落库行 */
const USAGE_FULL = {
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  reasoningTokens: 20,
  firstTokenMs: 800,
  durationMs: 3400,
  model: 'deepseek-chat',
  costUsd: 0.01,
}

beforeEach(() => {
  useChatStore.setState({ usageByMessageId: {}, memoryUpdateNotices: [] })
})

describe('usageDetail → MessageUsage 读回', () => {
  it('完整明细 → 与 live 徽章行同一 MessageUsage 形状逐字段等价', () => {
    const rows = [row({ usageDetail: USAGE_FULL })]
    seedHistoryProcessInfoFrames(rows)
    expect(useChatStore.getState().usageByMessageId[ID]).toEqual({
      totalTokens: 150,
      promptTokens: 100,
      completionTokens: 50,
      reasoningTokens: 20,
      firstTokenMs: 800,
      durationMs: 3400,
      model: 'deepseek-chat',
      costUsd: 0.01,
    })
  })

  it('provider 缺分项(reasoningTokens/costUsd 未落)→ 给 null 而不是 0,徽章分段相应不渲染', () => {
    seedHistoryProcessInfoFrames([row({ usageDetail: { totalTokens: 10 } })])
    const usage = useChatStore.getState().usageByMessageId[ID]
    expect(usage).toMatchObject({ totalTokens: 10, reasoningTokens: null, costUsd: null })
  })

  it('totalTokens 非正数 / 非有限值 → 不 seed(与 live 渲染位 totalTokens<=0 不显示同口径)', () => {
    seedHistoryProcessInfoFrames([
      row({ usageDetail: { totalTokens: 0 } }, 'a'),
      row({ usageDetail: { totalTokens: 'NaN' } }, 'b'),
      row({ usageDetail: 'not-an-object' }, 'c'),
    ])
    expect(useChatStore.getState().usageByMessageId).toEqual({})
  })

  it('hydrate 本体不挤掉既有读回字段(planSteps 与 usageDetail 共存)', () => {
    const msg = hydrateHistoryMessage(
      row({ usageDetail: USAGE_FULL, planSteps: [{ id: 'tc-1', step: 's', status: 'completed' }] }),
    )
    expect(msg.planSteps).toHaveLength(1)
  })
})

describe('fallback → 消息级 FallbackEvent 读回(snake→camel)', () => {
  it('三字段齐 → 换算为 camel FallbackEvent 挂到消息', () => {
    const msg = hydrateHistoryMessage(
      row({ fallback: { primary_model: 'gpt-a', backup_model: 'gpt-b', reason: 'timeout' } }),
    )
    expect(msg.fallback).toEqual({ primaryModel: 'gpt-a', backupModel: 'gpt-b', reason: 'timeout' })
  })

  it('quota_equivalent 特殊 reason 原样透传(渲染位据此切配额话术)', () => {
    const msg = hydrateHistoryMessage(
      row({
        fallback: {
          primary_model: 'glm-4',
          backup_model: 'glm-4-air',
          reason: FALLBACK_REASON_QUOTA_EQUIVALENT,
        },
      }),
    )
    expect(msg.fallback?.reason).toBe(FALLBACK_REASON_QUOTA_EQUIVALENT)
  })

  it('缺任一字段 → 字段缺席而不是渲染半截话术(与落库"缺一不落"同纪律)', () => {
    const msg = hydrateHistoryMessage(row({ fallback: { primary_model: 'gpt-a' } }))
    expect('fallback' in msg).toBe(true)
    expect(msg.fallback).toBeUndefined()
  })
})

describe('memoryUpdates → store.memoryUpdateNotices seed', () => {
  it('非空字符串数组 → seed 进既有「已记住」渲染位数据源', () => {
    seedHistoryProcessInfoFrames([row({ memoryUpdates: ['记住了 A', '记住了 B'] })])
    expect(useChatStore.getState().memoryUpdateNotices).toEqual([
      { messageId: ID, items: ['记住了 A', '记住了 B'] },
    ])
  })

  it('空数组 / 混入非字符串 / 非数组 → 一律不 seed(不给 MemoryNoticeBar 造空条)', () => {
    seedHistoryProcessInfoFrames([
      row({ memoryUpdates: [] }, 'a'),
      row({ memoryUpdates: ['ok', 42] }, 'b'),
      row({ memoryUpdates: 'nope' }, 'c'),
    ])
    expect(useChatStore.getState().memoryUpdateNotices).toEqual([])
  })

  it('无三类 key 的老消息 → seed 后 store 保持空(不造假交代)', () => {
    seedHistoryProcessInfoFrames([row(null), row({ model: 'x' })])
    const s = useChatStore.getState()
    expect(s.usageByMessageId).toEqual({})
    expect(s.memoryUpdateNotices).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
