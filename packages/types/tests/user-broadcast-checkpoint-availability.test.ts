// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D163 残余(2026-10-18 立)`checkpoint:availability` 帧的构造与解析回归。
 * 权威口径:PROJECT_PLAN 协议通道②/③ 那一行(与 D154 `mcp:status` 同型追加)。
 *
 * 钉住的四格,每一格都对应一个"账面绿而用户看不见"的失效:
 *  A **构造点在位且拒坏值**:空 workspacePath / 未知 state / `available` 说不出
 *    checkpointId / `unavailable` 却带着 id,都必须抛。
 *  B **载荷里没有主体**:带 `userId` / `user_id` 的一律判不合法(AGENTS §5)。
 *  C **解析侧与构造侧同一套规则**:构造侧拒的,parse 侧同样拦。
 *  D **扩档不得挤掉旧档**:事件清单三档齐在,未知事件名 parse 返回 null。
 */
import { describe, it, expect } from 'vitest'

import {
  CHECKPOINT_AVAILABILITY_STATES,
  USER_BROADCAST_EVENT_NAMES,
  checkpointAvailabilityEvent,
  isCheckpointAvailabilityState,
  parseUserBroadcastFrame,
} from '../src/user-broadcast'

const AT = '2026-10-18T12:00:00.000Z'

describe('checkpoint A 构造出口在位且拒坏值', () => {
  it('封闭集恰为两档(available / unavailable)', () => {
    expect([...CHECKPOINT_AVAILABILITY_STATES].sort()).toEqual(['available', 'unavailable'])
    for (const s of CHECKPOINT_AVAILABILITY_STATES)
      expect(isCheckpointAvailabilityState(s)).toBe(true)
    expect(isCheckpointAvailabilityState('building')).toBe(false)
  })

  it('正向:available 帧逐字成形(workspacePath 去首尾空白)', () => {
    const evt = checkpointAvailabilityEvent({
      workspacePath: '  /workspaces/demo  ',
      state: 'available',
      checkpointId: 'cp_1',
      at: AT,
    })
    expect(evt).toEqual({
      event: 'checkpoint:availability',
      data: { workspacePath: '/workspaces/demo', state: 'available', checkpointId: 'cp_1', at: AT },
    })
  })

  it('正向:unavailable 带 reason,不带 checkpointId', () => {
    const evt = checkpointAvailabilityEvent({
      workspacePath: '/workspaces/demo',
      state: 'unavailable',
      reason: 'disk full',
      at: AT,
    })
    expect(evt.data.checkpointId).toBeUndefined()
    expect(evt.data.reason).toBe('disk full')
  })

  it('反向:空工作区 / 未知状态 / 可用无 id / 不可用带 id / 坏时间 都抛', () => {
    expect(() =>
      checkpointAvailabilityEvent({ workspacePath: '   ', state: 'available', checkpointId: 'c' }),
    ).toThrow(/workspacePath/)
    expect(() =>
      checkpointAvailabilityEvent({ workspacePath: '/w', state: 'building' as never }),
    ).toThrow(/未知状态/)
    expect(() => checkpointAvailabilityEvent({ workspacePath: '/w', state: 'available' })).toThrow(
      /checkpointId/,
    )
    expect(() =>
      checkpointAvailabilityEvent({ workspacePath: '/w', state: 'unavailable', checkpointId: 'c' }),
    ).toThrow(/不得携带 checkpointId/)
    expect(() =>
      checkpointAvailabilityEvent({
        workspacePath: '/w',
        state: 'available',
        checkpointId: 'c',
        at: 'x',
      }),
    ).toThrow(/不是时间/)
  })
})

describe('checkpoint B 主体不得从载荷进来', () => {
  it('载荷里出现 userId / user_id ⇒ 整帧判不合法(parse 返回 null)', () => {
    const base = {
      event: 'checkpoint:availability',
      data: { workspacePath: '/w', state: 'available', checkpointId: 'c', at: AT },
    }
    expect(parseUserBroadcastFrame({ ...base, data: { ...base.data, userId: 'u' } })).toBeNull()
    expect(parseUserBroadcastFrame({ ...base, data: { ...base.data, user_id: 'u' } })).toBeNull()
    // 阳性对照:去掉那两个键必须被认出 —— 否则上面两条可能只是"函数根本不认这个事件"
    expect(parseUserBroadcastFrame(base)).not.toBeNull()
  })
})

describe('checkpoint C 解析侧与构造侧同一套规则', () => {
  it('正向:构造出来的帧 parse 后原样认出', () => {
    const evt = checkpointAvailabilityEvent({
      workspacePath: '/w',
      state: 'available',
      checkpointId: 'cp_9',
      at: AT,
    })
    const parsed = parseUserBroadcastFrame(evt)
    expect(parsed?.event).toBe('checkpoint:availability')
    if (parsed && parsed.event === 'checkpoint:availability') {
      expect(parsed.data.checkpointId).toBe('cp_9')
      expect(parsed.data.at).toBe(AT)
    }
  })

  it('反向:构造侧拒的形态 parse 侧同样拒;合法对照必须通过', () => {
    const bad = (data: Record<string, unknown>): unknown =>
      parseUserBroadcastFrame({ event: 'checkpoint:availability', data })
    expect(bad({ workspacePath: '', state: 'available', checkpointId: 'c', at: AT })).toBeNull()
    expect(bad({ workspacePath: '/w', state: 'nope', checkpointId: 'c', at: AT })).toBeNull()
    expect(bad({ workspacePath: '/w', state: 'available', at: AT })).toBeNull()
    expect(bad({ workspacePath: '/w', state: 'unavailable', checkpointId: 'c', at: AT })).toBeNull()
    expect(bad({ workspacePath: '/w', state: 'available', checkpointId: 'c', at: 'x' })).toBeNull()
    expect(
      bad({ workspacePath: '/w', state: 'unavailable', reason: 'boom', at: AT }),
    ).not.toBeNull()
  })
})

describe('checkpoint D 事件清单与未知事件名', () => {
  it('扩展后三档齐在(新事件不得挤掉 D153/D154 那两档)', () => {
    expect(USER_BROADCAST_EVENT_NAMES).toContain('conversation:updated')
    expect(USER_BROADCAST_EVENT_NAMES).toContain('mcp:status')
    expect(USER_BROADCAST_EVENT_NAMES).toContain('checkpoint:availability')
  })

  it('不认识的事件名不静默通过(parse 返回 null)', () => {
    expect(
      parseUserBroadcastFrame({ event: 'checkpoint:created', data: { workspacePath: '/w' } }),
    ).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
