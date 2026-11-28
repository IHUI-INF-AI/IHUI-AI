// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type { AiWorldLeaderboardOrRow } from '@ihui/types'
import {
  buildAuthoritativeLeaderboard,
  parseLmarenaRows,
  parseOpenRouterCsv,
  type AaRawModel,
  type AuthoritativeSourceBundle,
  type LmarenaEntry,
} from '../authoritative-leaderboard.js'

function lmRow(
  model: string,
  rank: number,
  score: number,
  votes: number,
  category = 'overall',
  date = '2026-11-01',
): Record<string, unknown> {
  return {
    model_name: model,
    organization: 'Test Labs',
    license: 'Proprietary',
    rating: score,
    rating_lower: score - 5,
    rating_upper: score + 5,
    vote_count: votes,
    rank,
    category,
    leaderboard_publish_date: date,
  }
}

function lmEntry(model: string, rank: number, score: number): LmarenaEntry {
  return {
    model,
    vendor: 'Test Labs',
    score,
    ci: 5,
    ciLow: score - 5,
    ciHigh: score + 5,
    variance: 10,
    votes: 1000 - rank,
    license: 'Proprietary',
    open: false,
    rank,
    category: 'overall',
    date: '2026-11-01',
  }
}

function orRow(rank: number, model: string, tokens: number): AiWorldLeaderboardOrRow {
  return {
    rank,
    model,
    vendor: 'Test Labs',
    tokens,
    share: tokens / 1_000_000,
    slug: `test/${model.toLowerCase().replace(/\s+/g, '-')}-20260101`,
    build: '20260101',
    free: false,
  }
}

describe('parseLmarenaRows', () => {
  it('只取最新发布日期，并按总榜/中文榜分别计数与汇总票数', () => {
    const rows: Record<string, unknown>[] = []
    for (let i = 1; i <= 105; i += 1) {
      rows.push(lmRow(`Model ${i} (High)`, i, 1500 - i, 100 + i))
    }
    rows.push(lmRow('Old Model (High)', 1, 1400, 999, 'overall', '2026-10-01'))
    for (let i = 1; i <= 3; i += 1) {
      rows.push(lmRow(`中文模型 ${i} (High)`, i, 1600 - i, 10 + i, 'chinese'))
    }
    const parsed = parseLmarenaRows(rows)
    expect(parsed.asOf).toBe('2026-11-01')
    expect(parsed.overallCount).toBe(105)
    expect(parsed.chineseCount).toBe(3)
    expect(parsed.overall.some((row) => row.model === 'Old Model (High)')).toBe(false)
    expect(parsed.overallVotes).toBeGreaterThan(0)
    expect(parsed.chineseVotes).toBe(36)
  })
})

describe('parseOpenRouterCsv', () => {
  it('按最新日期回溯 7 天，聚合家族并单独统计 other', () => {
    const csv = [
      'date,model_permaslug,rank,total_tokens,share_of_daily_tokens',
      '2026-11-19,test/old-model-20260101,1,990000,0.9',
      '2026-11-20,test/model-a-20260101,1,10,0.1',
      '2026-11-26,test/model-a-20260101,1,20,0.4',
      '2026-11-26,test/model-b-20260101,2,5,0.1',
      '2026-11-26,other,,3,0.5',
    ].join('\n')
    const parsed = parseOpenRouterCsv(csv)
    expect(parsed.startDate).toBe('2026-11-19')
    expect(parsed.endDate).toBe('2026-11-26')
    expect(parsed.totalTokens).toBe(990038)
    expect(parsed.rows.map((row) => row.model)).toEqual(['Old Model', 'Model A', 'Model B'])
    expect(parsed.rows[1]?.tokens).toBe(30)
    expect(parsed.otherShare).toBeCloseTo(3 / 990038, 4)
  })
})

