// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 统一 Turn 状态词汇表 —— 十态判据用例(G-97)。
//
// 三条主线:
//   ① 十态逐态:每态都有独立的标题键 / aria 键,十态互不相同;
//   ② 穷尽性:十态全覆盖、无重叠,ACTIVE ∪ TERMINAL = 十态;编译期由
//      turn-status.ts 的「穷尽 switch + assertNever 零 default」守住(漏一态 ⇒ tsc 失败);
//   ③ **等待确认 / 后台执行中不得退化成「思考中/运行中」的别名** —— 这是台账点名
//      的两处真实缺口,用例逐条断言它们与其余八态**不同形**。

import { describe, expect, it } from 'vitest'

import {
  ACTIVE_TURN_STATES,
  TERMINAL_TURN_STATES,
  TURN_STATES,
  TURN_STATUS_ACTIONS,
  TURN_STATUS_HINTS,
  TURN_TONES,
  isActiveTurnState,
  isTerminalTurnState,
  isTurnState,
  turnStatusAriaKey,
  turnStatusHintKey,
  turnStatusTitleKey,
  turnStatusView,
  type TurnState,
} from '../turn-status'

describe('D71 Turn 状态 / 十态逐态', () => {
  it('十态常量就是台账那十个,顺序即语义顺序', () => {
    expect(TURN_STATES).toEqual([
      'queued',
      'preparing',
      'thinking',
      'usingTool',
      'waitingConfirm',
      'backgroundRunning',
      'stopping',
      'completed',
      'failed',
      'stopped',
    ])
    expect(TURN_STATES).toHaveLength(10)
  })

  it('每态都能派发,且 titleKey / ariaKey 与键名辅助函数一致', () => {
    for (const state of TURN_STATES) {
      const view = turnStatusView(state)
      expect(view.state, state).toBe(state)
      expect(view.titleKey, state).toBe(turnStatusTitleKey(state))
      expect(view.ariaKey, state).toBe(turnStatusAriaKey(state))
      expect(view.titleKey.startsWith('state.'), state).toBe(true)
      expect(view.ariaKey.startsWith('aria.'), state).toBe(true)
    }
  })

  it('十态标题键两两不同(不得有两态共用一个文案位)', () => {
    const keys = TURN_STATES.map((s) => turnStatusView(s).titleKey)
    expect(new Set(keys).size).toBe(TURN_STATES.length)
  })

  it('十态 aria 键两两不同(读屏不得把两态念成同一句)', () => {
    const keys = TURN_STATES.map((s) => turnStatusView(s).ariaKey)
    expect(new Set(keys).size).toBe(TURN_STATES.length)
  })

  it('tone 一律落在五档语义色内', () => {
    for (const state of TURN_STATES) {
      expect(TURN_TONES, state).toContain(turnStatusView(state).tone)
    }
  })

  it('穷尽性:switch 覆盖十态,每态派发都不抛(漏态在 tsc 阶段就失败)', () => {
    const views = TURN_STATES.map((s) => turnStatusView(s))
    expect(views).toHaveLength(10)
    for (const v of views) expect(v.state).toBeTruthy()
  })

  it('ACTIVE ∪ TERMINAL = 十态且互不重叠', () => {
    const union = new Set<string>([...ACTIVE_TURN_STATES, ...TERMINAL_TURN_STATES])
    expect(union.size).toBe(TURN_STATES.length)
    for (const s of TURN_STATES) expect(union, s).toContain(s)
    for (const s of TERMINAL_TURN_STATES) {
      expect(ACTIVE_TURN_STATES, s).not.toContain(s)
    }
    expect(isActiveTurnState('thinking')).toBe(true)
    expect(isTerminalTurnState('thinking')).toBe(false)
    expect(isTerminalTurnState('completed')).toBe(true)
    expect(isActiveTurnState('completed')).toBe(false)
  })

  it('isTurnState 只认十态', () => {
    for (const s of TURN_STATES) expect(isTurnState(s), s).toBe(true)
    for (const bad of ['', 'running', 'Thinking', 'waiting_approve', 'paused']) {
      expect(isTurnState(bad), bad).toBe(false)
    }
  })
})

