// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池跨环境同步决策核心的回归测试(2026-11-11 立)。
 *
 * 钉死的是「自动同步」最容易悄悄错掉的六条规则:补缺、指纹跳过、时间裁决、
 * 平局保留本地、删除不复活、分组不串归属。这些规则错了不会报错,只会把号池
 * 慢慢同步歪 —— 所以每条都必须有独立用例。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  accountSyncKey,
  credentialFingerprint,
  groupForImport,
  normalizeSyncAccount,
  planPoolSync,
} from '../lib/pool-sync-plan.mjs'
import { RELAY_PROVIDER_CODES } from '../lib/pool-providers.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DAY = 86_400_000
const NOW = Date.parse('2026-11-11T12:00:00.000Z')

function acc(over = {}) {
  return {
    ownerUserId: 'owner-1',
    providerCode: 'raccoon',
    uid: 'uid-1',
    name: '测试号',
    token: 'tok-A',
    refreshToken: 'ref-A',
    enabled: true,
    tokenExpiresAt: '2026-12-11T00:00:00.000Z',
    updatedAt: new Date(NOW - DAY).toISOString(),
    ...over,
  }
}

test('① 仅本地有 → 推生产(补缺)', () => {
  const plan = planPoolSync({ local: [acc()], prod: [], nowMs: NOW })
  assert.equal(plan.stats.toPush, 1)
  assert.equal(plan.stats.toPull, 0)
  assert.equal(plan.toPush[0].reason, 'missing-in-prod')
})

test('② 仅生产有且在上游窗口内 → 拉回本地(新号自动互通)', () => {
  const plan = planPoolSync({
    local: [],
    prod: [acc({ updatedAt: new Date(NOW - 2 * DAY).toISOString() })],
    nowMs: NOW,
  })
  assert.equal(plan.stats.toPull, 1)
  assert.equal(plan.toPull[0].reason, 'missing-in-local')
  assert.equal(plan.stats.staleMissingLocal, 0)
})

test('③ 两侧指纹相同 → 跳过(绝不空写,避免 credVersion 虚增)', () => {
  const a = acc()
  const b = acc({ name: '两端展示名不同', updatedAt: new Date(NOW).toISOString() })
  const plan = planPoolSync({ local: [a], prod: [b], nowMs: NOW })
  assert.equal(plan.stats.toPush, 0)
  assert.equal(plan.stats.toPull, 0)
  assert.equal(plan.stats.unchanged, 1)
  // 展示名差异不进指纹:不该因为 name 不同就互相同步
  assert.equal(credentialFingerprint(a), credentialFingerprint(b))
})

test('④ 两侧凭证不同 + 本地更新 → 推生产', () => {
  const local = acc({ token: 'tok-NEW', updatedAt: new Date(NOW - DAY).toISOString() })
  const prod = acc({ token: 'tok-OLD', updatedAt: new Date(NOW - 5 * DAY).toISOString() })
  const plan = planPoolSync({ local: [local], prod: [prod], nowMs: NOW })
  assert.equal(plan.stats.toPush, 1)
  assert.equal(plan.toPush[0].reason, 'newer-local')
  assert.equal(plan.conflicts[0].winner, 'local')
})

test('⑤ 两侧凭证不同 + 生产更新 → 拉回本地(反向互通)', () => {
  const local = acc({ token: 'tok-OLD', updatedAt: new Date(NOW - 5 * DAY).toISOString() })
  const prod = acc({ token: 'tok-NEW', updatedAt: new Date(NOW - DAY).toISOString() })
  const plan = planPoolSync({ local: [local], prod: [prod], nowMs: NOW })
  assert.equal(plan.stats.toPull, 1)
  assert.equal(plan.toPull[0].reason, 'newer-prod')
  assert.equal(plan.conflicts[0].winner, 'prod')
})

test('⑥ 时间相同 → 保留本地(不来回翻烧饼)', () => {
  const same = new Date(NOW - DAY).toISOString()
  const plan = planPoolSync({
    local: [acc({ token: 'tok-L', updatedAt: same })],
    prod: [acc({ token: 'tok-P', updatedAt: same })],
    nowMs: NOW,
  })
  assert.equal(plan.stats.toPush, 1)
  assert.equal(plan.stats.toPull, 0)
  assert.equal(plan.toPush[0].reason, 'tie-keep-local')
})

test('⑦ 仅生产有但超拉回窗口 → 不复活,记 stale', () => {
  const plan = planPoolSync({
    local: [],
    prod: [acc({ updatedAt: new Date(NOW - 30 * DAY).toISOString() })],
    nowMs: NOW,
  })
  assert.equal(plan.stats.toPull, 0)
  assert.equal(plan.stats.staleMissingLocal, 1)
  assert.equal(plan.staleMissingLocal[0].uid, 'uid-1')
})

