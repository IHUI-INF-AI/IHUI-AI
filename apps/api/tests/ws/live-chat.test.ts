/**
 * WebSocket live-chat 单元测试。
 *
 * 直接测试 chat-server 核心逻辑(room 管理、消息路由、历史)。
 * HTTP WS 路由(鉴权、wsAuth 包装)由 ws-helpers.test.ts 覆盖。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WebSocket } from '@fastify/websocket'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

// 模拟 db.insert / db.select / db.delete
const insertedRows: unknown[] = []
let insertCalls: { table?: string; values?: unknown }[] = []
let selectRows: unknown[] = []

const chain: Record<string, (...a: unknown[]) => typeof chain> & { then: unknown } = {
  then: undefined as never,
  from: () => chain,
  where: () => chain,
  orderBy: () => chain,
  limit: () => chain,
  values: (v: unknown) => {
    insertCalls.push({ values: v })
    return chain
  },
  returning: () => {
    const next = { ...chain, then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve([insertedRows.shift()]).then(resolve),
    }
    return next
  },
}
chain.then = (resolve: (v: unknown) => unknown) =>
  Promise.resolve(selectRows).then(resolve)

vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => {
      insertCalls = []
      return {
        values: (v: unknown) => {
          insertCalls.push({ values: v })
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: 100 + insertedRows.length,
                  channelId: 42,
                  userId: 'u1',
                  userName: null,
                  userAvatar: null,
                  content: (insertCalls[0]?.values as { content?: string })?.content ?? '',
                  type: 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
          }
        },
      }
    }),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    })),
  },
}))

import {
  LiveChatServer,
  LiveChatRoom,
  __resetLiveChatServerForTest,
} from '../../src/websocket/chat-server.js'

function makeMockSocket(): WebSocket {
  const sent: string[] = []
  const handlers: Record<string, Array<(data: Buffer) => void>> = {}
  return {
    send: vi.fn((data: string) => {
      sent.push(data)
    }),
    close: vi.fn(),
    on: vi.fn((event: string, fn: (data: Buffer) => void) => {
      handlers[event] = handlers[event] ?? []
      handlers[event].push(fn)
    }),
    _sent: sent,
    _handlers: handlers,
  } as unknown as WebSocket & {
    _sent: string[]
    _handlers: Record<string, Array<(data: Buffer) => void>>
  }
}

describe('LiveChatRoom', () => {
  it('adds/removes sockets and tracks size', () => {
    const room = new LiveChatRoom('r1')
    const s1 = makeMockSocket()
    const s2 = makeMockSocket()
    expect(room.add(s1 as WebSocket)).toBe(true)
    expect(room.add(s2 as WebSocket)).toBe(true)
    expect(room.size).toBe(2)
    room.remove(s1 as WebSocket)
    expect(room.size).toBe(1)
    expect(room.isEmpty()).toBe(false)
    room.remove(s2 as WebSocket)
    expect(room.isEmpty()).toBe(true)
  })

  it('broadcast sends to all sockets', () => {
    const room = new LiveChatRoom('r1')
    const s1 = makeMockSocket()
    const s2 = makeMockSocket()
    room.add(s1 as WebSocket)
    room.add(s2 as WebSocket)
    room.broadcast('hello')
    expect((s1 as unknown as { _sent: string[] })._sent).toContain('hello')
    expect((s2 as unknown as { _sent: string[] })._sent).toContain('hello')
  })

  it('broadcast silently drops failing send', () => {
    const room = new LiveChatRoom('r1')
    const good = makeMockSocket()
    const bad = {
      send: vi.fn(() => {
        throw new Error('socket closed')
      }),
    } as unknown as WebSocket
    room.add(bad)
    room.add(good as WebSocket)
    room.broadcast('msg')
    // bad 已从集合中删除
    expect(room.size).toBe(1)
    expect((good as unknown as { _sent: string[] })._sent).toContain('msg')
  })
})

describe('LiveChatServer', () => {
  let server: LiveChatServer

  beforeEach(() => {
    __resetLiveChatServerForTest()
    server = new LiveChatServer()
  })

  it('join creates room and tracks', () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    expect(room).toBeInstanceOf(LiveChatRoom)
    expect(server.roomCount()).toBe(1)
    expect(server.totalConnections()).toBe(1)
  })

  it('leave removes socket and deletes empty room', () => {
    const s1 = makeMockSocket()
    server.join('42', s1 as WebSocket)
    server.leave('42', s1 as WebSocket)
    expect(server.roomCount()).toBe(0)
  })

  it('leave keeps room when other sockets remain', () => {
    const s1 = makeMockSocket()
    const s2 = makeMockSocket()
    server.join('42', s1 as WebSocket)
    server.join('42', s2 as WebSocket)
    server.leave('42', s1 as WebSocket)
    expect(server.roomCount()).toBe(1)
    expect(server.totalConnections()).toBe(1)
  })

  it('handleMessage — ping → pong', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(room, s1 as WebSocket, JSON.stringify({ type: 'ping' }), 'u1')
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent).toContain(JSON.stringify({ type: 'pong' }))
  })

  it('handleMessage — invalid JSON → error frame', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(room, s1 as WebSocket, 'not-json', 'u1')
    const sent = (s1 as unknown as { _sent: string[] })._sent
    const err = sent.find((s) => s.includes('"error"'))
    expect(err).toBeDefined()
    expect(err).toContain('"code":400')
  })

  it('handleMessage — send empty content → 400 error', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(
      room,
      s1 as WebSocket,
      JSON.stringify({ type: 'send', content: '   ' }),
      'u1',
    )
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent.some((s) => s.includes('"error"') && s.includes('"code":400'))).toBe(true)
  })

  it('handleMessage — send content too long → 400 error', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(
      room,
      s1 as WebSocket,
      JSON.stringify({ type: 'send', content: 'x'.repeat(2001) }),
      'u1',
    )
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent.some((s) => s.includes('"error"') && s.includes('"code":400'))).toBe(true)
  })

  it('handleMessage — send non-numeric roomId → 400 error', async () => {
    const s1 = makeMockSocket()
    const room = server.join('abc', s1 as WebSocket) // 字母 roomId
    await server.handleMessage(
      room,
      s1 as WebSocket,
      JSON.stringify({ type: 'send', content: 'hello' }),
      'u1',
    )
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent.some((s) => s.includes('"error"') && s.includes('"code":400'))).toBe(true)
  })

  it('handleMessage — send broadcasts chat frame to room', async () => {
    const s1 = makeMockSocket()
    const s2 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    server.join('42', s2 as WebSocket) // s2 同房间
    await server.handleMessage(
      room,
      s1 as WebSocket,
      JSON.stringify({ type: 'send', content: 'hello world', userName: 'alice' }),
      'u1',
    )
    const sent1 = (s1 as unknown as { _sent: string[] })._sent
    const sent2 = (s2 as unknown as { _sent: string[] })._sent
    const find = (arr: string[]) => arr.find((s) => s.includes('"type":"chat"'))
    expect(find(sent1)).toBeDefined()
    expect(find(sent2)).toBeDefined()
    expect(sent1.find((s) => s.includes('"content":"hello world"'))).toBeDefined()
  })

  it('handleMessage — history sends history frame', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(room, s1 as WebSocket, JSON.stringify({ type: 'history' }), 'u1')
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent.some((s) => s.includes('"type":"history"'))).toBe(true)
  })

  it('handleMessage — unknown type → error frame', async () => {
    const s1 = makeMockSocket()
    const room = server.join('42', s1 as WebSocket)
    await server.handleMessage(
      room,
      s1 as WebSocket,
      JSON.stringify({ type: 'who-knows' }),
      'u1',
    )
    const sent = (s1 as unknown as { _sent: string[] })._sent
    expect(sent.some((s) => s.includes('"error"') && s.includes('未知消息类型'))).toBe(true)
  })
})
