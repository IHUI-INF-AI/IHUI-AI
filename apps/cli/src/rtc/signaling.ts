// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-09 完整 WebRTC 信令服务（浏览器 `RTCPeerConnection` 的 SDP/ICE 协商面）。
 *
 * 现有 `bridge.ts` 是自托管媒体中继（WebSocket 二进制帧），不能替代浏览器
 * WebRTC 的协商栈。本文件补齐「offer / answer / ICE candidate」三件事：
 *   - 两端按 room + role 配对，offerer 先发 offer，answerer 回 answer；
 *   - ICE candidate 原样转发，不解释、不缓存；
 *   - 只接受本机/扩展/站点域的 Origin，陌生 Origin 在握手阶段拒绝；
 *   - 房间最多两枚 peer，第三枚显式 4409；非 `/signal` 路径 4404；
 *   - 信令只做协商，不转发媒体；媒体面走 `RTCPeerConnection` 自身的 P2P 通道。
 *
 * 这不是“再包一层 WebSocket 文本转发”：类型、角色、顺序、Origin 和
 * 房间容量都在服务端判，浏览器两端必须真实完成 SDP/ICE 才能 connected。
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

export const RTC_SIGNAL_PATH = '/signal'
export const RTC_SIGNAL_MAX_BYTES = 256 * 1024
export const RTC_SIGNAL_ROOM_RE = /^[A-Za-z0-9_-]{1,64}$/

export type RtcSignalRole = 'offerer' | 'answerer'

/** 浏览器 `RTCIceServer` 的最小可序列化子集；凭据只在内存与本机信令连接内传递。 */
export interface RtcIceServer {
  urls: string | readonly string[]
  username?: string
  credential?: string
}

export interface RtcSignalingStats {
  rooms: number
  peers: number
  offers: number
  answers: number
  iceCandidates: number
  rejected: number
}

export interface RtcSignalingOptions {
  host?: string
  port?: number
  /** 额外允许的 Origin（默认 localhost / 127.0.0.1 / chrome-extension:// / aizhs.top）。 */
  allowedOrigins?: readonly string[]
  /** 下发给两端浏览器的 ICE 服务器（STUN/TURN）。 */
  iceServers?: readonly RtcIceServer[]
  logger?: (line: string) => void
}

export interface RtcSignalingServer {
  readonly host: string
  readonly port: number
  readonly url: string
  stats(): RtcSignalingStats
  close(): Promise<void>
}

interface Peer {
  socket: WebSocket
  role: RtcSignalRole
  room: string
}

interface Room {
  offerer?: Peer
  answerer?: Peer
}

interface SignalMessage {
  type?: unknown
  sdp?: unknown
  candidate?: unknown
  [key: string]: unknown
}

const DEFAULT_ALLOWED_ORIGINS = [
  /^chrome-extension:\/\/[a-p]{32}$/,
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/[a-z0-9.-]*aizhs\.top$/,
]

function originAllowed(origin: string | undefined, extra: readonly string[]): boolean {
  // Node/测试客户端不带 Origin：只允许本机监听时成立（默认 host=127.0.0.1）。
  if (!origin) return true
  if (extra.includes(origin)) return true
  return DEFAULT_ALLOWED_ORIGINS.some((re) => re.test(origin))
}

function peerOf(room: Room, self: Peer): Peer | undefined {
  return self.role === 'offerer' ? room.answerer : room.offerer
}

