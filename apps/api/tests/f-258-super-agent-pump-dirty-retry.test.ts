// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn() },
  setTenantConcurrencyLimitResolver: vi.fn(),
}))
// 测试隔离铁律:持久腿触库的模块必须 mock(本 service 静态 import user-preferences-queries)
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { upsertUserPreference } from '../src/db/user-preferences-queries.js'
import {
  superAgentHost,
  superAgentPersistHealth,
  superAgentPump,
} from '../src/services/super-agent-pump-service.js'
import { DEFAULT_SUPER_AGENT_POLICY } from '@ihui/shared/super-agent'

const PROVIDER = '11111111-1111-4111-8111-111111111111'
const OWNER = 'user-f258'

let clock = Date.UTC(2026, 10, 13, 0, 0, 0)

/** 触发宿主账面变更（applyPolicy 只标脏、不开工单，不触文件系统）。 */
function markDirty(): void {
  superAgentHost.applyPolicy(OWNER, { ...DEFAULT_SUPER_AGENT_POLICY })
}

/** 假时钟下排干微任务即可，不需要真等。 */
async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await Promise.resolve()
}

beforeEach(async () => {
  vi.useFakeTimers()
  clock += 3_600_000
  vi.setSystemTime(clock)
  vi.stubEnv('IHUI_SUPER_AGENT_STATE_ACCOUNT', PROVIDER)
  vi.mocked(upsertUserPreference).mockReset()
  vi.mocked(upsertUserPreference).mockResolvedValue(undefined as never)
  // 失败用例会把 dirty 留在 true：先跑一次成功落库把上一用例的账清干净。
  markDirty()
  await superAgentPump.runOnce()
  await flush()
  vi.mocked(upsertUserPreference).mockClear()
  // 场景起点必须晚于基线落库的 takenAt，否则「同 takenAt 不写」会干扰断言。
  clock += 60_000
  vi.setSystemTime(clock)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('F-258 超级智能体快照失败后可重试（dirty 不被提前清）', () => {
  it('① 首次落库失败后 dirty 仍为 true（修复前会被提前清成 false）', async () => {
    vi.mocked(upsertUserPreference).mockRejectedValueOnce(new Error('pg_down') as never)
    markDirty()
    await superAgentPump.runOnce()
    await flush()

    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)
    const health = superAgentPersistHealth()
    expect(health.dirty).toBe(true)
    expect(health.status).toBe('degraded')
    expect(health.lastPersistError).toBe('pg_down')
  })

  it('② 下一次 onCycle 重试并成功：dirty 归零、落库共 2 次', async () => {
    vi.mocked(upsertUserPreference).mockRejectedValueOnce(new Error('pg_down') as never)
    markDirty()
    await superAgentPump.runOnce()
    await flush()
    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)
    expect(superAgentPersistHealth().dirty).toBe(true)

    // 周期腿（onCycle）在下一次节拍直接接上重试，不依赖退避定时器是否已到点。
    await superAgentPump.runOnce()
    await flush()

    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(2)
    const health = superAgentPersistHealth()
    expect(health.dirty).toBe(false)
    expect(health.status).toBe('ok')
    expect(health.lastPersistError).toBeNull()
  })

  it('③ 落库期间又来新脏数据：成功后不被误清（seq guard）', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.mocked(upsertUserPreference).mockImplementationOnce(() => gate as never)
    markDirty()
    await superAgentPump.runOnce()
    await flush()
    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)

    // 写库在飞时再来一笔账面变更（并发写）。
    markDirty()
    release()
    await flush()

    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)
    expect(superAgentPersistHealth().dirty).toBe(true)
  })

  it('④ 失败按有界退避重排：推进一个退避窗口只落库一次（无紧循环）', async () => {
    vi.mocked(upsertUserPreference).mockRejectedValue(new Error('pg_down') as never)
    markDirty()
    await superAgentPump.runOnce()
    await flush()
    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)

    vi.mocked(upsertUserPreference).mockClear()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)

    // 下一档退避是 2s：再推进 999ms 不得有新落库。
    await vi.advanceTimersByTimeAsync(999)
    expect(vi.mocked(upsertUserPreference)).toHaveBeenCalledTimes(1)
    expect(superAgentPersistHealth().dirty).toBe(true)
  })

  it('⑤ 并发保护：两个周期同时在飞时落库不并发（在飞峰值 ≤1）', async () => {
    let active = 0
    let peak = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.mocked(upsertUserPreference).mockImplementation(async () => {
      active += 1
      peak = Math.max(peak, active)
      await gate
      active -= 1
      return undefined as never
    })
    markDirty()
    const first = superAgentPump.runOnce()
    const second = superAgentPump.runOnce()
    await flush()
    expect(peak).toBe(1)

    release()
    await Promise.all([first, second])
    await flush()
    expect(peak).toBe(1)
    expect(active).toBe(0)
    expect(superAgentPersistHealth().dirty).toBe(false)
  })
})
