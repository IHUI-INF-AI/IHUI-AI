// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  ACTIVE_WORKTREE_STATES,
  TERMINAL_WORKTREE_STATES,
  WORKTREE_ACQUIRE_STAGES,
  WORKTREE_ACTIONS,
  WORKTREE_HINTS,
  WORKTREE_STATES,
  isActiveWorktreeState,
  isSingleWriterViolation,
  isTerminalWorktreeState,
  isWorktreeAcquireStage,
  isWorktreeState,
  stageToState,
  worktreeActionKey,
  worktreeHintKey,
  worktreeStateKey,
  worktreeView,
  type WorktreeAcquireStage,
  type WorktreeLifecycleEvent,
  type WorktreeState,
} from '../worktree-lifecycle'

const ev = (
  state: WorktreeState,
  extra: Omit<WorktreeLifecycleEvent, 'state'> = {},
): WorktreeLifecycleEvent => ({ state, ...extra })

const viewOf = (state: WorktreeState) => {
  const view = worktreeView(ev(state))
  if (!view) throw new Error(`no view for ${state}`)
  return view
}

describe('D72 worktree-lifecycle / 八态与穷尽性', () => {
  it('八态恰为台账所列 8 项(顺序即展示序)', () => {
    expect(WORKTREE_STATES).toEqual([
      'creating',
      'ready',
      'initFailed',
      'timeout',
      'cleaned',
      'restoring',
      'restored',
      'restoreFailed',
    ])
    expect(WORKTREE_STATES.length).toBe(8)
  })

  it('isWorktreeState 认八态、拒未知值(不编造)', () => {
    for (const state of WORKTREE_STATES) expect(isWorktreeState(state)).toBe(true)
    expect(isWorktreeState('cleaning')).toBe(false)
    expect(isWorktreeState('')).toBe(false)
  })

  it('八态**逐态**都有视图(switch 无 default 的穷尽性落到每一态)', () => {
    for (const state of WORKTREE_STATES) {
      const view = worktreeView(ev(state))
      expect(view, state).not.toBeNull()
      expect(view?.state, state).toBe(state)
    }
  })

  it('tone 取值恒在四档语义色内', () => {
    const tones = WORKTREE_STATES.map((state) => viewOf(state).tone)
    expect(new Set(tones).size).toBeGreaterThan(1)
    for (const tone of tones) {
      expect(['neutral', 'success', 'warning', 'danger']).toContain(tone)
    }
  })

  it('无 event(undefined / null)→ null,不崩', () => {
    expect(worktreeView(undefined)).toBeNull()
    expect(worktreeView(null)).toBeNull()
  })
})

describe('D72 worktree-lifecycle / 关键语义判据', () => {
  it('timeout 必带"请检查仓库状态"提示键,且给恢复入口(不得只显示"超时")', () => {
    const view = viewOf('timeout')
    expect(view.hintKey).toBe('hint.timeout')
    expect(view.showRestore).toBe(true)
  })

  it('cleaned 给恢复入口 + 额外给磁盘回收入口', () => {
    const view = viewOf('cleaned')
    expect(view.showRestore).toBe(true)
    expect(view.showReclaim).toBe(true)
    expect(view.hintKey).toBe('hint.cleaned')
  })

  it('cleaned / timeout / initFailed 三态**都**必须给出恢复入口', () => {
    for (const state of ['cleaned', 'timeout', 'initFailed'] as const) {
      expect(viewOf(state).showRestore, state).toBe(true)
    }
  })

  it('只有 cleaned 给磁盘回收入口(其余态不得给,避免误删可控 worktree)', () => {
    for (const state of WORKTREE_STATES) {
      expect(viewOf(state).showReclaim, state).toBe(state === 'cleaned')
    }
  })

  it('ready 提示单写者约束(同一 task 同时仅一个活跃 worktree)', () => {
    expect(viewOf('ready').hintKey).toBe('hint.singleWriter')
  })

  it('restoreFailed 必须显式渲染:有视图、有恢复入口、tone 为 danger(不得静默留空)', () => {
    const view = viewOf('restoreFailed')
    expect(view.tone).toBe('danger')
    expect(view.showRestore).toBe(true)
    expect(view.showReclaim).toBe(false)
  })

  it('restored 与 restoreFailed **不同形**:tone 不同 + 恢复入口不同', () => {
    const restored = viewOf('restored')
    const failed = viewOf('restoreFailed')
    expect(restored.tone).not.toBe(failed.tone)
    expect(restored.showRestore).toBe(false)
    expect(failed.showRestore).toBe(true)
  })

  it('进行中态(creating / restoring)不给任何恢复 / 回收动作', () => {
    for (const state of ['creating', 'restoring'] as const) {
      const view = viewOf(state)
      expect(view.showRestore, state).toBe(false)
      expect(view.showReclaim, state).toBe(false)
      expect(view.hintKey, state).toBeNull()
    }
  })
})

