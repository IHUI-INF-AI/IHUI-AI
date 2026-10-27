// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-21 格⑤ 同族:工作区锁心跳的「驱逐前身份判」回归(2026-10-28)。
 *
 * 缺陷形态(修复前):`_tick` 拿 `ok=false` 后按 key 无条件 `stopLockHeartbeat(taskId)`。
 * 旧 token 的 renew 还在途时若发生 re-dispatch(同 taskId 重新 startLockHeartbeat、换了新
 * token),旧 tick 回来就把**新的**心跳停掉 —— 新锁从此无人续期,TTL 到点静默过期,
 * 且这条路径既不回写 blocked 也不广播(失效方向是安静)。
 *
 * 判据(三条):
 *  ① 登记已被新一次启动取代时,旧 tick 的失败**不得**停掉新心跳、不得写库、不得广播;
 *  ② 正向对照:没有取代者时,续期失败仍按契约停心跳 + 回写 blocked + SSE(不许把修复做成"永不判死");
 *  ③ renew 抛瞬时异常时不判死,下一轮照旧续期。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  renew: vi.fn(),
  release: vi.fn(),
  broadcast: vi.fn(),
  dbRows: [] as unknown[],
  updateCalls: 0,
}))

vi.mock('../src/services/workspace-lock.js', () => ({
  WORKSPACE_LOCK_TTL: 120,
  renewWorkspaceLock: mocks.renew,
  releaseWorkspaceLock: mocks.release,
}))

vi.mock('../src/services/agent-sse-bus.js', () => ({
  broadcastSSEEvent: mocks.broadcast,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => mocks.dbRows,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          mocks.updateCalls++
        },
      }),
    }),
  },
}))

import {
  startLockHeartbeat,
  stopLockHeartbeat,
  _resetLockHeartbeats,
} from '../src/services/workspace-lock-heartbeat.js'

/** 与生产同源:TICK = WORKSPACE_LOCK_TTL(120s) * 1000 / 3 */
const TICK_MS = 40_000

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('workspace-lock-heartbeat 驱逐前身份判(格⑤ 同族)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetLockHeartbeats()
    mocks.renew.mockReset()
    mocks.broadcast.mockReset()
    mocks.dbRows = []
    mocks.updateCalls = 0
  })

  afterEach(() => {
    _resetLockHeartbeats()
    vi.useRealTimers()
  })

  it('① 旧 tick 失败时登记已被新 token 取代 → 新心跳存活(续期照发),不写库、不广播', async () => {
    let resolveStale: (v: boolean) => void = () => {}
    mocks.renew.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveStale = resolve
      }),
    )
    mocks.renew.mockResolvedValue(true)

    startLockHeartbeat('task-1', 'ws-1', 'tok-A')
    // 第一次 tick 起飞,renew 挂在 pending 上
    await vi.advanceTimersByTimeAsync(TICK_MS)
    expect(mocks.renew).toHaveBeenCalledWith('ws-1', 'tok-A')

    // re-dispatch:同 taskId 换新 token,旧计时器被清、新登记/新计时器就位
    startLockHeartbeat('task-1', 'ws-1', 'tok-B')

    // 旧 tick 现在才回来,报"续期失败"
    resolveStale(false)
    await flush()

    // 修复前:这里已经把 tok-B 的心跳停掉了 ⇒ 下一轮不会有任何 renew
    await vi.advanceTimersByTimeAsync(TICK_MS)

    const tokens = mocks.renew.mock.calls.map((c) => c[1])
    expect(tokens).toContain('tok-B')
    expect(mocks.updateCalls).toBe(0)
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('② 正向对照:无取代者时续期失败仍停心跳 + 回写 blocked + SSE(不许做成永不判死)', async () => {
    mocks.renew.mockResolvedValue(false)
    mocks.dbRows = [
      {
        id: 'task-2',
        teamId: 'team-2',
        workspacePath: 'ws-2',
        payload: { workspaceLockToken: 'tok-C' },
      },
    ]

    startLockHeartbeat('task-2', 'ws-2', 'tok-C')
    await vi.advanceTimersByTimeAsync(TICK_MS)
    await flush()

    expect(mocks.updateCalls).toBe(1)
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'workspace_lock_released',
        payload: expect.objectContaining({ reason: 'heartbeat_lost', released: false }),
      }),
    )

    // 心跳已停:再推进一个周期不再续期
    await vi.advanceTimersByTimeAsync(TICK_MS)
    expect(mocks.renew).toHaveBeenCalledTimes(1)
  })

  it('③ renew 抛瞬时异常 → 不判死,下一轮照旧续期', async () => {
    mocks.renew.mockRejectedValueOnce(new Error('redis hiccup'))
    mocks.renew.mockResolvedValue(true)

    startLockHeartbeat('task-3', 'ws-3', 'tok-D')
    await vi.advanceTimersByTimeAsync(TICK_MS)
    await flush()
    expect(mocks.updateCalls).toBe(0)
    expect(mocks.broadcast).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(TICK_MS)
    expect(mocks.renew.mock.calls.filter((c) => c[1] === 'tok-D').length).toBe(2)
  })

  it('④ 行内 token 已被并发 transition 改写 → 不覆盖别人的结果(既有契约不回退)', async () => {
    mocks.renew.mockResolvedValue(false)
    mocks.dbRows = [
      {
        id: 'task-4',
        teamId: 'team-4',
        workspacePath: 'ws-4',
        payload: { workspaceLockToken: 'tok-OTHER' },
      },
    ]

    startLockHeartbeat('task-4', 'ws-4', 'tok-E')
    await vi.advanceTimersByTimeAsync(TICK_MS)
    await flush()

    expect(mocks.updateCalls).toBe(0)
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })
})

describe('stopLockHeartbeat 幂等', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    _resetLockHeartbeats()
    mocks.renew.mockReset()
  })

  afterEach(() => {
    _resetLockHeartbeats()
    vi.useRealTimers()
  })

  it('重复 stop 不抛错,停止后不再续期', async () => {
    mocks.renew.mockResolvedValue(true)
    startLockHeartbeat('task-5', 'ws-5', 'tok-F')
    stopLockHeartbeat('task-5')
    expect(() => stopLockHeartbeat('task-5')).not.toThrow()
    await vi.advanceTimersByTimeAsync(TICK_MS)
    expect(mocks.renew).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
