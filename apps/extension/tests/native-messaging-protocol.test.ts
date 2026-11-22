// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * R73 native messaging 判据层回归锁。
 *
 * 覆盖:帧编码(固定 LE)/ 上限 / 拒绝族 / 流式读数器 / 注册表校验族 / 全序优选 / 差分发布。
 * 本层零 Chrome 与零 node: 依赖,故全部直驱纯函数,不起宿主进程。
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FUTURE_TOLERANCE_MS,
  DEFAULT_PEER_STALE_AFTER_MS,
  NATIVE_MAX_INBOUND_BODY_BYTES,
  checkPeerRecord,
  createNativeFrameReader,
  decodeNativeFrame,
  encodeNativeFrame,
  planRegistryPublish,
  resolvePeerRegistry,
  type PeerRecord,
} from '../lib/native-messaging-protocol'

const okCtx = { now: 1_000_000, isPidAlive: () => true }
const rec = (over: Partial<PeerRecord> = {}): PeerRecord => ({
  id: 'a',
  port: 40_005,
  pid: 4242,
  timestamp: 1_000_000,
  ...over,
})

describe('encodeNativeFrame', () => {
  it('长度前缀固定小端 —— 对照 C++ 参考的"本地字节序"留歧义，这里钉死', () => {
    const frame = encodeNativeFrame({ hello: '世界' })
    const body = new TextEncoder().encode(JSON.stringify({ hello: '世界' }))
    expect(frame.slice(0, 4)).toEqual(
      new Uint8Array([body.byteLength & 0xff, (body.byteLength >> 8) & 0xff, 0, 0]),
    )
    expect(frame.byteLength).toBe(4 + body.byteLength)
  })

  it('超长体直接抛，不静默丢帧', () => {
    expect(() => encodeNativeFrame({ x: 'y'.repeat(4096) }, 64)).toThrow(RangeError)
  })
})

describe('decodeNativeFrame', () => {
  it('往返一致', () => {
    const payload = { type: 'watchRelayClients', protocolVersion: 1, list: [1, 2, 3] }
    const r = decodeNativeFrame(encodeNativeFrame(payload))
    expect(r.ok).toBe(true)
    expect(r.payload).toEqual(payload)
    expect(r.consumedBytes).toBe(4 + new TextEncoder().encode(JSON.stringify(payload)).byteLength)
  })

  it('大端写法的帧被判 over-limit(毒帧)，不是当"没收到"', () => {
    const body = new TextEncoder().encode(JSON.stringify({ a: 1 }))
    const be = new Uint8Array(4 + body.byteLength)
    new DataView(be.buffer).setUint32(0, body.byteLength, false)
    be.set(body, 4)
    const r = decodeNativeFrame(be)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('over-limit')
  })

  it.each([
    ['header-incomplete', new Uint8Array([1, 0])],
    ['empty-body', new Uint8Array([0, 0, 0, 0])],
    ['body-incomplete', new Uint8Array([8, 0, 0, 0, 1, 2, 3])],
  ])('拒绝族 %s', (reason, src) => {
    expect(decodeNativeFrame(src).reason).toBe(reason)
  })

  it('非 UTF-8 与非法 JSON 各自有名', () => {
    const bad = new Uint8Array([3, 0, 0, 0, 0xff, 0xfe, 0xfd])
    expect(decodeNativeFrame(bad).reason).toBe('invalid-utf8')
    const notJson = encodeNativeFrameRaw('}{')
    expect(decodeNativeFrame(notJson).reason).toBe('invalid-json')
    const scalar = encodeNativeFrameRaw('42')
    expect(decodeNativeFrame(scalar).reason).toBe('not-an-object')
  })
})

function encodeNativeFrameRaw(text: string): Uint8Array {
  const body = new TextEncoder().encode(text)
  const frame = new Uint8Array(4 + body.byteLength)
  new DataView(frame.buffer).setUint32(0, body.byteLength, true)
  frame.set(body, 4)
  return frame
}

describe('createNativeFrameReader', () => {
  it('跨 chunk 半帧不吐，补齐后一次性吐两帧', () => {
    const reader = createNativeFrameReader()
    const f1 = encodeNativeFrame({ n: 1 })
    const f2 = encodeNativeFrame({ n: 2 })
    const glued = new Uint8Array(f1.length + f2.length)
    glued.set(f1, 0)
    glued.set(f2, f1.length)
    expect(reader.push(glued.subarray(0, 6))).toEqual([])
    expect(reader.pendingBytes()).toBe(6)
    expect(reader.push(glued.subarray(6))).toEqual([{ n: 1 }, { n: 2 }])
    expect(reader.stats()).toMatchObject({ framesRead: 2, rejected: 0, lastReject: undefined })
  })

  it('毒帧被计数并跳过，后续好帧仍可达(判据失效不该表现为安静)', () => {
    const reader = createNativeFrameReader()
    const poison = new Uint8Array([2, 0, 0, 0, 0xff, 0xff])
    const good = encodeNativeFrame({ ok: true })
    const mixed = new Uint8Array(poison.length + good.length)
    mixed.set(poison, 0)
    mixed.set(good, poison.length)
    expect(reader.push(mixed)).toEqual([{ ok: true }])
    expect(reader.stats()).toMatchObject({ framesRead: 1, rejected: 1, lastReject: 'invalid-utf8' })
  })

  it('超过入向硬限即整帧丢弃并记读数', () => {
    const reader = createNativeFrameReader(8)
    const big = new Uint8Array(4 + 40)
    new DataView(big.buffer).setUint32(0, 40, true)
    expect(reader.push(big)).toEqual([])
    expect(reader.stats()).toMatchObject({ rejected: 1, lastReject: 'over-limit', framesRead: 0 })
  })

  it('入向上限等于 Chrome 的 1 MiB', () => {
    expect(NATIVE_MAX_INBOUND_BODY_BYTES).toBe(1024 * 1024)
  })
})

