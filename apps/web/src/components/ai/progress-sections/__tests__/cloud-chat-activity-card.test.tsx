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

import {
  CloudChatActivityCard,
  CLOUD_CHAT_ACTIONS,
  CLOUD_CHAT_PHASES,
  type CloudChatEntry,
} from '../cloud-chat-activity-card'

// ─── next-intl mock:cloudChat 命名空间读**真实词包**(zh-CN),其余命名空间回退键名 ──

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const loadNs = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    cloudChat?: Record<string, unknown>
  }
  const node = parsed.cloudChat
  if (!node) throw new Error(`missing cloudChat in ${locale}.json`)
  return node
}

const zhNS = loadNs('zh-CN')

/**
 * 轻量 ICU 格式化(覆盖本词包两种形态:`{count/turns, plural, one {…} other {…}}`
 * 与 `{name}` 简单占位;不引入 @ihui/i18n —— 本环境该 workspace 链接缺失,既有
 * multi-agent-action-card.test.tsx 同因失败,与本改动无关)。
 */
const formatIcuLite = (pattern: string, values: Record<string, string | number>): string => {
  let out = pattern
  const m = /\{(\w+), plural,\s*([\s\S]*)\}\s*$/.exec(pattern)
  if (m && values[m[1]!] !== undefined) {
    const n = Number(values[m[1]!])
    const body = m[2] ?? ''
    const pick = (cat: string): string | null => {
      const re = new RegExp(`(?:^|\\s)${cat}\\s*\\{([^{}]*)\\}`)
      return re.exec(body)?.[1] ?? null
    }
    const text = n === 1 ? (pick('one') ?? pick('other')) : pick('other')
    if (text !== null) out = text.replace(/#/g, String(n))
  }
  return out.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''))
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

// ─── TimelineEventRow 注册可达性测试所需 mocks(对齐 multi-agent-action-card.test.tsx) ──
// 注:本环境 node_modules 缺 zustand / @ihui/i18n 链接(既有相关测试同因失败),
// 故 timeline-store 一并 mock;展开态用 vi.hoisted 容器预置,无需响应式。
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

const entry = (
  action: string,
  phase: string,
  extra?: Partial<CloudChatEntry>,
): CloudChatEntry => ({ action, phase, ...extra }) as CloudChatEntry

const ALL_MATRIX: readonly CloudChatEntry[] = CLOUD_CHAT_ACTIONS.flatMap((action) =>
  CLOUD_CHAT_PHASES.map((phase) => ({ action, phase })),
)

const renderCard = (entries: readonly CloudChatEntry[]) =>
  render(<CloudChatActivityCard entries={entries} data-testid="cca" />)

/** zh-CN 逐字预期(与台账 D97 原文对齐,防自创措辞) */
const ZH_TEXT: Record<string, Record<string, string>> = {
  attach: { active: '附加中', completed: '已附加', following: '等待附加' },
  create: { active: '创建中', completed: '已创建', following: '等待创建' },
  list: { active: '列出中', completed: '已列出', following: '等待列出' },
  readTurns: { active: '读取轮次中', completed: '已读取轮次', following: '等待读取' },
  sendMessage: { active: '发送中', completed: '已发送', following: '等待发送' },
}
const ZH_LABEL: Record<string, string> = {
  attach: '附加云端聊天',
  create: '创建云端聊天',
  list: '列出云端聊天',
  readTurns: '读取云端聊天轮次',
  sendMessage: '向云端聊天发送消息',
}

describe('D97 CloudChatActivityCard / 动作 × 三态矩阵(5×3 逐格)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('15 格全部渲染:5 个动作组 × 3 相位,逐格文案与台账原文一致', () => {
    const { container } = renderCard(ALL_MATRIX)
    expect(container.querySelectorAll('[data-action-group]').length).toBe(5)
    expect(container.querySelectorAll('[data-action-phase]').length).toBe(15)
    for (const action of CLOUD_CHAT_ACTIONS) {
      for (const phase of CLOUD_CHAT_PHASES) {
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
    expect(container.querySelector('[data-testid="cca"]')).toBeNull()
  })
})

describe('D97 CloudChatActivityCard / 组合式标题与上下文字段', () => {
  beforeEach(() => {
    cleanup()
  })

  it('混合相位 → 动作名 + count(附加云端聊天 2 个云端聊天)', () => {
    const { container } = renderCard([
      entry('attach', 'active'),
      entry('attach', 'completed'),
    ])
    expect(container.querySelector('[data-testid="cca-title"]')!.textContent).toBe(
      '附加云端聊天 2 个云端聊天',
    )
  })

  it('组内相位一致 active → 相位动词 + count(发送中 1 个云端聊天)', () => {
    const { container } = renderCard([entry('sendMessage', 'active')])
    expect(container.querySelector('[data-testid="cca-title"]')!.textContent).toBe(
      '发送中 1 个云端聊天',
    )
  })

  it('组内会话名唯一 → 标题走 {name} 占位(附加中 会话A)', () => {
    const { container } = renderCard([entry('attach', 'active', { session: '会话A' })])
    expect(container.querySelector('[data-testid="cca-title"]')!.textContent).toBe(
      '附加中 会话A',
    )
  })

  it('轮次数上下文渲染(12 轮),载荷缺失则不渲染', () => {
    const { container } = renderCard([entry('readTurns', 'completed', { session: 's', turns: 12 })])
    expect(container.textContent).toContain('12 轮')
    const { container: c2 } = renderCard([entry('readTurns', 'completed')])
    expect(c2.textContent).not.toMatch(/\d+ 轮/)
  })

  it('多动作分组:各组独立标题,组数正确', () => {
    const { container } = renderCard([
      entry('attach', 'active'),
      entry('attach', 'completed'),
      entry('create', 'following'),
      entry('list', 'completed'),
      entry('list', 'completed'),
    ])
    expect(container.querySelectorAll('[data-action-group]').length).toBe(3)
    const titles = [...container.querySelectorAll('[data-testid="cca-title"]')].map(
      (el) => el.textContent,
    )
    expect(titles).toEqual(['附加云端聊天 2 个云端聊天', '等待创建 1 个云端聊天', '已列出 2 个云端聊天'])
  })
})

