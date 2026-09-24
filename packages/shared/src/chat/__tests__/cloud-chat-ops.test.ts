// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  CLOUD_CHAT_OPS,
  CLOUD_CHAT_OP_PHASES,
  CLOUD_CHAT_OPS_ARIA_KEY,
  CLOUD_CHAT_OPS_EMPTY_KEY,
  CLOUD_CHAT_OPS_TITLE_KEY,
  CLOUD_CHAT_OPS_WAITING_KEY,
  cloudChatOpKeys,
  cloudChatOpLabelKey,
  cloudChatOpMatrixKeys,
  cloudChatOpsView,
  isCloudChatOp,
  isCloudChatOpPhase,
  type CloudChatOpEntry,
} from '../cloud-chat-ops'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

const readCloudChatOps = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    ai?: { pane?: { cloudChatOps?: Record<string, unknown> } }
  }
  const node = parsed.ai?.pane?.cloudChatOps
  if (!node) throw new Error(`missing ai.pane.cloudChatOps in ${locale}.json`)
  return node
}

/** zh-CN 逐字预期(动作名与任务原文对齐,防自创措辞) */
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

describe('D97 动作矩阵 / 维度与枚举卫生', () => {
  it('五个动作、三个相位(active/completed/following),均无重复', () => {
    expect([...CLOUD_CHAT_OPS]).toEqual([
      'attachCloudChat',
      'createCloudChat',
      'listCloudChats',
      'readCloudChatTurns',
      'sendToCloudChat',
    ])
    expect([...CLOUD_CHAT_OP_PHASES]).toEqual(['active', 'completed', 'following'])
    expect(new Set(CLOUD_CHAT_OPS).size).toBe(5)
    expect(new Set(CLOUD_CHAT_OP_PHASES).size).toBe(3)
  })

  it('矩阵是 5 × 3 = 15 格,每个动作都齐三态', () => {
    expect(cloudChatOpMatrixKeys().length).toBe(15)
    expect(new Set(cloudChatOpMatrixKeys()).size).toBe(15)
  })

  it('类型守卫只认合法取值', () => {
    expect(isCloudChatOp('attachCloudChat')).toBe(true)
    expect(isCloudChatOp('detachCloudChat')).toBe(false)
    expect(isCloudChatOpPhase('following')).toBe(true)
    expect(isCloudChatOpPhase('failed')).toBe(false)
  })
})

describe('D97 动作矩阵 / 逐格键名(5 × 3 = 15 格全覆盖)', () => {
  it.each([...CLOUD_CHAT_OPS])('动作 %s 的三态键名互不相同且格式稳定', (op) => {
    const keys = CLOUD_CHAT_OP_PHASES.map((phase) => cloudChatOpKeys(op, phase).labelKey)
    expect(new Set(keys).size).toBe(3)
    for (const key of keys) expect(key).toMatch(/^op\.[a-zA-Z]+\.(active|completed|following)$/)
    expect(cloudChatOpLabelKey(op)).toBe(`op.${op}.label`)
  })

  it('每格 labelKey 与 ariaKey 都由 cloudChatOpKeys 产出(格内 aria 复用格标签,不另增 15 键)', () => {
    for (const op of CLOUD_CHAT_OPS) {
      for (const phase of CLOUD_CHAT_OP_PHASES) {
        const cell = cloudChatOpKeys(op, phase)
        expect(cell.labelKey).toBe(`op.${op}.${phase}`)
        expect(cell.ariaKey).toBe(cell.labelKey)
      }
    }
  })

  it('矩阵键列表与 15 格逐格一致(无遗漏/无重复),含任务原文点名的首尾格', () => {
    const keys = cloudChatOpMatrixKeys()
    expect(new Set(keys).size).toBe(15)
    expect(keys).toContain('op.attachCloudChat.active')
    expect(keys).toContain('op.sendToCloudChat.following')
    for (const op of CLOUD_CHAT_OPS) {
      for (const phase of CLOUD_CHAT_OP_PHASES) {
        expect(keys).toContain(`op.${op}.${phase}`)
      }
    }
  })
})

