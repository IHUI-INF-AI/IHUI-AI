// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import {
  createRtcSignalingServer,
  type RtcSignalingServer,
} from '../src/rtc/signaling.js'

const servers: RtcSignalingServer[] = []

afterEach(async () => {
  while (servers.length) await servers.pop()!.close()
})

interface Client {
  ws: WebSocket
  next(): Promise<Record<string, unknown>>
}

function open(url: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const queue: Array<Record<string, unknown>> = []
    const waiters: Array<(value: Record<string, unknown>) => void> = []
    ws.on('message', (raw) => {
      const value = JSON.parse(raw.toString()) as Record<string, unknown>
      const waiter = waiters.shift()
      if (waiter) waiter(value)
      else queue.push(value)
    })
    ws.once('open', () =>
      resolve({
        ws,
        next() {
          const value = queue.shift()
          if (value) return Promise.resolve(value)
          return new Promise((res) => waiters.push(res))
        },
      }),
    )
    ws.once('error', reject)
  })
}

function closeCode(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => ws.once('close', (code) => resolve(code)))
}

function handshakeError(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once('error', (err: Error) => resolve(err.message))
    ws.once('close', () => resolve('closed-without-error'))
  })
}

async function signalUrl(server: RtcSignalingServer, room: string, role: string): Promise<string> {
  return `${server.url}?room=${room}&role=${role}`
}

describe('B3-09 完整 WebRTC 信令', () => {
  it('健康探针暴露房间与 peer 计数', async () => {
    const server = await createRtcSignalingServer({ port: 0 })
    servers.push(server)
    const res = await fetch(`http://${server.host}:${server.port}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, rooms: 0, peers: 0 })
  })

  it('joined 下发 STUN/TURN 配置且不回显缺字段', async () => {
    const server = await createRtcSignalingServer({
      port: 0,
      iceServers: [
        { urls: 'stun:127.0.0.1:3478' },
        { urls: 'turn:127.0.0.1:3478', username: 'ihui', credential: 'secret' },
      ],
    })
    servers.push(server)
    const offerer = await open(await signalUrl(server, 'room-ice', 'offerer'))
    expect(await offerer.next()).toMatchObject({
      type: 'joined',
      role: 'offerer',
      iceServers: [
        { urls: 'stun:127.0.0.1:3478' },
        { urls: 'turn:127.0.0.1:3478', username: 'ihui', credential: 'secret' },
      ],
    })
    offerer.ws.close()
  })

  it('两端配对后按 offer/answer/ICE 原样转发', async () => {
    const server = await createRtcSignalingServer({ port: 0 })
    servers.push(server)
    const offerer = await open(await signalUrl(server, 'room-1', 'offerer'))
    expect(await offerer.next()).toMatchObject({ type: 'joined', role: 'offerer' })
    expect(await offerer.next()).toMatchObject({ type: 'waiting' })

    const answerer = await open(await signalUrl(server, 'room-1', 'answerer'))
    expect(await offerer.next()).toMatchObject({ type: 'peer-joined', role: 'answerer' })
    expect(await offerer.next()).toMatchObject({ type: 'ready' })
    expect(await answerer.next()).toMatchObject({ type: 'joined', role: 'answerer' })
    expect(await answerer.next()).toMatchObject({ type: 'peer-joined', role: 'offerer' })
    expect(await answerer.next()).toMatchObject({ type: 'ready' })

    offerer.ws.send(JSON.stringify({ type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' }))
    expect(await answerer.next()).toMatchObject({
      type: 'offer',
      sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n',
      role: 'offerer',
    })

    answerer.ws.send(JSON.stringify({ type: 'answer', sdp: 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n' }))
    expect(await offerer.next()).toMatchObject({
      type: 'answer',
      sdp: 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n',
      role: 'answerer',
    })

    offerer.ws.send(JSON.stringify({ type: 'ice', candidate: { candidate: 'candidate:1 1 udp 1 127.0.0.1 9000 typ host', sdpMid: '0' } }))
    expect(await answerer.next()).toMatchObject({
      type: 'ice',
      candidate: { candidate: 'candidate:1 1 udp 1 127.0.0.1 9000 typ host', sdpMid: '0' },
    })

    const stats = server.stats()
    expect(stats).toMatchObject({ offers: 1, answers: 1, iceCandidates: 1, rooms: 1, peers: 2 })

    offerer.ws.close()
    answerer.ws.close()
  })

  it('第三枚同角色连接显式 409 拒绝', async () => {
    const server = await createRtcSignalingServer({ port: 0 })
    servers.push(server)
    const first = await open(await signalUrl(server, 'room-2', 'offerer'))
    await first.next()
    await first.next()
    const second = new WebSocket(await signalUrl(server, 'room-2', 'offerer'))
    await expect(handshakeError(second)).resolves.toMatch(/409/)
    expect(server.stats().rejected).toBe(1)
    first.ws.close()
  })

  it('陌生 Origin 在握手阶段 403 拒绝', async () => {
    const server = await createRtcSignalingServer({ port: 0 })
    servers.push(server)
    const ws = new WebSocket(await signalUrl(server, 'room-3', 'offerer'), {
      headers: { origin: 'https://evil.example' },
    })
    await expect(handshakeError(ws)).resolves.toMatch(/403/)
    expect(server.stats().rejected).toBe(1)
  })

  it('bye 转发后双方断开不悬挂', async () => {
    const server = await createRtcSignalingServer({ port: 0 })
    servers.push(server)
    const offerer = await open(await signalUrl(server, 'room-4', 'offerer'))
    await offerer.next()
    await offerer.next()
    const answerer = await open(await signalUrl(server, 'room-4', 'answerer'))
    await offerer.next()
    await offerer.next()
    await answerer.next()
    await answerer.next()
    await answerer.next()

    offerer.ws.send(JSON.stringify({ type: 'bye' }))
    expect(await answerer.next()).toMatchObject({ type: 'bye', role: 'offerer' })
    await expect(closeCode(offerer.ws)).resolves.toBe(1000)
    answerer.ws.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
