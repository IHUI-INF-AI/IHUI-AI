// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-connect-agent 集成测试(2026-11-10 立)。
 *
 * 守的是"ws 走账号代理"这一新增能力真能落地,而不是桩对桩自证:
 * - 起一个只处理 CONNECT 的 http 代理(与后端做 TCP 管道);
 * - 用 createConnectProxyAgent 造隧道 agent;
 * - ws 客户端经该代理连后端 ws 服务器,验证**双向收发**;
 * - 关键断言:代理确实收到了 CONNECT 请求(否则 ws 偷偷直连,测试就假绿了)。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import WebSocket, { WebSocketServer } from 'ws'
import { createConnectProxyAgent, isSupportedProxyUrl } from '../src/services/relay-connect-agent.js'

let backend: WebSocketServer | null = null
let proxy: Server | null = null
let backendPort = 0
let proxyPort = 0
let connectCount = 0

function startBackend(): Promise<number> {
  return new Promise((resolve) => {
    const s = new WebSocketServer({ port: 0, host: '127.0.0.1' })
    s.on('connection', (ws: WebSocket) => {
      ws.send('hello-from-upstream')
      ws.on('message', (m) => ws.send(`echo:${m.toString()}`))
    })
    s.on('listening', () => resolve((s.address() as AddressInfo).port))
    backend = s
  })
}

function startProxy(): Promise<number> {
  return new Promise((resolve) => {
    const p = createServer()
    // 标准 CONNECT 隧道:用 server 的 'connect' 事件拿到裸 TCP socket(不能用 request
    // 回调,CONNECT 下 http 解析器会接管 socket 导致隧道错乱 / 客户端 hang up)
    p.on('connect', (req, socket, head) => {
      connectCount += 1
      const [host, portStr] = (req.url ?? '').split(':')
      const port = Number(portStr) || 443
      const upstream = net.connect(port, host, () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head && head.length > 0) socket.unshift(head)
        socket.pipe(upstream)
        upstream.pipe(socket)
      })
      upstream.on('error', () => socket.destroy())
      socket.on('error', () => upstream.destroy())
    })
    p.on('request', (_req, res) => {
      res.writeHead(405)
      res.end()
    })
    p.listen(0, '127.0.0.1', () => resolve((p.address() as AddressInfo).port))
    proxy = p
  })
}

describe('relay-connect-agent', () => {
  beforeAll(async () => {
    backendPort = await startBackend()
    proxyPort = await startProxy()
  })

  afterAll(() => {
    backend?.close()
    proxy?.close()
  })

  it('isSupportedProxyUrl:SOCKS/非法一律 false,http/https 一律 true', () => {
    expect(isSupportedProxyUrl('http://p:8080')).toBe(true)
    expect(isSupportedProxyUrl('https://u:p@p:3128')).toBe(true)
    expect(isSupportedProxyUrl('socks5://p:1080')).toBe(false)
    expect(isSupportedProxyUrl('socks4://p:1080')).toBe(false)
    expect(isSupportedProxyUrl('not-a-url')).toBe(false)
  })

  it('ws 经 http 代理 CONNECT 隧道能建连并双向收发(代理确实收到 CONNECT)', async () => {
    const agent = createConnectProxyAgent(`http://127.0.0.1:${proxyPort}`, {
      secureTarget: false,
    })
    const ws = new WebSocket(`ws://127.0.0.1:${backendPort}`, { agent })
    const received: string[] = []

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('隧道收发超时')), 5000)
      ws.on('open', () => ws.send('ping'))
      ws.on('message', (m: WebSocket.RawData) => {
        received.push(m.toString())
        if (received.includes('echo:ping')) {
          clearTimeout(timer)
          resolve()
        }
      })
      ws.on('error', reject)
    })

    // 双向收发都成功
    expect(received).toContain('hello-from-upstream')
    expect(received).toContain('echo:ping')
    // 铁证:ws 真走了隧道(否则 connectCount 为 0,测试假绿)
    expect(connectCount).toBeGreaterThan(0)
    ws.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
