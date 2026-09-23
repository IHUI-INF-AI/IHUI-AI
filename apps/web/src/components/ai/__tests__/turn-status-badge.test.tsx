// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TURN_STATES, TURN_STATUS_HINTS, type TurnState } from '@ihui/shared/chat/turn-status'

import { TurnStatusBadge } from '../turn-status-badge'

// 只断言**结构与判据**(十态 / 说明位 / 动作位可见性),文案一律走 key;
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const renderBadge = (state: TurnState, onAction?: (a: string) => void) =>
  render(<TurnStatusBadge state={state} onAction={onAction} />).container

describe('D71 TurnStatusBadge / 十态渲染', () => {
  it('十态逐个渲染出对应 data-turn-state', () => {
    for (const state of TURN_STATES) {
      const container = renderBadge(state)
      expect(container.querySelector(`[data-turn-state="${state}"]`), state).not.toBeNull()
      expect(
        container.querySelector(`[data-turn-state-label="${state}"]`)?.textContent?.length,
        state,
      ).toBeGreaterThan(0)
    }
  })

  it('十态 tone 全部有值,且失败 / 已完成 / 等待确认三态色档互不相同', () => {
    const toneOf = (state: TurnState) =>
      renderBadge(state).querySelector('[data-turn-state]')?.getAttribute('data-turn-tone')
    const tones = TURN_STATES.map(toneOf)
    for (const tone of tones) expect(tone?.length ?? 0).toBeGreaterThan(0)
    expect(toneOf('failed')).not.toBe(toneOf('completed'))
    expect(toneOf('failed')).not.toBe(toneOf('waitingConfirm'))
    expect(toneOf('completed')).not.toBe(toneOf('waitingConfirm'))
  })

  it('三终态 data-turn-terminal=true,其余七态为 false', () => {
    for (const state of TURN_STATES) {
      const flag = renderBadge(state)
        .querySelector('[data-turn-state]')
        ?.getAttribute('data-turn-terminal')
      const want = ['completed', 'failed', 'stopped'].includes(state) ? 'true' : 'false'
      expect(flag, state).toBe(want)
    }
  })
})

describe('D71 TurnStatusBadge / 等待确认与后台执行中的可见性(台账缺口)', () => {
  it('waitingConfirm 渲染 data-turn-waits-user=true,且十态里只有它一个', () => {
    for (const state of TURN_STATES) {
      const flag = renderBadge(state)
        .querySelector('[data-turn-state]')
        ?.getAttribute('data-turn-waits-user')
      expect(flag, state).toBe(state === 'waitingConfirm' ? 'true' : 'false')
    }
  })

  it('waitingConfirm 渲染独立说明位(不得退化成光秃秃的"思考中")', () => {
    const container = renderBadge('waitingConfirm')
    expect(container.querySelector('[data-turn-hint="hint.waitingConfirm"]')).not.toBeNull()
    expect(
      container.querySelector('[data-turn-hint="hint.waitingConfirm"]')?.textContent?.length,
    ).toBeGreaterThan(0)
  })

  it('backgroundRunning 渲染 data-turn-off-turn=true,且 busy=false(前台不再等它)', () => {
    for (const state of TURN_STATES) {
      const el = renderBadge(state).querySelector('[data-turn-state]')
      expect(el?.getAttribute('data-turn-off-turn'), state).toBe(
        state === 'backgroundRunning' ? 'true' : 'false',
      )
      expect(el?.getAttribute('data-turn-busy'), state).toBe(
        state === 'backgroundRunning' ? 'false' : String(!['completed', 'failed', 'stopped'].includes(state)),
      )
    }
  })

  it('backgroundRunning 渲染独立说明位', () => {
    const container = renderBadge('backgroundRunning')
    expect(container.querySelector('[data-turn-hint="hint.backgroundRunning"]')).not.toBeNull()
  })

  it('恰好四态带说明位,其余六态不带(不画蛇添足)', () => {
    for (const state of TURN_STATES) {
      const hint = renderBadge(state).querySelector('[data-turn-hint]')
      const wants = (TURN_STATUS_HINTS as readonly string[]).includes(state)
      if (wants) expect(hint, state).not.toBeNull()
      else expect(hint, state).toBeNull()
    }
  })
})

