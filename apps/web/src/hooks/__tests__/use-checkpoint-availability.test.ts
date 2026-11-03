// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 残余(2026-10-18 立)web 端 checkpoint:availability 状态表回归。
 *
 * 钉住四格:
 *  A 一帧到达即按 workspacePath 落表,并通知订阅者;
 *  B 重复帧不改表(不触发无意义重渲染);
 *  C **乱序旧帧不得覆盖新事实**(生产面给 at,消费端必须认它);
 *  D 不同工作区互不覆盖,表按路径稳定排序。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkpointAvailabilityEvent } from '@ihui/types'

import {
  applyCheckpointAvailabilityEvent,
  clearCheckpointAvailability,
  getCheckpointAvailabilitySnapshot,
  subscribeCheckpointAvailability,
} from '../use-checkpoint-availability'

const WS = '/workspaces/demo'
const AT = '2026-10-18T12:00:00.000Z'

beforeEach(() => {
  clearCheckpointAvailability()
})

describe('checkpoint:availability web 状态表', () => {
  it('A 一帧到达即落表并通知订阅者', () => {
    const listener = vi.fn()
    const off = subscribeCheckpointAvailability(listener)
    const changed = applyCheckpointAvailabilityEvent(
      checkpointAvailabilityEvent({
        workspacePath: WS,
        state: 'available',
        checkpointId: 'cp_1',
        at: AT,
      }),
    )
    expect(changed).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getCheckpointAvailabilitySnapshot()).toEqual([
      { workspacePath: WS, state: 'available', checkpointId: 'cp_1', at: AT },
    ])
    off()
  })

  it('B 重复帧不改表、不通知', () => {
    const evt = checkpointAvailabilityEvent({
      workspacePath: WS,
      state: 'available',
      checkpointId: 'cp_1',
      at: AT,
    })
    applyCheckpointAvailabilityEvent(evt)
    const listener = vi.fn()
    const off = subscribeCheckpointAvailability(listener)
    expect(applyCheckpointAvailabilityEvent(evt)).toBe(false)
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  it('C 乱序旧帧不得覆盖新事实(以 at 判新旧)', () => {
    applyCheckpointAvailabilityEvent(
      checkpointAvailabilityEvent({
        workspacePath: WS,
        state: 'unavailable',
        reason: 'disk full',
        at: '2026-10-18T12:00:05.000Z',
      }),
    )
    const applied = applyCheckpointAvailabilityEvent(
      checkpointAvailabilityEvent({
        workspacePath: WS,
        state: 'available',
        checkpointId: 'cp_old',
        at: AT, // 早于已知事实
      }),
    )
    expect(applied).toBe(false)
    expect(getCheckpointAvailabilitySnapshot()[0]?.state).toBe('unavailable')
  })

  it('D 不同工作区互不覆盖,且按路径稳定排序', () => {
    applyCheckpointAvailabilityEvent(
      checkpointAvailabilityEvent({
        workspacePath: '/workspaces/b',
        state: 'available',
        checkpointId: 'cp_b',
        at: AT,
      }),
    )
    applyCheckpointAvailabilityEvent(
      checkpointAvailabilityEvent({
        workspacePath: '/workspaces/a',
        state: 'unavailable',
        reason: 'boom',
        at: AT,
      }),
    )
    const snap = getCheckpointAvailabilitySnapshot()
    expect(snap.map((e) => e.workspacePath)).toEqual(['/workspaces/a', '/workspaces/b'])
    expect(snap[0]?.state).toBe('unavailable')
    expect(snap[1]?.checkpointId).toBe('cp_b')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
