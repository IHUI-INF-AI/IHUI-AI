// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage } from 'node:http'
import { __test__ } from '../ws-guard.js'

const {
  wsClientIp,
  wsHandshakeGate,
  pruneHandshakeTable,
  resetGuardState,
  handshakeTableSize,
  setLiveConnections,
  MAX_CONN_PER_IP,
  MAX_HANDSHAKE_PER_SEC,
  MAX_TRACKED_IPS,
} = __test__

function fakeReq(headers: Record<string, string>, remote = '10.0.0.9'): IncomingMessage {
  return { headers, socket: { remoteAddress: remote } } as unknown as IncomingMessage
}

beforeEach(() => {
  resetGuardState()
})

describe('wsClientIp', () => {
  it('优先取 CF-Connecting-IP', () => {
    const req = fakeReq({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })
    expect(wsClientIp(req)).toBe('1.1.1.1')
  })

  it('无 CF 头时取 X-Forwarded-For 最左跳', () => {
    const req = fakeReq({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' })
    expect(wsClientIp(req)).toBe('2.2.2.2')
  })

  it('都没有时回退 socket 远端地址', () => {
    expect(wsClientIp(fakeReq({}, '10.0.0.7'))).toBe('10.0.0.7')
  })

  it('连 socket 地址都拿不到时给 unknown 而不是空串', () => {
    const req = { headers: {}, socket: {} } as unknown as IncomingMessage
    expect(wsClientIp(req)).toBe('unknown')
  })
})

describe('wsHandshakeGate', () => {
  it('正常握手放行', () => {
    expect(wsHandshakeGate('5.5.5.5')).toEqual({ ok: true })
  })

  it('同一 IP 超过握手频率上限即拒绝,且给 429', () => {
    for (let i = 0; i < MAX_HANDSHAKE_PER_SEC; i++) {
      expect(wsHandshakeGate('6.6.6.6').ok).toBe(true)
    }
    const gate = wsHandshakeGate('6.6.6.6')
    expect(gate.ok).toBe(false)
    expect(gate.code).toBe(429)
  })

  it('频率计数按 IP 隔离,一个 IP 打满不影响另一个', () => {
    for (let i = 0; i <= MAX_HANDSHAKE_PER_SEC; i++) wsHandshakeGate('7.7.7.7')
    expect(wsHandshakeGate('8.8.8.8').ok).toBe(true)
  })

  it('单 IP 活跃连接数达到上限时拒绝新握手', () => {
    setLiveConnections('9.9.9.9', MAX_CONN_PER_IP)
    const gate = wsHandshakeGate('9.9.9.9')
    expect(gate.ok).toBe(false)
    expect(gate.reason).toContain('too many WebSocket connections')
  })

  it('活跃连接释放后重新放行', () => {
    setLiveConnections('9.9.9.10', MAX_CONN_PER_IP)
    expect(wsHandshakeGate('9.9.9.10').ok).toBe(false)
    setLiveConnections('9.9.9.10', MAX_CONN_PER_IP - 1)
    expect(wsHandshakeGate('9.9.9.10').ok).toBe(true)
  })
})

describe('覆盖面自证', () => {
  /**
   * 本仓所有 WS 端点都挂在 @fastify/websocket 的**单一** websocketServer 实例上，
   * 所以 wsGuard 的 wss.on('connection') 天然覆盖全部路由(实测现读：零第二套实例)。
   * 一旦有人自己 new WebSocketServer 或用 noServer 手工接管 upgrade，那些连接就绕开
   * 握手频率与单 IP 并发上限 —— 而 typecheck、lint、运行时都不报错，正是"防线静默失效"那一型。
   * 排除 __tests__ 目录：本文件与门体夹具逐字含该 pattern，自扫自己就是恒红(同守门 158 的取舍)。
   */
  it('apps/api/src 内不得出现第二套 WebSocketServer 实例', () => {
    const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const walk = (dir: string): string[] => {
      const files: string[] = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '__tests__') files.push(...walk(p))
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          files.push(p)
        }
      }
      return files
    }
    const hits: string[] = []
    for (const f of walk(srcRoot)) {
      const text = readFileSync(f, 'utf8')
      if (/new\s+(WebSocketServer|WebSocket\.Server)\b/.test(text)) hits.push(f)
    }
    expect(hits).toEqual([])
  })
})

describe('握手表内存治理', () => {
  it('过期条目会被清理,换 IP 打一发不会把表撑大', async () => {
    wsHandshakeGate('11.1.1.1')
    expect(handshakeTableSize()).toBe(1)
    // 窗口是 1s,等它过期后 prune 必须把键删掉(不是只清数组)
    await new Promise((r) => setTimeout(r, 1100))
    pruneHandshakeTable(Date.now())
    expect(handshakeTableSize()).toBe(0)
  })

  it('1s 内上万个 IP 涌入时表大小有硬顶', () => {
    for (let i = 0; i <= MAX_TRACKED_IPS; i++) wsHandshakeGate(`10.0.${i >> 8}.${i & 255}`)
    expect(handshakeTableSize()).toBeLessThanOrEqual(MAX_TRACKED_IPS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
