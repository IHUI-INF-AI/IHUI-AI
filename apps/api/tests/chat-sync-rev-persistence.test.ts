// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B02 第三切片(2026-10-25):chat-sync rev 持久化(PG 权威账本)回归。
 *
 * 钉三件事(测试隔离:零真 PG、零真 Redis,队列驱动 db 桩):
 *  ① 分配走 UPSERT RETURNING,值**只**由账本行决定 —— "重启续读"的机器语义:
 *     分配值与进程内任何状态无关,进程重启(新插件实例)后同一 messageId 继续
 *     从账本值 +1,绝不从 1 重数(契约 §2 第 2 条:严格递增、不重号、不回退);
 *  ② 退役验证:Redis INCR 不再被调用(chat-sync:rev:* 键族整体退役),
 *     壁钟回落一并退役 —— allocate 失败 ⇒ broadcastChatMessagePatched 显式 reject
 *     (宁可广播失败,不伪造服务端坐标);
 *  ③ 快照读:rev 无账行 ⇒ 0(created 哨兵);消息不在该会话 ⇒ null(归属一查定案)。
 *
 * harness 照 ws-broadcast-cross-instance.test.ts(假 server,不连库、不监听端口);
 * db 桩照 admin-agreements.test.ts(vi.mock('../src/db/index.js'))。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { revReturnQueue, snapshotRowsQueue, bus } = vi.hoisted(() => ({
  /** allocateChatSyncRev 的 RETURNING 队列:每项 = 一次 UPSERT 的返回行数组 */
  revReturnQueue: [] as Array<Array<{ rev: number }>>,
  /** findChatSyncSnapshot 的行队列:每项 = 一次 SELECT(LEFT JOIN)的行数组 */
  snapshotRowsQueue: [] as Array<Array<Record<string, unknown>>>,
  bus: {
    incrCalls: [] as string[],
    published: [] as Array<{ channel: string; message: string }>,
    subs: [] as Array<{ pattern: string; cb: (channel: string, message: string) => void }>,
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgres://localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: async (): Promise<Array<{ rev: number }>> =>
            revReturnQueue.length > 0 ? revReturnQueue.shift()! : [],
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async (): Promise<Array<Record<string, unknown>>> =>
              snapshotRowsQueue.length > 0 ? snapshotRowsQueue.shift()! : [],
          }),
        }),
      }),
    }),
  },
}))

vi.mock('ioredis', () => {
  class FakeRedis {
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {}
    constructor(_url?: string, _opts?: unknown) {}
    on(ev: string, cb: (...args: unknown[]) => void): void {
      ;(this.handlers[ev] ??= []).push(cb)
    }
    async psubscribe(pattern: string): Promise<string> {
      bus.subs.push({
        pattern,
        cb: (channel: string, message: string) => {
          for (const h of this.handlers['pmessage'] ?? []) h(pattern, channel, message)
        },
      })
      return 'OK'
    }
    publish(channel: string, message: string): Promise<number> {
      bus.published.push({ channel, message })
      let n = 0
      for (const s of bus.subs) {
        if (channel.startsWith(s.pattern.slice(0, -1))) {
          s.cb(channel, message)
          n += 1
        }
      }
      return Promise.resolve(n)
    }
    incr(key: string): Promise<number> {
      bus.incrCalls.push(key)
      return Promise.resolve(1)
    }
    async quit(): Promise<string> {
      return 'OK'
    }
  }
  return { default: FakeRedis }
})

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'aaaaaaaa-1111-4111-8111-111111111111'),
  WS_CLOSE: { TOO_MANY_CONNECTIONS: 1013 },
  WsUserConnectionLimiter: class {
    acquire(): boolean {
      return true
    }
    release(): void {}
  },
}))
vi.mock('../src/plugins/ws-auto-recovery.js', () => ({
  getWsAutoRecoveryManager: () => ({ setFastify: () => {}, registerPlugin: () => {} }),
}))

import { allocateChatSyncRev, findChatSyncSnapshot } from '../src/db/chat-sync-rev-queries.js'
import { wsBroadcast } from '../src/plugins/ws-broadcast.js'
import IORedis from 'ioredis'

const MESSAGE_ID = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV_ID = 'cccccccc-3333-4333-8333-333333333333'

