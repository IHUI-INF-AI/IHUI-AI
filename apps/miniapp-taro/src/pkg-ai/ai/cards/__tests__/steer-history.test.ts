// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D106 steer 历史读回(2026-09-24 立):api 侧把 steer 交代落库到 chat_messages.metadata.steerApplied
// ({text, timestamp?} 数组),miniapp 历史恢复链路此前只回放 live 侧已写进 aiCards 的 steerNotices,
// metadata 里的记录没人读。本测试锁 readSteerAppliedFromMetadata 的守卫口径(与 web 端
// use-chat/history-message.ts 的 readSteerAppliedFromMetadata 同语义)与 backfillSteerNoticesFromMetadata
// 的三条性质:live 已有不覆盖、无数据不写空态、其余字段不动。
import { describe, expect, it } from 'vitest'

import {
  backfillSteerNoticesFromMetadata,
  readSteerAppliedFromMetadata,
  type AICardsData,
  type SteerNoticeView,
} from '../types'

describe('readSteerAppliedFromMetadata(D106 历史读回守卫)', () => {
  it('合法数组 → SteerNoticeView(phase 恒 injected,text 裁剪,timestamp 仅 string 才带)', () => {
    expect(
      readSteerAppliedFromMetadata([{ text: '  重点讲第 3 步  ', timestamp: '2026-09-24T00:00:00Z' }]),
    ).toEqual([{ phase: 'injected', text: '重点讲第 3 步', timestamp: '2026-09-24T00:00:00Z' }])
  })

  it('timestamp 非字符串(number/null)→ 不带 timestamp 字段', () => {
    const out = readSteerAppliedFromMetadata([{ text: '换个说法', timestamp: 123 }])!
    expect(out).toHaveLength(1)
    expect('timestamp' in out[0]!).toBe(false)
  })

  it('非数组 / 空数组 → undefined(不给卡片造空态)', () => {
    expect(readSteerAppliedFromMetadata(undefined)).toBeUndefined()
    expect(readSteerAppliedFromMetadata(null)).toBeUndefined()
    expect(readSteerAppliedFromMetadata({})).toBeUndefined()
    expect(readSteerAppliedFromMetadata([])).toBeUndefined()
  })

  it('坏项逐条剔除(缺 text / 空 text / 纯空白 / 非对象),全坏 → undefined', () => {
    expect(readSteerAppliedFromMetadata([{ text: '' }, { text: '   ' }, {}, 'x', 3])).toBeUndefined()
    const mixed = readSteerAppliedFromMetadata([{ text: '' }, { text: '只留这条' }])!
    expect(mixed.map((n) => n.text)).toEqual(['只留这条'])
  })

  it('超 8 条封顶(对齐 _STEER_QUEUE_LIMIT,脏数据防御)', () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ text: `引导 ${i}` }))
    expect(readSteerAppliedFromMetadata(raw)).toHaveLength(8)
  })
})

interface Row {
  role: string
  metadata?: Record<string, unknown> | null
  aiCards?: AICardsData
}

const steerApplied = [{ text: '改用中文回答', timestamp: '2026-09-24T08:00:00Z' }]
const liveNotice: SteerNoticeView = { phase: 'injected', text: 'live 侧已写入' }

describe('backfillSteerNoticesFromMetadata(历史恢复映射)', () => {
  it('assistant + 无 aiCards + 合法 metadata → 重建 steerNotices,其余卡片段落位空数组', () => {
    const rows: Row[] = [{ role: 'assistant', metadata: { steerApplied } }]
    const out = backfillSteerNoticesFromMetadata(rows)
    expect(out[0]!.aiCards?.steerNotices).toEqual([
      { phase: 'injected', text: '改用中文回答', timestamp: '2026-09-24T08:00:00Z' },
    ])
    expect(out[0]!.aiCards?.citations).toEqual([])
  })

  it('aiCards 已有其他字段 → 保留并只补 steerNotices', () => {
    const rows: Row[] = [
      {
        role: 'assistant',
        metadata: { steerApplied },
        aiCards: {
          planSteps: [],
          toolCalls: [],
          terminalTasks: [],
          injections: [],
          citations: [{ source: 'web', label: '某来源' }],
        },
      },
    ]
    const out = backfillSteerNoticesFromMetadata(rows)
    expect(out[0]!.aiCards?.citations).toEqual([{ source: 'web', label: '某来源' }])
    expect(out[0]!.aiCards?.steerNotices).toHaveLength(1)
  })

  it('live 侧已写入 steerNotices → 不覆盖(防双份)', () => {
    const rows: Row[] = [
      {
        role: 'assistant',
        metadata: { steerApplied },
        aiCards: {
          planSteps: [],
          toolCalls: [],
          terminalTasks: [],
          injections: [],
          citations: [],
          steerNotices: [liveNotice],
        },
      },
    ]
    expect(backfillSteerNoticesFromMetadata(rows)[0]!.aiCards?.steerNotices).toEqual([liveNotice])
  })

  it('metadata 无 steerApplied / 全坏 → 原样返回(不写 aiCards.steerNotices,不渲染空态)', () => {
    const plain: Row = { role: 'assistant' }
    const dirty: Row = { role: 'assistant', metadata: { steerApplied: [{ text: '' }] } }
    for (const row of [plain, dirty]) {
      const out = backfillSteerNoticesFromMetadata([row])
      expect(out[0]!).toBe(row)
      expect(out[0]!.aiCards).toBeUndefined()
    }
  })

  it('user 消息不读回(引导记录只挂在 assistant 回答上)', () => {
    const rows: Row[] = [{ role: 'user', metadata: { steerApplied } }]
    expect(backfillSteerNoticesFromMetadata(rows)[0]!.aiCards).toBeUndefined()
  })
})

