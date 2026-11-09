// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: { dispatch: vi.fn() },
  setTenantConcurrencyLimitResolver: vi.fn(),
}))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { superAgent: 'super_agent' },
  findUserPreferences: vi.fn(async () => ({ list: [], total: 0 })),
  upsertUserPreference: vi.fn(async () => undefined),
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { findUserPreferences, upsertUserPreference } from '../src/db/user-preferences-queries.js'
import {
  loadSuperAgentSnapshotOnce,
  startSuperAgentPumpLoop,
  stopSuperAgentPumpLoop,
  superAgentHost,
  superAgentPersistHealth,
} from '../src/services/super-agent-pump-service.js'
import { DEFAULT_SUPER_AGENT_POLICY } from '@ihui/shared/super-agent'

const PROVIDER = '11111111-1111-4111-8111-111111111111'

function tick(n: number) {
  return {
    id: `t-${n}`,
    sourceId: 'src-store',
    threadId: `thread-${n}`,
    actorId: 'user-store',
    addressed: true,
    fromBot: false,
    text: `存储任务 ${n}`,
  } as const
}

async function settle(): Promise<void> {
  // 排干 saveChain：连续几个微任务轮 + 定时器一轮
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 5))
}

beforeEach(() => {
  vi.mocked(findUserPreferences).mockReset()
  vi.mocked(upsertUserPreference).mockReset()
  vi.mocked(upsertUserPreference).mockResolvedValue(undefined as never)
  vi.mocked(findUserPreferences).mockResolvedValue({ list: [], total: 0 } as never)
  vi.stubEnv('IHUI_SUPER_AGENT_STATE_ACCOUNT', PROVIDER)
  // 泵间隔给大值；本测试只手动驱动 start/stop 不真跑节拍
  void startSuperAgentPumpLoop(10 * 60_000)
})

afterEach(() => {
  vi.unstubAllEnvs()
  stopSuperAgentPumpLoop()
})

describe('super-agent 持久 store（存算分离接线）', () => {
  it('未供保留账号 ⇒ 状态如实 unconfigured，零触库', async () => {
    vi.stubEnv('IHUI_SUPER_AGENT_STATE_ACCOUNT', '')
    superAgentHost.applyPolicy('user-store', { ...DEFAULT_SUPER_AGENT_POLICY })
    await settle()
    expect(vi.mocked(upsertUserPreference)).not.toHaveBeenCalled()
    expect(superAgentPersistHealth().status).toBe('unconfigured')
    const load = await loadSuperAgentSnapshotOnce()
    expect(load).toMatchObject({ loaded: false, status: 'unconfigured' })
  })

  it('泵一轮后快照落库：group/key/JSON 三键形态对上', async () => {
    superAgentHost.receive(tick(1) as never, 'user-store')
    // 直接跑一轮泵触发 saveIfDirty
    const { superAgentPump } = await import('../src/services/super-agent-pump-service.js')
    await superAgentPump.runOnce()
    await settle()
    const calls = vi.mocked(upsertUserPreference).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const last = calls.at(-1)!
    expect(last[0]).toBe(PROVIDER)
    expect(last[1]).toBe('super_agent')
    expect(last[2]).toBe('state')
    const snap = JSON.parse(String(last[3]))
    expect(snap.version).toBe('super-agent-snapshot-v1')
    expect(snap.owners.map((o: { ownerUserId: string }) => o.ownerUserId)).toContain('user-store')
  })

  it('库读回灌：load 后工单账面对上；写库失败 ⇒ degraded 点名不冒充', async () => {
    superAgentHost.receive(tick(2) as never, 'user-store')
    const { superAgentPump } = await import('../src/services/super-agent-pump-service.js')
    await superAgentPump.runOnce()
    await settle()
    const written = vi.mocked(upsertUserPreference).mock.calls.at(-1)![3]
    vi.mocked(findUserPreferences).mockResolvedValueOnce({
      // 空面板也要 loaded:false —— 模拟读不到
      list: [],
      total: 0,
    } as never)
    const emptyLoad = await loadSuperAgentSnapshotOnce()
    expect(emptyLoad.loaded).toBe(false)
    vi.mocked(findUserPreferences).mockResolvedValueOnce({
      list: [
        {
          id: 'x',
          group: 'super_agent',
          key: 'state',
          value: String(written),
          updatedAt: new Date(),
        },
      ],
      total: 1,
    } as never)
    const load = await loadSuperAgentSnapshotOnce()
    expect(load.loaded).toBe(true)
    expect(load.status).toBe('ok')

    vi.stubEnv('IHUI_SUPER_AGENT_STATE_ACCOUNT', PROVIDER)
    vi.mocked(upsertUserPreference).mockRejectedValueOnce(new Error('fk_violation') as never)
    superAgentHost.receive(tick(3) as never, 'user-store')
    await superAgentPump.runOnce()
    await settle()
    expect(superAgentPersistHealth().status).toBe('degraded')
    expect(superAgentPersistHealth().lastPersistError).toBe('fk_violation')
  })

  it('恢复后重放：同触发再收必 duplicate（持久腿不得制造重开工单）', async () => {
    const accepted = superAgentHost.receive(tick(4) as never, 'user-store')
    const { superAgentPump } = await import('../src/services/super-agent-pump-service.js')
    await superAgentPump.runOnce()
    await settle()
    const written = String(vi.mocked(upsertUserPreference).mock.calls.at(-1)![3])
    const fresh = DEFAULT_SUPER_AGENT_POLICY
    void fresh
    superAgentHost.restore(JSON.parse(written))
    const again = superAgentHost.receive(tick(4) as never, 'user-store')
    expect(again.disposition).toBe('duplicate')
    expect(accepted.disposition).toBe('accepted')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
