/**
 * WebSocket live-chat 房间管理核心。
 *
 * 房间(由 query `roomId` 决定)维护一个 WS 连接集合,
 * - 接收客户端消息(双层消息外壳: `{type:'send', content, userName?, userAvatar?}`),
 *   落库 live_comment 表,广播 `{type:'chat', data:{...}}` 给同房间所有客户端
 * - 响应客户端 `history` 消息,返回最近 50 条 `{type:'history', data:[...]}`
 * - 房间清理:连接断开时移除,空房间自动删除
 * - 单进程内存版,多实例时上层(如 ws-broadcast 插件)需另行 Pub/Sub
 */

import type { WebSocket } from '@fastify/websocket'
import { desc, eq, sql } from 'drizzle-orm'
import { liveComment, type LiveComment } from '@ihui/database'
import { db } from '../db/index.js'

export const HISTORY_PAGE_SIZE = 50
const MAX_CONTENT_LENGTH = 2000
const MAX_ROOMS = 1000
const MAX_CONN_PER_ROOM = 500

export interface ChatMessage {
  id: number
  channelId: number
  userId: string
  userName: string | null
  userAvatar: string | null
  content: string
  type: number
  createdAt: string
}

interface ClientMessage {
  type: 'send' | 'history' | 'ping' | string
  content?: string
  userName?: string
  userAvatar?: string
  limit?: number
  [key: string]: unknown
}

export class LiveChatRoom {
  private conns = new Set<WebSocket>()

  constructor(public readonly roomId: string) {}

  add(ws: WebSocket): boolean {
    if (this.conns.size >= MAX_CONN_PER_ROOM) return false
    this.conns.add(ws)
    return true
  }

  remove(ws: WebSocket): void {
    this.conns.delete(ws)
  }

  get size(): number {
    return this.conns.size
  }

  isEmpty(): boolean {
    return this.conns.size === 0
  }

  /** 向房间内所有连接发送 payload(JSON.stringify 已序列化) */
  broadcast(payload: string): void {
    for (const ws of this.conns) {
      try {
        ws.send(payload)
      } catch {
        this.conns.delete(ws)
      }
    }
  }

  sendTo(ws: WebSocket, payload: string): void {
    try {
      ws.send(payload)
    } catch {
      this.conns.delete(ws)
    }
  }
}

export class LiveChatServer {
  private rooms = new Map<string, LiveChatRoom>()

  join(roomId: string, ws: WebSocket): LiveChatRoom {
    let room = this.rooms.get(roomId)
    if (!room) {
      if (this.rooms.size >= MAX_ROOMS) {
        // 简单 LRU 近似:超过上限先回收一个空房间
        for (const [k, v] of this.rooms) {
          if (v.isEmpty()) {
            this.rooms.delete(k)
            break
          }
        }
      }
      room = new LiveChatRoom(roomId)
      this.rooms.set(roomId, room)
    }
    room.add(ws)
    return room
  }

  leave(roomId: string, ws: WebSocket): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.remove(ws)
    if (room.isEmpty()) this.rooms.delete(roomId)
  }

  roomCount(): number {
    return this.rooms.size
  }

  totalConnections(): number {
    let n = 0
    for (const r of this.rooms.values()) n += r.size
    return n
  }

  /**
   * 处理客户端消息。
   * - send: 写入 live_comment 并广播
   * - history: 读最近 N 条发回请求者
   * - ping: 响应 pong
   */
  async handleMessage(room: LiveChatRoom, ws: WebSocket, raw: string, userId: string): Promise<void> {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      room.sendTo(ws, JSON.stringify({ type: 'error', code: 400, message: '消息不是合法 JSON' }))
      return
    }

    if (msg.type === 'ping') {
      room.sendTo(ws, JSON.stringify({ type: 'pong' }))
      return
    }

    if (msg.type === 'history') {
      const limit = Math.min(Math.max(msg.limit ?? HISTORY_PAGE_SIZE, 1), 200)
      const rows = await this.fetchHistory(room.roomId, limit)
      room.sendTo(ws, JSON.stringify({ type: 'history', data: rows }))
      return
    }

    if (msg.type === 'send') {
      const content = (msg.content ?? '').toString().trim()
      if (!content) {
        room.sendTo(ws, JSON.stringify({ type: 'error', code: 400, message: 'content 不能为空' }))
        return
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        room.sendTo(ws, JSON.stringify({ type: 'error', code: 400, message: 'content 过长' }))
        return
      }
      const channelId = Number.parseInt(room.roomId, 10)
      if (!Number.isFinite(channelId)) {
        room.sendTo(ws, JSON.stringify({ type: 'error', code: 400, message: 'roomId 必须为数字' }))
        return
      }
      const [row] = await db
        .insert(liveComment)
        .values({
          channelId,
          userId,
          userName: msg.userName ?? null,
          userAvatar: msg.userAvatar ?? null,
          content,
          type: 1,
        })
        .returning()
      if (!row) return
      const data: ChatMessage = toChatMessage(row)
      room.broadcast(JSON.stringify({ type: 'chat', data }))
      return
    }

    room.sendTo(ws, JSON.stringify({ type: 'error', code: 400, message: `未知消息类型: ${msg.type}` }))
  }

  /** 拉取历史(最近 N 条,按时间倒序返回时按时间正序) */
  async fetchHistory(roomId: string, limit: number): Promise<ChatMessage[]> {
    const channelId = Number.parseInt(roomId, 10)
    if (!Number.isFinite(channelId)) return []
    const rows = await db
      .select()
      .from(liveComment)
      .where(eq(liveComment.channelId, channelId))
      .orderBy(desc(liveComment.createdAt))
      .limit(limit)
    return rows.reverse().map(toChatMessage)
  }
}

function toChatMessage(row: LiveComment): ChatMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    userId: row.userId,
    userName: row.userName,
    userAvatar: row.userAvatar,
    content: row.content,
    type: row.type,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
  }
}

let globalServer: LiveChatServer | null = null

export function getLiveChatServer(): LiveChatServer {
  if (!globalServer) globalServer = new LiveChatServer()
  return globalServer
}

/** 单元测试用:重置全局单例(避免跨 case 状态污染) */
export function __resetLiveChatServerForTest(): void {
  globalServer = null
}

// 静默 unused import 警告(可在调用方按需使用)
void sql
