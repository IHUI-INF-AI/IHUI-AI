// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 标准会话生命周期 —— **协议级**验证(走 SDK 的 method registry,不是直接调类方法)。
 *
 * 为什么这一层不可省:
 *   ACP SDK 对**未注册**的方法回 `-32601 Method not found`,而"实现了但忘了在
 *   `.onRequest(...)` 注册"与"根本没实现"对客户端是同一个错误。
 *   `acp-session-replay.test.ts` 直接调 `agent.xxx()`,绕过了注册表,
 *   因此**结构上无法**发现漏注册。
 *
 * 实现方式:用 SDK 自带的 `client.app.connect(agentApp)` —— SDK 文档明确说明
 *   这是给测试用的进程内直连,不做 transport,也不需要起子进程。
 *   (先前尝试起真子进程,被仓内既有的 `packages/shared` 无扩展名 ESM 导入挡住,
 *    那是与本次改动无关的既有问题,已另行记录。)
 *
 * 对照依据(REA E1):ACP SDK 1.3.0 `AGENT_METHODS` 含
 * session/{resume,fork,list,delete};本仓原先只注册 new/load/prompt/close。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 只 mock agent.js(它会拉起工具与网络);ACP 协议层与 session 层保持真实。
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
const { createSession, saveSession, loadSession } = await import('../src/commands/session.js')

let tmpDir: string
let prevEnv: string | undefined
let app: unknown
let conn: { agent: { request: (m: string, p?: unknown) => Promise<unknown> }; close: () => void } | null

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-acp-proto-'))
  prevEnv = process.env.IHUI_CLI_SESSIONS_DIR
  process.env.IHUI_CLI_SESSIONS_DIR = tmpDir
  conn = null
})

afterEach(() => {
  try {
    conn?.close()
  } catch {
    /* ignore */
  }
  if (prevEnv === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR
  else process.env.IHUI_CLI_SESSIONS_DIR = prevEnv
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function seed(history: { role: string; content: string }[]) {
  const s = createSession(tmpDir, 'e2e-model')
  s.history = history as never
  saveSession(s)
  return s.id
}

/** 起一条进程内真实 ACP 连接(客户端侧 → agent 侧),返回客户端调用面。 */
function connect() {
  const agentApp = buildAcpAgentApp({
    apiUrl: 'http://127.0.0.1:1',
    apiKey: 'k',
  } as never)
  const clientApp = acp.client({ name: 'verify-lifecycle' })
  const c = clientApp.connect(agentApp as never) as unknown as {
    agent: { request: (m: string, p?: unknown) => Promise<unknown> }
    close: () => void
  }
  conn = c
  return c
}

describe('ACP 标准会话方法真的注册在 method registry 上', () => {
  it('initialize 可达并声明 loadSession', async () => {
    const c = connect()
    const res = (await c.agent.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 't', version: '1.0.0' },
    })) as { agentCapabilities?: { loadSession?: boolean } }
    expect(res.agentCapabilities?.loadSession).toBe(true)
  })

  it('session/list 可达(不是 -32601)且能看到落盘会话与 title', async () => {
    const id = seed([
      { role: 'user', content: '端到端问题一' },
      { role: 'assistant', content: '端到端回答一' },
    ])
    const c = connect()
    const res = (await c.agent.request('session/list', { cwd: tmpDir })) as {
      sessions: { sessionId: string; title?: string | null }[]
    }
    expect(Array.isArray(res.sessions)).toBe(true)
    const hit = res.sessions.find((s) => s.sessionId === id)
    expect(hit).toBeDefined()
    expect(hit!.title).toBe('端到端问题一')
  })

  it('session/resume 带合法游标可达且回 planKind=window', async () => {
    const id = seed([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ])
    const c = connect()
    const res = (await c.agent.request('session/resume', {
      sessionId: id,
      replayFrom: { type: 'ihui.replay/turn', last: 10 },
    })) as { _meta: { planKind: string } }
    expect(res._meta.planKind).toBe('window')
  })

  it('session/resume 对非法游标回错误(且不是 -32601)', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const c = connect()
    await expect(
      c.agent.request('session/resume', { sessionId: id, replayFrom: { type: 'wrong', last: 1 } }),
    ).rejects.toMatchObject({ code: expect.not.stringMatching(/^-32601$/) })
  })

  it('session/fork 可达,产出新会话且真的落盘', async () => {
    const id = seed([
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ])
    const c = connect()
    const res = (await c.agent.request('session/fork', { sessionId: id })) as { sessionId: string }
    expect(res.sessionId).not.toBe(id)
    expect(fs.existsSync(path.join(tmpDir, `${res.sessionId}.json`))).toBe(true)
  })

  it('session/set_mode 可达;plan/build/review 三档可切,非法模式被点名拒绝', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const c = connect()
    for (const m of ['plan', 'review', 'build']) {
      const r = (await c.agent.request('session/set_mode', { sessionId: id, modeId: m })) as {
        _meta: { modeId: string }
      }
      expect(r._meta.modeId).toBe(m)
    }
    await expect(
      c.agent.request('session/set_mode', { sessionId: id, modeId: 'turbo' }),
    ).rejects.toThrow(/不支持的模式/)
  })

  it('session/set_config_option 可达;model 落盘,未知 configId 被点名拒绝', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const c = connect()
    const r = (await c.agent.request('session/set_config_option', {
      sessionId: id,
      configId: 'model',
      value: 'claude-sonnet-4',
    })) as { configOptions: { id: string; currentValue: string }[] }
    expect(r.configOptions[0]!.currentValue).toBe('claude-sonnet-4')
    expect(loadSession(id)!.modelId).toBe('claude-sonnet-4')
    await expect(
      c.agent.request('session/set_config_option', {
        sessionId: id,
        configId: 'theme',
        value: 'dark',
      }),
    ).rejects.toThrow(/不支持的 configId/)
  })

  it('session/delete 可达且幂等', async () => {
    const id = seed([{ role: 'user', content: 'q' }])
    const c = connect()
    await c.agent.request('session/delete', { sessionId: id })
    expect(loadSession(id)).toBeNull()
    await expect(c.agent.request('session/delete', { sessionId: id })).resolves.toBeDefined()
  })
})
