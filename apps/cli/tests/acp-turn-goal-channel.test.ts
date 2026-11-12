// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合运行态 / 目标态 —— **协议级**验证(走 SDK method registry)。
 *
 * 与 `turn-lifecycle.test.ts` / `turn-store.test.ts` 的分工:
 *   那两个测「判据对不对」;本文件测「方法有没有真的挂到注册表上」。
 *   ACP 对未注册方法回 `-32601`,与"没实现"对客户端是同一个错误 ——
 *   直接调 `agent.xxx()` 的结构性盲区就在这里。
 *
 * 另外钉三条协议层的约定:
 *   ① 拒绝是**结构化返回**而不是 RPC 错误(调用方能区分 terminal/illegal-phase/...);
 *   ② 合成结束缺 detail 必须被拒(不能把"连接断了"伪装成"正常完成");
 *   ③ 目标终态不可再迁,同态迁移按 no-op 拒绝。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setupAgentTools: vi.fn(),
  runToolLoop: vi.fn(),
}))
vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: mocks.setupAgentTools,
  runToolLoop: mocks.runToolLoop,
}))

const acp = await import('@agentclientprotocol/sdk')
const { buildAcpAgentApp } = await import('../src/acp/server.js')
const { createSession, saveSession } = await import('../src/commands/session.js')

let tmpDir: string
let prevSessions: string | undefined
let prevTurns: string | undefined
let prevGoals: string | undefined
let conn: { agent: { request: (m: string, p?: unknown) => Promise<unknown> }; close: () => void } | null

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-acp-turn-'))
  prevSessions = process.env.IHUI_CLI_SESSIONS_DIR
  prevTurns = process.env.IHUI_CLI_TURNS_DIR
  prevGoals = process.env.IHUI_CLI_GOALS_DIR
  process.env.IHUI_CLI_SESSIONS_DIR = path.join(tmpDir, 'sessions')
  process.env.IHUI_CLI_TURNS_DIR = path.join(tmpDir, 'turns')
  process.env.IHUI_CLI_GOALS_DIR = path.join(tmpDir, 'goals')
  conn = null
})

afterEach(() => {
  try {
    conn?.close()
  } catch {
    /* ignore */
  }
  for (const [k, v] of [
    ['IHUI_CLI_SESSIONS_DIR', prevSessions],
    ['IHUI_CLI_TURNS_DIR', prevTurns],
    ['IHUI_CLI_GOALS_DIR', prevGoals],
  ] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function seed(): string {
  const s = createSession(tmpDir, 'turn-model')
  s.history = [{ role: 'user', content: '帮我做一件长时间的事' }] as never
  saveSession(s)
  return s.id
}

function connect() {
  const agentApp = buildAcpAgentApp({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
  const clientApp = acp.client({ name: 'verify-turn' })
  const c = clientApp.connect(agentApp as never) as unknown as {
    agent: { request: (m: string, p?: unknown) => Promise<unknown> }
    close: () => void
  }
  conn = c
  return c
}

type TurnShape = { id: string; phase: string; ordinal: number; reentries: number }

describe('x.ai/turn/* 真的注册在方法表上', () => {
  it('create → consume → commit → complete 全链路可达', async () => {
    const sessionId = seed()
    const c = connect()

    const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }
    expect(created.turn.phase).toBe('prepare')
    expect(created.turn.ordinal).toBe(1)
    const turnId = created.turn.id

    const consuming = (await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId,
      transition: { type: 'begin-consuming', at: 1001 },
    })) as { ok: boolean; turn: TurnShape }
    expect(consuming.ok).toBe(true)
    expect(consuming.turn.phase).toBe('consuming')

    const committing = (await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId,
      transition: { type: 'begin-committing', at: 1002 },
    })) as { ok: boolean; turn: TurnShape }
    expect(committing.turn.phase).toBe('committing')

    const done = (await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId,
      transition: { type: 'complete', at: 1003 },
    })) as { ok: boolean; turn: TurnShape }
    expect(done.turn.phase).toBe('completed')
  })

  it('非法迁移走结构化拒绝,不是 RPC 错误', async () => {
    const sessionId = seed()
    const c = connect()
    const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }

    // prepare 直接 complete —— 必须拒绝,且**不能**抛 RPC 错误
    const res = (await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId: created.turn.id,
      transition: { type: 'complete', at: 1001 },
    })) as { ok: boolean; code?: string }

    expect(res.ok).toBe(false)
    expect(res.code).toBe('illegal-phase')
  })

  it('terminal 拒绝带 terminal 码(与 illegal-phase 可区分)', async () => {
    const sessionId = seed()
    const c = connect()
    const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }
    const turnId = created.turn.id
    await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId,
      transition: { type: 'cancel', at: 1001 },
    })
    const res = (await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId,
      transition: { type: 'begin-consuming', at: 1002 },
    })) as { ok: boolean; code?: string }
    expect(res.ok).toBe(false)
    expect(res.code).toBe('terminal')
  })

  it('x.ai/turn/state 回报活跃回合与告警', async () => {
    const sessionId = seed()
    const c = connect()
    const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }
    await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId: created.turn.id,
      transition: {
        type: 'park',
        at: 1001,
        wake: { reason: 'awaiting-timer', notBefore: 5000 },
      },
    })

    const before = (await c.agent.request('x.ai/turn/state', { sessionId, now: 4000 })) as {
      runtime: { activeTurnId: string | null }
      wakeable: string[]
    }
    expect(before.runtime.activeTurnId).toBe(created.turn.id)
    expect(before.wakeable).toHaveLength(0)

    const after = (await c.agent.request('x.ai/turn/state', { sessionId, now: 5000 })) as {
      wakeable: string[]
    }
    expect(after.wakeable).toContain(created.turn.id)
  })

  it('x.ai/turn/synthetic-finish 缺 detail 必拒;带 detail 收成 synthetic', async () => {
    const sessionId = seed()
    const c = connect()
    const created = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }
    await c.agent.request('x.ai/turn/transition', {
      sessionId,
      turnId: created.turn.id,
      transition: { type: 'begin-consuming', at: 1001 },
    })

    const bad = (await c.agent.request('x.ai/turn/synthetic-finish', {
      sessionId,
      turnId: created.turn.id,
      detail: '   ',
      now: 1002,
    })) as { ok: boolean; code?: string }
    expect(bad.ok).toBe(false)
    expect(bad.code).toBe('missing-synthetic-reason')

    const good = (await c.agent.request('x.ai/turn/synthetic-finish', {
      sessionId,
      turnId: created.turn.id,
      detail: 'stream closed without done frame',
      now: 1003,
    })) as { ok: boolean; turn: { phase: string; endReason?: { kind: string } } }
    expect(good.ok).toBe(true)
    expect(good.turn.phase).toBe('completed')
    expect(good.turn.endReason?.kind).toBe('synthetic')
  })

  it('回合序号随新建递增', async () => {
    const sessionId = seed()
    const c = connect()
    const a = (await c.agent.request('x.ai/turn/create', { sessionId, now: 1000 })) as {
      turn: TurnShape
    }
    const b = (await c.agent.request('x.ai/turn/create', { sessionId, now: 2000 })) as {
      turn: TurnShape
    }
    expect(a.turn.ordinal).toBe(1)
    expect(b.turn.ordinal).toBe(2)
  })

  it('不存在的会话被拒(不静默建空会话)', async () => {
    const c = connect()
    await expect(
      c.agent.request('x.ai/turn/create', { sessionId: 'sess_does_not_exist', now: 1000 }),
    ).rejects.toThrow()
  })
})