function send(peer: Peer | undefined, value: unknown): void {
  if (!peer || peer.socket.readyState !== WebSocket.OPEN) return
  try {
    peer.socket.send(JSON.stringify(value))
  } catch {
    // 对端刚好断开：让 close/error 处理器收尾，不把信令异常泼到发送方。
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSignal(raw: string): SignalMessage | null {
  try {
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? (parsed as SignalMessage) : null
  } catch {
    return null
  }
}

function safeJsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

export async function createRtcSignalingServer(
  options: RtcSignalingOptions = {},
): Promise<RtcSignalingServer> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const extraOrigins = options.allowedOrigins ?? []
  const iceServers = options.iceServers ?? []
  const rooms = new Map<string, Room>()
  const stats: RtcSignalingStats = {
    rooms: 0,
    peers: 0,
    offers: 0,
    answers: 0,
    iceCandidates: 0,
    rejected: 0,
  }

  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      safeJsonResponse(res, 200, {
        ok: true,
        rooms: rooms.size,
        peers: stats.peers,
        stats,
      })
      return
    }
    safeJsonResponse(res, 404, { ok: false, error: 'not_found' })
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: RTC_SIGNAL_MAX_BYTES })

  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${host}:${port}`)
    if (url.pathname !== RTC_SIGNAL_PATH) {
      stats.rejected += 1
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    if (!originAllowed(req.headers.origin, extraOrigins)) {
      stats.rejected += 1
      options.logger?.(`rejected origin ${req.headers.origin ?? '<none>'}`)
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    const roomName = url.searchParams.get('room') ?? ''
    const role = url.searchParams.get('role')
    if (!RTC_SIGNAL_ROOM_RE.test(roomName) || (role !== 'offerer' && role !== 'answerer')) {
      stats.rejected += 1
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    const room = rooms.get(roomName)
    if (room && (role === 'offerer' ? room.offerer : room.answerer)) {
      stats.rejected += 1
      socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const peer: Peer = { socket: ws, role, room: roomName }
      const targetRoom = room ?? {}
      if (!room) rooms.set(roomName, targetRoom)
      stats.rooms = rooms.size
      if (role === 'offerer') targetRoom.offerer = peer
      else targetRoom.answerer = peer
      stats.peers += 1

      const other = peerOf(targetRoom, peer)
      send(peer, { type: 'joined', room: roomName, role, iceServers })
      if (other) {
        send(other, { type: 'peer-joined', room: roomName, role })
        send(peer, { type: 'peer-joined', room: roomName, role: other.role })
        send(peer, { type: 'ready', room: roomName })
        send(other, { type: 'ready', room: roomName })
      } else {
        send(peer, { type: 'waiting', room: roomName })
      }

      ws.on('message', (raw) => {
        const text = raw.toString()
        if (text.length > RTC_SIGNAL_MAX_BYTES) {
          stats.rejected += 1
          ws.close(4400, 'signal frame too large')
          return
        }
        const msg = parseSignal(text)
        if (!msg || typeof msg.type !== 'string') {
          stats.rejected += 1
          send(peer, { type: 'error', error: 'invalid_signal' })
          return
        }
        switch (msg.type) {
          case 'offer':
          case 'answer': {
            if (typeof msg.sdp !== 'string' || msg.sdp.length === 0 || msg.sdp.length > 128 * 1024) {
              stats.rejected += 1
              send(peer, { type: 'error', error: 'invalid_sdp' })
              return
            }
            if (msg.type === 'offer') stats.offers += 1
            else stats.answers += 1
            send(peerOf(targetRoom, peer), {
              type: msg.type,
              sdp: msg.sdp,
              role,
            })
            return
          }
          case 'ice': {
            if (!isRecord(msg.candidate)) {
              stats.rejected += 1
              send(peer, { type: 'error', error: 'invalid_candidate' })
              return
            }
            stats.iceCandidates += 1
            send(peerOf(targetRoom, peer), { type: 'ice', candidate: msg.candidate, role })
            return
          }
          case 'bye': {
            send(peerOf(targetRoom, peer), { type: 'bye', role })
            ws.close(1000, 'bye')
            return
          }
          case 'ping': {
            send(peer, { type: 'pong', ts: Date.now() })
            return
          }
          default: {
            stats.rejected += 1
            send(peer, { type: 'error', error: 'unsupported_signal_type' })
          }
        }
      })

      let dropped = false
      const drop = (): void => {
        if (dropped) return
        dropped = true
        if (role === 'offerer' && targetRoom.offerer === peer) targetRoom.offerer = undefined
        if (role === 'answerer' && targetRoom.answerer === peer) targetRoom.answerer = undefined
        stats.peers = Math.max(0, stats.peers - 1)
        send(peerOf(targetRoom, peer), { type: 'peer-left', role })
        if (!targetRoom.offerer && !targetRoom.answerer) rooms.delete(roomName)
        stats.rooms = rooms.size
      }
      ws.on('close', drop)
      ws.on('error', drop)
    })
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(port, host, () => resolve())
  })
  const actualPort = (httpServer.address() as { port: number }).port
  stats.rooms = rooms.size

  return {
    host,
    port: actualPort,
    url: `ws://${host}:${actualPort}${RTC_SIGNAL_PATH}`,
    stats: () => ({ ...stats }),
    async close() {
      for (const room of rooms.values()) {
        for (const peer of [room.offerer, room.answerer]) {
          if (peer?.socket.readyState === WebSocket.OPEN) peer.socket.close(1001, 'signaling shutting down')
          peer?.socket.terminate()
        }
      }
      rooms.clear()
      stats.rooms = 0
      stats.peers = 0
      httpServer.closeAllConnections()
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
