// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 变更请求台账判据(2026-11-13 立)
 *
 * 判据:面板只认这三条纯函数 —— 不允端内另写一套"当前分支是哪条/能不能建 PR"的判断,
 * 否则两端对同一条快照会给出不同结论(一边给创建入口、一边不给)。
 */

import { describe, expect, it } from 'vitest'
import {
  canCreateChangeRequest,
  deriveChangeRequestCounts,
  findCurrentBranchChangeRequest,
  githubCheckRunState,
  type ChangeRequestItem,
  type ChangeRequestSnapshot,
} from '../src/change-request.js'

const item = (over: Partial<ChangeRequestItem> = {}): ChangeRequestItem => ({
  number: 1,
  title: 'feat: demo',
  url: 'https://github.com/o/r/pull/1',
  state: 'open',
  draft: false,
  author: 'alice',
  headBranch: 'feat/demo',
  baseBranch: 'main',
  updatedAt: '2026-11-13T00:00:00.000Z',
  isCurrentBranch: false,
  checks: null,
  ...over,
})

const snapshot = (over: Partial<ChangeRequestSnapshot> = {}): ChangeRequestSnapshot => ({
  provider: 'github',
  supported: true,
  unsupportedReason: null,
  repo: { owner: 'o', repo: 'r' },
  currentBranch: 'feat/demo',
  defaultBranch: 'main',
  credentialsReady: true,
  fetchFailed: false,
  items: [item()],
  fetchedAt: '2026-11-13T00:00:00.000Z',
  ...over,
})

describe('change-request / GitHub check-run 映射', () => {
  it('未完成状态一律 pending(即使带了 conclusion)', () => {
    for (const status of ['queued', 'in_progress', 'waiting', 'requested']) {
      expect(githubCheckRunState(status, null)).toBe('pending')
      expect(githubCheckRunState(status, 'success')).toBe('pending')
    }
  })

  it('completed 时按 conclusion 归并:success→passed / failure→failed', () => {
    expect(githubCheckRunState('completed', 'success')).toBe('passed')
    expect(githubCheckRunState('COMPLETED', 'FAILURE')).toBe('failed')
  })

  it('GitHub 专有失败结论 timed_out / action_required / startup_failure → failed', () => {
    for (const conclusion of ['timed_out', 'action_required', 'startup_failure']) {
      expect(githubCheckRunState('completed', conclusion)).toBe('failed')
    }
  })

  it('cancelled → skipped,neutral / stale → neutral', () => {
    expect(githubCheckRunState('completed', 'cancelled')).toBe('skipped')
    expect(githubCheckRunState('completed', 'neutral')).toBe('neutral')
    expect(githubCheckRunState('completed', 'stale')).toBe('neutral')
  })

  it('completed 但结论缺失/未知 → unknown(不宣称成功)', () => {
    expect(githubCheckRunState('completed', null)).toBe('unknown')
    expect(githubCheckRunState('completed', '')).toBe('unknown')
    expect(githubCheckRunState('completed', 'wat')).toBe('unknown')
    expect(githubCheckRunState(null, null)).toBe('unknown')
  })
})

describe('change-request / 当前分支命中', () => {
  it('命中第一条 isCurrentBranch 的条目', () => {
    const hit = item({ number: 7, isCurrentBranch: true })
    expect(findCurrentBranchChangeRequest([item(), hit])?.number).toBe(7)
  })

  it('空数组 / null / undefined 一律返回 null(不抛错)', () => {
    expect(findCurrentBranchChangeRequest([])).toBeNull()
    expect(findCurrentBranchChangeRequest(null)).toBeNull()
    expect(findCurrentBranchChangeRequest(undefined)).toBeNull()
  })
})

describe('change-request / 四态计数', () => {
  it('各态分别计数,缺失态记 0', () => {
    const counts = deriveChangeRequestCounts([
      item({ state: 'open' }),
      item({ state: 'open' }),
      item({ state: 'draft' }),
      item({ state: 'merged' }),
    ])
    expect(counts).toEqual({ open: 2, draft: 1, merged: 1, closed: 0 })
  })

  it('空列表四态全 0', () => {
    expect(deriveChangeRequestCounts([])).toEqual({ open: 0, draft: 0, merged: 0, closed: 0 })
  })
})

describe('change-request / 创建入口判据', () => {
  it('凭据就绪 + 非默认分支 + 当前分支无 PR → 可创建', () => {
    expect(canCreateChangeRequest(snapshot({ items: [] }))).toBe(true)
  })

  it('当前分支已有变更请求 → 不可创建(避免重复 PR)', () => {
    expect(canCreateChangeRequest(snapshot({ items: [item({ isCurrentBranch: true })] }))).toBe(
      false,
    )
  })

  it('默认分支 / 无默认分支 / 无当前分支 → 不可创建', () => {
    expect(canCreateChangeRequest(snapshot({ currentBranch: 'main', items: [] }))).toBe(false)
    expect(canCreateChangeRequest(snapshot({ defaultBranch: null, items: [] }))).toBe(false)
    expect(canCreateChangeRequest(snapshot({ currentBranch: null, items: [] }))).toBe(false)
  })

  it('平台不支持 / 凭据缺失 / 无 repo / 空快照 → 不可创建', () => {
    expect(canCreateChangeRequest(snapshot({ supported: false, items: [] }))).toBe(false)
    expect(canCreateChangeRequest(snapshot({ credentialsReady: false, items: [] }))).toBe(false)
    expect(canCreateChangeRequest(snapshot({ repo: null, items: [] }))).toBe(false)
    expect(canCreateChangeRequest(null)).toBe(false)
    expect(canCreateChangeRequest(undefined)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
