// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { AGENT_INSTANCE_STATES, sessionStatusFromInstance, type SessionStatus } from '@ihui/types'

import {
  AGENT_ACTIONS,
  AGENT_ACTION_COUNT_KEY,
  AGENT_ACTION_MATRIX,
  AGENT_ACTION_PHASES,
  AGENT_ACTION_PROMPT_KEY,
  AGENT_ACTION_ROW_KEY,
  agentActionLabelKey,
  agentActionMatrixKeys,
  agentActionPhaseKey,
  agentInstanceStateKey,
  isAgentAction,
  isAgentActionPhase,
} from '../agent-actions'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

const readAgentActions = (locale: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')) as {
    ai?: { pane?: { agentActions?: Record<string, unknown> } }
  }
  const node = parsed.ai?.pane?.agentActions
  if (!node) throw new Error(`missing ai.pane.agentActions in ${locale}.json`)
  return node
}

describe('D103 动作矩阵 / 维度与枚举卫生', () => {
  it('六个动作、三个相位,均无重复', () => {
    expect([...AGENT_ACTIONS]).toEqual(['spawn', 'resume', 'sendInput', 'interrupt', 'close', 'list'])
    expect([...AGENT_ACTION_PHASES]).toEqual(['inProgress', 'completed', 'failed'])
    expect(new Set(AGENT_ACTIONS).size).toBe(6)
  })

  it('矩阵是 6 × 3,每个动作都齐三相位(不给 list 开特例)', () => {
    expect(AGENT_ACTION_MATRIX.length).toBe(6)
    for (const row of AGENT_ACTION_MATRIX) {
      expect(row.phases.length).toBe(3)
      expect([...row.phases]).toEqual(['inProgress', 'completed', 'failed'])
    }
    expect(agentActionMatrixKeys().length).toBe(18)
  })

  it('类型守卫只认合法取值', () => {
    expect(isAgentAction('spawn')).toBe(true)
    expect(isAgentAction('destroy')).toBe(false)
    expect(isAgentActionPhase('inProgress')).toBe(true)
    expect(isAgentActionPhase('pending')).toBe(false)
  })
})

describe('D103 动作矩阵 / 逐格键名(6 × 3 = 18 格全覆盖)', () => {
  it.each([...AGENT_ACTIONS])('动作 %s 的三相位键名互不相同且格式稳定', (action) => {
    const keys = AGENT_ACTION_PHASES.map((phase) => agentActionPhaseKey(action, phase))
    expect(new Set(keys).size).toBe(3)
    for (const key of keys) expect(key).toMatch(/^action\.[a-zA-Z]+\.(inProgress|completed|failed)$/)
    expect(agentActionLabelKey(action)).toBe(`action.${action}.label`)
  })

  it('矩阵键列表与 18 格逐格一致(无遗漏/无重复)', () => {
    const keys = agentActionMatrixKeys()
    expect(new Set(keys).size).toBe(18)
    expect(keys).toContain('action.spawn.inProgress')
    expect(keys).toContain('action.close.failed')
    expect(keys).toContain('action.interrupt.failed')
    // 任务原文点名的三个"我方容易漏"的失败态写法,键位于此锁定
    expect(keys).toContain('action.resume.failed')
  })
})

describe('D103 七态与 SessionStatus 的关系(不另建第二套枚举)', () => {
  it('七态齐备且含 notFound 这一我方此前完全没有的终态', () => {
    expect([...AGENT_INSTANCE_STATES].length).toBe(7)
    expect([...AGENT_INSTANCE_STATES]).toContain('notFound')
    expect([...AGENT_INSTANCE_STATES]).toContain('pendingInit')
    expect([...AGENT_INSTANCE_STATES]).toContain('shutdown')
  })

  it('实例态单向映射到会话级四态(每个实例态都有唯一归属)', () => {
    const expected: Record<string, SessionStatus> = {
      running: 'running',
      pendingInit: 'running',
      completed: 'completed',
      errored: 'failed',
      interrupted: 'cancelled',
      shutdown: 'cancelled',
      notFound: 'cancelled',
    }
    for (const state of AGENT_INSTANCE_STATES) {
      expect(sessionStatusFromInstance(state), state).toBe(expected[state])
    }
  })

  it('七态键名生成稳定', () => {
    for (const state of AGENT_INSTANCE_STATES) {
      expect(agentInstanceStateKey(state)).toBe(`state.${state}`)
    }
    expect(agentInstanceStateKey('notFound')).toBe('state.notFound')
  })
})

describe('D103 词包覆盖(读真实词包,不 mock)', () => {
  it('五语言键集完全一致(parity)', () => {
    const base = flat(readAgentActions('zh-CN')).sort()
    for (const locale of LOCALES) {
      expect(flat(readAgentActions(locale)).sort(), locale).toEqual(base)
    }
  })

  it('18 格相位键 + 7 个状态键 + 标题/行模板/入参行 全齐(五语言)', () => {
    for (const locale of LOCALES) {
      const keys = new Set(flat(readAgentActions(locale)))
      for (const key of agentActionMatrixKeys()) expect(keys.has(key), `${locale} ${key}`).toBe(true)
      for (const state of AGENT_INSTANCE_STATES) {
        expect(keys.has(`state.${state}`), `${locale} state.${state}`).toBe(true)
      }
      for (const extra of [AGENT_ACTION_COUNT_KEY, AGENT_ACTION_ROW_KEY, AGENT_ACTION_PROMPT_KEY, 'title']) {
        expect(keys.has(extra), `${locale} ${extra}`).toBe(true)
      }
    }
  })

  it('标题 count 走 ICU plural(不是手拼字符串)', () => {
    const node = readAgentActions('zh-CN') as { header: { count: string } }
    expect(node.header.count).toContain('plural')
    expect(node.header.count).toContain('count')
  })

  it('zh-CN 文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readAgentActions('zh-CN') as {
      action: Record<string, Record<string, string>>
      state: Record<string, string>
    }
    expect(node.action.spawn?.inProgress).toBe('创建中')
    expect(node.action.spawn?.completed).toBe('已创建')
    expect(node.action.spawn?.failed).toBe('创建失败')
    expect(node.action.interrupt?.inProgress).toBe('正在中断')
    expect(node.action.interrupt?.completed).toBe('已中断')
    expect(node.action.interrupt?.failed).toBe('中断未成功')
    expect(node.action.close?.failed).toBe('无法关闭')
    expect(node.state.notFound).toBe('找不到')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
