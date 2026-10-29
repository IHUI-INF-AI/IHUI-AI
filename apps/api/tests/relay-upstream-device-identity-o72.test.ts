// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上游指纹暴露收口 · 设备/会话稳定身份派生用例(号池对标批 O72,结清枚 20276cb1d9f91acd5d53d35c2f6e03c6d92edd9c)。
 *
 * 覆盖两条整改(判据一律直用生产实现,§22c 不在测试里复算):
 * 1. ZCode X-Device-Mid 由「每请求 randomUUID」改为账号级稳定派生
 *    (zcode-adapter.__test__.zcodeDeviceMid;真号池里"每次调用一台新设备"本身就是风控异常触发器);
 * 2. WorkBuddy X-Machine-ID / X-Session-ID 旧派生 sha256("wb2a:"+purpose+":"+uid) 零熵且与
 *    同请求出镜的 X-User-Id 自我相关 —— 新派生不可仅由 uid 重算(workbuddy-protocol.deriveStableId)。
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import type { AiRelayAccountPool } from '@ihui/database'
import type { AdapterAccountContext } from '../src/services/relay-upstream-adapters.js'
import {
  zcodeAdapter,
  __test__ as zcodeTest,
} from '../src/services/upstream-adapters/zcode-adapter.js'
import { workbuddyAdapter } from '../src/services/upstream-adapters/workbuddy-adapter.js'
import {
  deriveStableId,
  workBuddyIdDeploymentSalt,
  type WorkBuddyIdSeed,
} from '../src/services/upstream-adapters/workbuddy-protocol.js'

// =============================================================================
// 夹具
// =============================================================================

function zcodeCtx(rowOverrides: Record<string, unknown>): AdapterAccountContext {
  return {
    row: {
      id: 'row-default-id',
      providerCode: 'zcode',
      uid: 'u-default',
      name: 'n',
      extraMetadata: null,
      ...rowOverrides,
    },
    credentials: {
      token: 'zc-token',
      refreshToken: null,
      cookies: [],
      secrets: { credentialMap: { zcodejwttoken: 'zc-jwt-fixture' } },
    },
  } as unknown as AdapterAccountContext
}

function wbCtx(rowOverrides: Record<string, unknown>): AdapterAccountContext {
  return {
    row: { uid: 'row-uid-1', extraMetadata: {}, tokenExpiresAt: null, ...rowOverrides },
    credentials: { token: 'plain-access-token', refreshToken: 'rt-old', cookies: [], secrets: {} },
  } as unknown as AdapterAccountContext
}

