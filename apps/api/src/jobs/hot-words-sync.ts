// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 热搜词采集任务(hot_words 表)。
 *
 * 背景:搜索页热搜词表 hot_words 为空;本任务从权威、本机可达的实时榜单采集热搜词,
 * 支持搜索建议(suggestions)展示,并按 word 去重 upsert(已有→更新排序,新增→插入)。
 *
 * 数据源(全部实测可达、免鉴权,只用原始/官方源):
 * 1. Hacker News 官方 firebase API(国际科技/AI 热榜,实时)
 * 2. GitHub Trending 官方页面(开源项目热榜,解析 owner/repo)
 * 3. 百度热搜官方 JSON(国内实时热搜)
 *
 * 调度:每 3 小时运行一次(分钟=0,时=0/3/6/...),由 index.ts 注册,ENABLE_HOT_WORDS_SYNC=false 可禁。
 * 去重:hot_words 无唯一约束,采用「先按 word 查询→存在则更新 sort,不存在则插入」,
 *   不删除既有词(避免误删管理员手置热搜词)。
 */

import cron, { type ScheduledTask } from 'node-cron'
import { eq } from 'drizzle-orm'
import * as cheerio from 'cheerio'
import { hotWords } from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

const FETCH_TIMEOUT_MS = 20_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/** 带超时 + 单次自动重试的 fetch(缓解网络抖动导致偶发空档) */
async function fetchJson(url: string): Promise<unknown> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      lastErr = err
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

/** 单条写入的结局:新增 / 更新 / 空词跳过(不计入任何统计)。 */
export type HotWordWriteOutcome = 'inserted' | 'updated' | 'skipped'

/** 写入函数(可注入,便于测试替换真实 DB)。 */
export type HotWordWriter = (word: string, position: number) => Promise<HotWordWriteOutcome>

/**
 * 热搜词去重 upsert:存在则更新排序(越小越靠前),不存在则插入。
 * word 截断到 100(表字段约束),空词跳过。
 */
async function upsertHotWord(word: string, position: number): Promise<HotWordWriteOutcome> {
  const clean = word.trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').slice(0, 100)
  if (!clean) return 'skipped'
  const existing = await db
    .select({ id: hotWords.id })
    .from(hotWords)
    .where(eq(hotWords.word, clean))
    .limit(1)
  if (existing.length > 0) {
    await db
      .update(hotWords)
      .set({ sort: position, status: 'active', updatedAt: new Date() })
      .where(eq(hotWords.id, existing[0]!.id))
    return 'updated'
  }
  await db.insert(hotWords).values({ word: clean, sort: position, status: 'active' })
  return 'inserted'
}

/** 单个源写入后的统计:成功按新增/更新拆分,失败逐条计数并留摘要。 */
interface SourceStats {
  inserted: number
  updated: number
  failed: number
  errors: string[]
}

/**
 * 串行写入:逐条 await,单条失败只计 failed 并继续下一条(不再整源中断)。
 * 串行而非并发:upsert 是「先查后插」,并发会放大重复行与连接池压力。
 */
async function persistWords(words: string[], write: HotWordWriter): Promise<SourceStats> {
  const stats: SourceStats = { inserted: 0, updated: 0, failed: 0, errors: [] }
  let position = 1
  for (const word of words) {
    try {
      const outcome = await write(word, position++)
      if (outcome === 'inserted') stats.inserted++
      else if (outcome === 'updated') stats.updated++
    } catch (err) {
      stats.failed++
      const reason = err instanceof Error ? err.message : String(err)
      const summary = `${word.slice(0, 40)}: ${reason.slice(0, 160)}`
      stats.errors.push(summary)
      logger.warn(`[hot-words-sync] write failed: ${summary}`)
    }
  }
  return stats
}

/** 1. Hacker News 官方 Top Stories(取前 20 篇标题) */
async function fetchHackerNews(): Promise<string[]> {
  const idsData = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')
  if (!Array.isArray(idsData)) throw new Error('HN topstories 返回非数组')
  const top = (idsData as number[]).slice(0, 20)
  const items = await Promise.all(
    top.map((id) =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null),
    ),
  )
  const words: string[] = []
  for (const it of items) {
    const t = (it as { title?: string } | null)?.title
    if (t) words.push(t)
  }
  return words
}

