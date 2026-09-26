// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// A9R12-G1 收口尾格 · 分片上传「合并阶段」并发闸的回归
//
// 任务书点名要的三条判据都在这里,每条都配了"判据失效时它自己会红"的对照:
//  ① 同时在跑的合并数**从不**超过上限 —— 用真并发(9 任务 × limit 3,峰值从任务体内部
//     计数,不读常量),并留一条**无闸阳性对照**(同样 9 任务裸跑 peak 必为 9):
//     若并发驱动本身失效,①就成了恒真式,这条对照当场翻红。
//  ② 超限请求排队而非报错 —— 9 枚 allSettled 全 fulfilled;facts.queuedTotal≥6。
//  ③ 摘掉闸 ⇒ 必红 —— 两层:行为层(把闸调成"不限" ⇒ 峰值 9,①的断言形状必炸)+
//     装车证明(merge 处理器源文件必须 import 并调用 withUploadMergeSlot,且磁盘段的
//     每个执行标记(createWriteStream/hashFile/rmSync…)都落在该次调用的区间内 ——
//     把段从闸里搬出去或摘掉调用,都会让这条翻红)。
//  ④ env 覆盖生效值随事实报出 —— resolve 纯函数五档 + 单例现值 + env-override 喊话。
//  另:首次喊话 + 节流复读 + 窗口后带累计数复读,用注入时钟验证(不睡 60 秒)。
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  UPLOAD_MERGE_ENV_KEY,
  UPLOAD_MERGE_NOTICE_THROTTLE_MS,
  createUploadMergeGate,
  resolveUploadMergeLimit,
  withUploadMergeSlot,
  getUploadMergeGateFacts,
  resetUploadMergeGateForTests,
  type UploadMergeNotice,
} from '../src/services/upload-merge-gate.js'
import { PROTOCOL_UPLOAD_LIMITS } from '../src/services/upload-integrity.js'

/** 仓库根由本文件位置推导(不用 cwd —— 守门 70 的镜像测试 13/14 恒红那一型):
 *  tests → api → apps → 根,三层。 */
const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = (...rel: string[]) => readFileSync(resolve(ROOT, ...rel), 'utf8')
const routeSrc = read('apps', 'api', 'src', 'routes', 'chunked-upload.ts')

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
function deferred() {
  let go: () => void = () => {}
  const p = new Promise<void>((r) => {
    go = r
  })
  return { p, resolve: () => go() }
}

afterEach(() => {
  delete process.env[UPLOAD_MERGE_ENV_KEY]
  resetUploadMergeGateForTests()
})

