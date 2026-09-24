// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AGENT_ACTIONS, AGENT_ACTION_PHASES } from '@ihui/shared/chat'

import { MultiAgentActionCard, type MultiAgentActionEntry } from '../multi-agent-action-card'

// ─── next-intl mock:multiAgentAction 命名空间读**真实词包**(zh-CN),其余命名空间回退键名 ──

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const loadNs = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    multiAgentAction?: Record<string, unknown>
  }
  const node = parsed.multiAgentAction
  if (!node) throw new Error(`missing multiAgentAction in ${locale}.json`)
  return node
}

const zhNS = loadNs('zh-CN')

/**
 * 轻量 ICU plural 格式化(仅覆盖本词包形态 `{count, plural, one {…} other {…}}`
 * 与 `#` 占位;不引入 @ihui/i18n —— 本环境该 workspace 链接缺失,既有
 * timeline-event.test.tsx 同因失败,与本改动无关)。
 */
const formatIcuLite = (pattern: string, values: Record<string, string | number>): string => {
  const count = typeof values.count === 'number' ? values.count : Number(values.count)
  const m = /\{count, plural,\s*([\s\S]*)\}\s*$/.exec(pattern)
  if (!m) return pattern
  const body = m[1] ?? ''
  const pick = (cat: string): string | null => {
    const re = new RegExp(`(?:^|\\s)${cat}\\s*\\{([^{}]*)\\}`)
    return re.exec(body)?.[1] ?? null
  }
  const text = count === 1 ? (pick('one') ?? pick('other')) : pick('other')
  return (text ?? '').replace('#', String(count))
}

const lookup = (key: string): string => {
  let cur: unknown = zhNS
  for (const seg of key.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg]
    } else {
      return key
    }
  }
  return typeof cur === 'string' ? cur : key
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? formatIcuLite(lookup(key), values) : lookup(key),
}))

// ─── TimelineEventRow 注册可达性测试所需 mocks(对齐 timeline-event.test.tsx) ──
// 注:本环境 node_modules 缺 zustand / @ihui/i18n 链接(既有相关测试同因失败),
// 故 timeline-store 一并 mock;展开态用 vi.hoisted 容器预置,无需响应式。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: (selector: (state: { workspacePath: string }) => string) =>
    selector({ workspacePath: 'G:/repo' }),
}))
vi.mock('@ihui/api-client', () => ({
  rollbackCheckpoint: vi.fn(async () => ({ success: true, data: { rolled: true } })),
}))

const timelineState = vi.hoisted(() => ({
  expandedIds: [] as string[],
}))

vi.mock('@/stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: unknown) => unknown) =>
    selector({
      expandedEventIds: timelineState.expandedIds,
      toggleExpanded: (id: string) => {
        timelineState.expandedIds.push(id)
      },
    }),
}))

import { TimelineEventRow } from '../timeline-event'

const entry = (action: string, phase: string, agent = 'scout'): MultiAgentActionEntry =>
  ({ action, phase, agent }) as MultiAgentActionEntry

const ALL_MATRIX: readonly MultiAgentActionEntry[] = AGENT_ACTIONS.flatMap((action) =>
  AGENT_ACTION_PHASES.map((phase) => ({ action, phase, agent: `${action}-${phase}` })),
)

const renderCard = (entries: readonly MultiAgentActionEntry[]) =>
  render(<MultiAgentActionCard entries={entries} data-testid="mac" />)

/** zh-CN 逐字预期(与台账原文对齐,防自创措辞) */
const ZH_TEXT: Record<string, Record<string, string>> = {
  spawn: { inProgress: '创建中', completed: '已创建', failed: '创建失败' },
  resume: { inProgress: '恢复中', completed: '已恢复', failed: '恢复失败' },
  sendInput: { inProgress: '发送中', completed: '已发送', failed: '发送失败' },
  interrupt: { inProgress: '正在中断', completed: '已中断', failed: '中断未成功' },
  close: { inProgress: '正在关闭', completed: '已关闭', failed: '无法关闭' },
  list: { inProgress: '加载中', completed: '已加载', failed: '加载失败' },
}
const ZH_LABEL: Record<string, string> = {
  spawn: '创建',
  resume: '恢复',
  sendInput: '发送输入',
  interrupt: '中断',
  close: '关闭',
  list: '列出',
}

