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
  assert.equal(n.token, '')
  assert.equal(n.updatedAt, '')
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
