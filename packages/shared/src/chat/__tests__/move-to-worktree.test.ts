// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D102 对话移交工作树 · 判定层用例(G-140)。
// 四条分支名校验逐条正反例(含**顺序敏感性**:多条同时命中只报第一条)、
// 运行中禁止(canMoveNow 复用 D71 turn-status)、空态、提交门。

import { describe, expect, it } from 'vitest'

import { TERMINAL_TURN_STATES, type TurnState } from '../turn-status'
import {
  MOVE_TO_WORKTREE_KEYS,
  MOVE_TO_WORKTREE_PRECHECKS,
  MOVE_TO_WORKTREE_TARGETS,
  branchListView,
  canMoveNow,
  moveToWorktreeKey,
  precheckStatusKey,
  submitView,
  validateWorktreeBranch,
} from '../move-to-worktree'

describe('D102 四条分支名校验(逐条正反例 + 顺序敏感性)', () => {
  it('正例:合法分支名通过(不与默认分支冲突、不在已存在名单)', () => {
    expect(validateWorktreeBranch('feat/d102-move', { defaultBranch: 'main', existingBranches: ['main'] })).toEqual({
      ok: true,
      errorKey: null,
    })
  })

  it('规则一 worktreeBranchRequired:空串 / 纯空白 / null / undefined 都挡', () => {
    for (const bad of ['', '   ', null, undefined]) {
      expect(validateWorktreeBranch(bad).errorKey, String(bad)).toBe('worktreeBranchRequired')
    }
  })

  it('规则二 trailingSlashError:以"/"结尾挡(中间的"/"合法)', () => {
    expect(validateWorktreeBranch('feat/').errorKey).toBe('trailingSlashError')
    expect(validateWorktreeBranch('feat/d102').errorKey).toBeNull()
  })

  it('规则三 defaultBranchError:与默认分支同名挡;默认分支未知(null)不误伤', () => {
    expect(validateWorktreeBranch('main', { defaultBranch: 'main' }).errorKey).toBe('defaultBranchError')
    expect(validateWorktreeBranch('main', { defaultBranch: null }).errorKey).toBeNull()
    expect(validateWorktreeBranch('main').errorKey).toBeNull()
  })

  it('规则四 branchAlreadyExists:命中已存在名单挡;名单未知不误伤', () => {
    expect(validateWorktreeBranch('wt/a', { existingBranches: ['wt/a'] }).errorKey).toBe('branchAlreadyExists')
    expect(validateWorktreeBranch('wt/a').errorKey).toBeNull()
    expect(validateWorktreeBranch('wt/a', { existingBranches: [] }).errorKey).toBeNull()
  })

  it('顺序敏感:required 最先(空名即使同时违反其余规则也只报 required)', () => {
    expect(
      validateWorktreeBranch('  ', { defaultBranch: 'main', existingBranches: ['main'] }).errorKey,
    ).toBe('worktreeBranchRequired')
  })

  it('顺序敏感:trailingSlash 先于 defaultBranch / alreadyExists', () => {
    expect(
      validateWorktreeBranch('main/', { defaultBranch: 'main/', existingBranches: ['main/'] }).errorKey,
    ).toBe('trailingSlashError')
  })

  it('顺序敏感:defaultBranch 先于 alreadyExists(两名单都命中时只报 defaultBranch)', () => {
    expect(
      validateWorktreeBranch('main', { defaultBranch: 'main', existingBranches: ['main'] }).errorKey,
    ).toBe('defaultBranchError')
  })

  it('空白两端修剪后参与校验(输入" main "等价于 main)', () => {
    expect(validateWorktreeBranch(' main ', { defaultBranch: 'main' }).errorKey).toBe('defaultBranchError')
  })
})

describe('D102 运行中禁止态 canMoveNow(复用 D71 turn-status)', () => {
  it('turn 终态(completed/failed/stopped)⇒ 可移交', () => {
    for (const state of TERMINAL_TURN_STATES) expect(canMoveNow(state), state).toBe(true)
  })

  it('turn 活跃态(thinking 等非终态)⇒ 禁止移交', () => {
    const active: TurnState[] = ['queued', 'preparing', 'thinking', 'usingTool', 'waitingConfirm', 'backgroundRunning', 'stopping']
    for (const state of active) expect(canMoveNow(state), state).toBe(false)
  })

  it('turn 状态缺失(null/undefined)不臆断 ⇒ 不禁止(与 isSingleWriterViolation 同纪律)', () => {
    expect(canMoveNow(null)).toBe(true)
    expect(canMoveNow(undefined)).toBe(true)
  })
})

