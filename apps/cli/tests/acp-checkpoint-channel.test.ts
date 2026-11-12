// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP checkpoint 通道 —— **协议级**验证(走 method registry,不是直接调类方法)。
 *
 * 为什么要有这一层:
 *   本仓 `Checkpoints`(快照/列举/读取/还原/差异/删除 + 损坏隔离 + GC)早已完整,
 *   但在本轮之前 `server.ts` 里对 `CheckpointManager` 的引用只有 `new ...`,
 *   **零个 onRequest** —— 编辑器侧完全看不到检查点。这与 session 生命周期是同一类
 *   缺口:"能力有,但没接到协议名上"。
 *
 *   对照依据(REA E1):WorkBuddy `@genie/agent-harness` 把 checkpoint 做成三个
 *   一等 RPC(`checkpoint/rpcs.js`: list / read / restore),读取响应经
 *   `decodeAgentHarnessCheckpointReadResponse` 严格解码,解不出即抛
 *   "session storage response has invalid checkpoint read data"。
 *
 * 隔离:快照根固定在 `~/.ihui/checkpoints`(无环境变量覆盖),因此本测试
 *   把 `HOME`/`USERPROFILE` 指向临时目录,**绝不写入真实用户目录**。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({
  setupAgentTools: vi.fn(),
  runToolLoop: vi.fn(),
}))
vi.mock('../src/commands/agent.js', () => ({
  setupAgentTools: mocks.setupAgentTools,
  runToolLoop: mocks.runToolLoop,
}))

const acp = await import('@agentclientprotocol/sdk')

let homeDir: string
let sessionsDir: string
let workspaceDir: string
const saved: Record<string, string | undefined> = {}
let conn: { agent: { request: (m: string, p?: unknown) => Promise<unknown> }; close: () => void } | null

beforeEach(() => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cp-home-'))
  sessionsDir = path.join(homeDir, 'sessions')
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cp-ws-'))
  fs.mkdirSync(sessionsDir, { recursive: true })
  for (const k of ['HOME', 'USERPROFILE', 'IHUI_CLI_SESSIONS_DIR']) saved[k] = process.env[k]
  process.env.HOME = homeDir
  process.env.USERPROFILE = homeDir
  process.env.IHUI_CLI_SESSIONS_DIR = sessionsDir
  conn = null
})

afterEach(() => {
  try {
    conn?.close()
  } catch {
    /* ignore */
  }
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  fs.rmSync(homeDir, { recursive: true, force: true })
  fs.rmSync(workspaceDir, { recursive: true, force: true })
})

async function connect() {
  const { buildAcpAgentApp } = await import('../src/acp/server.js')
  const app = buildAcpAgentApp({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
  const client = acp.client({ name: 'verify-checkpoint' })
  const c = client.connect(app as never) as unknown as {
    agent: { request: (m: string, p?: unknown) => Promise<unknown> }
    close: () => void
  }
  conn = c
  return c
}

async function seedSessionWithFile() {
  const { createSession, saveSession } = await import('../src/commands/session.js')
  const { CheckpointManager } = await import('../src/checkpoints/index.js')
  const s = createSession(workspaceDir, 'cp-model')
  s.history = [{ role: 'user', content: 'checkpoint 测试' }] as never
  saveSession(s)
  // 写一个受检文件,并做一次真实快照
  const target = path.join(workspaceDir, 'note.txt')
  fs.writeFileSync(target, 'v1', 'utf8')
  const mgr = new CheckpointManager({ sessionId: s.id, workspacePath: workspaceDir })
  const meta = mgr.snapshotSync(['note.txt'], 'unit-test')
  return { sessionId: s.id, checkpointId: meta.id, target }
}

describe('ACP checkpoint 通道(协议级)', () => {
  it('x.ai/checkpoint/list 可达并列出刚做的快照', async () => {
    const { sessionId } = await seedSessionWithFile()
    const c = await connect()
    const res = (await c.agent.request('x.ai/checkpoint/list', { sessionId })) as {
      checkpoints: { id: string; fileCount: number }[]
    }
    expect(Array.isArray(res.checkpoints)).toBe(true)
    expect(res.checkpoints.length).toBe(1)
    expect(res.checkpoints[0]!.fileCount).toBe(1)
  })

  it('x.ai/checkpoint/read 回摘要与 diff(不含 files 明细)', async () => {
    const { sessionId, checkpointId, target } = await seedSessionWithFile()
    // diffSnapshotFiles 的语义是「只列**有变化**的条目」——文件与快照一致时返回空数组,
    // 不是「列出全部受检文件」。所以要先改动文件,才能验证 diff 真的在工作。
    fs.writeFileSync(target, 'v2-modified', 'utf8')
    const c = await connect()
    const res = (await c.agent.request('x.ai/checkpoint/read', { sessionId, checkpointId })) as {
      checkpoint: { id: string; reason: string }
      diff: { path: string; status: string }[]
    }
    expect(res.checkpoint.id).toBe(checkpointId)
    expect(res.checkpoint.reason).toBe('unit-test')
    const entry = res.diff.find((d) => d.path === 'note.txt')
    expect(entry, 'diff 必须点名被改动的文件').toBeDefined()
    expect(entry!.status).toBe('modified')
    // 摘要里不得出现 files 明细(那是内部存储形状)
    expect(Object.hasOwn(res.checkpoint as object, 'files')).toBe(false)
  })

  it('x.ai/checkpoint/read 文件未变时 diff 为空(不把"无变化"说成"未测量")', async () => {
    const { sessionId, checkpointId } = await seedSessionWithFile()
    const c = await connect()
    const res = (await c.agent.request('x.ai/checkpoint/read', { sessionId, checkpointId })) as {
      diff: { path: string; status: string }[]
    }
    expect(res.diff).toEqual([])
  })

  it('x.ai/checkpoint/read 对不存在的检查点报"不存在"(不折成空对象)', async () => {
    const { sessionId } = await seedSessionWithFile()
    const c = await connect()
    await expect(
      c.agent.request('x.ai/checkpoint/read', { sessionId, checkpointId: 'cp_missing' }),
    ).rejects.toThrow(/不存在/)
  })

  it('x.ai/checkpoint/restore 真的把文件还原并回 complete=true', async () => {
    const { sessionId, checkpointId, target } = await seedSessionWithFile()
    fs.writeFileSync(target, 'v2-changed', 'utf8')
    const c = await connect()
    const res = (await c.agent.request('x.ai/checkpoint/restore', { sessionId, checkpointId })) as {
      restored: string[]
      complete: boolean
    }
    expect(res.complete).toBe(true)
    expect(res.restored).toContain('note.txt')
    expect(fs.readFileSync(target, 'utf8')).toBe('v1')
  })

  it('会话不存在时 list 报错(不返回空清单冒充"没有检查点")', async () => {
    const c = await connect()
    await expect(
      c.agent.request('x.ai/checkpoint/list', { sessionId: 'sess_absent' }),
    ).rejects.toThrow(/not found/)
  })
})