describe('D103 MultiAgentActionCard / 动作 × 三态矩阵(6×3 逐格)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('18 格全部渲染:6 个动作组 × 3 相位,逐格文案与台账原文一致', () => {
    const { container } = renderCard(ALL_MATRIX)
    expect(container.querySelectorAll('[data-action-group]').length).toBe(6)
    expect(container.querySelectorAll('[data-action-phase]').length).toBe(18)
    for (const action of AGENT_ACTIONS) {
      for (const phase of AGENT_ACTION_PHASES) {
        const cell = container.querySelector(
          `[data-action-group="${action}"] [data-action-phase="${phase}"]`,
        )
        expect(cell, `${action}.${phase}`).not.toBeNull()
        expect(cell!.textContent).toBe(ZH_TEXT[action]![phase])
      }
    }
  })

  it('空 entries → 不渲染(返回 null)', () => {
    const { container } = renderCard([])
    expect(container.querySelector('[data-testid="mac"]')).toBeNull()
  })
})

describe('D103 MultiAgentActionCard / 组合式标题与 count 模板', () => {
  beforeEach(() => {
    cleanup()
  })

  it('混合相位 → 动作名 + count(创建 3 个智能体)', () => {
    const { container } = renderCard([
      entry('spawn', 'inProgress'),
      entry('spawn', 'completed'),
      entry('spawn', 'failed'),
    ])
    const title = container.querySelector('[data-testid="mac-title"]')!
    expect(title.textContent).toBe('创建 3 个智能体')
  })

  it('组内相位一致 inProgress → 相位动词(正在中断 2 个智能体)', () => {
    const { container } = renderCard([
      entry('interrupt', 'inProgress', 'a'),
      entry('interrupt', 'inProgress', 'b'),
    ])
    expect(container.querySelector('[data-testid="mac-title"]')!.textContent).toBe(
      '正在中断 2 个智能体',
    )
  })

  it('count=1 走 ICU one 分支(中断未成功 1 个智能体)', () => {
    const { container } = renderCard([entry('interrupt', 'failed')])
    expect(container.querySelector('[data-testid="mac-title"]')!.textContent).toBe(
      '中断未成功 1 个智能体',
    )
  })

  it('组内相位一致 completed → 相位动词(已关闭 1 个智能体)', () => {
    const { container } = renderCard([entry('close', 'completed')])
    expect(container.querySelector('[data-testid="mac-title"]')!.textContent).toBe(
      '已关闭 1 个智能体',
    )
  })

  it('多动作分组:各组独立标题,组数正确', () => {
    const { container } = renderCard([
      entry('spawn', 'inProgress'),
      entry('spawn', 'completed'),
      entry('close', 'failed'),
      entry('list', 'completed', 'a'),
      entry('list', 'completed', 'b'),
    ])
    expect(container.querySelectorAll('[data-action-group]').length).toBe(3)
    const titles = [...container.querySelectorAll('[data-testid="mac-title"]')].map(
      (el) => el.textContent,
    )
    expect(titles).toEqual(['创建 2 个智能体', '无法关闭 1 个智能体', '已加载 2 个智能体'])
  })

  it('count 模板是 ICU plural(词包含 {count, plural},count=1/>1 渲染数字)', () => {
    const raw = zhNS.header as { count: string }
    expect(raw.count).toContain('{count, plural')
    const { container } = renderCard([entry('spawn', 'inProgress'), entry('spawn', 'completed')])
    expect(container.textContent).toContain('2 个智能体')
  })
})

