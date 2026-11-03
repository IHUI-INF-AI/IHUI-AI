// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 node:https 直连测量(仅运行在本机 api 进程内)
/**
 * 访客链路测速 + 边缘缓存预热(2026-10-19 立)。
 *
 * 为什么放在 api 进程内而不是仓库里一个脚本:本机跑的那份 api 在 `D:\DevEnv\ihui-prod`,
 * 与仓库树不是同一棵树 ⇒ "脚本落 `.ihui-agent/state/` 文件、大屏读文件"这条形态跨树必然读不到。
 * 现读依据:`nssm get IHUI-API AppDirectory` = `D:\DevEnv\ihui-prod\apps\api`。
 *
 * 一轮做两件事:① 访问首页即刷新边缘缓存(首页 HIT 0.13s,而 MISS 实测 4~7s,
 * 夜间没人访问时第一个真实访客就要付这 7 秒);② 把耗时与命中率留在内存环形缓冲里,
 * 由 /api/admin/ops-wallboard/overview 直接吐给大屏。
 *
 * 三态纪律:`ok:false` 的腿不进统计,分位数取不到 ⇒ null。**绝不把"没量到"折成 0 毫秒**
 * (0ms 在大屏上长得像"飞快")。
 *
 * 与 `scripts/check-public-path-probe.mjs` 的分工:那道判**公网入口可用性与停摆**(会寄信,
 * 30 分钟档);本器判**访客体验耗时与命中率**(5 分钟档、不寄信)。两者语义不同,不得合并。
 */
import { request } from 'node:https'

export type EdgeLegKey = 'edgeHomepage' | 'apexRedirect' | 'edgeStatic' | 'originViaCf'

export interface EdgeLegSample {
  ok: boolean
  status: number | null
  totalMs: number | null
  ttfbMs: number | null
  bytes: number | null
  encoding: string | null
  /** EdgeOne 自己加的 `EO-Cache-Status`(HIT/MISS/…);取不到 ⇒ null。 */
  edgeStatus: string | null
  /** 边缘 `Age` 头(秒);响应不是边缘给的 ⇒ null。 */
  edgeAgeSec: number | null
  /** 响应头里有 EO 头 ⇒ 这一条确实落在边缘,不是被 Cloudflare 直接接走。 */
  landedViaEdgeOne: boolean
  reason: string | null
}

export interface EdgeStats {
  samples: number
  hitRatio: number | null
  lastMs: number | null
  p50Ms: number | null
  p95Ms: number | null
  worstMs: number | null
  /** 最近一轮首页这一条是否仍落在边缘;`null` = 没量到。 */
  landedViaEdgeOne: boolean | null
}

export interface EdgeSnapshot {
  at: string
  legs: Record<EdgeLegKey, EdgeLegSample>
  stats: EdgeStats
}

interface Target {
  key: EdgeLegKey
  url: string
}

const TARGETS: Target[] = [
  { key: 'edgeHomepage', url: 'https://www.aizhs.top/' },
  { key: 'apexRedirect', url: 'https://aizhs.top/' },
  { key: 'edgeStatic', url: 'https://www.aizhs.top/images/logo-icon.svg' },
  { key: 'originViaCf', url: 'https://bsm.aizhs.top/' },
]

const TIMEOUT_MS = 30_000
const RING_MAX = 72

let ring: EdgeSnapshot[] = []
let timer: NodeJS.Timeout | null = null

function emptyLeg(): EdgeLegSample {
  return {
    ok: false,
    status: null,
    totalMs: null,
    ttfbMs: null,
    bytes: null,
    encoding: null,
    edgeStatus: null,
    edgeAgeSec: null,
    landedViaEdgeOne: false,
    reason: null,
  }
}

function probe(url: string): Promise<EdgeLegSample> {
  return new Promise((resolve) => {
    const u = new URL(url)
    const started = Date.now()
    const base = emptyLeg()
    const req = request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: 'GET',
        servername: u.hostname,
        headers: {
          host: u.host,
          'user-agent': 'ihui-edge-probe/1.0 (self-monitor)',
          accept: 'text/html,application/xhtml+xml,image/svg+xml,*/*',
          'accept-encoding': 'br, gzip',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const ttfb = Date.now() - started
        let bytes = 0
        res.on('data', (c: Buffer) => {
          bytes += c.length
        })
        res.on('end', () => {
          const age = res.headers.age
          resolve({
            ...base,
            ok: true,
            status: res.statusCode ?? null,
            totalMs: Date.now() - started,
            ttfbMs: ttfb,
            bytes,
            encoding: (res.headers['content-encoding'] as string | undefined) ?? 'identity',
            edgeStatus: (res.headers['eo-cache-status'] as string | undefined) ?? null,
            edgeAgeSec: age === undefined ? null : Number(age),
            landedViaEdgeOne: res.headers['eo-cache-status'] !== undefined,
          })
        })
        res.resume()
      },
    )
    req.on('timeout', () => {
      req.destroy(new Error(`超时 ${TIMEOUT_MS}ms`))
    })
    req.on('error', (e: Error & { code?: string }) => {
      resolve({
        ...base,
        reason: `${e.code ?? 'ERR'} ${e.message}`.slice(0, 160),
        totalMs: Date.now() - started,
      })
    })
    req.end()
  })
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const a = sorted[lo]
  const b = sorted[hi]
  if (a === undefined || b === undefined) return null
  return Math.round(a + (b - a) * (idx - lo))
}

/** 只对 `ok:true` 的首页样本计分位;窗口空 ⇒ 全 null(不冒充"一切正常")。 */
function statsFrom(samples: EdgeSnapshot[]): EdgeStats {
  const home = samples.map((s) => s.legs.edgeHomepage).filter((l) => l.ok)
  const ms = home
    .map((l) => l.totalMs)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  const last = home[home.length - 1]
  return {
    samples: home.length,
    hitRatio:
      home.length === 0
        ? null
        : Number((home.filter((l) => l.edgeStatus === 'HIT').length / home.length).toFixed(3)),
    lastMs: last?.totalMs ?? null,
    p50Ms: percentile(ms, 0.5),
    p95Ms: percentile(ms, 0.95),
    worstMs: percentile(ms, 1),
    landedViaEdgeOne: last ? last.landedViaEdgeOne : null,
  }
}

async function runEdgeRound(): Promise<EdgeSnapshot> {
  const legs = {} as Record<EdgeLegKey, EdgeLegSample>
  for (const t of TARGETS) {
    legs[t.key] = await probe(t.url)
  }
  const snapshot: EdgeSnapshot = { at: new Date().toISOString(), legs, stats: statsFrom([]) }
  ring = [...ring, snapshot].slice(-RING_MAX)
  snapshot.stats = statsFrom(ring)
  return snapshot
}

export function latestEdgeSnapshot(): EdgeSnapshot | null {
  return ring[ring.length - 1] ?? null
}

/** 大屏 sparkline 用的窄序列:只要首页耗时 + 命中标志。 */
export function edgeSeries(): Array<[number, number, boolean]> {
  return ring
    .map(
      (s) =>
        [
          Date.parse(s.at),
          s.legs.edgeHomepage.totalMs,
          s.legs.edgeHomepage.edgeStatus === 'HIT',
        ] as [number, number, boolean],
    )
    .filter(([, ms]) => ms !== null) as Array<[number, number, boolean]>
}

export function startEdgeAccessProbe(
  intervalMs = Number(process.env.EDGE_PROBE_INTERVAL_MS ?? 300_000),
): void {
  if (timer) return
  const tick = () => {
    runEdgeRound().catch(() => {
      // 单轮异常只留 null,不影响服务;下一轮自然重来
    })
  }
  tick()
  timer = setInterval(tick, Math.max(30_000, intervalMs))
  timer.unref?.()
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