describe('D97 CloudChatActivityCard / 三态样式语义', () => {
  beforeEach(() => {
    cleanup()
  })

  it('completed → emerald;active → muted + Loader2 spin;following → muted 弱化', () => {
    const { container } = renderCard([
      entry('attach', 'completed'),
      entry('attach', 'active'),
      entry('attach', 'following'),
    ])
    expect(container.querySelector('[data-action-phase="completed"]')!.className).toContain(
      'text-emerald-600',
    )
    expect(container.querySelector('[data-action-phase="active"]')!.className).toContain(
      'text-muted-foreground',
    )
    expect(container.querySelector('[data-action-phase="following"]')!.className).toContain(
      'text-muted-foreground/50',
    )
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('无 active 行 → 不渲染 spin 图标', () => {
    const { container } = renderCard([entry('attach', 'completed')])
    expect(container.querySelector('.animate-spin')).toBeNull()
  })
})

describe('D97 词包覆盖(读真实词包,五语言)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  it('五语言键集完全一致(parity),19 键全齐', () => {
    const expected = [
      'header.count',
      'header.target',
      'turns',
      ...CLOUD_CHAT_ACTIONS.flatMap((a) => [
        `action.${a}.label`,
        ...CLOUD_CHAT_PHASES.map((p) => `action.${a}.${p}`),
      ]),
    ].sort()
    const base = flat(loadNs('zh-CN')).sort()
    expect(base).toEqual(expected)
    for (const locale of LOCALES) {
      expect(flat(loadNs(locale)).sort(), locale).toEqual(base)
    }
  })

  it('header.count / turns 含 ICU plural 占位(五语言)', () => {
    for (const locale of LOCALES) {
      const ns = loadNs(locale) as { header: { count: string }; turns: string }
      expect(ns.header.count, locale).toContain('{count, plural')
      expect(ns.turns, locale).toContain('{turns, plural')
    }
  })

  it('zh-CN 文案与台账原文逐字一致(防自创措辞)', () => {
    const ns = zhNS as { action: Record<string, Record<string, string>> }
    for (const action of CLOUD_CHAT_ACTIONS) {
      for (const phase of CLOUD_CHAT_PHASES) {
        expect(ns.action[action]![phase], `${action}.${phase}`).toBe(ZH_TEXT[action]![phase])
      }
      expect(ns.action[action]!.label).toBe(ZH_LABEL[action])
    }
  })
})

// ─── 时间线 registry 注册可达(timeline-event.tsx 最小接入 hunk) ──────────

const baseEvent = {
  id: 'event-cc',
  type: 'subagent' as const,
  timestamp: new Date().toISOString(),
  title: '云端聊天互操作',
  status: 'running' as const,
}

describe('D97 CloudChatActivityCard / 时间线注册可达', () => {
  beforeEach(() => {
    cleanup()
    timelineState.expandedIds.length = 0
  })

  it('meta.cloudChatActivity 载荷 → 行可展开,展开区渲染云端聊天活动卡', async () => {
    // 预置展开态(mock 的 store 非响应式,初始 render 即展开)
    timelineState.expandedIds.push('event-cc')
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: {
            cloudChatActivity: [
              { action: 'attach', phase: 'active', session: '会话A' },
              { action: 'attach', phase: 'completed', session: '会话B' },
              { action: 'sendMessage', phase: 'completed', session: '会话A', turns: 3 },
            ],
          },
        }}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('timeline-event-row')).toBeTruthy())
    // 载荷存在 + 已展开 ⇒ 展开区直接渲染云端聊天活动卡(isExpandable 含 cloudChatEntries 分支)
    const card = await waitFor(() => screen.getByTestId('timeline-cloud-chat-activity-card'))
    expect(card).toBeTruthy()
    expect(card.querySelectorAll('[data-action-group]').length).toBe(2)
    expect(card.textContent).toContain('附加中')
    expect(card.textContent).toContain('3 轮')
  })

  it('非法载荷(未知动作/相位/非条目)整条丢弃,不渲染卡也不崩', async () => {
    render(
      <TimelineEventRow
        event={{
          ...baseEvent,
          meta: {
            cloudChatActivity: [
              { action: 'explode', phase: 'active', session: 'x' },
              { action: 'attach', phase: 'flying', session: 'x' },
              { action: 'create', phase: 'active', session: 42 },
              'garbage',
            ],
          },
        }}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('timeline-event-row')).toBeTruthy())
    expect(screen.queryByTestId('timeline-cloud-chat-activity-card')).toBeNull()
  })
})