/** 2. GitHub Trending 官方页面(取前 15 个仓库 owner/repo) */
async function fetchGitHubTrending(): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch('https://github.com/trending', {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const $ = cheerio.load(html)
    // F-123:先把候选**同步**收集出来,再逐条 await 落库。
    //
    // 修前是 `.each((_, el) => { upsertHotWord(...); n++ })` —— 回调不是 async,
    // `upsertHotWord` 返回的 Promise 既没 await 也没 catch:
    //   · DB 失败时 logs 仍报 success,实际一条没写(unhandledRejection 只记日志);
    //   · `n++` 在 DB 操作发起前就执行,count 与实际写入数无关;
    //   · `Math.min(n, 15)` 只截返回值,库里的条数不受这 15 的约束。
    // 现在:collect 阶段纯同步(不产生悬空 Promise),写入阶段逐条 await,
    // 上限在收集阶段就截断(15 条),失败逐条计入 failed 且不中断后续条目。
    const repos: string[] = []
    $('article h2 a').each((_, el) => {
      if (repos.length >= 15) return
      const href = $(el).attr('href') ?? ''
      const repo = href.replace(/^\//, '').trim()
      if (!repo || !repo.includes('/')) return
      repos.push(repo)
    })
    return repos
  } finally {
    clearTimeout(timer)
  }
}

/** 3. 百度热搜官方 JSON(取前 20 条) */
async function fetchBaiduHot(): Promise<string[]> {
  const data = await fetchJson('https://top.baidu.com/api/board?platform=wise&tab=realtime')
  const cards = (data as { data?: { cards?: Array<{ content?: Array<{ word?: string }> }> } })?.data
    ?.cards
  const list = cards?.[0]?.content ?? []
  const words: string[] = []
  for (const item of list.slice(0, 20)) {
    if (!item.word) continue
    // 过滤掉明显带营销角标/广告的词,避免杂质
    if (/广告|活动|推广/.test(item.word)) continue
    words.push(item.word)
  }
  return words
}

/** 单个源的同步结果:写入统计与实际写入一一对应。 */
export interface HotWordSyncSourceResult {
  source: string
  inserted: number
  updated: number
  failed: number
  /** 成功写入数(inserted + updated),供既有日志/调用方使用 */
  count: number
  /** 任一条目失败即为 error(其余条目仍会继续写) */
  status: 'success' | 'error'
  /** 失败条目摘要(word: reason),便于定位具体词与原因 */
  errors: string[]
}

export interface HotWordSyncOptions {
  /** 写入函数,默认 upsertHotWord;测试可注入假实现 */
  write?: HotWordWriter
}

/** 采集入口:三个源并行抓取,单个源失败不阻塞其余 */
export async function syncHotWords(
  options: HotWordSyncOptions = {},
): Promise<HotWordSyncSourceResult[]> {
  const write = options.write ?? upsertHotWord
  const jobs: Array<[string, () => Promise<string[]>]> = [
    ['hacker-news', fetchHackerNews],
    ['github-trending', fetchGitHubTrending],
    ['baidu-hot', fetchBaiduHot],
  ]
  const results = await Promise.all(
    jobs.map(async ([source, fetchWords]) => {
      try {
        const words = await fetchWords()
        const stats = await persistWords(words, write)
        const count = stats.inserted + stats.updated
        const status = stats.failed > 0 ? ('error' as const) : ('success' as const)
        logger.info(
          `[hot-words-sync] ${source}: ${count} words (inserted=${stats.inserted} updated=${stats.updated} failed=${stats.failed})`,
        )
        return {
          source,
          inserted: stats.inserted,
          updated: stats.updated,
          failed: stats.failed,
          count,
          status,
          errors: stats.errors,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.warn(`[hot-words-sync] ${source} failed: ${message}`)
        return {
          source,
          inserted: 0,
          updated: 0,
          failed: 0,
          count: 0,
          status: 'error' as const,
          errors: [message],
        }
      }
    }),
  )
  return results
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

export function startHotWordsScheduler(): void {
  if (scheduledTask) return
  scheduledTask = cron.schedule(
    '0 */3 * * *',
    async () => {
      try {
        const results = await syncHotWords()
        const ok = results.filter((r) => r.status === 'success').length
        logger.info(`[hot-words-sync] done: ${ok}/${results.length} sources ok`)
      } catch (err) {
        logger.error('[hot-words-sync] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[hot-words-sync] scheduler started (cron: "0 */3 * * *" Asia/Shanghai)')
}

export function stopHotWordsScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
