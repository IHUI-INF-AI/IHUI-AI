// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, expect, it } from 'vitest'
import {
  BRIDGE_PROTOCOL_VERSION,
  BridgeHandshakeError,
  computeMethodDigest,
  createBridgeHello,
  createFailClosedGate,
  negotiateBridge,
  scanBridgeCalls,
  type BridgeEntrypointSpec,
} from '../src/bridge-handshake.js'

const EPS: readonly BridgeEntrypointSpec[] = [
  { id: 'chat', requiredMethods: ['session/new', 'session/prompt'] },
  { id: 'audio', requiredMethods: ['audio/start', 'audio/stop'] },
  { id: 'settings', requiredMethods: ['initialize'] },
]

const HOST_METHODS = ['initialize', 'session/new', 'session/prompt', 'session/cancel']

describe('L07 computeMethodDigest', () => {
  it('顺序无关、去重、稳定', () => {
    const a = computeMethodDigest(['b', 'a', 'a', 'c'])
    const b = computeMethodDigest(['c', 'b', 'a'])
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
  })

  it('方法表变化摘要变化', () => {
    expect(computeMethodDigest(['session/new'])).not.toBe(computeMethodDigest(['session/old']))
  })
})

describe('L07 createBridgeHello', () => {
  it('产出带协议版本与摘要的 HELLO', () => {
    const hello = createBridgeHello({ version: '1.4.0', methods: HOST_METHODS })
    expect(hello.protocol).toBe(BRIDGE_PROTOCOL_VERSION)
    expect(hello.methodDigest).toBe(computeMethodDigest(HOST_METHODS))
    expect(Object.isFrozen(hello)).toBe(true)
  })

  it('非法 manifest fail-closed(version 空/方法空/方法名非法)', () => {
    expect(() => createBridgeHello({ version: '  ', methods: HOST_METHODS })).toThrow(
      BridgeHandshakeError,
    )
    expect(() => createBridgeHello({ version: '1.0.0', methods: [] })).toThrow(
      BridgeHandshakeError,
    )
    expect(() => createBridgeHello({ version: '1.0.0', methods: ['Bad Name'] })).toThrow(
      BridgeHandshakeError,
    )
  })
})

describe('L07 negotiateBridge', () => {
  const hello = createBridgeHello({ version: '1.4.0', methods: HOST_METHODS })

  it('方法齐全即兼容', () => {
    const r = negotiateBridge(hello, ['session/new', 'session/prompt'], EPS)
    expect(r.compatible).toBe(true)
    expect(r.code).toBe('ok')
    expect(r.disabledEntrypoints).toEqual([])
    expect(r.notice).toBeNull()
  })

  it('缺 audio 方法只禁用 audio 入口并给 UI 明示', () => {
    const r = negotiateBridge(hello, ['session/new', 'audio/start'], EPS)
    expect(r.compatible).toBe(false)
    expect(r.code).toBe('missing-methods')
    expect(r.missingMethods).toEqual(['audio/start'])
    expect(r.disabledEntrypoints).toEqual(['audio'])
    expect(r.notice).toContain('audio')
  })

  it('协议版本不符禁用全部入口', () => {
    const r = negotiateBridge({ ...hello, protocol: '9' }, ['session/new'], EPS)
    expect(r.code).toBe('protocol-mismatch')
    expect(r.disabledEntrypoints).toEqual(['chat', 'audio', 'settings'])
  })

  it('摘要被篡改禁用全部入口(不信任对端自报摘要)', () => {
    const r = negotiateBridge({ ...hello, methodDigest: 'deadbeef' }, ['session/new'], EPS)
    expect(r.code).toBe('digest-mismatch')
    expect(r.disabledEntrypoints.length).toBe(EPS.length)
  })

  it('重复缺失方法去重', () => {
    const r = negotiateBridge(hello, ['audio/start', 'audio/start', 'audio/stop'], EPS)
    expect(r.missingMethods).toEqual(['audio/start', 'audio/stop'])
  })
})

describe('L07 fail-closed 门', () => {
  it('握手未完成时全部入口禁用并明示原因', () => {
    const gate = createFailClosedGate(EPS, 'native 未响应')
    expect(gate.compatible).toBe(false)
    expect(gate.disabledEntrypoints).toEqual(['chat', 'audio', 'settings'])
    expect(gate.notice).toContain('native 未响应')
  })
})

describe('L07 scanBridgeCalls 静态校验', () => {
  const allowed = ['session/new', 'session/prompt']

  it('抓出未注册的桥调用名并去重排序', () => {
    const src = `
      bridge.call('session/new', {})
      bridge.call('audio/start', {})
      bridge.call('audio/start', {})
      bridge.call('zzz/legacy', {})
    `
    const found = scanBridgeCalls(src, /bridge\.call\(\s*'([^']+)'/g, allowed)
    expect(found).toEqual(['audio/start', 'zzz/legacy'])
  })

  it('全部已注册则空数组', () => {
    const src = "bridge.call('session/prompt', {})"
    expect(scanBridgeCalls(src, /bridge\.call\(\s*'([^']+)'/g, allowed)).toEqual([])
  })
})
