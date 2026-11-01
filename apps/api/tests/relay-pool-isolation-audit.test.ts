// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池隔离性体检尺裁决锁(2026-11-01 立)。
 *
 * 钉的是「号与号互相牵连」六维(D1 设备簇 / D2 共用 rt / D3 同 uid 双行 / D4 rt 终点证据 /
 * D5 出口亲和 / D6 死副本)的纯函数裁决,以及汇总裁决 / 结论行 / 参数解析。
 *
 * 零真实 DB/Redis,也不打上游 —— 本尺的取数面(auditPoolIsolation)判机器状态、刻意不进提交链,
 * 这一份只锁纯函数,不让「真连库」成为判据能否被验证的前提(§0.3:判据必须可独立验证)。
 * 模块顶层静态 import 了 db / @ihui/database / poolService,这里用 vi.mock 把它们换成桩,
 * 既避开导入期副作用,也让 computeDeviceCollisions 的判据单源(从 poolService.__test__ 取)保持真身。
 */
import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// 判据单源:computeDeviceCollisions 必须从 poolService.__test__ 取(不抄第二份),这里给回真身的等价桩
vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: { select: () => ({ from: () => ({}) }) },
}))
vi.mock('@ihui/database', () => ({ aiRelayAccountPool: { providerCode: 'providerCode' } }))
vi.mock('../src/services/relay-account-pool-service.js', () => ({
  __test__: {
    computeDeviceCollisions: (rows: ReadonlyArray<{ deviceId?: string | null; uid: string }>) => {
      const m = new Map<string, string[]>()
      for (const r of rows) {
        if (!r.deviceId) continue
        const arr = m.get(r.deviceId) ?? []
        arr.push(r.uid)
        m.set(r.deviceId, arr)
      }
      return [...m.entries()]
        .filter(([, u]) => u.length >= 2)
        .map(([deviceId, uids]) => ({ deviceId, uids }))
    },
  },
}))

const A = await import('../scripts/relay-pool-isolation-audit.js')

describe('D1 设备簇(deviceClusterDim)', () => {
  it('① ≥2 uid 共用一枚 deviceId ⇒ info(设备身份整机一份、不可整改,点名提醒而非假红 breach)', () => {
    const d = A.deviceClusterDim([{ deviceId: 'dev1', uids: ['a', 'b'] }], 4)
    expect(d.state).toBe('info')
    expect(d.count).toBe(1)
    expect(d.detail[0]).toContain('dev1')
  })
  it('② 无碰撞 ⇒ ok', () => {
    expect(A.deviceClusterDim([], 4).state).toBe('ok')
  })
  it('③ 池面读不到(null)⇒ unjudged,不记绿也不冒红', () => {
    expect(A.deviceClusterDim([], null).state).toBe('unjudged')
  })
})

describe('D2 共用 rt(sharedRtDim)', () => {
  it('④ 同一枚 rt 出现在多行 ⇒ breach(谁刷谁顶废另一处)', () => {
    const d = A.sharedRtDim([{ providerCode: 'trae', uids: ['a', 'b'] }])
    expect(d.state).toBe('breach')
  })
  it('⑤ 无共用 ⇒ ok', () => {
    expect(A.sharedRtDim([]).state).toBe('ok')
  })
  it('⑥ 取不到(null)⇒ unjudged', () => {
    expect(A.sharedRtDim(null).state).toBe('unjudged')
  })
})

describe('D3 同 uid 跨池双行(sameUidDim)', () => {
  it('⑦ 同 uid 两行 ⇒ info(两把 partial unique 允许,只点名提醒别当成一枚号)', () => {
    const d = A.sameUidDim([{ providerCode: 'qoder', uid: 'u1', owners: ['OPS', 'ownerX'] }])
    expect(d.state).toBe('info')
    expect(d.detail[0]).toContain('OPS')
  })
  it('⑧ 无 ⇒ ok;取不到 ⇒ unjudged', () => {
    expect(A.sameUidDim([]).state).toBe('ok')
    expect(A.sameUidDim(null).state).toBe('unjudged')
  })
})

