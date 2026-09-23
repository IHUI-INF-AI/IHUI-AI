// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * overview-summary 纯函数单元测试(2026-07-28 立,Phase 20 P1-2)
 *
 * 覆盖:
 * - buildOverviewSummaryMarkdown:空 / 满字段 / 中文 status / 错误 / token / rate / eta / context
 * - calcSessionDurationMs:正负数 / NaN
 * - formatStatusText: idle / running / completed / failed / interrupted
 * - buildStatLines:派生统计行
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  buildOverviewSummaryMarkdown,
  calcSessionDurationMs,
  formatStatusText,
  buildStatLines,
  STATUS_LABEL_KEY,
  STATUS_LABEL_STREAMING_KEY,
  type OverviewShape,
  type OverviewSummaryInput,
  type Translator,
} from '../src/components/ai/progress-sections/overview-summary'

/** 仓库根:从 cwd 上溯到 pnpm-workspace.yaml(vitest 下 import.meta.url 是 /@fs/ 虚拟路径,不可用于 fs) */
function findRepoRoot(start: string): string {
  let dir = resolve(start)
  while (dir !== resolve(dir, '..')) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = resolve(dir, '..')
  }
  throw new Error(`未找到仓库根(pnpm-workspace.yaml),起点 ${start}`)
}
const REPO_ROOT = findRepoRoot(process.cwd())

/** 语言包真实取词(缺键即抛,不允许静默回退) */
function makeTranslator(locale: 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'): Translator {
  const messages = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/i18n/messages/web', `${locale}.json`), 'utf8'),
  ) as Record<string, unknown>
  return (rawKey: string) => {
    // 组件侧 useTranslations('ai.pane') 会自动补前缀,这里等价地锚定同一命名空间
    const value = ['ai', 'pane', ...rawKey.split('.')].reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      messages,
    )
    if (typeof value !== 'string') throw new Error(`[${locale}] 缺失语言包键: ai.pane.${rawKey}`)
    return value
  }
}
const tZh = makeTranslator('zh-CN')

/** overview 标签键清单(与语言包 ai.pane.overview.* 已落好的键一一对应,不含状态键) */
const OVERVIEW_LABEL_KEYS = [
  'overview.title',
  'overview.status',
  'overview.error',
  'overview.steps',
  'overview.subagents',
  'overview.active',
  'overview.total',
  'overview.dead',
  'overview.terminals',
  'overview.running',
  'overview.changes',
  'overview.files',
  'overview.duration',
  'overview.token',
  'overview.rate',
  'overview.eta',
  'overview.context',
] as const

/**
 * 探针式恒等 translator:key→键名原样回显,并记录每个真实被取词的键。
 * - 任何标签回退硬编码中文 → 输出与键名字面量断言不符 + seen 集合缺键,双双变红;
 * - 拼错键 / 未知键 → 立即抛错。以此证明"每键都真的走了取词链路"。
 */
function makeProbeTranslator(): { t: Translator; seen: Set<string> } {
  const seen = new Set<string>()
  const known = new Set<string>([
    ...OVERVIEW_LABEL_KEYS,
    ...Object.values(STATUS_LABEL_KEY),
    ...Object.values(STATUS_LABEL_STREAMING_KEY),
  ])
  const t: Translator = (key) => {
    if (!known.has(key)) throw new Error(`探针 translator 收到未知键: ${key}`)
    seen.add(key)
    return key
  }
  return { t, seen }
}