test('⑧ 归属参与键:个人池与运营池同 uid 互不干扰', () => {
  const personal = acc({ ownerUserId: 'owner-1', token: 'tok-personal' })
  const ops = acc({ ownerUserId: null, token: 'tok-ops' })
  assert.notEqual(accountSyncKey(personal), accountSyncKey(ops))
  const plan = planPoolSync({ local: [personal], prod: [ops], nowMs: NOW })
  assert.equal(plan.stats.toPush, 1) // 个人的推出去
  assert.equal(plan.stats.toPull, 1) // 运营池的拉回来
})

test('⑨ 平台过滤只影响指定平台', () => {
  const a = acc({ providerCode: 'raccoon' })
  const b = acc({ providerCode: 'trae', uid: 'uid-2' })
  const plan = planPoolSync({ local: [a, b], prod: [], providers: ['trae'], nowMs: NOW })
  assert.equal(plan.stats.localTotal, 1)
  assert.equal(plan.toPush[0].account.providerCode, 'trae')
})

test('⑩ 分组:按归属+平台分桶,且剥掉同步元字段', () => {
  const batches = groupForImport([
    { account: acc({ ownerUserId: 'o1', providerCode: 'raccoon' }) },
    { account: acc({ ownerUserId: 'o1', providerCode: 'trae', uid: 'u2' }) },
    { account: acc({ ownerUserId: null, providerCode: 'raccoon', uid: 'u3' }) },
  ])
  assert.equal(batches.length, 3)
  for (const b of batches) {
    assert.equal(b.accounts.length, 1)
    assert.ok(!('updatedAt' in b.accounts[0]), 'updatedAt 必须剥掉,否则进 extraMetadata')
    assert.ok(!('ownerUserId' in b.accounts[0]), 'ownerUserId 由命令行显式传')
  }
})

test('⑪ 脏行(缺 uid/providerCode)被忽略,不阻断整批', () => {
  const plan = planPoolSync({
    local: [acc(), { uid: '', providerCode: 'raccoon' }, { uid: 'x', providerCode: '' }],
    prod: [],
    nowMs: NOW,
  })
  assert.equal(plan.stats.localTotal, 1)
})

test('⑫ 归一化:缺失字段降级为安全默认,不 throw', () => {
  const n = normalizeSyncAccount({})
  assert.equal(n.ownerUserId, null)
  assert.equal(n.enabled, true)
  assert.equal(n.uid, '')
  assert.equal(n.updatedAt, '')
  assert.deepEqual(n.payload, {})
})

test('⑭ `__sync` 元数据优先于顶层字段,且原生载荷保持纯净', () => {
  const raw = {
    token: 'native-token',
    accessToken: 'native-access',
    __sync: { uid: 'uid-from-sync', providerCode: 'minimax', ownerUserId: 'o9', updatedAt: 'X', enabled: false },
  }
  const n = normalizeSyncAccount(raw)
  assert.equal(n.uid, 'uid-from-sync')
  assert.equal(n.providerCode, 'minimax')
  assert.equal(n.ownerUserId, 'o9')
  assert.equal(n.enabled, false)
  // 原生载荷不该被 __sync 污染
  assert.equal(n.payload.accessToken, 'native-access')
})

test('⑮ 指纹:展示名差异不算变更,启用态差异算变更', () => {
  const base = {
    accessToken: 'at-1',
    __sync: { uid: 'u1', providerCode: 'minimax', enabled: true },
  }
  const renamed = {
    accessToken: 'at-1',
    name: '另一个展示名',
    __sync: { uid: 'u1', providerCode: 'minimax', enabled: true },
  }
  const disabled = {
    accessToken: 'at-1',
    __sync: { uid: 'u1', providerCode: 'minimax', enabled: false },
  }
  assert.equal(credentialFingerprint(base), credentialFingerprint(renamed))
  assert.notEqual(credentialFingerprint(base), credentialFingerprint(disabled))
})