describe('x.ai/goal/* 真的注册在方法表上', () => {
  it('create → list → update 全链路', async () => {
    const sessionId = seed()
    const c = connect()

    const created = (await c.agent.request('x.ai/goal/create', {
      sessionId,
      statement: '把长任务闭环补齐',
      now: 1000,
    })) as { goal: { id: string; status: string }; goals: unknown[] }
    expect(created.goal.status).toBe('active')
    expect(created.goals).toHaveLength(1)

    const listed = (await c.agent.request('x.ai/goal/list', { sessionId })) as {
      goals: { id: string }[]
    }
    expect(listed.goals.map((g) => g.id)).toEqual([created.goal.id])

    const updated = (await c.agent.request('x.ai/goal/update', {
      sessionId,
      goalId: created.goal.id,
      status: 'achieved',
      note: '已完成',
      now: 2000,
    })) as { ok: boolean; goal: { status: string; completionNote?: string } }
    expect(updated.ok).toBe(true)
    expect(updated.goal.status).toBe('achieved')
    expect(updated.goal.completionNote).toBe('已完成')
  })

  it('空目标陈述被拒', async () => {
    const sessionId = seed()
    const c = connect()
    await expect(
      c.agent.request('x.ai/goal/create', { sessionId, statement: '   ', now: 1000 }),
    ).rejects.toThrow()
  })

  it('终态不可再迁;同态迁移按 no-op 拒绝', async () => {
    const sessionId = seed()
    const c = connect()
    const created = (await c.agent.request('x.ai/goal/create', {
      sessionId,
      statement: 'x',
      now: 1000,
    })) as { goal: { id: string } }

    await c.agent.request('x.ai/goal/update', {
      sessionId,
      goalId: created.goal.id,
      status: 'achieved',
      now: 2000,
    })

    const again = (await c.agent.request('x.ai/goal/update', {
      sessionId,
      goalId: created.goal.id,
      status: 'abandoned',
      now: 3000,
    })) as { ok: boolean; code?: string }
    expect(again.ok).toBe(false)
    expect(again.code).toBe('illegal-status')

    const noop = (await c.agent.request('x.ai/goal/update', {
      sessionId,
      goalId: created.goal.id,
      status: 'achieved',
      now: 3000,
    })) as { ok: boolean; code?: string }
    expect(noop.ok).toBe(false)
    expect(noop.code).toBe('no-op')
  })

  it('不存在的目标被拒且带 not-found', async () => {
    const sessionId = seed()
    const c = connect()
    const res = (await c.agent.request('x.ai/goal/update', {
      sessionId,
      goalId: 'goal_nope',
      status: 'achieved',
      now: 1000,
    })) as { ok: boolean; code?: string }
    expect(res.ok).toBe(false)
    expect(res.code).toBe('not-found')
  })
})