describe('①② 闸的并发语义:真并发驱动,峰值受控,超限排队不报错', () => {
  it('limit=3 × 9 个真并发任务:峰值从不超过 3,全部成功完成,排队数与等待时长进台账', async () => {
    const notices: UploadMergeNotice[] = []
    const gate = createUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '3' },
      notify: (n) => notices.push(n),
    })
    let live = 0
    let peak = 0
    const mk = () =>
      gate.runExclusive('t', async () => {
        live += 1
        if (live > peak) peak = live
        await delay(20)
        live -= 1
        return true
      })
    const results = await Promise.allSettled(Array.from({ length: 9 }, mk))

    // ② 超限排队不报错:9 枚全部 fulfilled,没有一枚因"并发已满"被拒。
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    // ① 峰值从任务体内部计数(不是读常量、不是读闸的自述):
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBe(3) // 也确实跑到了 3 路并发 —— 闸没被误修成串行

    const f = gate.facts()
    expect(f.admittedTotal).toBe(9)
    expect(f.queuedTotal).toBeGreaterThanOrEqual(6)
    expect(f.peakActive).toBe(3)
    expect(f.maxWaitMs).toBeGreaterThan(0)
    // ④ env 覆盖生效值随事实报出(facts + info 级喊话一次,不静默也不刷屏):
    expect(f.effectiveLimit).toBe(3)
    expect(f.limitSource).toBe('env')
    expect(notices.filter((n) => n.event === 'env-override')).toHaveLength(1)
    expect(notices.find((n) => n.event === 'env-override')?.fields.effectiveLimit).toBe(3)
  })

  it('无闸阳性对照:同样的 9 枚任务裸跑,峰值必为 9 —— 否则上面那条判据是恒真式', async () => {
    let live = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 9 }, async () => {
        live += 1
        if (live > peak) peak = live
        await delay(5)
        live -= 1
      }),
    )
    expect(peak).toBe(9)
  })

  it('变异对照:把闸调成"不限"(env 0)后,同样的测量形状 peak=9 —— ①的 ≤上限 真有牙', async () => {
    const notices: UploadMergeNotice[] = []
    const gate = createUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '0' },
      notify: (n) => notices.push(n),
    })
    let live = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 9 }, () =>
        gate.runExclusive('t', async () => {
          live += 1
          if (live > peak) peak = live
          await delay(5)
          live -= 1
        }),
      ),
    )
    // 摘闸形态下并发不再受限(证明测量装置兜的是世界,不是兜的闸的实现自述):
    expect(peak).toBe(9)
    expect(peak).toBeGreaterThan(PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads)
    // 且这种形态必须一路喊话(warn 级 unlimited-mode 台账),不是静默放行:
    const un = notices.filter((n) => n.event === 'unlimited-mode')
    expect(un.length).toBeGreaterThanOrEqual(1)
    expect(un[0].level).toBe('warn')
    expect(gate.facts()).toMatchObject({ effectiveLimit: null, unlimited: true, limitSource: 'env-unlimited' })
  })

  it('任务抛错也要还槽:后续排队者不得被一次失败永久卡死', async () => {
    const gate = createUploadMergeGate({ env: { [UPLOAD_MERGE_ENV_KEY]: '1' } })
    const blocker = deferred()
    const first = gate.runExclusive('boom', async () => {
      await blocker.p
      throw new Error('disk died mid-merge')
    })
    const second = gate.runExclusive('next', async () => 'ok')
    let secondDone: string | null = null
    void second.then((v) => {
      secondDone = v
    })
    await delay(15)
    expect(secondDone).toBe(null) // 还在排队,不是报错
    blocker.resolve()
    await expect(first).rejects.toThrow('disk died mid-merge')
    expect(await second).toBe('ok') // 失败释放槽后队首拿到闸
  })
})

describe('③ 装车证明:merge 处理器的磁盘段确实包在 withUploadMergeSlot 里', () => {
  it('路由 import 并调用闸;磁盘段的每个执行标记都落在调用区间内(摘线/搬出即红)', () => {
    expect(routeSrc).toContain("from '../services/upload-merge-gate.js'")
    const slotAt = routeSrc.indexOf('withUploadMergeSlot(')
    expect(slotAt).toBeGreaterThan(-1) // 摘掉调用 ⇒ 这里先红
    const handlerEnd = routeSrc.indexOf("server.delete('/chunked-upload/cancel'")
    expect(handlerEnd).toBeGreaterThan(slotAt)
    // 合并磁盘段的执行标记(取调用点独有的完整形态,不会撞上 import 列表里的短名):
    for (const marker of [
      'createWriteStream(finalPath)',
      'await hashFile(finalPath)',
      'digestMatches(session.fileMd5',
      'pipeline(createReadStream(partPath)',
      'rmSync(chunkDir,',
    ]) {
      const at = routeSrc.indexOf(marker)
      expect(at, marker).toBeGreaterThan(-1)
      expect(at, `${marker} 应在 withUploadMergeSlot( 之后`).toBeGreaterThan(slotAt)
      expect(at, `${marker} 应在 merge 处理器结束之前`).toBeLessThan(handlerEnd)
    }
    // 反向锁:闸的调用点在 status=merging 落库之后、任何磁盘写之前
    // (把闸挪到段尾/段外等于没闸)。
    const mergingAt = routeSrc.indexOf('UPLOAD_SESSION_STATUS.merging')
    expect(mergingAt).toBeGreaterThan(-1)
    expect(mergingAt).toBeLessThan(slotAt)
  })
})

