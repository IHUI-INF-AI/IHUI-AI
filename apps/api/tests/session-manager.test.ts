import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  dbRead: mockDb,
}))

import {
  SessionManager,
  SessionManagerError,
  toCliStatus,
  fromCliStatus,
} from '../src/services/clawdbot/session-manager.js'
import { clawdbotSessions, type ClawdbotSession } from '@ihui/database'

function chain(result: unknown[] = []) {
  const c: Record<string, unknown> = {
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    'onConflictDoNothing',
    'leftJoin',
  ]) {
    c[m] = vi.fn(() => c)
  }
  return c
}

function rejectingChain(error: unknown) {
  const c: Record<string, unknown> = {
    then: (_resolve: (v: unknown[]) => unknown, reject: (e: unknown) => unknown) =>
      Promise.reject(error).then(undefined, reject),
  }
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'set', 'returning', 'onConflictDoNothing']) {
    c[m] = vi.fn(() => c)
  }
  return c
}

function mockRow(overrides: Partial<ClawdbotSession> = {}): ClawdbotSession {
  return {
    id: 'sess_mock',
    botId: 'bot_1',
    userId: 'user_1',
    title: null,
    status: 'active',
    messageCount: 0,
    lastMessageAt: null,
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('clawdbot SessionManager 状态映射', () => {
  describe('toCliStatus API→CLI', () => {
    it('active → running', () => {
      expect(toCliStatus('active')).toBe('running')
    })
    it('paused → running', () => {
      expect(toCliStatus('paused')).toBe('running')
    })
    it('closed → completed', () => {
      expect(toCliStatus('closed')).toBe('completed')
    })
  })

  describe('fromCliStatus CLI→API', () => {
    it('running → active', () => {
      expect(fromCliStatus('running')).toBe('active')
    })
    it('completed → closed', () => {
      expect(fromCliStatus('completed')).toBe('closed')
    })
    it('failed → closed', () => {
      expect(fromCliStatus('failed')).toBe('closed')
    })
    it('cancelled → closed', () => {
      expect(fromCliStatus('cancelled')).toBe('closed')
    })
  })

  describe('状态映射可逆性', () => {
    it('active → running → active 往返一致', () => {
      expect(fromCliStatus(toCliStatus('active'))).toBe('active')
    })
    it('closed → completed → closed 往返一致', () => {
      expect(fromCliStatus(toCliStatus('closed'))).toBe('closed')
    })
  })
})

describe('clawdbot SessionManager DB 持久化层', () => {
  let mgr: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(chain([]))
    mockDb.insert.mockReturnValue(chain([]))
    mockDb.update.mockReturnValue(chain([]))
    mockDb.delete.mockReturnValue(chain([]))
    mgr = new SessionManager()
  })

  describe('createSession 创建会话', () => {
    it('INSERT 到 clawdbot_sessions 并返回 Session', async () => {
      const session = await mgr.createSession('bot_1', 'user_1', 'sess_custom', { key: 'val' })
      expect(session.id).toBe('sess_custom')
      expect(session.botId).toBe('bot_1')
      expect(session.userId).toBe('user_1')
      expect(session.status).toBe('active')
      expect(session.context.metadata).toEqual({ key: 'val' })
      expect(mockDb.insert).toHaveBeenCalledWith(clawdbotSessions)
    })

    it('未提供 sessionId 时自动生成 sess_ 前缀 ID', async () => {
      const session = await mgr.createSession('bot_1', 'user_1')
      expect(session.id).toMatch(/^sess_[0-9a-f-]+$/)
    })

    it('触发 created 事件', async () => {
      const handler = vi.fn()
      mgr.on('created', handler)
      await mgr.createSession('bot_1', 'user_1', 'sess_ev')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('空 botId 抛出 invalid 错误', async () => {
      await expect(mgr.createSession('', 'user_1')).rejects.toThrow(SessionManagerError)
    })
  })

  describe('getSession 查询会话', () => {
    it('SELECT 返回存在的会话', async () => {
      const row = mockRow({ id: 'sess_db1', status: 'active' })
      mockDb.select.mockReturnValue(chain([row]))
      const session = await mgr.getSession('sess_db1')
      expect(session).not.toBeNull()
      expect(session!.id).toBe('sess_db1')
      expect(session!.status).toBe('active')
      expect(session!.createdAt).toBe(row.createdAt.getTime())
    })

    it('SELECT 返回空数组时返回 null', async () => {
      mockDb.select.mockReturnValue(chain([]))
      const session = await mgr.getSession('not_exist')
      expect(session).toBeNull()
    })
  })

  describe('updateSessionStatus 更新状态', () => {
    it('UPDATE status=active', async () => {
      await mgr.updateSessionStatus('sess_1', 'active')
      expect(mockDb.update).toHaveBeenCalledWith(clawdbotSessions)
    })

    it('UPDATE status=paused', async () => {
      await mgr.updateSessionStatus('sess_1', 'paused')
      expect(mockDb.update).toHaveBeenCalledWith(clawdbotSessions)
    })

    it('UPDATE status=closed', async () => {
      await mgr.updateSessionStatus('sess_1', 'closed')
      expect(mockDb.update).toHaveBeenCalledWith(clawdbotSessions)
    })

    it('同步更新 in-memory 缓存的状态', async () => {
      await mgr.createSession('bot_1', 'user_1', 'sess_cache')
      await mgr.updateSessionStatus('sess_cache', 'paused')
      const session = mgr.get('sess_cache')
      expect(session.status).toBe('paused')
    })
  })

  describe('incrementMessageCount 递增消息数', () => {
    it('读取当前 count 并 UPDATE 为 count+delta', async () => {
      mockDb.select.mockReturnValue(chain([{ count: 5 }]))
      const updateChain = chain([])
      mockDb.update.mockReturnValue(updateChain)
      await mgr.incrementMessageCount('sess_1', 2)
      expect(mockDb.select).toHaveBeenCalledWith({
        count: clawdbotSessions.messageCount,
      })
      expect(updateChain.set).toHaveBeenCalledWith({
        messageCount: 7,
        lastMessageAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    })

    it('未传 delta 默认递增 1', async () => {
      mockDb.select.mockReturnValue(chain([{ count: 3 }]))
      const updateChain = chain([])
      mockDb.update.mockReturnValue(updateChain)
      await mgr.incrementMessageCount('sess_1')
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ messageCount: 4 }),
      )
    })
  })

  describe('listSessions 列表查询', () => {
    it('无 filter 时 SELECT 全部', async () => {
      const rows = [mockRow({ id: 's1' }), mockRow({ id: 's2' })]
      mockDb.select.mockReturnValue(chain(rows))
      const list = await mgr.listSessions()
      expect(list).toHaveLength(2)
      expect(list[0]!.id).toBe('s1')
      expect(list[1]!.id).toBe('s2')
    })

    it('带 status filter 时调用 where', async () => {
      const rows = [mockRow({ id: 's1', status: 'active' })]
      const selectChain = chain(rows)
      mockDb.select.mockReturnValue(selectChain)
      await mgr.listSessions({ status: 'active' })
      expect(selectChain.where).toHaveBeenCalled()
    })
  })

  describe('deleteSession 删除会话', () => {
    it('DELETE 成功返回 true', async () => {
      await mgr.createSession('bot_1', 'user_1', 'sess_del')
      const result = await mgr.deleteSession('sess_del')
      expect(mockDb.delete).toHaveBeenCalledWith(clawdbotSessions)
      expect(result).toBe(true)
    })

    it('删除不存在的会话仍返回 true(DB 已执行)', async () => {
      const result = await mgr.deleteSession('not_exist')
      expect(result).toBe(true)
    })
  })

  describe('closeSession 关闭会话', () => {
    it('UPDATE status=closed', async () => {
      await mgr.createSession('bot_1', 'user_1', 'sess_close')
      await mgr.closeSession('sess_close')
      expect(mockDb.update).toHaveBeenCalledWith(clawdbotSessions)
      const session = mgr.get('sess_close')
      expect(session.status).toBe('closed')
    })

    it('触发 closed 事件', async () => {
      await mgr.createSession('bot_1', 'user_1', 'sess_ev_close')
      const handler = vi.fn()
      mgr.on('closed', handler)
      await mgr.closeSession('sess_ev_close')
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})

describe('clawdbot SessionManager in-memory 降级模式', () => {
  let mgr: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    mgr = new SessionManager({ useDb: false })
  })

  it('createSession 在 in-memory 模式下不调用 db.insert', async () => {
    const session = await mgr.createSession('bot_1', 'user_1', 'sess_mem1')
    expect(session.id).toBe('sess_mem1')
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('getSession 在 in-memory 模式下从 Map 读取', async () => {
    await mgr.createSession('bot_1', 'user_1', 'sess_mem2')
    const session = await mgr.getSession('sess_mem2')
    expect(session).not.toBeNull()
    expect(session!.id).toBe('sess_mem2')
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('getSession 不存在时返回 null', async () => {
    const session = await mgr.getSession('not_exist')
    expect(session).toBeNull()
  })

  it('updateSessionStatus 在 in-memory 模式下更新 Map', async () => {
    await mgr.createSession('bot_1', 'user_1', 'sess_mem3')
    await mgr.updateSessionStatus('sess_mem3', 'paused')
    const session = await mgr.getSession('sess_mem3')
    expect(session!.status).toBe('paused')
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('listSessions 在 in-memory 模式下从 Map 过滤', async () => {
    await mgr.createSession('bot_1', 'user_1', 'sess_a')
    await mgr.createSession('bot_2', 'user_1', 'sess_b')
    const list = await mgr.listSessions({ botId: 'bot_1' })
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toBe('sess_a')
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('deleteSession 在 in-memory 模式下从 Map 删除', async () => {
    await mgr.createSession('bot_1', 'user_1', 'sess_mem4')
    const result = await mgr.deleteSession('sess_mem4')
    expect(result).toBe(true)
    expect(await mgr.getSession('sess_mem4')).toBeNull()
    expect(mockDb.delete).not.toHaveBeenCalled()
  })

  it('closeSession 在 in-memory 模式下更新状态为 closed', async () => {
    await mgr.createSession('bot_1', 'user_1', 'sess_mem5')
    await mgr.closeSession('sess_mem5')
    const session = await mgr.getSession('sess_mem5')
    expect(session!.status).toBe('closed')
  })
})

describe('clawdbot SessionManager DB 故障降级', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(chain([]))
    mockDb.insert.mockReturnValue(chain([]))
    mockDb.update.mockReturnValue(chain([]))
    mockDb.delete.mockReturnValue(chain([]))
  })

  it('DB select 抛错后降级到 in-memory', async () => {
    const mgr = new SessionManager()
    mockDb.select.mockReturnValue(rejectingChain(new Error('DB down')))
    await mgr.createSession('bot_1', 'user_1', 'sess_fail')
    const session = await mgr.getSession('sess_fail')
    expect(session).not.toBeNull()
    expect(session!.id).toBe('sess_fail')
  })

  it('DB 故障后后续调用直接走 in-memory(不再重试 DB)', async () => {
    const mgr = new SessionManager()
    mockDb.select.mockReturnValue(rejectingChain(new Error('DB down')))
    await mgr.getSession('sess_x')
    expect(mockDb.select).toHaveBeenCalledTimes(1)
    mockDb.select.mockClear()
    await mgr.getSession('sess_y')
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('resetDbState 重置后恢复 DB 调用', async () => {
    const mgr = new SessionManager()
    mockDb.select.mockReturnValue(rejectingChain(new Error('DB down')))
    await mgr.getSession('sess_x')
    mgr.resetDbState()
    mockDb.select.mockReturnValue(chain([]))
    await mgr.getSession('sess_y')
    expect(mockDb.select).toHaveBeenCalled()
  })
})

describe('clawdbot SessionManager 向后兼容(同步接口)', () => {
  let mgr: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    mgr = new SessionManager({ useDb: false })
  })

  it('create + get 往返', () => {
    const session = mgr.create('bot_1', 'user_1')
    expect(mgr.get(session.id)).toBe(session)
  })

  it('appendMessage 推入消息并返回完整对象', () => {
    const session = mgr.create('bot_1', 'user_1')
    const msg = mgr.appendMessage(session.id, { role: 'user', content: 'hello' })
    expect(msg.id).toMatch(/^msg_/)
    expect(msg.content).toBe('hello')
    expect(mgr.getContext(session.id).messages).toHaveLength(1)
  })

  it('close 后 appendMessage 抛 closed 错误', () => {
    const session = mgr.create('bot_1', 'user_1')
    mgr.close(session.id)
    expect(() => mgr.appendMessage(session.id, { role: 'user', content: 'x' })).toThrow(
      SessionManagerError,
    )
  })

  it('getStats 统计 active/paused/closed', () => {
    const s1 = mgr.create('bot_1', 'user_1')
    const s2 = mgr.create('bot_1', 'user_1')
    mgr.pause(s1.id)
    mgr.close(s2.id)
    const stats = mgr.getStats()
    expect(stats).toEqual({ total: 2, active: 0, paused: 1, closed: 1 })
  })

  it('listActive 只返回 active 状态', () => {
    const s1 = mgr.create('bot_1', 'user_1')
    const s2 = mgr.create('bot_1', 'user_1')
    mgr.pause(s2.id)
    const active = mgr.listActive()
    expect(active).toHaveLength(1)
    expect(active[0]!.id).toBe(s1.id)
  })
})
