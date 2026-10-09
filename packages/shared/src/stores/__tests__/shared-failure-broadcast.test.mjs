// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816011 票面验收入口:`node --test packages/shared/src/stores/__tests__/shared-failure-broadcast.test.mjs`
 *
 * 失败也是共享事实(上游 packages/ui/src/lib/usageEntitlementRefreshPolicy.ts:180-245 同型):
 *  ① A 处失败后 B 处不得读到旧成功快照 —— 失败向**所有**订阅者广播
 *     (:185-190,注释:"否则设置页失败后,推荐入口仍认为旧余额查询成功");
 *  ② 成功后缓存恢复可命中(反向锁,防做成"永远不缓存");
 *  ③ 身份变化使**全部**在途请求失效(不是只失效发起那一个,:45-46)。
 *
 * 双 runner 分流(先例:src/chat/__tests__/projection-watermark.test.mjs,G-816006):
 * 本文件落在 packages/shared 的 vitest 收集面(vitest.config.ts 的 COLLECT_INCLUDE
 * 覆盖 src 下 .test.mjs),纯 node:test 注册会被 vitest 以 "No test suite found"
 * 打死整包 ⇒ 按语境分流 describe/it;判据只写这一份,断言两边共用 node:assert/strict。
 * 同目录 .test.ts 是本包 vitest 语境的孪生用例。
 */
import assert from 'node:assert/strict'

import { createResourceRefreshPolicy, USAGE_ENTITLEMENT_REFRESH_FAILED } from '../resource-refresh-policy.ts'

const { describe, it } = process.env.VITEST === 'true' ? await import('vitest') : await import('node:test')

/** 可控的在途请求门:先拿到 promise,再由用例决定何时 resolve/reject。 */
function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 记录 (snapshot, reason) 广播序列,模拟"A 处 / B 处"两个独立订阅者。 */
function createRecorder() {
  const calls = []
  return {
    calls,
    listener: (snapshot, reason) => {
      calls.push([snapshot, reason])
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('G-816011 失败也是共享事实:失败广播 + 有失败不供缓存', () => {
  it('① A 处失败 ⇒ 失败广播到所有订阅者,B 处不得读到旧成功快照', async () => {
    const gate = createDeferred()
    let calls = 0
    const policy = createResourceRefreshPolicy({
      load: () => {
        calls += 1
        return calls === 1 ? Promise.resolve('余额 100') : gate.promise.then(() => '余额 100')
      },
    })
    const siteA = createRecorder()
    const siteB = createRecorder()
    policy.subscribe(siteA.listener)
    policy.setIdentity('user-1')
    await policy.refresh()

    // 首次成功:缓存可读,A 拿到 (snapshot, null)
    policy.subscribe(siteB.listener)
    assert.equal(policy.getCachedSnapshot(), '余额 100')
    assert.deepEqual(siteA.calls, [['余额 100', null]])
    assert.deepEqual(siteB.calls, [])

    // 第二次刷新失败:广播形状 = (current?.snapshot ?? null, 失败 reason),且**所有**订阅者都收到
    gate.reject(new Error('network down'))
    await policy.refresh()
    assert.deepEqual(siteA.calls.at(-1), ['余额 100', USAGE_ENTITLEMENT_REFRESH_FAILED])
    assert.deepEqual(siteB.calls, [['余额 100', USAGE_ENTITLEMENT_REFRESH_FAILED]])

    // 缓存闸(上游 :238 failureCount > 0 ⇒ null):A 处失败后 B 处不得读到旧成功快照
    assert.equal(policy.getFailureCount(), 1)
    assert.equal(policy.getCachedSnapshot(), null)
  })

  it('② 成功后缓存恢复可命中(反向锁:不是"永远不缓存")', async () => {
    let shouldFail = true
    const policy = createResourceRefreshPolicy({
      load: () => (shouldFail ? Promise.reject(new Error('down')) : Promise.resolve('快照 v2')),
    })
    const site = createRecorder()
    policy.subscribe(site.listener)
    policy.setIdentity('user-1')

    await policy.refresh() // 失败 ⇒ 不供缓存
    assert.equal(policy.getCachedSnapshot(), null)
    assert.equal(policy.getFailureCount(), 1)

    shouldFail = false
    await policy.refresh() // 成功 ⇒ failureCount 归零,缓存恢复可命中
    assert.equal(policy.getFailureCount(), 0)
    assert.equal(policy.getCachedSnapshot(), '快照 v2')
    assert.deepEqual(site.calls.at(-1), ['快照 v2', null])

    // 再次成功仍可命中(缓存不是一次性)
    await policy.refresh()
    assert.equal(policy.getCachedSnapshot(), '快照 v2')
  })

  it('③ 身份变化 ⇒ 全部在途请求失效:旧身份迟到的结果被丢弃,不写缓存、不广播', async () => {
    const gates = { a: createDeferred(), b: createDeferred() }
    let count = 0
    const policy = createResourceRefreshPolicy({
      load: () => {
        count += 1
        return count === 1 ? gates.a.promise : gates.b.promise
      },
    })
    const site = createRecorder()
    policy.subscribe(site.listener)
    policy.setIdentity('user-a')
    const refreshA = policy.refresh() // 在途(user-a)
    policy.setIdentity('user-b') // 换代:全部在途失效(工厂级,不是单 hook 级)
    const refreshB = policy.refresh() // user-b 的请求
    gates.b.resolve('user-b 的快照')
    gates.a.resolve('user-a 的迟到快照') // 比后者还晚返回
    await Promise.all([refreshA, refreshB, flush()])

    // 只有 user-b 的结果落地;user-a 迟到结果不得覆盖、不得广播
    assert.equal(policy.getCachedSnapshot(), 'user-b 的快照')
    const snapshots = site.calls.map(([snapshot]) => snapshot)
    assert.deepEqual(snapshots, ['user-b 的快照'])
    assert.ok(!snapshots.includes('user-a 的迟到快照'))

    // 换代同样作废旧身份的失败:旧身份的在途失败在换代后不计数、不广播
    const gates2 = { a: createDeferred(), b: createDeferred() }
    let count2 = 0
    const policy2 = createResourceRefreshPolicy({
      load: () => {
        count2 += 1
        return count2 === 1 ? gates2.a.promise : gates2.b.promise
      },
    })
    const site2 = createRecorder()
    policy2.subscribe(site2.listener)
    policy2.setIdentity('user-a')
    const inFlight = policy2.refresh()
    policy2.setIdentity('user-b')
    gates2.a.reject(new Error('too late'))
    gates2.b.resolve('b-snap')
    await Promise.all([inFlight, policy2.refresh(), flush()])
    assert.equal(policy2.getFailureCount(), 0) // 迟到失败被换代作废
    assert.equal(policy2.getCachedSnapshot(), 'b-snap')
    assert.deepEqual(site2.calls, [['b-snap', null]])
  })

  it('补充:未设置身份时 refresh 不动(load 不被调)', async () => {
    let loaded = 0
    const policy = createResourceRefreshPolicy({
      load: async () => {
        loaded += 1
        return 'x'
      },
    })
    await policy.refresh()
    assert.equal(loaded, 0)
    assert.equal(policy.getIdentity(), null)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
