// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 监控面板数据代理(2026-10-18,/api/admin/monitor-panels/query)。
//
// 背景:李总要求监控大屏「彻底融合进项目,不可以单独搞出一个程序」。本端点把
// Prometheus / Loki 查询能力以管理端接口形态并入项目,由 /admin/monitor/panels
// 页面用项目自己的 EChart 渲染全部 21 张监控盘的表达式(配置见
// scripts/generate-monitor-panels.mjs 生成的 dashboard-config.generated.ts)。
// Grafana 由此降级为 headless 配置源,用户不再直接接触。
//
// 安全:整插件 requireAdmin(与 admin-ops-wallboard 同档);表达式为管理端
// 配置文件派生(非用户输入),但长度/条数仍设上限防滥用。
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { success } from '../utils/response.js'
import { requireAdmin } from '../plugins/require-permission.js'

const PROMETHEUS_URL = (process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:8815').replace(/\/$/, '')
const LOKI_URL = (process.env.LOKI_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '')
const FETCH_TIMEOUT_MS = 12_000

const querySchema = z.object({
  ref: z.string().min(1).max(16),
  expr: z.string().min(1).max(4000),
  backend: z.enum(['prometheus', 'loki']).default('prometheus'),
  /** 有值 = 区间查询(query_range);缺省 = 即时查询(instant)。 */
  rangeSeconds: z
    .number()
    .int()
    .positive()
    .max(31 * 86400)
    .optional(),
  stepSeconds: z.number().int().positive().max(3600).optional(),
})

const bodySchema = z.object({
  queries: z.array(querySchema).min(1).max(96),
})

interface PromSeries {
  labels: Record<string, string>
  /** null = Prometheus NaN/+Inf(Grafana 语义是断点,不是 0) */
  points: Array<[number, number | null]>
}
interface LokiLogLine {
  ts: number
  line: string
  labels: Record<string, string>
}
interface QueryResult {
  ref: string
  series: PromSeries[]
  logs?: LokiLogLine[]
  error?: string
}

// Prometheus 对无数据的 rate/quantile 返回 "NaN"/"+Inf" 字符串。Grafana 语义是
// 断点(gap)而非 0 —— 强转 0 会画出假零尖峰/假 0 统计,这里透传 null 让前端按
// 断点渲染(ECharts 默认不连接 null 点)。
const num = (raw: string): number | null => {
  const v = Number(raw)
  return Number.isFinite(v) ? v : null
}

async function queryPrometheus(
  expr: string,
  rangeSeconds?: number,
  stepSeconds?: number,
): Promise<Omit<QueryResult, 'ref'>> {
  try {
    let url: string
    if (rangeSeconds) {
      const end = Math.floor(Date.now() / 1000)
      const params = new URLSearchParams({
        query: expr,
        start: String(end - rangeSeconds),
        end: String(end),
        step: String(stepSeconds ?? Math.max(15, Math.floor(rangeSeconds / 200))),
      })
      url = `${PROMETHEUS_URL}/api/v1/query_range?${params}`
    } else {
      url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(expr)}`
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    const body = (await res.json()) as {
      status: string
      data?: {
        resultType: string
        result: Array<{
          metric: Record<string, string>
          values?: Array<[number, string]>
          value?: [number, string]
        }>
      }
      error?: string
    }
    if (body.status !== 'success' || !body.data)
      return { series: [], error: body.error ?? 'query failed' }
    const series = (body.data.result ?? []).map((r) => ({
      labels: r.metric ?? {},
      points:
        r.values?.map(([t, v]) => [t, num(v)] as [number, number | null]) ??
        (r.value ? [[r.value[0], num(r.value[1])] as [number, number | null]] : []),
    }))
    return { series }
  } catch (e) {
    return { series: [], error: String((e as Error).message).slice(0, 200) }
  }
}

async function queryLoki(
  expr: string,
  rangeSeconds?: number,
  stepSeconds?: number,
): Promise<Omit<QueryResult, 'ref'>> {
  try {
    const endNs = BigInt(Date.now()) * 1_000_000n
    const startNs = endNs - BigInt(rangeSeconds ?? 3600) * 1_000_000_000n
    const params = new URLSearchParams({
      query: expr,
      start: startNs.toString(),
      end: endNs.toString(),
      limit: '500',
      direction: 'backward',
    })
    if (rangeSeconds && stepSeconds) {
      // LogQL 指标查询( 包裹的 sum/rate 等)按 step 聚合;日志流查询忽略 step
      params.set('step', `${stepSeconds}s`)
    }
    const res = await fetch(`${LOKI_URL}/loki/api/v1/query_range?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const body = (await res.json()) as {
      status: string
      data?: {
        resultType: string
        result: Array<{
          metric?: Record<string, string>
          stream?: Record<string, string>
          values?: Array<[string, string]>
        }>
      }
      error?: string
    }
    if (body.status !== 'success' || !body.data)
      return { series: [], logs: [], error: body.error ?? 'query failed' }
    const series: PromSeries[] = []
    const logs: LokiLogLine[] = []
    for (const r of body.data.result ?? []) {
      const labels = r.stream ?? r.metric ?? {}
      if (body.data.resultType === 'streams') {
        for (const [tsNs, line] of r.values ?? []) {
          logs.push({ ts: Number(BigInt(tsNs) / 1_000_000n), line, labels })
        }
      } else {
        series.push({
          labels,
          points: (r.values ?? []).map(([t, v]) => [Number(t), num(v)] as [number, number | null]),
        })
      }
    }
    logs.sort((a, b) => b.ts - a.ts)
    return { series, logs }
  } catch (e) {
    return { series: [], logs: [], error: String((e as Error).message).slice(0, 200) }
  }
}

// 公网可达例外(2026-10-20 定):大屏页面本身由公网域名提供,而 server.ts 的 onRoute 钩子
// 对 /api/admin/* 强制注入 network.allowExternal:false ⇒ 大屏取数在公网一律 403。
// 本端点只读、无写副作用,鉴权仍由 preHandler 的 requireAdmin + httpOnly Cookie 裁定,
// 故显式声明 allowExternal:true 打开公网可达(其余 /api/admin/* 维持强制内网限制)。
const MONITOR_PANELS_NETWORK = { network: { allowExternal: true } }

export const adminMonitorPanelsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // POST /monitor-panels/query — 批量执行面板表达式(PromQL / LogQL)
  server.post(
    '/monitor-panels/query',
    { config: MONITOR_PANELS_NETWORK },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ code: 400, message: parsed.error.issues[0]?.message ?? '参数错误' })
      }
      // 有界并发(12):单盘可达 ~30 个 target,串行逐条 fetch 会把整盘加载时间
      // 放大成 30×单条延迟;全量 Promise.all 又会对上游形成尖刺。12 路并发在
      // 本机 Prometheus/Loki 下整盘通常亚秒级完成,且上游压力可控。
      const CONCURRENCY = 12
      const results: QueryResult[] = new Array(parsed.data.queries.length)
      let cursor = 0
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, parsed.data.queries.length) },
        async () => {
          for (;;) {
            const i = cursor++
            if (i >= parsed.data.queries.length) return
            const q = parsed.data.queries[i]!
            const r =
              q.backend === 'loki'
                ? await queryLoki(q.expr, q.rangeSeconds, q.stepSeconds)
                : await queryPrometheus(q.expr, q.rangeSeconds, q.stepSeconds)
            results[i] = { ref: q.ref, ...r }
          }
        },
      )
      await Promise.all(workers)
      return reply.send(success({ results }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
