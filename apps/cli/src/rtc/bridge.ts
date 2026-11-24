// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B3-09 RTC 音视频桥（自建实现，不依赖 `aoq_node_ext.node` / `AoqClientSdk.dll`）。
 *
 * 对照能力拆成可验证的运行时：
 *   - 房间 + 一次性令牌两两配对，第三个连接显式拒绝（4029）；
 *   - 二进制帧首字节是媒体类型（0=音频 / 1=视频），只做原样转发，不转码、不落盘；
 *   - 文本控制帧（offer/answer/ice/bye）只在对端之间转发；
 *   - 4MB 背压闸、1MB 单帧上限、64KB 控制帧上限；
 *   - 帧计数与字节数可在关闭前读取，不假装有链路却没有证据。
 *
 * 这里实现的是「可自托管的中继桥」，不是浏览器 WebRTC 的完整协商栈；
 * 需要 WebRTC 终端的场景可把本桥当信令+媒体中继的确定性底座。
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'

export const RTC_MAX_PEERS_PER_ROOM = 2
export const RTC_MAX_BINARY_BYTES = 1024 * 1024
export const RTC_MAX_CONTROL_BYTES = 64 * 1024
export const RTC_BACKPRESSURE_BYTES = 4 * 1024 * 1024
export const RTC_MEDIA_AUDIO = 0
export const RTC_MEDIA_VIDEO = 1

export type RtcRole = 'publisher' | 'subscriber'

export interface RtcRoomStats {
  audioFrames: number
  videoFrames: number
  audioBytes: number
  videoBytes: number
  controlFrames: number
  rejectedFrames: number
}

export interface RtcBridgeOptions {
  host?: string
  port?: number
}

export interface RtcBridge {
  readonly port: number
  readonly host: string
  issueRoomToken(room: string): string
  roomStats(room: string): RtcRoomStats
  close(): Promise<void>
}

interface RoomState {
  token: Buffer
  peers: Map<WebSocket, RtcRole>
  stats: RtcRoomStats
  heartbeat?: NodeJS.Timeout
}

function sameToken(expected: Buffer, got: string | null): boolean {
  if (!got) return false
  let actual: Buffer
  try {
    actual = Buffer.from(got, 'hex')
  } catch {
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function tokenFor(room: string, salt: string): Buffer {
  return Buffer.from(createHash('sha256').update(`rtc:${salt}:${room}`).digest())
}

function emptyStats(): RtcRoomStats {
  return {
    audioFrames: 0,
    videoFrames: 0,
    audioBytes: 0,
    videoBytes: 0,
    controlFrames: 0,
    rejectedFrames: 0,
  }
}

function roleFor(room: RoomState): RtcRole {
  return room.peers.size === 0 ? 'publisher' : 'subscriber'
}

function peerOf(room: RoomState, self: WebSocket): WebSocket | undefined {
  for (const [ws] of room.peers) if (ws !== self) return ws
  return undefined
}

function safeSend(ws: WebSocket, payload: string | Buffer): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false
  if (ws.bufferedAmount > RTC_BACKPRESSURE_BYTES) {
    ws.close(1013, 'backpressure')
    return false
  }
  ws.send(payload)
  return true
}

function relay(room: RoomState, from: WebSocket, data: Buffer): void {
  const kind = data[0]
  if (data.length < 2 || (kind !== RTC_MEDIA_AUDIO && kind !== RTC_MEDIA_VIDEO)) {
    room.stats.rejectedFrames += 1
    return
  }
  if (data.length - 1 > RTC_MAX_BINARY_BYTES) {
    room.stats.rejectedFrames += 1
    return
  }
  if (kind === RTC_MEDIA_AUDIO) {
    room.stats.audioFrames += 1
    room.stats.audioBytes += data.length - 1
  } else {
    room.stats.videoFrames += 1
    room.stats.videoBytes += data.length - 1
  }
  const peer = peerOf(room, from)
  if (peer) safeSend(peer, data)
}

export async function createRtcBridge(options: RtcBridgeOptions = {}): Promise<RtcBridge> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  const salt = randomBytes(16).toString('hex')
  const rooms = new Map<string, RoomState>()

  const wss = new WebSocketServer({
    host,
    port,
    maxPayload: RTC_MAX_BINARY_BYTES + 1,
    perMessageDeflate: false,
  })

  await new Promise<void>((resolve, reject) => {
    wss.once('listening', () => resolve())
    wss.once('error', reject)
  })

  const actualPort = (wss.address() as { port: number }).port

  const issueRoomToken = (roomName: string): string => {
    const token = tokenFor(roomName, salt)
    rooms.set(roomName, {
      token,
      peers: new Map(),
      stats: emptyStats(),
    })
    return token.toString('hex')
  }

  const reject = (ws: WebSocket, code: number, reason: string): void => {
    ws.close(code, reason)
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `ws://${host}:${actualPort}`)
    const roomName = url.searchParams.get('room') ?? ''
    const token = url.searchParams.get('token')
    const room = rooms.get(roomName)
    if (!room || !sameToken(room.token, token)) {
      reject(ws, 4401, 'invalid room token')
      return
    }
    if (room.peers.size >= RTC_MAX_PEERS_PER_ROOM) {
      reject(ws, 4029, 'room full')
      return
    }

    const role = roleFor(room)
    room.peers.set(ws, role)
    safeSend(ws, JSON.stringify({ type: 'joined', room: roomName, role }))
    const peer = peerOf(room, ws)
    if (peer) safeSend(peer, JSON.stringify({ type: 'peer-joined', role }))
    else safeSend(ws, JSON.stringify({ type: 'waiting' }))

    room.heartbeat ??= setInterval(() => {
      for (const [socket] of room.peers) {
        if (socket.readyState === WebSocket.OPEN) socket.ping()
      }
    }, 30_000)

    ws.on('message', (raw, isBinary) => {
      if (isBinary) {
        relay(room, ws, raw as Buffer)
        return
      }
      const text = raw.toString()
      if (text.length > RTC_MAX_CONTROL_BYTES) {
        room.stats.rejectedFrames += 1
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        room.stats.rejectedFrames += 1
        return
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        (parsed as { type?: unknown }).type !== 'control'
      ) {
        room.stats.rejectedFrames += 1
        return
      }
      room.stats.controlFrames += 1
      const other = peerOf(room, ws)
      if (other) safeSend(other, text)
    })

    const drop = (): void => {
      if (!room.peers.delete(ws)) return
      const other = peerOf(room, ws)
      if (other) safeSend(other, JSON.stringify({ type: 'peer-left', role }))
      if (room.peers.size === 0 && room.heartbeat) {
        clearInterval(room.heartbeat)
        room.heartbeat = undefined
      }
    }
    ws.on('close', drop)
    ws.on('error', drop)
  })

  return {
    port: actualPort,
    host,
    issueRoomToken,
    roomStats(roomName) {
      const room = rooms.get(roomName)
      return room ? { ...room.stats } : emptyStats()
    },
    async close() {
      for (const room of rooms.values()) {
        if (room.heartbeat) clearInterval(room.heartbeat)
        for (const [ws] of room.peers) {
          if (ws.readyState === WebSocket.OPEN) ws.close(1001, 'bridge shutting down')
          ws.terminate()
        }
      }
      await new Promise<void>((resolve, reject) => {
        wss.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
