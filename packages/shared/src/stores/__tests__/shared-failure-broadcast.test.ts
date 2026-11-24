// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816011 成对测试:失败也是共享事实(刷新策略工厂)。
 *
 * 票面判据(④ 是 ③ 的同一身份半场):
 * ① A 处失败后 B 处不得读到旧成功快照;
 * ② 成功后缓存恢复可命中(反向锁,防做成"永远不缓存");
 * ③ 身份变化使全部在途请求失效(不是只失效发起那一个);
 * ④ ③ 的同一身份半场:购买换代(invalidate())身份不变,仍使全部在途请求作废。
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createResourceRefreshPolicy,
  USAGE_ENTITLEMENT_REFRESH_FAILED,
} from '../resource-refresh-policy'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

describe('G-816011 刷新策略工厂:失败广播 + 有失败不供缓存', () => {
  it('① A 处失败 ⇒ 失败广播到所有订阅者,B 处不得读到旧成功快照', async () => {
    const gate = createDeferred<void>()
    let calls = 0
    const policy = createResourceRefreshPolicy<string>({
      load: () => {
        calls += 1
        return calls === 1 ? Promise.resolve('余额 100') : gate.promise.then(() => '余额 100')
      },
    })
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    policy.subscribe(listenerA)
    policy.setIdentity('user-1')
    await policy.refresh()
    // 首次成功:两处订阅者都拿到成功快照
    policy.subscribe(listenerB)
    expect(policy.getCachedSnapshot()).toBe('余额 100')
    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerA).toHaveBeenCalledWith('余额 100', null)

    // 第二次刷新失败:广播形状 = (current?.snapshot ?? null, 失败 reason),到**所有**订阅者
    gate.reject(new Error('network down'))
    await policy.refresh()
    expect(listenerA).toHaveBeenLastCalledWith('余额 100', USAGE_ENTITLEMENT_REFRESH_FAILED)
    expect(listenerB).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledWith('余额 100', USAGE_ENTITLEMENT_REFRESH_FAILED)
    // 缓存闸:A 处失败后 B 处(以及任何人)不得读到旧成功快照
    expect(policy.getFailureCount()).toBe(1)
    expect(policy.getCachedSnapshot()).toBeNull()
  })

  it('② 成功后缓存恢复可命中(反向锁:不是"永远不缓存")', async () => {
    let shouldFail = true
    const policy = createResourceRefreshPolicy<string>({
      load: () => (shouldFail ? Promise.reject(new Error('down')) : Promise.resolve('快照 v2')),
    })
    const listener = vi.fn()
    policy.subscribe(listener)
    policy.setIdentity('user-1')

    await policy.refresh() // 失败 ⇒ 不供缓存
    expect(policy.getCachedSnapshot()).toBeNull()

    shouldFail = false
    await policy.refresh() // 成功 ⇒ failureCount 归零,缓存恢复可命中
    expect(policy.getFailureCount()).toBe(0)
    expect(policy.getCachedSnapshot()).toBe('快照 v2')
    expect(listener).toHaveBeenLastCalledWith('快照 v2', null)

    // 再次成功仍可命中(缓存不是一次性)
    await policy.refresh()
    expect(policy.getCachedSnapshot()).toBe('快照 v2')
  })

  it('③ 身份变化 ⇒ 全部在途请求失效:旧身份迟到的结果被丢弃,不写缓存、不广播', async () => {
    // 有牙锁:旧身份放**两条**在途(a1/a2)。若实现只失效"发起那一个"(单 hook 级 requestVersion,
    // 上游 :45-46 明令禁止的形态),另一条迟到结果会落地并广播 ⇒ 本用例翻红。
    const gates = {
      a1: createDeferred<string>(),
      a2: createDeferred<string>(),
      b: createDeferred<string>(),
    }
    let calls = 0
    const policy = createResourceRefreshPolicy<string>({
      load: () => {
        calls += 1
        if (calls === 1) return gates.a1.promise
        if (calls === 2) return gates.a2.promise
        return gates.b.promise
      },
    })
    const listener = vi.fn()
    policy.subscribe(listener)
    policy.setIdentity('user-a')
    const refreshA1 = policy.refresh() // 在途(user-a)第一条
    const refreshA2 = policy.refresh() // 在途(user-a)第二条
    policy.setIdentity('user-b') // 换代:全部在途失效
    const refreshB = policy.refresh() // user-b 的请求
    gates.b.resolve('user-b 的快照')
    gates.a1.resolve('user-a 的迟到快照 1') // 比 user-b 还晚返回
    gates.a2.resolve('user-a 的迟到快照 2') // 比 user-b 还晚返回
    await Promise.all([refreshA1, refreshA2, refreshB, flush()])

    // 只有 user-b 的结果落地;user-a 的**两条**迟到结果都不得覆盖、不得广播
    expect(policy.getCachedSnapshot()).toBe('user-b 的快照')
    const snapshots = listener.mock.calls.map((c) => c[0])
    expect(snapshots).toEqual(['user-b 的快照'])
    expect(snapshots).not.toContain('user-a 的迟到快照 1')
    expect(snapshots).not.toContain('user-a 的迟到快照 2')

    // 换代同样作废旧身份的失败计数:旧身份失败在换代后不算数
    const gates2 = { a: createDeferred<string>(), b: createDeferred<string>() }
    let calls2 = 0
    const policy2 = createResourceRefreshPolicy<string>({
      load: () => {
        calls2 += 1
        return calls2 === 1 ? gates2.a.promise : gates2.b.promise
      },
    })
    policy2.setIdentity('user-a')
    const p1 = policy2.refresh()
    policy2.setIdentity('user-b')
    gates2.a.reject(new Error('too late'))
    gates2.b.resolve('b-snap')
    await Promise.all([p1, policy2.refresh(), flush()])
    expect(policy2.getFailureCount()).toBe(0) // 迟到失败被换代作废
    expect(policy2.getCachedSnapshot()).toBe('b-snap')
  })

  it('④ 同一身份购买换代 ⇒ 全部在途请求作废(身份不变,旧请求不得回写缓存)', async () => {
    // 上游「购买使同一身份全部旧请求失效」:身份字符串不变,但旧权益的在途请求必须失效。
    // 有牙锁:购买前放**两条**在途(a1/a2)。若实现只在 setIdentity 换代(或只失效发起那一个),
    // 这两条迟到结果会在购买后落地并广播 ⇒ 本用例翻红。
    const gates = {
      a1: createDeferred<string>(),
      a2: createDeferred<string>(),
      after: createDeferred<string>(),
    }
    let calls = 0
    const policy = createResourceRefreshPolicy<string>({
      load: () => {
        calls += 1
        if (calls === 1) return Promise.resolve('旧权益快照')
        if (calls === 2) return gates.a1.promise
        if (calls === 3) return gates.a2.promise
        return gates.after.promise
      },
    })
    const listener = vi.fn()
    policy.subscribe(listener)
    policy.setIdentity('user-1')
    await policy.refresh() // 旧权益快照入缓存
    const before1 = policy.refresh() // 购买前的在途请求 1
    const before2 = policy.refresh() // 购买前的在途请求 2
    policy.invalidate() // 同一身份购买换代:身份不变
    expect(policy.getIdentity()).toBe('user-1')
    expect(policy.getCachedSnapshot()).toBeNull() // 旧权益快照不再供

    const after = policy.refresh() // 购买后的请求
    gates.after.resolve('购买后快照')
    gates.a1.resolve('购买前的迟到快照 1') // 比购买后的请求还晚返回
    gates.a2.resolve('购买前的迟到快照 2')
    await Promise.all([before1, before2, after, flush()])

    expect(policy.getCachedSnapshot()).toBe('购买后快照')
    const snapshots = listener.mock.calls.map((c) => c[0])
    expect(snapshots).toEqual(['旧权益快照', '购买后快照'])
    expect(snapshots).not.toContain('购买前的迟到快照 1')
    expect(snapshots).not.toContain('购买前的迟到快照 2')
  })

  it('补充:未设置身份时 refresh 不动(load 不被调)', async () => {
    const load = vi.fn(async () => 'x')
    const policy = createResourceRefreshPolicy<string>({ load })
    await policy.refresh()
    expect(load).not.toHaveBeenCalled()
    expect(policy.getIdentity()).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