describe('D71 等待确认(waitingConfirm)不得退化成「思考中」', () => {
  const waiting = turnStatusView('waitingConfirm')
  const thinking = turnStatusView('thinking')
  const usingTool = turnStatusView('usingTool')

  it('waitsUser = true,且**只有**它一个态为 true(球在用户这边)', () => {
    expect(waiting.waitsUser).toBe(true)
    for (const s of TURN_STATES) {
      if (s === 'waitingConfirm') continue
      expect(turnStatusView(s).waitsUser, s).toBe(false)
    }
  })

  it('与思考中 / 使用工具**不同形**:标题、tone、说明三者至少三项不同', () => {
    expect(waiting.titleKey).not.toBe(thinking.titleKey)
    expect(waiting.titleKey).not.toBe(usingTool.titleKey)
    expect(waiting.tone).not.toBe(thinking.tone)
    expect(waiting.tone).not.toBe(usingTool.tone)
    expect(waiting.tone).toBe('warning')
  })

  it('必须带独立说明 hint.waitingConfirm(不说明 = 用户以为卡住而中断)', () => {
    expect(waiting.hintKey).toBe('hint.waitingConfirm')
    expect(turnStatusHintKey('waitingConfirm')).toBe('hint.waitingConfirm')
    expect(TURN_STATUS_HINTS).toContain('waitingConfirm')
  })

  it('不是终态(确认后本轮还会继续),也不给重试动作', () => {
    expect(waiting.terminal).toBe(false)
    expect(waiting.action).toBe('none')
    expect(waiting.showStop).toBe(true)
  })
})

describe('D71 后台执行中(backgroundRunning)不得退化成「运行中」', () => {
  const bg = turnStatusView('backgroundRunning')
  const thinking = turnStatusView('thinking')
  const usingTool = turnStatusView('usingTool')

  it('offTurn = true,且**只有**它一个态为 true(已离开本轮前台)', () => {
    expect(bg.offTurn).toBe(true)
    for (const s of TURN_STATES) {
      if (s === 'backgroundRunning') continue
      expect(turnStatusView(s).offTurn, s).toBe(false)
    }
  })

  it('busy = false:前台不再为它转圈(这是与 thinking/usingTool 的硬区别)', () => {
    expect(bg.busy).toBe(false)
    expect(thinking.busy).toBe(true)
    expect(usingTool.busy).toBe(true)
  })

  it('与思考中 / 使用工具**不同形**:标题不同且说明位独立', () => {
    expect(bg.titleKey).not.toBe(thinking.titleKey)
    expect(bg.titleKey).not.toBe(usingTool.titleKey)
    expect(bg.hintKey).toBe('hint.backgroundRunning')
    expect(thinking.hintKey).toBeNull()
    expect(usingTool.hintKey).toBeNull()
    expect(TURN_STATUS_HINTS).toContain('backgroundRunning')
  })

  it('不是终态(后台还在跑),仍可停止', () => {
    expect(bg.terminal).toBe(false)
    expect(bg.showStop).toBe(true)
    expect(bg.action).toBe('none')
  })
})

describe('D71 终态与动作位', () => {
  it('三终态 terminal = true,其余七态为 false', () => {
    for (const s of TURN_STATES) {
      const v = turnStatusView(s)
      if (TERMINAL_TURN_STATES.includes(s as never)) expect(v.terminal, s).toBe(true)
      else expect(v.terminal, s).toBe(false)
    }
  })

  it('失败给 retry(D39 重试族不回退),已停止给 resume,其余无动作', () => {
    expect(turnStatusView('failed').action).toBe('retry')
    expect(turnStatusView('stopped').action).toBe('resume')
    for (const s of ['queued', 'preparing', 'thinking', 'usingTool', 'waitingConfirm', 'backgroundRunning', 'stopping', 'completed'] as TurnState[]) {
      expect(turnStatusView(s).action, s).toBe('none')
    }
    expect(TURN_STATUS_ACTIONS).toContain('retry')
    expect(TURN_STATUS_ACTIONS).toContain('resume')
  })

  it('failed 与 stopped 不同形(tone 不同 + 动作不同):一个是失败,一个是主动停', () => {
    const failed = turnStatusView('failed')
    const stopped = turnStatusView('stopped')
    expect(failed.tone).toBe('danger')
    expect(stopped.tone).not.toBe(failed.tone)
    expect(stopped.action).not.toBe(failed.action)
  })

  it('正在停止不再给停止入口(重复点击无意义),且带说明', () => {
    const stopping = turnStatusView('stopping')
    expect(stopping.showStop).toBe(false)
    expect(stopping.hintKey).toBe('hint.stopping')
    expect(stopping.busy).toBe(true)
  })

  it('排队中带说明(现状完全缺失这一句)', () => {
    expect(turnStatusView('queued').hintKey).toBe('hint.queued')
    expect(TURN_STATUS_HINTS).toContain('queued')
  })

  it('需要说明的态恰好四态,其余六态不给说明(不画蛇添足)', () => {
    for (const s of TURN_STATES) {
      const v = turnStatusView(s)
      const expectsHint = (TURN_STATUS_HINTS as readonly string[]).includes(s)
      if (expectsHint) expect(v.hintKey, s).not.toBeNull()
      else expect(v.hintKey, s).toBeNull()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
