// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ACP 会话生命周期接线单测。
 *
 * 分工(这是本文件的核心主张):
 *   - 游标解析 / 回合索引 / 分页判据 —— 全部在 `@ihui/shared` 的
 *     `durable-session-replay.ts`,连同它自己的 `__tests__` 一起是唯一真相源;
 *     本文件**不重新测一遍那些规则**(重测 = 抄第二份判据)。
 *   - 本文件只测**接线**:四个标准 ACP 方法是否真的挂在 agent 上、
 *     是否真的读写了本机会话文件、非法游标是否真的被拒而不是静默降级。
 *
 * 背景(REA E1):ACP SDK 1.3.0 的 `AGENT_METHODS` 定义了
 * session/{resume,fork,list,delete},本仓原先只注册了 new/load/prompt/close。
 * 对照程序 WorkBuddy 的 harness(`protocol/acp-v2-sdk.js`)把
 * `session_resume` / `session_fork` / `session_list` 作为一等方法。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { planAcpReplay, type AcpReplayOutcome } from '../src/acp/session-replay.js'

function outcomeOrThrow(o: AcpReplayOutcome) {
  if (!o.ok) throw new Error(`expected ok, got ${o.code}: ${o.message}`)
  return o
}

describe('planAcpReplay(共享层 → ACP 帧的翻译)', () => {
  const messages = [
    { id: 'm0', role: 'user', content: '问题一' },
    { id: 'm1', role: 'assistant', content: '回答一' },
    { id: 'm2', role: 'user', content: '问题二' },
    { id: 'm3', role: 'assistant', content: '回答二' },
  ]
  const items = messages.map((m, i) => ({
    id: m.id,
    kind: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
  }))

  it('游标缺失 ⇒ 共享层判 skip,翻译层产出零帧(不冒充"全量重放")', () => {
    const o = outcomeOrThrow(planAcpReplay({ items, messages, replayFrom: undefined }))
    expect(o.planKind).toBe('skip')
    expect(o.notifications).toEqual([])
  })

  it('一页只回一个回合(last=1):帧数与内容都落在同一回合内', () => {
    const o = outcomeOrThrow(
      planAcpReplay({ items, messages, replayFrom: { type: 'ihui.replay/turn', last: 1 } }),
    )
    expect(o.planKind).toBe('window')
    // 一回合 = 一条 user + 一条 assistant(共享层的回合切分规则)
    expect(o.notifications.length).toBeGreaterThanOrEqual(1)
    for (const n of o.notifications) {
      expect(['user_message_chunk', 'agent_message_chunk']).toContain(n.sessionUpdate)
      expect(n.content.type).toBe('text')
    }
  })

  it('非 user/assistant 的条目不会被翻成气泡帧', () => {
    const withSystem = [
      { id: 's0', role: 'system', content: '系统提示' },
      ...messages,
    ]
    const withSysItems = withSystem.map((m, i) => ({
      id: m.id,
      kind: (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'other') as
        | 'user'
        | 'assistant'
        | 'other',
    }))
    const o = outcomeOrThrow(
      planAcpReplay({
        items: withSysItems,
        messages: withSystem,
        replayFrom: { type: 'ihui.replay/turn', last: 10 },
      }),
    )
    const texts = o.notifications.map((n) => n.content.text)
    expect(texts).not.toContain('系统提示')
  })

  it('非法游标由共享层拒绝,翻译层如实透出 code/message(不改写成"空页")', () => {
    const o = planAcpReplay({ items, messages, replayFrom: { type: 'nope', last: 1 } })
    expect(o.ok).toBe(false)
    if (!o.ok) {
      expect(o.code).toBe('invalid_replay')
      expect(o.message).toContain('ihui.replay/turn')
    }
  })

  it('共享层拒绝 after(回放页不接受 after,靠 before 回溯)', () => {
    const o = planAcpReplay({
      items,
      messages,
      replayFrom: { type: 'ihui.replay/turn', last: 1, after: 'x' },
    })
    expect(o.ok).toBe(false)
    if (!o.ok) expect(o.message).toContain('after')
  })

  it('未知字段被点名拒绝', () => {
    const o = planAcpReplay({
      items,
      messages,
      replayFrom: { type: 'ihui.replay/turn', last: 1, bogus: true },
    })
    expect(o.ok).toBe(false)
    if (!o.ok) expect(o.message).toContain('bogus')
  })
})