describe('D97 聚合判定 cloudChatOpsView', () => {
  const entry = (op: string, phase: string, target?: string): CloudChatOpEntry =>
    ({ op, phase, target }) as CloudChatOpEntry

  it('空数组 → null(不渲染空卡)', () => {
    expect(cloudChatOpsView([])).toBeNull()
  })

  it('非空 → 原样出 rows,无 following 时 waitingOpCount 为 0', () => {
    const view = cloudChatOpsView([
      entry('attachCloudChat', 'completed', '会话A'),
      entry('sendToCloudChat', 'active'),
    ])
    expect(view).not.toBeNull()
    expect(view!.rows.length).toBe(2)
    expect(view!.waitingOpCount).toBe(0)
  })

  it('含 following 态 → waitingOpCount > 0(「等待上游动作」提示位判定)', () => {
    const view = cloudChatOpsView([
      entry('createCloudChat', 'completed'),
      entry('readCloudChatTurns', 'following'),
      entry('sendToCloudChat', 'following'),
    ])
    expect(view).not.toBeNull()
    expect(view!.waitingOpCount).toBe(2)
  })

  it('非法 op/phase 的行被过滤,不进 rows 也不崩', () => {
    const view = cloudChatOpsView([
      entry('attachCloudChat', 'completed'),
      entry('explode', 'active'),
      entry('sendToCloudChat', 'flying'),
    ])
    expect(view).not.toBeNull()
    expect(view!.rows.length).toBe(1)
    expect(view!.rows[0]!.op).toBe('attachCloudChat')
  })
})

describe('D97 词包覆盖(读真实词包,不 mock)', () => {
  it('五语言键集完全一致(parity),24 键全齐', () => {
    const expected = [
      CLOUD_CHAT_OPS_TITLE_KEY,
      CLOUD_CHAT_OPS_ARIA_KEY,
      CLOUD_CHAT_OPS_EMPTY_KEY,
      CLOUD_CHAT_OPS_WAITING_KEY,
      ...CLOUD_CHAT_OPS.flatMap((op) => [
        `op.${op}.label`,
        ...CLOUD_CHAT_OP_PHASES.map((phase) => `op.${op}.${phase}`),
      ]),
    ].sort()
    const base = flat(readCloudChatOps('zh-CN')).sort()
    expect(base).toEqual(expected)
    for (const locale of LOCALES) {
      expect(flat(readCloudChatOps(locale)).sort(), locale).toEqual(base)
    }
  })

  it('15 格相位键 + 5 个动作名键 + 标题/aria/空态/等待位 全齐(五语言)', () => {
    for (const locale of LOCALES) {
      const keys = new Set(flat(readCloudChatOps(locale)))
      for (const key of cloudChatOpMatrixKeys()) expect(keys.has(key), `${locale} ${key}`).toBe(true)
      for (const op of CLOUD_CHAT_OPS) {
        expect(keys.has(cloudChatOpLabelKey(op)), `${locale} ${op}.label`).toBe(true)
      }
      for (const extra of [CLOUD_CHAT_OPS_TITLE_KEY, CLOUD_CHAT_OPS_ARIA_KEY, CLOUD_CHAT_OPS_EMPTY_KEY, CLOUD_CHAT_OPS_WAITING_KEY]) {
        expect(keys.has(extra), `${locale} ${extra}`).toBe(true)
      }
    }
  })

  it('zh-CN 文案与任务原文逐字一致(防自创措辞)', () => {
    const node = readCloudChatOps('zh-CN') as {
      op: Record<string, Record<string, string>>
    }
    for (const op of CLOUD_CHAT_OPS) {
      expect(node.op[op]?.label, `${op}.label`).toBe(ZH_LABEL[op])
      for (const phase of CLOUD_CHAT_OP_PHASES) {
        expect(node.op[op]?.[phase], `${op}.${phase}`).toBe(ZH_CELL[op]![phase])
      }
    }
  })

  it('ja 词包不得残留简体中文特有词(协作/概览/绑定)', () => {
    const raw = JSON.stringify(readCloudChatOps('ja'))
    expect(raw).not.toContain('协作')
    expect(raw).not.toContain('概览')
    expect(raw).not.toContain('绑定')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
