// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-815963 回归:DB 读侧 status 列值必须过 coerceKnownOr 收敛(离线,不连库:mock db 链)。
//
// 病灶:`status: row.status as SessionStatus` 直转让未来值直接透传(clawdbot_sessions 与
// agent_runtime_sessions 两表 status 均为 varchar(20) 无 DB 约束,列值闭集只存在于代码);
// 若兜到初始态 'active' 则等于把已终态的账放回可写集合(上游 session-inputs 的反例:
// 未知 status→'admitted' 使已终态行重新进入可 settle 集合,与状态前置 CAS 相互拆台)。
//
// 修法:session-manager.toSession 与 agent-runtime/session-store.toSession 两处读侧直转
// 改接 `coerceKnownOr(row.status, ['active','paused','closed'], 'closed')` —— 未知/未来值
// 兜到终态 'closed'(resume/pause/appendMessage 对 closed 一律抛错 = 不再产生副作用)。
//
// 判据有牙:把兜底档改回 'active'(初始态)⇒ 用例①必红;删掉 coerce 改回 as 直转 ⇒ 用例①②必红;
// 读路径若夹带写(INSERT/UPDATE/DELETE)⇒ "读不改盘"断言必红。
import { describe, it, expect, beforeEach, vi } from 'vitest'

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

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { SessionManager, SessionManagerError } from '../src/services/clawdbot/session-manager.js'
import {
  loadSessionFromDb,
  resetSessionStoreDbState,
} from '../src/services/agent-runtime/session-store.js'
import type { ClawdbotSession } from '@ihui/database'

/** drizzle 链的 thenable 桩:select().from().where().limit() 最终解析为 rows */
function selectChain(rows: unknown[]) {
  const step: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
    step[m] = vi.fn(() => step)
  }
  step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(rows).then(resolve, reject)
  return step
}

function clawdbotRow(overrides: Partial<ClawdbotSession> = {}): ClawdbotSession {
  return {
    id: 'sess_g815963',
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

function agentRuntimeRow(status: string) {
  return {
    id: 'sess_g815963',
    botId: 'default',
    userId: 'user_1',
    status,
    messages: [],
    metadata: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('G-815963①:clawdbot 会话读侧未来值兜终态,且不得被 settle 命中', () => {
  let mgr: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStoreDbState()
    mgr = new SessionManager()
  })

  it('① 未来值 status=aborted 兜到终态 closed(不再透传)', async () => {
    mockDb.select.mockReturnValue(selectChain([clawdbotRow({ id: 'sess_fut', status: 'aborted' })]))
    const session = await mgr.getSession('sess_fut')
    expect(session).not.toBeNull()
    expect(session!.status).toBe('closed')
  })

  it('①b 兜到 closed 后不得被 settle 命中:appendMessage/resume/pause 一律抛 closed', async () => {
    mockDb.select.mockReturnValue(
      selectChain([clawdbotRow({ id: 'sess_fut2', status: 'aborted' })]),
    )
    const session = await mgr.getSession('sess_fut2')
    expect(session!.status).toBe('closed')
    expect(() => mgr.appendMessage('sess_fut2', { role: 'user', content: 'x' })).toThrow(
      SessionManagerError,
    )
    expect(() => mgr.resume('sess_fut2')).toThrow(SessionManagerError)
    expect(() => mgr.pause('sess_fut2')).toThrow(SessionManagerError)
  })

  it('② 已知三档逐档原样收窄透传(active/paused/closed)', async () => {
    for (const status of ['active', 'paused', 'closed'] as const) {
      mockDb.select.mockReturnValue(selectChain([clawdbotRow({ id: `sess_${status}`, status })]))
      const session = await mgr.getSession(`sess_${status}`)
      expect(session!.status).toBe(status)
    }
  })

  it('读路径零写副作用:读取后未发任何 INSERT/UPDATE/DELETE(读不改盘)', async () => {
    mockDb.select.mockReturnValue(selectChain([clawdbotRow({ status: 'aborted' })]))
    await mgr.getSession('sess_g815963')
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
    expect(mockDb.delete).not.toHaveBeenCalled()
  })
})

describe('G-815963①:agent-runtime session-store 读侧同型收敛', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSessionStoreDbState()
  })

  it('未来值 status=aborted 兜到终态 closed', async () => {
    mockDb.select.mockReturnValue(selectChain([agentRuntimeRow('aborted')]))
    const session = await loadSessionFromDb('sess_g815963')
    expect(session).not.toBeNull()
    expect(session!.status).toBe('closed')
  })

  it('已知值 paused 原样透传;读路径零写副作用', async () => {
    mockDb.select.mockReturnValue(selectChain([agentRuntimeRow('paused')]))
    const session = await loadSessionFromDb('sess_g815963')
    expect(session!.status).toBe('paused')
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
