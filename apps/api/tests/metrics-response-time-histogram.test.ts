// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  cumulativeResponseTimeBuckets,
  RESPONSE_TIME_BUCKET_BOUNDS_MS,
  metricsPlugin,
} from '../src/plugins/metrics.js'

/**
 * 这一族钉的是 2026-09-28 实测到的**"分位数永远查不出来"**那一型:
 * /metrics 曾把响应时间桶打成 `http_response_time_bucket{le="<10ms"} 456` ——
 * ① `le` 是字符串(Prometheus 要求数字)、② 值是互斥计数而非累计(直方图要求累计)、
 * ③ 同一个 family 既出 `# TYPE … summary` 又出 `…_bucket`。三条任一条都让
 * `histogram_quantile()` 对该序列**返回空 series**,而账面看到的是"没有数据",
 * 不是"这道能力坏了"——进程内其实一直统计着(实测 531 笔请求、平均 46.33ms)。
 * 同仓的 `ihui_ai_latency_seconds_bucket` / `bullmq_duration_seconds_bucket` 都是合法直方图,
 * 所以本文件是这一族里唯一的例外,现在把它并回来。
 */

let server: FastifyInstance | undefined
afterAll(async () => {
  if (server) await server.close()
})

async function boot(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(metricsPlugin)
  app.get('/ping', async () => ({ ok: true }))
  await app.ready()
  for (let i = 0; i < 5; i++) await app.inject({ method: 'GET', url: '/ping' })
  return app
}

async function metricsText(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/metrics' })
  expect(res.statusCode).toBe(200)
  return res.body
}

describe('cumulativeResponseTimeBuckets — 互斥分档 → 累计 le', () => {
  it('累计单调不减,且末档 +Inf 等于总请求数', () => {
    const bands = {
      '<10ms': 456,
      '<50ms': 34,
      '<100ms': 1,
      '<500ms': 19,
      '<1s': 15,
      '<5s': 6,
      '>=5s': 0,
    }
    const out = cumulativeResponseTimeBuckets(bands, 531)
    const vals = out.map((x) => x.cumulative)
    for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!)
    expect(out[out.length - 1]!.le).toBe('+Inf')
    expect(out[out.length - 1]!.cumulative).toBe(531)
  })

  it('le 全部是数字或 +Inf(字符串边界会让 histogram_quantile 恒空)', () => {
    const out = cumulativeResponseTimeBuckets({ '<10ms': 3, '<5s': 1 }, 4)
    for (const b of out) {
      expect(b.le === '+Inf' || Number.isFinite(Number(b.le))).toBe(true)
    }
    expect(out.map((b) => b.le)).toEqual([...RESPONSE_TIME_BUCKET_BOUNDS_MS.map(String), '+Inf'])
  })

  it('第 i 档累计 = 前 i 个互斥档之和(取证:10/50/100 三档逐个对数)', () => {
    const bands = { '<10ms': 7, '<50ms': 5, '<100ms': 3, '<5s': 1 }
    const out = cumulativeResponseTimeBuckets(bands, 16)
    expect(out[0]!.cumulative).toBe(7)
    expect(out[1]!.cumulative).toBe(12)
    expect(out[2]!.cumulative).toBe(15)
  })

  it('count 缺失/为 0 时不得给出负数或 NaN', () => {
    const out = cumulativeResponseTimeBuckets({}, 0)
    for (const b of out) expect(b.cumulative).toBe(0)
  })

  it('反向对照:把互斥计数原样当累计输出必须是不合格的(证明本判据有牙,不是恒真)', () => {
    const naive = [456, 34, 1, 19, 15, 6, 0]
    const monotonic = naive.every((v, i) => i === 0 || v >= naive[i - 1]!)
    expect(monotonic).toBe(false)
  })
})

describe('/metrics 暴露面 —— 直方图 family 必须合法', () => {
  it('同一 family 只有一条 # TYPE,且声明为 histogram', async () => {
    server = await boot()
    const text = await metricsText(server)
    const types = text.split('\n').filter((l) => l.startsWith('# TYPE http_response_time_ms '))
    expect(types.length).toBe(1)
    expect(types[0]).toMatch(/histogram$/)
  })

  it('bucket/sum/count 各只出现一次(重复序列会让整次 scrape 解析失败)', async () => {
    server = await boot()
    const text = await metricsText(server)
    const lines = text.split('\n').filter((l) => l && !l.startsWith('#'))
    // 判"同一条样本(名字+标签集)被打印了两遍"——带不同 le 的多条 bucket 是合法的,
    // 而 `…_sum` 出现两次才是 Prometheus 解析错误。第一版把两者混成一类,判错了方向。
    const dup = lines.filter((l, i) => lines.indexOf(l) !== i)
    expect(dup).toEqual([])
    expect(lines.filter((l) => /^http_response_time_ms_sum\b/.test(l)).length).toBe(1)
    expect(lines.filter((l) => /^http_response_time_ms_count\b/.test(l)).length).toBe(1)
    expect(lines.filter((l) => /^http_response_time_ms_bucket\{le="\+Inf"\}/.test(l)).length).toBe(
      1,
    )
  })

  it('旧的字符串 le 形态不得回来(反向回归锁)', async () => {
    server = await boot()
    const text = await metricsText(server)
    expect(text).not.toMatch(/http_response_time_bucket/)
    expect(text).not.toMatch(/le="</)
  })

  it('实测形态:p95 可以从这个 family 算出来(不依赖外部 Prometheus 也能验算子)', async () => {
    server = await boot()
    const text = await metricsText(server)
    const buckets = [...text.matchAll(/^http_response_time_ms_bucket\{le="([^"]+)"\} (\d+)$/gm)]
    expect(buckets.length).toBe(RESPONSE_TIME_BUCKET_BOUNDS_MS.length + 1)
    const parsed = buckets.map((m) => ({ le: m[1]!, c: Number(m[2]) }))
    const count = Number(/http_response_time_ms_count (\d+)/.exec(text)![1])
    expect(parsed.at(-1)!.c).toBe(count)
    // 分位数的定义式验算:找到第一个累计 ≥ 0.95*count 的 le
    const idx = parsed.findIndex((p) => p.c >= 0.95 * count)
    expect(idx).toBeGreaterThanOrEqual(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
