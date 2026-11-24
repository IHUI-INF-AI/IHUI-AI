// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

import { createRtcBridge, RTC_MEDIA_AUDIO, RTC_MEDIA_VIDEO, type RtcBridge } from '../src/rtc/bridge.js'

const bridges: RtcBridge[] = []

afterEach(async () => {
  while (bridges.length) await bridges.pop()!.close()
})

interface Client {
  ws: WebSocket
  next(): Promise<{ data: Buffer; binary: boolean }>
}

function open(url: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const queue: Array<{ data: Buffer; binary: boolean }> = []
    const waiters: Array<(value: { data: Buffer; binary: boolean }) => void> = []
    ws.on('message', (data, isBinary) => {
      const item = { data: data as Buffer, binary: isBinary }
      const waiter = waiters.shift()
      if (waiter) waiter(item)
      else queue.push(item)
    })
    ws.once('open', () =>
      resolve({
        ws,
        next() {
          const item = queue.shift()
          if (item) return Promise.resolve(item)
          return new Promise((res) => waiters.push(res))
        },
      }),
    )
    ws.once('error', reject)
  })
}

function closedCode(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.once('close', (code) => resolve(code))
  })
}

describe('B3-09 RTC 音视频桥', () => {
  it('房间令牌不对即 4401 拒绝', async () => {
    const bridge = await createRtcBridge({ port: 0 })
    bridges.push(bridge)
    bridge.issueRoomToken('r1')
    const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}?room=r1&token=deadbeef`)
    const code = await closedCode(ws)
    expect(code).toBe(4401)
  })

    it('两端配对后原样转发音视频帧并计数', async () => {
    const bridge = await createRtcBridge({ port: 0 })
    bridges.push(bridge)
    const token = bridge.issueRoomToken('r2')
    const publisher = await open(`ws://127.0.0.1:${bridge.port}?room=r2&token=${token}`)
    const joined = await publisher.next()
    expect(JSON.parse(joined.data.toString())).toMatchObject({ type: 'joined', role: 'publisher' })

    const subscriber = await open(`ws://127.0.0.1:${bridge.port}?room=r2&token=${token}`)
    expect(JSON.parse((await subscriber.next()).data.toString())).toMatchObject({
      type: 'joined',
      role: 'subscriber',
    })

    const audio = Buffer.concat([Buffer.from([RTC_MEDIA_AUDIO]), Buffer.from([1, 2, 3, 4])])
    const video = Buffer.concat([Buffer.from([RTC_MEDIA_VIDEO]), Buffer.from([9, 8])])
    publisher.ws.send(audio)
    const audioFrame = await subscriber.next()
    expect(audioFrame.binary).toBe(true)
    expect(Buffer.compare(audioFrame.data, audio)).toBe(0)

    publisher.ws.send(video)
    const videoFrame = await subscriber.next()
    expect(Buffer.compare(videoFrame.data, video)).toBe(0)

    const stats = bridge.roomStats('r2')
    expect(stats.audioFrames).toBe(1)
    expect(stats.videoFrames).toBe(1)
    expect(stats.audioBytes).toBe(4)
    expect(stats.videoBytes).toBe(2)

    publisher.ws.close()
    subscriber.ws.close()
  })

  it('第三个连接 4029 拒绝', async () => {
    const bridge = await createRtcBridge({ port: 0 })
    bridges.push(bridge)
    const token = bridge.issueRoomToken('r3')
    const a = await open(`ws://127.0.0.1:${bridge.port}?room=r3&token=${token}`)
    const b = await open(`ws://127.0.0.1:${bridge.port}?room=r3&token=${token}`)
    const c = new WebSocket(`ws://127.0.0.1:${bridge.port}?room=r3&token=${token}`)
    expect(await closedCode(c)).toBe(4029)
    a.ws.close()
    b.ws.close()
  })

  it('畸形二进制帧只计拒绝、不转发', async () => {
    const bridge = await createRtcBridge({ port: 0 })
    bridges.push(bridge)
    const token = bridge.issueRoomToken('r4')
    const a = await open(`ws://127.0.0.1:${bridge.port}?room=r4&token=${token}`)
    await a.next()
    const b = await open(`ws://127.0.0.1:${bridge.port}?room=r4&token=${token}`)
    await b.next()

    let received = false
    b.ws.once('message', () => {
      received = true
    })
    a.ws.send(Buffer.from([7, 1, 2]))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(received).toBe(false)
    expect(bridge.roomStats('r4').rejectedFrames).toBe(1)
    a.ws.close()
    b.ws.close()
  })

  it('控制帧只在对端转发', async () => {
    const bridge = await createRtcBridge({ port: 0 })
    bridges.push(bridge)
    const token = bridge.issueRoomToken('r5')
    const a = await open(`ws://127.0.0.1:${bridge.port}?room=r5&token=${token}`)
    await a.next()
    const b = await open(`ws://127.0.0.1:${bridge.port}?room=r5&token=${token}`)
    await b.next()
    a.ws.send(JSON.stringify({ type: 'control', sdp: 'x' }))
    const frame = await b.next()
    expect(JSON.parse(frame.data.toString())).toMatchObject({ type: 'control', sdp: 'x' })
    expect(bridge.roomStats('r5').controlFrames).toBe(1)
    a.ws.close()
    b.ws.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
