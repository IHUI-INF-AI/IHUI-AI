// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import React from 'react'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  CLOUD_CHAT_OPS,
  CLOUD_CHAT_OP_PHASES,
  cloudChatOpMatrixKeys,
} from '@ihui/shared/chat/cloud-chat-ops'

import { CloudChatOpsCard, type CloudChatOpEntry } from '../cloud-chat-ops-card'

// ─── next-intl mock:ai.pane.cloudChatOps 命名空间读**真实词包**(zh-CN) ──

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const loadNs = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    ai?: { pane?: { cloudChatOps?: Record<string, unknown> } }
  }
  const node = parsed.ai?.pane?.cloudChatOps
  if (!node) throw new Error(`missing ai.pane.cloudChatOps in ${locale}.json`)
  return node
}

const loadPane = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    ai?: { pane?: Record<string, unknown> }
  }
  if (!parsed.ai?.pane) throw new Error(`missing ai.pane in ${locale}.json`)
  return parsed.ai.pane
}

const zhNS = loadNs('zh-CN')

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
  useTranslations: () => (key: string) => lookup(key),
}))

const entry = (op: string, phase: string, target?: string): CloudChatOpEntry =>
  ({ op, phase, target }) as CloudChatOpEntry

const ALL_MATRIX: readonly CloudChatOpEntry[] = CLOUD_CHAT_OPS.flatMap((op) =>
  CLOUD_CHAT_OP_PHASES.map((phase) => entry(op, phase)),
)

const renderCard = (entries: readonly CloudChatOpEntry[]) =>
  render(<CloudChatOpsCard entries={entries} data-testid="cco" />)

/** zh-CN 逐字预期(与任务原文对齐,防自创措辞) */
const ZH_LABEL: Record<string, string> = {
  attachCloudChat: '附加云端聊天',
  createCloudChat: '创建云端聊天',
  listCloudChats: '列出云端聊天',
  readCloudChatTurns: '读取云端聊天轮次',
  sendToCloudChat: '向云端聊天发送消息',
}
const ZH_CELL: Record<string, Record<string, string>> = {
  attachCloudChat: { active: '附加中', completed: '已附加', following: '等待附加' },
  createCloudChat: { active: '创建中', completed: '已创建', following: '等待创建' },
  listCloudChats: { active: '列出中', completed: '已列出', following: '等待列出' },
  readCloudChatTurns: { active: '读取中', completed: '已读取', following: '等待读取' },
  sendToCloudChat: { active: '发送中', completed: '已发送', following: '等待发送' },
}

describe('D97 CloudChatOpsCard / 动作 × 三态矩阵(5×3 逐格)', () => {
  beforeEach(() => {
    cleanup()
  })

  it('15 格全部渲染:5 个动作组 × 3 相位,逐格文案与任务原文一致', () => {
    const { container } = renderCard(ALL_MATRIX)
    expect(container.querySelectorAll('[data-cloud-chat-op-group]').length).toBe(5)
    expect(container.querySelectorAll('[data-cloud-chat-phase]').length).toBe(15)
    for (const op of CLOUD_CHAT_OPS) {
      for (const phase of CLOUD_CHAT_OP_PHASES) {
        const cell = container.querySelector(
          `[data-cloud-chat-op-group="${op}"] [data-cloud-chat-phase="${phase}"]`,
        )
        expect(cell, `${op}.${phase}`).not.toBeNull()
        expect(cell!.textContent).toBe(ZH_CELL[op]![phase])
      }
    }
  })

  it('组标题 = 动作名(zh-CN 逐字取任务原文)', () => {
    const { container } = renderCard([entry('attachCloudChat', 'active')])
    const group = container.querySelector('[data-cloud-chat-op-group="attachCloudChat"]')!
    expect(group.textContent).toContain(ZH_LABEL.attachCloudChat)
  })

  it('target 有则渲染目标段', () => {
    const { container } = renderCard([entry('sendToCloudChat', 'completed', '客户群会话')])
    expect(container.querySelector('[data-cloud-chat-target]')!.textContent).toBe('客户群会话')
  })

  it('空 entries → 不渲染(返回 null)', () => {
    const { container } = renderCard([])
    expect(container.querySelector('[data-testid="cco"]')).toBeNull()
  })
})