test('⑯ 指纹:core 四元组任一变化都必须被识别', () => {
  const mk = (core, extra = {}) => ({
    ...extra,
    __sync: { uid: 'u1', providerCode: 'minimax', enabled: true, core },
  })
  const base = mk({ token: 'at-1', refreshToken: 'rt-1', tokenExpiresAt: '2026-12-01T00:00:00Z' })
  assert.notEqual(
    credentialFingerprint(base),
    credentialFingerprint(mk({ token: 'at-2', refreshToken: 'rt-1', tokenExpiresAt: '2026-12-01T00:00:00Z' })),
  )
  assert.notEqual(
    credentialFingerprint(base),
    credentialFingerprint(mk({ token: 'at-1', refreshToken: 'rt-2', tokenExpiresAt: '2026-12-01T00:00:00Z' })),
  )
  assert.notEqual(
    credentialFingerprint(base),
    credentialFingerprint(mk({ token: 'at-1', refreshToken: 'rt-1', tokenExpiresAt: '2027-01-01T00:00:00Z' })),
  )
  // 启用态变化同样要识别
  assert.notEqual(
    credentialFingerprint(base),
    credentialFingerprint({
      __sync: { uid: 'u1', providerCode: 'minimax', enabled: false, core: { token: 'at-1', refreshToken: 'rt-1', tokenExpiresAt: '2026-12-01T00:00:00Z' } },
    }),
  )
})

test('⑱ 指纹:载荷里的本机环境字段(sourcePath/region)不同不算变更', () => {
  const core = { token: 'same-token', refreshToken: '', tokenExpiresAt: '' }
  const a = { value: 'v', sourcePath: 'C:\\Users\\A\\.tool', region: 'cn', __sync: { uid: 'u1', providerCode: 'zcode', enabled: true, core } }
  const b = { value: 'v', sourcePath: 'D:\\prod\\.tool', region: 'us', __sync: { uid: 'u1', providerCode: 'zcode', enabled: true, core } }
  assert.equal(credentialFingerprint(a), credentialFingerprint(b))
})

test('⑲ 分组产出必须是平台原生载荷(凭据不能套在 payload 里)', () => {
  const raw = {
    accessToken: 'at-native',
    recordKey: 'rk',
    __sync: {
      uid: 'u1',
      providerCode: 'minimax',
      ownerUserId: 'o1',
      enabled: true,
      updatedAt: '2026-11-11T00:00:00Z',
      core: { token: 'at-native', refreshToken: '', tokenExpiresAt: '' },
    },
  }
  // ① 直接传原始导出项
  const direct = groupForImport([{ account: raw }])
  assert.equal(direct[0].accounts[0].accessToken, 'at-native')
  assert.ok(!('payload' in direct[0].accounts[0]), '不能把归一化对象当载荷')
  assert.ok(!('__sync' in direct[0].accounts[0]), '__sync 必须剥掉')

  // ② 传 plan 产出的归一化对象(真实调用链形态)也要能取到原生字段
  const normalized = normalizeSyncAccount(raw)
  const viaPlan = groupForImport([{ account: normalized }])
  assert.equal(viaPlan[0].accounts[0].accessToken, 'at-native')
  assert.equal(viaPlan[0].accounts[0].recordKey, 'rk')
})

test('⑳ 分组:原生载荷里的 uid/name 保留(平台自身字段不剥),只剥同步元数据', () => {
  const raw = {
    value: 'session-value',
    uid: 'native-uid',
    name: '原生名',
    __sync: { uid: 'sync-uid', providerCode: 'loomy', enabled: true },
  }
  const batches = groupForImport([{ account: raw }])
  assert.equal(batches[0].accounts[0].value, 'session-value')
  assert.equal(batches[0].accounts[0].uid, 'native-uid')
  assert.equal(batches[0].accounts[0].name, '原生名')
})

test('⑰ 指纹与键序无关(同一内容不同键序必须同哈希)', () => {
  const a = { x: 1, y: { p: 2, q: 3 }, __sync: { uid: 'u1', providerCode: 'trae' } }
  const b = { y: { q: 3, p: 2 }, x: 1, __sync: { uid: 'u1', providerCode: 'trae' } }
  assert.equal(credentialFingerprint(a), credentialFingerprint(b))
})

// ── email 身份键(2026-11-12 修复:两端 users.id 不同、email 相同)──────────────

/** 导出器形状:元数据在 __sync(含 ownerUserId/ownerEmail),原生字段在顶层。 */
function exported(over = {}) {
  return {
    token: 'tok-A',
    __sync: {
      uid: 'uid-1',
      providerCode: 'raccoon',
      ownerUserId: 'lid',
      updatedAt: new Date(NOW - DAY).toISOString(),
      enabled: true,
      core: { token: 'tok-A', refreshToken: '', tokenExpiresAt: '' },
      ...over,
    },
  }
}

