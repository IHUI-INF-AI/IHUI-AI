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
import { WsRateLimiter } from '../plugins/ws-helpers.js'

export const HISTORY_PAGE_SIZE = 50
const MAX_CONTENT_LENGTH = 2000
const MAX_ROOMS = 1000
const MAX_CONN_PER_ROOM = 500
// P2 修复(2026-08-06):live-chat WS 消息频率限制(防刷屏)。
// 与 plugins/ws-chat.ts 的 WsRateLimiter 保持一致:每用户滑动窗口 60 条/分钟,
// 覆盖 send(落库+广播)与 history(查库)等业务消息,超限返回 429 错误帧(不关连接)。
const MESSAGE_RATE_LIMIT = 60
const MESSAGE_RATE_WINDOW_MS = 60_000

// P2 修复(2026-08-06):HTML 转义,防聊天消息 XSS。
// 消息 content/userName/userAvatar 来自客户端,直接落库+广播会被注入 `<script>` 等
// 恶意 HTML,在他人浏览器端执行。落库/广播前对 HTML 特殊字符转义(`&` 必须最先转义,
// 否则 `&lt;` 中的 `&` 会被二次编码),前端以 innerHTML 渲染时显示原文、不执行脚本。
// 注意:仅转义 HTML 特殊字符,不删除/改写正常文本。
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
  // P2 修复(2026-08-06):per-user 消息频率限制(60 条/分钟,滑动窗口)
  private readonly messageRateLimiter = new WsRateLimiter(
    MESSAGE_RATE_LIMIT,
    MESSAGE_RATE_WINDOW_MS,
  )

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

  /**
   * P2 修复(2026-08-06):用户断开时清除其消息频率窗口,防止内存累积。
   * 连接关闭/出错时由调用方(live-chat 路由)触发。
   */
  resetUserRateLimit(userId: string): void {
    this.messageRateLimiter.reset(userId)
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
  async handleMessage(
    room: LiveChatRoom,
    ws: WebSocket,
    raw: string,
    userId: string,
  ): Promise<void> {
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

    // P2 修复(2026-08-06):业务消息(history/send 等)频率限制,超限返回 429 错误帧。
    // ping 不计数(心跳需高频),其余消息统一走滑动窗口,防单用户刷屏压垮落库与广播。
    if (!this.messageRateLimiter.allow(userId)) {
      room.sendTo(
        ws,
        JSON.stringify({ type: 'error', code: 429, message: '消息发送过快，请稍后再试' }),
      )
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
      // P2 修复(2026-08-06):落库前对 content/userName/userAvatar 做 HTML 转义,
      // 广播与历史读取均从 DB 取转义后值,杜绝 XSS 注入。
      const safeContent = escapeHtml(content)
      const safeUserName =
        msg.userName !== undefined && msg.userName !== null
          ? escapeHtml(String(msg.userName))
          : null
      const safeUserAvatar =
        msg.userAvatar !== undefined && msg.userAvatar !== null
          ? escapeHtml(String(msg.userAvatar))
          : null
      const [row] = await db
        .insert(liveComment)
        .values({
          channelId,
          userId,
          userName: safeUserName,
          userAvatar: safeUserAvatar,
          content: safeContent,
          type: 1,
        })
        .returning()
      if (!row) return
      const data: ChatMessage = toChatMessage(row)
      room.broadcast(JSON.stringify({ type: 'chat', data }))
      return
    }

    room.sendTo(
      ws,
      JSON.stringify({ type: 'error', code: 400, message: `未知消息类型: ${msg.type}` }),
    )
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