describe('D72 worktree-lifecycle / §12d 收编三阶段映射', () => {
  it('三阶段恰为 cherry-pick → worktree remove → prune 顺序', () => {
    expect(WORKTREE_ACQUIRE_STAGES).toEqual(['cherryPick', 'worktreeRemove', 'prune'])
  })

  it('isWorktreeAcquireStage 认三阶段、拒未知值', () => {
    for (const stage of WORKTREE_ACQUIRE_STAGES) expect(isWorktreeAcquireStage(stage)).toBe(true)
    expect(isWorktreeAcquireStage('rebase')).toBe(false)
  })

  it('三阶段全完成 ⇒ cleaned(与 §12d 收编终态一致)', () => {
    expect(stageToState([...WORKTREE_ACQUIRE_STAGES])).toBe('cleaned')
  })

  it('乱序 / 含重复的三阶段全完成 ⇒ 仍是 cleaned(只计完成集合,不依赖顺序)', () => {
    const shuffled: WorktreeAcquireStage[] = ['prune', 'cherryPick', 'prune', 'worktreeRemove']
    expect(stageToState(shuffled)).toBe('cleaned')
  })

  it('未开始(0 阶段)⇒ ready(worktree 仍在,可正常使用)', () => {
    expect(stageToState([])).toBe('ready')
  })

  it('已完成 1 阶段(逐项)⇒ restoring,不得提前宣称已清理', () => {
    for (const stage of WORKTREE_ACQUIRE_STAGES) {
      expect(stageToState([stage]), stage).toBe('restoring')
    }
  })

  it('已完成 2 阶段 ⇒ restoring', () => {
    expect(stageToState(['cherryPick', 'worktreeRemove'])).toBe('restoring')
    expect(stageToState(['cherryPick', 'prune'])).toBe('restoring')
    expect(stageToState(['worktreeRemove', 'prune'])).toBe('restoring')
  })

  it('stageToState 结果恒为合法八态', () => {
    for (const n of [0, 1, 2, 3]) {
      const stages = WORKTREE_ACQUIRE_STAGES.slice(0, n)
      expect(isWorktreeState(stageToState(stages))).toBe(true)
    }
  })
})

describe('D72 worktree-lifecycle / 单写者守卫(§12d 第一优先)', () => {
  const active = (over: Partial<WorktreeLifecycleEvent> = {}): WorktreeLifecycleEvent => ({
    state: 'ready',
    taskId: 'task-1',
    path: '.worktrees/task-1',
    ...over,
  })

  it('正例:同一 task 两个活跃 worktree(不同路径)⇒ 违规', () => {
    expect(
      isSingleWriterViolation(
        active(),
        active({ state: 'creating', path: '.worktrees/task-1-dup' }),
      ),
    ).toBe(true)
  })

  it('creating + ready 同 task ⇒ 违规(第二个写者在创建中即拦)', () => {
    expect(
      isSingleWriterViolation(active({ state: 'creating' }), active({ path: '.worktrees/other' })),
    ).toBe(true)
  })

  it('同一 worktree 的重复上报(同 task 同路径)⇒ 不算第二个写者', () => {
    expect(isSingleWriterViolation(active(), active())).toBe(false)
  })

  it('不同 task ⇒ 不违规(各写各的)', () => {
    expect(
      isSingleWriterViolation(active(), active({ taskId: 'task-2', path: '.worktrees/task-2' })),
    ).toBe(false)
  })

  it('任一 taskId 缺失 ⇒ 不判违规(taskId 未知不臆断)', () => {
    expect(isSingleWriterViolation(active({ taskId: undefined }), active({ path: '.worktrees/x' }))).toBe(false)
    expect(isSingleWriterViolation(active(), active({ taskId: undefined, path: '.worktrees/x' }))).toBe(false)
  })

  it('非活跃态(existing 已 cleaned / incoming 未就绪)⇒ 不违规', () => {
    expect(isSingleWriterViolation(active({ state: 'cleaned' }), active({ path: '.worktrees/x' }))).toBe(false)
    expect(isSingleWriterViolation(active(), active({ state: 'timeout', path: '.worktrees/x' }))).toBe(false)
  })

  it('任一侧缺失 ⇒ 不违规', () => {
    expect(isSingleWriterViolation(null, active())).toBe(false)
    expect(isSingleWriterViolation(active(), undefined)).toBe(false)
    expect(isSingleWriterViolation(null, null)).toBe(false)
  })

  it('活跃态集合恰为 creating / ready(单写者约束的作用域)', () => {
    expect(ACTIVE_WORKTREE_STATES).toEqual(['creating', 'ready'])
    for (const state of WORKTREE_STATES) {
      expect(isActiveWorktreeState(state), state).toBe(state === 'creating' || state === 'ready')
    }
  })
})

describe('D72 worktree-lifecycle / 终态与词包键名', () => {
  it('终态集合 = cleaned / restored / restoreFailed', () => {
    expect(TERMINAL_WORKTREE_STATES).toEqual(['cleaned', 'restored', 'restoreFailed'])
    for (const state of WORKTREE_STATES) {
      expect(isTerminalWorktreeState(state), state).toBe(
        state === 'cleaned' || state === 'restored' || state === 'restoreFailed',
      )
    }
  })

  it('键名助手与词包命名空间一致', () => {
    expect(WORKTREE_HINTS).toEqual(['timeout', 'cleaned', 'singleWriter'])
    expect(WORKTREE_ACTIONS).toEqual(['restore', 'retryRestore', 'reclaimDisk', 'dismiss'])
    expect(worktreeStateKey('cleaned')).toBe('state.cleaned')
    expect(worktreeActionKey('reclaimDisk')).toBe('action.reclaimDisk')
    for (const hint of WORKTREE_HINTS) expect(worktreeHintKey(hint)).toBe(`hint.${hint}`)
    for (const state of WORKTREE_STATES) {
      expect(worktreeStateKey(state)).toBe(`state.${state}`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
