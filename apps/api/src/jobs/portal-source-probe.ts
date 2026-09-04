// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌...

/**
 * 门户/媒体信源「恢复探测」定时任务。
 *
 * 背景:网易/搜狐/36氪等国内门户目前不提供干净的官方公开 RSS(返回 HTML 壳或空 XML),
 * 本次已实测并放弃接入。但这些平台历史上开放过 feed,未来可能恢复。本任务周期性
 * 探测候选源,一旦发现返回「真实可解析的 RSS(feed 含 ≥1 条条目)」,就自动 upsert
 * 进 ai_feed_source(enabled=true),让采集 cron 自动纳入,无需人工介入。
 *
 * 判定标准(防误入):
 * - HTTP 200 且响应体是 XML(text/xml|application/xml|application/rss+xml|application/atom+xml)
 * - 响应体 ≥ minBytes(过滤 127B/8KB 的 HTML 壳或空壳)
 * - rss-parser 能解析出 ≥1 条 item(保证是真 feed 而非空页面)
 * 三者全部满足才视为「已恢复」。
 *
 * 调度:cron `0 30 4 * * *`(每天 04:30 探测一次,门户很少变,频繁探测无意义)。
 * 由 index.ts 注册,ENABLE_SOURCE_PROBE=false 可禁用。
 * 幂等:源已存在(source_code 命中)则跳过,不重复插入、不修改现有 enabled。
 */

import cron, { type ScheduledTask } from 'node-cron'
import { eq } from 'drizzle-orm'
import Parser from 'rss-parser'
import { aiFeedSource } from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

const FETCH_TIMEOUT_MS = 20_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/** rss-parser 单例(判定 feed 是否真实可解析) */
const rssParser = new Parser({
  timeout: 15_000,
  headers: { 'User-Agent': 'IHUI-AI-Feed-Probe/1.0 (+https://aizhs.top)' },
})

interface ProbeCandidate {
  sourceCode: string
  sourceName: string
  sourceType: 'rss'
  /** 依次尝试的候选 feed URL,命中任一有效即用 */
  probeUrls: string[]
  category: string
  icon: string | null
  color: string | null
  sortOrder: number
  /** feed 体最小字节数,过滤 HTML 壳/空壳(搜狐 8KB HTML / 网易 127B 空 xml) */
  minBytes: number
  description: string
}

/**
 * 已实测目前不可用的国内门户候选源。将来某平台恢复公开 feed 时自动入源。
 * 说明:腾讯/搜狗无任何公开 feed URL,无法预测,暂不列入。
 */
const PROBE_CANDIDATES: ProbeCandidate[] = [
  {
    sourceCode: 'netease-news',
    sourceName: '网易新闻',
    sourceType: 'rss',
    probeUrls: [
      'http://news.163.com/special/00011K6L/rss_newstop.xml',
      'https://news.163.com/special/00011K6L/rss_index.xml',
      'http://tech.163.com/special/00011K6L/rss_tech.xml',
    ],
    category: 'general',
    icon: 'netease',
    color: '#E60012',
    sortOrder: 312,
    minBytes: 500,
    description: '网易新闻官方主要新闻 RSS(历史开放过,恢复后自动接入)',
  },
  {
    sourceCode: 'sohu-tech',
    sourceName: '搜狐科技',
    sourceType: 'rss',
    probeUrls: ['https://it.sohu.com/rss.php', 'https://www.sohu.com/rss.php'],
    category: 'ai-media',
    icon: 'sohu',
    color: '#FFB400',
    sortOrder: 313,
    minBytes: 500,
    description: '搜狐科技频道原生 RSS(当前返回 HTML 壳,恢复后自动接入)',
  },
  {
    sourceCode: '36kr-news',
    sourceName: '36氪',
    sourceType: 'rss',
    probeUrls: ['https://36kr.com/feed', 'https://36kr.com/feed.html'],
    category: 'ai-media',
    icon: '36kr',
    color: '#0061FE',
    sortOrder: 314,
    minBytes: 500,
    description: '36氪官方 feed(当前返回 HTML,恢复后自动接入)',
  },
]