const wbReq = {
  model: 'claude-sonnet-4',
  messages: [{ role: 'user', content: 'hi' }],
  stream: true,
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

// =============================================================================
// 1. ZCode X-Device-Mid:账号级稳定
// =============================================================================

describe('ZCode X-Device-Mid 账号级稳定派生(O72#1)', () => {
  it('派生函数:同一行两次调用同值;不同行互异;形态为合法 UUIDv4 形', () => {
    const a = zcodeTest.zcodeDeviceMid({ id: 'row-1', uid: 'u1' })
    const b = zcodeTest.zcodeDeviceMid({ id: 'row-1', uid: 'u1' })
    const c = zcodeTest.zcodeDeviceMid({ id: 'row-2', uid: 'u2' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(UUID_SHAPE)
  })

  it('row.deviceId 存储材料优先原样透传(真实客户端设备 id 不被派生值顶掉)', () => {
    expect(zcodeTest.zcodeDeviceMid({ id: 'row-1', deviceId: ' real-mid ' })).toBe('real-mid')
  })

  it('id 缺失退化到 uid;两者皆无 ⇒ 显式抛未判定(不冒充可用)', () => {
    expect(zcodeTest.zcodeDeviceMid({ uid: 'u-only' })).toMatch(UUID_SHAPE)
    expect(() => zcodeTest.zcodeDeviceMid({})).toThrow(/未判定/)
  })

  it('getQuota 真走请求头:同账号两次调用 X-Device-Mid 相同;不同账号不同', async () => {
    const seen: string[] = []
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      const h = (init?.headers ?? {}) as Record<string, string>
      seen.push(String(h['X-Device-Mid']))
      return new Response(JSON.stringify({ code: 0, msg: 'ok', data: { plans: [] } }), {
        status: 200,
      })
    }) as unknown as typeof fetch
    await zcodeAdapter.getQuota!(zcodeCtx({ id: 'acct-A', uid: 'uA' }), { fetchImpl })
    await zcodeAdapter.getQuota!(zcodeCtx({ id: 'acct-A', uid: 'uA' }), { fetchImpl })
    await zcodeAdapter.getQuota!(zcodeCtx({ id: 'acct-B', uid: 'uB' }), { fetchImpl })
    expect(seen).toHaveLength(3)
    expect(seen[0]).toBe(seen[1])
    expect(seen[0]).not.toBe(seen[2])
    expect(seen[0]).toMatch(UUID_SHAPE)
  })

  it('uuidFromSeed 确定性 + 版本/variant 位钉死(同种子恒同值,异种子异值)', () => {
    expect(zcodeTest.uuidFromSeed('s1')).toBe(zcodeTest.uuidFromSeed('s1'))
    expect(zcodeTest.uuidFromSeed('s1')).not.toBe(zcodeTest.uuidFromSeed('s2'))
    expect(zcodeTest.uuidFromSeed('s1')).toMatch(UUID_SHAPE)
  })
})

// =============================================================================
// 2. WorkBuddy X-Machine-ID / X-Session-ID:不可由 uid 单独重算
// =============================================================================

describe('WorkBuddy stable-id 派生(O72#2)', () => {
  it('每账号稳定:同一 seed 两次派生同值;36hex 形态不变', () => {
    const seed: WorkBuddyIdSeed = { uid: 'u1', storedMachineId: 'stored-m-1' }
    expect(deriveStableId('machine', seed)).toBe(deriveStableId('machine', seed))
    expect(deriveStableId('machine', seed)).toMatch(/^[0-9a-f]{36}$/)
    expect(deriveStableId('session', seed)).toMatch(/^[0-9a-f]{36}$/)
  })

  it('账号间互异:uid 或存储材料任一不同 ⇒ 输出不同', () => {
    const base = deriveStableId('machine', { uid: 'u1', storedMachineId: 'm-1' })
    expect(deriveStableId('machine', { uid: 'u2', storedMachineId: 'm-1' })).not.toBe(base)
    expect(deriveStableId('machine', { uid: 'u1', storedMachineId: 'm-2' })).not.toBe(base)
  })

  it('不可仅由 uid 重算:同 uid 换部署盐/换存储材料 ⇒ 输出随之变(旧零熵派生做不到)', () => {
    const s1 = deriveStableId('machine', { uid: 'u1', deploymentSalt: 'salt-A' })
    const s2 = deriveStableId('machine', { uid: 'u1', deploymentSalt: 'salt-B' })
    expect(s1).not.toBe(s2)
    // 阳性对照:旧公式 sha256("wb2a:machine:u1") 只吃 uid,抓包方人人可重算 —— 新输出必须远离它
    const legacy = createHash('sha256').update('wb2a:machine:u1').digest('hex').slice(0, 36)
    expect(s1).not.toBe(legacy)
    expect(deriveStableId('machine', { uid: 'u1', storedMachineId: 'm' })).not.toBe(legacy)
  })

  it('存储材料优先于部署盐(行不变 ⇒ id 不随密钥轮换漂移)', () => {
    const withBoth1 = deriveStableId('machine', {
      uid: 'u1',
      storedMachineId: 'm-1',
      deploymentSalt: 'salt-A',
    })
    const withBoth2 = deriveStableId('machine', {
      uid: 'u1',
      storedMachineId: 'm-1',
      deploymentSalt: 'salt-B',
    })
    expect(withBoth1).toBe(withBoth2)
    expect(withBoth1).toBe(deriveStableId('machine', { uid: 'u1', storedMachineId: 'm-1' }))
  })

  it('machineId 空则退 deviceId;两档皆空且无盐 ⇒ 抛未判定(绝不回落明文 uid 哈希)', () => {
    expect(
      deriveStableId('machine', { uid: 'u1', storedMachineId: '', storedDeviceId: 'd-1' }),
    ).toBe(deriveStableId('machine', { uid: 'u1', storedDeviceId: 'd-1' }))
    expect(() => deriveStableId('machine', { uid: 'u1' })).toThrow(/未判定/)
  })

  it('workBuddyIdDeploymentSalt:确定性、随密钥而变、输出为纯 hex 不含密钥形态', () => {
    expect(workBuddyIdDeploymentSalt('k-1')).toBe(workBuddyIdDeploymentSalt('k-1'))
    expect(workBuddyIdDeploymentSalt('k-1')).not.toBe(workBuddyIdDeploymentSalt('k-2'))
    expect(workBuddyIdDeploymentSalt('k-1')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('适配器接线:buildChatRequest 的 X-Machine-ID = 生产派生函数对同一行的输出(存储材料档)', () => {
    const ctx = wbCtx({ uid: 'u-wb', machineId: 'stored-m-x' })
    const h = workbuddyAdapter.buildChatRequest(ctx, wbReq).headers
    expect(h['X-Machine-ID']).toBe(
      deriveStableId('machine', { uid: 'u-wb', storedMachineId: 'stored-m-x' }),
    )
    expect(h['X-Session-ID']).toBe(
      deriveStableId('session', { uid: 'u-wb', storedMachineId: 'stored-m-x' }),
    )
    // 跨请求稳定 + 随账号变
    const h2 = workbuddyAdapter.buildChatRequest(wbCtx({ uid: 'u-wb', machineId: 'stored-m-y' }), {
      ...wbReq,
      conversationId: 'conv-1',
    }).headers
    expect(h['X-Machine-ID']).not.toBe(h2['X-Machine-ID'])
  })
})

// =============================================================================
// 形状锁:AiRelayAccountPool 的 device 列在派生入参里有位置(防字段漂移)
// =============================================================================

describe('O72 形状锁', () => {
  // ③ UA / 客户端版本常量:有意保持「全池同值(按 realm 分档)」,不做每账号随机化。
  // 判据:上游客户端的真实版本集合本来就窄,伪造版本会破坏签名/proof 的规范化串
  // (trae 的 proof 含版本字段;zcode/codearts 也签名),换来的"去重"是副作用不是收益。
  // 这条锁住"别把 UA 改成随请求/随账号抖动"——抖动的设备指纹比稳定同值更像异常。
  it('③ UA 按 realm 稳定,不随账号/请求抖动', () => {
    const a = workbuddyAdapter.buildChatRequest(wbCtx({ uid: 'u-a' }), wbReq).headers
    const b = workbuddyAdapter.buildChatRequest(wbCtx({ uid: 'u-b' }), wbReq).headers
    expect(a['User-Agent']).toBeTruthy()
    expect(a['User-Agent']).toBe(b['User-Agent'])
  })

  it('zcode 派生接受真实行类型(含 deviceId 明文列)', () => {
    const row = {
      id: 'x',
      providerCode: 'zcode',
      uid: 'u',
      name: 'n',
      tokenEnc: 't',
      deviceId: 'd',
      machineId: 'm',
    } as unknown as AiRelayAccountPool
    expect(zcodeTest.zcodeDeviceMid(row)).toBe('d')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