describe('D4 rt 终点证据(rtBlindDim)', () => {
  it('⑨ 会暴露终点的 provider(qoder)永久号瞎 ⇒ breach(真会丢号)', () => {
    const d = A.rtBlindDim({
      scanned: true,
      foreverBlind: [{ provider: 'qoder', uid: 'f1' }],
      otherBlind: [],
    })
    expect(d.state).toBe('breach')
    expect(d.count).toBe(1)
  })
  it('⑩ 仅普通号瞎 ⇒ info(不逼红);都正常 ⇒ ok', () => {
    expect(
      A.rtBlindDim({ scanned: true, foreverBlind: [], otherBlind: [{ provider: 'qoder', uid: 'o1' }] })
        .state,
    ).toBe('info')
    expect(A.rtBlindDim({ scanned: true, foreverBlind: [], otherBlind: [] }).state).toBe('ok')
  })
  it('⑪ 没扫到(scanned=false)⇒ unjudged', () => {
    expect(A.rtBlindDim({ scanned: false, foreverBlind: [], otherBlind: [] }).state).toBe('unjudged')
  })
  it('⑫ Trae 永久号瞎 ⇒ info(客户端不暴露 rt 终点,属固有,不误警);且整体不算 breach', () => {
    const d = A.rtBlindDim({
      scanned: true,
      foreverBlind: [{ provider: 'trae', uid: '257443069114' }],
      otherBlind: [],
    })
    expect(d.state).toBe('info')
    // 仅有这一枚固有盲区时,汇总不应被它拖成 breach
    expect(
      A.overallState([A.deviceClusterDim([], 4), d, A.sharedRtDim([]), A.sameUidDim([])]),
    ).toBe('ok')
  })
})

describe('D5 出口亲和(egressDim)', () => {
  it('⑫ 代理池为空 ⇒ info(全池同出口 IP,接受这一维)', () => {
    expect(A.egressDim({ proxyTotal: 0, proxyActive: 0, proxyBound: 0, accountsWithProxy: 0 }).state).toBe('info')
  })
  it('⑬ active 代理有未绑定 ⇒ breach(多号可共用一位)', () => {
    const d = A.egressDim({ proxyTotal: 5, proxyActive: 3, proxyBound: 1, accountsWithProxy: 2 })
    expect(d.state).toBe('breach')
    expect(d.count).toBe(2)
  })
  it('⑭ 全部绑定 ⇒ ok;任一取不到 ⇒ unjudged', () => {
    expect(A.egressDim({ proxyTotal: 5, proxyActive: 3, proxyBound: 3, accountsWithProxy: 3 }).state).toBe('ok')
    expect(A.egressDim({ proxyTotal: null, proxyActive: null, proxyBound: null, accountsWithProxy: null }).state).toBe('unjudged')
  })
})

describe('D6 死副本(deadCopyDim)', () => {
  it('⑮ 判死且票过期且无再凭证能力 ⇒ info(账面噪声,提醒别当活号)', () => {
    expect(A.deadCopyDim([{ providerCode: 'trae', uid: 'd1' }]).state).toBe('info')
  })
  it('⑯ 无 ⇒ ok;取不到 ⇒ unjudged', () => {
    expect(A.deadCopyDim([]).state).toBe('ok')
    expect(A.deadCopyDim(null).state).toBe('unjudged')
  })
})

describe('汇总裁决 overallState / conclusionLine', () => {
  const mk = (key: string, state: string) => ({ key, state, count: 0, detail: [], fix: '' })
  it('⑰ 任一 breach ⇒ breach 优先', () => {
    expect(A.overallState([mk('a', 'ok'), mk('b', 'breach'), mk('c', 'info')])).toBe('breach')
  })
  it('⑱ 无 breach 但有 unjudged ⇒ undetermined(不记绿)', () => {
    expect(A.overallState([mk('a', 'ok'), mk('b', 'info'), mk('c', 'unjudged')])).toBe('undetermined')
  })
  it('⑲ 全 ok/info ⇒ ok', () => {
    expect(A.overallState([mk('a', 'ok'), mk('b', 'info')])).toBe('ok')
  })
  it('⑳ 结论行形态:POOL-ISOLATION state=<x> total=<n> <kv>,unjudged 维带 ? 后缀', () => {
    const line = A.conclusionLine([mk('deviceCluster', 'info'), mk('sharedRefreshToken', 'ok')], 14)
    expect(line).toMatch(/^POOL-ISOLATION state=ok total=14 /)
    expect(line).toContain('deviceCluster=0')
    const und = A.conclusionLine([mk('deviceCluster', 'unjudged')], null)
    expect(und).toContain('total=?')
    expect(und).toContain('deviceCluster=0?')
  })
})

describe('参数解析 parseArgs', () => {
  it('㉑ --json / --help / -h 识别;未知参数 ⇒ error 且 exit 2 语义', () => {
    expect(A.parseArgs(['--json'])).toEqual({ json: true, help: false, error: null })
    expect(A.parseArgs(['--help'])).toEqual({ json: false, help: true, error: null })
    expect(A.parseArgs(['-h'])).toEqual({ json: false, help: true, error: null })
    const bad = A.parseArgs(['--bogus'])
    expect(bad.error).toContain('未知参数')
  })
  it('㉒ 空参 ⇒ 全 false,无 error(人工默认人类可读)', () => {
    expect(A.parseArgs([])).toEqual({ json: false, help: false, error: null })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