describe('D103 MultiAgentActionCard / 三态样式语义', () => {
  beforeEach(() => {
    cleanup()
  })

  it('failed → text-destructive(可辨识不刺眼,与时间线失败语义同源)', () => {
    const { container } = renderCard([entry('close', 'failed')])
    const el = container.querySelector('[data-action-phase="failed"]')!
    expect(el.className).toContain('text-destructive')
  })

  it('completed → emerald;inProgress → muted + Loader2 spin', () => {
    const { container } = renderCard([entry('spawn', 'completed'), entry('spawn', 'inProgress')])
    expect(container.querySelector('[data-action-phase="completed"]')!.className).toContain(
      'text-emerald-600',
    )
    expect(container.querySelector('[data-action-phase="inProgress"]')!.className).toContain(
      'text-muted-foreground',
    )
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('无 inProgress 行 → 不渲染 spin 图标', () => {
    const { container } = renderCard([entry('spawn', 'completed')])
    expect(container.querySelector('.animate-spin')).toBeNull()
  })
})

describe('D103 词包覆盖(读真实词包,五语言)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  it('五语言键集完全一致(parity),25 键全齐', () => {
    const expected = [
      'header.count',
      ...AGENT_ACTIONS.flatMap((a) => [
        `action.${a}.label`,
        ...AGENT_ACTION_PHASES.map((p) => `action.${a}.${p}`),
      ]),
    ].sort()
    const base = flat(loadNs('zh-CN')).sort()
    expect(base).toEqual(expected)
    for (const locale of LOCALES) {
      expect(flat(loadNs(locale)).sort(), locale).toEqual(base)
    }
  })

  it('header.count 含 {count} ICU plural 占位(五语言)', () => {
    for (const locale of LOCALES) {
      const count = (loadNs(locale).header as { count: string }).count
      expect(count, locale).toContain('{count, plural')
      expect(count, locale).toContain('#')
    }
  })

  it('zh-CN 文案与台账原文逐字一致(防自创措辞)', () => {
    const ns = loadNs('zh-CN') as {
      action: Record<string, Record<string, string>>
    }
    for (const action of AGENT_ACTIONS) {
      for (const phase of AGENT_ACTION_PHASES) {
        expect(ns.action[action]![phase], `${action}.${phase}`).toBe(ZH_TEXT[action]![phase])
      }
      expect(ns.action[action]!.label).toBe(ZH_LABEL[action])
    }
  })
})

// ─── 时间线 registry 注册可达(timeline-event.tsx 最小接入 hunk) ──────────

const baseEvent = {
  id: 'event-ma',
  type: 'subagent' as const,
  timestamp: new Date().toISOString(),
  title: '批量动作',
  status: 'running' as const,
}

describe('D103 MultiAgentActionCard / 时间线注册可达', () => {
  beforeEach(() => {
    cleanup()
    timelineState.expandedIds.length = 0
  })

  it('meta.multiAgentAction 载荷 → 行可展开,展开区渲染批量动作卡', async () => {
    // 预置展开态(mock 的 store 非响应式,初始 render 即展开)
    timelineState.expandedIds.push('event-ma')
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: {
            multiAgentAction: [
              { action: 'spawn', phase: 'inProgress', agent: 'scout' },
              { action: 'spawn', phase: 'completed', agent: 'builder' },
              { action: 'interrupt', phase: 'failed', agent: 'runner' },
            ],
          },
        }}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('timeline-event-row')).toBeTruthy())
    // 载荷存在 + 已展开 ⇒ 展开区直接渲染批量动作卡(isExpandable 含 actionEntries 分支)
    const card = await waitFor(() => screen.getByTestId('timeline-multi-agent-action-card'))
    expect(card).toBeTruthy()
    expect(card.querySelectorAll('[data-action-group]').length).toBe(2)
    expect(card.textContent).toContain('创建 2 个智能体')
    expect(card.textContent).toContain('中断未成功 1 个智能体')
  })

  it('非法载荷(未知动作/相位/缺 agent)整条丢弃,不渲染卡也不崩', async () => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: {
            multiAgentAction: [
              { action: 'explode', phase: 'inProgress', agent: 'x' },
              { action: 'spawn', phase: 'flying', agent: 'x' },
              { action: 'close', phase: 'failed' },
              'garbage',
            ],
          },
        }}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('timeline-event-row')).toBeTruthy())
    expect(screen.queryByTestId('timeline-multi-agent-action-card')).toBeNull()
  })
})
