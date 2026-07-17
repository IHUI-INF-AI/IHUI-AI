/**
 * REPL Sessions 持久化集成测试 — 验证新 sessions 模块在 REPL 流程中的用法。
 *
 * 测试范围:
 *   1. saveSession + loadSession → 数据往返一致(messages/status/cwd 保留)
 *   2. saveSession + listSessions → 列表包含该 session(且包含 status 字段)
 *   3. saveSession + deleteSession → 列表不再包含
 *   4. pruneOldSessions → 旧 session 被清理(用真实时间戳)
 *   5. loadSession(不存在) → 返回 null
 *   6. 模拟 REPL 退出保存流程:saveSession(status='completed') + 重新 loadSession 恢复 messages
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  pruneOldSessions,
  newSessionId,
  type SessionState,
  type SessionMessage,
} from '../src/sessions/index.js'

let tmpStateDir: string

beforeEach(() => {
  tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-repl-sess-'))
  process.env.IHUI_SESSION_STATE_DIR = tmpStateDir
})

afterEach(() => {
  delete process.env.IHUI_SESSION_STATE_DIR
  if (tmpStateDir && fs.existsSync(tmpStateDir)) {
    fs.rmSync(tmpStateDir, { recursive: true, force: true })
  }
})

function makeMessage(role: SessionMessage['role'], content: string): SessionMessage {
  return { role, content, timestamp: new Date().toISOString() }
}

function makeReplLikeSession(overrides: Partial<SessionState> = {}): SessionState {
  const now = new Date().toISOString()
  return {
    id: newSessionId(),
    sessionId: 'repl-' + Math.random().toString(36).slice(2),
    createdAt: now,
    updatedAt: now,
    model: 'test-model',
    messages: [],
    status: 'completed',
    cwd: '/tmp/workspace',
    ...overrides,
  }
}

describe('REPL Sessions 模块往返一致性', () => {
  it('saveSession + loadSession → 数据往返一致(messages/status/cwd 保留)', () => {
    const s = makeReplLikeSession({
      messages: [
        makeMessage('user', '帮我修复 bug'),
        makeMessage('assistant', '已修复,改动如下...'),
      ],
      status: 'completed',
      cwd: '/home/user/project',
    })
    saveSession(s)
    const loaded = loadSession(s.id)
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual(s)
    expect(loaded!.messages).toHaveLength(2)
    expect(loaded!.messages[0]!.content).toBe('帮我修复 bug')
    expect(loaded!.status).toBe('completed')
    expect(loaded!.cwd).toBe('/home/user/project')
  })

  it('saveSession + listSessions → 列表包含该 session(且包含 status 字段)', () => {
    const s = makeReplLikeSession({
      messages: [makeMessage('user', 'a'), makeMessage('assistant', 'b')],
      status: 'completed',
    })
    saveSession(s)
    const list = listSessions()
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe(s.id)
    expect(list[0]!.status).toBe('completed')
    expect(list[0]!.createdAt).toBe(s.createdAt)
    expect(list[0]!.updatedAt).toBe(s.updatedAt)
    // 摘要不包含 messages
    expect((list[0] as unknown as Record<string, unknown>).messages).toBeUndefined()
  })

  it('saveSession + deleteSession → 列表不再包含', () => {
    const a = makeReplLikeSession({ messages: [makeMessage('user', 'a')] })
    const b = makeReplLikeSession({ messages: [makeMessage('user', 'b')] })
    saveSession(a)
    saveSession(b)
    expect(listSessions()).toHaveLength(2)

    expect(deleteSession(a.id)).toBe(true)
    expect(listSessions()).toHaveLength(1)
    expect(listSessions()[0]!.id).toBe(b.id)
    expect(loadSession(a.id)).toBeNull()
  })

  it('pruneOldSessions → 旧 session 被清理,新 session 保留', () => {
    const oldTime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const old = makeReplLikeSession({
      updatedAt: oldTime,
      messages: [makeMessage('user', 'old')],
      status: 'completed',
    })
    saveSession(old)
    const recent = makeReplLikeSession({
      messages: [makeMessage('user', 'recent')],
      status: 'completed',
    })
    saveSession(recent)

    const removed = pruneOldSessions(7 * 24 * 60 * 60 * 1000)
    expect(removed).toBe(1)
    expect(loadSession(old.id)).toBeNull()
    expect(loadSession(recent.id)).not.toBeNull()
    expect(listSessions()).toHaveLength(1)
    expect(listSessions()[0]!.id).toBe(recent.id)
  })

  it('loadSession(不存在) → 返回 null', () => {
    expect(loadSession('nonexistent-repl-session-id-12345')).toBeNull()
  })
})

describe('模拟 REPL 退出保存 + 重新启动恢复流程', () => {
  it('REPL 退出时 saveSession(completed) → 重新启动 loadSession 恢复 messages', () => {
    // 模拟 REPL 退出时保存(Sessions 模块集成 rl.on('close'))
    const originalMessages: SessionMessage[] = [
      makeMessage('user', '第一步:分析代码'),
      makeMessage('assistant', '已分析,继续...'),
      makeMessage('user', '第二步:修复'),
      makeMessage('assistant', '已修复'),
    ]
    const savedId = newSessionId()
    const now = new Date().toISOString()
    const savedState: SessionState = {
      id: savedId,
      sessionId: 'repl-session-' + savedId.slice(0, 8),
      createdAt: now,
      updatedAt: now,
      model: 'gpt-4o',
      messages: originalMessages,
      status: 'completed',
      cwd: '/workspace',
    }
    saveSession(savedState)

    // 模拟下次 REPL 启动 --resume <savedId> 调用 loadSession
    const loaded = loadSession(savedId)
    expect(loaded).not.toBeNull()
    expect(loaded!.messages).toHaveLength(4)
    expect(loaded!.messages[0]!.role).toBe('user')
    expect(loaded!.messages[0]!.content).toBe('第一步:分析代码')
    expect(loaded!.messages[3]!.content).toBe('已修复')
    expect(loaded!.status).toBe('completed')

    // 模拟 REPL 用 loaded.messages 初始化 state.history
    const restoredHistory = loaded!.messages.map((m) => ({ role: m.role, content: m.content }))
    expect(restoredHistory).toHaveLength(4)
    expect(restoredHistory[0]).toEqual({ role: 'user', content: '第一步:分析代码' })
  })

  it('多次 REPL 退出保存 → 多个 session 共存,listSessions 返回全部', () => {
    const sessions: SessionState[] = []
    for (let i = 0; i < 3; i++) {
      const s = makeReplLikeSession({
        messages: [makeMessage('user', `session-${i}`)],
        status: 'completed',
      })
      saveSession(s)
      sessions.push(s)
    }
    const list = listSessions()
    expect(list).toHaveLength(3)
    const ids = list.map((s) => s.id)
    for (const s of sessions) {
      expect(ids).toContain(s.id)
    }
  })
})