describe('buildAuthoritativeLeaderboard', () => {
  it('三个官方源都能进入综合位次，且输出动态榜规模与刷新口径', () => {
    const overall: LmarenaEntry[] = []
    const chinese: LmarenaEntry[] = []
    for (let i = 1; i <= 30; i += 1) {
      overall.push(lmEntry(`Model ${i}`, i, 1500 - i))
    }
    for (let i = 1; i <= 5; i += 1) {
      chinese.push(lmEntry(`中文模型 ${i}`, i, 1600 - i))
    }
    const aaModels: AaRawModel[] = []
    for (let i = 1; i <= 30; i += 1) {
      aaModels.push({
        name: `Model ${i} (Max)`,
        modelCreatorName: 'Test Labs',
        intelligenceIndex: 100 - i,
        isOpenWeights: i % 2 === 0,
      })
    }
    aaModels.push({
      name: 'Model 1 (Fast)',
      modelCreatorName: 'Test Labs',
      intelligenceIndex: 1,
      isOpenWeights: true,
    })
    aaModels[0] = {
      ...aaModels[0],
      isReasoning: true,
      contextWindowTokens: 1_000_000,
      price1mInputTokens: 2,
      price1mOutputTokens: 10,
      outputSpeed: 120,
      timeToFirstToken: 3,
      omniscience: 50,
      paramClass: 'large',
      scores: { 'gpqa-diamond': 0.7, 'aa-briefcase': 1600 },
    }

    const bundle: AuthoritativeSourceBundle = {
      lmarena: {
        asOf: '2026-11-01',
        overall,
        chinese,
        overallVotes: 123456,
        chineseVotes: 1234,
        overallCount: 30,
        chineseCount: 5,
        categories: [
          { id: 'overall', label: '总榜', rows: overall, votes: 123456, count: 30 },
          { id: 'chinese', label: '中文', rows: chinese, votes: 1234, count: 5 },
        ],
      },
      aa: { asOf: '2026-11-02', models: aaModels },
      openrouter: {
        asOf: '2026-11-03',
        startDate: '2026-10-28',
        endDate: '2026-11-03',
        totalTokens: 1_000_000,
        otherShare: 0.1,
        rows: Array.from({ length: 30 }, (_, index) =>
          orRow(index + 1, `Model ${index + 1}`, 1_000_000 - index),
        ),
      },
    }

    const payload = buildAuthoritativeLeaderboard(bundle, {
      generatedAt: '2026-11-03T00:00:00.000Z',
    })
    expect(payload.cross).toHaveLength(30)
    expect(payload.cross[0]?.model).toBe('Model 1')
    expect(payload.cross[0]?.coverage).toBe(3)
    expect(payload.lmarena.overallCount).toBe(30)
    expect(payload.lmarena.chineseCount).toBe(5)
    expect(payload.sources.find((source) => source.id === 'aa')?.boardSize).toBe(30)
    expect(payload.sources.find((source) => source.id === 'openrouter')?.boardSize).toBe(30)
    expect(payload.refresh.schedule).toMatch(/^\d/)
    expect(payload.schemaVersion).toBe(3)
    expect(payload.overallAll).toHaveLength(30)
    expect(payload.overallAll[0]?.coverage).toBe(3)
    expect(payload.overallAll[0]?.averagePercentile).toBe(100)

    // AA 全量字段必须真的接到契约里，不能只接一个 intelligenceIndex。
    expect(payload.aa[0]?.contextWindow).toBe(1_000_000)
    expect(payload.aa[0]?.inputPrice).toBe(2)
    expect(payload.aa[0]?.outputSpeed).toBe(120)
    expect(payload.aa[0]?.ttft).toBe(3)
    expect(payload.aa[0]?.omniscience).toBe(50)
    expect(payload.aa[0]?.benchmarks?.find((b) => b.key === 'gpqa-diamond')?.score).toBe(70)
    expect(payload.aa[0]?.benchmarks?.find((b) => b.key === 'aa-briefcase')?.unit).toBe('raw')
    expect(payload.lmarena.categories).toHaveLength(2)
    expect(payload.openrouter).toHaveLength(30)
    expect(payload.boards?.[0]?.id).toBe('aa-variants')
    expect(payload.boards?.[0]?.boardSize).toBeGreaterThanOrEqual(30)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
