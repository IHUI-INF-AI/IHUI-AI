// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌​​​‌‌‍‍‌​‌‌​‌‍‍​​‌‌​​​‌‍‍​​‌‌​​‌‌‍‍‌​‌‌​‌​​‍‍‌​‌​‌‌‍⁠

/**
 * F-40 回归锁:后台 Agent 的 `agents`/`tasks` 两张模块级 Map 必须有回收路径。
 *
 * 修前:两张表只增不删 —— `cancel` 只改状态,任务结算后的 Promise 永久留在 `tasks`,
 * 长驻进程里 prompt/result/events 无上限增长。修后契约:
 *   ① `finishedAt` 在进入 completed/failed/cancelled 时落 nowSec(running 为 null);
 *   ② `sweep()` 惰性回收:先清"终态且超过 TTL"的 agent,再按 createdAt 从旧到新
 *      淘汰终态至上限,`running` 永不淘汰;
 *   ③ `start()` 入表前 sweep、`cancel()` 落终态后 sweep,不引入 setInterval;
 *   ④ task 在 finally 里按身份复核摘除(`this.tasks.get(agentId) === task`),不会误删
 *      同 id 的新任务。
 *
 * 隔离:直接 new BackgroundAgentManager + seedForTest 注入 agent,不真跑 agentLoop,
 * 不连 DB/Redis;唯一落盘是 cancel() 的 persist,afterEach 按 agentId 清理。
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BG_AGENT_TERMINAL_TTL_SEC,
  BackgroundAgentManager,
  MAX_BACKGROUND_AGENTS,
  type BackgroundAgent,
} from '../src/services/workspace-ai-service.js'

const USER = '00000000-0000-4000-8000-0000000000f4'
const SERVICE_SRC = fileURLToPath(
  new URL('../src/services/workspace-ai-service.ts', import.meta.url),
)
const AGENTS_DIR = join(homedir(), '.ihui', 'background-agents')

let manager: BackgroundAgentManager
let seq = 0
const persistedIds: string[] = []

function nowSec(): number {
  return Date.now() / 1000
}

function makeAgent(over: Partial<BackgroundAgent> = {}): BackgroundAgent {
  seq += 1
  const agentId = over.agentId ?? `f40-agent-${seq}`
  return {
    agentId,
    prompt: `prompt-${agentId}`,
    workspacePath: '/tmp/f40-workspace',
    modelId: 'default',
    userUuid: USER,
    status: 'running',
    createdAt: 1_700_000_000 + seq,
    finishedAt: null,
    events: [],
    result: null,
    ...over,
  }
}

beforeEach(() => {
  manager = new BackgroundAgentManager()
  seq = 0
})

afterEach(() => {
  manager.resetForTest()
  for (const agentId of persistedIds.splice(0)) {
    const file = join(AGENTS_DIR, `${agentId}.summary.json`)
    if (existsSync(file)) rmSync(file, { force: true })
  }
})

describe('F-40 · 后台 Agent 资源回收', () => {
  it('sweep 清掉超过 TTL 的终态,未过期终态与 running 保留', () => {
    const expired = makeAgent({
      status: 'completed',
      finishedAt: nowSec() - BG_AGENT_TERMINAL_TTL_SEC - 1,
    })
    const fresh = makeAgent({ status: 'failed', finishedAt: nowSec() - 10 })
    const running = makeAgent()
    for (const agent of [expired, fresh, running]) manager.seedForTest(agent)

    manager.sweep()

    expect(manager.get(expired.agentId, USER)).toBeNull()
    expect(manager.get(fresh.agentId, USER)).not.toBeNull()
    expect(manager.get(running.agentId, USER)).not.toBeNull()
    expect(manager.list(USER).map((agent) => agent.agentId)).toEqual([
      fresh.agentId,
      running.agentId,
    ])
  })

  it('超上限时按 createdAt 从旧到新淘汰终态,running 一个都不淘汰', () => {
    const runningIds: string[] = []
    for (let i = 0; i < MAX_BACKGROUND_AGENTS + 10; i += 1) {
      const agent = makeAgent({ createdAt: 1_700_000_000 + i })
      runningIds.push(agent.agentId)
      manager.seedForTest(agent)
    }
    const terminalIds: string[] = []
    for (let i = 0; i < 5; i += 1) {
      // 终态未过期(TTL 阶段不会清),只能靠上限淘汰;
      // createdAt 比全部 running 都新 —— 证明淘汰规则是"终态优先",不是"最旧优先"。
      const agent = makeAgent({
        status: 'cancelled',
        finishedAt: nowSec(),
        createdAt: 1_700_000_000 + 10_000 + i,
      })
      terminalIds.push(agent.agentId)
      manager.seedForTest(agent)
    }
    expect(manager.list(USER)).toHaveLength(MAX_BACKGROUND_AGENTS + 15)

    manager.sweep()

    expect(manager.list(USER)).toHaveLength(MAX_BACKGROUND_AGENTS + 10)
    for (const agentId of terminalIds) expect(manager.get(agentId, USER)).toBeNull()
    for (const agentId of runningIds) expect(manager.get(agentId, USER)).not.toBeNull()
  })

  it('cancel 落终态时写 finishedAt,取消后仍可读,过期后由后续 sweep 清掉', () => {
    const agent = makeAgent()
    manager.seedForTest(agent)
    expect(agent.finishedAt).toBeNull()

    expect(manager.cancel(agent.agentId, USER)).toBe(true)
    persistedIds.push(agent.agentId)

    expect(agent.status).toBe('cancelled')
    expect(typeof agent.finishedAt).toBe('number')
    expect(Math.abs((agent.finishedAt as number) - nowSec())).toBeLessThan(5)
    // 回收不是"取消即删":调用方仍能读到终态与结果
    expect(manager.get(agent.agentId, USER)?.status).toBe('cancelled')

    // 只有超过 TTL 才会被下一次 sweep 回收
    agent.finishedAt = nowSec() - BG_AGENT_TERMINAL_TTL_SEC - 1
    manager.sweep()
    expect(manager.get(agent.agentId, USER)).toBeNull()
  })

  it('源码形状:start 入表前 sweep、cancel 后 sweep、tasks 在 finally 按身份摘除、无 setInterval', () => {
    const source = readFileSync(SERVICE_SRC, 'utf-8')

    const startIdx = source.indexOf('  start(params: {')
    expect(startIdx).toBeGreaterThan(-1)
    const sweepInStartIdx = source.indexOf('this.sweep()', startIdx)
    const setIdx = source.indexOf('this.agents.set(agentId, agent)', startIdx)
    expect(sweepInStartIdx).toBeGreaterThan(startIdx)
    expect(sweepInStartIdx).toBeLessThan(setIdx)

    const cancelIdx = source.indexOf('  cancel(agentId: string, userId: string): boolean {')
    expect(cancelIdx).toBeGreaterThan(-1)
    expect(source.indexOf('this.sweep()', cancelIdx)).toBeGreaterThan(cancelIdx)

    expect(source).toContain('if (this.tasks.get(agentId) === task) this.tasks.delete(agentId)')

    // 惰性清理:BackgroundAgents 段落内不得出现进程级定时器
    const sectionStart = source.indexOf('// 10. BackgroundAgents')
    const sectionEnd = source.indexOf('// 11. Permissions')
    expect(sectionStart).toBeGreaterThan(-1)
    expect(sectionEnd).toBeGreaterThan(sectionStart)
    expect(source.slice(sectionStart, sectionEnd)).not.toContain('setInterval(')
  })
})
