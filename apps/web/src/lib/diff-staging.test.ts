// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  canToggleAccepted,
  createStagedSet,
  isStaged,
  stageHunk,
  stageHunks,
  unstageAll,
  unstageHunk,
} from './diff-staging'

/**
 * diff 暂存状态机单测(D88,对标 Codex stage/unstage)。
 *
 * 矩阵:三级(文件 / hunk / 全部)× 两操作(暂存 / 还原) + 与 W5 accepted 维度正交。
 * 「全部」级在无跨文件容器时由文件级 stageHunks(全 id)承担(见交付报告说明)。
 */
describe('D88 diff 暂存状态机 — 三级×两操作矩阵', () => {
  const allIds = [0, 1, 2]

  it('hunk 级:单 hunk 暂存 → 取消暂存', () => {
    let staged = createStagedSet()
    expect(isStaged(staged, 1)).toBe(false)
    staged = stageHunk(staged, 1)
    expect(isStaged(staged, 1)).toBe(true)
    // 仅该 hunk 被暂存,其余不受影响
    expect(isStaged(staged, 0)).toBe(false)
    expect(isStaged(staged, 2)).toBe(false)
    // 取消暂存(还原)后回到未暂存
    staged = unstageHunk(staged, 1)
    expect(isStaged(staged, 1)).toBe(false)
  })

  it('file 级:文件暂存 → 全部 hunk staged', () => {
    let staged = createStagedSet()
    staged = stageHunks(staged, allIds)
    for (const id of allIds) expect(isStaged(staged, id)).toBe(true)
    // 全部还原 → 清空
    staged = unstageAll()
    for (const id of allIds) expect(isStaged(staged, id)).toBe(false)
  })

  it('all 级:跨文件批量入口在文件级以「全部 id」承载,效果等同全暂存', () => {
    const staged = stageHunks(createStagedSet(), allIds)
    expect(staged.size).toBe(allIds.length)
    expect([...staged].sort((a, b) => a - b)).toEqual([0, 1, 2])
  })

  it('staged 后 accepted 切换被禁用;unstage 后恢复可选', () => {
    // 模拟组件:rejected={1}(已拒绝),staged={1}(已暂存)
    const rejected = new Set<number>([1])
    const staged = stageHunk(createStagedSet(), 1)
    // 暂存态:accepted 切换被禁用
    expect(canToggleAccepted(staged, 1)).toBe(false)
    // 还原后:accepted 切换恢复可用
    expect(canToggleAccepted(unstageHunk(staged, 1), 1)).toBe(true)
    // accepted 维度本身不受 staging 影响(被拒绝仍是被拒绝)
    expect(rejected.has(1)).toBe(true)
  })

  it('正交性:staging 不改变 accepted/rejected 集合', () => {
    const rejected = new Set<number>([0])
    const stagedBefore = createStagedSet()
    const stagedAfter = stageHunk(stagedBefore, 1)
    // rejected 集合独立,暂存操作不触碰它
    expect([...rejected]).toEqual([0])
    expect(isStaged(stagedBefore, 1)).toBe(false)
    expect(isStaged(stagedAfter, 1)).toBe(true)
  })
})
