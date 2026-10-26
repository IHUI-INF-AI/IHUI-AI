// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问来源聚合(2026-10-26 立,监控大屏「流量从哪来」那一块的数据源)。
 *
 * 立因:大屏此前没有「来源」这一维 —— 只知道"多少人用了多少次",不知道"他们从哪来"。
 * 生产实测(2026-10-26 现读 `visit_logs.referer` 677 行):
 *  - GitHub 是最大入口(仓库页 148 + 主页 88 = 236 PV,占有 referer 行的 35%);
 *  - 本机开发流量占约三成(`offline.localhost` 110 + `localhost:8801` 87 = 197 PV);
 *  - 站内导航约 4%(`aizhs.top` 系 115 PV);其余是搜索引擎与外链。
 * ⇒ 不把本机流量单列,推广渠道的读数会被带偏;不按主机归并,
 *   同一个来源会被读成好几行(github 仓库页与主页在原串分组下就是两行)。
 *
 * 口径(每条都有理由):
 *  - 主机提取与来源分类 = `@ihui/shared/utils/visit-url`(唯一实现),本文件不另写正则;
 *  - **只给 PV,不给访客数**:访客数在来源维度上无法精确去重
 *    (同一访客既可能从外部进来、又在站内点了两页 ⇒ 按 referer 行去重再相加会重复计),
 *    宁可少给一格读数,也不给一个看着准、实际重复计的数字;
 *  - 自有域(`VISIT_SELF_HOST_SUFFIX`)缺省取官方域名 `aizhs.top`
 *    (出处:README / package.json homepage);显式设空串 ⇒ 不判站内,
 *    把「没判」与「判过」分开,绝不把站内悄悄说成外部;
 *  - 失败不写 0:任一 SQL 抛错整块上抛,由调用方折成 null(大屏渲染「—」)。
 */

import { sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { visitLogs } from '@ihui/database'
import {
  classifyVisitSource,
  extractVisitRefererHost,
  type VisitSourceKind,
} from '@ihui/shared/utils/visit-url'

/** 来源窗口:与大屏其它腿同一档(24h),同口径才可比。 */
export const VISIT_SOURCE_WINDOW_HOURS = 24

/** 主机榜取前 N 条。 */
const SOURCE_HOST_TOP_N = 8

/**
 * distinct referer 的兜底上限。实测全库约 35 个不同来源串;
 * 超了这个数说明来源形态爆了(爬虫带随机参数之类),此时读数只覆盖前 N 行 ——
 * 宁可少覆盖也不让一个失控的来源把聚合拖垮。
 */
const SOURCE_REFERER_ROW_CAP = 500

/** 自有域缺省值 = 官方域名(README / package.json homepage 里的 https://aizhs.top)。 */
const DEFAULT_SELF_HOST_SUFFIX = 'aizhs.top'

/**
 * 自有域列表(站内判定用)。
 * - 未设 `VISIT_SELF_HOST_SUFFIX` ⇒ 用缺省官方域名;
 * - 显式设成空串 ⇒ **不判站内**(调用方显式关掉这一维);
 * - 逗号分隔可给多个(如 `aizhs.top,ihui.cn`)。
 */
export function selfHostSuffixes(): string[] {
  const raw = process.env.VISIT_SELF_HOST_SUFFIX
  const source = raw === undefined ? DEFAULT_SELF_HOST_SUFFIX : raw
  return source
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/^\.+/, ''))
    .filter((item) => item.length > 0)
}

export interface VisitSourceBucket {
  kind: VisitSourceKind
  /** 该类来源的 PV */
  pv: number
}

export interface VisitSourceHostRow {
  /** 来源主机(已归并同一主机的不同路径) */
  host: string
  kind: VisitSourceKind
  /** 该主机的 PV */
  pv: number
}

export interface VisitSourceSnapshot {
  /** 窗口内总 PV(所有来源之和) */
  totalPv: number
  /** 来源分类桶(未配自有域时不含 internal) */
  buckets: VisitSourceBucket[]
  /** 主机 TOP(按 PV 降序) */
  hosts: VisitSourceHostRow[]
  /** 是否做了站内/外部二分(配了自有域才有) */
  splitInternal: boolean
  computedAtMs: number
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** SQL 侧按 referer 原串聚合出来的一行(主机提取在应用层做,判据只有一份)。 */
export interface SourceRefererRow {
  referer: string | null
  pv: number
}

/**
 * 把按 referer 原串聚合的行折成来源快照(纯函数,便于零连接取证)。
 *
 * 三条细则:
 *  - `referer` 为空 ⇒ 直接访问(`direct`);referer 有值但**取不出主机** ⇒ 计入
 *    `external`(确实有来源,只是主机名认不出),且不进主机榜(没有名字可列)。
 *  - 同一主机的多个 referer 行**合并**成一格(github 仓库页 + 主页 = 一个 github.com)。
 *  - `internal` 桶只在配了自有域时出现 ⇒ 面板上不会出现一个恒为 0 的「站内」格。
 */
export function buildVisitSource(
  rows: SourceRefererRow[],
  selfHosts: string[],
  topN: number = SOURCE_HOST_TOP_N,
): Omit<VisitSourceSnapshot, 'computedAtMs'> {
  const bucketPv = new Map<VisitSourceKind, number>()
  const hostPv = new Map<string, { kind: VisitSourceKind; pv: number }>()
  let totalPv = 0

  for (const row of rows) {
    const pv = num(row.pv)
    totalPv += pv
    const referer = row.referer === null || row.referer === undefined ? '' : String(row.referer)
    const host = extractVisitRefererHost(referer)
    const kind: VisitSourceKind = host
      ? classifyVisitSource(host, selfHosts)
      : referer.trim()
        ? 'external'
        : 'direct'
    bucketPv.set(kind, (bucketPv.get(kind) ?? 0) + pv)
    if (host) {
      const cur = hostPv.get(host)
      if (cur) cur.pv += pv
      else hostPv.set(host, { kind, pv })
    }
  }

  const buckets: VisitSourceBucket[] = (['direct', 'local', 'internal', 'external'] as const)
    .filter((kind) => kind !== 'internal' || selfHosts.length > 0)
    .map((kind) => ({ kind, pv: bucketPv.get(kind) ?? 0 }))

  const hosts: VisitSourceHostRow[] = [...hostPv.entries()]
    .map(([host, v]) => ({ host, kind: v.kind, pv: v.pv }))
    .sort((a, b) => b.pv - a.pv || a.host.localeCompare(b.host))
    .slice(0, topN)

  return { totalPv, buckets, hosts, splitInternal: selfHosts.length > 0 }
}

/** 现算一份来源快照;任一 SQL 抛错就整块上抛,由调用方折成 null(渲染「—」),绝不兜成 0。 */
export async function computeVisitSource(
  hours: number = VISIT_SOURCE_WINDOW_HOURS,
): Promise<VisitSourceSnapshot> {
  const rows = await dbRead
    .select({
      referer: visitLogs.referer,
      pv: sql<number>`count(*)::int`,
    })
    .from(visitLogs)
    .where(sql`${visitLogs.createdAt} >= now() - make_interval(hours => ${hours})`)
    .groupBy(visitLogs.referer)
    .limit(SOURCE_REFERER_ROW_CAP)

  const value = buildVisitSource((rows as unknown as SourceRefererRow[]) ?? [], selfHostSuffixes())
  return { ...value, computedAtMs: Date.now() }
}

/**
 * 大屏实时档(24h 窗口 + 60 秒 TTL):来源维度不需要 5 秒级新鲜度,
 * 而按 referer 分组要扫 `visit_logs` 全表(无 referer 索引),60 秒足够新。
 */
export const VISIT_SOURCE_TTL_MS = 60_000

let liveCache: { atMs: number; value: VisitSourceSnapshot } | null = null
let liveInflight: Promise<VisitSourceSnapshot> | null = null

export async function getVisitSourceLiveSnapshot(
  ttlMs: number = VISIT_SOURCE_TTL_MS,
): Promise<VisitSourceSnapshot> {
  const nowMs = Date.now()
  if (liveCache && nowMs - liveCache.atMs < ttlMs) return liveCache.value
  if (liveInflight) return liveInflight
  const current = (async () => {
    try {
      const value = await computeVisitSource()
      liveCache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      liveInflight = null
    }
  })()
  liveInflight = current
  return current
}

/** 仅测试用:清缓存。 */
export function __resetVisitSourceCacheForTest(): void {
  liveCache = null
  liveInflight = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