describe('D102 前置检查三态与空态', () => {
  it('precheckStatusKey:loading/error → 分支三态键,ready → null(穷尽三态)', () => {
    expect(precheckStatusKey('loading')).toBe('branchesLoading')
    expect(precheckStatusKey('error')).toBe('branchesError')
    expect(precheckStatusKey('ready')).toBeNull()
    expect(MOVE_TO_WORKTREE_PRECHECKS).toEqual(['loading', 'ready', 'error'])
  })

  it('branchListView:loading/error 只给状态键,不给分支', () => {
    expect(branchListView('loading', ['a'])).toEqual({ statusKey: 'branchesLoading', empty: false, branches: [] })
    expect(branchListView('error', null)).toEqual({ statusKey: 'branchesError', empty: false, branches: [] })
  })

  it('branchListView:ready 且无其他本地分支 ⇒ 空态 noTargetBranch', () => {
    expect(branchListView('ready', [])).toEqual({ statusKey: null, empty: true, branches: [] })
    expect(branchListView('ready', null)).toEqual({ statusKey: null, empty: true, branches: [] })
    expect(branchListView('ready', undefined)).toEqual({ statusKey: null, empty: true, branches: [] })
  })

  it('branchListView:ready 且有分支 ⇒ 非空态并原样下发名单', () => {
    expect(branchListView('ready', ['feat/a', 'feat/b'])).toEqual({
      statusKey: null,
      empty: false,
      branches: ['feat/a', 'feat/b'],
    })
  })
})

describe('D102 提交门 submitView', () => {
  const base = {
    target: 'createNew' as const,
    branch: 'feat/d102',
    defaultBranch: 'main',
    existingWorktreeBranches: [],
  }

  it('校验通过且非运行中 ⇒ 可 continue', () => {
    expect(submitView({ ...base, turnState: 'completed', precheck: 'ready' })).toEqual({
      canContinue: true,
      blockKey: null,
    })
  })

  it('运行中(turn 活跃)⇒ existingWorktreeRunning,先于其余一切检查', () => {
    expect(submitView({ ...base, turnState: 'thinking', precheck: 'error', branch: '' })).toEqual({
      canContinue: false,
      blockKey: 'existingWorktreeRunning',
    })
  })

  it('前置检查 loading ⇒ branchesLoading;error ⇒ branchesError', () => {
    expect(submitView({ ...base, turnState: 'completed', precheck: 'loading' }).blockKey).toBe('branchesLoading')
    expect(submitView({ ...base, turnState: 'completed', precheck: 'error' }).blockKey).toBe('branchesError')
  })

  it('前置检查通过后分支校验不过 ⇒ 原样下发首个错误键', () => {
    expect(
      submitView({ ...base, turnState: 'completed', precheck: 'ready', branch: 'feat/' }).blockKey,
    ).toBe('trailingSlashError')
    expect(
      submitView({ ...base, turnState: 'completed', precheck: 'ready', branch: 'main' }).blockKey,
    ).toBe('defaultBranchError')
    expect(
      submitView({ ...base, turnState: 'completed', precheck: 'ready', existingWorktreeBranches: ['feat/d102'] }).blockKey,
    ).toBe('branchAlreadyExists')
  })

  it('目标两态 createNew / existing 齐备;existing 未选定 ⇒ worktreeBranchRequired', () => {
    expect(MOVE_TO_WORKTREE_TARGETS).toEqual(['createNew', 'existing'])
    expect(
      submitView({ target: 'existing', turnState: 'completed', precheck: 'ready', branch: null }).blockKey,
    ).toBe('worktreeBranchRequired')
  })

  it('existing 目标:选定名单内分支 ⇒ 可继续(branchAlreadyExists 不适用于既有名单,否则门焊死)', () => {
    expect(
      submitView({
        target: 'existing',
        turnState: 'completed',
        precheck: 'ready',
        branch: 'wt/one',
        existingWorktreeBranches: ['wt/one'],
      }),
    ).toEqual({ canContinue: true, blockKey: null })
  })
})

describe('D102 键面', () => {
  it('词包 21 键白名单与键名生成器', () => {
    expect(MOVE_TO_WORKTREE_KEYS.length).toBe(21)
    expect(moveToWorktreeKey('continue')).toBe('continue')
    expect(moveToWorktreeKey('existingWorktreeRunning')).toBe('existingWorktreeRunning')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