describe('D97 CloudChatOpsCard / 三态样式与 following 提示位', () => {
  beforeEach(() => {
    cleanup()
  })

  it('completed → emerald;active → muted;following → amber', () => {
    const { container } = renderCard([
      entry('attachCloudChat', 'completed'),
      entry('createCloudChat', 'active'),
      entry('listCloudChats', 'following'),
    ])
    expect(container.querySelector('[data-cloud-chat-phase="completed"]')!.className).toContain(
      'text-emerald-600',
    )
    expect(container.querySelector('[data-cloud-chat-phase="active"]')!.className).toContain(
      'text-muted-foreground',
    )
    expect(container.querySelector('[data-cloud-chat-phase="following"]')!.className).toContain(
      'text-amber-600',
    )
  })

  it('含 following → 渲染「等待上游动作」提示位,计数落 data 属性', () => {
    const { container } = renderCard([
      entry('createCloudChat', 'completed'),
      entry('readCloudChatTurns', 'following'),
      entry('sendToCloudChat', 'following'),
    ])
    const waiting = container.querySelector('[data-cloud-chat-waiting]')!
    expect(waiting.textContent).toBe('等待上游动作')
    expect(container.querySelector('[data-testid="cco"]')!.getAttribute('data-cloud-chat-ops-waiting')).toBe('2')
  })

  it('无 following → 不渲染提示位', () => {
    const { container } = renderCard([entry('attachCloudChat', 'completed')])
    expect(container.querySelector('[data-cloud-chat-waiting]')).toBeNull()
  })

  it('卡级 ariaLabel 渲染在容器上', () => {
    const { container } = renderCard([entry('attachCloudChat', 'active')])
    expect(container.querySelector('[data-testid="cco"]')!.getAttribute('aria-label')).toBe(
      '云端聊天互操作活动',
    )
  })
})

describe('D97 词包覆盖(读真实词包,五语言)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )

  it('五语言键集完全一致(parity),15 格 + 5 动作名 + 标题/aria/空态/等待位 = 24 键', () => {
    const expected = [
      'title',
      'ariaLabel',
      'empty',
      'waitingUpstream',
      ...CLOUD_CHAT_OPS.flatMap((op) => [
        `op.${op}.label`,
        ...CLOUD_CHAT_OP_PHASES.map((phase) => `op.${op}.${phase}`),
      ]),
    ].sort()
    expect(expected.length).toBe(24)
    const base = flat(loadNs('zh-CN')).sort()
    expect(base).toEqual(expected)
    for (const locale of LOCALES) {
      expect(flat(loadNs(locale)).sort(), locale).toEqual(base)
    }
  })

  it('矩阵键列表逐格落在词包内(15 格,五语言)', () => {
    for (const locale of LOCALES) {
      const keys = new Set(flat(loadNs(locale)))
      for (const key of cloudChatOpMatrixKeys()) expect(keys.has(key), `${locale} ${key}`).toBe(true)
    }
  })

  it('zh-CN 文案与任务原文逐字一致(防自创措辞)', () => {
    const ns = loadNs('zh-CN') as {
      title: string
      op: Record<string, Record<string, string>>
    }
    expect(ns.title).toBe('云端聊天')
    for (const op of CLOUD_CHAT_OPS) {
      expect(ns.op[op]!.label, `${op}.label`).toBe(ZH_LABEL[op])
      for (const phase of CLOUD_CHAT_OP_PHASES) {
        expect(ns.op[op]![phase], `${op}.${phase}`).toBe(ZH_CELL[op]![phase])
      }
    }
  })

  it('同批键存活:ai.pane.modelLoad 存在则五语言都在(缺席则降级跳过)', () => {
    const present = LOCALES.map((locale) => 'modelLoad' in loadPane(locale))
    if (!present.some(Boolean)) {
      // 同批子代理尚未写入 → 降级:只断言本票键在 ai.pane 之下
      for (const locale of LOCALES) {
        expect('cloudChatOps' in loadPane(locale), locale).toBe(true)
      }
      return
    }
    for (const locale of LOCALES) {
      expect('modelLoad' in loadPane(locale), locale).toBe(true)
      expect('cloudChatOps' in loadPane(locale), locale).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
