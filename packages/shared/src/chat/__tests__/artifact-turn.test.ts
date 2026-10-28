// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

import { describe, it, expect } from 'vitest'
import {
  artifactKindOf,
  artifactTurnIndex,
  assistantTurnOf,
  collectArtifactTurns,
  type ArtifactTurnSourceMessage,
} from '../artifact-turn'

/**
 * D76 产物归属 turn 派生层(共享层单一真相源)。
 * 本票(残余①,2026-09-25)把派生自 web artifact-turn-badge.tsx 原样提取至此,
 * 行为逐字不变 → 回归用例先钉住提取语义,再覆盖新判据 artifactTurnIndex:
 * **产物锚点 → 派生序列下标只消费 collectArtifactTurns 的结果,不另建映射** ——
 * 用例 4 用"同一 turns 数组逐锚点复核"锁死这条结构约束(第二份映射的形态在此红)。
 */

const MULTI_TURN: ArtifactTurnSourceMessage[] = [
  { id: 'u1', role: 'user' },
  {
    id: 'a1',
    role: 'assistant',
    toolCalls: [
      {
        summary_data: {
          artifacts: [{ path: 'tmp/artifacts/one.docx' }, { path: 'tmp/artifacts/two.csv' }],
        },
      },
    ],
  },
  { id: 'a2', role: 'assistant' },
  {
    id: 'a3',
    role: 'assistant',
    toolCalls: [{ summary_data: { artifacts: [{ name: 'deck.pptx' }] } }],
  },
]

describe('collectArtifactTurns / assistantTurnOf 提取回归(行为逐字不变)', () => {
  it('产物归属产生它的 assistant 消息;turn=assistant 1 基序号;无产物轮不出现但占序号;name 兜底', () => {
    const turns = collectArtifactTurns(MULTI_TURN)
    expect(turns.length).toBe(2)
    expect(turns[0]).toEqual({
      turn: 1,
      messageId: 'a1',
      artifacts: [
        { path: 'tmp/artifacts/one.docx', kind: 'document' },
        { path: 'tmp/artifacts/two.csv', kind: 'spreadsheet' },
      ],
    })
    expect(turns[1]?.turn).toBe(3)
    expect(turns[1]?.messageId).toBe('a3')
    expect(turns[1]?.artifacts[0]?.path).toBe('deck.pptx')
  })

  it('assistantTurnOf:消息 id → 轮次;非 assistant / 未知 id → null', () => {
    expect(assistantTurnOf(MULTI_TURN, 'u1')).toBeNull()
    expect(assistantTurnOf(MULTI_TURN, 'a1')).toBe(1)
    expect(assistantTurnOf(MULTI_TURN, 'a2')).toBe(2)
    expect(assistantTurnOf(MULTI_TURN, 'a3')).toBe(3)
    expect(assistantTurnOf(MULTI_TURN, 'nope')).toBeNull()
  })

  it('artifactKindOf 四类判据随层迁移不变(docx/md/pptx/xlsx/csv/其余)', () => {
    expect(artifactKindOf('a.docx')).toBe('document')
    expect(artifactKindOf('a.md')).toBe('document')
    expect(artifactKindOf('a.pptx?token=1')).toBe('presentation')
    expect(artifactKindOf('a.XLSX')).toBe('spreadsheet')
    expect(artifactKindOf('a.csv')).toBe('spreadsheet')
    expect(artifactKindOf('noext')).toBe('file')
  })
})

describe('artifactTurnIndex(残余①:产物锚点 → 轮下标)', () => {
  it('同轮两产物各自解析到同一轮;跨轮产物解析到各自的轮;未知锚点 null', () => {
    const turns = collectArtifactTurns(MULTI_TURN)
    expect(artifactTurnIndex(turns, 'tmp/artifacts/one.docx')).toBe(0)
    expect(artifactTurnIndex(turns, 'tmp/artifacts/two.csv')).toBe(0)
    expect(artifactTurnIndex(turns, 'deck.pptx')).toBe(1)
    expect(artifactTurnIndex(turns, 'tmp/artifacts/three.pptx')).toBeNull()
    expect(artifactTurnIndex([], 'deck.pptx')).toBeNull()
  })

  it('无第二份映射:返回下标与 collectArtifactTurns 序列逐锚点自洽(命中即该轮含此产物)', () => {
    const turns = collectArtifactTurns(MULTI_TURN)
    const anchors = turns.flatMap((e) => e.artifacts.map((a) => a.path))
    for (const anchor of anchors) {
      const idx = artifactTurnIndex(turns, anchor)
      expect(idx, anchor).not.toBeNull()
      // 定义级复核:下标所指 entry 的产物集必须真的含该锚点(任何独立映射表
      // 一旦与本序列分叉,这里必红)
      expect(
        turns[idx as number]?.artifacts.some((a) => a.path === anchor),
        anchor,
      ).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
