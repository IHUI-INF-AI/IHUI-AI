// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-309 回归锁(2026-11-13)。
 *
 * 病灶:`upsertPricing` 按 `modelId ORDER BY effectiveAt DESC LIMIT 1` 取最新一行后原地覆盖,
 * 且 update 的 set 不含 effectiveAt ⇒ ① 未来计划调价立即生效;② 命中已过期行时改价 200 但
 * 计费永不使用(relay-billing-service 只认 effectiveAt <= now 的行)。
 *
 * 本文件锁:
 *   ① 对已生效行提交未来 effectiveAt ⇒ 新增一条带未来 effectiveAt 的行,当前生效行价格不变;
 *   ② 同一 (modelId, effectiveAt) 重复提交 ⇒ 精确更新该行,且 set 显式写回 effectiveAt;
 *   ③ 未传 effectiveAt ⇒ 只更新当前生效行,不盲更新"最新一条"(未来行);
 *   ④ 库存仅剩已过期行 ⇒ 新增当前生效行,绝不原地改过期行。
 *
 * 假库直接按 drizzle SQL 里的绑定参数命中行,可区分"精确查询"与"当前生效查询";
 * 老实现(无时间参数、盲取最大 effectiveAt)在 ①③ 上必红。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { store } = vi.hoisted(() => ({
  store: {
    rows: [] as any[],
    updateSets: [] as any[],
    updateIds: [] as any[],
    insertValues: [] as any[],
  },
}))

vi.mock('../src/db/index.js', () => {
  /** 递归取出 SQL 节点里的绑定参数(用于让假库按真实条件命中行)。 */
  function sqlParams(node: any, out: any[] = []): any[] {
    const chunks = node?.queryChunks
    if (Array.isArray(chunks)) {
      for (const c of chunks) {
        if (!c || typeof c !== 'object') continue
        if ('value' in c && 'encoder' in c) out.push(c.value)
        else sqlParams(c, out)
      }
    }
    return out
  }

  const byDesc = (a: any, b: any) => b.effectiveAt.getTime() - a.effectiveAt.getTime()

  /** (modelId, effectiveAt) 精确查询:无 orderBy。 */
  function matchExact(params: any[]): any[] {
    const modelId = params.find((p) => typeof p === 'string')
    const at = params.find((p) => p instanceof Date)
    if (!modelId || !at) return []
    return store.rows.filter(
      (r) => r.modelId === modelId && r.effectiveAt.getTime() === at.getTime(),
    )
  }

  /** 当前生效查询:带时间窗过滤;老实现无时间参数 ⇒ 退化为盲取最新一条。 */
  function matchActive(params: any[]): any[] {
    const hasTimeFilter = params.some((p) => p instanceof Date)
    const now = new Date()
    const candidates = hasTimeFilter
      ? store.rows.filter(
          (r) =>
            r.effectiveAt <= now &&
            (r.expiresAt === null || r.expiresAt === undefined || r.expiresAt > now),
        )
      : store.rows.slice()
    return candidates.sort(byDesc).slice(0, 1)
  }

  return {
    db: {
      select: () => ({
        from: () => ({
          where: (w: any) => {
            const params = sqlParams(w)
            return {
              limit: async () => matchExact(params),
              orderBy: () => ({ limit: async () => matchActive(params) }),
            }
          },
        }),
      }),
      update: () => ({
        set: (s: any) => ({
          where: (w: any) => ({
            returning: async () => {
              const id = sqlParams(w).find((p) => typeof p === 'string')
              const row = store.rows.find((r) => r.id === id)
              if (!row) return []
              Object.assign(row, s)
              store.updateSets.push(s)
              store.updateIds.push(id)
              return [row]
            },
          }),
        }),
      }),
      insert: () => ({
        values: (v: any) => ({
          returning: async () => {
            store.insertValues.push(v)
            const row = { id: `p-new-${store.rows.length + 1}`, expiresAt: null, ...v }
            store.rows.push(row)
            return [row]
          },
        }),
      }),
    },
  }
})

import { upsertPricing } from '../src/services/pricing-service.js'

const MODEL = 'gpt-4o'
const T_ACTIVE = new Date('2026-01-01T00:00:00Z') // 已生效
const T_FUTURE = new Date('2027-01-01T00:00:00Z') // 计划调价
const T_EXPIRED_AT = new Date('2025-01-01T00:00:00Z')
const T_EXPIRED_TO = new Date('2025-06-01T00:00:00Z')