describe('checkPeerRecord', () => {
  it('健康记录放行', () => {
    expect(checkPeerRecord(rec(), okCtx)).toEqual({ accepted: true })
  })

  it.each([
    ['malformed', rec({ port: 0 })],
    ['malformed', rec({ pid: 1.5 })],
    ['malformed', { ...rec(), id: '' }],
    ['malformed', null],
  ])('%s 族的每条都被拒', (_reason, bad) => {
    expect(checkPeerRecord(bad, okCtx).accepted).toBe(false)
  })

  it('超存活期判 stale，默认 30s', () => {
    const v = checkPeerRecord(
      rec({ timestamp: okCtx.now - DEFAULT_PEER_STALE_AFTER_MS - 1 }),
      okCtx,
    )
    expect(v).toEqual({ accepted: false, reason: 'stale' })
  })

  it('时钟超前超过容差判 future-skew，默认 5s', () => {
    const v = checkPeerRecord(
      rec({ timestamp: okCtx.now + DEFAULT_FUTURE_TOLERANCE_MS + 1 }),
      okCtx,
    )
    expect(v).toEqual({ accepted: false, reason: 'future-skew' })
  })

  it('pid 判死优先于放行(存活探测由调用方注入)', () => {
    expect(checkPeerRecord(rec(), { ...okCtx, isPidAlive: () => false })).toEqual({
      accepted: false,
      reason: 'dead-pid',
    })
  })

  it('租约不符的记录不得影响优选', () => {
    expect(checkPeerRecord(rec({ lease: 'other' }), { ...okCtx, expectedLease: 'mine' })).toEqual({
      accepted: false,
      reason: 'lease-mismatch',
    })
  })
})

describe('resolvePeerRegistry', () => {
  it('优选序是全序:新 timestamp 优先，与输入顺序无关', () => {
    const older = rec({ id: 'z', timestamp: okCtx.now - 5_000 })
    const newer = rec({ id: 'a', timestamp: okCtx.now - 1_000 })
    expect(resolvePeerRegistry([older, newer], okCtx).preferred?.id).toBe('a')
    expect(resolvePeerRegistry([newer, older], okCtx).preferred?.id).toBe('a')
  })

  it('外部 now 是时钟真相源:宿主时钟落后于当下仍被判 stale(不信任被写脏的宿主时钟)', () => {
    const skewed = rec({ id: 'skew', timestamp: 20 })
    const r = resolvePeerRegistry([skewed], okCtx)
    expect(r.rejects).toEqual([{ id: 'skew', reason: 'stale' }])
    expect(r.preferred).toBe(null)
    // 同一记录放进"当下即 20"的上下文里就是新鲜的 —— 说明判定只看 ctx.now，不看宿主自身
    expect(resolvePeerRegistry([skewed], { now: 20, isPidAlive: () => true }).preferred?.id).toBe(
      'skew',
    )
  })

  it('同 timestamp 按 lease 再 id 字典序定胜负', () => {
    const r = resolvePeerRegistry(
      [rec({ id: 'b', lease: 'L2' }), rec({ id: 'a', lease: 'L2' }), rec({ id: 'c', lease: 'L1' })],
      okCtx,
    )
    expect(r.peers.map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })

  it('同 id 多条只留最新一条(污染面被压住)', () => {
    const r = resolvePeerRegistry(
      [
        rec({ id: 'same', port: 1111, timestamp: okCtx.now - 4_000 }),
        rec({ id: 'same', port: 2222, timestamp: okCtx.now - 1_000 }),
      ],
      okCtx,
    )
    expect(r.peers).toHaveLength(1)
    expect(r.preferred?.port).toBe(2222)
  })

  it('被拒记录逐条点名，不被静默丢弃', () => {
    const r = resolvePeerRegistry(
      [rec(), rec({ timestamp: okCtx.now - 99_999 }), rec({ port: -1 })],
      okCtx,
    )
    expect(r.preferred?.id).toBe('a')
    expect(r.rejects).toEqual([
      { id: 'a', reason: 'stale' },
      { id: 'a', reason: 'malformed' },
    ])
  })

  it('空注册表给 null 优选而非抛', () => {
    expect(resolvePeerRegistry([], okCtx)).toEqual({ peers: [], preferred: null, rejects: [] })
  })
})

describe('planRegistryPublish', () => {
  it('快照未变不广播', () => {
    const peers = [rec()]
    expect(
      planRegistryPublish(
        peers,
        peers.map((p) => ({ ...p })),
      ),
    ).toEqual({ kind: 'unchanged' })
  })

  it('首次发布给全量', () => {
    expect(planRegistryPublish(null, [rec()]).kind).toBe('full')
  })

  it('变化时给差分:新增与移除分别点名，内容变了也算变化', () => {
    const prev = [rec({ id: 'a' }), rec({ id: 'b' })]
    const next = [rec({ id: 'a' }), rec({ id: 'c', port: 31_337 })]
    const change = planRegistryPublish(prev, next)
    expect(change).toMatchObject({ kind: 'diff' })
    if (change.kind === 'diff') {
      expect(change.added.map((p) => p.id)).toEqual(['c'])
      expect(change.removed).toEqual(['b'])
    }
    expect(planRegistryPublish([rec({ id: 'a' })], [rec({ id: 'a', port: 9999 })]).kind).toBe(
      'diff',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
