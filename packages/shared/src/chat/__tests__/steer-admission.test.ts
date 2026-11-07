// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  RUNNING_STEER_REJECT_REASONS,
  admitRunningSteer,
  refillDraftAfterWithdraw,
  runningSteerRejectCopyKey,
  steerCapabilityOf,
  type RunningSteerFacts,
} from '../steer-admission'

const openTurn = {
  capability: 'supported',
  awaitingApproval: false,
  isControlCommand: false,
  queueChanged: false,
  hasRunningTurn: true,
} as const satisfies RunningSteerFacts

describe('admitRunningSteer', () => {
  it('能力已声明支持且 Turn 在跑：准入 steer', () => {
    expect(admitRunningSteer(openTurn)).toEqual({ disposition: 'steer' })
  })

  it('能力未声明：不把“没读到”当成不支持，仍准入 steer', () => {
    expect(steerCapabilityOf(null)).toBe('undeclared')
    expect(steerCapabilityOf(undefined)).toBe('undeclared')
    expect(admitRunningSteer({ ...openTurn, capability: 'undeclared' })).toEqual({
      disposition: 'steer',
    })
  })

  it('显式不支持：转入待发队列并点名 runtimeNoInterject', () => {
    expect(steerCapabilityOf(false)).toBe('unsupported')
    expect(admitRunningSteer({ ...openTurn, capability: 'unsupported' })).toEqual({
      disposition: 'queue',
      reason: 'runtimeNoInterject',
    })
  })

  it('等用户审批：正文留在输入框，不注入正在等决策的 Turn', () => {
    expect(admitRunningSteer({ ...openTurn, awaitingApproval: true })).toEqual({
      disposition: 'hold',
      reason: 'awaitingApproval',
    })
  })

  it('控制命令：不能插入运行中的 Turn，转入待发队列', () => {
    expect(admitRunningSteer({ ...openTurn, isControlCommand: true })).toEqual({
      disposition: 'queue',
      reason: 'controlCommand',
    })
  })

  it('队列已变：不把过期快照写回去，正文留在输入框', () => {
    expect(admitRunningSteer({ ...openTurn, queueChanged: true })).toEqual({
      disposition: 'hold',
      reason: 'queueChanged',
    })
  })

  it('没有运行中的 Turn：inactive，转入待发队列（正文不丢）', () => {
    expect(admitRunningSteer({ ...openTurn, hasRunningTurn: false })).toEqual({
      disposition: 'queue',
      reason: 'noRunningTurn',
    })
  })

  it('没有落点优先于能力缺口：两边同时命中时出因是 noRunningTurn', () => {
    expect(
      admitRunningSteer({
        ...openTurn,
        hasRunningTurn: false,
        capability: 'unsupported',
      }),
    ).toEqual({ disposition: 'queue', reason: 'noRunningTurn' })
  })

  it('五因文案键互不相同，且都落在既有 inputNotices 键上', () => {
    expect(RUNNING_STEER_REJECT_REASONS).toHaveLength(5)
    const keys = RUNNING_STEER_REJECT_REASONS.map((reason) => runningSteerRejectCopyKey(reason))
    expect(new Set(keys).size).toBe(5)
    for (const key of keys) {
      expect(key.startsWith('queue.')).toBe(true)
    }
  })
})

describe('refillDraftAfterWithdraw', () => {
  it('空输入框：撤回文本原样回填', () => {
    expect(refillDraftAfterWithdraw('', '换一个思路')).toBe('换一个思路')
  })

  it('已有草稿：换行接在后面，不覆盖', () => {
    expect(refillDraftAfterWithdraw('还在写', '换一个思路')).toBe('还在写\n换一个思路')
  })

  it('撤回文本为空：输入框不动', () => {
    expect(refillDraftAfterWithdraw('还在写', '')).toBe('还在写')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
