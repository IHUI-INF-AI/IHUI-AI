// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 metadata 九类摘要投影 — 纯函数用例(2026-10-31)。
 *
 * 咬三件事:
 *  ① 九类清单与票面口径逐字对齐,且九键不重不漏(清单是唯一代码定义,服务端/端侧共用);
 *  ② 投影只动九类:非九类的标量原样保留,九类变摘要信封(数组给条数,对象给字节上界);
 *  ③ 幂等 / 坏输入:重复投影不叠信封;null、数组、标量一律 null 或 false —— 不抛、
 *     不把"没有 metadata"伪装成"摘要"。
 */
import { describe, expect, it } from 'vitest'
import type { ChatMessageMetadata } from '@ihui/api-client'
import {
  METADATA_PROCESS_KIND_KEYS,
  hasSummarizedMetadata,
  isChatMetadataKindSummary,
  projectChatMetadataSummary,
} from '../message-metadata-summary'

describe('D35 metadata 九类摘要投影', () => {
  it('九类清单 = plan / 工具 / 终端 / 引用 / 计量 / 压缩 / 降级 / 记忆 / 队列(九键逐字)', () => {
    expect([...METADATA_PROCESS_KIND_KEYS]).toEqual([
      'planSteps',
      'toolCalls',
      'terminalTasks',
      'citations',
      'usageDetail',
      'compaction',
      'fallback',
      'memoryUpdates',
      'queueItems',
    ])
    expect(new Set(METADATA_PROCESS_KIND_KEYS).size).toBe(9)
  })

  it('投影只削九类正文:非九类标量原样保留', () => {
    const metadata: ChatMessageMetadata = {
      permissionMode: 'accept-edits',
      interrupted: true,
      model: 'gpt-x',
      toolCalls: [{ id: 't1' }, { id: 't2' }],
      citations: [{ source: 'doc', label: '文档' }],
      usageDetail: { totalTokens: 12, promptTokens: 8 },
      fallback: { primary_model: 'a', backup_model: 'b', reason: 'timeout' },
    }
    const summary = projectChatMetadataSummary(metadata)
    expect(summary).not.toBeNull()
    expect(summary?.permissionMode).toBe('accept-edits')
    expect(summary?.interrupted).toBe(true)
    expect(summary?.model).toBe('gpt-x')
    // 数组类:条数可判、正文不在
    expect(summary?.toolCalls).toEqual({ summary: true, count: 2, bytes: expect.any(Number) })
    expect(summary?.citations).toEqual({ summary: true, count: 1, bytes: expect.any(Number) })
    // 对象类:没有条数就不编造 1
    expect(summary?.usageDetail).toEqual({ summary: true, bytes: expect.any(Number) })
    expect(isChatMetadataKindSummary(summary?.fallback)).toBe(true)
    expect((summary?.fallback as { count?: number }).count).toBeUndefined()
  })

  it('未出现在该行的九类键不会被补造(不新增空信封)', () => {
    const summary = projectChatMetadataSummary({ toolCalls: [{ id: 't1' }] })
    expect(summary).toEqual({
      toolCalls: { summary: true, count: 1, bytes: expect.any(Number) },
    })
    expect('planSteps' in (summary ?? {})).toBe(false)
  })

  it('幂等:摘要再投影不叠加信封', () => {
    const once = projectChatMetadataSummary({
      toolCalls: [{ id: 't1' }],
      permissionMode: 'default',
    })
    expect(projectChatMetadataSummary(once)).toEqual(once)
  })

  it('坏输入:null / 数组 / 标量 ⇒ null(不抛)', () => {
    expect(projectChatMetadataSummary(null)).toBeNull()
    expect(projectChatMetadataSummary(undefined)).toBeNull()
    expect(projectChatMetadataSummary([{ toolCalls: [] }])).toBeNull()
    expect(projectChatMetadataSummary('metadata')).toBeNull()
    expect(projectChatMetadataSummary(42)).toBeNull()
  })

  it('hasSummarizedMetadata:摘要 ⇒ true;全量 / 缺席 ⇒ false(缺席不等于被裁)', () => {
    expect(hasSummarizedMetadata({ toolCalls: { summary: true, count: 2 } })).toBe(true)
    expect(hasSummarizedMetadata({ toolCalls: [{ id: 't1' }] })).toBe(false)
    expect(hasSummarizedMetadata({ permissionMode: 'default' })).toBe(false)
    expect(hasSummarizedMetadata(null)).toBe(false)
    expect(hasSummarizedMetadata({ toolCalls: { summary: false } })).toBe(false)
  })

  it('信封判别不认数组 / 字符串 / null(summary 必须是字面量 true)', () => {
    expect(isChatMetadataKindSummary({ summary: true })).toBe(true)
    expect(isChatMetadataKindSummary({ summary: 'true' })).toBe(false)
    expect(isChatMetadataKindSummary([{ summary: true }])).toBe(false)
    expect(isChatMetadataKindSummary(null)).toBe(false)
    expect(isChatMetadataKindSummary('summary')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