/** 带超时的 fetch,发起前构造 UA */
async function fetchText(url: string): Promise<{ ok: boolean; status: number; type: string; body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    })
    const type = res.headers.get('content-type') ?? ''
    const body = await res.text()
    return { ok: res.ok, status: res.status, type, body }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 判定一个 URL 是否为「真实可用」的 RSS feed:
 * 1) HTTP 200
 * 2) Content-Type 是 XML 之一
 * 3) 体 ≥ minBytes
 * 4) rss-parser 能解析出 ≥1 条 item
 */
async function isValidRssFeed(url: string, minBytes: number): Promise<boolean> {
  const { ok, type, body } = await fetchText(url)
  if (!ok) return false
  if (!/xml|rss|atom/i.test(type)) return false
  if (body.length < minBytes) return false
  try {
    const feed = await rssParser.parseString(body)
    return (feed.items?.length ?? 0) >= 1
  } catch {
    return false
  }
}

/** 探测全部候选源,恢复的自动入源。返回本次结果明细。 */
export async function probePortalSources(): Promise<
  Array<{ sourceCode: string; status: 'added' | 'exists' | 'not-recovered' | 'error'; url?: string }>
> {
  const results: Array<{
    sourceCode: string
    status: 'added' | 'exists' | 'not-recovered' | 'error'
    url?: string
  }> = []

  for (const cand of PROBE_CANDIDATES) {
    // 已存在则跳过(幂等,不重复插入、不改 enabled)
    const [existing] = await db
      .select({ id: aiFeedSource.id })
      .from(aiFeedSource)
      .where(eq(aiFeedSource.sourceCode, cand.sourceCode))
      .limit(1)
    if (existing) {
      results.push({ sourceCode: cand.sourceCode, status: 'exists' })
      continue
    }

    let validUrl: string | undefined
    for (const url of cand.probeUrls) {
      try {
        if (await isValidRssFeed(url, cand.minBytes)) {
          validUrl = url
          break
        }
      } catch {
        /* 单 URL 探测失败,尝试下一个 */
      }
    }

    if (!validUrl) {
      results.push({ sourceCode: cand.sourceCode, status: 'not-recovered' })
      continue
    }

    // 恢复成功 → 自动入源(enabled=true)
    try {
      await db.insert(aiFeedSource).values({
        sourceCode: cand.sourceCode,
        sourceName: cand.sourceName,
        sourceType: cand.sourceType,
        endpoint: validUrl,
        category: cand.category,
        icon: cand.icon,
        color: cand.color,
        enabled: true,
        sortOrder: cand.sortOrder,
        fetchIntervalMinutes: 360,
        description: cand.description,
      })
      results.push({ sourceCode: cand.sourceCode, status: 'added', url: validUrl })
      logger.info(`[source-probe] 自动接入新信源: ${cand.sourceName} (${validUrl})`)
    } catch (e) {
      results.push({ sourceCode: cand.sourceCode, status: 'error' })
      logger.warn(`[source-probe] 入源 ${cand.sourceCode} 失败: ${(e as Error).message}`)
    }
  }

  const ok = results.filter((r) => r.status === 'added').length
  logger.info(`[source-probe] done: added=${ok}/${results.length}`)
  return results
}

// ===== 调度器(每天 04:30)=====

let scheduledTask: ScheduledTask | null = null

export function startSourceProbeScheduler(): void {
  if (scheduledTask) return
  scheduledTask = cron.schedule(
    '30 4 * * *',
    async () => {
      try {
        await probePortalSources()
      } catch (err) {
        logger.error('[source-probe] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[source-probe] scheduler started (cron: "30 4 * * *" Asia/Shanghai)')
}

export function stopSourceProbeScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌...