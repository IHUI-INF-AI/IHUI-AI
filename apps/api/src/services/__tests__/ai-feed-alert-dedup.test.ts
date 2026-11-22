// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ai-feed-collect 失败告警「按身份去重」的回归。
 *
 * 病灶(实测):采集每 6h 一轮、坏源不会自己变好,而落点原本无条件 pushAlert
 * ⇒ 同一批 4 个坏源每轮各寄一封内容逐字相同的邮件(48h 内 7 封)。
 *
 * 这里刻意**只测判据与存储契约**,不起 BullMQ worker:要证的是"该不该再喊人",
 * 而不是 worker 怎么被调度(那需要 mock 整条队列依赖,证不了判据本身)。
 * 冷却存储一律喂 fake Redis —— 关键是喂给**生产的** createRedisAlertCooldownStore,
 * 而不是自己再造一个假实现:只测假存储等于什么都没测。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Redis } from 'ioredis'
import {
  AI_FEED_ALERT_COOLDOWN_SEC,
  createRedisAlertCooldownStore,
  decideAiFeedCollectAlert,
  maybePushAiFeedCollectAlert,
  type AiFeedAlertLog,
  type AiFeedFailingSource,
} from '../../workers/scheduler-worker.js'

// ---------------------------------------------------------------------------
// 假时钟 + 假 Redis(带 TTL 过期语义)
// ---------------------------------------------------------------------------

interface FakeRedis {
  readonly rows: Map<string, { value: string; expiresAtMs: number }>
  get(key: string): Promise<string | null>
  set(key: string, value: string, opt: string, ttl: number): Promise<'OK'>
  client: Redis
  /** 让读抛错:模拟"探测不出该源是否报过" ⇒ 判不出必须照送。 */
  brokenGet: boolean
  /** 让写抛错:模拟"送达了但登记不上" ⇒ 必须喊出来,且不得伪装成已进冷却。 */
  brokenSet: boolean
}

function makeFakeRedis(clock: { nowMs: number }): FakeRedis {
  const rows = new Map<string, { value: string; expiresAtMs: number }>()
  const fake: FakeRedis = {
    rows,
    brokenGet: false,
    brokenSet: false,
    async get(key) {
      if (fake.brokenGet) throw new Error('redis is down')
      const hit = rows.get(key)
      if (!hit) return null
      if (hit.expiresAtMs <= clock.nowMs) {
        rows.delete(key)
        return null
      }
      return hit.value
    },
    async set(key, value, opt, ttl) {
      if (fake.brokenSet) throw new Error('redis write is down')
      // 生产代码走的是 'EX' + 秒;单位算错(当成毫秒)会让窗口短 1000 倍、去重当场失效
      const ttlMs = opt === 'EX' ? ttl * 1000 : ttl
      rows.set(key, { value, expiresAtMs: clock.nowMs + ttlMs })
      return 'OK'
    },
    // 只喂 get/set 两个方法:多余方法缺失若被实现依赖,会在运行期炸出来
    client: null as unknown as Redis,
  }
  fake.client = fake as unknown as Redis
  return fake
}

/** 采集周期 6h —— 窗口必须严格大于它,否则一封也压不住(见被测代码注释)。 */
const COLLECT_CYCLE_MS = 6 * 60 * 60 * 1000

function failing(...entries: Array<[string, string]>): AiFeedFailingSource[] {
  return entries.map(([sourceCode, severity]) => ({ sourceCode, severity }))
}

interface LogCapture extends AiFeedAlertLog {
  infos: string[]
  warns: string[]
}

function makeLog(): LogCapture {
  return {
    infos: [],
    warns: [],
    info(obj: unknown, msg: string) {
      this.infos.push(`${msg}|${JSON.stringify(obj)}`)
    },
    warn(obj: unknown, msg: string) {
      this.warns.push(`${msg}|${JSON.stringify(obj)}`)
    },
  }
}

describe('ai-feed-collect 告警按身份去重', () => {
  it('窗口必须严格大于采集周期(6h):配 6h 窗口时一轮间隔恒 ≥ 窗口,去重形同虚设', () => {
    expect(AI_FEED_ALERT_COOLDOWN_SEC * 1000).toBeGreaterThan(COLLECT_CYCLE_MS)
  })

  it('同一身份窗口内第二次不推,且抑制留一行可见日志', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    const store = createRedisAlertCooldownStore(redis.client)
    const bad = failing(['aihot', 'warning'], ['juejin', 'warning'])

    const pushCalls: number[] = []
    const log = makeLog()
    const first = await maybePushAiFeedCollectAlert({
      failing: bad,
      store,
      log,
      push: async () => {
        pushCalls.push(clock.nowMs)
        return true
      },
    })
    expect(first.shouldPush).toBe(true)
    expect(pushCalls).toHaveLength(1)

    // 下一轮(6h 后),同一批源仍坏 ⇒ 必须压住
    clock.nowMs += COLLECT_CYCLE_MS
    const second = await maybePushAiFeedCollectAlert({
      failing: bad,
      store,
      log,
      push: async () => {
        pushCalls.push(clock.nowMs)
        return true
      },
    })
    expect(second.shouldPush).toBe(false)
    expect(pushCalls).toHaveLength(1)
    expect(second.suppressedSources).toEqual(['aihot', 'juejin'])
    // 抑制不得静默:读日志的人要能区分"判过且压住"与"根本没人判"
    expect(log.infos.some((l) => l.includes('不重复推送'))).toBe(true)
  })

  it('过窗后必推(窗口到点即视为"该再喊人一次")', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    const store = createRedisAlertCooldownStore(redis.client)
    const bad = failing(['aihot', 'warning'])

    await maybePushAiFeedCollectAlert({
      failing: bad,
      store,
      log: makeLog(),
      push: async () => true,
    })

    // 仍在窗口内 ⇒ 压住
    let decision = await decideAiFeedCollectAlert(bad, store)
    expect(decision.shouldPush).toBe(false)

    // 跨过窗口 ⇒ 必推
    clock.nowMs += AI_FEED_ALERT_COOLDOWN_SEC * 1000 + 1
    decision = await decideAiFeedCollectAlert(bad, store)
    expect(decision.shouldPush).toBe(true)
    expect(decision.suppressedSources).toEqual([])
  })

  it('身份变化(出现没报过的源 / 同一源严重度升档)必推', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    const store = createRedisAlertCooldownStore(redis.client)

    await maybePushAiFeedCollectAlert({
      failing: failing(['aihot', 'warning'], ['juejin', 'warning']),
      store,
      log: makeLog(),
      push: async () => true,
    })

    // 新增一个从没报过的源 ⇒ 集合变了 ⇒ 必推
    const added = await decideAiFeedCollectAlert(
      failing(['aihot', 'warning'], ['juejin', 'warning'], ['rss-new', 'warning']),
      store,
    )
    expect(added.shouldPush).toBe(true)
    expect(added.newIdentities).toHaveLength(1)

    // 同一个源从 warning 升到 critical ⇒ 是新信息,不得被旧档压住
    const escalated = await decideAiFeedCollectAlert(
      failing(['aihot', 'critical'], ['juejin', 'warning']),
      store,
    )
    expect(escalated.shouldPush).toBe(true)
  })

  it('刻意取"单源"而非"失败源集合"作身份:只是少了一个源(有源恢复)不算新信息', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const store = createRedisAlertCooldownStore(makeFakeRedis(clock).client)
    const all = failing(['a', 'warning'], ['b', 'warning'], ['c', 'warning'])
    await maybePushAiFeedCollectAlert({
      failing: all,
      store,
      log: makeLog(),
      push: async () => true,
    })

    // a 恢复了,集合确实变了 —— 但仍在坏的是刚报过的那三个里的两个,没有新坏源 ⇒ 压住。
    // 按"集合哈希"作身份这里会立刻再寄一封讲的是同样坏源的邮件(且源交替坏/好时每一轮都放行),
    // 这条用例钉住的是这个语义选择,不是随手断言。
    const recovered = await decideAiFeedCollectAlert(
      failing(['a', 'warning'], ['b', 'warning']),
      store,
    )
    expect(recovered.shouldPush).toBe(false)
  })

  it('服务重启后状态仍生效:状态住在 Redis,不住在 store 实例里', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    const bad = failing(['aihot', 'warning'])

    // 进程 #1
    const before = createRedisAlertCooldownStore(redis.client)
    expect((await decideAiFeedCollectAlert(bad, before)).shouldPush).toBe(true)
    await maybePushAiFeedCollectAlert({
      failing: bad,
      store: before,
      log: makeLog(),
      push: async () => true,
    })

    // 进程 #2 = 一次 nssm 服务重启:全新的 store 实例,只共享同一个 Redis
    const afterRestart = createRedisAlertCooldownStore(redis.client)
    const second = await decideAiFeedCollectAlert(bad, afterRestart)
    expect(second.shouldPush).toBe(false)
    expect(second.suppressedSources).toEqual(['aihot'])
    expect(redis.rows.size).toBeGreaterThan(0)
  })

  it('判不出 ⇒ 照推并点名原因,绝不静默吞掉告警(存储不可用 / 认不出源 / 存储缺失三型)', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const bad = failing(['aihot', 'warning'])

    // ① Redis 读抛错
    const broken = makeFakeRedis(clock)
    broken.brokenGet = true
    const storeDown = createRedisAlertCooldownStore(broken.client)
    const d1 = await decideAiFeedCollectAlert(bad, storeDown)
    expect(d1.storeUnavailable).toBe(true)
    expect(d1.shouldPush).toBe(true)

    // ② redis 客户端根本没注册(server.redis 为 undefined)
    const storeMissing = createRedisAlertCooldownStore(null)
    const d2 = await decideAiFeedCollectAlert(bad, storeMissing)
    expect(d2.storeUnavailable).toBe(true)
    expect(d2.shouldPush).toBe(true)

    // ③ 认不出是哪个源(空 sourceCode)⇒ 没有可去重的身份 ⇒ 照送并报名
    const d3 = await decideAiFeedCollectAlert(failing(['   ', 'warning']), storeMissing)
    expect(d3.undeterminedSources).toEqual(['   '])
    expect(d3.shouldPush).toBe(true)

    // 三条都得在日志里喊出来
    const log = makeLog()
    await maybePushAiFeedCollectAlert({
      failing: bad,
      store: storeDown,
      log,
      push: async () => true,
    })
    expect(log.infos.some((l) => l.includes('storeUnavailable":true'))).toBe(true)
    const log2 = makeLog()
    await maybePushAiFeedCollectAlert({
      failing: failing(['   ', 'warning']),
      store: createRedisAlertCooldownStore(makeFakeRedis(clock).client),
      log: log2,
      push: async () => true,
    })
    expect(log2.infos.some((l) => l.includes('undeterminedSources'))).toBe(true)
  })

  it('未确认送达不进冷却(否则一次 SMTP 失败就把告警静默一整个窗口)', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    const store = createRedisAlertCooldownStore(redis.client)
    const bad = failing(['aihot', 'warning'])
    const log = makeLog()

    await maybePushAiFeedCollectAlert({ failing: bad, store, log, push: async () => false })
    expect(redis.rows.size).toBe(0)
    expect(log.warns.some((l) => l.includes('不进入冷却'))).toBe(true)

    // 下一轮必须仍然推
    expect((await decideAiFeedCollectAlert(bad, store)).shouldPush).toBe(true)
  })

  it('登记失败必须喊出来,且不得让已送达的告警变成"看起来已进冷却"', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const redis = makeFakeRedis(clock)
    // 读得出(该源没报过)、写不进(登记失败)
    redis.brokenSet = true
    const store = createRedisAlertCooldownStore(redis.client)
    const log = makeLog()

    const decision = await maybePushAiFeedCollectAlert({
      failing: failing(['aihot', 'warning']),
      store,
      log,
      push: async () => true,
    })

    // 判得出"没报过" ⇒ 推(登记失败不影响本轮送达)
    expect(decision.shouldPush).toBe(true)
    expect(decision.newIdentities).toHaveLength(1)
    // 登记失败必须有一条 warn:否则下一轮重发时没人知道是这一轮没登记上
    expect(log.warns.some((l) => l.includes('登记失败'))).toBe(true)
    // 确实没写进去 ⇒ 下一轮仍会推(宁可重发,不可把坏源藏进一个并不存在的冷却记录)
    expect(redis.rows.size).toBe(0)
    redis.brokenSet = false
    expect((await decideAiFeedCollectAlert(failing(['aihot', 'warning']), store)).shouldPush).toBe(
      true,
    )
  })

  it('没有总量封顶:同时坏 N 个源就产 N 条身份,不数"今天已寄几封"', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const store = createRedisAlertCooldownStore(makeFakeRedis(clock).client)
    const many = failing(
      ['s1', 'warning'],
      ['s2', 'warning'],
      ['s3', 'warning'],
      ['s4', 'warning'],
      ['s5', 'warning'],
    )
    const decision = await decideAiFeedCollectAlert(many, store)
    expect(decision.newIdentities).toHaveLength(5)
    expect(decision.shouldPush).toBe(true)
  })

  it('身份按源归一化:大小写/首尾空白不改身份,不同源不得撞同一个键', async () => {
    const clock = { nowMs: 1_700_000_000_000 }
    const store = createRedisAlertCooldownStore(makeFakeRedis(clock).client)
    await maybePushAiFeedCollectAlert({
      failing: failing(['  AIHot ', 'warning']),
      store,
      log: makeLog(),
      push: async () => true,
    })
    // 同源的另一种写法视为同一身份 ⇒ 压住
    expect((await decideAiFeedCollectAlert(failing(['aihot', 'warning']), store)).shouldPush).toBe(
      false,
    )
    // 别的源仍是别的身份 ⇒ 推
    expect((await decideAiFeedCollectAlert(failing(['other', 'warning']), store)).shouldPush).toBe(
      true,
    )
  })
})