/** 组件侧注入 translator 后,Markdown 序列化入口的测试包装 */
function mdZh(input: Omit<OverviewSummaryInput, 't'>): string {
  return buildOverviewSummaryMarkdown({ ...input, t: tZh })
}

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
    const md = mdZh({
      overview: baseOverview,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      nowMs: Date.parse('2026-07-28T10:05:00Z'),
    })
    expect(md).toContain('# 任务总览')
    expect(md).toContain('状态: 运行中')
    expect(md).toContain('耗时: 5.0m')
  })

  it('isStreaming=true 时追加"(流式中)"', () => {
    const md = mdZh({
      overview: baseOverview,
      isStreaming: true,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toContain('运行中 (流式中)')
  })

  it('status=failed 且有 error 时显示错误行', () => {
    const md = mdZh({
      overview: { ...baseOverview, status: 'failed', error: '数据库连接失败' },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toContain('状态: 失败')
    expect(md).toContain('错误: 数据库连接失败')
  })

  it('包含步骤 / 子代理 / 终端 / 变更统计', () => {
    const md = mdZh({
      overview: baseOverview,
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
    })
    expect(md).toMatch(/步骤: 3\/5/)
    expect(md).toMatch(/子代理: 2 活跃 · 4 总/)
    expect(md).toMatch(/终端: 1 运行 · 1 总/)
    expect(md).toMatch(/变更: 6 文件/)
  })

  it('totalTokens / tokenRate / etaMs / contextUsage 派生行', () => {
    const md = mdZh({
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
    const md = mdZh({
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

type OverviewStatus = keyof typeof STATUS_LABEL_KEY
const ALL_STATUSES = Object.keys(STATUS_LABEL_KEY) as OverviewStatus[]

describe('formatStatusText', () => {
  it.each([
    ['idle', '空闲'],
    ['running', '运行中'],
    ['completed', '已完成'],
    ['failed', '失败'],
    ['interrupted', '已中断'],
  ])('status=%s 显示 %s(文案由注入的 translator 取键)', (s, label) => {
    expect(formatStatusText(s as OverviewStatus, false, tZh)).toBe(label)
  })

  it('streaming 走整键,输出与改造前的拼接结果逐字节等价', () => {
    for (const status of ALL_STATUSES) {
      const plain = formatStatusText(status, false, tZh)
      expect(formatStatusText(status, true, tZh)).toBe(`${plain} (流式中)`)
    }
  })
})

/**
 * i18n 静态 + 动态断言(2026-09-22 立,硬编码中文改造配套)
 * 键清单从源码动态解析(STATUS_LABEL_KEY / STATUS_LABEL_STREAMING_KEY),不在此复制。
 */
describe('overview-summary 状态键表', () => {
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/

  it('静态:键表值只存键名,不含任何 CJK 展示文案', () => {
    const tables: Array<[string, Record<OverviewStatus, string>]> = [
      ['STATUS_LABEL_KEY', STATUS_LABEL_KEY],
      ['STATUS_LABEL_STREAMING_KEY', STATUS_LABEL_STREAMING_KEY],
    ]
    for (const [name, table] of tables) {
      expect(ALL_STATUSES).toHaveLength(Object.keys(table).length)
      for (const status of ALL_STATUSES) {
        const key = table[status]
        expect(key, `${name}.${status}`).toMatch(/^overview\.status[A-Z]/)
        expect(CJK.test(key), `${name}.${status}=${key} 含 CJK`).toBe(false)
      }
    }
  })

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const)(
    '动态:%s 下每个状态键都能解析到非空文案',
    (locale) => {
      const t = makeTranslator(locale)
      for (const table of [STATUS_LABEL_KEY, STATUS_LABEL_STREAMING_KEY]) {
        for (const key of Object.values(table)) {
          expect(t(key).trim().length, `${locale} ${key}`).toBeGreaterThan(0)
        }
      }
    },
  )
})

describe('buildStatLines', () => {
  it('空 totalSteps 时不输出步骤行', () => {
    const { t } = makeProbeTranslator()
    const lines = buildStatLines({
      overview: { ...baseOverview, totalSteps: 0 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      t,
    })
    expect(lines.some((l) => l.includes('overview.steps'))).toBe(false)
  })

  it('deadSubagents > 0 时追加 "N <dead>"(探针键名回显,硬编码中文会因不匹配变红)', () => {
    const { t, seen } = makeProbeTranslator()
    const lines = buildStatLines({
      overview: { ...baseOverview, deadSubagents: 2 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      t,
    })
    expect(lines.some((l) => l.includes(`2 ${t('overview.dead')}`))).toBe(true)
    expect(seen.has('overview.dead')).toBe(true)
  })

  it('totalChanges = 0 时不输出变更行', () => {
    const { t } = makeProbeTranslator()
    const lines = buildStatLines({
      overview: { ...baseOverview, totalChanges: 0 },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      t,
    })
    expect(lines.some((l) => l.includes('overview.changes'))).toBe(false)
  })
})

/**
 * 接线证明(2026-09-23 立,统计行取词改造配套):
 * 用探针 translator 驱动全字段渲染,逐行断言"标签=键名字面量",
 * 并核对本应取词的全部标签键确实被取过 —— 任何一行回退硬编码中文都会变红。
 */
describe('overview 标签取词接线', () => {
  it('探针自身可信:未知键必须抛错', () => {
    const { t } = makeProbeTranslator()
    expect(() => t('overview.notARealKey')).toThrow(/未知键/)
  })

  it('全字段渲染:每一行标签均经 t 取词,Markdown 骨架结构与改造前一致', () => {
    const { t, seen } = makeProbeTranslator()
    const md = buildOverviewSummaryMarkdown({
      overview: { ...baseOverview, deadSubagents: 1, error: 'boom from backend' },
      isStreaming: false,
      sessionStart: '2026-07-28T10:00:00Z',
      nowMs: Date.parse('2026-07-28T10:05:00Z'),
      totalTokens: 1500,
      tokenRate: 25,
      etaMs: 1234,
      contextUsage: 42,
      t,
    })
    expect(md).toContain('# overview.title')
    expect(md).toContain(`- overview.status: ${STATUS_LABEL_KEY.running}`)
    expect(md).toContain('- overview.error: boom from backend')
    expect(md).toContain('- overview.steps: 3/5')
    expect(md).toContain(
      '- overview.subagents: 2 overview.active · 4 overview.total · 1 overview.dead',
    )
    expect(md).toContain('- overview.terminals: 1 overview.running · 1 overview.total')
    expect(md).toContain('- overview.changes: 6 overview.files')
    expect(md).toContain('- overview.duration: 5.0m')
    expect(md).toContain('- overview.token: 1.5k')
    expect(md).toContain('- overview.rate: 25/s')
    expect(md).toContain('- overview.eta: 1.2s')
    expect(md).toContain('- overview.context: 42%')
    // 17 个标签键 + 1 个状态键全部被取词,一个不漏
    expect([...seen].sort()).toEqual([...OVERVIEW_LABEL_KEYS, STATUS_LABEL_KEY.running].sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
