// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { type Command } from 'commander'

import { createRtcBridge } from '../rtc/bridge.js'
import { createRtcSignalingServer, type RtcIceServer } from '../rtc/signaling.js'

interface SignalOptions {
  host: string
  port: string
  stun?: string
  turn?: string
  turnUsername?: string
  turnCredential?: string
}

function buildIceServers(opts: SignalOptions): RtcIceServer[] {
  const servers: RtcIceServer[] = []
  if (opts.stun?.trim()) servers.push({ urls: opts.stun.trim() })
  if (opts.turn?.trim()) {
    const urls = opts.turn.trim()
    if (!opts.turnUsername || !opts.turnCredential) {
      throw new Error('--turn 需要同时提供 --turn-username 与 --turn-credential')
    }
    servers.push({
      urls,
      username: opts.turnUsername,
      credential: opts.turnCredential,
    })
  }
  return servers
}

export function registerRtcCommand(program: Command): void {
  const rtc = program
    .command('rtc')
    .description('RTC 音视频桥(本机中继;令牌一次性打印到 stdout)')

  rtc
    .command('serve')
    .description('启动房间中继，等待 publisher/subscriber 两端接入')
    .option('--host <host>', '监听地址', '127.0.0.1')
    .option('--port <port>', '监听端口(0=随机)', '0')
    .option('--room <room>', '房间名', 'default')
    .action(async (opts: { host: string; port: string; room: string }) => {
      const port = Number.parseInt(opts.port, 10)
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`invalid port: ${opts.port}`)
      }
      const bridge = await createRtcBridge({ host: opts.host, port })
      const token = bridge.issueRoomToken(opts.room)
      process.stdout.write(
        `rtc bridge listening ws://${bridge.host}:${bridge.port}?room=${opts.room}&token=${token}\n`,
      )
      await new Promise<void>((resolve) => {
        const stop = (): void => void bridge.close().finally(resolve)
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
        process.once('beforeExit', stop)
      })
    })

  rtc
    .command('signal')
    .description('启动完整 WebRTC 信令服务（浏览器 RTCPeerConnection 的 SDP/ICE 协商面）')
    .option('--host <host>', '监听地址', '127.0.0.1')
    .option('--port <port>', '监听端口(0=随机)', '0')
    .option('--stun <url>', '下发给浏览器的 STUN 服务器 URL')
    .option('--turn <url>', '下发给浏览器的 TURN 服务器 URL')
    .option('--turn-username <name>', 'TURN 用户名')
    .option('--turn-credential <secret>', 'TURN 凭据')
    .action(async (opts: SignalOptions) => {
      const port = Number.parseInt(opts.port, 10)
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`invalid port: ${opts.port}`)
      }
      const iceServers = buildIceServers(opts)
      const signaling = await createRtcSignalingServer({ host: opts.host, port, iceServers })
      process.stdout.write(
        `rtc signaling listening ${signaling.url}?room=<room>&role=offerer|answerer (iceServers=${iceServers.length})\n`,
      )
      await new Promise<void>((resolve) => {
        const stop = (): void => void signaling.close().finally(resolve)
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
        process.once('beforeExit', stop)
      })
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