describe('D71 TurnStatusBadge / 动作位', () => {
  it('进行中态给停止入口(正在停止除外),失败给重试,已停止给继续', () => {
    const actionOf = (state: TurnState) =>
      renderBadge(state, () => {})
        .querySelector('[data-action]')
        ?.getAttribute('data-action') ?? null
    expect(actionOf('queued')).toBe('stop')
    expect(actionOf('preparing')).toBe('stop')
    expect(actionOf('thinking')).toBe('stop')
    expect(actionOf('usingTool')).toBe('stop')
    expect(actionOf('waitingConfirm')).toBe('stop')
    expect(actionOf('backgroundRunning')).toBe('stop')
    expect(actionOf('stopping')).toBeNull()
    expect(actionOf('completed')).toBeNull()
    expect(actionOf('failed')).toBe('retry')
    expect(actionOf('stopped')).toBe('resume')
  })

  it('不传 onAction → 不渲染任何动作按钮(纯展示)', () => {
    for (const state of TURN_STATES) {
      expect(renderBadge(state).querySelector('[data-action]'), state).toBeNull()
    }
  })

  it('点击回调带上动作 id', () => {
    const onAction = vi.fn()
    const container = render(<TurnStatusBadge state="failed" onAction={onAction} />).container
    ;(container.querySelector('[data-action="retry"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('retry')
  })

  it('停止态点击回调是 stop(不是 retry)', () => {
    const onAction = vi.fn()
    const container = render(<TurnStatusBadge state="thinking" onAction={onAction} />).container
    ;(container.querySelector('[data-action="stop"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('stop')
  })
})

describe('D71 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readNs = (locale: string, ns: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, Record<string, unknown>> } }
    const node = parsed.ai?.pane?.[ns]
    if (!node) throw new Error(`missing ai.pane.${ns} in ${locale}.json`)
    return node
  }

  it('五语言 turnStatus 键集完全一致(parity)', () => {
    const base = flat(readNs('zh-CN', 'turnStatus')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readNs(locale, 'turnStatus')).sort(), locale).toEqual(base)
    }
  })

  it('五语言 errorCatalog 键集完全一致(parity)', () => {
    const base = flat(readNs('zh-CN', 'errorCatalog')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readNs(locale, 'errorCatalog')).sort(), locale).toEqual(base)
    }
  })

  it('十态标题 / aria / 四说明 / 三动作 / title 键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readNs(locale, 'turnStatus'))
      for (const state of TURN_STATES) {
        expect(keys, `${locale} state.${state}`).toContain(`state.${state}`)
        expect(keys, `${locale} aria.${state}`).toContain(`aria.${state}`)
      }
      for (const hint of TURN_STATUS_HINTS) expect(keys, `${locale} hint.${hint}`).toContain(`hint.${hint}`)
      for (const action of ['stop', 'retry', 'resume']) {
        expect(keys, `${locale} action.${action}`).toContain(`action.${action}`)
      }
      expect(keys, `${locale} title`).toContain('title')
    }
  })

  it('errorCatalog 每个码都有 title 与 action,且取值非空', () => {
    for (const locale of LOCALES) {
      const node = readNs(locale, 'errorCatalog')
      const codes = Object.keys(node)
      expect(codes.length, locale).toBeGreaterThan(50)
      for (const code of codes) {
        const entry = node[code] as { title?: string; action?: string }
        expect(typeof entry.title === 'string' && entry.title.trim().length > 0, `${locale} ${code}.title`).toBe(true)
        expect(typeof entry.action === 'string' && entry.action.trim().length > 0, `${locale} ${code}.action`).toBe(true)
      }
    }
  })

  it('五种语言取值一律非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      for (const ns of ['turnStatus', 'errorCatalog']) {
        const walk = (obj: Record<string, unknown>): void => {
          for (const value of Object.values(obj)) {
            if (value && typeof value === 'object') walk(value as Record<string, unknown>)
            else expect(typeof value === 'string' && value.trim().length > 0, `${locale}/${ns}`).toBe(true)
          }
        }
        walk(readNs(locale, ns))
      }
    }
  })

  it('ja 不得残留简体中文词(协作/概览/绑定等)', () => {
    for (const ns of ['turnStatus', 'errorCatalog']) {
      const raw = readFileSync(join(MESSAGES_ROOT, 'ja.json'), 'utf8')
      const node = JSON.parse(raw) as { ai: { pane: Record<string, unknown> } }
      const dump = JSON.stringify(node.ai.pane[ns])
      for (const word of ['协作', '概览', '绑定', '管理员账号']) {
        expect(dump.includes(word), `ja/${ns} 残留「${word}」`).toBe(false)
      }
    }
  })

  /** 取值并断言键在位:缺键时抛出可读错误,而不是拿 undefined 去比字符串。 */
  const pick = (locale: string, ns: string, path: string): string => {
    const parts = path.split('.')
    let cur: unknown = readNs(locale, ns)
    for (const part of parts) {
      cur = (cur as Record<string, unknown>)?.[part]
    }
    if (typeof cur !== 'string') throw new Error(`${locale} ai.pane.${ns}.${path} 缺失`)
    return cur
  }

  it('zh-CN 十态文案与台账原文逐字一致(防自创措辞)', () => {
    const want: Record<string, string> = {
      queued: '排队中',
      preparing: '准备中',
      thinking: '思考中',
      usingTool: '使用工具',
      waitingConfirm: '等待确认',
      backgroundRunning: '后台执行中',
      stopping: '正在停止',
      completed: '已完成',
      failed: '失败',
      stopped: '已停止',
    }
    for (const [state, text] of Object.entries(want)) {
      expect(pick('zh-CN', 'turnStatus', `state.${state}`), state).toBe(text)
    }
  })

  it('zh-CN 错误八类文案与台账原文逐字一致(防自创措辞)', () => {
    const titles: Record<string, string> = {
      CONTEXT_TOO_LONG: '上下文过长',
      MEDIA_COUNT_EXCEEDED: '媒体文件数量超出限制',
      MODEL_REFUSED: '当前模型拒绝了本次请求',
      REQUEST_TIMEOUT: '请求超时',
      INTERNAL_ERROR: '服务内部处理错误',
      VERSION_TOO_LOW: '版本过低',
      ACCOUNT_RESTRICTED: '账户受限',
      TOKEN_EXPIRED: '登录已过期',
    }
    for (const [code, text] of Object.entries(titles)) {
      expect(pick('zh-CN', 'errorCatalog', `${code}.title`), code).toBe(text)
    }

    const actions: Record<string, string> = {
      CONTEXT_TOO_LONG: '精简上下文',
      MODEL_REFUSED: '换模型',
      REQUEST_TIMEOUT: '重试',
      ACCOUNT_RESTRICTED: '联系管理员',
      TOKEN_EXPIRED: '重新登录',
    }
    for (const [code, text] of Object.entries(actions)) {
      expect(pick('zh-CN', 'errorCatalog', `${code}.action`), code).toBe(text)
    }
  })

  it('zh-CN 词包里不得出现「未知错误」兜底(零兜底判据)', () => {
    const dump = JSON.stringify(readNs('zh-CN', 'errorCatalog'))
    expect(dump.includes('未知错误')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