describe('B02③ allocateChatSyncRev(PG 权威账本,UPSERT 原子递增)', () => {
  beforeEach(() => {
    revReturnQueue.length = 0
  })

  it('首次分配:RETURNING 1 ⇒ rev=1(值只由账本行决定)', async () => {
    revReturnQueue.push([{ rev: 1 }])
    await expect(allocateChatSyncRev(MESSAGE_ID)).resolves.toBe(1)
  })

  it('重启续读:进程内无任何计数器参与,同一 messageId 续账本值 +1', async () => {
    // 模拟:上一进程把账推到 6;本"新进程"第一次分配,账本 UPSERT 返回 7。
    // 若 rev 仍由进程内计数器/Redis INCR 参与,这里不可能拿到与账本一致的续值。
    revReturnQueue.push([{ rev: 7 }])
    await expect(allocateChatSyncRev(MESSAGE_ID)).resolves.toBe(7)
    revReturnQueue.push([{ rev: 8 }])
    await expect(allocateChatSyncRev(MESSAGE_ID)).resolves.toBe(8)
  })

  it('UPSERT 未返回行(库语义异常)⇒ 显式抛错,绝不编一个数', async () => {
    revReturnQueue.push([])
    await expect(allocateChatSyncRev(MESSAGE_ID)).rejects.toThrow(/未返回合法 rev/)
  })

  it('RETURNING 非法值(0/非整数)⇒ 显式抛错', async () => {
    revReturnQueue.push([{ rev: 0 }])
    await expect(allocateChatSyncRev(MESSAGE_ID)).rejects.toThrow(/未返回合法 rev/)
  })
})

describe('B02③ findChatSyncSnapshot(rev=N 全量读,归属一查定案)', () => {
  beforeEach(() => {
    snapshotRowsQueue.length = 0
  })

  it('消息 + 账行都在 ⇒ 快照形状(conversationId/messageId/role/content/rev)', async () => {
    snapshotRowsQueue.push([
      {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        role: 'assistant',
        content: '链头内容',
        reasoning: '推理',
        rev: 3,
      },
    ])
    const snap = await findChatSyncSnapshot(CONV_ID, MESSAGE_ID)
    expect(snap).toEqual({
      conversationId: CONV_ID,
      messageId: MESSAGE_ID,
      role: 'assistant',
      content: '链头内容',
      reasoning: '推理',
      rev: 3,
    })
  })

  it('消息在而账行不在(LEFT JOIN null)⇒ rev=0(created 哨兵,链上无 patch)', async () => {
    snapshotRowsQueue.push([
      {
        conversationId: CONV_ID,
        messageId: MESSAGE_ID,
        role: 'user',
        content: '初面',
        reasoning: null,
        rev: null,
      },
    ])
    const snap = await findChatSyncSnapshot(CONV_ID, MESSAGE_ID)
    expect(snap?.rev).toBe(0)
  })

  it('消息不存在或不属于该会话(WHERE 谓词滤空)⇒ null', async () => {
    snapshotRowsQueue.push([])
    await expect(findChatSyncSnapshot(CONV_ID, MESSAGE_ID)).resolves.toBeNull()
  })
})

// ── ws-broadcast 集成:rev 分配接线 + 退役验证 ──

interface FakeSocket {
  sent: string[]
  send: (msg: string, cb?: (err?: Error) => void) => void
  on: (ev: string, cb: () => void) => void
  close: () => void
}

type PatchedBroadcast = (input: {
  conversationId: string
  memberUserIds: readonly string[]
  messageId: string
  kind?: 'delta' | 'snapshot'
  content?: string
}) => Promise<unknown>