describe('ACP 标准会话方法接线(真实文件系统)', () => {
  let tmpDir: string
  let prevEnv: string | undefined

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-acp-life-'))
    prevEnv = process.env.IHUI_CLI_SESSIONS_DIR
    process.env.IHUI_CLI_SESSIONS_DIR = tmpDir
  })

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.IHUI_CLI_SESSIONS_DIR
    else process.env.IHUI_CLI_SESSIONS_DIR = prevEnv
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('四个标准方法都真的挂载在 agent 原型上(不是只有类型声明)', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const proto = IhuiAcpAgent.prototype as unknown as Record<string, unknown>
    for (const m of ['listSessions', 'resumeSession', 'forkSession', 'deleteSessionFile']) {
      expect(typeof proto[m], `${m} 必须存在`).toBe('function')
    }
  })

  it('list 按 cwd 过滤并给出 title(取首条 user 消息)', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)

    const s = createSession(tmpDir, 'test-model')
    s.history = [
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '第一个回答' },
    ]
    saveSession(s)

    const listed = await agent.listSessions({ cwd: tmpDir })
    expect(listed.sessions.map((x) => x.sessionId)).toContain(s.id)
    expect(listed.sessions[0]!.title).toBe('第一个问题')

    // 别处的 cwd 不应看到这场会话
    const other = await agent.listSessions({ cwd: path.join(tmpDir, 'elsewhere') })
    expect(other.sessions).toEqual([])
  })

  it('空会话的 title 为 null(不编造标题)', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    const s = createSession(tmpDir, 'm')
    saveSession(s)
    const listed = await agent.listSessions({ cwd: tmpDir })
    expect(listed.sessions[0]!.title).toBeNull()
  })

  it('fork 复制历史并生成新 id;改父不影响子(值拷贝)', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession, loadSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    const s = createSession(tmpDir, 'test-model')
    s.history = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]
    saveSession(s)

    const forked = await agent.forkSession({ sessionId: s.id })
    expect(forked.sessionId).not.toBe(s.id)
    const child = loadSession(forked.sessionId)!
    expect(child.history).toHaveLength(2)

    child.history[0]!.content = 'child changed'
    saveSession(child)
    expect(loadSession(s.id)!.history[0]!.content).toBe('q')
  })

  it('fork 源会话不存在 ⇒ 抛错', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    await expect(agent.forkSession({ sessionId: 'sess_missing' })).rejects.toThrow(/not found/)
  })

  it('delete 幂等:删不存在的会话不抛错', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    await expect(agent.deleteSessionFile({ sessionId: 'sess_not_exist_xyz' })).resolves.toEqual({})
  })

  it('delete 后 list 里不再出现', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession, loadSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    const s = createSession(tmpDir, 'm')
    saveSession(s)
    await agent.deleteSessionFile({ sessionId: s.id })
    expect(loadSession(s.id)).toBeNull()
    const listed = await agent.listSessions({ cwd: tmpDir })
    expect(listed.sessions).toEqual([])
  })

  it('resume 用非法游标 ⇒ 抛错(不静默从头重放)', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    const s = createSession(tmpDir, 'm')
    s.history = [{ role: 'user', content: 'q' }]
    saveSession(s)
    await expect(
      agent.resumeSession({ sessionId: s.id, replayFrom: { type: 'wrong-type', last: 1 } }, {
        notify: async () => {},
      } as never),
    ).rejects.toThrow(/ihui\.replay\/turn/)
  })

  it('resume 会话不存在 ⇒ 抛错', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    await expect(
      agent.resumeSession({ sessionId: 'sess_missing' }, { notify: async () => {} } as never),
    ).rejects.toThrow(/not found/)
  })

  it('resume 缺省游标 ⇒ 回最后一页并给出分页 meta', async () => {
    const { IhuiAcpAgent } = await import('../src/acp/server.js')
    const { createSession, saveSession } = await import('../src/commands/session.js')
    const agent = new IhuiAcpAgent({ apiUrl: 'http://127.0.0.1:1', apiKey: 'k' } as never)
    const s = createSession(tmpDir, 'm')
    s.history = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]
    saveSession(s)
    const sent: unknown[] = []
    const res = await agent.resumeSession({ sessionId: s.id }, {
      notify: async (_m: string, payload: unknown) => {
        sent.push(payload)
      },
    } as never)
    expect(res._meta.planKind).toBe('window')
    expect(typeof res._meta.hasNextPage).toBe('boolean')
    // 至少把这一回合的正文发出去了
    expect(sent.length).toBeGreaterThan(0)
  })
})