function makeRow(over: Record<string, any> = {}): any {
  return {
    id: 'p-active',
    modelId: MODEL,
    inputTokenPrice: 10,
    outputTokenPrice: 20,
    billingMode: 'token',
    perUnitPrice: null,
    tieredCallPrices: null,
    videoUnit: null,
    regionPricing: { cn: 1 },
    discount: null,
    currency: 'CNY',
    effectiveAt: T_ACTIVE,
    expiresAt: null,
    updatedAt: T_ACTIVE,
    ...over,
  }
}

beforeEach(() => {
  store.rows = []
  store.updateSets = []
  store.updateIds = []
  store.insertValues = []
})

describe('F-309 upsertPricing 按 (modelId, effectiveAt) 精确写入', () => {
  it('对已生效行提交未来 effectiveAt → 新增未来行,当前生效行价格不变', async () => {
    store.rows = [makeRow()]

    const saved = await upsertPricing({
      modelId: MODEL,
      inputTokenPrice: 30,
      outputTokenPrice: 60,
      effectiveAt: T_FUTURE,
    })

    // 不原地覆盖:无 update,只有一条新插入
    expect(store.updateSets).toHaveLength(0)
    expect(store.insertValues).toHaveLength(1)
    expect(store.insertValues[0].effectiveAt).toBe(T_FUTURE)
    expect(saved.effectiveAt.getTime()).toBe(T_FUTURE.getTime())

    // 当前生效行价格原样保留(计费仍按旧价,直到未来时刻)
    expect(store.rows).toHaveLength(2)
    const active = store.rows.find((r) => r.id === 'p-active')!
    expect(active.inputTokenPrice).toBe(10)
    expect(active.outputTokenPrice).toBe(20)
  })

  it('同一 (modelId, effectiveAt) 重复提交 → 精确更新该行且显式写回 effectiveAt', async () => {
    store.rows = [makeRow()]

    // 传一个新的 Date 实例:证明按时刻(毫秒)匹配,而非对象身份
    const saved = await upsertPricing({
      modelId: MODEL,
      inputTokenPrice: 11,
      outputTokenPrice: 22,
      effectiveAt: new Date(T_ACTIVE.getTime()),
    })

    expect(store.insertValues).toHaveLength(0)
    expect(store.updateSets).toHaveLength(1)
    expect(store.updateIds).toEqual(['p-active'])
    // set 显式包含 effectiveAt(老实现此处缺失 ⇒ 必红)
    expect(store.updateSets[0].effectiveAt).toBeInstanceOf(Date)
    expect(store.updateSets[0].effectiveAt.getTime()).toBe(T_ACTIVE.getTime())
    expect(saved.inputTokenPrice).toBe(11)
    expect(store.rows).toHaveLength(1)
  })

  it('未传 effectiveAt → 只更新当前生效行,不盲更新最新一条(未来行)', async () => {
    const future = makeRow({
      id: 'p-future',
      effectiveAt: T_FUTURE,
      inputTokenPrice: 99,
      outputTokenPrice: 199,
    })
    const expired = makeRow({
      id: 'p-expired',
      effectiveAt: T_EXPIRED_AT,
      expiresAt: T_EXPIRED_TO,
      inputTokenPrice: 7,
    })
    store.rows = [future, makeRow(), expired] // 未来行"按 effectiveAt 最新"

    const saved = await upsertPricing({
      modelId: MODEL,
      inputTokenPrice: 15,
      outputTokenPrice: 25,
    })

    expect(store.insertValues).toHaveLength(0)
    expect(store.updateIds).toEqual(['p-active']) // 不是 p-future
    expect(store.updateSets[0].effectiveAt.getTime()).toBe(T_ACTIVE.getTime())
    expect(future.inputTokenPrice).toBe(99)
    expect(saved.id).toBe('p-active')
  })

  it('库存仅剩已过期行 → 新增当前生效行,绝不原地改过期行', async () => {
    const expired = makeRow({
      id: 'p-expired',
      effectiveAt: T_EXPIRED_AT,
      expiresAt: T_EXPIRED_TO,
      inputTokenPrice: 7,
    })
    store.rows = [expired]

    const saved = await upsertPricing({
      modelId: MODEL,
      inputTokenPrice: 50,
      outputTokenPrice: 80,
    })

    expect(store.updateSets).toHaveLength(0)
    expect(store.insertValues).toHaveLength(1)
    expect(expired.inputTokenPrice).toBe(7)
    expect(saved.effectiveAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(saved.effectiveAt.getTime()).toBeGreaterThan(T_ACTIVE.getTime())
  })
})