/**
 * **装车证明**:上面每一条都在测导出的判据函数,而判据函数写得再对,
 * 调用点没接上就等于没有(本仓"造好没装车"记过多次:守门 64/70/81/115 同族)。
 * 这一组不 mock worker,直接读被接线的那份源码,判两件事:
 * ① `ai-feed-collect` 那一支必须真的调 `maybePushAiFeedCollectAlert(`;
 * ② 该支内不得再出现裸 `await pushAlert({`(裸调用 = 无条件推送 = 原病灶)。
 * 反向对照:同一个断言喂一份"把判据换回裸 pushAlert"的旧写法文本必须红,
 * 否则这条锁只是在复读当前实现、而不是能拦住回退。
 */
describe('ai-feed-collect 告警去重的接线', () => {
  const WORKER_URL = new URL('../../workers/scheduler-worker.ts', import.meta.url)
  /** 截出 ai-feed-collect 那一支(到下一个 case 之前),避免把别的告警族的 pushAlert 误判成本支。 */
  function collectBranch(src: string): string {
    const start = src.indexOf("case 'ai-feed-collect'")
    expect(start, "源码里找不到 case 'ai-feed-collect'").toBeGreaterThanOrEqual(0)
    const rest = src.slice(start + "case 'ai-feed-collect'".length)
    const next = rest.indexOf('case ')
    return next === -1 ? rest : rest.slice(0, next)
  }

  it('判据必须真挂在调用点上(而不是只存在于导出里)', () => {
    const branch = collectBranch(readFileSync(fileURLToPath(WORKER_URL), 'utf8'))
    expect(branch).toContain('maybePushAiFeedCollectAlert({')
    expect(branch).not.toMatch(/await\s+pushAlert\(\s*\{/)
  })

  it('反向对照:回退成裸 pushAlert 时,上面那条断言必须翻红', () => {
    const legacy = `
          case 'ai-feed-collect': {
            const result = await collectAllSources()
            await pushAlert({ title: 'x', message: 'y', severity: 'warning', source: 'ai-feed-collect' })
            return result
          }
          case 'ai-feed-process': {
            return null
          }
`
    const branch = collectBranch(legacy)
    expect(branch).not.toContain('maybePushAiFeedCollectAlert({')
    expect(branch).toMatch(/await\s+pushAlert\(\s*\{/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