test('㉑ ownerEmail 相同 ⇒ 同步键一致:跨 id 同人不互推不判冲突', () => {
  const local = [exported({ ownerUserId: 'd83b566e-local', ownerEmail: 'Admin@QQ.com' })]
  const prod = [exported({ ownerUserId: '30763d9f-prod', ownerEmail: 'admin@qq.com' })]
  const plan = planPoolSync({ local, prod, nowMs: NOW })
  assert.equal(plan.stats.toPush, 0, '同一人(email 同)不得被判"仅一侧有"反复互推')
  assert.equal(plan.stats.toPull, 0)
  assert.equal(plan.stats.unchanged, 1)
  assert.equal(plan.conflicts.length, 0)
})

test('㉒ ownerMaps 翻译:无 ownerEmail 的旧导出也按 email 归键;不传 maps 退化为现行为', () => {
  const local = [exported({ ownerUserId: 'lid' })]
  const prod = [exported({ ownerUserId: 'pid' })]
  const translated = planPoolSync({
    local,
    prod,
    nowMs: NOW,
    ownerMaps: { local: { lid: 'a@b.c' }, prod: { pid: 'A@B.C' } },
  })
  assert.equal(translated.stats.unchanged, 1)
  assert.equal(translated.stats.toPush, 0)
  // 向后兼容:不传 maps 且无 ownerEmail ⇒ 键用 ownerUserId 原值(现行为,两侧互推)
  const legacy = planPoolSync({ local, prod, nowMs: NOW })
  assert.equal(legacy.stats.toPush, 1)
  assert.equal(legacy.stats.toPull, 1)
  // 运营池不参与翻译:恒为 'ops'
  assert.equal(accountSyncKey(exported({ ownerUserId: null })), 'ops|raccoon|uid-1')
  assert.equal(accountSyncKey(exported({ ownerUserId: 'lid', ownerEmail: 'a@b.c' })), 'a@b.c|raccoon|uid-1')
})

test('㉓ groupForImport 落库翻译:owner 用目标环境 email→id 反查结果', () => {
  const items = [
    { account: exported({ ownerUserId: 'pid', ownerEmail: 'A@B.C' }) },
    { account: exported({ ownerUserId: null }) }, // 运营池:owner=null,不参与翻译
  ]
  const batches = groupForImport(items, { 'a@b.c': 'lid-9' })
  assert.equal(batches.length, 2)
  const personal = batches.find((b) => b.providerCode === 'raccoon' && b.ownerUserId !== null)
  assert.equal(personal.ownerUserId, 'lid-9', '落库 --owner 必须是目标环境翻译后的 id')
  assert.equal(batches.find((b) => b.ownerUserId === null).ownerUserId, null)
  assert.equal(batches.skipped.length, 0)
  // 不传 targetMaps ⇒ 旧行为:ownerUserId 原样透传
  const legacy = groupForImport([{ account: exported({ ownerUserId: 'pid', ownerEmail: 'a@b.c' }) }])
  assert.equal(legacy[0].ownerUserId, 'pid')
  assert.equal(legacy.skipped.length, 0)
})

test('㉔ groupForImport fail-closed:email 翻译不出 ⇒ 点名跳过,绝不静默落运营池', () => {
  const batches = groupForImport([{ account: exported({ ownerUserId: 'pid', ownerEmail: 'ghost@x.dev' }) }], {
    'a@b.c': 'lid-9',
  })
  assert.equal(batches.length, 0, '翻译不出的行不得进批次')
  assert.equal(batches.skipped.length, 1)
  assert.equal(batches.skipped[0].uid, 'uid-1')
  assert.equal(batches.skipped[0].providerCode, 'raccoon')
  assert.match(batches.skipped[0].reason, /无法在目标环境解析/)
  // 非 uuid 历史 owner(dev-anonymous 类):无 email 信息时 identity=原值,给 maps 也翻译不出 ⇒ 跳过
  const anon = groupForImport([{ account: exported({ ownerUserId: 'dev-anonymous' }) }], { 'a@b.c': 'lid-9' })
  assert.equal(anon.length, 0)
  assert.equal(anon.skipped.length, 1)
})

test('⑬ 防漂移:ESM 镜像的 provider 清单必须与 TS 唯一真相源逐项一致', () => {
  const src = readFileSync(
    path.join(ROOT, 'apps', 'api', 'src', 'services', 'relay-account-format.ts'),
    'utf8',
  )
  const m = /export const RELAY_PROVIDERS = \[([\s\S]*?)\] as const/.exec(src)
  assert.ok(m, '未在 relay-account-format.ts 找到 RELAY_PROVIDERS 定义')
  const tsList = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  assert.deepEqual(
    RELAY_PROVIDER_CODES,
    tsList,
    'scripts/lib/pool-providers.mjs 与 TS 源不一致:改平台清单必须两边同步',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