describe('④ env 出口语义:只调数值;0=不限但必须喊;非法值回落并点名', () => {
  it('纯解析器五档', () => {
    expect(resolveUploadMergeLimit({})).toMatchObject({
      limit: PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads,
      unlimited: false,
      source: 'default',
    })
    expect(resolveUploadMergeLimit({ [UPLOAD_MERGE_ENV_KEY]: '' })).toMatchObject({ source: 'default' })
    expect(resolveUploadMergeLimit({ [UPLOAD_MERGE_ENV_KEY]: '5' })).toMatchObject({
      limit: 5,
      source: 'env',
      unlimited: false,
    })
    const off = resolveUploadMergeLimit({ [UPLOAD_MERGE_ENV_KEY]: '0' })
    expect(off).toMatchObject({ unlimited: true, source: 'env-unlimited' })
    expect(off.limit).toBe(Number.POSITIVE_INFINITY)
    for (const bad of ['abc', '-1', '2.5', 'Infinity']) {
      expect(resolveUploadMergeLimit({ [UPLOAD_MERGE_ENV_KEY]: bad })).toMatchObject({
        limit: PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads,
        unlimited: false,
        source: 'env-invalid-fallback',
      })
    }
    expect(resolveUploadMergeLimit({ [UPLOAD_MERGE_ENV_KEY]: '-1' }).raw).toBe('-1')
  })

  it('非法值不是静默:warn 点名原值与回落结果', async () => {
    const notices: UploadMergeNotice[] = []
    const gate = createUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: 'lots' },
      notify: (n) => notices.push(n),
    })
    await gate.runExclusive('m', async () => 1)
    const bad = notices.find((n) => n.event === 'env-invalid-fallback')
    expect(bad).toBeDefined()
    expect(bad.level).toBe('warn')
    expect(bad.message).toContain('lots')
    expect(gate.facts().effectiveLimit).toBe(PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads)
  })

  it('单例随 env 现值重建(生效值随事实报出,不得静默)', async () => {
    process.env[UPLOAD_MERGE_ENV_KEY] = '7'
    resetUploadMergeGateForTests()
    await withUploadMergeSlot('m', async () => 1)
    expect(getUploadMergeGateFacts()).toMatchObject({ effectiveLimit: 7, limitSource: 'env', envRaw: '7' })
    delete process.env[UPLOAD_MERGE_ENV_KEY]
    resetUploadMergeGateForTests()
    expect(getUploadMergeGateFacts().effectiveLimit).toBe(PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads)
  })
})

describe('喊话台账:首次立即,窗口内静默计数,窗口后带累计数复读(形参考 getCloudRunDegradeFacts)', () => {
  it('queue-admission 三次入队只喊两次,第二次在节流窗口之后且带累计数', async () => {
    let t = 1_000_000
    const notices: UploadMergeNotice[] = []
    const gate = createUploadMergeGate({
      env: { [UPLOAD_MERGE_ENV_KEY]: '1' },
      notify: (n) => notices.push(n),
      now: () => t,
    })
    const d1 = deferred()
    const d2 = deferred()
    const d3 = deferred()
    const p1 = gate.runExclusive('a', () => d1.p)
    const p2 = gate.runExclusive('b', () => d2.p) // 入队 ⇒ 首次立即喊
    const p3 = gate.runExclusive('c', () => d3.p) // 入队 ⇒ 窗口内静默计数
    const q = () => notices.filter((n) => n.event === 'queue-admission')
    expect(q()).toHaveLength(1)
    expect(q()[0].level).toBe('warn')
    expect(q()[0].fields.cumulativeQueued).toBe(1)
    expect(gate.facts().noticesThrottled).toBe(1)

    t += UPLOAD_MERGE_NOTICE_THROTTLE_MS + 1
    d1.resolve()
    await p1
    const d4 = deferred()
    const p4 = gate.runExclusive('d', () => d4.p) // 再入队 ⇒ 窗口已过,复读带累计数
    expect(q()).toHaveLength(2)
    expect(q()[1].fields.cumulativeQueued).toBe(3) // b、c、d 累计入队 3 次

    d2.resolve()
    d3.resolve()
    d4.resolve()
    await Promise.all([p2, p3, p4])
    expect(gate.facts().queuedTotal).toBe(3)
  })
})

describe('声明↔消费对账(守门 121 立论的正面形态)', () => {
  it('maxConcurrentUploads 不是第二张死表:闸的默认档从该常量取,路由段真的过闸', () => {
    expect(PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads).toBeGreaterThanOrEqual(1)
    expect(resolveUploadMergeLimit({}).limit).toBe(PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads)
    const gateSrc = read('apps', 'api', 'src', 'services', 'upload-merge-gate.ts')
    expect(gateSrc).toContain('PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads')
    expect(routeSrc).toContain('withUploadMergeSlot(')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
