// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌...

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
 * 调度:cron `0 */3 * * *`(每 3 小时),由 index.ts 注册,ENABLE_HOT_WORDS_SYNC=false 可禁。
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

/**
 * 热搜词去重 upsert:存在则更新排序(越小越靠前),不存在则插入。
 * word 截断到 100(表字段约束),空词跳过。
 */
async function upsertHotWord(word: string, position: number): Promise<void> {
  const clean = word.trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').slice(0, 100)
  if (!clean) return
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
  } else {
    await db.insert(hotWords).values({ word: clean, sort: position, status: 'active' })
  }
}

/** 1. Hacker News 官方 Top Stories(取前 20 篇标题) */
async function fetchHackerNews(): Promise<number> {
  const idsData = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')
  if (!Array.isArray(idsData)) throw new Error('HN topstories 返回非数组')
  const top = (idsData as number[]).slice(0, 20)
  const items = await Promise.all(
    top.map((id) =>
      fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null),
    ),
  )
  let n = 0
  let pos = 1
  for (const it of items) {
    const t = (it as { title?: string } | null)?.title
    if (!t) continue
    await upsertHotWord(t, pos++)
    n++
  }
  return n
}

/** 2. GitHub Trending 官方页面(取前 15 个仓库 owner/repo) */
async function fetchGitHubTrending(): Promise<number> {
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
    let n = 0
    let pos = 1
    $('article h2 a').each((_: number, el: cheerio.AnyNode) => {
      const href = $(el).attr('href') ?? ''
      const repo = href.replace(/^\//, '').trim()
      if (!repo || !repo.includes('/')) return
      upsertHotWord(repo, pos++)
      n++
    })
    // 限制返回前 15 个
    return Math.min(n, 15)
  } finally {
    clearTimeout(timer)
  }
}

/** 3. 百度热搜官方 JSON(取前 20 条) */
async function fetchBaiduHot(): Promise<number> {
  const data = await fetchJson(
    'https://top.baidu.com/api/board?platform=wise&tab=realtime',
  )
  const cards = (data as { data?: { cards?: Array<{ content?: Array<{ word?: string }> }> } })
    ?.data?.cards
  const list = cards?.[0]?.content ?? []
  let n = 0
  let pos = 1
  for (const item of list.slice(0, 20)) {
    if (!item.word) continue
    // 过滤掉明显带营销角标/广告的词,避免杂质
    if (/广告|活动|推广/.test(item.word ?? '')) continue
    await upsertHotWord(item.word!, pos++)
    n++
  }
  return n
}

/** 采集入口:三个源并行抓取,单个失败不阻塞其余 */
export async function syncHotWords(): Promise<
  Array<{ source: string; count: number; status: 'success' | 'error' }>
> {
  const jobs: Array<[string, () => Promise<number>]> = [
    ['hacker-news', fetchHackerNews],
    ['github-trending', fetchGitHubTrending],
    ['baidu-hot', fetchBaiduHot],
  ]
  const results = await Promise.all(
    jobs.map(async ([source, fn]) => {
      try {
        const count = await fn()
        logger.info(`[hot-words-sync] ${source}: ${count} words`)
        return { source, count, status: 'success' as const }
      } catch (err) {
        logger.warn(`[hot-words-sync] ${source} failed: ${(err as Error).message}`)
        return { source, count: 0, status: 'error' as const }
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