/**
 * overview-summary 纯函数单元测试(2026-07-28 立,Phase 20 P1-2)
 *
 * 覆盖:
 * - buildOverviewSummaryMarkdown:空 / 满字段 / 中文 status / 错误 / token / rate / eta / context
 * - calcSessionDurationMs:正负数 / NaN
 * - formatStatusText: idle / running / completed / failed / interrupted
 * - buildStatLines:派生统计行
 */

import { describe, it, expect } from 'vitest'
import {
  buildOverviewSummaryMarkdown,
  calcSessionDurationMs,
  formatStatusText,
  buildStatLines,
  type OverviewShape,
} from '../src/components/ai/progress-sections/overview-summary'

const baseOverview: OverviewShape = {
  status: 'running',
  currentNode: null,
  plan: null,
  content: '',
  error: null,
  interruptEvent: null,
  sessionStart: '2026-07-28T10:00:00Z',
  totalSteps: 5,
  completedSteps: 3,
  inProgressSteps: 1,
  pendingSteps: 1,
  totalSubagents: 4,
  activeSubagents: 2,
  deadSubagents: 0,
  runningTerminals: 1,
  totalTerminals: 1,
  totalChanges: 6,
  historicalDurations: [],
  reconnectAttempt: 0,
}

describe('buildOverviewSummaryMarkdown', () => {
  it('包含任务总览标题 + 状态行', () => {
    const md = buildOverviewSummaryMarkdown({
      overview: baseOverview,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      nowMs: Date.parse('2026-07-28T10:05:00Z'),
    })
    expect(md).toContain('# 任务总览')
    expect(md).toContain('状态: 运行中')
  })

  it('isStreaming=true 时追加"(流式中)"', () => {
    const md = buildOverviewSummaryMarkdown({
      overview: baseOverview,
      isStreaming: true,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toContain('运行中 (流式中)')
  })

  it('status=failed 且有 error 时显示错误行', () => {
    const md = buildOverviewSummaryMarkdown({
      overview: { ...baseOverview, status: 'failed', error: '数据库连接失败' },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toContain('状态: 失败')
    expect(md).toContain('错误: 数据库连接失败')
  })

  it('包含步骤 / 子代理 / 终端 / 变更统计', () => {
    const md = buildOverviewSummaryMarkdown({
      overview: baseOverview,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toMatch(/步骤: 3\/5/)
    expect(md).toMatch(/子代理: 2 活跃 · 4 总/)
    expect(md).toMatch(/终端: 1 运行中 · 1 总/)
    expect(md).toMatch(/变更: 6 文件/)
  })

  it('totalTokens / tokenRate / etaMs / contextUsage 派生行', () => {
    const md = buildOverviewSummaryMarkdown({
      overview: baseOverview,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      totalTokens: 1500,
      tokenRate: 25,
      etaMs: 1234,
      contextUsage: 42,
    })
    expect(md).toContain('Token: 1.5k')
    expect(md).toContain('速率: 25/s')
    expect(md).toContain('预计:')
    expect(md).toContain('上下文: 42%')
  })

  it('空 overview 也能产出基础结构(无错误行)', () => {
    const empty: OverviewShape = {
      status: 'idle',
      currentNode: null,
      plan: null,
      content: '',
      error: null,
      interruptEvent: null,
      sessionStart: '2026-07-28T10:00:00Z',
      totalSteps: 0,
      completedSteps: 0,
      inProgressSteps: 0,
      pendingSteps: 0,
      totalSubagents: 0,
      activeSubagents: 0,
      deadSubagents: 0,
      runningTerminals: 0,
      totalTerminals: 0,
      totalChanges: 0,
      historicalDurations: [],
      reconnectAttempt: 0,
    }
    const md = buildOverviewSummaryMarkdown({
      overview: empty,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toContain('状态: 空闲')
    expect(md).not.toContain('错误:')
  })
})

describe('calcSessionDurationMs', () => {
  it('正常计算耗时(now > sessionStart)', () => {
    const ms = calcSessionDurationMs('2026-07-28T10:00:00Z', Date.parse('2026-07-28T10:05:30Z'))
    expect(ms).toBe(5 * 60 * 1000 + 30 * 1000)
  })

  it('now < sessionStart 返回 0(不回退负数)', () => {
    const ms = calcSessionDurationMs('2026-07-28T10:00:00Z', Date.parse('2026-07-28T09:59:00Z'))
    expect(ms).toBe(0)
  })

  it('无效 ISO 字符串返回 0', () => {
    const ms = calcSessionDurationMs('not-a-date', Date.parse('2026-07-28T10:00:00Z'))
    expect(ms).toBe(0)
  })
})

describe('formatStatusText', () => {
  it.each([
    ['idle', '空闲'],
    ['running', '运行中'],
    ['completed', '已完成'],
    ['failed', '失败'],
    ['interrupted', '已中断'],
  ])('status=%s 显示 %s', (s, label) => {
    expect(formatStatusText(s as OverviewShape['status'], false)).toBe(label)
  })

  it('streaming 时追加" (流式中)"', () => {
    expect(formatStatusText('running', true)).toBe('运行中 (流式中)')
  })
})

describe('buildStatLines', () => {
  it('空 totalSteps 时不输出步骤行', () => {
    const lines = buildStatLines({
      overview: { ...baseOverview, totalSteps: 0 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(lines.some((l) => l.startsWith('步骤'))).toBe(false)
  })

  it('deadSubagents > 0 时追加 "N 死亡"', () => {
    const lines = buildStatLines({
      overview: { ...baseOverview, deadSubagents: 2 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(lines.some((l) => l.includes('2 死亡'))).toBe(true)
  })

  it('totalChanges = 0 时不输出变更行', () => {
    const lines = buildStatLines({
      overview: { ...baseOverview, totalChanges: 0 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(lines.some((l) => l.startsWith('变更'))).toBe(false)
  })
})