async function buildInstance(): Promise<{ patched: PatchedBroadcast; connect: () => Promise<FakeSocket> }> {
  let patchedFn: PatchedBroadcast | null = null
  let routeHandler:
    ((socket: FakeSocket, request: { query: Record<string, string> }) => Promise<void>) | null =
    null
  const server = {
    log: { warn: (): void => {}, info: (): void => {} },
    metrics: undefined,
    decorate(name: string, fn: unknown): void {
      // 三个装饰(broadcastToUser / broadcastChatMessagePatched)都挂到 server 本体 ——
      // fanoutToConversationRoom 在装饰体内经 server.broadcastToUser 取用,必须可取到。
      ;(server as unknown as Record<string, unknown>)[name] = fn
      if (name === 'broadcastChatMessagePatched') patchedFn = fn as PatchedBroadcast
    },
    get(_url: string, _opts: unknown, handler: unknown): void {
      routeHandler = handler as (socket: FakeSocket, request: { query: Record<string, string> }) => Promise<void>
    },
    addHook(): void {},
    redis: new IORedis(),
  }
  await (wsBroadcast as unknown as (s: unknown, o: unknown) => Promise<void>)(server, {})
  if (!patchedFn || !routeHandler) throw new Error('ws-broadcast 未装饰/未注册路由')
  return {
    patched: patchedFn,
    connect: async (): Promise<FakeSocket> => {
      const handlers: Record<string, Array<() => void>> = {}
      const socket: FakeSocket = {
        sent: [],
        send(msg: string, cb?: (err?: Error) => void) {
          socket.sent.push(msg)
          cb?.()
        },
        on(ev: string, cb: () => void) {
          ;(handlers[ev] ??= []).push(cb)
        },
        close: () => {},
      }
      void handlers
      await routeHandler(socket, { query: { token: 'x' } })
      return socket
    },
  }
}

describe('B02③ ws-broadcast rev 分配接线(PG 单源)', () => {
  beforeEach(() => {
    revReturnQueue.length = 0
    bus.incrCalls.length = 0
    bus.published.length = 0
  })

  it('patched 广播帧带账本分配的 rev,且跨调用严格递增', async () => {
    const inst = await buildInstance()
    const sock = await inst.connect()
    revReturnQueue.push([{ rev: 1 }])
    await inst.patched({
      conversationId: CONV_ID,
      memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
      messageId: MESSAGE_ID,
      kind: 'snapshot',
      content: 'v1',
    })
    revReturnQueue.push([{ rev: 2 }])
    await inst.patched({
      conversationId: CONV_ID,
      memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
      messageId: MESSAGE_ID,
      kind: 'snapshot',
      content: 'v2',
    })
    const revs = sock.sent.map((m) => {
      const frame = JSON.parse(m) as { event: string; data: { type?: string; rev?: number } }
      return frame.event === 'message:patched' ? frame.data.rev : undefined
    })
    expect(revs).toEqual([1, 2])
  })

  it('重启续读:新插件实例同一 messageId 从账本续(进程内零状态参与)', async () => {
    const first = await buildInstance()
    await first.connect()
    revReturnQueue.push([{ rev: 9 }])
    await first.patched({
      conversationId: CONV_ID,
      memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
      messageId: MESSAGE_ID,
      kind: 'snapshot',
      content: 'old-process',
    })
    // "重启":全新插件实例(全新 connections/floor——退役后连 floor 都不存在),
    // 账本说 10 就是 10,不从 1 重数。
    const reborn = await buildInstance()
    const sock = await reborn.connect()
    revReturnQueue.push([{ rev: 10 }])
    await reborn.patched({
      conversationId: CONV_ID,
      memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
      messageId: MESSAGE_ID,
      kind: 'snapshot',
      content: 'reborn',
    })
    const frames = sock.sent.map((m) => JSON.parse(m) as { data: { rev?: number; content?: string } })
    expect(frames[0]?.data.rev).toBe(10)
    expect(frames[0]?.data.content).toBe('reborn')
  })

  it('退役验证:Redis INCR 零调用(chat-sync:rev:* 键族整体退役)', async () => {
    const inst = await buildInstance()
    await inst.connect()
    revReturnQueue.push([{ rev: 1 }])
    await inst.patched({
      conversationId: CONV_ID,
      memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
      messageId: MESSAGE_ID,
      kind: 'snapshot',
      content: 'x',
    })
    expect(bus.incrCalls).toEqual([])
  })

  it('账本取不到(PG 不可用)⇒ 显式 reject,无壁钟回落、无伪造 rev', async () => {
    const inst = await buildInstance()
    await inst.connect()
    revReturnQueue.length = 0 // 队列空 = UPSERT 未返回行 = 查询层抛错
    await expect(
      inst.patched({
        conversationId: CONV_ID,
        memberUserIds: ['aaaaaaaa-1111-4111-8111-111111111111'],
        messageId: MESSAGE_ID,
        kind: 'snapshot',
        content: 'x',
      }),
    ).rejects.toThrow(/未返回合法 rev/)
    expect(bus.published).toHaveLength(0) // 无 rev 就无帧,绝不发没有服务端坐标的广播
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
